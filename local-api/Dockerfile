FROM oven/bun:1.2

WORKDIR /app

COPY demo-proxy-azure-pubsub/package.json ./
COPY demo-proxy-azure-pubsub/proxy-server ./proxy-server
COPY demo-proxy-azure-pubsub/proxy-client ./proxy-client
COPY demo-proxy-azure-pubsub/local-api ./local-api

RUN bun install --silent

WORKDIR /app/local-api

ENV NODE_ENV=production
ENV PORT=3000

CMD ["bun", "run", "src/local-api.ts"]
