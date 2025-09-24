FROM oven/bun:1.2

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
COPY packages ./packages

RUN bun install --silent

WORKDIR /app/packages/local-api

ENV NODE_ENV=production
ENV PORT=3000

CMD ["bun", "run", "src/local-api.ts"]
