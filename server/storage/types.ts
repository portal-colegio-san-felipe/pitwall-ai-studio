export interface StorageHealthResult {
  ok: boolean;
  type: string;
  reachable: boolean;
  path?: string;
  hasProductionSeedData: boolean;
  checkedAt: string;
  details?: Record<string, unknown>;
}

export interface EventData {
  id: string;
  name: string;
  edition?: string;
  createdAt: string;
  updatedAt: string;
  configuredBy?: string;
}

export interface TeamData {
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

export interface SessionData {
  id: string;
  eventId: string;
  name: string;
  type: 'qualifying' | 'race' | 'generic';
  targetLaps?: number;
  participatingTeamIds: string[];
  status: 'SCHEDULED' | 'RUNNING' | 'TIMING_CLOSED' | 'OFFICIAL';
  startedAt?: number;
  closedAt?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LapRecord {
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

export interface RaceEventData {
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

export type PenaltyType = 'WARNING' | 'TIME_PENALTY';

export interface PenaltyData {
  id: string;
  sessionId: string;
  teamId: string;
  type: PenaltyType;
  seconds?: number;
  reason: string;
  issuedAt: number;
  issuedBy: string;
}

export type DirectiveType = 'PIT_REQUIRED' | 'GENERAL_DIRECTIVE';
export type DirectiveStatus = 'PENDING' | 'SERVED' | 'CANCELLED';

export interface DirectiveData {
  id: string;
  sessionId: string;
  teamId: string;
  type: DirectiveType;
  description: string;
  status: DirectiveStatus;
  issuedAt: number;
  issuedBy: string;
  updatedAt: number;
  resolvedAt?: number;
  resolutionReason?: string;
  resolvedBy?: string;
}

export type TeamSessionCompetitiveStatus = 'ACTIVE' | 'DISQUALIFIED' | 'RETIRED' | 'FINISHED';

export interface TeamSessionStateData {
  id: string;
  sessionId: string;
  teamId: string;
  status: TeamSessionCompetitiveStatus;
  disqualificationReason?: string;
  disqualifiedAt?: number;
  disqualifiedBy?: string;
  reversalReason?: string;
  reversedAt?: number;
  reversedBy?: string;
  updatedAt: number;
}

export interface PersistenceStore {
  readonly type: string;
  init(): Promise<void>;
  checkHealth(): Promise<StorageHealthResult>;
  getEvent(): Promise<EventData | null>;
  saveEvent(event: EventData): Promise<void>;
  getTeams(eventId: string): Promise<TeamData[]>;
  getTeamByToken(token: string): Promise<TeamData | null>;
  saveTeam(team: TeamData): Promise<void>;
  regenerateTeamToken(teamId: string, newToken: string): Promise<TeamData | null>;
  deleteTeam(teamId: string): Promise<void>;
  getSessions(eventId: string): Promise<SessionData[]>;
  saveSession(session: SessionData): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  getLaps(sessionId: string): Promise<LapRecord[]>;
  saveLap(lap: LapRecord): Promise<void>;
  updateLap(lap: LapRecord): Promise<void>;
  getRaceEvents(sessionId: string): Promise<RaceEventData[]>;
  appendRaceEvent(event: RaceEventData): Promise<void>;
  getPenalties(sessionId: string): Promise<PenaltyData[]>;
  savePenalty(penalty: PenaltyData): Promise<void>;
  getDirectives(sessionId: string): Promise<DirectiveData[]>;
  saveDirective(directive: DirectiveData): Promise<void>;
  getTeamSessionStates(sessionId: string): Promise<TeamSessionStateData[]>;
  saveTeamSessionState(state: TeamSessionStateData): Promise<void>;
  clearAll(confirmKey: string): Promise<void>;
}
