import { WebPubSubServiceClient } from "@azure/web-pubsub";

// Env
const HUB_NAME = "proxyhub";
const CONNECTION_STRING = process.env.PUBSUB_CONNECTION_STRING || "";
const CLIENT_ID = process.env.CLIENT_ID || "";
const LOCAL_API_URL = process.env.LOCAL_API_URL || "";

if (!CONNECTION_STRING) { console.error("[startup] Missing PUBSUB_CONNECTION_STRING"); process.exit(1); }
if (!CLIENT_ID) { console.error("[startup] Missing CLIENT_ID"); process.exit(1); }
if (!LOCAL_API_URL) { console.error("[startup] Missing LOCAL_API_URL"); process.exit(1); }

type RequestEnvelope = {
  type: "request";
  requestId: string;
  method: string;
  path: string;
  body?: any;
};

type ResponseEnvelope = {
  type: "response";
  requestId: string;
  status: number;
  body: any;
};

/**
 * Join two URL parts without duplicating or missing slashes.
 */
const joinUrl = (base: string, path: string): string => {
  if (!base.endsWith("/") && !path.startsWith("/")) return base + "/" + path;
  if (base.endsWith("/") && path.startsWith("/")) return base + path.slice(1);
  return base + path;
};

/**
 * Resolve a fetch implementation across Node/Bun environments.
 */
const getFetch = async (): Promise<typeof fetch> => {
  if (typeof (globalThis as any).fetch === "function") return (globalThis as any).fetch;
  const mod = await import("node-fetch");
  // @ts-ignore - default export for node-fetch
  return (mod.default || mod) as any;
};

/**
 * Forward a request to the local API and wrap the result in a response envelope.
 */
const forwardToLocal = async (reqMsg: RequestEnvelope): Promise<ResponseEnvelope> => {
  const url = joinUrl(LOCAL_API_URL, reqMsg.path);
  const method = (reqMsg.method || "GET").toUpperCase();
  const hasBody = reqMsg.body !== undefined && reqMsg.body !== null && method !== "GET" && method !== "HEAD";
  const headers: Record<string, string> = hasBody ? { "content-type": "application/json" } : {};
  const body = hasBody ? JSON.stringify(reqMsg.body) : undefined;

  console.log("[handle] forwarding to local API", { method, url });
  try {
    const f = await getFetch();
    const resp = await f(url, { method, headers, body });
    const status = (resp as any).status;
    const ct = (resp as any).headers?.get?.("content-type") || "";
    let respBody: any = null;
    if (typeof (resp as any).json === "function" && ct.includes("application/json")) {
      try { respBody = await (resp as any).json(); } catch { respBody = await (resp as any).text(); }
    } else if (typeof (resp as any).text === "function") {
      respBody = await (resp as any).text();
    }
    console.log("[handle] local API responded", { status });
    return { type: "response", requestId: reqMsg.requestId, status, body: respBody };
  } catch (err: any) {
    console.error("[handle] local API error", err);
    return { type: "response", requestId: reqMsg.requestId, status: 500, body: { error: String(err?.message || err || "Unknown error") } };
  }
};

/**
 * Process an inbound Web PubSub message and, if it is a request, send a response.
 */
const onMessage = (ws: any) => async (event: any) => {
  try {
    const raw = typeof event.data === "string" ? event.data : String(event.data);
    const msg = JSON.parse(raw);

    if (msg?.type === "system" && msg?.event === "connected") {
      console.log("[ws] connected", { connectionId: msg?.connectionId });
      return;
    }
    if (msg?.type === "ack") {
      console.log("[ws] ack", msg);
      return;
    }
    if (msg?.type === "message") {
      const dataType = msg?.dataType;
      let payload = msg?.data;
      if (dataType === "text" && typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch {}
      }
      if (payload && typeof payload === "object" && payload.type === "request") {
        const reqMsg = payload as RequestEnvelope;
        console.log("[ws] request received", { path: reqMsg.path, method: reqMsg.method, requestId: reqMsg.requestId });
        const response = await forwardToLocal(reqMsg);
        const outbound = { type: "sendToGroup", group: "server", dataType: "json", data: response } as const;
        console.log("[ws] sending response", { requestId: response.requestId, status: response.status });
        ws.send(JSON.stringify(outbound));
        return;
      }
      console.log("[ws] non-request message ignored");
      return;
    }
    console.log("[ws] other message", msg);
  } catch (err) {
    console.error("[ws] failed to process message", err);
  }
};

/**
 * Client bootstrap: acquires access URL, connects WS, and joins group.
 */
const main = async () => {
  console.log("[startup] proxy-client", { HUB_NAME, CLIENT_ID, LOCAL_API_URL });

  // Use service client to mint client access token URL
  const serviceClient = new WebPubSubServiceClient(CONNECTION_STRING, HUB_NAME);
  const token = await serviceClient.getClientAccessToken({
    roles: ["webpubsub.joinLeaveGroup", "webpubsub.sendToGroup"],
    userId: `client:${CLIENT_ID}`,
  });
  const { url } = token;
  if (!url) throw new Error("Failed to acquire client access URL from Web PubSub");

  // Use native WebSocket if available (Node 20+), else dynamic import 'ws'
  const WSImpl: any = (globalThis as any).WebSocket || (await import("ws")).default;
  const ws = new WSImpl(url, "json.webpubsub.azure.v1");

  ws.onopen = () => {
    console.log("[ws] open, joining group", { group: CLIENT_ID });
    ws.send(JSON.stringify({ type: "joinGroup", group: CLIENT_ID }));
  };
  ws.onmessage = onMessage(ws);
  ws.onclose = (ev: any) => console.warn("[ws] closed", { code: ev?.code, reason: String(ev?.reason || "") });
  ws.onerror = (err: any) => console.error("[ws] error", err);
};

main().catch((err) => { console.error("[fatal]", err); process.exit(1); });
