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
- Proxy Client
  - `PUBSUB_CONNECTION_STRING` (from `pubsub-secret`)
  - `CLIENT_ID` (e.g. `client-a`)
  - `LOCAL_API_URL` (e.g. `http://localhost:3000`)
- Local API
  - `CLIENT_ID` (for greeting message)

## Notes

- Configure your Azure Web PubSub resource to send upstream events to the proxy-server endpoint `/events`. This is required for responses to correlate back to the server. A simple approach is to expose the service or run the server outside the cluster for initial testing.
- Images are local-only (`:local`) and imported into k3d; they are not pulled from a registry.
- For additional clients, duplicate `k8s/proxy-client-a.yaml`, change the `name`/labels and set a different `CLIENT_ID`.
