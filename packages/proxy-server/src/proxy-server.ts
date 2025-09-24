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

/**
 * Safely parse a potential JSON string.
 */
const parseJSON = (payload: unknown): unknown => {
  if (payload == null || typeof payload === "object") return payload as any;
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return payload; }
  }
  return payload;
};

/**
 * Build a JSON Response with provided status.
 */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Extract required query params from a Request URL.
 */
const readInvokeParams = (req: Request) => {
  const url = new URL(req.url);
  return {
    clientId: url.searchParams.get("clientId") || undefined,
    path: url.searchParams.get("path") || undefined,
  } as const;
};

/**
 * Register a promise awaiting a correlated response.
 */
const awaitResponse = (requestId: string, timeoutMs = 10_000) =>
  new Promise<{ status: number; body: any }>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      console.warn("[invoke] timeout waiting for response", { requestId });
      reject(new Error("Gateway Timeout"));
    }, timeoutMs);
    pending.set(requestId, { resolve, reject, timer });
  });

/**
 * Publish a message to the target group via Web PubSub.
 */
const publish = async (group: string, data: unknown) =>
  wpsClient.group(group).sendToAll(JSON.stringify(data), { contentType: "application/json" });

/**
 * Handle POST /invoke
 */
const handleInvoke = async (req: Request): Promise<Response> => {
  const { clientId, path } = readInvokeParams(req);
  console.log("[invoke] incoming", { clientId, path, method: req.method });

  if (!clientId || !path) {
    return json({ error: "Missing required query params: clientId and path" }, 400);
  }

  const contentType = req.headers.get("content-type") || "";
  const raw = contentType.includes("application/json") ? await req.json().catch(() => null) : await req.text();
  const body = contentType.includes("application/json") ? raw : raw ? parseJSON(raw) : null;

  const requestId = uuidv4();
  const message = { type: "request" as const, requestId, method: req.method, path, body };
  console.log("[invoke] prepared message", { requestId });

  const responsePromise = awaitResponse(requestId);

  try {
    console.log("[invoke] sending to group", { group: clientId });
    await publish(clientId, message);
  } catch (err) {
    console.error("[invoke] failed to publish to Web PubSub", err);
    const p = pending.get(requestId);
    if (p) { clearTimeout(p.timer); pending.delete(requestId); }
    return json({ error: "Failed to publish to PubSub" }, 502);
  }

  try {
    const response = await responsePromise;
    console.log("[invoke] got response", { requestId, status: response.status });
    return json(response.body, response.status);
  } catch {
    console.error("[invoke] responding with 504 due to timeout or error", { requestId });
    return json({ error: "Gateway Timeout" }, 504);
  }
};

/**
 * Handle POST /events from Azure Web PubSub upstream.
 */
const handleEvents = async (req: Request): Promise<Response> => {
  const ceType = req.headers.get("ce-type");
  const contentType = req.headers.get("content-type");
  console.log("[events] received", { ceType, contentType });

  const raw = await req.text();
  const payload = parseJSON(raw) as any;

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
};

/**
 * 404 JSON response.
 */
const notFound = (): Response => json({ error: "Not Found" }, 404);

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") return json({ status: "ok" });
    if (req.method === "POST" && url.pathname === "/invoke") return handleInvoke(req);
    if (req.method === "POST" && url.pathname === "/events") return handleEvents(req);
    return notFound();
  },
});

console.log(`[startup] proxy-server listening on :${server.port}`);
console.log(`[startup] hub: ${HUB_NAME}`);
