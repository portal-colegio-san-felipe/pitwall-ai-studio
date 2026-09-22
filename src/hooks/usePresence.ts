import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionStatus, ClientRole } from '../types';

function getOrGenerateSessionId(): string {
  let id = sessionStorage.getItem('pw_device_session_id');
  if (!id) {
    id = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('pw_device_session_id', id);
  }
  return id;
}

function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  let os = 'PC';
  if (/Windows/i.test(ua)) os = 'Win';
  else if (/Mac/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';

  return `${isMobile ? 'Móvil' : 'Escritorio'} (${os})`;
}

interface UsePresenceOptions {
  role: ClientRole;
  teamId?: string;
  teamName?: string;
  enabled?: boolean;
}

export function usePresence({ role, teamId, teamName, enabled = true }: UsePresenceOptions) {
  const [sessionId] = useState<string>(getOrGenerateSessionId);
  const [status, setStatus] = useState<ConnectionStatus>('ONLINE');
  const [isKicked, setIsKicked] = useState<boolean>(false);
  const [kickMessage, setKickMessage] = useState<string>('');
  const failureCountRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const sendHeartbeat = useCallback(async () => {
    if (!enabled || isKicked) return;

    try {
      const res = await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          role,
          teamId,
          teamName,
          deviceInfo: getDeviceInfo()
        })
      });

      if (res.status === 403) {
        const body = await res.json();
        if (body.kicked) {
          setIsKicked(true);
          setKickMessage(body.message || 'Sesión desconectada por Dirección de Carrera.');
          setStatus('OFFLINE');
          return;
        }
      }

      if (res.ok) {
        failureCountRef.current = 0;
        setStatus('ONLINE');
      } else {
        failureCountRef.current += 1;
        if (failureCountRef.current >= 3) {
          setStatus('OFFLINE');
        } else {
          setStatus('RECONNECTING');
        }
      }
    } catch {
      failureCountRef.current += 1;
      if (failureCountRef.current >= 3) {
        setStatus('OFFLINE');
      } else {
        setStatus('RECONNECTING');
      }
    }
  }, [sessionId, role, teamId, teamName, enabled, isKicked]);

  // Enviar heartbeat periódicamente
  useEffect(() => {
    if (!enabled) return;

    sendHeartbeat();
    timerRef.current = setInterval(sendHeartbeat, 8000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sendHeartbeat, enabled]);

  // Manejar desconexión limpia al cerrar pestaña o ventana
  useEffect(() => {
    const handleUnload = () => {
      if (sessionId) {
        const payload = JSON.stringify({ sessionId });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/presence/leave', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/api/presence/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          });
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sessionId]);

  const reconnect = useCallback(() => {
    setIsKicked(false);
    setKickMessage('');
    failureCountRef.current = 0;
    setStatus('RECONNECTING');
    sendHeartbeat();
  }, [sendHeartbeat]);

  return {
    sessionId,
    status,
    isKicked,
    kickMessage,
    reconnect
  };
}
