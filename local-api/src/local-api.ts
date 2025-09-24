const PORT = Number(process.env.PORT || 3000);
const CLIENT_ID = process.env.CLIENT_ID || "unknown";

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/hello") {
      return new Response(JSON.stringify({ msg: `Hello from ${CLIENT_ID}` }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  },
});

console.log(`[startup] local-api listening on :${server.port}`, { CLIENT_ID });
