import { WebPubSubClient } from '@azure/web-pubsub-client';
const CLIENT_ID = process.env.CLIENT_ID || '';
const LOCAL_API_URL = process.env.LOCAL_API_URL || '';
const AUTH_URL = process.env.AUTH_URL || '';

if (!AUTH_URL) {
  console.error('[startup] Missing AUTH_URL (server /auth endpoint)');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error('[startup] Missing CLIENT_ID');
  process.exit(1);
}
if (!LOCAL_API_URL) {
  console.error('[startup] Missing LOCAL_API_URL');
  process.exit(1);
}

type RequestEnvelope = {
  type: 'request';
  requestId: string;
  method: string;
  path: string;
  body?: any;
};

type ResponseEnvelope = {
  type: 'response';
  requestId: string;
  status: number;
  body: any;
};

type HubAccess = {
  hub: string;
  url: string;
};
type AccessInfo = {
  system: HubAccess;
  userId: string;
};

const joinUrl = (base: string, path: string): string => {
  if (!base.endsWith('/') && !path.startsWith('/')) return base + '/' + path;
  if (base.endsWith('/') && path.startsWith('/')) return base + path.slice(1);
  return base + path;
};

const getFetch = async (): Promise<typeof fetch> => {
  if (typeof (globalThis as any).fetch === 'function')
    return (globalThis as any).fetch;
  const mod = await import('node-fetch');
  // @ts-ignore
  return (mod.default || mod) as any;
};

const forwardToLocal = async (
  reqMsg: RequestEnvelope
): Promise<ResponseEnvelope> => {
  const url = joinUrl(LOCAL_API_URL, reqMsg.path);
  const method = (reqMsg.method || 'GET').toUpperCase();
  const hasBody =
    reqMsg.body !== undefined &&
    reqMsg.body !== null &&
    method !== 'GET' &&
    method !== 'HEAD';
  const headers: Record<string, string> = hasBody
    ? { 'content-type': 'application/json' }
    : {};
  const body = hasBody ? JSON.stringify(reqMsg.body) : undefined;
  console.log('[handle] forwarding to local API', { method, url });
  try {
    const f = await getFetch();
    const resp = await f(url, { method, headers, body });
    const status = (resp as any).status;
    const ct = (resp as any).headers?.get?.('content-type') || '';
    let respBody: any = null;
    if (
      typeof (resp as any).json === 'function' &&
      ct.includes('application/json')
    ) {
      try {
        respBody = await (resp as any).json();
      } catch {
        respBody = await (resp as any).text();
      }
    } else if (typeof (resp as any).text === 'function') {
      respBody = await (resp as any).text();
    }
    console.log('[handle] local API responded', { status });
    return {
      type: 'response',
      requestId: reqMsg.requestId,
      status,
      body: respBody,
    };
  } catch (err: any) {
    console.error('[handle] local API error', err);
    return {
      type: 'response',
      requestId: reqMsg.requestId,
      status: 500,
      body: { error: String(err?.message || err || 'Unknown error') },
    };
  }
};

const getAccessInfo = async (): Promise<AccessInfo> => {
  const f = await getFetch();
  const resp = await f(AUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Auth failed: ${resp.status} ${text || ''}`);
  }
  const data = (await resp.json()) as AccessInfo;
  if (!data?.system?.url) {
    throw new Error('Auth response missing required fields');
  }
  return data;
};

const start = async () => {
  console.log('[startup] proxy-client', { CLIENT_ID, LOCAL_API_URL, AUTH_URL });
  const access = await getAccessInfo();

  const wsClient = new WebPubSubClient(access.system.url);
  wsClient.on('connected', async () => {
    console.log('[ws:request] connected, joining group', {
      group: access.system,
    });
    // wsClient.joinGroup(access.system.hub).catch((err) => {
    //   console.error('[ws:request] join group failed', err);
    // });
    // send init message
    await wsClient.sendEvent(
      'init',
      JSON.stringify({ clientId: CLIENT_ID }),
      'json'
    );
  });
  wsClient.on('disconnected', (ev) => {
    console.warn('[ws:request] disconnected', {
      ev,
    });
  });
  wsClient.on('server-message', async (msg) => {
    // handle message
    const message = JSON.parse(msg.message.data.toString());
    // if the requestType is request, then it will be proxy forward the request
  });
  await wsClient.start();
};

start().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
