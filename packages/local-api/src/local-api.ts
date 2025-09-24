const PORT = Number(process.env.PORT || 3000);
const CLIENT_ID = process.env.CLIENT_ID || "unknown";

/**
 * Build a JSON response with status.
 */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Route incoming requests to handlers.
 */
const route = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname === "/hello") {
    return json({ msg: `Hello from ${CLIENT_ID}` }, 200);
  }
  return json({ error: "Not Found" }, 404);
};

const server = Bun.serve({ port: PORT, fetch: route });

console.log(`[startup] local-api listening on :${server.port}`, { CLIENT_ID });
