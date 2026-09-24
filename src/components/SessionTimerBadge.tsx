import React from 'react';
import { Clock } from 'lucide-react';
import { SessionStatus } from '../types';
import { useSessionTimer } from '../hooks/useSessionTimer';

interface SessionTimerBadgeProps {
  startedAt?: number;
  status?: SessionStatus | string;
  closedAt?: number;
  variant: 'race-control' | 'pit-wall' | 'display' | 'broadcast';
  className?: string;
}

export const SessionTimerBadge: React.FC<SessionTimerBadgeProps> = ({
  startedAt,
  status,
  closedAt,
  variant,
  className = ''
}) => {
  const { formattedTime, formattedShort, isRunning, isClosed } = useSessionTimer({
    startedAt,
    status,
    closedAt
  });

  if (!startedAt && status !== 'RUNNING') {
    return null;
  }

  // 1. Race Control: El director necesita saber cuánto lleva corriendo la sesión y relacionar eventos con el tiempo
  if (variant === 'race-control') {
    return (
      <div
        className={`bg-[#0a0c10] border border-gray-800 rounded-lg px-3 py-1.5 flex items-center space-x-2.5 font-mono shadow-inner ${className}`}
        title={isRunning ? 'Tiempo transcurrido de la sesión activa' : 'Tiempo final de la sesión'}
      >
        <div className="flex items-center space-x-1.5 text-gray-400">
          <Clock className={`w-3.5 h-3.5 ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-purple-400'}`} />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
            {isClosed ? 'Tiempo Final' : 'Tiempo Sesión'}
          </span>
        </div>
        <div className="flex items-baseline space-x-1">
          <span className={`text-sm font-black font-tabular tracking-wide ${isRunning ? 'text-white' : 'text-purple-200'}`}>
            {formattedTime}
          </span>
          {isRunning && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
          )}
        </div>
      </div>
    );
  }

  // 2. Pit Wall: Útil para estrategia y contexto, pero el resto de la interfaz y controles deben seguir dominando
  if (variant === 'pit-wall') {
    return (
      <div
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#0a0c10]/90 border border-gray-800 text-xs font-mono select-none ${className}`}
        title="Tiempo de carrera transcurrido"
      >
        <Clock className={`w-3 h-3 ${isRunning ? 'text-cyan-400' : 'text-gray-500'}`} />
        <span className="text-[10px] text-gray-500 font-bold uppercase">T+</span>
        <span className={`font-bold font-tabular ${isRunning ? 'text-cyan-300' : 'text-gray-400'}`}>
          {formattedShort}
        </span>
      </div>
    );
  }

  // 3. Pantalla Gigante (Display): Muy natural para espectadores: TIEMPO 18:42.6 o similar en el header
  if (variant === 'display') {
    return (
      <div
        className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-black/70 border border-gray-700/80 backdrop-blur-sm font-mono shadow-md ${className}`}
      >
        <div className="flex items-center space-x-1 text-cyan-400">
          <Clock className={`w-4 h-4 ${isRunning ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-extrabold tracking-widest uppercase text-gray-400">
            TIEMPO
          </span>
        </div>
        <span className="text-base sm:text-lg font-black text-amber-300 tracking-wider font-tabular">
          {formattedTime}
        </span>
        {isRunning && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
        )}
      </div>
    );
  }

  // 4. Broadcast: Queda muy bien como elemento televisivo y contextualiza el stream
  return (
    <div
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-black/80 border border-gray-700/70 font-mono text-xs shadow-sm ${className}`}
    >
      <Clock className={`w-3 h-3 ${isRunning ? 'text-red-400 animate-pulse' : 'text-gray-400'}`} />
      <span className="text-[10px] text-gray-400 font-bold uppercase">T:</span>
      <span className="font-extrabold text-white font-tabular tracking-wide text-xs">
        {formattedTime}
      </span>
    </div>
  );
};
