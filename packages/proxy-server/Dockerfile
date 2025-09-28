FROM oven/bun:1.2

WORKDIR /app

# Copy monorepo manifests and workspaces
COPY package.json ./

# Install dependencies for all workspaces with Bun (supports workspaces)
RUN bun install --silent

ENV NODE_ENV=production
ENV PORT=3000

CMD ["bun", "run", "src/main.ts"]
