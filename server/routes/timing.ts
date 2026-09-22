import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getPersistenceStore } from '../storage/index.js';
import { LapRecord } from '../storage/types.js';
import { realtimeBus } from '../realtime.js';

export const timingRouter = Router();

// Umbral mínimo anti-doble pulsación (3.5 segundos)
const MIN_LAP_INTERVAL_MS = 3500;

/**
 * Función central autoritativa para calcular la proyección de tiempos de una sesión
 */
export async function computeTimingOverview(sessionId: string) {
  const store = getPersistenceStore();
  const event = await store.getEvent();
  if (!event) return null;

  const sessions = await store.getSessions(event.id);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  const laps = await store.getLaps(sessionId);
  const validLaps = laps.filter((l) => l.isValid);

  let fastestLapMs: number | undefined = undefined;
  let fastestLapTeamId: string | undefined = undefined;

  const teamEntries = session.participatingTeamIds.map((tId) => {
    const teamLaps = validLaps.filter((l) => l.teamId === tId);
    const lapCount = teamLaps.length;
    const lastLap = lapCount > 0 ? teamLaps[lapCount - 1] : undefined;
    const bestLap = lapCount > 0 ? Math.min(...teamLaps.map((l) => l.lapTimeMs)) : undefined;

    if (bestLap !== undefined) {
      if (fastestLapMs === undefined || bestLap < fastestLapMs) {
        fastestLapMs = bestLap;
        fastestLapTeamId = tId;
      }
    }

    return {
      teamId: tId,
      lapCount,
      lastLapMs: lastLap?.lapTimeMs,
      bestLapMs: bestLap,
      lastTimestampMs: lastLap?.serverTimestamp || 0
    };
  });

  if (session.type === 'qualifying') {
    teamEntries.sort((a, b) => {
      if (!a.bestLapMs && !b.bestLapMs) return 0;
      if (!a.bestLapMs) return 1;
      if (!b.bestLapMs) return -1;
      return a.bestLapMs - b.bestLapMs;
    });
  } else {
    teamEntries.sort((a, b) => {
      if (b.lapCount !== a.lapCount) {
        return b.lapCount - a.lapCount;
      }
      if (a.lapCount === 0) return 0;
      return (a.lastTimestampMs || 0) - (b.lastTimestampMs || 0);
    });
  }

  const leaderTimestamp = teamEntries[0]?.lastTimestampMs;
  const leaderboard = teamEntries.map((entry, idx) => {
    const position = idx + 1;
    let gapMs: number | undefined = undefined;
    if (position > 1 && leaderTimestamp && entry.lastTimestampMs) {
      gapMs = entry.lastTimestampMs - leaderTimestamp;
    }

    return {
      position,
      teamId: entry.teamId,
      lapCount: entry.lapCount,
      lastLapMs: entry.lastLapMs,
      bestLapMs: entry.bestLapMs,
      lastTimestampMs: entry.lastTimestampMs,
      gapMs: gapMs && gapMs > 0 ? gapMs : undefined,
      isFastestLap: fastestLapTeamId === entry.teamId && (entry.bestLapMs || 0) > 0
    };
  });

  return {
    sessionId: session.id,
    sessionStatus: session.status,
    startedAt: session.startedAt,
    fastestLapTeamId,
    fastestLapMs,
    totalLapsRecorded: validLaps.length,
    leaderboard,
    revision: realtimeBus.getRevision(),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Stream SSE en tiempo real para clientes (Display, Broadcast, Race Control, Pit Wall)
 * GET /timing/stream
 */
timingRouter.get('/timing/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sessionId = req.query.sessionId as string | undefined;
  const unregister = realtimeBus.registerClient(res, sessionId);

  req.on('close', () => {
    unregister();
  });
});

/**
 * Iniciar sesión / manga
 * POST /sessions/:sessionId/start
 */
timingRouter.post('/sessions/:sessionId/start', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
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

    session.status = 'RUNNING';
    session.startedAt = session.startedAt || Date.now();
    session.updatedAt = new Date().toISOString();

    await store.saveSession(session);
    await store.appendRaceEvent({
      id: crypto.randomUUID(),
      sessionId: session.id,
      type: 'SESSION_STARTED',
      serverTimestamp: Date.now(),
      payload: { startedAt: session.startedAt },
      actor: 'race-control'
    });

    const overview = await computeTimingOverview(session.id);
    realtimeBus.publishSessionUpdate(session.id, session);
    if (overview) realtimeBus.publishTimingUpdate(session.id, overview);

    return res.json({ ok: true, session });
  } catch {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Error al iniciar la sesión' } });
  }
});

/**
 * Pausar / detener sesión
 * POST /sessions/:sessionId/stop
 */
timingRouter.post('/sessions/:sessionId/stop', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
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

    session.status = 'SCHEDULED';
    session.updatedAt = new Date().toISOString();
    await store.saveSession(session);

    const overview = await computeTimingOverview(session.id);
    realtimeBus.publishSessionUpdate(session.id, session);
    if (overview) realtimeBus.publishTimingUpdate(session.id, overview);

    return res.json({ ok: true, session });
  } catch {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Error al pausar la sesión' } });
  }
});

/**
 * Cerrar cronometraje de sesión
 * POST /sessions/:sessionId/close
 */
timingRouter.post('/sessions/:sessionId/close', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
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

    session.status = 'TIMING_CLOSED';
    session.updatedAt = new Date().toISOString();
    await store.saveSession(session);

    await store.appendRaceEvent({
      id: crypto.randomUUID(),
      sessionId: session.id,
      type: 'SESSION_TIMING_CLOSED',
      serverTimestamp: Date.now(),
      payload: { closedAt: Date.now() },
      actor: 'race-control'
    });

    const overview = await computeTimingOverview(session.id);
    realtimeBus.publishSessionUpdate(session.id, session);
    if (overview) realtimeBus.publishTimingUpdate(session.id, overview);

    return res.json({ ok: true, session });
  } catch {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Error al cerrar cronometraje' } });
  }
});

/**
 * Registrar intento de vuelta (Criterio autoritativo M3)
 * POST /sessions/:sessionId/laps
 * Body: { teamId, token?, clientIntentId? }
 * Headers: Authorization: Bearer <token> o x-team-token
 */
timingRouter.post('/sessions/:sessionId/laps', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { teamId, clientIntentId } = req.body;
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.headers['x-team-token'];
  const token = (tokenFromHeader as string) || req.body.token;

  const store = getPersistenceStore();

  try {
    const event = await store.getEvent();
    if (!event) {
      return res.status(400).json({ ok: false, error: { code: 'NO_EVENT', message: 'No hay evento activo' } });
    }

    const sessions = await store.getSessions(event.id);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Manga no encontrada' } });
    }

    // Validar estado de la sesión
    if (session.status !== 'RUNNING') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'SESSION_NOT_RUNNING',
          message:
            session.status === 'TIMING_CLOSED'
              ? 'El cronometraje de esta manga está cerrado.'
              : 'La manga no se encuentra en curso (RUNNING).'
        }
      });
    }

    // Validar equipo objetivo
    if (!teamId) {
      return res.status(400).json({ ok: false, error: { code: 'TEAM_ID_REQUIRED', message: 'Identificador de escudería requerido' } });
    }

    // Validar que el equipo participe en esta sesión
    if (!session.participatingTeamIds.includes(teamId)) {
      return res.status(403).json({
        ok: false,
        error: { code: 'TEAM_NOT_IN_SESSION', message: 'La escudería no está inscrita en esta manga' }
      });
    }

    // Límite de permisos / Boundary Check (Escenario C):
    // Si viene con token de escudería, debe pertenecer a ese teamId
    if (token) {
      const authorizedTeam = await store.getTeamByToken(token);
      if (!authorizedTeam || authorizedTeam.id !== teamId) {
        return res.status(403).json({
          ok: false,
          error: { code: 'FORBIDDEN_TEAM_ACTION', message: 'El token no corresponde a la escudería indicada' }
        });
      }
    }

    const serverNow = Date.now();
    const existingLaps = await store.getLaps(sessionId);
    const validTeamLaps = existingLaps.filter((l) => l.teamId === teamId && l.isValid);

    // Protección anti-doble pulsación (Escenario D):
    // Si la última vuelta de este equipo fue hace menos de MIN_LAP_INTERVAL_MS, rechazar
    if (validTeamLaps.length > 0) {
      const lastLap = validTeamLaps[validTeamLaps.length - 1];
      const timeSinceLastLap = serverNow - lastLap.serverTimestamp;
      if (timeSinceLastLap < MIN_LAP_INTERVAL_MS) {
        return res.status(429).json({
          ok: false,
          error: {
            code: 'DUPLICATE_LAP_INTENT',
            message: `Intento duplicado detectado (protección anti-doble pulsación activa, transcurridos solo ${timeSinceLastLap}ms)`
          }
        });
      }
    }

    // Idempotencia por clientIntentId si se suministró
    if (clientIntentId) {
      const alreadyProcessed = existingLaps.find((l) => l.clientIntentId === clientIntentId);
      if (alreadyProcessed) {
        return res.json({ ok: true, lap: alreadyProcessed, duplicate: true });
      }
    }

    // Cálculo autoritativo de tiempo de vuelta
    let lapTimeMs = 0;
    if (validTeamLaps.length === 0) {
      // Primera vuelta: calculada desde startedAt si existe, o mínimo delta
      const startRef = session.startedAt || serverNow;
      lapTimeMs = Math.max(serverNow - startRef, 1000);
    } else {
      const lastLap = validTeamLaps[validTeamLaps.length - 1];
      lapTimeMs = Math.max(serverNow - lastLap.serverTimestamp, 1000);
    }

    const lapNumber = validTeamLaps.length + 1;
    const newLap: LapRecord = {
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      lapNumber,
      serverTimestamp: serverNow,
      lapTimeMs,
      isValid: true,
      recordedBy: token ? `token:${token.slice(0, 8)}` : 'race-control',
      clientIntentId
    };

    await store.saveLap(newLap);

    // Registrar evento auditable en la historia de carrera
    await store.appendRaceEvent({
      id: crypto.randomUUID(),
      sessionId,
      teamId,
      type: 'LAP_REGISTERED',
      serverTimestamp: serverNow,
      payload: {
        lapId: newLap.id,
        lapNumber,
        lapTimeMs,
        recordedBy: newLap.recordedBy
      },
      actor: newLap.recordedBy
    });

    // Calcular estadísticas actualizadas para la respuesta
    const updatedTeamLaps = [...validTeamLaps, newLap];
    const bestLapMs = Math.min(...updatedTeamLaps.map((l) => l.lapTimeMs));

    // Publicar actualización en tiempo real a todos los clientes conectados (M4)
    const overview = await computeTimingOverview(session.id);
    if (overview) {
      realtimeBus.publishTimingUpdate(session.id, overview);
    }

    return res.status(201).json({
      ok: true,
      lap: newLap,
      stats: {
        lapCount: updatedTeamLaps.length,
        lastLapMs: lapTimeMs,
        bestLapMs
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Obtener estado de tiempos y tabla de clasificación (M4)
 * GET /sessions/:sessionId/timing
 */
timingRouter.get('/sessions/:sessionId/timing', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const overview = await computeTimingOverview(sessionId);
    if (!overview) {
      return res.status(404).json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Sesión no encontrada o sin evento activo' } });
    }

    return res.json({
      ok: true,
      timing: overview
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Obtener historial de vueltas de la sesión
 * GET /sessions/:sessionId/laps
 */
timingRouter.get('/sessions/:sessionId/laps', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const store = getPersistenceStore();

  try {
    const laps = await store.getLaps(sessionId);
    return res.json({ ok: true, laps });
  } catch {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Error al obtener historial' } });
  }
});

/**
 * Invalidar una vuelta registrada (M5 - Correcciones y Auditoría)
 * POST /sessions/:sessionId/laps/:lapId/invalidate
 * Body: { reason: string, actor?: string }
 */
timingRouter.post('/sessions/:sessionId/laps/:lapId/invalidate', async (req: Request, res: Response) => {
  const { sessionId, lapId } = req.params;
  const { reason, actor } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({
      ok: false,
      error: { code: 'REASON_REQUIRED', message: 'El motivo de la invalidación es obligatorio para auditoría' }
    });
  }

  const store = getPersistenceStore();

  try {
    const laps = await store.getLaps(sessionId);
    const lap = laps.find((l) => l.id === lapId);
    if (!lap) {
      return res.status(404).json({
        ok: false,
        error: { code: 'LAP_NOT_FOUND', message: 'Vuelta no encontrada en esta sesión' }
      });
    }

    if (!lap.isValid) {
      return res.status(400).json({
        ok: false,
        error: { code: 'ALREADY_INVALIDATED', message: 'La vuelta ya fue invalidada previamente' }
      });
    }

    const auditActor = (typeof actor === 'string' && actor.trim()) ? actor.trim() : 'Director de Carrera';
    const trimmedReason = reason.trim();
    const serverNow = Date.now();

    lap.isValid = false;
    lap.invalidatedAt = serverNow;
    lap.invalidationReason = trimmedReason;
    lap.invalidatedBy = auditActor;

    await store.updateLap(lap);

    // Registrar evento inmutable de auditoría
    await store.appendRaceEvent({
      id: crypto.randomUUID(),
      sessionId,
      teamId: lap.teamId,
      type: 'LAP_INVALIDATED',
      serverTimestamp: serverNow,
      payload: {
        lapId: lap.id,
        lapNumber: lap.lapNumber,
        lapTimeMs: lap.lapTimeMs,
        reason: trimmedReason,
        invalidatedBy: auditActor
      },
      actor: auditActor
    });

    // Recalcular proyección de tiempos y propagar en tiempo real a todas las vistas conectadas
    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    return res.json({
      ok: true,
      message: 'Vuelta invalidada correctamente y recalculadas todas las proyecciones',
      lap,
      timing: updatedTiming
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Restaurar una vuelta invalidada previamente (M5 - Correcciones y Auditoría)
 * POST /sessions/:sessionId/laps/:lapId/restore
 * Body: { reason: string, actor?: string }
 */
timingRouter.post('/sessions/:sessionId/laps/:lapId/restore', async (req: Request, res: Response) => {
  const { sessionId, lapId } = req.params;
  const { reason, actor } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({
      ok: false,
      error: { code: 'REASON_REQUIRED', message: 'El motivo de la restauración es obligatorio para auditoría' }
    });
  }

  const store = getPersistenceStore();

  try {
    const laps = await store.getLaps(sessionId);
    const lap = laps.find((l) => l.id === lapId);
    if (!lap) {
      return res.status(404).json({
        ok: false,
        error: { code: 'LAP_NOT_FOUND', message: 'Vuelta no encontrada en esta sesión' }
      });
    }

    if (lap.isValid) {
      return res.status(400).json({
        ok: false,
        error: { code: 'ALREADY_VALID', message: 'La vuelta ya se encuentra activa y válida' }
      });
    }

    const auditActor = (typeof actor === 'string' && actor.trim()) ? actor.trim() : 'Director de Carrera';
    const trimmedReason = reason.trim();
    const serverNow = Date.now();

    lap.isValid = true;
    lap.restoredAt = serverNow;
    lap.restoreReason = trimmedReason;
    lap.restoredBy = auditActor;

    await store.updateLap(lap);

    // Registrar evento inmutable de auditoría
    await store.appendRaceEvent({
      id: crypto.randomUUID(),
      sessionId,
      teamId: lap.teamId,
      type: 'LAP_RESTORED',
      serverTimestamp: serverNow,
      payload: {
        lapId: lap.id,
        lapNumber: lap.lapNumber,
        lapTimeMs: lap.lapTimeMs,
        reason: trimmedReason,
        restoredBy: auditActor
      },
      actor: auditActor
    });

    // Recalcular proyección de tiempos y propagar en tiempo real a todas las vistas conectadas
    const updatedTiming = await computeTimingOverview(sessionId);
    if (updatedTiming) {
      realtimeBus.publishTimingUpdate(sessionId, updatedTiming);
    }

    return res.json({
      ok: true,
      message: 'Vuelta restaurada correctamente y recalculadas todas las proyecciones',
      lap,
      timing: updatedTiming
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: msg } });
  }
});

/**
 * Obtener registro inmutable de auditoría de la sesión
 * GET /sessions/:sessionId/audit
 */
timingRouter.get('/sessions/:sessionId/audit', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const store = getPersistenceStore();

  try {
    const events = await store.getRaceEvents(sessionId);
    // Ordenar de más reciente a más antiguo
    const sorted = [...events].sort((a, b) => b.serverTimestamp - a.serverTimestamp);
    return res.json({ ok: true, events: sorted });
  } catch {
    return res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Error al obtener auditoría' } });
  }
});

