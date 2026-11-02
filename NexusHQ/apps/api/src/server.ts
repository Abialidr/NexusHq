// NexusHQ backend API. Runs as plain TypeScript on Node 24 (native type stripping, no build step).
// It holds only a health check for now; add routes here for work that can't be done safely with Supabase RLS,
// database functions or the local worker (see ../README.md).
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PORT = Number(process.env.PORT ?? 3200);
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:3100").split(",");

type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const routes: Record<string, Handler> = {
  "GET /health": (_req, res) => json(res, 200, { ok: true, service: "nexushq-api", time: new Date().toISOString() }),
};

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-methods": "GET,POST,PATCH,DELETE", "access-control-allow-headers": "authorization,content-type" });
    return res.end();
  }
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const handler = routes[`${req.method} ${path}`];
  if (!handler) return json(res, 404, { error: "Not found" });
  try {
    await handler(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: "Internal error" });
  }
});

server.listen(PORT, () => console.log(`nexushq-api listening on http://localhost:${PORT}`));
