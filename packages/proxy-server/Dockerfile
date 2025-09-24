FROM oven/bun:1.2

WORKDIR /app

# Copy monorepo manifests and workspaces
COPY package.json ./
COPY yarn.lock ./
COPY packages ./packages

# Install dependencies for all workspaces with Bun (supports workspaces)
RUN bun install --silent

WORKDIR /app/packages/proxy-server

ENV NODE_ENV=production
ENV PORT=8080

CMD ["bun", "run", "src/proxy-server.ts"]
