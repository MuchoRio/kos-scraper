import http from "node:http";
import { createApp } from "./app.js";
import { getServerConfig } from "./config/env.js";

const config = getServerConfig();
const { app, queue } = createApp(config);
const server = http.createServer(app);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[kos-scraper] Port ${config.port} sudah dipakai. Jalankan dengan PORT=<lain> npm run dev.`);
    process.exit(1);
  }
  console.error("[kos-scraper] Server error:", err);
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.log(`[kos-scraper] API server aktif di http://${config.host}:${config.port}`);
});

function shutdown() {
  queue.shutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

