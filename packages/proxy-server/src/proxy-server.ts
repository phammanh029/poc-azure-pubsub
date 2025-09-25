import { v4 as uuidv4 } from 'uuid';
import {
  WebPubSubServiceClient,
} from '@azure/web-pubsub';

// Configuration
const HUB_NAME = 'proxyhub';
const PORT = Number(process.env.PORT || 8080);
const CONNECTION_STRING = process.env.PUBSUB_CONNECTION_STRING || '';
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''; // reserved for future protection
const ALLOWED_CLIENT_IDS = (process.env.ALLOWED_CLIENT_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const READY_STORE = (process.env.READY_STORE || 'memory').toLowerCase(); // 'memory' | 'redis'
const REDIS_URL = process.env.REDIS_URL || ''; // e.g., redis://valkey:6379
const INSTANCE_ID = (globalThis as any).crypto?.randomUUID?.() || uuidv4();
const RESPONSE_HUB = `response-${INSTANCE_ID}`;
const SYSTEM_HUB = 'system';

if (!CONNECTION_STRING) {
  console.error(
    '[startup] Missing PUBSUB_CONNECTION_STRING environment variable'
  );
}

// Azure Web PubSub service clients (per hub)
const wpsResponse = new WebPubSubServiceClient(CONNECTION_STRING, RESPONSE_HUB);
const wpsSystem = new WebPubSubServiceClient(CONNECTION_STRING, SYSTEM_HUB);

// Correlation map for pending responses (stateless beyond correlation)
type Pending = {
  resolve: (value: { status: number; body: any }) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
const pending = new Map<string, Pending>();

// Readiness store (memory or Redis/Valkey)
type ReadyStore = {
  setReady: (clientId: string, ready: boolean) => Promise<void>;
  isReady: (clientId: string) => Promise<boolean>;
};

const createReadyStore = async (): Promise<ReadyStore> => {
  if (READY_STORE === 'redis' && REDIS_URL) {
    try {
      const mod: any = await import('ioredis').catch(() => null);
      if (!mod) throw new Error('ioredis not installed');
      const Redis = mod.default || mod;
      const client = new Redis(REDIS_URL);
      const key = (id: string) => `ready:${id}`;
      return {
        setReady: async (clientId, ready) => {
          if (ready) await client.set(key(clientId), '1');
          else await client.del(key(clientId));
        },
        isReady: async (clientId) => Boolean(await client.get(key(clientId))),
      };
    } catch (err) {
      console.warn('[ready] falling back to memory store', err);
    }
  }
  const mem = new Map<string, boolean>();
  return {
    setReady: async (clientId, ready) => {
      ready ? mem.set(clientId, true) : mem.delete(clientId);
    },
    isReady: async (clientId) => Boolean(mem.get(clientId)),
  };
};

const readyStorePromise = createReadyStore();

/**
 * Safely parse a potential JSON string.
 */
const parseJSON = (payload: unknown): unknown => {
  if (payload == null || typeof payload === 'object') return payload as any;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }
  return payload;
};

/**
 * Build a JSON Response with provided status.
 */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Extract required query params from a Request URL.
 */
const readInvokeParams = (req: Request) => {
  const url = new URL(req.url);
  return {
    clientId: url.searchParams.get('clientId') || undefined,
    path: url.searchParams.get('path') || undefined,
  } as const;
};

/**
 * Register a promise awaiting a correlated response.
 */
const awaitResponse = (requestId: string, timeoutMs = 30_000) =>
  new Promise<{ status: number; body: any }>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      console.warn('[invoke] timeout waiting for response', { requestId });
      reject(new Error('Gateway Timeout'));
    }, timeoutMs);
    pending.set(requestId, { resolve, reject, timer });
  });

/**
 * Publish a message to the target user via Web PubSub.
 */
const publish = async (clientId: string, data: unknown) =>
  wpsSystem.sendToUser(clientId, JSON.stringify(data), {});

/**
 * Handle POST /invoke
 */
const handleInvoke = async (req: Request): Promise<Response> => {
  const { clientId, path } = readInvokeParams(req);
  console.log('[invoke] incoming', { clientId, path, method: req.method });

  if (!clientId || !path) {
    return json(
      { error: 'Missing required query params: clientId and path' },
      400
    );
  }

  // Block if client not ready
  const store = await readyStorePromise;
  const ready = await store.isReady(clientId);
  if (!ready) {
    return json({ error: 'Client not ready' }, 409);
  }

  const contentType = req.headers.get('content-type') || '';
  const raw = contentType.includes('application/json')
    ? await req.json().catch(() => null)
    : await req.text();
  const body = contentType.includes('application/json')
    ? raw
    : raw
    ? parseJSON(raw)
    : null;

  const requestId = uuidv4();
  const message = {
    type: 'request' as const,
    requestId,
    method: req.method,
    path,
    body,
  };
  console.log('[invoke] prepared message', { requestId });

  const responsePromise = awaitResponse(requestId);

  try {
    console.log('[invoke] sending to group', { group: clientId });
    await publish(clientId, message);
  } catch (err) {
    console.error('[invoke] failed to publish to Web PubSub', err);
    const p = pending.get(requestId);
    if (p) {
      clearTimeout(p.timer);
      pending.delete(requestId);
    }
    return json({ error: 'Failed to publish to PubSub' }, 502);
  }

  try {
    const response = await responsePromise;
    console.log('[invoke] got response', {
      requestId,
      status: response.status,
    });
    return json(response.body, response.status);
  } catch {
    console.error('[invoke] responding with 504 due to timeout or error', {
      requestId,
    });
    return json({ error: 'Gateway Timeout' }, 504);
  }
};

/**
 * Handle POST /events from Azure Web PubSub upstream.
 * Routes by hub: responses -> correlate pending; system -> init/diagnostics.
 */
const handleEvents = async (req: Request): Promise<Response> => {
  const ceType = req.headers.get('ce-type') || '';
  const contentType = req.headers.get('content-type') || '';
  const ceHub = req.headers.get('ce-hub') || '';
  const ceSource = req.headers.get('ce-source') || '';
  const hubFromSource = () => {
    try {
      const parts = ceSource.split('/hubs/');
      if (parts.length > 1) return parts[1].split('/')[0];
    } catch {}
    return '';
  };
  const hub = ceHub || hubFromSource();
  console.log('[events] received', { ceType, contentType, hub });

  const raw = await req.text();
  const payload = parseJSON(raw) as any;

  if (ceType === 'azure.webpubsub.user.message' && hub === RESPONSE_HUB) {
    try {
      const data = payload;
      if (
        data &&
        typeof data === 'object' &&
        data.type === 'response' &&
        typeof data.requestId === 'string'
      ) {
        const entry = pending.get(data.requestId);
        const status =
          typeof (data as any).status === 'number' ? (data as any).status : 200;
        if (entry) {
          clearTimeout(entry.timer);
          pending.delete((data as any).requestId);
          console.log('[events] resolved pending response', {
            requestId: (data as any).requestId,
            status,
          });
          entry.resolve({
            status,
            body: 'body' in (data as any) ? (data as any).body : null,
          });
        } else {
          console.warn('[events] no pending for requestId', {
            requestId: (data as any).requestId,
          });
        }
      } else {
        console.warn(
          '[events] non-response payload or missing requestId on response hub'
        );
      }
    } catch (err) {
      console.error('[events] failed to process response payload', err);
    }
  } else if (ceType === 'azure.webpubsub.user.message' && hub === SYSTEM_HUB) {
    try {
      const data = payload;
      if (
        data &&
        typeof data === 'object' &&
        data.type === 'init' &&
        typeof data.clientId === 'string'
      ) {
        const store = await readyStorePromise;
        await store.setReady(data.clientId, true);
        console.log('[events] client init received; marked ready', {
          clientId: data.clientId,
        });
      } else {
        console.log('[events] system hub message', data);
      }
    } catch (err) {
      console.error('[events] failed to process system payload', err);
    }
  }

  return new Response(null, { status: 200 });
};

/**
 * 404 JSON response.
 */
const notFound = (): Response => json({ error: 'Not Found' }, 404);

/**
 * Handle POST /init – client announces it's ready by clientId.
 */
const handleInit = async (req: Request): Promise<Response> => {
  let clientId = '';
  try {
    const body = await req.json();
    clientId = String(body?.clientId || '');
  } catch {}
  if (!clientId) return json({ error: 'clientId is required' }, 400);
  if (!isClientAllowed(clientId))
    return json({ error: 'Forbidden clientId' }, 403);

  const store = await readyStorePromise;
  await store.setReady(clientId, true);
  console.log('[init] client marked ready', { clientId });
  return json({ ok: true });
};

/**
 * Verify API key on the request. Expects `x-api-key: <token>` header.
 */
const verifyApiKey = (req: Request): boolean => {
  // Allow anonymous for now; if AUTH_TOKEN set in future, enforce here
  if (!AUTH_TOKEN) return true;
  const header = req.headers.get('x-api-key') || '';
  return header === AUTH_TOKEN;
};

/**
 * Check if a clientId is permitted via allow-list, if configured.
 */
const isClientAllowed = (clientId: string): boolean => {
  if (!ALLOWED_CLIENT_IDS.length) return true; // no list means allow all
  return ALLOWED_CLIENT_IDS.includes(clientId);
};

/**
 * Handle POST /auth – returns signed access URLs for request/system/response hubs.
 * Body: { clientId }. Anonymous allowed for now.
 */
const handleAuth = async (req: Request): Promise<Response> => {
  if (!verifyApiKey(req)) return json({ error: 'Unauthorized' }, 401);

  let clientId = '';
  try {
    const body = await req.json();
    clientId = String(body?.clientId || '');
  } catch {}

  if (!clientId) return json({ error: 'clientId is required' }, 400);
  if (!isClientAllowed(clientId))
    return json({ error: 'Forbidden clientId' }, 403);

  try {
    const make = async (svc: WebPubSubServiceClient, hub: string) => {
      const t = await svc.getClientAccessToken({
        // roles: ['webpubsub.joinLeaveGroup', 'webpubsub.sendToGroup'],
        userId: `client:${clientId}`,
        expirationTimeInMinutes: 60,
      } as any);
      if (!t.url) throw new Error(`Failed to mint access URL for hub ${hub}`);
      return { hub, url: t.url };
    };

    const system = await make(wpsSystem, SYSTEM_HUB);
    return json({
      system,
      userId: `client:${clientId}`,
    });
  } catch (err) {
    console.error('[auth] getClientAccessToken failed', err);
    return json({ error: 'Failed to mint access token' }, 502);
  }
};

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/health')
      return json({ status: 'ok' });
    if (req.method === 'POST' && url.pathname === '/auth')
      return handleAuth(req);
    if (req.method === 'POST' && url.pathname === '/init')
      return handleInit(req);
    if (req.method === 'POST' && url.pathname === '/invoke')
      return handleInvoke(req);
    if (req.method === 'POST' && url.pathname === '/events')
      return handleEvents(req);
    return notFound();
  },
});

console.log(`[startup] proxy-server listening on :${server.port}`);
console.log(`[startup] instance: ${INSTANCE_ID}`);
console.log(
  `[startup] hubs: request=${HUB_NAME}, response=${RESPONSE_HUB}, system=${SYSTEM_HUB}`
);
