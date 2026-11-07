import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { api } from './api.ts';
import { ensureAdminInvite } from './auth.ts';
import { config } from './config.ts';
import { seedGames } from './seed.ts';

const base = config.basePath;
const app = new Hono();

app.get('/healthz', (c) => c.text('ok'));
app.route(`${base}/api`, api);

if (existsSync(config.webDist)) {
  const indexHtml = readFileSync(join(config.webDist, 'index.html'), 'utf8');
  if (base) app.get(base, (c) => c.redirect(`${base}/`, 301));
  app.use(
    `${base}/assets/*`,
    serveStatic({ root: config.webDist, rewriteRequestPath: (p) => p.slice(base.length) }),
    async (c, next) => {
      c.header('cache-control', 'public, max-age=31536000, immutable');
      await next();
    },
  );
  app.use(`${base}/*`, serveStatic({ root: config.webDist, rewriteRequestPath: (p) => p.slice(base.length) }));
  // Client-side routes (/invite/…, /admin) all render the SPA.
  app.get(`${base}/*`, (c) => c.html(indexHtml));
} else {
  console.log(`Kein Frontend-Build unter ${config.webDist} – im Dev-Modus liefert Vite die Seite aus.`);
}

seedGames();
ensureAdminInvite();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`LAN-Party-Voting läuft auf http://localhost:${info.port}${base}/`);
});
