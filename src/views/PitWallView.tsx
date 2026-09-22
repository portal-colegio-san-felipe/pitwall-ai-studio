import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, Clock, AlertTriangle, Key, RefreshCw, Smartphone, CheckCircle, ShieldAlert } from 'lucide-react';
import { TeamModel, EventModel, SessionModel, TimingOverview } from '../types';
import { usePresence } from '../hooks/usePresence';

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

  // Estados de cronometraje (M3)
  const [activeSession, setActiveSession] = useState<SessionModel | null>(null);
  const [lapCount, setLapCount] = useState<number>(0);
  const [lastLapMs, setLastLapMs] = useState<number | undefined>(undefined);
  const [bestLapMs, setBestLapMs] = useState<number | undefined>(undefined);
  const [isSubmittingLap, setIsSubmittingLap] = useState<boolean>(false);
  const [lapFeedback, setLapFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // Hook de presencia para el operador de equipo
  const { sessionId, status: presenceStatus, isKicked, kickMessage, reconnect } = usePresence({
    role: 'team-operator',
    teamId: team?.id,
    teamName: team?.name,
    enabled: !!team
  });

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

  // Al montar, verificar si hay token en URL o en sessionStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token') || initialToken || sessionStorage.getItem('pw_team_token');

    if (tokenFromUrl) {
      setTokenInput(tokenFromUrl);
      validateToken(tokenFromUrl);
    }
  }, [initialToken, validateToken]);

  // Consultar tiempos autoritativos periódicamente
  useEffect(() => {
    if (!activeSession || !team) return;

    const fetchTiming = async () => {
      try {
        const res = await fetch(`/api/sessions/${activeSession.id}/timing`);
        if (res.ok) {
          const data: { ok: boolean; timing: TimingOverview } = await res.json();
          if (data.ok && data.timing) {
            const entry = data.timing.leaderboard.find((l) => l.teamId === team.id);
            if (entry) {
              setLapCount(entry.lapCount);
              setLastLapMs(entry.lastLapMs);
              setBestLapMs(entry.bestLapMs);
            }
          }
        }
      } catch {
        // Silencioso en reintentos periódicos
      }
    };

    fetchTiming();
    const interval = setInterval(fetchTiming, 3000);
    return () => clearInterval(interval);
  }, [activeSession?.id, team?.id]);

  // Manejador del botón autoritativo: REGISTRAR VUELTA (Criterio M3)
  const handleRegisterLap = async () => {
    if (!team || !activeSession || isSubmittingLap) return;

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
  const isSessionRunning = activeSession?.status === 'RUNNING';

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

        <div className="text-right flex-shrink-0 pl-2">
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

      {/* Barra de Dispositivo y Multi-Tab */}
      <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg px-3 py-2 flex items-center justify-between text-[11px] font-mono text-gray-400">
        <div className="flex items-center space-x-1.5">
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span>Sesión: {sessionId.substring(0, 14)}...</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
        >
          Cambiar Escudería
        </button>
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

      {/* Panel de Tiempos Principales (M3) */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 grid grid-cols-3 gap-2 text-center font-mono">
        <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase">Vueltas</div>
          <div className="text-2xl font-black text-white font-tabular mt-1">{lapCount}</div>
        </div>
        <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase">Última</div>
          <div className="text-xs font-bold text-cyan-400 font-tabular mt-2">
            {formatLapTime(lastLapMs)}
          </div>
        </div>
        <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase">Mejor</div>
          <div className="text-xs font-bold text-purple-400 font-tabular mt-2">
            {formatLapTime(bestLapMs)}
          </div>
        </div>
      </div>

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
              : 'bg-[#1a2130] border-gray-700 text-gray-500 cursor-not-allowed opacity-75'
          }`}
        >
          <div className="flex items-center space-x-2">
            {isSubmittingLap ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
              <Clock className="w-6 h-6" />
            )}
            <span>{isSubmittingLap ? 'ENVIANDO A META...' : 'REGISTRAR VUELTA'}</span>
          </div>
          <span className="text-[11px] font-mono font-normal normal-case text-gray-300">
            {!isOnline
              ? 'Bloqueado: Sin conexión autoritativa con el servidor'
              : !isSessionRunning
              ? activeSession
                ? `Manga en estado ${activeSession.status} (Inicie la manga en Dirección de Carrera)`
                : 'Sin manga asignada para esta escudería'
              : 'Pulsar al cruzar la línea de meta'}
          </span>
        </button>

        <p className="text-[11px] text-center text-gray-500 font-mono">
          Protección anti-doble pulsación activa (3.5s). Registro fechado por el servidor Node.js.
        </p>
      </div>

      {/* Telemetría Neutral de Estrategia */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <span className="font-bold text-gray-300 uppercase tracking-wider text-[11px]">
            Estrategia de Paradas & Calzado
          </span>
          <span className="text-[10px] font-mono text-gray-500">Módulo M6</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded p-2.5 space-y-1">
            <div className="text-gray-500 text-[10px]">CALZADO ACTUAL</div>
            <div className="text-amber-400 font-semibold">SIN CONFIGURAR</div>
            <div className="text-gray-500 text-[10px]">Stint: {lapCount} vueltas</div>
          </div>
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded p-2.5 space-y-1">
            <div className="text-gray-500 text-[10px]">PERSONAL ACTIVO</div>
            <div className="text-emerald-400 font-semibold">SIN CONFIGURAR</div>
            <div className="text-gray-500 text-[10px]">Relevo: {lapCount} vueltas</div>
          </div>
        </div>
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
    </div>
  );
};
