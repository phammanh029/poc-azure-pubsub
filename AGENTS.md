# Repository Guidelines

This monorepo demonstrates a proxy pattern over Azure Web PubSub. It uses Yarn workspaces; each package keeps sources in `src/` and compiles to `dist/`.

## Project Structure & Module Organization
- `packages/proxy-server/`: Receives REST calls and relays via Azure Web PubSub.
- `packages/proxy-client/`: Subscribes by `CLIENT_ID`, forwards to `LOCAL_API_URL`, returns responses.
- `packages/local-api/`: Simple local HTTP API used by the client.
- `k8s/`: Kubernetes manifests (deployments, service, secret).
- Sources live in `src/`; outputs in `dist/`. Tests sit alongside sources or in `__tests__/`.

## Build, Test, and Development Commands
- `yarn install`: Install all workspace dependencies.
- `yarn build`: Build all packages to `dist/`.
- `yarn start:server` | `yarn start:client` | `yarn start:local-api`: Run local services.
- `yarn docker:build`: Build Docker images (tags `*:local`).
- `yarn k3d:create` → `yarn k3d:import` → `yarn k8s:apply`: Create local k3d cluster, import images, apply manifests.
- `yarn port-forward`: Map `8080:8080` to the proxy for local testing.

## Coding Style & Naming Conventions
- Language: TypeScript (ES2020, CommonJS, strict). Avoid `any`; prefer explicit interfaces/types.
- Files: `.ts` in `src/`; filenames kebab-case (e.g., `proxy-server.ts`).
- Indentation: 2 spaces; prefer async/await; keep modules small and focused.
- Lint/format: Not enforced. If adding, use Prettier defaults and ESLint (TypeScript).

## Testing Guidelines
- Framework: none configured. Prefer Bun test or Vitest if introduced.
- Location & names: alongside sources or `__tests__/`; `*.spec.ts`.
- Focus areas: message envelopes, request/response correlation, error/timeout paths.
- Run via `bun test` or `vitest` once configured; keep tests fast and unit-scoped.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat: add proxy timeout`, `fix(client): handle 504`).
- PRs: include purpose, scope, runnable steps (`yarn ...`), and logs/screenshots when relevant (e.g., `kubectl get pods`). Link issues and call out breaking changes.

## Security & Configuration Tips
- Never commit secrets. Set `PUBSUB_CONNECTION_STRING` via `k8s/secret.yaml` or a cluster secret; keep `.env` local.
- Required env: `PUBSUB_CONNECTION_STRING`, `CLIENT_ID`, `LOCAL_API_URL`; optional `PORT`.
- Validate inputs on the server; prefer logging IDs/metadata over full payloads.

