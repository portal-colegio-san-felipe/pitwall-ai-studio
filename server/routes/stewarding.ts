import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getPersistenceStore } from '../storage';
import { realtimeBus } from '../realtime';
import { computeTimingOverview } from './timing';
import { computeTeamStewarding, computeAllTeamsStewarding } from '../stewarding';

export const stewardingRouter = Router();

/**
 * Validador de privilegios de Comisaría / Dirección de Carrera.
 * Las escuderías individuales no pueden emitir sanciones ni descalificaciones.
 */
async function validateStewardAuthorization(req: Request): Promise<{ authorized: boolean; actor: string; error?: string }> {
  const authHeader = req.headers.authorization;
  const store = getPersistenceStore();

  // Si se provee un Bearer token de escudería, se rechaza porque las escuderías no tienen potestad sancionadora
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const team = await store.getTeamByToken(token);
    if (team) {
      return {
        authorized: false,
        actor: team.name,
        error: 'Las escuderías no tienen privilegios de comisaría deportiva ni aplicación de sanciones.'
      };
    }
  }

  const actor = req.body.actor ? String(req.body.actor).trim() : 'Dirección de Carrera';
  return { authorized: true, actor };
}

/**
 * Emitir Advertencia / Nota Deportiva (M7)
 * POST /sessions/:sessionId/stewarding/warning
 */
stewardingRouter.post('/sessions/:sessionId/stewarding/warning', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, reason } = req.body;

  if (!teamId || typeof teamId !== 'string') {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_TEAM', message: 'Identificador de escudería requerido' } });
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ ok: false, error: { code: 'REASON_REQUIRED', message: 'El motivo de la advertencia es obligatorio' } });
  }

  const auth = await validateStewardAuthorization(req);
  if (!auth.authorized) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN_STEWARDING_ACTION', message: auth.error } });
  }

  try {
    const store = getPersistenceStore();
    const event = await store.getEvent();
    if (!event) {
      return res.status(404).json({ ok: false, error: { code: 'EVENT_NOT_CONFIGURED', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    const serverNow = Date.now();
    const warningEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'STEWARD_WARNING',
      serverTimestamp: serverNow,
      payload: {
        reason: reason.trim(),
        actor: auth.actor
      },
      actor: auth.actor
    };

    await store.appendRaceEvent(warningEvent);

    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamState = computeTeamStewarding(teamId, allEvents);

    return res.status(201).json({
      ok: true,
      message: `Advertencia emitida a la escudería: "${reason.trim()}"`,
      stewarding: teamState
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Aplicar Penalización de Tiempo (M7)
 * POST /sessions/:sessionId/stewarding/time-penalty
 */
stewardingRouter.post('/sessions/:sessionId/stewarding/time-penalty', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, seconds, reason } = req.body;

  if (!teamId || typeof teamId !== 'string') {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_TEAM', message: 'Identificador de escudería requerido' } });
  }

  const penaltySec = Number(seconds);
  if (isNaN(penaltySec) || penaltySec <= 0) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_PENALTY_TIME', message: 'Los segundos de penalización deben ser un número positivo' } });
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ ok: false, error: { code: 'REASON_REQUIRED', message: 'El motivo de la penalización de tiempo es obligatorio' } });
  }

  const auth = await validateStewardAuthorization(req);
  if (!auth.authorized) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN_STEWARDING_ACTION', message: auth.error } });
  }

  try {
    const store = getPersistenceStore();
    const event = await store.getEvent();
    if (!event) {
      return res.status(404).json({ ok: false, error: { code: 'EVENT_NOT_CONFIGURED', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    const serverNow = Date.now();
    const penaltyMs = Math.round(penaltySec * 1000);

    const penaltyEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'STEWARD_TIME_PENALTY',
      serverTimestamp: serverNow,
      payload: {
        seconds: penaltySec,
        penaltyMs,
        reason: reason.trim(),
        actor: auth.actor
      },
      actor: auth.actor
    };

    await store.appendRaceEvent(penaltyEvent);

    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamState = computeTeamStewarding(teamId, allEvents);

    return res.status(201).json({
      ok: true,
      message: `Penalización de +${penaltySec.toFixed(3)}s aplicada: "${reason.trim()}"`,
      stewarding: teamState
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Anular o Revocar Penalización de Tiempo (M7)
 * POST /sessions/:sessionId/stewarding/time-penalty/:penaltyId/cancel
 */
stewardingRouter.post('/sessions/:sessionId/stewarding/time-penalty/:penaltyId/cancel', async (req: Request, res: Response) => {
  const { sessionId, penaltyId } = req.params;
  const { reason } = req.body;

  const auth = await validateStewardAuthorization(req);
  if (!auth.authorized) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN_STEWARDING_ACTION', message: auth.error } });
  }

  try {
    const store = getPersistenceStore();
    const raceEvents = await store.getRaceEvents(sessionId);
    const targetEvent = raceEvents.find((e) => e.id === penaltyId && e.type === 'STEWARD_TIME_PENALTY');

    if (!targetEvent) {
      return res.status(404).json({ ok: false, error: { code: 'PENALTY_NOT_FOUND', message: 'Penalización no encontrada' } });
    }

    const serverNow = Date.now();
    const cancelEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId: targetEvent.teamId,
      type: 'STEWARD_TIME_PENALTY_CANCELLED',
      serverTimestamp: serverNow,
      payload: {
        penaltyId,
        reason: reason ? String(reason).trim() : 'Penalización revocada por Comisaría',
        actor: auth.actor
      },
      actor: auth.actor
    };

    await store.appendRaceEvent(cancelEvent);

    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamState = computeTeamStewarding(targetEvent.teamId!, allEvents);

    return res.json({
      ok: true,
      message: 'Penalización de tiempo revocada correctamente',
      stewarding: teamState
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Emitir Directiva PIT_REQUIRED (Parada Obligatoria en Boxes) (M7)
 * POST /sessions/:sessionId/stewarding/pit-required
 */
stewardingRouter.post('/sessions/:sessionId/stewarding/pit-required', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, reason } = req.body;

  if (!teamId || typeof teamId !== 'string') {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_TEAM', message: 'Identificador de escudería requerido' } });
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ ok: false, error: { code: 'REASON_REQUIRED', message: 'El motivo del requerimiento de boxes es obligatorio' } });
  }

  const auth = await validateStewardAuthorization(req);
  if (!auth.authorized) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN_STEWARDING_ACTION', message: auth.error } });
  }

  try {
    const store = getPersistenceStore();
    const event = await store.getEvent();
    if (!event) {
      return res.status(404).json({ ok: false, error: { code: 'EVENT_NOT_CONFIGURED', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    const serverNow = Date.now();
    const pitRequiredEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'STEWARD_PIT_REQUIRED',
      serverTimestamp: serverNow,
      payload: {
        reason: reason.trim(),
        actor: auth.actor
      },
      actor: auth.actor
    };

    await store.appendRaceEvent(pitRequiredEvent);

    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamState = computeTeamStewarding(teamId, allEvents);

    return res.status(201).json({
      ok: true,
      message: `Orden de parada obligatoria en boxes emitida: "${reason.trim()}"`,
      stewarding: teamState
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Resolver Directiva PIT_REQUIRED (SERVED / CANCELLED) (M7)
 * POST /sessions/:sessionId/stewarding/pit-required/:directiveId/resolve
 */
stewardingRouter.post('/sessions/:sessionId/stewarding/pit-required/:directiveId/resolve', async (req: Request, res: Response) => {
  const { sessionId, directiveId } = req.params;
  const { status, reason } = req.body;

  if (status !== 'SERVED' && status !== 'CANCELLED') {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_STATUS', message: 'El estado debe ser SERVED o CANCELLED' } });
  }

  const auth = await validateStewardAuthorization(req);
  if (!auth.authorized) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN_STEWARDING_ACTION', message: auth.error } });
  }

  try {
    const store = getPersistenceStore();
    const raceEvents = await store.getRaceEvents(sessionId);
    const targetEvent = raceEvents.find((e) => e.id === directiveId && e.type === 'STEWARD_PIT_REQUIRED');

    if (!targetEvent) {
      return res.status(404).json({ ok: false, error: { code: 'DIRECTIVE_NOT_FOUND', message: 'Directiva no encontrada' } });
    }

    const serverNow = Date.now();
    const resolveEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId: targetEvent.teamId,
      type: 'STEWARD_PIT_REQUIRED_RESOLVED',
      serverTimestamp: serverNow,
      payload: {
        directiveId,
        status,
        reason: reason ? String(reason).trim() : status === 'SERVED' ? 'Parada en boxes cumplida' : 'Directiva cancelada',
        actor: auth.actor
      },
      actor: auth.actor
    };

    await store.appendRaceEvent(resolveEvent);

    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamState = computeTeamStewarding(targetEvent.teamId!, allEvents);

    return res.json({
      ok: true,
      message: `Directiva de parada en boxes marcada como ${status === 'SERVED' ? 'CUMPLIDA' : 'CANCELADA'}`,
      stewarding: teamState
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Descalificar Escudería (DISQUALIFY) (M7)
 * POST /sessions/:sessionId/stewarding/disqualify
 */
stewardingRouter.post('/sessions/:sessionId/stewarding/disqualify', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, reason } = req.body;

  if (!teamId || typeof teamId !== 'string') {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_TEAM', message: 'Identificador de escudería requerido' } });
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ ok: false, error: { code: 'REASON_REQUIRED', message: 'El motivo de la descalificación es obligatorio' } });
  }

  const auth = await validateStewardAuthorization(req);
  if (!auth.authorized) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN_STEWARDING_ACTION', message: auth.error } });
  }

  try {
    const store = getPersistenceStore();
    const event = await store.getEvent();
    if (!event) {
      return res.status(404).json({ ok: false, error: { code: 'EVENT_NOT_CONFIGURED', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    const serverNow = Date.now();
    const dqEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'STEWARD_DISQUALIFY',
      serverTimestamp: serverNow,
      payload: {
        reason: reason.trim(),
        actor: auth.actor
      },
      actor: auth.actor
    };

    await store.appendRaceEvent(dqEvent);

    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamState = computeTeamStewarding(teamId, allEvents);

    return res.status(201).json({
      ok: true,
      message: `Escudería descalificada: "${reason.trim()}"`,
      stewarding: teamState
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Revertir / Readmitir Descalificación (REINSTATE) (M7)
 * POST /sessions/:sessionId/stewarding/reinstate
 */
stewardingRouter.post('/sessions/:sessionId/stewarding/reinstate', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, reason } = req.body;

  if (!teamId || typeof teamId !== 'string') {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_TEAM', message: 'Identificador de escudería requerido' } });
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ ok: false, error: { code: 'REASON_REQUIRED', message: 'El motivo de revocación de la descalificación es obligatorio' } });
  }

  const auth = await validateStewardAuthorization(req);
  if (!auth.authorized) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN_STEWARDING_ACTION', message: auth.error } });
  }

  try {
    const store = getPersistenceStore();
    const event = await store.getEvent();
    if (!event) {
      return res.status(404).json({ ok: false, error: { code: 'EVENT_NOT_CONFIGURED', message: 'No hay evento configurado' } });
    }

    const serverNow = Date.now();
    const reinstateEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'STEWARD_REINSTATE',
      serverTimestamp: serverNow,
      payload: {
        reason: reason.trim(),
        actor: auth.actor
      },
      actor: auth.actor
    };

    await store.appendRaceEvent(reinstateEvent);

    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamState = computeTeamStewarding(teamId, allEvents);

    return res.json({
      ok: true,
      message: `Descalificación revocada y escudería readmitida: "${reason.trim()}"`,
      stewarding: teamState
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Consultar Estado de Comisaría de la Sesión (M7)
 * GET /sessions/:sessionId/stewarding
 */
stewardingRouter.get('/sessions/:sessionId/stewarding', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const store = getPersistenceStore();
    const event = await store.getEvent();
    if (!event) {
      return res.status(404).json({ ok: false, error: { code: 'EVENT_NOT_CONFIGURED', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    const raceEvents = await store.getRaceEvents(sessionId);
    const laps = await store.getLaps(sessionId);
    const teamsStewarding = computeAllTeamsStewarding(session.participatingTeamIds, raceEvents, laps);

    return res.json({
      ok: true,
      teamsStewarding
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});
