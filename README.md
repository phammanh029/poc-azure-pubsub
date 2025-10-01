# Demo: Proxy local APIs via Azure Web PubSub (Yarn Workspaces + k3d)

This monorepo demonstrates proxying API calls to remote clients via Azure Web PubSub. A Proxy Server receives REST calls and relays them to a specific client (group) over PubSub; the Proxy Client forwards to its local API and replies back.

## Structure

- `packages/proxy-server/`: Bun server exposing `POST /invoke?clientId=<id>&path=<path>`; publishes requests to Azure Web PubSub and awaits correlated responses (10s timeout) via upstream events.
- `packages/proxy-client/`: Connects to hub `proxyhub`, joins `CLIENT_ID`, forwards requests to `LOCAL_API_URL`, then replies with `{ type: "response", requestId, status, body }`.
- `packages/local-api/`: Simple Bun API (`GET /hello` → `{ msg: "Hello from <CLIENT_ID>" }`).
- `k8s/`: Manifests for secret and deployments/services.

## Prerequisites

- Node.js 18+ and Yarn (Corepack: `corepack enable` recommended)
- Docker
- k3d and kubectl
- Azure Web PubSub resource and a valid connection string

## Install

```bash
yarn install
```

## Build local Docker images (Bun 1.2 runtime)

Build images for all services (tags end with `:local`):

```bash
yarn docker:build
```

This builds Bun 1.2-based images for each workspace. The Dockerfiles use `bun install` (which supports workspaces) and run `.ts` files directly with Bun.

## Create k3d cluster and import images

Create a local cluster named `demo`:

```bash
yarn k3d:create
```

Import the locally built images into that cluster:

```bash
yarn k3d:import
```

## Configure secrets and deploy

Edit `k8s/secret.yaml` and put your Azure Web PubSub connection string under `stringData.connectionString`.

Apply manifests:

```bash
yarn k8s:apply
```

What gets deployed:

- `proxy-server` Deployment (2 replicas) + Service (`ClusterIP`, port 8080)
- `proxy-client-a` Deployment with 2 containers:
  - `proxy-client` (env: `CLIENT_ID=client-a`, `LOCAL_API_URL=http://localhost:3000`)
  - `local-api` (env: `CLIENT_ID=client-a`)

Note: Both containers share a network namespace, so `LOCAL_API_URL=http://localhost:3000` points to the sidecar `local-api` container.

### Running locally without Docker

You can still develop with Yarn workspaces locally. For fastest local runs with Bun (no Express/Fastify, using Bun.serve):

```bash
corepack enable || true
npm i -g bun@1.2.0 # if not installed

bun install

# In separate terminals
cd packages/proxy-server && bun run src/proxy-server.ts
cd packages/proxy-client && PUBSUB_CONNECTION_STRING=... CLIENT_ID=client-a LOCAL_API_URL=http://localhost:3000 bun run src/proxy-client.ts
cd packages/local-api && CLIENT_ID=client-a bun run src/local-api.ts
```

## Port-forward and test

Expose the proxy server locally:

```bash
yarn port-forward
```

Invoke the client’s local API through the proxy:

```bash
curl -sS -X POST \
  "http://localhost:8080/invoke?clientId=client-a&path=/hello" \
  -H 'content-type: application/json' \
  -d '{}'
```

Expected response:

```json
{ "msg": "Hello from client-a" }
```

If no client response within 10 seconds, the server returns `504`.

## Environment variables

- Proxy Server
  - `PUBSUB_CONNECTION_STRING` (from `pubsub-secret`)
  - `PORT` (default `8080`)
  - `AUTH_TOKEN` (optional; reserved for protecting `/auth` later)
  - `ALLOWED_CLIENT_IDS` (optional; comma-separated allow-list for `/auth` and `/init`)
  - `READY_STORE` (optional; `memory` or `redis` for readiness tracking)
  - `REDIS_URL` (required when `READY_STORE=redis`, e.g. `redis://valkey:6379`)
- Proxy Client
  - `PUBSUB_CONNECTION_STRING` (from `pubsub-secret`) or use server auth below
  - `CLIENT_ID` (e.g. `client-a`)
  - `LOCAL_API_URL` (e.g. `http://localhost:3000`)
  - `AUTH_URL` (optional; when set, client fetches token from server `/auth`)
  - `AUTH_API_KEY` (optional; API key sent as `x-api-key` to `/auth` if protection enabled)
  - `INIT_URL` (optional; if omitted and `AUTH_URL` set, derives `.../init`)
- Local API
  - `CLIENT_ID` (for greeting message)

## Notes

- Configure your Azure Web PubSub resource to send upstream events to the proxy-server endpoint `/events`. This is required for responses to correlate back to the server. A simple approach is to expose the service or run the server outside the cluster for initial testing.
- Images are local-only (`:local`) and imported into k3d; they are not pulled from a registry.
- For additional clients, duplicate `k8s/proxy-client-a.yaml`, change the `name`/labels and set a different `CLIENT_ID`.

### Auth and readiness

- Clients only need `CLIENT_ID`. They obtain a signed PubSub URL by POSTing `{ clientId }` to the server at `/auth` (anonymous allowed for now). The response includes `endpoint`, `url`, `token`, and `expiresOn`.
- After the PubSub connection is established, clients POST `{ clientId }` to `/init` to mark themselves ready.
- The server rejects `/invoke` for a `clientId` that is not marked ready (returns `409`).
- Readiness is stored in-memory by default; for multi-replica servers, set `READY_STORE=redis` and `REDIS_URL=redis://valkey:6379` (Valkey/Redis-compatible).

## Docker Compose (Valkey + services)

Run the full stack locally using Docker Compose with Valkey for readiness:

```bash
export PUBSUB_CONNECTION_STRING="<your-azure-web-pubsub-connection-string>"
docker compose up --build
```

What it starts:
- `valkey`: key-value store on `6379`.
- `proxy-server`: listens on `8080` with `READY_STORE=redis`.
- `local-api`: simple API for the client (port 3000, internal).
- `proxy-client`: uses `/auth` and `/init` (no connection string needed), `CLIENT_ID=client-a`.

Test after startup:

```bash
curl -sS -X POST \
  "http://localhost:8080/invoke?clientId=client-a&path=/hello" \
  -H 'content-type: application/json' \
  -d '{}'
```

You should see `{ "msg": "Hello from client-a" }` once the client is ready.

## POC – AWPS Tunnel Refactor (Multi-Pod Server + Single Proxy Client with Multiple Tenants)

This repo also includes a local POC of the tunnel refactor using Bun runtime. It simulates the Azure Web PubSub flow via HTTP events so it runs locally without Azure while keeping the same message envelopes and correlation.

- Server (`packages/proxy-server`)
  - `POST /api/auth` → `{ hub: 'wawi', pod, eventsUrl }`.
  - `POST /api/ws-events` handles `connected | disconnected | message` to maintain `db/connections.json` (tenant → connectionId) and correlate responses.
  - `POST /api/request/:tenantId?path=/hello` forwards to the client mapped for that tenant and awaits the response (timeout 30s).
  - Env: `PORT` (8080) and `POD_NAME` (e.g., `pod-1`).

- Client (`packages/proxy-client`)
  - One process supports multiple tenants via `TENANTS` env (comma-separated).
  - Exposes `POST /client/receive` so the server can deliver requests. For each request, it forwards to Local API with header `x-tenant-id: <tenantId>` and then POSTs the response back to the server via `/api/ws-events` as `{ type: 'message', requestId, status, data }`.
  - Env: `TENANTS`, `LOCAL_API_URL`, `SERVER_URL`, `PORT` (7070), optional `CLIENT_PUBLIC_URL`.

- Local API (`packages/local-api`)
  - `GET /hello` returns `{ msg: "hello from <tenantId>" }` using `x-tenant-id` header.

- Shared DB
  - `db/connections.json` is the shared mapping for tenant → connectionId.

Local run (three terminals):

1) Local API: `yarn start:local-api`

2) Server: `PORT=8080 POD_NAME=pod-1 yarn start:server`

3) Client: `TENANTS=tenant-1,tenant-2 LOCAL_API_URL=http://localhost:3000 SERVER_URL=http://localhost:8080 yarn start:client`

Test:

```
curl -sS -X POST "http://localhost:8080/api/request/tenant-1?path=/hello" -H "content-type: application/json" -d '{}'
```

Expected: `{ "msg": "hello from tenant-1" }`.

### Kubernetes Demo (k3d)

1) Build images and create cluster

```
yarn docker:build
yarn k3d:create
yarn k3d:import
```

2) Apply storage + manifests

```
kubectl apply -f k8s/connections-pv-pvc.yaml
kubectl apply -f k8s
```

Deployed:
- 3 proxy-server pods (each exposes `/api/request/:tenantId`, `/api/ws-events`, `/api/auth`) and mounts a shared volume at `/app/db`.
- 3 proxy-client pods (each handles multiple tenants; exposes `/client/receive`).
- 1 local-api deployment + service.

3) Port-forward to a server service

```
kubectl port-forward svc/proxy-server 8080:8080
```

4) Simulate ERP request (random server pod behind service)

```
curl -sS -X POST "http://localhost:8080/api/request/tenant-1?path=/hello" -H "content-type: application/json" -d '{}'
```

End-to-end flow:
- Server picks pod name (respTarget=pod-N) and includes its pod-specific `serverEventsUrl` (built from `POD_IP`) in the payload.
- Client forwards to Local API with `x-tenant-id: tenant-1` and posts `{ type:'message', requestId, status, data }` back to that `serverEventsUrl`.
- The same pod correlates `requestId` and responds to the HTTP caller.

# Troubleshooting

https://learn.microsoft.com/en-us/azure/azure-web-pubsub/howto-troubleshoot-common-issues