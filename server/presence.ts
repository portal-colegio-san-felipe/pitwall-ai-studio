export type ClientRole = 'race-control' | 'team-operator' | 'display' | 'broadcast' | 'admin';

export interface ClientDeviceSession {
  sessionId: string;
  role: ClientRole;
  teamId?: string;
  teamName?: string;
  deviceInfo: string;
  ip: string;
  connectedAt: string;
  lastSeen: number;
  isKicked: boolean;
}

export interface PresenceOverview {
  totalConnected: number;
  activeSessions: Array<{
    sessionId: string;
    role: ClientRole;
    teamId?: string;
    teamName?: string;
    deviceInfo: string;
    lastSeenSecondsAgo: number;
    status: 'ONLINE' | 'RECONNECTING' | 'OFFLINE';
  }>;
  teamsConnectivity: Record<string, {
    connectedCount: number;
    devices: string[];
    isOnline: boolean;
  }>;
}

class PresenceManager {
  private sessions = new Map<string, ClientDeviceSession>();
  private readonly HEARTBEAT_TIMEOUT_MS = 25000; // 25s sin respuesta = offline
  private readonly PURGE_TIMEOUT_MS = 60000; // 60s = purgar

  registerHeartbeat(
    sessionId: string,
    role: ClientRole,
    deviceInfo: string,
    ip: string,
    teamId?: string,
    teamName?: string
  ): { ok: boolean; kicked: boolean; message?: string } {
    const existing = this.sessions.get(sessionId);

    if (existing && existing.isKicked) {
      return {
        ok: false,
        kicked: true,
        message: 'Esta sesión de dispositivo ha sido desconectada por Dirección de Carrera.'
      };
    }

    const now = Date.now();
    this.sessions.set(sessionId, {
      sessionId,
      role,
      teamId,
      teamName: teamName || existing?.teamName,
      deviceInfo: deviceInfo || existing?.deviceInfo || 'Dispositivo desconocido',
      ip,
      connectedAt: existing?.connectedAt || new Date().toISOString(),
      lastSeen: now,
      isKicked: false
    });

    return { ok: true, kicked: false };
  }

  kickSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.isKicked = true;
    return true;
  }

  leaveSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  getOverview(teamsList: Array<{ id: string; name: string }>): PresenceOverview {
    const now = Date.now();
    const activeSessions: PresenceOverview['activeSessions'] = [];
    const teamsConnectivity: PresenceOverview['teamsConnectivity'] = {};

    // Inicializar para todos los equipos registrados
    for (const team of teamsList) {
      teamsConnectivity[team.id] = {
        connectedCount: 0,
        devices: [],
        isOnline: false
      };
    }

    for (const [id, session] of this.sessions.entries()) {
      const elapsed = now - session.lastSeen;

      // Purgar sesiones muy viejas (>60s) o expulsadas
      if (elapsed > this.PURGE_TIMEOUT_MS) {
        this.sessions.delete(id);
        continue;
      }

      if (session.isKicked) {
        continue;
      }

      let status: 'ONLINE' | 'RECONNECTING' | 'OFFLINE' = 'ONLINE';
      if (elapsed > this.HEARTBEAT_TIMEOUT_MS) {
        status = 'OFFLINE';
      } else if (elapsed > 10000) {
        status = 'RECONNECTING';
      }

      activeSessions.push({
        sessionId: session.sessionId,
        role: session.role,
        teamId: session.teamId,
        teamName: session.teamName,
        deviceInfo: session.deviceInfo,
        lastSeenSecondsAgo: Math.round(elapsed / 1000),
        status
      });

      // Si pertenece a una escudería y está activa
      if (session.teamId && status !== 'OFFLINE') {
        if (!teamsConnectivity[session.teamId]) {
          teamsConnectivity[session.teamId] = {
            connectedCount: 0,
            devices: [],
            isOnline: true
          };
        }
        teamsConnectivity[session.teamId].connectedCount += 1;
        teamsConnectivity[session.teamId].devices.push(session.deviceInfo);
        teamsConnectivity[session.teamId].isOnline = true;
      }
    }

    return {
      totalConnected: activeSessions.filter(s => s.status !== 'OFFLINE').length,
      activeSessions,
      teamsConnectivity
    };
  }

  reset(): void {
    this.sessions.clear();
  }
}

export const presenceManager = new PresenceManager();
