import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './server/config.js';
import { apiRouter } from './server/routes/api.js';
import { errorHandler } from './server/middleware/errorHandler.js';
import { getPersistenceStore } from './server/storage/index.js';

async function startServer() {
  const app = express();

  // Middlewares básicos
  app.use(cors());
  app.use(express.json());

  // Inicializar almacenamiento persistente
  const store = getPersistenceStore();
  await store.init();
  const health = await store.checkHealth();
  console.log(`[Persistencia] Inicializada (${store.type}). Accesible: ${health.reachable}, Sin datos semilla: ${!health.hasProductionSeedData}`);

  // Rutas de API
  app.use('/api', apiRouter);

  // Integración con frontend (Vite en desarrollo / archivos estáticos en producción)
  const isProduction = config.nodeEnv === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('[Servidor] Advertencia: Directorio dist no encontrado en modo producción');
    }
  }

  // Middleware de errores para API
  app.use(errorHandler);

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Servidor] Pit Wall / Race Control activo en http://0.0.0.0:${config.port}`);
  });

  const shutdown = () => {
    console.log('[Servidor] Señal de terminación recibida. Cerrando conexiones...');
    server.close(() => {
      console.log('[Servidor] Servidor detenido correctamente.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[Servidor Fatal] Error al iniciar el servidor:', err);
  process.exit(1);
});
