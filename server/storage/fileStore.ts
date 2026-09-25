import fs from 'fs/promises';
import path from 'path';
import {
  PersistenceStore,
  StorageHealthResult,
  EventData,
  TeamData,
  SessionData,
  RaceEventData,
  LapRecord,
  PenaltyData,
  DirectiveData,
  TeamSessionStateData
} from './types.js';

interface DatabaseSchema {
  version: number;
  event: EventData | null;
  teams: TeamData[];
  sessions: SessionData[];
  laps: LapRecord[];
  raceEvents: RaceEventData[];
  penalties: PenaltyData[];
  directives: DirectiveData[];
  teamSessionStates: TeamSessionStateData[];
  updatedAt: string;
}

export class FileDurableStore implements PersistenceStore {
  readonly type = 'file-durable';
  private dataFilePath: string;
  private isInitialized = false;
  private data: DatabaseSchema = {
    version: 1,
    event: null,
    teams: [],
    sessions: [],
    laps: [],
    raceEvents: [],
    penalties: [],
    directives: [],
    teamSessionStates: [],
    updatedAt: new Date().toISOString()
  };

  constructor(private storageDir: string) {
    this.dataFilePath = path.join(this.storageDir, 'pitwall_store.json');
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    await fs.mkdir(this.storageDir, { recursive: true });

    try {
      const content = await fs.readFile(this.dataFilePath, 'utf-8');
      const parsed = JSON.parse(content) as DatabaseSchema;
      if (parsed && typeof parsed === 'object') {
        this.data = {
          version: parsed.version || 1,
          event: parsed.event || null,
          teams: Array.isArray(parsed.teams) ? parsed.teams : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          laps: Array.isArray(parsed.laps) ? parsed.laps : [],
          raceEvents: Array.isArray(parsed.raceEvents) ? parsed.raceEvents : [],
          penalties: Array.isArray(parsed.penalties) ? parsed.penalties : [],
          directives: Array.isArray(parsed.directives) ? parsed.directives : [],
          teamSessionStates: Array.isArray(parsed.teamSessionStates) ? parsed.teamSessionStates : [],
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
      }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'ENOENT') {
        // Archivo no existe todavía: inicializamos estado completamente vacío (SIN datos semilla)
        this.data = {
          version: 1,
          event: null,
          teams: [],
          sessions: [],
          laps: [],
          raceEvents: [],
          penalties: [],
          directives: [],
          teamSessionStates: [],
          updatedAt: new Date().toISOString()
        };
        await this.persist();
      } else {
        throw new Error(`Fallo al leer la persistencia duradera: ${error.message}`);
      }
    }

    this.isInitialized = true;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true });
    this.data.updatedAt = new Date().toISOString();
    const tempFile = `${this.dataFilePath}.tmp.${Date.now()}`;
    const payload = JSON.stringify(this.data, null, 2);
    await fs.writeFile(tempFile, payload, 'utf-8');
    await fs.rename(tempFile, this.dataFilePath);
  }

  async checkHealth(): Promise<StorageHealthResult> {
    const checkedAt = new Date().toISOString();
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const probePath = path.join(this.storageDir, `.health_probe_${Date.now()}.tmp`);
      await fs.writeFile(probePath, 'probe', 'utf-8');
      const probeRead = await fs.readFile(probePath, 'utf-8');
      await fs.unlink(probePath);

      if (probeRead !== 'probe') {
        return {
          ok: false,
          type: this.type,
          reachable: false,
          path: this.dataFilePath,
          hasProductionSeedData: false,
          checkedAt,
          details: { error: 'Fallo en la prueba de integridad de lectura/escritura' }
        };
      }

      // Verificar si existen datos semilla de carrera (debe ser false para M0)
      const hasProductionSeedData = Boolean(
        (this.data.event && (this.data.event.name.toLowerCase().includes('demo') || this.data.event.name.toLowerCase().includes('sample'))) ||
        this.data.teams.some(t => t.name.toLowerCase().includes('demo') || t.name.toLowerCase().includes('ejemplo')) ||
        this.data.sessions.some(s => s.name.toLowerCase().includes('demo'))
      );

      return {
        ok: true,
        type: this.type,
        reachable: true,
        path: this.dataFilePath,
        hasProductionSeedData,
        checkedAt,
        details: {
          hasEvent: Boolean(this.data.event),
          teamsCount: this.data.teams.length,
          sessionsCount: this.data.sessions.length,
          eventsCount: this.data.raceEvents.length
        }
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        ok: false,
        type: this.type,
        reachable: false,
        path: this.dataFilePath,
        hasProductionSeedData: false,
        checkedAt,
        details: { error: error.message }
      };
    }
  }

  async getEvent(): Promise<EventData | null> {
    await this.init();
    return this.data.event;
  }

  async saveEvent(event: EventData): Promise<void> {
    await this.init();
    this.data.event = event;
    await this.persist();
  }

  async getTeams(eventId: string): Promise<TeamData[]> {
    await this.init();
    return this.data.teams.filter(t => t.eventId === eventId);
  }

  async getTeamByToken(token: string): Promise<TeamData | null> {
    await this.init();
    if (!token) return null;
    return this.data.teams.find(t => t.token === token) || null;
  }

  async saveTeam(team: TeamData): Promise<void> {
    await this.init();
    const idx = this.data.teams.findIndex(t => t.id === team.id);
    if (idx >= 0) {
      this.data.teams[idx] = team;
    } else {
      this.data.teams.push(team);
    }
    await this.persist();
  }

  async regenerateTeamToken(teamId: string, newToken: string): Promise<TeamData | null> {
    await this.init();
    const team = this.data.teams.find(t => t.id === teamId);
    if (!team) return null;
    team.token = newToken;
    team.updatedAt = new Date().toISOString();
    await this.persist();
    return team;
  }

  async deleteTeam(teamId: string): Promise<void> {
    await this.init();
    this.data.teams = this.data.teams.filter(t => t.id !== teamId);
    // Remover también al equipo de las sesiones configuradas para mantener integridad
    this.data.sessions = this.data.sessions.map(s => ({
      ...s,
      participatingTeamIds: s.participatingTeamIds.filter(id => id !== teamId)
    }));
    await this.persist();
  }

  async getSessions(eventId: string): Promise<SessionData[]> {
    await this.init();
    return this.data.sessions.filter(s => s.eventId === eventId);
  }

  async saveSession(session: SessionData): Promise<void> {
    await this.init();
    const idx = this.data.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      this.data.sessions[idx] = session;
    } else {
      this.data.sessions.push(session);
    }
    await this.persist();
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.init();
    this.data.sessions = this.data.sessions.filter(s => s.id !== sessionId);
    this.data.laps = this.data.laps.filter(l => l.sessionId !== sessionId);
    this.data.raceEvents = this.data.raceEvents.filter(e => e.sessionId !== sessionId);
    await this.persist();
  }

  async getLaps(sessionId: string): Promise<LapRecord[]> {
    await this.init();
    return this.data.laps.filter(l => l.sessionId === sessionId);
  }

  async saveLap(lap: LapRecord): Promise<void> {
    await this.init();
    const idx = this.data.laps.findIndex(l => l.id === lap.id);
    if (idx >= 0) {
      this.data.laps[idx] = lap;
    } else {
      this.data.laps.push(lap);
    }
    await this.persist();
  }

  async updateLap(lap: LapRecord): Promise<void> {
    await this.init();
    const idx = this.data.laps.findIndex(l => l.id === lap.id);
    if (idx >= 0) {
      this.data.laps[idx] = lap;
      await this.persist();
    }
  }

  async getRaceEvents(sessionId: string): Promise<RaceEventData[]> {
    await this.init();
    return this.data.raceEvents.filter(e => e.sessionId === sessionId);
  }

  async appendRaceEvent(event: RaceEventData): Promise<void> {
    await this.init();
    this.data.raceEvents.push(event);
    await this.persist();
  }

  async getPenalties(sessionId: string): Promise<PenaltyData[]> {
    await this.init();
    return this.data.penalties.filter(p => p.sessionId === sessionId);
  }

  async savePenalty(penalty: PenaltyData): Promise<void> {
    await this.init();
    const idx = this.data.penalties.findIndex(p => p.id === penalty.id);
    if (idx >= 0) {
      this.data.penalties[idx] = penalty;
    } else {
      this.data.penalties.push(penalty);
    }
    await this.persist();
  }

  async getDirectives(sessionId: string): Promise<DirectiveData[]> {
    await this.init();
    return this.data.directives.filter(d => d.sessionId === sessionId);
  }

  async saveDirective(directive: DirectiveData): Promise<void> {
    await this.init();
    const idx = this.data.directives.findIndex(d => d.id === directive.id);
    if (idx >= 0) {
      this.data.directives[idx] = directive;
    } else {
      this.data.directives.push(directive);
    }
    await this.persist();
  }

  async getTeamSessionStates(sessionId: string): Promise<TeamSessionStateData[]> {
    await this.init();
    return this.data.teamSessionStates.filter(s => s.sessionId === sessionId);
  }

  async saveTeamSessionState(state: TeamSessionStateData): Promise<void> {
    await this.init();
    const idx = this.data.teamSessionStates.findIndex(s => s.id === state.id || (s.sessionId === state.sessionId && s.teamId === state.teamId));
    if (idx >= 0) {
      this.data.teamSessionStates[idx] = state;
    } else {
      this.data.teamSessionStates.push(state);
    }
    await this.persist();
  }

  async clearAll(confirmKey: string): Promise<void> {
    if (confirmKey !== 'RESET_PITWALL_CONFIRM') {
      throw new Error('Clave de confirmación incorrecta para reinicio');
    }
    await this.init();
    this.data = {
      version: 1,
      event: null,
      teams: [],
      sessions: [],
      laps: [],
      raceEvents: [],
      penalties: [],
      directives: [],
      teamSessionStates: [],
      updatedAt: new Date().toISOString()
    };
    await this.persist();
  }
}
