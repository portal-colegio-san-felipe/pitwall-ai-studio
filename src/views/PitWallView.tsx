import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  Clock,
  AlertTriangle,
  Key,
  RefreshCw,
  Smartphone,
  CheckCircle,
  ShieldAlert,
  Flag,
  Lock,
  Wrench,
  Disc,
  User,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { TeamModel, EventModel, SessionModel, LapRecordModel } from '../types';
import { usePresence } from '../hooks/usePresence';
import { useRealtimeTiming } from '../hooks/useRealtimeTiming';
import { StrategyChangeModal } from '../components/StrategyChangeModal';
import { SessionTimerBadge } from '../components/SessionTimerBadge';

interface Props {
  initialToken?: string;
  availableTeams?: TeamModel[];
  onNavigate?: (path: string) => void;
}

export const PitWallView: React.FC<Props> = ({ initialToken, availableTeams = [], onNavigate }) => {
  const [tokenInput, setTokenInput] = useState<string>(initialToken || '');
  const [team, setTeam] = useState<TeamModel | null>(null);
  const [event, setEvent] = useState<EventModel | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Estados de cronometraje (M3 / M4)
  const [activeSession, setActiveSession] = useState<SessionModel | null>(null);
  const [lapCount, setLapCount] = useState<number>(0);
  const [lastLapMs, setLastLapMs] = useState<number | undefined>(undefined);
  const [bestLapMs, setBestLapMs] = useState<number | undefined>(undefined);
  const [position, setPosition] = useState<number | undefined>(undefined);
  const [gapMs, setGapMs] = useState<number | undefined>(undefined);
  const [isSubmittingLap, setIsSubmittingLap] = useState<boolean>(false);
  const [lapFeedback, setLapFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [teamLaps, setTeamLaps] = useState<LapRecordModel[]>([]);

  // Estados de estrategia neutral (M6)
  const [isStrategyActionLoading, setIsStrategyActionLoading] = useState<boolean>(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState<boolean>(false);
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState<boolean>(false);
  const [pitElapsedSeconds, setPitElapsedSeconds] = useState<number>(0);

  // Hook de presencia para el operador de equipo
  const { sessionId, status: presenceStatus, isKicked, kickMessage, reconnect } = usePresence({
    role: 'team-operator',
    teamId: team?.id,
    teamName: team?.name,
    enabled: !!team
  });

  // Hook de proyección de tiempos en tiempo real (M4)
  const { timing, isLive: timingLive, refresh: refreshTiming } = useRealtimeTiming(activeSession?.id);

  // Sincronizar estadísticas cuando llegue actualización en tiempo real
  useEffect(() => {
    if (!timing || !team) return;
    const entry = timing.leaderboard.find((l) => l.teamId === team.id);
    if (entry) {
      setLapCount(entry.lapCount);
      setLastLapMs(entry.lastLapMs);
      setBestLapMs(entry.bestLapMs);
      setPosition(entry.position);
      setGapMs(entry.gapMs);
    }

    // Sincronizar inmediatamente el estado de la sesión para reactivar el botón sin recargar página
    if (timing.sessionStatus) {
      setActiveSession((prev) => {
        if (!prev) {
          return {
            id: timing.sessionId,
            eventId: '',
            name: 'Manga Activa',
            type: 'race',
            participatingTeamIds: [team.id],
            status: timing.sessionStatus as SessionModel['status'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
        if (prev.status !== timing.sessionStatus) {
          return { ...prev, status: timing.sessionStatus as SessionModel['status'] };
        }
        return prev;
      });
    }
  }, [timing, team]);

  const teamStrategy = team ? timing?.teamsStrategy?.[team.id] : undefined;
  const isInPit = teamStrategy?.pitState === 'IN_PIT';

  // Cronómetro en vivo de estancia en boxes (M6)
  useEffect(() => {
    if (!isInPit || !teamStrategy?.currentPitInTimestamp) {
      setPitElapsedSeconds(0);
      return;
    }
    const updateTimer = () => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - (teamStrategy.currentPitInTimestamp || Date.now())) / 1000)
      );
      setPitElapsedSeconds(elapsed);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isInPit, teamStrategy?.currentPitInTimestamp]);

  const handlePitIn = async () => {
    if (!team || !activeSession || isStrategyActionLoading) return;
    setIsStrategyActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/strategy/pit-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${team.token}`
        },
        body: JSON.stringify({ teamId: team.id })
      });
      if (res.ok) {
        await refreshTiming();
      }
    } finally {
      setIsStrategyActionLoading(false);
    }
  };

  const handlePitOut = async () => {
    if (!team || !activeSession || isStrategyActionLoading) return;
    setIsStrategyActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/strategy/pit-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${team.token}`
        },
        body: JSON.stringify({ teamId: team.id })
      });
      if (res.ok) {
        await refreshTiming();
      }
    } finally {
      setIsStrategyActionLoading(false);
    }
  };

  const handleSubmitEquipment = async (newEquipment: string, reason?: string) => {
    if (!team || !activeSession) return;
    setIsStrategyActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/strategy/equipment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${team.token}`
        },
        body: JSON.stringify({ teamId: team.id, equipment: newEquipment, reason })
      });
      if (res.ok) {
        setIsEquipmentModalOpen(false);
        await refreshTiming();
      }
    } finally {
      setIsStrategyActionLoading(false);
    }
  };

  const handleSubmitPersonnel = async (newPersonnel: string, reason?: string) => {
    if (!team || !activeSession) return;
    setIsStrategyActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/strategy/personnel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${team.token}`
        },
        body: JSON.stringify({ teamId: team.id, personnel: newPersonnel, reason })
      });
      if (res.ok) {
        setIsPersonnelModalOpen(false);
        await refreshTiming();
      }
    } finally {
      setIsStrategyActionLoading(false);
    }
  };

  const fetchTeamLaps = useCallback(async () => {
    if (!activeSession || !team) return;
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/laps`);
      if (res.ok) {
        const data = await res.json();
        const allLaps: LapRecordModel[] = data.laps || [];
        setTeamLaps(allLaps.filter((l) => l.teamId === team.id));
      }
    } catch {
      // Silently catch network interruption
    }
  }, [activeSession, team]);

  useEffect(() => {
    fetchTeamLaps();
  }, [fetchTeamLaps, timing]);

  const validateToken = useCallback(async (tokenToVerify: string) => {
    if (!tokenToVerify || tokenToVerify.trim().length === 0) {
      setAuthError('Por favor ingrese un token de escudería válido.');
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      const res = await fetch(`/api/teams/access/${encodeURIComponent(tokenToVerify.trim())}`);
      const data = await res.json();

      if (res.ok && data.ok) {
        setTeam(data.team);
        setEvent(data.event);
        const sessions: SessionModel[] = data.sessions || [];

        // Buscar si hay una sesión activa en curso
        const running = sessions.find((s) => s.status === 'RUNNING') || sessions[0] || null;
        setActiveSession(running);

        // Guardar token en sessionStorage
        sessionStorage.setItem('pw_team_token', tokenToVerify.trim());
      } else {
        setAuthError(data.error?.message || 'Token no reconocido o revocado.');
        setTeam(null);
      }
    } catch {
      setAuthError('Error de comunicación con el servidor al verificar el token.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Sondeo reactivo de mangas: verificar periódicamente para mantener el estado de la manga sincronizado
  // tanto al iniciar como al cerrar cronometraje por Dirección de Carrera (sin requerir recarga)
  const isSessionRunning = (timing?.sessionStatus || activeSession?.status) === 'RUNNING';

  useEffect(() => {
    if (!team) return;

    const syncSessions = async () => {
      try {
        const res = await fetch(`/api/teams/access/${encodeURIComponent(team.token)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && Array.isArray(data.sessions)) {
          const sessions: SessionModel[] = data.sessions;
          const running = sessions.find((s) => s.status === 'RUNNING');
          if (running) {
            setActiveSession(running);
          } else if (activeSession) {
            const currentSame = sessions.find((s) => s.id === activeSession.id);
            if (currentSame && currentSame.status !== activeSession.status) {
              setActiveSession(currentSame);
            }
          } else if (sessions.length > 0) {
            setActiveSession(sessions[0]);
          }
        }
      } catch {
        // Silencioso
      }
    };

    const interval = setInterval(syncSessions, 2000);
    return () => clearInterval(interval);
  }, [team, activeSession?.id, activeSession?.status]);

  // Al montar, verificar si hay token en URL o en sessionStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token') || initialToken || sessionStorage.getItem('pw_team_token');

    if (tokenFromUrl) {
      setTokenInput(tokenFromUrl);
      validateToken(tokenFromUrl);
    }
  }, [initialToken, validateToken]);

  // Manejador del botón autoritativo: REGISTRAR VUELTA (Criterio M3)
  const handleRegisterLap = async () => {
    if (!team || !activeSession || isSubmittingLap) return;

    if (effectiveSessionStatus === 'TIMING_CLOSED') {
      setLapFeedback({
        type: 'error',
        message: 'El cronometraje de esta manga está cerrado. Dirección de Carrera ha finalizado la sesión.'
      });
      return;
    }

    setIsSubmittingLap(true);
    setLapFeedback(null);

    try {
      const clientIntentId = crypto.randomUUID();
      const res = await fetch(`/api/sessions/${activeSession.id}/laps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${team.token}`
        },
        body: JSON.stringify({
          teamId: team.id,
          token: team.token,
          clientIntentId
        })
      });

      const data = await res.json();

      if (res.status === 201 && data.ok) {
        setLapCount(data.stats.lapCount);
        setLastLapMs(data.stats.lastLapMs);
        setBestLapMs(data.stats.bestLapMs);
        setLapFeedback({
          type: 'success',
          message: `Vuelta ${data.lap.lapNumber} registrada con éxito (${formatLapTime(data.lap.lapTimeMs)})`
        });
      } else if (res.status === 429) {
        // Protección anti-doble pulsación
        setLapFeedback({
          type: 'warning',
          message: 'Pulsación repetida detectada: el sistema protege contra doble pulsación involuntaria (espere 3.5s).'
        });
      } else {
        setLapFeedback({
          type: 'error',
          message: data.error?.message || 'No se pudo registrar la vuelta en el servidor.'
        });
      }
    } catch {
      setLapFeedback({
        type: 'error',
        message: 'Error de red: no se pudo enviar la intención al servidor autoritativo.'
      });
    } finally {
      setIsSubmittingLap(false);
      // Ocultar feedback automáticamente después de 4 segundos
      setTimeout(() => {
        setLapFeedback((prev) => (prev?.type === 'success' ? null : prev));
      }, 4000);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('pw_team_token');
    setTeam(null);
    setTokenInput('');
    setAuthError(null);
  };

  const formatLapTime = (ms?: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const totalSecs = ms / 1000;
    const minutes = Math.floor(totalSecs / 60);
    const seconds = Math.floor(totalSecs % 60);
    const millis = Math.floor((ms % 1000));
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const isOnline = presenceStatus === 'ONLINE' && !isKicked;
  const effectiveSessionStatus = timing?.sessionStatus || activeSession?.status;

  // Si no está autenticado con un token de equipo, mostrar pantalla de acceso de escudería
  if (!team) {
    return (
      <div className="max-w-md mx-auto space-y-6 py-8 px-4">
        <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mx-auto">
              <Key className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Acceso al Pit Wall de Escudería
            </h1>
            <p className="text-xs text-gray-400">
              Ingrese el enlace o token privado provisto por Dirección de Carrera para ingresar al panel de su equipo.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              validateToken(tokenInput);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-gray-300 uppercase">
                Token de Acceso Único
              </label>
              <input
                id="input-team-token"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Ej. token-a8f4c219..."
                className="w-full bg-[#0a0c10] border border-gray-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder-gray-600 outline-none transition-colors"
              />
            </div>

            <button
              id="btn-submit-team-token"
              type="submit"
              disabled={loading || !tokenInput.trim()}
              className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center space-x-2 shadow-lg"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verificando Token...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Ingresar al Box de Escudería</span>
                </>
              )}
            </button>
          </form>

          {/* Selector rápido para entornos de prueba con equipos registrados */}
          {availableTeams.length > 0 && (
            <div className="border-t border-gray-800/80 pt-4 space-y-2">
              <div className="text-[11px] font-mono text-gray-500 uppercase text-center">
                O seleccione un equipo del evento local:
              </div>
              <div className="grid grid-cols-1 gap-2">
                {availableTeams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTokenInput(t.token);
                      validateToken(t.token);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#0a0c10] border border-gray-800 hover:border-gray-600 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: t.color || '#3b82f6' }}
                      />
                      <span className="text-xs font-bold text-white">{t.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-500">#{t.number || '-'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => onNavigate?.('/manual')}
              className="text-xs text-cyan-400 hover:underline cursor-pointer"
            >
              ¿Cómo obtener el token? Consultar Manual de Operaciones
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vista activa de Pit Wall para el equipo autenticado
  return (
    <div className="max-w-md mx-auto space-y-4 py-4 px-2">
      {/* Aviso de Sesión Expulsada (Kick) */}
      {isKicked && (
        <div className="bg-rose-950/70 border border-rose-600 rounded-xl p-4 space-y-2 text-rose-200">
          <div className="flex items-center space-x-2 font-bold text-xs uppercase">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Dispositivo Desconectado</span>
          </div>
          <p className="text-xs">{kickMessage}</p>
          <button
            onClick={reconnect}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Reconectar Sesión
          </button>
        </div>
      )}

      {/* Barra de Identidad de Escudería y Presencia Móvil */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3 truncate">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm text-white font-mono shadow flex-shrink-0"
            style={{ backgroundColor: team.color || '#3b82f6' }}
          >
            {team.number || team.shortName || 'T'}
          </div>
          <div className="truncate">
            <div className="flex items-center space-x-2">
              <span className="text-base font-black text-white tracking-wide truncate">
                {team.name}
              </span>
              {team.kartName && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                  {team.kartName}
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-gray-400 truncate">
              {activeSession ? `${activeSession.name} (${activeSession.status})` : event?.name || 'Gran Premio'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-right flex-shrink-0 pl-2">
          {/* Reloj visible discreto para Pit Wall (útil para estrategia y contexto) */}
          <SessionTimerBadge
            startedAt={activeSession?.startedAt || timing?.startedAt}
            status={effectiveSessionStatus}
            closedAt={activeSession?.closedAt || timing?.closedAt}
            variant="pit-wall"
          />

          <div>
            <div className="text-[10px] font-mono text-gray-500 uppercase">Estado</div>
            <div
              id="pitwall-connection-status"
              className={`text-xs font-mono font-bold flex items-center space-x-1 ${
                isOnline
                  ? 'text-emerald-400'
                  : presenceStatus === 'RECONNECTING'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              <Wifi className="w-3 h-3" />
              <span>{isOnline ? 'EN LÍNEA' : presenceStatus === 'RECONNECTING' ? 'RECONECTANDO' : 'SIN CONEXIÓN'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Dispositivo y Multi-Tab */}
      <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg px-3 py-2 flex items-center justify-between text-[11px] font-mono text-gray-400">
        <div className="flex items-center space-x-1.5">
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span>Sesión: {sessionId.substring(0, 14)}...</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => refreshTiming()}
            title="Refrescar telemetría"
            className="text-gray-500 hover:text-cyan-400 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Cambiar Escudería
          </button>
        </div>
      </div>

      {/* Banner de Reconexión si está Offline */}
      {!isOnline && (
        <div className="bg-amber-950/50 border border-amber-600/60 rounded-xl p-3 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Conexión interrumpida con el servidor autoritativo.</span>
          </div>
          <button
            id="btn-reintentar-conexion"
            onClick={reconnect}
            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Retroalimentación de intento de vuelta (Éxito, Anti-Doble Pulsación, etc.) */}
      {lapFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
            lapFeedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
              : lapFeedback.type === 'warning'
              ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
              : 'bg-rose-950/60 border-rose-500/60 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {lapFeedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{lapFeedback.message}</span>
          </div>
          <button
            onClick={() => setLapFeedback(null)}
            className="text-gray-400 hover:text-white font-mono ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Panel de Tiempos Principales (M3 / M4) */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 border-b border-gray-800 pb-1.5">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${timingLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-gray-300 font-semibold">{timingLive ? 'TELEMETRÍA EN VIVO' : 'SINCRONIZANDO'}</span>
          </div>
          {gapMs !== undefined && gapMs > 0 && (
            <span className="text-amber-400">GAP: +{(gapMs / 1000).toFixed(3)}s</span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 text-center font-mono">
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-2 flex flex-col justify-center">
            <div className="text-[9px] text-gray-500 uppercase">Posición</div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 font-tabular mt-0.5">
              {position ? `P${position}` : '--'}
            </div>
          </div>
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-2 flex flex-col justify-center">
            <div className="text-[9px] text-gray-500 uppercase">Vueltas</div>
            <div className="text-xl sm:text-2xl font-black text-white font-tabular mt-0.5">{lapCount}</div>
          </div>
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-2 flex flex-col justify-center">
            <div className="text-[9px] text-gray-500 uppercase">Última</div>
            <div className="text-[11px] sm:text-xs font-bold text-cyan-400 font-tabular mt-1 truncate">
              {formatLapTime(lastLapMs)}
            </div>
          </div>
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-2 flex flex-col justify-center">
            <div className="text-[9px] text-gray-500 uppercase">Mejor</div>
            <div className="text-[11px] sm:text-xs font-bold text-purple-400 font-tabular mt-1 truncate">
              {formatLapTime(bestLapMs)}
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Estado Crítico: Manga Finalizada por Dirección de Carrera */}
      {effectiveSessionStatus === 'TIMING_CLOSED' && (
        <div className="p-4 bg-purple-950/80 border-2 border-purple-500 rounded-xl flex items-center space-x-3 shadow-lg animate-fade-in">
          <div className="p-2.5 bg-purple-900/60 border border-purple-400/40 rounded-lg text-purple-300 flex-shrink-0">
            <Flag className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-purple-200 uppercase tracking-wide flex items-center space-x-2">
              <span>Manga Finalizada por Dirección de Carrera</span>
            </div>
            <div className="text-xs text-purple-300 font-mono mt-0.5">
              El cronometraje de la manga está cerrado. Vueltas consolidadas: <strong className="text-white">{lapCount}</strong>. No se aceptan más pulsaciones.
            </div>
          </div>
        </div>
      )}

      {/* Botón Principal Gigante: REGISTRAR VUELTA (M3)
          Deshabilitado estrictamente si está SIN CONEXIÓN o si la sesión no está en RUNNING */}
      <div className="space-y-2">
        <button
          id="btn-registrar-vuelta-mobile"
          onClick={handleRegisterLap}
          disabled={!isOnline || !isSessionRunning || isSubmittingLap}
          className={`w-full py-8 px-4 rounded-2xl border-2 font-bold text-xl tracking-wider uppercase flex flex-col items-center justify-center space-y-1 shadow-xl select-none transition-all ${
            isOnline && isSessionRunning
              ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 border-emerald-400 text-white cursor-pointer'
              : effectiveSessionStatus === 'TIMING_CLOSED'
              ? 'bg-[#151224] border-purple-700 text-purple-300/70 cursor-not-allowed'
              : 'bg-[#1a2130] border-gray-700 text-gray-500 cursor-not-allowed opacity-75'
          }`}
        >
          <div className="flex items-center space-x-2">
            {isSubmittingLap ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : effectiveSessionStatus === 'TIMING_CLOSED' ? (
              <Lock className="w-6 h-6 text-purple-400" />
            ) : (
              <Clock className="w-6 h-6" />
            )}
            <span>
              {isSubmittingLap
                ? 'ENVIANDO A META...'
                : effectiveSessionStatus === 'TIMING_CLOSED'
                ? 'CRONOMETRAJE CERRADO'
                : 'REGISTRAR VUELTA'}
            </span>
          </div>
          <span className="text-[11px] font-mono font-normal normal-case text-gray-300">
            {!isOnline
              ? 'Bloqueado: Sin conexión autoritativa con el servidor'
              : effectiveSessionStatus === 'TIMING_CLOSED'
              ? 'Manga Finalizada: Cronometraje cerrado por Dirección de Carrera'
              : !isSessionRunning
              ? activeSession
                ? `Manga en espera (${effectiveSessionStatus || activeSession.status}) - Se activará al iniciar en Dirección de Carrera`
                : 'Esperando asignación de manga para esta escudería'
              : 'Pulsar al cruzar la línea de meta'}
          </span>
        </button>

        <p className="text-[11px] text-center text-gray-500 font-mono">
          Protección anti-doble pulsación activa (3.5s). Registro fechado por el servidor Node.js.
        </p>
      </div>

      {/* Medición Neutral de Estrategia (Módulo M6) */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 space-y-3.5 text-xs shadow-md">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div className="flex items-center space-x-2">
            <Wrench className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-gray-200 uppercase tracking-wider text-[11px]">
              Estrategia y Medición Neutral
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0a0c10] border border-gray-800 text-gray-400">
            M6 Fáctico
          </span>
        </div>

        {/* Tarjeta de Paradas en Boxes (PIT IN / OUT) */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isInPit
              ? 'bg-amber-950/40 border-amber-500/80 shadow-lg ring-1 ring-amber-500/30'
              : 'bg-[#0a0c10] border-gray-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                Estado en Pista / Boxes
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-black font-mono tracking-wide px-2.5 py-1 rounded uppercase ${
                    isInPit
                      ? 'bg-amber-500 text-black animate-pulse font-bold'
                      : 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                  }`}
                >
                  {isInPit ? 'EN BOXES' : 'EN PISTA'}
                </span>
                {isInPit && (
                  <span className="text-xs font-bold text-amber-300 font-mono font-tabular animate-pulse">
                    ⏱ {pitElapsedSeconds}s en pit
                  </span>
                )}
              </div>
            </div>

            {/* Botón de acción PIT IN / OUT */}
            <div>
              {isInPit ? (
                <button
                  onClick={handlePitOut}
                  disabled={isStrategyActionLoading || !isOnline}
                  className="py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center space-x-1.5 shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  <span>SALIDA DE BOXES</span>
                </button>
              ) : (
                <button
                  onClick={handlePitIn}
                  disabled={isStrategyActionLoading || !isOnline}
                  className="py-2.5 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-mono font-bold text-xs flex items-center space-x-1.5 shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  <span>ENTRADA A BOXES</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 border-t border-gray-800/60 mt-3 pt-2">
            <div>
              Paradas realizadas: <strong className="text-white font-tabular">{teamStrategy?.pitStopCount || 0}</strong>
            </div>
            <div>
              Última parada:{' '}
              <strong className="text-white font-tabular">
                {teamStrategy?.lastPitDurationMs !== undefined
                  ? `${(teamStrategy.lastPitDurationMs / 1000).toFixed(1)}s`
                  : '-'}
              </strong>
            </div>
          </div>
        </div>

        {/* Grid: Compuestos y Personal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono">
          {/* Compuesto / Neumáticos */}
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-xl p-3 space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center space-x-1">
                  <Disc className="w-3.5 h-3.5 text-blue-400" />
                  <span>Compuesto / Calzado</span>
                </div>
                <span className="text-[10px] text-gray-500 font-tabular">
                  Stint: {teamStrategy?.equipmentStintLaps !== undefined ? teamStrategy.equipmentStintLaps : lapCount}v
                </span>
              </div>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-sm font-black text-white">
                  {teamStrategy?.currentEquipment || 'HARD'}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                {Object.entries(teamStrategy?.equipmentTotals || { HARD: lapCount })
                  .map(([eq, count]) => `${eq}: ${count}v`)
                  .join(' • ')}
              </div>
            </div>

            <button
              onClick={() => setIsEquipmentModalOpen(true)}
              disabled={isStrategyActionLoading || !isOnline}
              className="w-full py-1.5 px-2.5 rounded bg-[#1a2130] hover:bg-blue-900/40 text-blue-300 border border-blue-800/50 text-[11px] font-bold flex items-center justify-center space-x-1 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Disc className="w-3 h-3 text-blue-400" />
              <span>Cambiar Compuesto</span>
            </button>
          </div>

          {/* Personal / Tripulación */}
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-xl p-3 space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Piloto / Personal</span>
                </div>
                <span className="text-[10px] text-gray-500 font-tabular">
                  Relevo: {teamStrategy?.personnelStintLaps !== undefined ? teamStrategy.personnelStintLaps : lapCount}v
                </span>
              </div>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-sm font-black text-emerald-400 truncate">
                  {teamStrategy?.currentPersonnel || 'Piloto 1'}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 mt-1 truncate">
                {Object.entries(teamStrategy?.personnelTotals || { 'Piloto 1': lapCount })
                  .map(([p, count]) => `${p}: ${count}v`)
                  .join(' • ')}
              </div>
            </div>

            <button
              onClick={() => setIsPersonnelModalOpen(true)}
              disabled={isStrategyActionLoading || !isOnline}
              className="w-full py-1.5 px-2.5 rounded bg-[#1a2130] hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 text-[11px] font-bold flex items-center justify-center space-x-1 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <User className="w-3 h-3 text-emerald-400" />
              <span>Cambiar Piloto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Historial de Vueltas de la Escudería (Auditoría M5) */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div className="flex items-center space-x-2 text-gray-300 font-bold uppercase tracking-wider text-[11px]">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Registro de Vueltas ({teamLaps.length})</span>
          </div>
          <span className="text-[10px] font-mono text-gray-500">M5 Auditoría</span>
        </div>

        {teamLaps.length === 0 ? (
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded p-3 text-center text-gray-500 font-mono text-[11px]">
            No se han registrado vueltas para esta escudería en la manga actual.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {[...teamLaps].reverse().map((l) => (
              <div
                key={l.id}
                className={`p-2 rounded-lg border font-mono text-[11px] flex items-center justify-between ${
                  l.isValid
                    ? 'bg-[#0a0c10] border-gray-800 text-gray-300'
                    : 'bg-rose-950/20 border-rose-800/60 text-rose-300'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">V#{l.lapNumber}</span>
                    <span className={l.isValid ? 'text-cyan-400 font-bold' : 'line-through text-gray-500'}>
                      {formatLapTime(l.lapTimeMs)}
                    </span>
                    {!l.isValid && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[9px] font-bold">
                        INVALIDADA
                      </span>
                    )}
                  </div>
                  {!l.isValid && (
                    <div className="text-[10px] text-rose-400 font-sans">
                      Motivo: "{l.invalidationReason}" {l.invalidatedBy ? `(${l.invalidatedBy})` : ''}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-gray-500">
                  {new Date(l.serverTimestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Avisos de Dirección de Carrera */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 space-y-2 text-xs">
        <div className="flex items-center space-x-2 text-gray-300 font-bold uppercase tracking-wider text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
          <span>Avisos de Dirección de Carrera</span>
        </div>
        <div className="bg-[#0a0c10] border border-gray-800/80 rounded p-3 text-gray-400 text-[11px]">
          Sin directivas ni sanciones pendientes en este momento.
        </div>
      </div>
      {/* Modales de Cambio de Compuesto y Personal (M6) */}
      <StrategyChangeModal
        isOpen={isEquipmentModalOpen}
        type="equipment"
        teamName={team?.name || ''}
        currentValue={teamStrategy?.currentEquipment || 'HARD'}
        onClose={() => setIsEquipmentModalOpen(false)}
        onSubmit={handleSubmitEquipment}
        isLoading={isStrategyActionLoading}
      />

      <StrategyChangeModal
        isOpen={isPersonnelModalOpen}
        type="personnel"
        teamName={team?.name || ''}
        currentValue={teamStrategy?.currentPersonnel || 'Piloto 1'}
        onClose={() => setIsPersonnelModalOpen(false)}
        onSubmit={handleSubmitPersonnel}
        isLoading={isStrategyActionLoading}
      />
    </div>
  );
};
