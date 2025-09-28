FROM oven/bun:1.2

WORKDIR /app

COPY package.json ./
COPY . .

RUN bun install --silent

ENV NODE_ENV=production
ENV PORT=3000

CMD ["bun", "run", "src/main.ts"]
