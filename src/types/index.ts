export type ConnectionStatus = 'ONLINE' | 'RECONNECTING' | 'OFFLINE';

export interface EventModel {
  id: string;
  name: string;
  edition?: string;
  configuredBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamModel {
  id: string;
  eventId: string;
  name: string;
  shortName?: string;
  color: string;
  number?: number;
  kartName?: string;
  token: string;
  pilots?: string[];
  createdAt: string;
  updatedAt: string;
}

export type SessionType = 'qualifying' | 'race' | 'generic';
export type SessionStatus = 'SCHEDULED' | 'RUNNING' | 'TIMING_CLOSED' | 'OFFICIAL';

export interface SessionModel {
  id: string;
  eventId: string;
  name: string;
  type: SessionType;
  targetLaps?: number;
  participatingTeamIds: string[];
  status: SessionStatus;
  startedAt?: number;
  closedAt?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LapRecordModel {
  id: string;
  sessionId: string;
  teamId: string;
  lapNumber: number;
  serverTimestamp: number;
  lapTimeMs: number;
  isValid: boolean;
  recordedBy: string;
  clientIntentId?: string;
  invalidatedAt?: number;
  invalidationReason?: string;
  invalidatedBy?: string;
  restoredAt?: number;
  restoreReason?: string;
  restoredBy?: string;
}

export interface RaceAuditRecord {
  id: string;
  sessionId: string;
  teamId?: string;
  type: string;
  serverTimestamp: number;
  payload: Record<string, unknown>;
  actor: string;
  invalidated?: boolean;
  invalidationReason?: string;
}

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

export interface LeaderboardEntry {
  position: number;
  teamId: string;
  lapCount: number;
  lastLapMs?: number;
  bestLapMs?: number;
  lastTimestampMs?: number;
  gapMs?: number;
  lapsBehind?: number;
  isFastestLap?: boolean;
  strategy?: TeamStrategySummary;
  isDisqualified?: boolean;
  totalPenaltyMs?: number;
  stewarding?: TeamStewardingState;
}

export interface TimingOverview {
  sessionId: string;
  sessionStatus: SessionStatus;
  startedAt?: number;
  closedAt?: number;
  fastestLapTeamId?: string;
  fastestLapMs?: number;
  totalLapsRecorded: number;
  leaderboard: LeaderboardEntry[];
  teamsStrategy?: Record<string, TeamStrategyState>;
  teamsStewarding?: Record<string, TeamStewardingState>;
  revision: number;
  lastUpdated: string;
}

export interface EventStateResponse {
  ok: boolean;
  configured: boolean;
  event: EventModel | null;
  teams: TeamModel[];
  sessions: SessionModel[];
  isStale?: boolean;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded';
  message: string;
  language: string;
  timestamp: string;
  uptimeSeconds: number;
  persistence: {
    ok: boolean;
    type: string;
    reachable: boolean;
    path?: string;
    hasProductionSeedData: boolean;
    checkedAt: string;
    details?: {
      hasEvent: boolean;
      teamsCount: number;
      sessionsCount: number;
      eventsCount: number;
      error?: string;
    };
  };
  hasConfiguredEvent: boolean;
  hasProductionSeedData: boolean;
}

export interface AppSurface {
  id: string;
  path: string;
  label: string;
  role: string;
}

export type ClientRole = 'race-control' | 'team-operator' | 'display' | 'broadcast' | 'admin';

export interface ActiveClientSession {
  sessionId: string;
  role: ClientRole;
  teamId?: string;
  teamName?: string;
  deviceInfo: string;
  lastSeenSecondsAgo: number;
  status: 'ONLINE' | 'RECONNECTING' | 'OFFLINE';
}

export interface PresenceOverview {
  totalConnected: number;
  activeSessions: ActiveClientSession[];
  teamsConnectivity: Record<string, {
    connectedCount: number;
    devices: string[];
    isOnline: boolean;
  }>;
}

export interface TeamAccessResponse {
  ok: boolean;
  message: string;
  team?: TeamModel;
  event?: EventModel | null;
  sessions?: SessionModel[];
  error?: {
    code: string;
    message: string;
  };
}
