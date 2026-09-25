import { RaceEventData, LapRecord } from './storage/types';

export type DirectiveStatus = 'PENDING' | 'SERVED' | 'CANCELLED';

export interface WarningRecord {
  id: string;
  reason: string;
  serverTimestamp: number;
  actor: string;
}

export interface TimePenaltyRecord {
  id: string;
  seconds: number;
  penaltyMs: number;
  reason: string;
  serverTimestamp: number;
  actor: string;
  cancelled?: boolean;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledAt?: number;
}

export interface PitRequiredRecord {
  id: string;
  reason: string;
  serverTimestamp: number;
  actor: string;
  status: DirectiveStatus;
  servedAt?: number;
  servedBy?: string;
  cancelledAt?: number;
  cancelReason?: string;
  cancelledBy?: string;
}

export interface DisqualificationRecord {
  id: string;
  reason: string;
  serverTimestamp: number;
  actor: string;
  reinstated?: boolean;
  reinstateReason?: string;
  reinstatedBy?: string;
  reinstatedAt?: number;
}

export interface TeamStewardingState {
  teamId: string;
  warnings: WarningRecord[];
  timePenalties: TimePenaltyRecord[];
  totalPenaltyMs: number;
  pitRequiredDirectives: PitRequiredRecord[];
  activePitRequired?: PitRequiredRecord;
  disqualification?: DisqualificationRecord;
  isDisqualified: boolean;
}

/**
 * Evalúa de forma determinista y neutral el estado deportivo de una escudería a partir de los eventos
 * registrados por los Comisarios / Dirección de Carrera (M7).
 */
export function computeTeamStewarding(
  teamId: string,
  events: RaceEventData[],
  _teamLaps: LapRecord[] = []
): TeamStewardingState {
  const teamEvents = events
    .filter((e) => e.teamId === teamId && !e.invalidated)
    .sort((a, b) => a.serverTimestamp - b.serverTimestamp);

  const warnings: WarningRecord[] = [];
  const timePenalties: TimePenaltyRecord[] = [];
  const pitDirectivesMap = new Map<string, PitRequiredRecord>();
  let currentDisqualification: DisqualificationRecord | undefined = undefined;

  for (const ev of teamEvents) {
    if (ev.type === 'STEWARD_WARNING') {
      warnings.push({
        id: ev.id,
        reason: (ev.payload.reason as string) || 'Advertencia de Comisaría Deportiva',
        serverTimestamp: ev.serverTimestamp,
        actor: ev.actor
      });
    } else if (ev.type === 'STEWARD_TIME_PENALTY') {
      const seconds = Number(ev.payload.seconds || 0);
      const penaltyMs = Number(ev.payload.penaltyMs || seconds * 1000);
      timePenalties.push({
        id: ev.id,
        seconds,
        penaltyMs,
        reason: (ev.payload.reason as string) || 'Penalización de tiempo',
        serverTimestamp: ev.serverTimestamp,
        actor: ev.actor,
        cancelled: false
      });
    } else if (ev.type === 'STEWARD_TIME_PENALTY_CANCELLED') {
      const penaltyId = ev.payload.penaltyId as string;
      const penalty = timePenalties.find((p) => p.id === penaltyId);
      if (penalty) {
        penalty.cancelled = true;
        penalty.cancelReason = (ev.payload.reason as string) || 'Penalización anulada por Comisaría';
        penalty.cancelledBy = ev.actor;
        penalty.cancelledAt = ev.serverTimestamp;
      }
    } else if (ev.type === 'STEWARD_PIT_REQUIRED') {
      pitDirectivesMap.set(ev.id, {
        id: ev.id,
        reason: (ev.payload.reason as string) || 'Paso por boxes obligatorio',
        serverTimestamp: ev.serverTimestamp,
        actor: ev.actor,
        status: 'PENDING'
      });
    } else if (ev.type === 'STEWARD_PIT_REQUIRED_RESOLVED') {
      const directiveId = ev.payload.directiveId as string;
      const directive = pitDirectivesMap.get(directiveId);
      if (directive) {
        const resolution = ev.payload.status as DirectiveStatus;
        directive.status = resolution === 'CANCELLED' ? 'CANCELLED' : 'SERVED';
        if (directive.status === 'SERVED') {
          directive.servedAt = ev.serverTimestamp;
          directive.servedBy = ev.actor;
        } else {
          directive.cancelledAt = ev.serverTimestamp;
          directive.cancelReason = (ev.payload.reason as string) || 'Directiva cancelada';
          directive.cancelledBy = ev.actor;
        }
      }
    } else if (ev.type === 'PIT_IN') {
      // Si la escudería entra a boxes y hay directivas PENDING emitidas con anterioridad,
      // se marcan automáticamente como cumplidas (SERVED)
      for (const directive of pitDirectivesMap.values()) {
        if (directive.status === 'PENDING' && directive.serverTimestamp <= ev.serverTimestamp) {
          directive.status = 'SERVED';
          directive.servedAt = ev.serverTimestamp;
          directive.servedBy = 'pit-in-auto';
        }
      }
    } else if (ev.type === 'STEWARD_DISQUALIFY') {
      currentDisqualification = {
        id: ev.id,
        reason: (ev.payload.reason as string) || 'Descalificación deportiva',
        serverTimestamp: ev.serverTimestamp,
        actor: ev.actor,
        reinstated: false
      };
    } else if (ev.type === 'STEWARD_REINSTATE') {
      if (currentDisqualification) {
        currentDisqualification.reinstated = true;
        currentDisqualification.reinstateReason =
          (ev.payload.reason as string) || 'Descalificación revocada por Comisaría';
        currentDisqualification.reinstatedBy = ev.actor;
        currentDisqualification.reinstatedAt = ev.serverTimestamp;
      }
    }
  }

  // Cálculo de suma de penalizaciones activas
  const activePenalties = timePenalties.filter((p) => !p.cancelled);
  const totalPenaltyMs = activePenalties.reduce((sum, p) => sum + p.penaltyMs, 0);

  const pitRequiredDirectives = Array.from(pitDirectivesMap.values());
  const activePitRequired = [...pitRequiredDirectives]
    .reverse()
    .find((d) => d.status === 'PENDING');

  const isDisqualified = !!(currentDisqualification && !currentDisqualification.reinstated);

  return {
    teamId,
    warnings,
    timePenalties,
    totalPenaltyMs,
    pitRequiredDirectives,
    activePitRequired,
    disqualification: currentDisqualification,
    isDisqualified
  };
}

/**
 * Calcula el estado de comisaría para todas las escuderías participantes
 */
export function computeAllTeamsStewarding(
  participatingTeamIds: string[],
  events: RaceEventData[],
  laps: LapRecord[] = []
): Record<string, TeamStewardingState> {
  const result: Record<string, TeamStewardingState> = {};
  for (const teamId of participatingTeamIds) {
    const teamLaps = laps.filter((l) => l.teamId === teamId);
    result[teamId] = computeTeamStewarding(teamId, events, teamLaps);
  }
  return result;
}
