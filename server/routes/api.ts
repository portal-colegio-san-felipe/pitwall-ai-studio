import { Router } from 'express';
import { healthRouter } from './health.js';
import { configRouter } from './config.js';
import { eventsRouter } from './events.js';
import { presenceRouter } from './presence.js';
import { timingRouter } from './timing.js';
import { strategyRouter } from './strategy.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(configRouter);
apiRouter.use(eventsRouter);
apiRouter.use(presenceRouter);
apiRouter.use(timingRouter);
apiRouter.use(strategyRouter);

// Manejador para rutas /api no encontradas
apiRouter.use('*', (_req, res) => {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Recurso de API no encontrado.'
    },
    timestamp: new Date().toISOString()
  });
});
