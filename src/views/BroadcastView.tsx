import React, { useState } from 'react';
import { Tv, Radio, CheckCircle, Eye } from 'lucide-react';
import { SystemHealth, EventModel, TeamModel, SessionModel } from '../types';
import { useRealtimeTiming } from '../hooks/useRealtimeTiming';

interface Props {
  health?: SystemHealth | null;
  event: EventModel | null;
  teams: TeamModel[];
  sessions: SessionModel[];
}

export const BroadcastView: React.FC<Props> = ({ event, teams, sessions }) => {
  const [isTransparentMode, setIsTransparentMode] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<'lower-third' | 'tower'>('lower-third');

  const activeSession = sessions.find((s) => s.status === 'RUNNING') || sessions[0];
  const { timing, isLive, revision } = useRealtimeTiming(activeSession?.id);

  const formatLapTime = (ms?: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const totalSecs = ms / 1000;
    const minutes = Math.floor(totalSecs / 60);
    const seconds = Math.floor(totalSecs % 60);
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const fastestLapTeam = teams.find((t) => t.id === timing?.fastestLapTeamId);

  // Modo transparente puro (para OBS Browser Source)
  if (isTransparentMode) {
    return (
      <div className="fixed inset-0 bg-transparent flex flex-col justify-end p-6 select-none pointer-events-auto">
        <button
          onClick={() => setIsTransparentMode(false)}
          className="fixed top-4 right-4 z-50 px-2.5 py-1 text-[11px] font-mono bg-black/80 hover:bg-black text-gray-300 rounded border border-gray-700 cursor-pointer"
        >
          Salir de Modo OBS
        </button>

        {layoutMode === 'lower-third' ? (
          /* Tira Lower-Third */
          <div className="w-full max-w-5xl mx-auto bg-black/90 backdrop-blur-md border border-gray-700/80 rounded-xl p-3 shadow-2xl font-mono">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                <span className="font-bold text-white uppercase tracking-wider">
                  {event?.name || 'CARRERA DE KARTS'} · {activeSession?.name || 'MANGA 1'}
                </span>
                <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[10px]">
                  EN VIVO
                </span>
              </div>
              {fastestLapTeam && timing?.fastestLapMs && (
                <div className="text-[11px] text-purple-400 flex items-center space-x-1">
                  <span>VR: {fastestLapTeam.name}</span>
                  <span className="font-bold">({formatLapTime(timing.fastestLapMs)})</span>
                </div>
              )}
            </div>

            {/* Clasificación horizontal desplazable */}
            <div className="flex items-center space-x-3 overflow-x-auto py-1 scrollbar-none">
              {timing?.leaderboard.map((item) => {
                const teamInfo = teams.find((t) => t.id === item.teamId);
                return (
                  <div
                    key={item.teamId}
                    className="flex-shrink-0 bg-gray-900/90 border border-gray-800 px-3 py-1.5 rounded flex items-center space-x-2 text-xs"
                  >
                    <span
                      className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                        item.position === 1 ? 'bg-amber-400 text-black' : 'bg-gray-800 text-white'
                      }`}
                    >
                      P{item.position}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: teamInfo?.color || '#3b82f6' }}
                    />
                    <span className="font-bold text-gray-200">{teamInfo?.name || item.teamId}</span>
                    <span className="text-gray-400 text-[11px]">V:{item.lapCount}</span>
                    <span className="text-cyan-400 font-bold">{formatLapTime(item.lastLapMs)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Torre lateral izquierda (Side Tower) */
          <div className="fixed top-8 left-8 w-72 bg-black/90 backdrop-blur-md border border-gray-700 rounded-xl p-3 shadow-2xl font-mono">
            <div className="border-b border-gray-800 pb-2 mb-2">
              <div className="text-[10px] text-red-500 font-bold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                <span>OBS STREAM OVERLAY</span>
              </div>
              <div className="text-sm font-bold text-white uppercase truncate">
                {activeSession?.name || 'Manga Activa'}
              </div>
            </div>
            <div className="space-y-1.5">
              {timing?.leaderboard.map((item) => {
                const teamInfo = teams.find((t) => t.id === item.teamId);
                return (
                  <div
                    key={item.teamId}
                    className="flex items-center justify-between bg-gray-900/80 px-2.5 py-1 rounded text-xs"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-black text-amber-400 w-5">P{item.position}</span>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: teamInfo?.color || '#3b82f6' }}
                      />
                      <span className="font-bold text-gray-200 truncate">
                        {teamInfo?.name || item.teamId}
                      </span>
                    </div>
                    <span className="text-purple-400 text-[11px] font-bold">
                      {formatLapTime(item.bestLapMs)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vista de Control y Previsualización de Estudio
  return (
    <div className="space-y-4 py-4 max-w-6xl mx-auto">
      {/* Barra de Control de Transmisión */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-400">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Estudio de Gráficos de Transmisión (OBS)
            </h2>
            <div className="text-xs font-mono text-gray-400 flex items-center space-x-2">
              <span className={isLive ? 'text-emerald-400' : 'text-gray-500'}>
                {isLive ? '● Telemetría SSE en vivo' : '○ Conectando...'}
              </span>
              <span>·</span>
              <span>Rev. #{revision}</span>
              <span>·</span>
              <span>Formato 16:9 / 1080p</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          {/* Selector de Layout */}
          <div className="bg-[#0a0c10] border border-gray-800 p-0.5 rounded-lg flex items-center">
            <button
              onClick={() => setLayoutMode('lower-third')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                layoutMode === 'lower-third'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Lower-Third
            </button>
            <button
              onClick={() => setLayoutMode('tower')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                layoutMode === 'tower'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Torre Lateral
            </button>
          </div>

          <button
            onClick={() => setIsTransparentMode(true)}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors cursor-pointer flex items-center space-x-1.5 shadow"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Modo OBS Transparente</span>
          </button>
        </div>
      </div>

      {/* Monitor 16:9 con Vista Previa del Gráfico en Tiempo Real */}
      <div className="bg-[#0a0c10] border border-gray-800 rounded-2xl p-6 sm:p-8 aspect-[16/9] flex flex-col justify-between relative overflow-hidden shadow-2xl">
        {/* Fondo simulando cámara de pista */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-gray-900/60 to-black/80 pointer-events-none" />

        {/* Marca de agua de producción */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-2 px-3 py-1 bg-black/80 border border-amber-500/30 rounded font-mono text-[11px] text-amber-300">
            <Radio className="w-3.5 h-3.5 animate-pulse text-red-500" />
            <span>OBS BROWSER SOURCE · PREVISUALIZACIÓN 16:9</span>
          </div>

          <div className="font-mono text-xs text-gray-400 bg-black/60 px-3 py-1 rounded border border-gray-800">
            {event?.name || 'Gran Premio'} · {activeSession?.name || 'Manga 1'}
          </div>
        </div>

        {/* Overlay en vivo: Lower-Third o Torre */}
        <div className="relative z-10">
          {layoutMode === 'lower-third' ? (
            <div className="bg-[#10141d]/95 backdrop-blur-md border border-gray-700/80 rounded-xl p-4 shadow-2xl max-w-4xl mx-auto w-full font-mono">
              <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white font-bold uppercase tracking-wider">
                    {activeSession?.name || 'Manga en curso'} ({activeSession?.status || 'SCHEDULED'})
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.5 rounded">
                    EN VIVO
                  </span>
                </div>
                {fastestLapTeam && timing?.fastestLapMs && (
                  <div className="text-[11px] text-purple-400 flex items-center space-x-1.5">
                    <span className="text-gray-400">Vuelta Rápida:</span>
                    <span className="font-bold text-white">{fastestLapTeam.name}</span>
                    <span className="text-purple-300 font-bold">
                      {formatLapTime(timing.fastestLapMs)}
                    </span>
                  </div>
                )}
              </div>

              {/* Tira horizontal de karts y posiciones */}
              {timing && timing.leaderboard && timing.leaderboard.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-tabular">
                  {timing.leaderboard.slice(0, 4).map((item) => {
                    const teamInfo = teams.find((t) => t.id === item.teamId);
                    return (
                      <div
                        key={item.teamId}
                        className="bg-[#07090e] border border-gray-800 rounded p-2 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span
                            className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                              item.position === 1
                                ? 'bg-amber-400 text-black'
                                : 'bg-gray-800 text-white'
                            }`}
                          >
                            P{item.position}
                          </span>
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: teamInfo?.color || '#3b82f6' }}
                          />
                          <span className="font-bold text-gray-200 truncate">
                            {teamInfo?.name || item.teamId}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0 pl-1">
                          <div className="text-[11px] text-cyan-400 font-bold">
                            {formatLapTime(item.lastLapMs)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-gray-500">
                  Esperando cruces de meta en la manga activa...
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#10141d]/95 backdrop-blur-md border border-gray-700/80 rounded-xl p-3 shadow-2xl w-64 font-mono">
              <div className="border-b border-gray-800 pb-2 mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase">CLASIFICACIÓN</span>
                <span className="text-[10px] text-emerald-400">EN VIVO</span>
              </div>
              <div className="space-y-1">
                {timing?.leaderboard.map((item) => {
                  const teamInfo = teams.find((t) => t.id === item.teamId);
                  return (
                    <div
                      key={item.teamId}
                      className="flex items-center justify-between bg-[#07090e] px-2 py-1 rounded text-xs"
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        <span className="font-black text-amber-400 w-4 text-[10px]">P{item.position}</span>
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: teamInfo?.color || '#3b82f6' }}
                        />
                        <span className="font-bold text-gray-200 truncate text-[11px]">
                          {teamInfo?.name || item.teamId}
                        </span>
                      </div>
                      <span className="text-purple-400 text-[10px] font-bold">
                        {formatLapTime(item.bestLapMs)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pie de Pantalla de Transmisión */}
        <div className="relative z-10 flex items-center justify-between text-xs font-mono text-gray-500">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>Arquitectura Autoritativa: Datos alimentados por SSE sin retraso de transcodificación</span>
          </div>
          <div className="text-gray-400">URL para OBS: {window.location.origin}/broadcast</div>
        </div>
      </div>
    </div>
  );
};
