import { LapRecord, RaceEventData } from './storage/types.js';

export type PitState = 'ON_TRACK' | 'IN_PIT';

export interface PitStopRecord {
  id: string;
  pitInTimestamp: number;
  pitOutTimestamp?: number;
  durationMs?: number;
  lapNumber: number;
}

export interface EquipmentChangeRecord {
  id: string;
  equipment: string;
  previousEquipment?: string;
  lapNumber: number;
  serverTimestamp: number;
  actor: string;
  reason?: string;
}

export interface PersonnelChangeRecord {
  id: string;
  personnel: string;
  previousPersonnel?: string;
  lapNumber: number;
  serverTimestamp: number;
  actor: string;
  reason?: string;
}

export interface TeamStrategySummary {
  pitState: PitState;
  pitStopCount: number;
  currentPitInTimestamp?: number;
  currentPitDurationMs?: number;
  lastPitDurationMs?: number;
  currentEquipment: string;
  equipmentStintLaps: number;
  currentPersonnel: string;
  personnelStintLaps: number;
}

export interface TeamStrategyState extends TeamStrategySummary {
  teamId: string;
  pitStops: PitStopRecord[];
  equipmentTotals: Record<string, number>;
  equipmentHistory: EquipmentChangeRecord[];
  personnelTotals: Record<string, number>;
  personnelHistory: PersonnelChangeRecord[];
}

export const DEFAULT_EQUIPMENT = 'HARD';
export const DEFAULT_PERSONNEL = 'Piloto 1';

export const STANDARD_EQUIPMENT_OPTIONS = [
  { id: 'HARD', name: 'Duro (HARD)', color: '#ffffff', textColor: '#000000' },
  { id: 'MEDIUM', name: 'Medio (MEDIUM)', color: '#eab308', textColor: '#000000' },
  { id: 'SOFT', name: 'Blando (SOFT)', color: '#ef4444', textColor: '#ffffff' },
  { id: 'WET', name: 'Lluvia (WET)', color: '#3b82f6', textColor: '#ffffff' }
];

/**
 * Calcula de manera pura y autoritativa la estrategia neutral de una escudería.
 * Determinista a partir de los eventos de carrera y las vueltas válidas.
 */
export function computeTeamStrategy(
  teamId: string,
  validTeamLaps: LapRecord[],
  teamRaceEvents: RaceEventData[],
  now: number = Date.now()
): TeamStrategyState {
  // Ordenar vueltas válidas por timestamp de servidor
  const sortedLaps = [...validTeamLaps].sort((a, b) => a.serverTimestamp - b.serverTimestamp);
  
  // Ordenar eventos de carrera por timestamp de servidor
  const sortedEvents = [...teamRaceEvents]
    .filter((e) => !e.invalidated)
    .sort((a, b) => a.serverTimestamp - b.serverTimestamp);

  // 1. Análisis de Boxes (Pit In / Pit Out)
  const pitStops: PitStopRecord[] = [];
  let currentOpenPitIn: { id: string; timestamp: number; lapNumber: number } | null = null;

  for (const ev of sortedEvents) {
    if (ev.type === 'PIT_IN') {
      const lapsBeforeEvent =
        ev.payload?.lapNumber !== undefined
          ? Number(ev.payload.lapNumber)
          : sortedLaps.filter((l) => l.serverTimestamp <= ev.serverTimestamp).length;
      currentOpenPitIn = {
        id: ev.id,
        timestamp: ev.serverTimestamp,
        lapNumber: lapsBeforeEvent
      };
    } else if (ev.type === 'PIT_OUT') {
      const lapsBeforeEvent =
        ev.payload?.lapNumber !== undefined
          ? Number(ev.payload.lapNumber)
          : sortedLaps.filter((l) => l.serverTimestamp <= ev.serverTimestamp).length;
      if (currentOpenPitIn) {
        const duration =
          ev.payload?.durationMs !== undefined
            ? Number(ev.payload.durationMs)
            : Math.max(0, ev.serverTimestamp - currentOpenPitIn.timestamp);
        pitStops.push({
          id: currentOpenPitIn.id,
          pitInTimestamp: currentOpenPitIn.timestamp,
          pitOutTimestamp: ev.serverTimestamp,
          durationMs: duration,
          lapNumber: currentOpenPitIn.lapNumber
        });
        currentOpenPitIn = null;
      } else {
        // Salida sin entrada previa registrada
        const duration = ev.payload?.durationMs !== undefined ? Number(ev.payload.durationMs) : 0;
        pitStops.push({
          id: ev.id,
          pitInTimestamp: ev.serverTimestamp,
          pitOutTimestamp: ev.serverTimestamp,
          durationMs: duration,
          lapNumber: lapsBeforeEvent
        });
      }
    }
  }

  const isCurrentlyInPit = currentOpenPitIn !== null;
  const currentPitInTimestamp = currentOpenPitIn ? currentOpenPitIn.timestamp : undefined;
  const currentPitDurationMs = currentOpenPitIn ? Math.max(0, now - currentOpenPitIn.timestamp) : undefined;

  if (currentOpenPitIn) {
    pitStops.push({
      id: currentOpenPitIn.id,
      pitInTimestamp: currentOpenPitIn.timestamp,
      lapNumber: currentOpenPitIn.lapNumber
    });
  }

  const completedStops = pitStops.filter((p) => p.durationMs !== undefined);
  const lastPitDurationMs = completedStops.length > 0 ? completedStops[completedStops.length - 1].durationMs : undefined;

  // 2. Análisis de Equipamiento / Compuestos (Neumáticos)
  const equipmentEvents = sortedEvents.filter((e) => e.type === 'EQUIPMENT_CHANGED');
  const equipmentHistory: EquipmentChangeRecord[] = [];
  
  let currentEquipment = DEFAULT_EQUIPMENT;
  for (const ev of equipmentEvents) {
    const newEq = (ev.payload.newEquipment || ev.payload.equipment || DEFAULT_EQUIPMENT) as string;
    const prevEq = (ev.payload.previousEquipment || currentEquipment) as string;
    const lapsBefore =
      ev.payload.lapNumber !== undefined
        ? Number(ev.payload.lapNumber)
        : sortedLaps.filter((l) => l.serverTimestamp <= ev.serverTimestamp).length;
    
    equipmentHistory.push({
      id: ev.id,
      equipment: newEq,
      previousEquipment: prevEq,
      lapNumber: lapsBefore,
      serverTimestamp: ev.serverTimestamp,
      actor: ev.actor,
      reason: ev.payload.reason as string | undefined
    });
    currentEquipment = newEq;
  }

  // Totales de vueltas por compuesto
  const equipmentTotals: Record<string, number> = {};
  for (const lap of sortedLaps) {
    // Buscar el compuesto activo en el momento en que se registró la vuelta
    const activeChange = [...equipmentHistory]
      .reverse()
      .find((h) => h.serverTimestamp <= lap.serverTimestamp);
    const eq = activeChange ? activeChange.equipment : DEFAULT_EQUIPMENT;
    equipmentTotals[eq] = (equipmentTotals[eq] || 0) + 1;
  }

  // Vueltas del stint actual con el compuesto actual
  let equipmentStintLaps = 0;
  if (equipmentHistory.length > 0) {
    const lastEqChange = equipmentHistory[equipmentHistory.length - 1];
    equipmentStintLaps = sortedLaps.filter((l) => l.serverTimestamp >= lastEqChange.serverTimestamp).length;
  } else {
    equipmentStintLaps = sortedLaps.length;
  }

  // 3. Análisis de Personal / Pilotos (Tripulación)
  const personnelEvents = sortedEvents.filter((e) => e.type === 'PERSONNEL_CHANGED');
  const personnelHistory: PersonnelChangeRecord[] = [];

  let currentPersonnel = DEFAULT_PERSONNEL;
  for (const ev of personnelEvents) {
    const newP = (ev.payload.newPersonnel || ev.payload.personnel || DEFAULT_PERSONNEL) as string;
    const prevP = (ev.payload.previousPersonnel || currentPersonnel) as string;
    const lapsBefore =
      ev.payload.lapNumber !== undefined
        ? Number(ev.payload.lapNumber)
        : sortedLaps.filter((l) => l.serverTimestamp <= ev.serverTimestamp).length;

    personnelHistory.push({
      id: ev.id,
      personnel: newP,
      previousPersonnel: prevP,
      lapNumber: lapsBefore,
      serverTimestamp: ev.serverTimestamp,
      actor: ev.actor,
      reason: ev.payload.reason as string | undefined
    });
    currentPersonnel = newP;
  }

  // Totales de vueltas por piloto / personal
  const personnelTotals: Record<string, number> = {};
  for (const lap of sortedLaps) {
    // Buscar el piloto activo en el momento en que se registró la vuelta
    const activeChange = [...personnelHistory]
      .reverse()
      .find((h) => h.serverTimestamp <= lap.serverTimestamp);
    const p = activeChange ? activeChange.personnel : DEFAULT_PERSONNEL;
    personnelTotals[p] = (personnelTotals[p] || 0) + 1;
  }

  // Vueltas del relevo actual
  let personnelStintLaps = 0;
  if (personnelHistory.length > 0) {
    const lastPChange = personnelHistory[personnelHistory.length - 1];
    personnelStintLaps = sortedLaps.filter((l) => l.serverTimestamp >= lastPChange.serverTimestamp).length;
  } else {
    personnelStintLaps = sortedLaps.length;
  }

  return {
    teamId,
    pitState: isCurrentlyInPit ? 'IN_PIT' : 'ON_TRACK',
    pitStopCount: pitStops.length,
    currentPitInTimestamp,
    currentPitDurationMs,
    lastPitDurationMs,
    pitStops,
    currentEquipment,
    equipmentStintLaps,
    equipmentTotals,
    equipmentHistory,
    currentPersonnel,
    personnelStintLaps,
    personnelTotals,
    personnelHistory
  };
}

/**
 * Calcula el estado de estrategia para todas las escuderías participantes en una sesión.
 */
export function computeAllTeamsStrategy(
  participatingTeamIds: string[],
  validLaps: LapRecord[],
  raceEvents: RaceEventData[],
  now: number = Date.now()
): Record<string, TeamStrategyState> {
  const result: Record<string, TeamStrategyState> = {};
  for (const teamId of participatingTeamIds) {
    const teamLaps = validLaps.filter((l) => l.teamId === teamId);
    const teamEvents = raceEvents.filter((e) => e.teamId === teamId);
    result[teamId] = computeTeamStrategy(teamId, teamLaps, teamEvents, now);
  }
  return result;
}
