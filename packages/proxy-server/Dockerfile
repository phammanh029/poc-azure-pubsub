FROM oven/bun:1.2

WORKDIR /app

COPY package.json ./

RUN bun install --silent -p
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

CMD ["bun", "run", "src/main.ts"]
