import { Router, Request, Response } from 'express';
import { presenceManager, ClientRole } from '../presence.js';
import { getPersistenceStore } from '../storage/index.js';

export const presenceRouter = Router();

// POST /api/presence/heartbeat - Registro o actualización de latido de presencia
presenceRouter.post('/presence/heartbeat', (req: Request, res: Response) => {
  const { sessionId, role, teamId, teamName, deviceInfo } = req.body;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_SESSION_ID', message: 'Identificador de sesión obligatorio.' }
    });
  }

  const validRoles: ClientRole[] = ['race-control', 'team-operator', 'display', 'broadcast', 'admin'];
  const clientRole: ClientRole = validRoles.includes(role) ? role : 'team-operator';
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  const result = presenceManager.registerHeartbeat(
    sessionId,
    clientRole,
    deviceInfo || 'Navegador Web',
    clientIp,
    teamId,
    teamName
  );

  if (result.kicked) {
    return res.status(403).json({
      ok: false,
      kicked: true,
      message: result.message || 'Sesión desconectada por Dirección de Carrera.'
    });
  }

  return res.json({
    ok: true,
    serverTime: new Date().toISOString()
  });
});

// POST /api/presence/leave - Desconexión limpia del cliente
presenceRouter.post('/presence/leave', (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (sessionId) {
    presenceManager.leaveSession(sessionId);
  }
  return res.json({ ok: true, message: 'Sesión finalizada correctamente.' });
});

// POST /api/presence/kick - Expulsar una sesión específica de dispositivo (Race Control / Admin)
presenceRouter.post('/presence/kick', (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({
      ok: false,
      error: { code: 'MISSING_SESSION_ID', message: 'Se requiere el ID de sesión a desconectar.' }
    });
  }

  const kicked = presenceManager.kickSession(sessionId);
  return res.json({
    ok: kicked,
    message: kicked ? 'Dispositivo desconectado de la sesión.' : 'Sesión no encontrada o ya finalizada.'
  });
});

// GET /api/presence - Vista de presencia para Race Control
presenceRouter.get('/presence', async (_req: Request, res: Response) => {
  const store = getPersistenceStore();
  const event = await store.getEvent();
  const teams = event ? await store.getTeams(event.id) : [];

  const overview = presenceManager.getOverview(teams.map(t => ({ id: t.id, name: t.name })));
  return res.json({
    ok: true,
    overview
  });
});
