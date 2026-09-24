import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getPersistenceStore } from '../storage/index.js';
import { realtimeBus } from '../realtime.js';
import { computeTimingOverview } from './timing.js';
import {
  computeTeamStrategy,
  computeAllTeamsStrategy,
  DEFAULT_EQUIPMENT,
  DEFAULT_PERSONNEL,
  STANDARD_EQUIPMENT_OPTIONS
} from '../strategy.js';

export const strategyRouter = Router();

// Helper para resolver y validar la autorización de la escudería
async function validateTeamAuthorization(req: Request, teamId: string) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.headers['x-team-token'];
  const token = (tokenFromHeader as string) || req.body.token;

  const store = getPersistenceStore();
  if (token) {
    const authorizedTeam = await store.getTeamByToken(token);
    if (!authorizedTeam || authorizedTeam.id !== teamId) {
      return { authorized: false, error: 'FORBIDDEN_TEAM_ACTION', message: 'El token no corresponde a la escudería indicada' };
    }
    return { authorized: true, actor: `token:${token.slice(0, 8)}`, team: authorizedTeam };
  }

  // Si no hay token de equipo, se asume acción de Dirección de Carrera
  const actor = req.body.actor ? String(req.body.actor).trim() : 'Dirección de Carrera';
  return { authorized: true, actor, team: null };
}

/**
 * Obtener la estrategia neutral consolidada de una sesión (M6)
 * GET /sessions/:sessionId/strategy
 */
strategyRouter.get('/sessions/:sessionId/strategy', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const teamId = req.query.teamId as string | undefined;
  const store = getPersistenceStore();

  try {
    const event = await store.getEvent();
    if (!event) {
      return res.status(400).json({ ok: false, error: { code: 'NO_EVENT', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    const laps = await store.getLaps(sessionId);
    const validLaps = laps.filter((l) => l.isValid);
    const raceEvents = await store.getRaceEvents(sessionId);

    if (teamId) {
      const teamLaps = validLaps.filter((l) => l.teamId === teamId);
      const teamEvents = raceEvents.filter((e) => e.teamId === teamId);
      const strategy = computeTeamStrategy(teamId, teamLaps, teamEvents);
      return res.json({
        ok: true,
        sessionId,
        teamStrategy: strategy,
        availableEquipment: STANDARD_EQUIPMENT_OPTIONS
      });
    }

    const allStrategies = computeAllTeamsStrategy(session.participatingTeamIds, validLaps, raceEvents);
    return res.json({
      ok: true,
      sessionId,
      teamsStrategy: allStrategies,
      availableEquipment: STANDARD_EQUIPMENT_OPTIONS
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Registrar entrada a Boxes (PIT IN) - Criterio neutral M6
 * POST /sessions/:sessionId/strategy/pit-in
 * Body: { teamId: string, token?: string, reason?: string, actor?: string }
 */
strategyRouter.post('/sessions/:sessionId/strategy/pit-in', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, reason } = req.body;
  const store = getPersistenceStore();

  try {
    const event = await store.getEvent();
    if (!event) {
      return res.status(400).json({ ok: false, error: { code: 'NO_EVENT', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    if (session.status !== 'RUNNING' && session.status !== 'TIMING_CLOSED') {
      return res.status(400).json({
        ok: false,
        error: { code: 'SESSION_NOT_ACTIVE', message: 'La sesión no se encuentra en curso' }
      });
    }

    if (!teamId || !session.participatingTeamIds.includes(teamId)) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_TEAM', message: 'Escudería inválida o no participante en esta sesión' }
      });
    }

    const auth = await validateTeamAuthorization(req, teamId);
    if (!auth.authorized) {
      return res.status(403).json({ ok: false, error: { code: auth.error, message: auth.message } });
    }

    const serverNow = Date.now();
    const laps = await store.getLaps(sessionId);
    const validTeamLaps = laps.filter((l) => l.teamId === teamId && l.isValid);
    const lapNumber = validTeamLaps.length;

    const actorName = auth.actor || 'Operador de Escudería';

    const pitInEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'PIT_IN',
      serverTimestamp: serverNow,
      payload: {
        lapNumber,
        reason: reason ? String(reason).trim() : 'Parada en boxes solicitada',
        actor: actorName
      },
      actor: actorName
    };

    await store.appendRaceEvent(pitInEvent);

    // Recalcular tiempos y estrategia
    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamStrategy = computeTeamStrategy(
      teamId,
      validTeamLaps,
      allEvents.filter((e) => e.teamId === teamId)
    );

    return res.status(201).json({
      ok: true,
      message: 'Entrada a boxes (PIT IN) registrada correctamente.',
      event: pitInEvent,
      strategy: teamStrategy,
      timing: updatedTiming
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Registrar salida de Boxes (PIT OUT) - Criterio neutral M6
 * POST /sessions/:sessionId/strategy/pit-out
 * Body: { teamId: string, token?: string, reason?: string, actor?: string }
 */
strategyRouter.post('/sessions/:sessionId/strategy/pit-out', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, reason } = req.body;
  const store = getPersistenceStore();

  try {
    const event = await store.getEvent();
    if (!event) {
      return res.status(400).json({ ok: false, error: { code: 'NO_EVENT', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    if (session.status !== 'RUNNING' && session.status !== 'TIMING_CLOSED') {
      return res.status(400).json({
        ok: false,
        error: { code: 'SESSION_NOT_ACTIVE', message: 'La sesión no se encuentra en curso' }
      });
    }

    if (!teamId || !session.participatingTeamIds.includes(teamId)) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_TEAM', message: 'Escudería inválida o no participante en esta sesión' }
      });
    }

    const auth = await validateTeamAuthorization(req, teamId);
    if (!auth.authorized) {
      return res.status(403).json({ ok: false, error: { code: auth.error, message: auth.message } });
    }

    const serverNow = Date.now();
    const laps = await store.getLaps(sessionId);
    const validTeamLaps = laps.filter((l) => l.teamId === teamId && l.isValid);
    const lapNumber = validTeamLaps.length;

    // Calcular duración de la parada si hubo PIT_IN previo
    const raceEvents = await store.getRaceEvents(sessionId);
    const teamEvents = raceEvents.filter((e) => e.teamId === teamId && !e.invalidated);
    const lastPitIn = [...teamEvents].reverse().find((e) => e.type === 'PIT_IN');
    const durationMs = lastPitIn ? Math.max(0, serverNow - lastPitIn.serverTimestamp) : 0;
    const actorName = auth.actor || 'Operador de Escudería';

    const pitOutEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'PIT_OUT',
      serverTimestamp: serverNow,
      payload: {
        lapNumber,
        durationMs,
        pitInId: lastPitIn?.id,
        reason: reason ? String(reason).trim() : 'Reincorporación a pista',
        actor: actorName
      },
      actor: actorName
    };

    await store.appendRaceEvent(pitOutEvent);

    // Recalcular tiempos y estrategia
    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamStrategy = computeTeamStrategy(
      teamId,
      validTeamLaps,
      allEvents.filter((e) => e.teamId === teamId)
    );

    return res.status(201).json({
      ok: true,
      message: 'Salida de boxes (PIT OUT) registrada. Duración calculada objetivamente.',
      event: pitOutEvent,
      durationMs,
      strategy: teamStrategy,
      timing: updatedTiming
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Registrar cambio de equipamiento / compuesto (EQUIPMENT_CHANGED) - Criterio neutral M6
 * POST /sessions/:sessionId/strategy/equipment
 * Body: { teamId: string, equipment: string, token?: string, reason?: string, actor?: string }
 */
strategyRouter.post('/sessions/:sessionId/strategy/equipment', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, equipment, reason } = req.body;
  const store = getPersistenceStore();

  try {
    const event = await store.getEvent();
    if (!event) {
      return res.status(400).json({ ok: false, error: { code: 'NO_EVENT', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    if (!equipment || typeof equipment !== 'string' || !equipment.trim()) {
      return res.status(400).json({
        ok: false,
        error: { code: 'EQUIPMENT_REQUIRED', message: 'Debe especificar el nuevo equipamiento o compuesto' }
      });
    }

    if (!teamId || !session.participatingTeamIds.includes(teamId)) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_TEAM', message: 'Escudería inválida o no participante en esta sesión' }
      });
    }

    const auth = await validateTeamAuthorization(req, teamId);
    if (!auth.authorized) {
      return res.status(403).json({ ok: false, error: { code: auth.error, message: auth.message } });
    }

    const cleanEquipment = equipment.trim().toUpperCase();
    const serverNow = Date.now();
    const laps = await store.getLaps(sessionId);
    const validTeamLaps = laps.filter((l) => l.teamId === teamId && l.isValid);
    const lapNumber = validTeamLaps.length;

    // Obtener equipamiento anterior
    const raceEvents = await store.getRaceEvents(sessionId);
    const teamEvents = raceEvents.filter((e) => e.teamId === teamId && !e.invalidated);
    const lastEqEvent = [...teamEvents].reverse().find((e) => e.type === 'EQUIPMENT_CHANGED');
    const previousEquipment = (lastEqEvent?.payload.newEquipment || DEFAULT_EQUIPMENT) as string;

    const actorName = auth.actor || 'Operador de Escudería';

    const eqEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'EQUIPMENT_CHANGED',
      serverTimestamp: serverNow,
      payload: {
        newEquipment: cleanEquipment,
        previousEquipment,
        lapNumber,
        reason: reason ? String(reason).trim() : 'Cambio de compuesto / equipamiento',
        actor: actorName
      },
      actor: actorName
    };

    await store.appendRaceEvent(eqEvent);

    // Recalcular tiempos y estrategia
    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamStrategy = computeTeamStrategy(
      teamId,
      validTeamLaps,
      allEvents.filter((e) => e.teamId === teamId)
    );

    return res.status(201).json({
      ok: true,
      message: `Cambio a compuesto "${cleanEquipment}" registrado objetivamente.`,
      event: eqEvent,
      strategy: teamStrategy,
      timing: updatedTiming
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Registrar cambio de personal / piloto (PERSONNEL_CHANGED) - Criterio neutral M6
 * POST /sessions/:sessionId/strategy/personnel
 * Body: { teamId: string, personnel: string, token?: string, reason?: string, actor?: string }
 */
strategyRouter.post('/sessions/:sessionId/strategy/personnel', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, personnel, reason } = req.body;
  const store = getPersistenceStore();

  try {
    const event = await store.getEvent();
    if (!event) {
      return res.status(400).json({ ok: false, error: { code: 'NO_EVENT', message: 'No hay evento configurado' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada' } });
    }

    if (!personnel || typeof personnel !== 'string' || !personnel.trim()) {
      return res.status(400).json({
        ok: false,
        error: { code: 'PERSONNEL_REQUIRED', message: 'Debe especificar el nombre del piloto o miembro del personal' }
      });
    }

    if (!teamId || !session.participatingTeamIds.includes(teamId)) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_TEAM', message: 'Escudería inválida o no participante en esta sesión' }
      });
    }

    const auth = await validateTeamAuthorization(req, teamId);
    if (!auth.authorized) {
      return res.status(403).json({ ok: false, error: { code: auth.error, message: auth.message } });
    }

    const cleanPersonnel = personnel.trim();
    const serverNow = Date.now();
    const laps = await store.getLaps(sessionId);
    const validTeamLaps = laps.filter((l) => l.teamId === teamId && l.isValid);
    const lapNumber = validTeamLaps.length;

    // Obtener personal anterior
    const raceEvents = await store.getRaceEvents(sessionId);
    const teamEvents = raceEvents.filter((e) => e.teamId === teamId && !e.invalidated);
    const lastPEvent = [...teamEvents].reverse().find((e) => e.type === 'PERSONNEL_CHANGED');
    const previousPersonnel = (lastPEvent?.payload.newPersonnel || DEFAULT_PERSONNEL) as string;

    const actorName = auth.actor || 'Operador de Escudería';

    const pEvent = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'PERSONNEL_CHANGED',
      serverTimestamp: serverNow,
      payload: {
        newPersonnel: cleanPersonnel,
        previousPersonnel,
        lapNumber,
        reason: reason ? String(reason).trim() : 'Relevo de piloto / personal',
        actor: actorName
      },
      actor: actorName
    };

    await store.appendRaceEvent(pEvent);

    // Recalcular tiempos y estrategia
    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    const allEvents = await store.getRaceEvents(sessionId);
    const teamStrategy = computeTeamStrategy(
      teamId,
      validTeamLaps,
      allEvents.filter((e) => e.teamId === teamId)
    );

    return res.status(201).json({
      ok: true,
      message: `Relevo a "${cleanPersonnel}" registrado objetivamente.`,
      event: pEvent,
      strategy: teamStrategy,
      timing: updatedTiming
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});
