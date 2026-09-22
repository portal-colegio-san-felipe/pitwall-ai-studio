import { useState, useEffect, useRef, useCallback } from 'react';
import { TimingOverview } from '../types';

interface RealtimeTimingResult {
  timing: TimingOverview | null;
  isLoading: boolean;
  isLive: boolean;
  revision: number;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRealtimeTiming(sessionId: string | undefined): RealtimeTimingResult {
  const [timing, setTiming] = useState<TimingOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const currentRevision = useRef<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchAuthoritativeTiming = useCallback(async () => {
    if (!sessionId) {
      setTiming(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}/timing`);
      if (!res.ok) {
        if (res.status === 404) {
          setTiming(null);
        }
        return;
      }
      const data = await res.json();
      if (data.ok && data.timing) {
        const incomingRevision = data.timing.revision || 0;
        // Protección contra sobreescrituras obsoletas (M4)
        if (incomingRevision >= currentRevision.current) {
          currentRevision.current = incomingRevision;
          setTiming(data.timing);
          setError(null);
        }
      }
    } catch {
      setError('Error al sincronizar tiempos autoritativos');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setTiming(null);
      setIsLoading(false);
      setIsLive(false);
      return;
    }

    setIsLoading(true);
    fetchAuthoritativeTiming();

    // Conectar stream Server-Sent Events (SSE) en tiempo real
    const streamUrl = `/api/timing/stream?sessionId=${encodeURIComponent(sessionId)}`;
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setIsLive(true);
      setError(null);
    });

    es.addEventListener('timing_update', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.sessionId === sessionId && payload.data) {
          const incomingRevision = payload.revision || payload.data.revision || 0;
          // Verificar versión para prevenir cualquier estado rancio
          if (incomingRevision >= currentRevision.current) {
            currentRevision.current = incomingRevision;
            setTiming(payload.data);
            setIsLive(true);
            setError(null);
          }
        }
      } catch {
        // Fallback silencioso
      }
    });

    es.addEventListener('session_update', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (payload.sessionId === sessionId) {
          fetchAuthoritativeTiming();
        }
      } catch {
        // Fallback
      }
    });

    es.onerror = () => {
      setIsLive(false);
      // El navegador reintentará la conexión SSE automáticamente.
      // Al reconectar, ejecutamos una lectura autoritativa para resincronizar
      fetchAuthoritativeTiming();
    };

    // Heartbeat de seguridad periódico (cada 3 segundos) por si el stream se interrumpe
    const fallbackInterval = setInterval(() => {
      fetchAuthoritativeTiming();
    }, 3000);

    return () => {
      clearInterval(fallbackInterval);
      es.close();
      eventSourceRef.current = null;
    };
  }, [sessionId, fetchAuthoritativeTiming]);

  return {
    timing,
    isLoading,
    isLive,
    revision: currentRevision.current,
    error,
    refresh: fetchAuthoritativeTiming
  };
}
