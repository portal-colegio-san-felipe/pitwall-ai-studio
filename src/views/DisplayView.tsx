import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Maximize, Minimize, Flag, Clock, Zap } from 'lucide-react';
import { SystemHealth, EventModel, TeamModel, SessionModel } from '../types';
import { usePresence } from '../hooks/usePresence';
import { useRealtimeTiming } from '../hooks/useRealtimeTiming';

interface Props {
  health: SystemHealth | null;
  event: EventModel | null;
  teams: TeamModel[];
  sessions: SessionModel[];
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const DisplayView: React.FC<Props> = ({
  event,
  teams,
  sessions,
  onFullscreenChange
}) => {
  // Registrar presencia de pantalla 16:9
  usePresence({ role: 'display' });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.status === 'RUNNING') || sessions[0];
  const { timing, isLive } = useRealtimeTiming(activeSession?.id);

  // Alternar pantalla completa
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as unknown as { webkitRequestFullscreen?: () => Promise<void> })?.webkitRequestFullscreen) {
          await (containerRef.current as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        } else {
          setIsFullscreen(true);
          onFullscreenChange?.(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else {
          setIsFullscreen(false);
          onFullscreenChange?.(false);
        }
      }
    } catch {
      const nextState = !isFullscreen;
      setIsFullscreen(nextState);
      onFullscreenChange?.(nextState);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      onFullscreenChange?.(isFs);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [onFullscreenChange]);

  // Consultar tiempos de la sesión activa
  useEffect(() => {
    if (!activeSession) return;

    const fetchTiming = async () => {
      try {
        const res = await fetch(`/api/sessions/${activeSession.id}/timing`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            setTiming(data.timing);
          }
        }
      } catch {
        // En espera de primera carga
      }
    };

    fetchTiming();
    const interval = setInterval(fetchTiming, 2000);
    return () => clearInterval(interval);
  }, [activeSession?.id]);

  // Formatear milisegundos a m:ss.sss
  const formatLapTime = (ms?: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const totalSecs = ms / 1000;
    const minutes = Math.floor(totalSecs / 60);
    const seconds = Math.floor(totalSecs % 60);
    const millis = Math.floor((ms % 1000));
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-[100] bg-[#07090e] flex flex-col justify-between p-4 sm:p-8 overflow-hidden'
          : 'space-y-4 py-4 max-w-6xl mx-auto'
      }`}
    >
      {/* Marco 16:9 de lectura pública */}
      <div
        className={`bg-[#10141d] border border-gray-800 rounded-2xl p-5 sm:p-8 shadow-2xl flex flex-col justify-between ${
          isFullscreen ? 'w-full h-full border-none shadow-none rounded-none !p-4' : 'min-h-[580px]'
        }`}
      >
        {/* Cabecera Simplificada y Elegante */}
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
          {/* Lado Izquierdo: Icono + Título Limpio */}
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-400 flex items-center justify-center">
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tight font-display">
                TABLA DE CLASIFICACIÓN
              </h1>
              {event?.name && (
                <div className="text-xs font-mono text-gray-400">
                  {event.name} {event.edition ? `· ${event.edition}` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Lado Derecho: Estado de Carrera + Botón Pantalla Completa */}
          <div className="flex items-center space-x-4">
            <div className="text-right font-mono">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">ESTADO DE CARRERA</div>
              <div
                className={`text-sm sm:text-base font-bold uppercase tracking-wider ${
                  activeSession?.status === 'RUNNING'
                    ? 'text-emerald-400 flex items-center justify-end space-x-1.5'
                    : activeSession?.status === 'TIMING_CLOSED'
                    ? 'text-purple-400'
                    : 'text-amber-400'
                }`}
              >
                {activeSession?.status === 'RUNNING' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <span>
                  {activeSession
                    ? `${activeSession.name} (${activeSession.status === 'RUNNING' ? 'EN VIVO' : activeSession.status})`
                    : 'SIN SESIÓN ACTIVA'}
                </span>
              </div>
            </div>

            {/* Botón de Pantalla Completa */}
            <button
              id="btn-toggle-fullscreen"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Activar pantalla completa'}
              className="p-2.5 sm:px-3 sm:py-2 rounded-xl bg-gray-900 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-mono font-bold shadow"
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">SALIR</span>
                </>
              ) : (
                <>
                  <Maximize className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline">PANTALLA COMPLETA</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Cuerpo Principal: Tabla de Clasificación en Vivo */}
        <div className="my-auto py-4 flex-1 flex flex-col justify-center">
          {teams.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 mx-auto">
                <Flag className="w-7 h-7" />
              </div>
              <div className="text-lg font-bold text-gray-300 uppercase">Sin Escuderías Registradas</div>
              <p className="text-xs text-gray-500 font-mono max-w-md mx-auto">
                Configure el evento y las escuderías en Dirección de Carrera para comenzar la competición escolar.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-hidden rounded-xl border border-gray-800/80 bg-[#0b0e14]">
              <table className="w-full text-left font-mono">
                <thead>
                  <tr className="bg-[#121620] text-gray-400 text-[11px] sm:text-xs uppercase border-b border-gray-800">
                    <th className="py-3 px-3 sm:px-4 text-center w-12 sm:w-16">POS</th>
                    <th className="py-3 px-3 sm:px-4">ESCUDERÍA</th>
                    <th className="py-3 px-3 sm:px-4 text-center">VUELTAS</th>
                    <th className="py-3 px-3 sm:px-4 text-right">ÚLTIMA</th>
                    <th className="py-3 px-3 sm:px-4 text-right">MEJOR VUELTA</th>
                    <th className="py-3 px-3 sm:px-4 text-right hidden sm:table-cell">DIFERENCIA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-xs sm:text-sm">
                  {teams.map((t, idx) => {
                    const stats = timing?.leaderboard.find((entry) => entry.teamId === t.id);
                    const isFastestOfSession = timing?.fastestLapTeamId === t.id && (stats?.bestLapMs || 0) > 0;
                    const pos = idx + 1;

                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors ${
                          pos === 1
                            ? 'bg-amber-950/20 hover:bg-amber-950/30'
                            : 'hover:bg-gray-800/20'
                        }`}
                      >
                        {/* Posición */}
                        <td className="py-3 px-3 sm:px-4 text-center font-black">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
                              pos === 1
                                ? 'bg-amber-500 text-black shadow'
                                : pos === 2
                                ? 'bg-gray-300 text-black'
                                : pos === 3
                                ? 'bg-amber-700 text-white'
                                : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {pos}
                          </span>
                        </td>

                        {/* Escudería */}
                        <td className="py-3 px-3 sm:px-4 font-sans">
                          <div className="flex items-center space-x-2.5">
                            <span
                              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: t.color || '#3b82f6' }}
                            />
                            <div className="truncate">
                              <span className="font-bold text-white tracking-wide text-sm sm:text-base">
                                {t.name}
                              </span>
                              {t.kartName && (
                                <span className="text-[10px] font-mono text-gray-500 ml-2">
                                  [{t.kartName}]
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Vueltas */}
                        <td className="py-3 px-3 sm:px-4 text-center font-bold text-sm sm:text-base text-white">
                          {stats?.lapCount || 0}
                          {activeSession?.targetLaps ? (
                            <span className="text-[10px] font-normal text-gray-500">
                              /{activeSession.targetLaps}
                            </span>
                          ) : null}
                        </td>

                        {/* Última Vuelta */}
                        <td className="py-3 px-3 sm:px-4 text-right text-gray-300 font-tabular font-bold">
                          {formatLapTime(stats?.lastLapMs)}
                        </td>

                        {/* Mejor Vuelta */}
                        <td className="py-3 px-3 sm:px-4 text-right font-tabular">
                          <div className="flex items-center justify-end space-x-1.5">
                            {isFastestOfSession && (
                              <Zap className="w-3.5 h-3.5 text-purple-400 animate-bounce" />
                            )}
                            <span
                              className={`font-bold ${
                                isFastestOfSession
                                  ? 'text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/40'
                                  : 'text-cyan-400'
                              }`}
                            >
                              {formatLapTime(stats?.bestLapMs)}
                            </span>
                          </div>
                        </td>

                        {/* Diferencia / Gap */}
                        <td className="py-3 px-3 sm:px-4 text-right text-gray-400 font-tabular hidden sm:table-cell">
                          {pos === 1 ? (
                            <span className="text-emerald-400 font-bold">LÍDER</span>
                          ) : stats?.gapMs ? (
                            `+${(stats.gapMs / 1000).toFixed(3)}s`
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Barra inferior: Únicamente visible cuando NO está en pantalla completa,
            limpia de notas internas de desarrollo como solicitó el usuario */}
        {!isFullscreen && (
          <div className="flex items-center justify-between border-t border-gray-800/80 pt-3 text-[11px] font-mono text-gray-500">
            <div className="flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cronometraje Autoritativo · Actualización en tiempo real</span>
            </div>
            <div className="flex items-center space-x-3">
              <span>Proporción optimizada 16:9</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
