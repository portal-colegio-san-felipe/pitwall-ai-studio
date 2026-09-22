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
  clearAll(confirmKey: string): Promise<void>;
}
