FROM oven/bun:1.2

WORKDIR /app

# Copy monorepo manifests and workspaces
COPY demo-proxy-azure-pubsub/package.json ./
COPY demo-proxy-azure-pubsub/proxy-server ./proxy-server
COPY demo-proxy-azure-pubsub/proxy-client ./proxy-client
COPY demo-proxy-azure-pubsub/local-api ./local-api

# Install dependencies for all workspaces with Bun (supports workspaces)
RUN bun install --silent

WORKDIR /app/proxy-server

ENV NODE_ENV=production
ENV PORT=8080

CMD ["bun", "run", "src/proxy-server.ts"]
