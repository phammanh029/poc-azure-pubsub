import { v4 as uuidv4 } from "uuid";
import { WebPubSubServiceClient } from "@azure/web-pubsub";

// Configuration
const HUB_NAME = "proxyhub";
const PORT = Number(process.env.PORT || 8080);
const CONNECTION_STRING = process.env.PUBSUB_CONNECTION_STRING || "";

if (!CONNECTION_STRING) {
  console.error("[startup] Missing PUBSUB_CONNECTION_STRING environment variable");
}

// Azure Web PubSub service client
const wpsClient = new WebPubSubServiceClient(CONNECTION_STRING, HUB_NAME);

// Correlation map for pending responses (stateless beyond correlation)
type Pending = {
  resolve: (value: { status: number; body: any }) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
const pending = new Map<string, Pending>();

function tryParseJSON(payload: any) {
  if (payload == null) return payload;
  if (typeof payload === "object") return payload;
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return payload; }
  }
  return payload;
}

async function handleInvoke(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") || undefined;
  const path = url.searchParams.get("path") || undefined;

  console.log("[invoke] incoming", { clientId, path, method: req.method });

  if (!clientId || !path) {
    return new Response(JSON.stringify({ error: "Missing required query params: clientId and path" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  let body: any = null;
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json().catch(() => null);
    } else {
      const text = await req.text();
      body = text ? tryParseJSON(text) : null;
    }
  } catch { body = null; }

  const requestId = uuidv4();
  const message = { type: "request" as const, requestId, method: req.method, path, body };
  console.log("[invoke] prepared message", { requestId });

  const responsePromise = new Promise<{ status: number; body: any }>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      console.warn("[invoke] timeout waiting for response", { requestId });
      reject(new Error("Gateway Timeout"));
    }, 10_000);
    pending.set(requestId, { resolve, reject, timer });
  });

  try {
    console.log("[invoke] sending to group", { group: clientId });
    await wpsClient.group(clientId).sendToAll(JSON.stringify(message), { contentType: "application/json" });
  } catch (err) {
    console.error("[invoke] failed to publish to Web PubSub", err);
    const p = pending.get(requestId);
    if (p) { clearTimeout(p.timer); pending.delete(requestId); }
    return new Response(JSON.stringify({ error: "Failed to publish to PubSub" }), { status: 502, headers: { "content-type": "application/json" } });
  }

  try {
    const response = await responsePromise;
    console.log("[invoke] got response", { requestId, status: response.status });
    return new Response(JSON.stringify(response.body), { status: response.status, headers: { "content-type": "application/json" } });
  } catch {
    console.error("[invoke] responding with 504 due to timeout or error", { requestId });
    return new Response(JSON.stringify({ error: "Gateway Timeout" }), { status: 504, headers: { "content-type": "application/json" } });
  }
}

async function handleEvents(req: Request): Promise<Response> {
  const ceType = req.headers.get("ce-type");
  const contentType = req.headers.get("content-type");
  console.log("[events] received", { ceType, contentType });

  let raw = await req.text();
  const payload = tryParseJSON(raw);

  if (ceType === "azure.webpubsub.user.message") {
    try {
      const data = payload;
      if (data && typeof data === "object" && data.type === "response" && typeof data.requestId === "string") {
        const entry = pending.get(data.requestId);
        const status = typeof (data as any).status === "number" ? (data as any).status : 200;
        if (entry) {
          clearTimeout(entry.timer);
          pending.delete((data as any).requestId);
          console.log("[events] resolved pending response", { requestId: (data as any).requestId, status });
          entry.resolve({ status, body: ("body" in (data as any) ? (data as any).body : null) });
        } else {
          console.warn("[events] no pending for requestId", { requestId: (data as any).requestId });
        }
      } else {
        console.warn("[events] non-response payload or missing requestId");
      }
    } catch (err) {
      console.error("[events] failed to process payload", err);
    }
  }

  return new Response(null, { status: 200 });
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: { "content-type": "application/json" } });
}

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (req.method === "POST" && url.pathname === "/invoke") {
      return handleInvoke(req);
    }
    if (req.method === "POST" && url.pathname === "/events") {
      return handleEvents(req);
    }
    return notFound();
  },
});

console.log(`[startup] proxy-server listening on :${server.port}`);
console.log(`[startup] hub: ${HUB_NAME}`);
