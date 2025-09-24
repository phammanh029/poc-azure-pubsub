# Repository Guidelines

## Project Structure & Module Organization
- `packages/proxy-server/`: Receives REST calls and relays via Azure Web PubSub.
- `packages/proxy-client/`: Subscribes by `CLIENT_ID`, forwards to `LOCAL_API_URL`, returns responses.
- `packages/local-api/`: Simple local HTTP API used by the client.
- `k8s/`: Kubernetes manifests (deployments, service, secret).
- Root uses Yarn workspaces; each package keeps sources in `src/` and compiles to `dist/`.

## Build, Test, and Development Commands
- Install: `yarn install` (workspace-aware).
- Build all: `yarn build` (runs each workspace’s `build`).
- Run locally: `yarn start:server`, `yarn start:client`, `yarn start:local-api`.
- Docker images: `yarn docker:build` (tags `*:local`).
- Local k3d cluster: `yarn k3d:create` → `yarn k3d:import` → `yarn k8s:apply`.
- Port-forward proxy for testing: `yarn port-forward` (maps `8080:8080`).

## Coding Style & Naming Conventions
- Language: TypeScript (ES2020, CommonJS, strict mode). Avoid `any`; prefer explicit interfaces.
- Files: `.ts` in `src/`; filenames kebab-case (e.g., `proxy-server.ts`).
- Indentation: 2 spaces; prefer async/await; keep modules small and focused.
- Lint/format: No tool enforced yet. If adding one, prefer Prettier defaults and ESLint with TypeScript.

## Testing Guidelines
- No framework configured. If adding tests, prefer Bun test or Vitest.
- Location: alongside sources or `__tests__/`; name `*.spec.ts`.
- Focus: unit tests for message envelopes, request/response correlation, and error/timeout paths.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat: add proxy timeout` / `fix(client): handle 504`).
- PRs: include purpose, scope, runnable steps (`yarn ...`), and logs/screenshots when relevant (e.g., `kubectl get pods` output). Link issues and call out breaking changes.

## Security & Configuration Tips
- Never commit secrets. Set `PUBSUB_CONNECTION_STRING` via `k8s/secret.yaml` (or a cluster secret); keep `.env` files local.
- Required env: `PUBSUB_CONNECTION_STRING`, `CLIENT_ID`, `LOCAL_API_URL`, optional `PORT`.
- Validate inputs on the server; log IDs not payloads when possible.
