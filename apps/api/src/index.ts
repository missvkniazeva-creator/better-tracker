import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb, dbPath } from './db/index.ts';
import { bootstrap } from './db/bootstrap.ts';
import { registerRoutes } from './routes/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const WEB_DIST = resolve(here, '../../web/dist');

const PORT = Number(process.env.PORT ?? 8787);
// Bound to loopback on purpose: this is a single-user local tracker with no
// authentication, and it should not be reachable from the network.
const HOST = process.env.HOST ?? '127.0.0.1';

const app = Fastify({
  logger: { transport: undefined, level: process.env.LOG_LEVEL ?? 'info' },
  bodyLimit: 24 * 1024 * 1024, // pasted screenshots arrive as base64
});

bootstrap(getDb());
await registerRoutes(app);

// In production the API also serves the built SPA, so the whole app is one
// process on one port. In dev, Vite serves the client and proxies /api here.
if (existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, { root: WEB_DIST });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' });
    return reply.sendFile('index.html');
  });
}

const shutdown = async () => {
  await app.close();
  closeDb();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: PORT, host: HOST });
app.log.info(`database: ${dbPath()}`);
