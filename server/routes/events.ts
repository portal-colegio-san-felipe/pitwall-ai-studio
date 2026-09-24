import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getPersistenceStore } from '../storage/index.js';
import { EventData, TeamData, SessionData } from '../storage/types.js';

export const eventsRouter = Router();

// GET /api/event - Obtener evento actual con sus escuderías y sesiones
eventsRouter.get('/event', async (_req: Request, res: Response) => {
  const store = getPersistenceStore();
  const event = await store.getEvent();

  if (!event) {
    return res.json({
      ok: true,
      configured: false,
      event: null,
      teams: [],
      sessions: []
    });
  }

  const [teams, sessions] = await Promise.all([
    store.getTeams(event.id),
    store.getSessions(event.id)
  ]);

  return res.json({
    ok: true,
    configured: true,
    event,
    teams,
    sessions
  });
});

// POST /api/event - Crear o actualizar el evento principal
eventsRouter.post('/event', async (req: Request, res: Response) => {
  const { name, edition, configuredBy, isNewEvent } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_EVENT_NAME',
        message: 'El nombre del evento es obligatorio.'
      }
    });
  }

  const store = getPersistenceStore();
  const existing = await store.getEvent();

  const isCreatingFresh = Boolean(isNewEvent || !existing);
  const targetId = isCreatingFresh ? `event-${crypto.randomUUID()}` : (existing ? existing.id : `event-${crypto.randomUUID()}`);

  const event: EventData = {
    id: targetId,
    name: name.trim(),
    edition: edition ? String(edition).trim() : '1',
    configuredBy: configuredBy ? String(configuredBy).trim() : 'Director de Carrera',
    createdAt: isCreatingFresh ? new Date().toISOString() : (existing?.createdAt || new Date().toISOString()),
    updatedAt: new Date().toISOString()
  };

  await store.saveEvent(event);

  const [teams, sessions] = await Promise.all([
    store.getTeams(event.id),
    store.getSessions(event.id)
  ]);

  return res.status(isCreatingFresh ? 201 : 200).json({
    ok: true,
    message: isCreatingFresh ? 'Nuevo Evento creado exitosamente.' : 'Evento actualizado correctamente.',
    event,
    teams,
    sessions
  });
});

// GET /api/teams - Listar escuderías
eventsRouter.get('/teams', async (_req: Request, res: Response) => {
  const store = getPersistenceStore();
  const event = await store.getEvent();

  if (!event) {
    return res.json({ ok: true, teams: [] });
  }

  const teams = await store.getTeams(event.id);
  return res.json({ ok: true, teams });
});

// POST /api/teams - Crear o actualizar escudería (sin límite estricto de 4)
eventsRouter.post('/teams', async (req: Request, res: Response) => {
  const store = getPersistenceStore();
  const event = await store.getEvent();

  if (!event) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'NO_ACTIVE_EVENT',
        message: 'Debe configurar primero un evento antes de registrar escuderías.'
      }
    });
  }

  const { id, name, shortName, color, number, kartName } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_TEAM_NAME',
        message: 'El nombre de la escudería es obligatorio.'
      }
    });
  }

  const existingTeams = await store.getTeams(event.id);
  const targetId = id || `team-${crypto.randomUUID()}`;
  const existingTeam = existingTeams.find(t => t.id === targetId);

  // Validar color
  const safeColor = (color && typeof color === 'string' && color.startsWith('#'))
    ? color
    : (existingTeam?.color || '#00d2ff');

  // Generar token único para el acceso de escudería (M2 forward-compatible)
  const token = existingTeam?.token || `token-${crypto.randomBytes(8).toString('hex')}`;

  const team: TeamData = {
    id: targetId,
    eventId: event.id,
    name: name.trim(),
    shortName: shortName ? String(shortName).trim().toUpperCase().slice(0, 5) : name.trim().slice(0, 3).toUpperCase(),
    color: safeColor,
    number: number !== undefined && number !== null && !isNaN(Number(number)) ? Number(number) : undefined,
    kartName: kartName ? String(kartName).trim() : undefined,
    token,
    createdAt: existingTeam?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await store.saveTeam(team);

  const updatedTeams = await store.getTeams(event.id);

  return res.status(existingTeam ? 200 : 201).json({
    ok: true,
    message: existingTeam ? 'Escudería actualizada correctamente.' : 'Escudería registrada exitosamente.',
    team,
    teams: updatedTeams
  });
});

// DELETE /api/teams/:id - Eliminar escudería
eventsRouter.delete('/teams/:id', async (req: Request, res: Response) => {
  const store = getPersistenceStore();
  const event = await store.getEvent();

  if (!event) {
    return res.status(404).json({ ok: false, error: { message: 'Evento no encontrado.' } });
  }

  const teamId = req.params.id;
  await store.deleteTeam(teamId);
  const updatedTeams = await store.getTeams(event.id);

  return res.json({
    ok: true,
    message: 'Escudería eliminada.',
    teams: updatedTeams
  });
});

// GET /api/sessions - Listar sesiones
eventsRouter.get('/sessions', async (_req: Request, res: Response) => {
  const store = getPersistenceStore();
  const event = await store.getEvent();

  if (!event) {
    return res.json({ ok: true, sessions: [] });
  }

  const sessions = await store.getSessions(event.id);
  return res.json({ ok: true, sessions });
});

// POST /api/sessions - Crear o actualizar sesión (tipo configurable, vueltas objetivo configurables, selección de escuderías)
eventsRouter.post('/sessions', async (req: Request, res: Response) => {
  const store = getPersistenceStore();
  const event = await store.getEvent();

  if (!event) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'NO_ACTIVE_EVENT',
        message: 'Debe configurar primero un evento antes de programar sesiones.'
      }
    });
  }

  const { id, name, type, targetLaps, participatingTeamIds, status } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'INVALID_SESSION_NAME',
        message: 'El nombre de la ronda/sesión es obligatorio.'
      }
    });
  }

  // Tipos válidos de sesión: qualifying | race | generic
  const validTypes: Array<'qualifying' | 'race' | 'generic'> = ['qualifying', 'race', 'generic'];
  const sessionType = validTypes.includes(type) ? type : 'race';

  // Vueltas objetivo configurables (sin forzar 30 vueltas estáticas)
  let parsedTargetLaps: number | undefined = undefined;
  if (targetLaps !== undefined && targetLaps !== null && targetLaps !== '') {
    const num = Number(targetLaps);
    if (!isNaN(num) && num > 0) {
      parsedTargetLaps = Math.floor(num);
    }
  }

  // Lista de escuderías participantes seleccionadas
  const teamsInEvent = await store.getTeams(event.id);
  const validTeamIds = new Set(teamsInEvent.map(t => t.id));

  let finalParticipatingTeamIds: string[] = [];
  if (Array.isArray(participatingTeamIds)) {
    finalParticipatingTeamIds = participatingTeamIds.filter(tid => validTeamIds.has(tid));
  } else if (participatingTeamIds === 'all') {
    finalParticipatingTeamIds = teamsInEvent.map(t => t.id);
  }

  const existingSessions = await store.getSessions(event.id);
  const targetId = id || `session-${crypto.randomUUID()}`;
  const existingSession = existingSessions.find(s => s.id === targetId);

  const session: SessionData = {
    id: targetId,
    eventId: event.id,
    name: name.trim(),
    type: sessionType,
    targetLaps: parsedTargetLaps,
    participatingTeamIds: finalParticipatingTeamIds,
    status: status && ['SCHEDULED', 'RUNNING', 'TIMING_CLOSED', 'OFFICIAL'].includes(status)
      ? status
      : (existingSession?.status || 'SCHEDULED'),
    createdAt: existingSession?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await store.saveSession(session);

  const updatedSessions = await store.getSessions(event.id);

  return res.status(existingSession ? 200 : 201).json({
    ok: true,
    message: existingSession ? 'Sesión actualizada correctamente.' : 'Sesión creada exitosamente.',
    session,
    sessions: updatedSessions
  });
});

// DELETE /api/sessions/:id - Eliminar sesión
eventsRouter.delete('/sessions/:id', async (req: Request, res: Response) => {
  const store = getPersistenceStore();
  const event = await store.getEvent();

  if (!event) {
    return res.status(404).json({ ok: false, error: { message: 'Evento no encontrado.' } });
  }

  const sessionId = req.params.id;
  await store.deleteSession(sessionId);
  const updatedSessions = await store.getSessions(event.id);

  return res.json({
    ok: true,
    message: 'Sesión eliminada.',
    sessions: updatedSessions
  });
});

// GET /api/teams/access/:token - Validar acceso de escudería mediante token único (M2)
eventsRouter.get('/teams/access/:token', async (req: Request, res: Response) => {
  const store = getPersistenceStore();
  const { token } = req.params;

  if (!token || token.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_TOKEN', message: 'Token de acceso no proporcionado.' }
    });
  }

  const team = await store.getTeamByToken(token.trim());
  if (!team) {
    return res.status(404).json({
      ok: false,
      error: { code: 'TEAM_NOT_FOUND', message: 'Token de escudería inválido o caducado.' }
    });
  }

  const event = await store.getEvent();
  const sessions = event ? await store.getSessions(event.id) : [];

  return res.json({
    ok: true,
    message: 'Acceso autorizado de escudería.',
    team,
    event,
    sessions: sessions.filter(s => s.participatingTeamIds.includes(team.id))
  });
});

// POST /api/teams/:id/regenerate-token - Regenerar token de escudería (M2)
eventsRouter.post('/teams/:id/regenerate-token', async (req: Request, res: Response) => {
  const store = getPersistenceStore();
  const teamId = req.params.id;
  const newToken = `token-${crypto.randomBytes(8).toString('hex')}`;

  const updatedTeam = await store.regenerateTeamToken(teamId, newToken);
  if (!updatedTeam) {
    return res.status(404).json({
      ok: false,
      error: { code: 'TEAM_NOT_FOUND', message: 'Escudería no encontrada.' }
    });
  }

  return res.json({
    ok: true,
    message: 'Token de acceso regenerado con éxito.',
    team: updatedTeam
  });
});
