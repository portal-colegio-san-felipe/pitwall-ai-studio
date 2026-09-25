import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Trophy,
  Users,
  Plus,
  Edit2,
  Trash2,
  Play,
  Copy,
  Check,
  RefreshCw,
  Smartphone,
  UserX,
  Wifi,
  ExternalLink,
  Square,
  Flag,
  Zap,
  PlusCircle,
  Wrench,
  User,
  AlertTriangle
} from 'lucide-react';
import { EventModel, TeamModel, SessionModel, SystemHealth, PresenceOverview } from '../types';
import { EventConfigModal } from '../components/EventConfigModal';
import { TeamFormModal } from '../components/TeamFormModal';
import { TeamPilotsModal } from '../components/TeamPilotsModal';
import { SessionFormModal } from '../components/SessionFormModal';
import { RaceAuditAndLapsPanel } from '../components/RaceAuditAndLapsPanel';
import { ManualLapModal } from '../components/ManualLapModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { TeamStrategyDetailModal } from '../components/TeamStrategyDetailModal';
import { StrategyChangeModal } from '../components/StrategyChangeModal';
import { SessionTimerBadge } from '../components/SessionTimerBadge';
import { usePresence } from '../hooks/usePresence';
import { useRealtimeTiming } from '../hooks/useRealtimeTiming';

interface Props {
  health?: SystemHealth | null;
  event: EventModel | null;
  teams: TeamModel[];
  sessions: SessionModel[];
  onRefreshData: () => void;
  onNavigate?: (path: string) => void;
}

export const RaceControlView: React.FC<Props> = ({
  event,
  teams,
  sessions,
  onRefreshData,
  onNavigate
}) => {
  // Registrar presencia como Director de Carrera
  usePresence({ role: 'race-control' });

  // Estados para modales
  const [showEventModal, setShowEventModal] = useState(false);
  const [isCreatingNewEvent, setIsCreatingNewEvent] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamModel | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionModel | null>(null);
  const [showManualLapModal, setShowManualLapModal] = useState(false);
  const [manualLapTeamId, setManualLapTeamId] = useState<string | undefined>(undefined);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [copiedTokenTeamId, setCopiedTokenTeamId] = useState<string | null>(null);
  const [regeneratingTeamId, setRegeneratingTeamId] = useState<string | null>(null);

  // Estados para diálogos de confirmación in-app (evita bloqueos de window.confirm en iframes/sandbox)
  const [sessionToClose, setSessionToClose] = useState<SessionModel | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<SessionModel | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<TeamModel | null>(null);
  const [teamToRegenerate, setTeamToRegenerate] = useState<TeamModel | null>(null);
  const [deviceToKick, setDeviceToKick] = useState<{ sessionId: string; label: string } | null>(null);
  const [eventToDelete, setEventToDelete] = useState<boolean>(false);
  const [teamForPilotsModal, setTeamForPilotsModal] = useState<TeamModel | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Estado de presencia en tiempo real
  const [presence, setPresence] = useState<PresenceOverview | null>(null);
  const [isRefreshingPresence, setIsRefreshingPresence] = useState(false);

  // Estados para estrategia neutral (M6)
  const [strategyDetailTeamId, setStrategyDetailTeamId] = useState<string | null>(null);
  const [strategyChangeType, setStrategyChangeType] = useState<'equipment' | 'personnel' | null>(null);
  const [strategyChangeTeamId, setStrategyChangeTeamId] = useState<string | null>(null);
  const [isStrategySubmitting, setIsStrategySubmitting] = useState<boolean>(false);

  // Monitor de cronometraje en tiempo real (M4)
  // Preserva la sesión seleccionada explícitamente o prioriza la activa en curso (RUNNING)
  const activeSession = (selectedSessionId ? sessions.find((s) => s.id === selectedSessionId) : null)
    || sessions.find((s) => s.status === 'RUNNING')
    || sessions[0];
  const { timing, isLive: timingLive, revision: timingRevision, refresh: refreshTiming } = useRealtimeTiming(activeSession?.id);

  const formatLapTime = (ms?: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const totalSecs = ms / 1000;
    const minutes = Math.floor(totalSecs / 60);
    const seconds = Math.floor(totalSecs % 60);
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const fetchPresence = useCallback(async () => {
    try {
      const res = await fetch('/api/presence');
      if (res.ok) {
        const data = await res.json();
        setPresence(data.overview);
      }
    } catch {
      // Ignorar fallos transitorios en polling
    }
  }, []);

  useEffect(() => {
    fetchPresence();
    const interval = setInterval(fetchPresence, 4000);
    return () => clearInterval(interval);
  }, [fetchPresence]);

  // Expulsar sesión de dispositivo (Kick)
  const handleKickSession = (sessionId: string, deviceLabel: string) => {
    setDeviceToKick({ sessionId, label: deviceLabel });
  };

  const executeKickSession = async () => {
    if (!deviceToKick) return;
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/presence/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: deviceToKick.sessionId })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionFeedback(`Dispositivo "${deviceToKick.label}" desconectado de la sesión.`);
        fetchPresence();
      } else {
        setActionFeedback('No se pudo desconectar el dispositivo.');
      }
    } catch {
      setActionFeedback('Error al solicitar desconexión del dispositivo.');
    } finally {
      setIsActionLoading(false);
      setDeviceToKick(null);
    }
  };

  // Eliminar evento y reiniciar plataforma
  const executeDeleteEvent = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/event', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionFeedback('Evento eliminado y plataforma reiniciada exitosamente.');
        onRefreshData();
      } else {
        setActionFeedback(data.error?.message || 'Error al eliminar el evento.');
      }
    } catch {
      setActionFeedback('Error de comunicación al eliminar el evento.');
    } finally {
      setIsActionLoading(false);
      setEventToDelete(false);
    }
  };

  // Copiar enlace único de acceso para el equipo
  const handleCopyTeamLink = (team: TeamModel) => {
    const accessUrl = `${window.location.origin}/pit-wall?token=${encodeURIComponent(team.token)}`;
    navigator.clipboard.writeText(accessUrl);
    setCopiedTokenTeamId(team.id);
    setActionFeedback(`Enlace copiado para ${team.name}. Compartir con los operadores del box.`);
    setTimeout(() => setCopiedTokenTeamId(null), 3000);
  };

  // Regenerar token de escudería si está comprometido
  const handleRegenerateToken = (team: TeamModel) => {
    setTeamToRegenerate(team);
  };

  const executeRegenerateToken = async () => {
    if (!teamToRegenerate) return;
    setIsActionLoading(true);
    setRegeneratingTeamId(teamToRegenerate.id);
    try {
      const res = await fetch(`/api/teams/${teamToRegenerate.id}/regenerate-token`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionFeedback(`Nuevo token de seguridad generado para ${teamToRegenerate.name}.`);
        onRefreshData();
      } else {
        setActionFeedback('Error al regenerar token.');
      }
    } catch {
      setActionFeedback('Error de comunicación al regenerar token.');
    } finally {
      setIsActionLoading(false);
      setRegeneratingTeamId(null);
      setTeamToRegenerate(null);
    }
  };

  // Manejar borrado de escudería
  const handleDeleteTeam = (team: TeamModel) => {
    setTeamToDelete(team);
  };

  const executeDeleteTeam = async () => {
    if (!teamToDelete) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setActionFeedback(`Escudería "${teamToDelete.name}" eliminada.`);
        onRefreshData();
      }
    } catch {
      setActionFeedback('Error al eliminar la escudería.');
    } finally {
      setIsActionLoading(false);
      setTeamToDelete(null);
    }
  };

  // Manejar borrado de sesión
  const handleDeleteSession = (session: SessionModel) => {
    setSessionToDelete(session);
  };

  const executeDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setActionFeedback(`Sesión "${sessionToDelete.name}" eliminada.`);
        if (selectedSessionId === sessionToDelete.id) {
          setSelectedSessionId(null);
        }
        onRefreshData();
      }
    } catch {
      setActionFeedback('Error al eliminar la sesión.');
    } finally {
      setIsActionLoading(false);
      setSessionToDelete(null);
    }
  };

  // Manejar inicio de sesión / cronometraje (M3)
  const handleStartSession = async (session: SessionModel) => {
    setSelectedSessionId(session.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}/start`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionFeedback(`🏁 Manga "${session.name}" iniciada. Cronometraje autoritativo EN VIVO.`);
        onRefreshData();
        refreshTiming();
      } else {
        setActionFeedback(data.error?.message || 'Error al iniciar la sesión.');
      }
    } catch {
      setActionFeedback('Error de comunicación al iniciar la sesión.');
    }
  };

  // Manejar pausa de sesión (M3)
  const handleStopSession = async (session: SessionModel) => {
    setSelectedSessionId(session.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}/stop`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionFeedback(`⏸ Manga "${session.name}" pausada.`);
        onRefreshData();
        refreshTiming();
      } else {
        setActionFeedback(data.error?.message || 'Error al pausar la sesión.');
      }
    } catch {
      setActionFeedback('Error de comunicación al pausar la sesión.');
    }
  };

  // Manejar cierre de cronometraje (M3)
  const handleCloseSession = (session: SessionModel) => {
    setSessionToClose(session);
  };

  const executeCloseSession = async () => {
    if (!sessionToClose) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionToClose.id}/close`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSelectedSessionId(sessionToClose.id);
        setActionFeedback(`🏁 Cronometraje de "${sessionToClose.name}" CERRADO. No se registrarán más vueltas en Pit Wall.`);
        onRefreshData();
        refreshTiming();
      } else {
        setActionFeedback(data.error?.message || 'Error al cerrar cronometraje.');
      }
    } catch {
      setActionFeedback('Error de comunicación al cerrar cronometraje.');
    } finally {
      setIsActionLoading(false);
      setSessionToClose(null);
    }
  };

  // Manejar reanudación de cronometraje si fue cerrada por error
  const handleReopenSession = async (session: SessionModel) => {
    setSelectedSessionId(session.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}/reopen`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActionFeedback(`🟢 Cronometraje de "${session.name}" REABIERTO. Estado: RUNNING.`);
        onRefreshData();
        refreshTiming();
      } else {
        setActionFeedback(data.error?.message || 'Error al reabrir cronometraje.');
      }
    } catch {
      setActionFeedback('Error de comunicación al reabrir cronometraje.');
    }
  };

  // Manejadores de Estrategia Neutral para Comisarios (M6)
  const handleRaceControlPitIn = async (teamId: string) => {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/strategy/pit-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, actor: 'Dirección de Carrera' })
      });
      if (res.ok) {
        setActionFeedback('Entrada a boxes (PIT IN) registrada correctamente');
        await refreshTiming();
      }
    } catch {
      setActionFeedback('Error al registrar entrada a boxes');
    }
  };

  const handleRaceControlPitOut = async (teamId: string) => {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/strategy/pit-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, actor: 'Dirección de Carrera' })
      });
      if (res.ok) {
        setActionFeedback('Salida de boxes (PIT OUT) registrada correctamente');
        await refreshTiming();
      }
    } catch {
      setActionFeedback('Error al registrar salida de boxes');
    }
  };

  const handleRaceControlEquipmentSubmit = async (newValue: string, reason?: string) => {
    if (!activeSession || !strategyChangeTeamId) return;
    setIsStrategySubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/strategy/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: strategyChangeTeamId,
          equipment: newValue,
          reason,
          actor: 'Dirección de Carrera'
        })
      });
      if (res.ok) {
        setActionFeedback(`Cambio de compuesto a "${newValue}" registrado correctamente`);
        setStrategyChangeType(null);
        setStrategyChangeTeamId(null);
        await refreshTiming();
      }
    } finally {
      setIsStrategySubmitting(false);
    }
  };

  const handleRaceControlPersonnelSubmit = async (newValue: string, reason?: string) => {
    if (!activeSession || !strategyChangeTeamId) return;
    setIsStrategySubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/strategy/personnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: strategyChangeTeamId,
          personnel: newValue,
          reason,
          actor: 'Dirección de Carrera'
        })
      });
      if (res.ok) {
        setActionFeedback(`Relevo de piloto a "${newValue}" registrado correctamente`);
        setStrategyChangeType(null);
        setStrategyChangeTeamId(null);
        await refreshTiming();
      }
    } finally {
      setIsStrategySubmitting(false);
    }
  };

  return (
    <div className="space-y-6 py-6">
      {/* Barra de Estado de Dirección de Carrera */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-lg text-blue-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white tracking-wide uppercase">
                Dirección de Carrera / Race Control
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-emerald-950/70 text-emerald-300 rounded border border-emerald-700/60">
                M5 CORRECCIONES Y AUDITORÍA
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              Gestión de eventos, escuderías, tokens de acceso y supervisión de presencia
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="bg-[#0a0c10] border border-gray-800 px-3 py-2 rounded-lg">
            <span className="text-gray-500 text-[10px] block uppercase">Evento Actual</span>
            <span className={`font-bold ${event ? 'text-cyan-400' : 'text-amber-400'}`}>
              {event ? event.name : 'SIN EVENTO CONFIGURADO'}
            </span>
          </div>

          <button
            id="btn-new-event"
            onClick={() => {
              setIsCreatingNewEvent(true);
              setShowEventModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer flex items-center space-x-1.5 shadow"
            title="Crear un nuevo evento escolar independiente"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Evento</span>
          </button>

          <button
            id="btn-open-event-modal"
            onClick={() => {
              setIsCreatingNewEvent(false);
              setShowEventModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold transition-colors cursor-pointer flex items-center space-x-1.5 border border-gray-700 shadow"
          >
            <Trophy className="w-3.5 h-3.5 text-cyan-400" />
            <span>{event ? 'Editar Evento' : 'Configurar Evento'}</span>
          </button>

          {event && (
            <button
              id="btn-delete-event"
              onClick={() => setEventToDelete(true)}
              className="px-3.5 py-2 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-bold transition-colors cursor-pointer flex items-center space-x-1.5 shadow"
              title="Eliminar el evento actual y reiniciar la plataforma a limpio"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Eliminar Evento</span>
            </button>
          )}
        </div>
      </div>

      {/* Aviso de Inactividad de Evento (> 6 Horas) */}
      {event && (Date.now() - new Date(event.updatedAt).getTime() > 6 * 3600 * 1000) && (
        <div className="p-3.5 bg-amber-950/50 border border-amber-500/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-amber-200 shadow">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Aviso de inactividad: Este evento no ha registrado actividad en más de 6 horas. Puede continuar operándolo o eliminarlo para iniciar una nueva jornada.
            </span>
          </div>
          <button
            onClick={() => setEventToDelete(true)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs rounded transition-colors cursor-pointer flex-shrink-0 shadow"
          >
            Reiniciar Evento
          </button>
        </div>
      )}

      {/* Banner de retroalimentación de acciones */}
      {actionFeedback && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-800/80 rounded-lg text-cyan-300 text-xs flex items-center justify-between">
          <span>{actionFeedback}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-cyan-400 hover:text-white font-mono ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Monitor de Cronometraje y Telemetría en Vivo (M4) */}
      {activeSession && (
        <div className="bg-[#131720] border border-gray-800 rounded-xl p-5 space-y-4 shadow-lg">
          {/* Selector de Manga si existen múltiples sesiones (ej. Clasificación vs Carrera) */}
          {sessions.length > 1 && (
            <div className="flex items-center space-x-2 border-b border-gray-800/80 pb-2.5 overflow-x-auto">
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wider font-semibold">
                Manga a Monitorear:
              </span>
              <div className="flex items-center space-x-1.5">
                {sessions.map((s) => {
                  const isSelected = activeSession.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSessionId(s.id)}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow ring-1 ring-blue-400'
                          : 'bg-[#0a0c10] hover:bg-gray-800 text-gray-300 border border-gray-800'
                      }`}
                    >
                      <span>{s.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                          s.status === 'RUNNING'
                            ? 'bg-emerald-500 text-black font-extrabold animate-pulse'
                            : s.status === 'TIMING_CLOSED'
                            ? 'bg-purple-900 text-purple-200 border border-purple-700'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {s.status === 'RUNNING' ? 'EN VIVO' : s.status === 'TIMING_CLOSED' ? 'CERRADA' : s.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-gray-800 pb-3 gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Monitor en Vivo: {activeSession.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono rounded font-bold ${
                      activeSession.status === 'RUNNING'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center space-x-1'
                        : activeSession.status === 'TIMING_CLOSED'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {activeSession.status === 'RUNNING' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                    )}
                    <span>{activeSession.status}</span>
                  </span>
                </div>
                <div className="text-[11px] font-mono text-gray-400 flex items-center space-x-2 mt-0.5">
                  <span className={timingLive ? 'text-emerald-400' : 'text-gray-500'}>
                    {timingLive ? '● Stream SSE Conectado' : '○ Sincronizando'}
                  </span>
                  <span>·</span>
                  <span>Rev. #{timingRevision}</span>
                  <span>·</span>
                  <span>{timing?.totalLapsRecorded || 0} vueltas registradas</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
              {/* Reloj visible de sesión (El director necesita saber cuánto lleva corriendo la sesión) */}
              <SessionTimerBadge
                startedAt={activeSession.startedAt || timing?.startedAt}
                status={activeSession.status}
                closedAt={activeSession.closedAt || timing?.closedAt}
                variant="race-control"
              />

              {/* Acciones directas de sesión en el monitor */}
              {activeSession.status === 'RUNNING' && (
                <>
                  <button
                    id="btn-monitor-stop-session"
                    onClick={() => handleStopSession(activeSession)}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors shadow"
                    title="Pausar manga temporalmente"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Pausar</span>
                  </button>
                  <button
                    id="btn-monitor-close-session"
                    onClick={() => handleCloseSession(activeSession)}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors shadow"
                    title="Cerrar cronometraje de la manga"
                  >
                    <Flag className="w-3 h-3" />
                    <span>Cerrar Manga</span>
                  </button>
                </>
              )}

              {activeSession.status === 'TIMING_CLOSED' && (
                <button
                  id="btn-monitor-reopen-session"
                  onClick={() => handleReopenSession(activeSession)}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors shadow"
                  title="Reanudar cronometraje"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Reabrir Manga</span>
                </button>
              )}

              {activeSession.status === 'SCHEDULED' && (
                <button
                  id="btn-monitor-start-session"
                  onClick={() => handleStartSession(activeSession)}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors shadow"
                  title="Iniciar manga"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Iniciar Manga</span>
                </button>
              )}

              <button
                id="btn-monitor-manual-lap"
                onClick={() => {
                  setManualLapTeamId(undefined);
                  setShowManualLapModal(true);
                }}
                className="px-2.5 py-1.5 bg-amber-950/70 hover:bg-amber-900 border border-amber-500/50 text-amber-300 font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors shadow"
                title="Contar vuelta manualmente a una escudería"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Vuelta Manual</span>
              </button>

              <button
                onClick={() => onNavigate?.('/display')}
                className="px-2.5 py-1.5 bg-[#0a0c10] hover:bg-gray-800 border border-gray-700 text-gray-300 rounded flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <ExternalLink className="w-3 h-3 text-cyan-400" />
                <span>Pantalla 16:9</span>
              </button>
              <button
                onClick={() => onNavigate?.('/broadcast')}
                className="px-2.5 py-1.5 bg-[#0a0c10] hover:bg-gray-800 border border-gray-700 text-gray-300 rounded flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <ExternalLink className="w-3 h-3 text-amber-400" />
                <span>Broadcast</span>
              </button>
            </div>
          </div>

          {/* Banner de Confirmación de Manga Cerrada */}
          {activeSession.status === 'TIMING_CLOSED' && (
            <div className="p-3.5 bg-purple-950/70 border border-purple-500/70 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow animate-fade-in">
              <div className="flex items-center space-x-2.5 text-purple-200">
                <div className="p-1.5 bg-purple-900/60 rounded-md text-purple-300 flex-shrink-0">
                  <Flag className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
                    <span>Cronometraje Oficial Cerrado</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-900/90 text-purple-200 rounded border border-purple-700">
                      {activeSession.name}
                    </span>
                  </div>
                  <div className="text-[11px] text-purple-300 font-mono mt-0.5">
                    El registro de vueltas desde el Pit Wall está bloqueado en todas las escuderías. La clasificación final queda consolidada.
                  </div>
                </div>
              </div>
              <button
                id="btn-banner-reopen-session"
                onClick={() => handleReopenSession(activeSession)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs rounded flex items-center justify-center space-x-1 cursor-pointer transition-colors shadow flex-shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Reabrir Manga</span>
              </button>
            </div>
          )}

          {/* Tabla de clasificación en vivo */}
          {timing && timing.leaderboard && timing.leaderboard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 uppercase text-[10px]">
                    <th className="py-2 px-2 text-center w-10">Pos</th>
                    <th className="py-2 px-3">Escudería</th>
                    <th className="py-2 px-2 text-center">Vueltas</th>
                    <th className="py-2 px-2 text-center">Boxes</th>
                    <th className="py-2 px-2 text-center">Compuesto</th>
                    <th className="py-2 px-2 text-center">Piloto</th>
                    <th className="py-2 px-3 text-right">Última</th>
                    <th className="py-2 px-3 text-right">Mejor</th>
                    <th className="py-2 px-3 text-right">Diferencia</th>
                    <th className="py-2 px-2 text-center w-36">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-tabular">
                  {timing.leaderboard.map((item) => {
                    const teamInfo = teams.find((t) => t.id === item.teamId);
                    const strat = timing.teamsStrategy?.[item.teamId] || item.strategy;
                    const isInPit = strat?.pitState === 'IN_PIT';

                    return (
                      <tr
                        key={item.teamId}
                        className={`hover:bg-gray-800/40 transition-colors ${
                          item.position === 1 ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="py-2 px-2 text-center font-bold">
                          <span
                            className={`inline-block w-6 text-center py-0.5 rounded ${
                              item.position === 1
                                ? 'bg-amber-400 text-black font-black'
                                : item.position === 2
                                ? 'bg-gray-300 text-black font-black'
                                : item.position === 3
                                ? 'bg-amber-700 text-white font-black'
                                : 'text-gray-400'
                            }`}
                          >
                            {item.position}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center space-x-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: teamInfo?.color || '#3b82f6' }}
                            />
                            <span className="font-bold text-gray-200">
                              {teamInfo?.name || item.teamId}
                            </span>
                            {item.isFastestLap && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                                VR
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-white">
                          {item.lapCount}
                        </td>
                        {/* Boxes (M6) */}
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isInPit
                                ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {isInPit ? 'BOXES' : 'PISTA'}
                          </span>
                          <span className="text-[9px] text-gray-500 ml-1">
                            ({strat?.pitStopCount || 0})
                          </span>
                        </td>
                        {/* Compuesto (M6) */}
                        <td className="py-2 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 text-[9px] font-bold">
                            {strat?.currentEquipment || 'HARD'}
                          </span>
                          <span className="text-[9px] text-gray-500 ml-1 font-tabular">
                            {strat?.equipmentStintLaps !== undefined
                              ? `${strat.equipmentStintLaps}v`
                              : `${item.lapCount}v`}
                          </span>
                        </td>
                        {/* Piloto (M6) */}
                        <td className="py-2 px-2 text-center max-w-[90px] truncate">
                          <span className="text-gray-300 text-[10px] font-bold">
                            {strat?.currentPersonnel || 'Piloto 1'}
                          </span>
                          <span className="text-[9px] text-gray-500 ml-1 font-tabular">
                            {strat?.personnelStintLaps !== undefined
                              ? `(${strat.personnelStintLaps}v)`
                              : `(${item.lapCount}v)`}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-cyan-400">
                          {formatLapTime(item.lastLapMs)}
                        </td>
                        <td className="py-2 px-3 text-right text-purple-400 font-bold">
                          {formatLapTime(item.bestLapMs)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-400">
                          {item.gapMs !== undefined && item.gapMs > 0
                            ? `+${(item.gapMs / 1000).toFixed(3)}s`
                            : item.position === 1
                            ? 'LÍDER'
                            : '--'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setManualLapTeamId(item.teamId);
                                setShowManualLapModal(true);
                              }}
                              className="px-2 py-0.5 bg-amber-950/60 hover:bg-amber-900 border border-amber-600/50 text-amber-300 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer"
                              title={`Contar vuelta manual a ${teamInfo?.name || item.teamId}`}
                            >
                              +1V
                            </button>
                            <button
                              onClick={() => setStrategyDetailTeamId(item.teamId)}
                              className="px-2 py-0.5 bg-[#1a2130] hover:bg-blue-900/60 border border-blue-700/50 text-blue-300 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer flex items-center space-x-0.5"
                              title={`Ver estrategia y paradas de ${teamInfo?.name || item.teamId}`}
                            >
                              <Wrench className="w-2.5 h-2.5 text-cyan-400" />
                              <span>M6</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs font-mono text-gray-500 bg-[#0a0c10] rounded-lg">
              No hay tiempos registrados para la sesión actual todavía.
            </div>
          )}
        </div>
      )}

      {/* Panel de Auditoría y Corrección de Vueltas (M5) */}
      {activeSession && (
        <RaceAuditAndLapsPanel
          sessionId={activeSession.id}
          sessionName={activeSession.name}
          teams={teams}
          onLapInvalidatedOrRestored={() => {
            refreshTiming();
          }}
        />
      )}

      {/* Panel de Presencia y Dispositivos Conectados en Tiempo Real (M2) */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
              Conectividad y Presencia de Dispositivos ({presence?.totalConnected || 0} en línea)
            </h3>
          </div>
          <button
            onClick={async () => {
              setIsRefreshingPresence(true);
              await fetchPresence();
              setIsRefreshingPresence(false);
            }}
            className="flex items-center space-x-1 px-2.5 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 rounded text-xs font-mono cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshingPresence ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Resumen de conectividad por escudería */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {teams.map((t) => {
            const teamPresence = presence?.teamsConnectivity[t.id];
            const isOnline = !!teamPresence && teamPresence.isOnline && teamPresence.connectedCount > 0;
            return (
              <div
                key={t.id}
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  isOnline
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-[#0a0c10] border-gray-800 text-gray-400'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: t.color || '#3b82f6' }}
                  />
                  <span className="font-bold truncate">{t.name}</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800 flex-shrink-0">
                  {teamPresence?.connectedCount || 0} disp.
                </span>
              </div>
            );
          })}
        </div>

        {/* Lista detallada de sesiones activas de clientes */}
        {presence && presence.activeSessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase">
                  <th className="py-2 px-3">Rol / Origen</th>
                  <th className="py-2 px-3">Escudería</th>
                  <th className="py-2 px-3">Dispositivo</th>
                  <th className="py-2 px-3">Último Latido</th>
                  <th className="py-2 px-3">Estado</th>
                  <th className="py-2 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {presence.activeSessions.map((session) => (
                  <tr key={session.sessionId} className="hover:bg-gray-800/30">
                    <td className="py-2.5 px-3 uppercase text-cyan-400 font-bold">
                      {session.role === 'race-control'
                        ? 'Dirección'
                        : session.role === 'team-operator'
                        ? 'Pit Wall'
                        : session.role === 'display'
                        ? 'Pantalla 16:9'
                        : session.role}
                    </td>
                    <td className="py-2.5 px-3">
                      {session.teamName || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      <div className="flex items-center space-x-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-gray-500" />
                        <span>{session.deviceInfo}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      hace {session.lastSeenSecondsAgo}s
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          session.status === 'ONLINE'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : session.status === 'RECONNECTING'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {session.role !== 'race-control' && (
                        <button
                          onClick={() => handleKickSession(session.sessionId, session.deviceInfo)}
                          className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-700/60 text-rose-300 rounded text-[10px] transition-colors cursor-pointer flex items-center space-x-1 ml-auto"
                          title="Expulsar este dispositivo de la sesión"
                        >
                          <UserX className="w-3 h-3" />
                          <span>Desconectar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-[#0a0c10] border border-gray-800 text-center text-xs text-gray-500">
            Sin dispositivos de operadores conectados activamente en este momento.
          </div>
        )}
      </div>

      {/* Grid de 2 Columnas: Escuderías (M1+M2) y Sesiones/Rondas (M1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna 1: Escuderías Registradas con Enlaces de Acceso y Tokens */}
        <div className="bg-[#131720] border border-gray-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
                  Escuderías Registradas ({teams.length})
                </h3>
              </div>
              <button
                id="btn-add-team"
                onClick={() => {
                  setEditingTeam(null);
                  setShowTeamModal(true);
                }}
                className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-400 rounded-md text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Registrar Escudería</span>
              </button>
            </div>

            {teams.length === 0 ? (
              <div className="p-6 bg-[#0a0c10] border border-dashed border-gray-800 rounded-lg text-center space-y-2">
                <Users className="w-8 h-8 text-gray-600 mx-auto" />
                <div className="text-xs text-gray-400">Sin escuderías registradas</div>
                <p className="text-[11px] text-gray-500">
                  Invariante M1: El sistema no impone un límite de 4 escuderías. Puede registrar cuantas requiera la competición.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {teams.map((t, idx) => {
                  const isCopied = copiedTokenTeamId === t.id;
                  const isRegenerating = regeneratingTeamId === t.id;

                  return (
                    <div
                      key={t.id}
                      id={`team-item-${t.id}`}
                      className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-black text-xs flex-shrink-0"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.number !== undefined ? t.number : idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white truncate">{t.name}</span>
                              {t.shortName && (
                                <span className="px-1.5 py-0.2 text-[10px] font-mono bg-gray-800 text-gray-400 rounded">
                                  {t.shortName}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono truncate">
                              {t.kartName ? `Kart: ${t.kartName}` : 'Kart estándar'}
                            </div>
                            {t.pilots && t.pilots.length > 0 ? (
                              <div className="text-[10px] text-cyan-300 font-mono flex items-center space-x-1 mt-0.5 truncate">
                                <User className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                                <span className="truncate">Pilotos: {t.pilots.join(', ')}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-gray-500 font-mono italic mt-0.5">
                                Sin pilotos registrados
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            id={`btn-pilots-team-${t.id}`}
                            onClick={() => setTeamForPilotsModal(t)}
                            className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors cursor-pointer"
                            title="Gestionar pilotos registrados"
                          >
                            <User className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`btn-edit-team-${t.id}`}
                            onClick={() => {
                              setEditingTeam(t);
                              setShowTeamModal(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors cursor-pointer"
                            title="Editar escudería"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`btn-delete-team-${t.id}`}
                            onClick={() => handleDeleteTeam(t)}
                            className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded transition-colors cursor-pointer"
                            title="Eliminar escudería"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Barra de Token y Enlace Único (M2) */}
                      <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between gap-2 text-[11px] font-mono">
                        <div className="truncate text-gray-500">
                          Token: <span className="text-gray-300">{t.token.slice(0, 14)}...</span>
                        </div>

                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleCopyTeamLink(t)}
                            className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-gray-700 flex items-center space-x-1 transition-colors cursor-pointer text-[10px]"
                            title="Copiar enlace directo para enviar por WhatsApp o chat"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{isCopied ? '¡Copiado!' : 'Copiar Enlace'}</span>
                          </button>

                          <button
                            onClick={() => handleRegenerateToken(t)}
                            disabled={isRegenerating}
                            className="px-2 py-1 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-amber-300 border border-gray-800 flex items-center space-x-1 transition-colors cursor-pointer text-[10px]"
                            title="Regenerar token si fue comprometido"
                          >
                            <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                            <span>Regenerar</span>
                          </button>

                          <button
                            onClick={() => {
                              onNavigate?.(`/pit-wall?token=${t.token}`);
                            }}
                            className="p-1 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 transition-colors cursor-pointer"
                            title="Abrir vista de box como este equipo"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-[11px] font-mono text-gray-500 pt-3 border-t border-gray-800/80">
            Hito M2: Enlaces de acceso unívocos y soporte para múltiples dispositivos por escudería.
          </div>
        </div>

        {/* Columna 2: Sesiones / Rondas */}
        <div className="bg-[#131720] border border-gray-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2">
                <Play className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
                  Sesiones y Rondas ({sessions.length})
                </h3>
              </div>
              <button
                id="btn-add-session"
                onClick={() => {
                  setEditingSession(null);
                  setShowSessionModal(true);
                }}
                className="flex items-center space-x-1 px-2.5 py-1 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-purple-400 rounded-md text-xs font-semibold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Sesión</span>
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="p-6 bg-[#0a0c10] border border-dashed border-gray-800 rounded-lg text-center space-y-2">
                <Play className="w-8 h-8 text-gray-600 mx-auto" />
                <div className="text-xs text-gray-400">Sin sesiones programadas</div>
                <p className="text-[11px] text-gray-500">
                  Configure rondas clasificatorias o carreras con sus vueltas objetivo y equipos asignados.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    id={`session-item-${s.id}`}
                    className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-3 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white truncate">{s.name}</span>
                        <span
                          className={`px-1.5 py-0.2 text-[10px] font-mono rounded font-bold ${
                            s.type === 'qualifying'
                              ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                              : s.type === 'race'
                              ? 'bg-purple-950 text-purple-400 border border-purple-800'
                              : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          {s.type === 'qualifying'
                            ? 'CLASIFICACIÓN'
                            : s.type === 'race'
                            ? 'GRAN CARRERA'
                            : 'ENTRENAMIENTOS'}
                        </span>
                        <span className="px-1.5 py-0.2 text-[10px] font-mono bg-gray-900 text-gray-500 rounded border border-gray-800">
                          {s.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {s.targetLaps ? `${s.targetLaps} vueltas objetivo` : 'Vueltas libres'} ·{' '}
                        {s.participatingTeamIds.length} escuderías participantes
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                      {s.status === 'SCHEDULED' && (
                        <button
                          id={`btn-start-session-${s.id}`}
                          onClick={() => handleStartSession(s)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold font-mono transition-colors cursor-pointer flex items-center space-x-1 shadow"
                          title="Iniciar manga y habilitar cronometraje autoritativo"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>INICIAR</span>
                        </button>
                      )}

                      {s.status === 'RUNNING' && (
                        <div className="flex items-center space-x-1">
                          <button
                            id={`btn-stop-session-${s.id}`}
                            onClick={() => handleStopSession(s)}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-black rounded text-[11px] font-bold font-mono transition-colors cursor-pointer flex items-center space-x-1"
                            title="Pausar manga temporalmente"
                          >
                            <Square className="w-3 h-3 fill-current" />
                            <span>PAUSAR</span>
                          </button>
                          <button
                            id={`btn-close-session-${s.id}`}
                            onClick={() => handleCloseSession(s)}
                            className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[11px] font-bold font-mono transition-colors cursor-pointer flex items-center space-x-1"
                            title="Cerrar cronometraje de la manga"
                          >
                            <Flag className="w-3 h-3" />
                            <span>CERRAR</span>
                          </button>
                        </div>
                      )}

                      {s.status === 'TIMING_CLOSED' && (
                        <div className="flex items-center space-x-1">
                          <span className="px-2 py-0.5 bg-purple-950/70 border border-purple-800 text-purple-300 text-[10px] font-mono rounded">
                            CERRADA
                          </span>
                          <button
                            id={`btn-reopen-session-${s.id}`}
                            onClick={() => handleReopenSession(s)}
                            className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold font-mono transition-colors cursor-pointer flex items-center space-x-1"
                            title="Reabrir cronometraje de la manga"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>REABRIR</span>
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setEditingSession(s);
                          setShowSessionModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded transition-colors cursor-pointer"
                        title="Editar sesión"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s)}
                        className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded transition-colors cursor-pointer"
                        title="Eliminar sesión"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px] font-mono text-gray-500 pt-3 border-t border-gray-800/80">
            Regla de Equidad: Cada sesión mantiene cronometraje aislado y autoritativo.
          </div>
        </div>
      </div>

      {/* Modales de Configuración */}
      {showEventModal && (
        <EventConfigModal
          currentEvent={event}
          isNewEvent={isCreatingNewEvent}
          onEventSaved={() => {
            setShowEventModal(false);
            setIsCreatingNewEvent(false);
            setActionFeedback('Evento deportivo guardado con éxito.');
            onRefreshData();
          }}
          onCancel={() => {
            setShowEventModal(false);
            setIsCreatingNewEvent(false);
          }}
        />
      )}

      {showManualLapModal && activeSession && (
        <ManualLapModal
          sessionId={activeSession.id}
          teams={teams}
          defaultTeamId={manualLapTeamId}
          onClose={() => {
            setShowManualLapModal(false);
            setManualLapTeamId(undefined);
          }}
          onSuccess={(msg) => {
            setActionFeedback(msg);
            refreshTiming();
            onRefreshData();
          }}
        />
      )}

      {showTeamModal && (
        <TeamFormModal
          initialTeam={editingTeam}
          onTeamSaved={() => {
            setShowTeamModal(false);
            setEditingTeam(null);
            setActionFeedback(editingTeam ? 'Escudería actualizada.' : 'Nueva escudería registrada.');
            onRefreshData();
          }}
          onCancel={() => {
            setShowTeamModal(false);
            setEditingTeam(null);
          }}
        />
      )}

      {showSessionModal && (
        <SessionFormModal
          initialSession={editingSession}
          availableTeams={teams}
          onSessionSaved={() => {
            setShowSessionModal(false);
            setEditingSession(null);
            setActionFeedback(editingSession ? 'Sesión guardada con éxito.' : 'Nueva sesión creada con éxito.');
            onRefreshData();
          }}
          onCancel={() => {
            setShowSessionModal(false);
            setEditingSession(null);
          }}
        />
      )}

      {/* Diálogo de Confirmación: Cierre Oficial de Cronometraje */}
      <ConfirmModal
        isOpen={!!sessionToClose}
        title="Cerrar Cronometraje Oficial"
        message={
          sessionToClose
            ? `¿Confirmar el cierre de cronometraje para la manga "${sessionToClose.name}" (${
                sessionToClose.type === 'qualifying'
                  ? 'Clasificación'
                  : sessionToClose.type === 'race'
                  ? 'Gran Carrera'
                  : 'Sesión'
              })?`
            : ''
        }
        details={[
          'Se bloqueará de inmediato el botón de registrar vuelta en el Pit Wall de todas las escuderías.',
          'La clasificación y los tiempos de vuelta quedarán consolidados en el servidor Node.js.',
          'Podrá reabrir el cronometraje en cualquier momento desde Dirección de Carrera si lo requiere.'
        ]}
        confirmText="Cerrar Cronometraje Oficial"
        cancelText="Volver atrás"
        variant="purple"
        isLoading={isActionLoading}
        onConfirm={executeCloseSession}
        onCancel={() => setSessionToClose(null)}
      />

      {/* Diálogo de Confirmación: Eliminación de Sesión */}
      <ConfirmModal
        isOpen={!!sessionToDelete}
        title="Eliminar Sesión / Manga"
        message={
          sessionToDelete
            ? `¿Está seguro de que desea eliminar permanentemente la sesión "${sessionToDelete.name}"?`
            : ''
        }
        details={[
          'Se eliminarán todos los registros de vueltas y telemetría histórica asociados a esta manga.',
          'Esta acción es destructiva y no se puede deshacer.'
        ]}
        confirmText="Eliminar Sesión Definitivamente"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isActionLoading}
        onConfirm={executeDeleteSession}
        onCancel={() => setSessionToDelete(null)}
      />

      {/* Diálogo de Confirmación: Eliminación de Escudería */}
      <ConfirmModal
        isOpen={!!teamToDelete}
        title="Eliminar Escudería"
        message={
          teamToDelete
            ? `¿Confirmar la eliminación de la escudería "${teamToDelete.name}"${
                teamToDelete.kartName ? ` (${teamToDelete.kartName})` : teamToDelete.number ? ` (Kart #${teamToDelete.number})` : ''
              }?`
            : ''
        }
        details={[
          'La escudería perderá acceso a su panel de Pit Wall y no podrá registrar más tiempos.',
          'Los karts y pilotos asignados serán removidos de las mangas.'
        ]}
        confirmText="Eliminar Escudería"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isActionLoading}
        onConfirm={executeDeleteTeam}
        onCancel={() => setTeamToDelete(null)}
      />

      {/* Diálogo de Confirmación: Regeneración de Token */}
      <ConfirmModal
        isOpen={!!teamToRegenerate}
        title="Regenerar Token de Seguridad"
        message={
          teamToRegenerate
            ? `¿Regenerar el token de acceso para la escudería "${teamToRegenerate.name}"?`
            : ''
        }
        details={[
          'Los dispositivos conectados actualmente en el Pit Wall deberán escanear el nuevo enlace o QR.',
          'El token anterior quedará revocado inmediatamente.'
        ]}
        confirmText="Regenerar Token"
        cancelText="Cancelar"
        variant="warning"
        isLoading={isActionLoading}
        onConfirm={executeRegenerateToken}
        onCancel={() => setTeamToRegenerate(null)}
      />

      {/* Diálogo de Confirmación: Expulsión de Dispositivo */}
      <ConfirmModal
        isOpen={!!deviceToKick}
        title="Desconectar Dispositivo"
        message={
          deviceToKick
            ? `¿Desconectar la sesión activa del dispositivo "${deviceToKick.label}"?`
            : ''
        }
        details={[
          'La sesión de presencia del dispositivo será invalidada en el servidor en tiempo real.'
        ]}
        confirmText="Desconectar Dispositivo"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isActionLoading}
        onConfirm={executeKickSession}
        onCancel={() => setDeviceToKick(null)}
      />

      {/* Modal de Detalle de Estrategia de Escudería (M6) */}
      {strategyDetailTeamId && activeSession && (
        <TeamStrategyDetailModal
          isOpen={!!strategyDetailTeamId}
          team={teams.find((t) => t.id === strategyDetailTeamId) || {
            id: strategyDetailTeamId,
            eventId: activeSession.eventId || '',
            name: strategyDetailTeamId,
            color: '#3b82f6',
            token: '',
            createdAt: '',
            updatedAt: ''
          }}
          session={activeSession}
          strategy={timing?.teamsStrategy?.[strategyDetailTeamId]}
          onClose={() => setStrategyDetailTeamId(null)}
          onPitIn={handleRaceControlPitIn}
          onPitOut={handleRaceControlPitOut}
          onChangeEquipment={(tId) => {
            setStrategyChangeTeamId(tId);
            setStrategyChangeType('equipment');
          }}
          onChangePersonnel={(tId) => {
            setStrategyChangeTeamId(tId);
            setStrategyChangeType('personnel');
          }}
        />
      )}

      {/* Modal de Cambio de Compuesto / Personal para Comisarios (M6) */}
      <StrategyChangeModal
        isOpen={!!strategyChangeType && !!strategyChangeTeamId}
        type={strategyChangeType || 'equipment'}
        teamName={teams.find((t) => t.id === strategyChangeTeamId)?.name || ''}
        currentValue={
          strategyChangeType === 'equipment'
            ? timing?.teamsStrategy?.[strategyChangeTeamId!]?.currentEquipment || 'HARD'
            : timing?.teamsStrategy?.[strategyChangeTeamId!]?.currentPersonnel || 'Piloto 1'
        }
        availablePilots={teams.find((t) => t.id === strategyChangeTeamId)?.pilots}
        onClose={() => {
          setStrategyChangeType(null);
          setStrategyChangeTeamId(null);
        }}
        onSubmit={
          strategyChangeType === 'equipment'
            ? handleRaceControlEquipmentSubmit
            : handleRaceControlPersonnelSubmit
        }
        isLoading={isStrategySubmitting}
      />

      {/* Modal de Gestión de Pilotos Registrados (Pre-Sesión) */}
      {teamForPilotsModal && (
        <TeamPilotsModal
          team={teamForPilotsModal}
          onPilotsUpdated={(updatedTeam, _allTeams) => {
            setActionFeedback(`Lista de pilotos de ${updatedTeam.name} actualizada.`);
            setTeamForPilotsModal(null);
            onRefreshData();
          }}
          onClose={() => setTeamForPilotsModal(null)}
        />
      )}

      {/* Diálogo de Confirmación: Eliminar Evento y Reiniciar Plataforma */}
      <ConfirmModal
        isOpen={eventToDelete}
        title="Eliminar Evento y Reiniciar Plataforma"
        message={
          event
            ? `¿Está seguro de que desea eliminar el evento "${event.name}"?`
            : '¿Desea reiniciar la plataforma a limpio?'
        }
        details={[
          'Se eliminarán todas las escuderías, mangas, vueltas y auditoría asociadas a este evento.',
          'La plataforma quedará completamente limpia lista para una nueva jornada deportiva.'
        ]}
        confirmText="Eliminar Todo y Reiniciar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isActionLoading}
        onConfirm={executeDeleteEvent}
        onCancel={() => setEventToDelete(false)}
      />
    </div>
  );
};
