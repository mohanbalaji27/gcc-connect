import { createApp } from './app.js';
import { initDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  console.log('[GCC Connect] Initializing authoritative backend...');
  await initDatabase();
  await seedDatabase();

  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`[GCC Connect] Authoritative API Server running on http://localhost:${PORT}`);
    console.log(`[GCC Connect] Interactive OpenAPI Documentation available at http://localhost:${PORT}/api/docs`);
    console.log(`[GCC Connect] Health endpoint at http://localhost:${PORT}/api/health`);
  });

  const shutdown = async () => {
    console.log('[GCC Connect] Shutting down gracefully...');
    server.close(() => {
      console.log('[GCC Connect] Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[GCC Connect] Fatal startup error:', err);
  process.exit(1);
});
