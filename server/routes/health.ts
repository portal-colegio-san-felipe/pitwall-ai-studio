import { Router, Request, Response } from 'express';
import { getPersistenceStore } from '../storage/index.js';
import { config } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const store = getPersistenceStore();
  const persistenceHealth = await store.checkHealth();
  const event = await store.getEvent().catch(() => null);

  const isHealthy = persistenceHealth.ok && persistenceHealth.reachable;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'degraded',
    message: isHealthy ? 'Sistema operativo' : 'Persistencia no disponible',
    language: config.defaultLang,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    persistence: persistenceHealth,
    hasConfiguredEvent: Boolean(event),
    hasProductionSeedData: persistenceHealth.hasProductionSeedData
  });
});

healthRouter.get('/system/status', async (_req: Request, res: Response) => {
  const store = getPersistenceStore();
  const persistenceHealth = await store.checkHealth();
  const event = await store.getEvent().catch(() => null);

  res.json({
    app: {
      name: config.appName,
      version: config.version,
      language: config.defaultLang,
      nodeEnv: config.nodeEnv
    },
    system: {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version
    },
    persistence: persistenceHealth,
    milestone: {
      current: 'M0',
      description: 'Fundación de arquitectura, persistencia duradera, enrutamiento base y pruebas.',
      eventConfigured: Boolean(event),
      seedDataRulePassed: !persistenceHealth.hasProductionSeedData
    }
  });
});
