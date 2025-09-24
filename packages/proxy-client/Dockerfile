FROM oven/bun:1.2

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
COPY packages ./packages

RUN bun install --silent

WORKDIR /app/packages/proxy-client

ENV NODE_ENV=production

CMD ["bun", "run", "src/proxy-client.ts"]
