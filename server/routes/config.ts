import { Router, Request, Response } from 'express';
import { config } from '../config.js';
import { getPersistenceStore } from '../storage/index.js';

export const configRouter = Router();

configRouter.get('/config', async (_req: Request, res: Response) => {
  const store = getPersistenceStore();
  const event = await store.getEvent().catch(() => null);

  res.json({
    appName: config.appName,
    version: config.version,
    language: config.defaultLang,
    nodeEnv: config.nodeEnv,
    persistenceType: store.type,
    hasConfiguredEvent: Boolean(event),
    surfaces: [
      { id: 'race-control', path: '/race-control', label: 'Dirección de Carrera / Race Control', role: 'director' },
      { id: 'pit-wall', path: '/pit-wall', label: 'Pit Wall de Escudería', role: 'operator' },
      { id: 'display', path: '/display', label: 'Pantalla de Pista (16:9)', role: 'viewer' },
      { id: 'broadcast', path: '/broadcast', label: 'Gráficos de Transmisión (16:9)', role: 'viewer' },
      { id: 'admin', path: '/admin', label: 'Administración Técnica', role: 'tech_admin' }
    ]
  });
});
