import { useState, useEffect } from 'react';
import { SessionStatus } from '../types';

interface UseSessionTimerOptions {
  startedAt?: number;
  status?: SessionStatus | string;
  closedAt?: number;
}

export interface SessionTimerResult {
  elapsedMs: number;
  formattedTime: string; // e.g. "18:42.6" or "1:02:15.4"
  formattedShort: string; // e.g. "18:42" or "1:02:15"
  isRunning: boolean;
  isClosed: boolean;
}

export function formatSessionElapsedTime(elapsedMs: number, withTenths: boolean = true): string {
  if (elapsedMs <= 0) {
    return withTenths ? '00:00.0' : '00:00';
  }

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((elapsedMs % 1000) / 100);

  const secStr = seconds.toString().padStart(2, '0');
  const minStr = minutes.toString().padStart(2, '0');

  if (hours > 0) {
    const base = `${hours}:${minStr}:${secStr}`;
    return withTenths ? `${base}.${tenths}` : base;
  }

  const base = `${minStr}:${secStr}`;
  return withTenths ? `${base}.${tenths}` : base;
}

/**
 * Hook sensible para medir y visualizar el tiempo de sesión en el cliente
 * SIN llamadas de red adicionales ni polling al servidor (utiliza el startedAt autoritativo).
 */
export function useSessionTimer({
  startedAt,
  status,
  closedAt
}: UseSessionTimerOptions): SessionTimerResult {
  const isRunning = status === 'RUNNING';
  const isClosed = status === 'TIMING_CLOSED' || status === 'OFFICIAL';

  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    // Solo actualizar el reloj si la sesión está activamente en curso
    if (!isRunning || !startedAt) {
      return;
    }

    // Intervalo de 100ms para precisión visual de décimas sin sobrecargar el hilo de render
    const timerId = setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => clearInterval(timerId);
  }, [isRunning, startedAt]);

  if (!startedAt) {
    return {
      elapsedMs: 0,
      formattedTime: '00:00.0',
      formattedShort: '00:00',
      isRunning: false,
      isClosed: false
    };
  }

  // Si está cerrada, congela el tiempo en closedAt o en el último momento
  const endTimestamp = isClosed && closedAt ? closedAt : isRunning ? now : startedAt;
  const elapsedMs = Math.max(0, endTimestamp - startedAt);

  return {
    elapsedMs,
    formattedTime: formatSessionElapsedTime(elapsedMs, true),
    formattedShort: formatSessionElapsedTime(elapsedMs, false),
    isRunning,
    isClosed
  };
}
