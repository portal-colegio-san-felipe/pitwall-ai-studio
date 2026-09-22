import React, { useState, useEffect, useCallback } from 'react';
import { ConnectionStatus, SystemHealth, EventModel, TeamModel, SessionModel, EventStateResponse } from './types';
import { Header } from './components/Header';
import { HomeView } from './views/HomeView';
import { RaceControlView } from './views/RaceControlView';
import { PitWallView } from './views/PitWallView';
import { DisplayView } from './views/DisplayView';
import { BroadcastView } from './views/BroadcastView';
import { ManualView } from './views/ManualView';
import { AdminView } from './views/AdminView';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('ONLINE');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Estado del Evento, Escuderías y Sesiones
  const [event, setEvent] = useState<EventModel | null>(null);
  const [teams, setTeams] = useState<TeamModel[]>([]);
  const [sessions, setSessions] = useState<SessionModel[]>([]);

  // Comprobar la salud del servidor autoritativo
  const fetchHealth = useCallback(async () => {
    try {
      setConnectionStatus((prev) => (prev === 'OFFLINE' ? 'RECONNECTING' : prev));
      const res = await fetch('/api/health');
      if (res.ok) {
        const data: SystemHealth = await res.json();
        setHealth(data);
        setConnectionStatus('ONLINE');
      } else {
        setConnectionStatus('OFFLINE');
      }
    } catch {
      setConnectionStatus('OFFLINE');
    }
  }, []);

  // Cargar datos de evento, escuderías y sesiones desde el servidor
  const fetchEventData = useCallback(async () => {
    try {
      const res = await fetch('/api/event');
      if (res.ok) {
        const data: EventStateResponse = await res.json();
        if (data.ok) {
          setEvent(data.event);
          setTeams(data.teams || []);
          setSessions(data.sessions || []);
        }
      }
    } catch (err) {
      console.error('Error al cargar datos del evento:', err);
    }
  }, []);

  const refreshAllData = useCallback(() => {
    fetchHealth();
    fetchEventData();
  }, [fetchHealth, fetchEventData]);

  // Escuchar eventos de navegación del navegador (popstate)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Escuchar cambios de fullscreen del navegador
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Escuchar eventos de red del navegador
  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus('RECONNECTING');
      refreshAllData();
    };
    const handleOffline = () => {
      setConnectionStatus('OFFLINE');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Carga inicial
    refreshAllData();
    const interval = setInterval(refreshAllData, 8000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshAllData]);

  const handleNavigate = (path: string) => {
    window.history.pushState({}, '', path);
    // Preservar path puro para switch pero soportar query params
    const cleanPath = path.split('?')[0];
    setCurrentPath(cleanPath);
  };

  const renderCurrentView = () => {
    const purePath = currentPath.split('?')[0];

    switch (purePath) {
      case '/race-control':
        return (
          <RaceControlView
            health={health}
            event={event}
            teams={teams}
            sessions={sessions}
            onRefreshData={refreshAllData}
            onNavigate={handleNavigate}
          />
        );
      case '/pit-wall':
        return (
          <PitWallView
            availableTeams={teams}
            onNavigate={handleNavigate}
          />
        );
      case '/display':
        return (
          <DisplayView
            health={health}
            event={event}
            teams={teams}
            sessions={sessions}
            onFullscreenChange={setIsFullscreen}
          />
        );
      case '/broadcast':
        return <BroadcastView health={health} />;
      case '/manual':
        return <ManualView />;
      case '/admin':
        return <AdminView health={health} onRefreshHealth={refreshAllData} />;
      case '/':
      default:
        return (
          <HomeView
            health={health}
            event={event}
            teams={teams}
            sessions={sessions}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-100 flex flex-col font-sans">
      {/* El encabezado se oculta automáticamente en pantalla completa para experiencia pura 16:9 */}
      <Header
        currentPath={currentPath}
        onNavigate={handleNavigate}
        connectionStatus={connectionStatus}
        health={health}
        onRetryConnection={refreshAllData}
        isHidden={isFullscreen}
      />

      <main className={`flex-1 w-full mx-auto ${isFullscreen ? 'p-0 max-w-none' : 'max-w-7xl px-4 sm:px-6 lg:px-8'}`}>
        {renderCurrentView()}
      </main>

      {!isFullscreen && (
        <footer className="border-t border-gray-900 bg-[#0e1118] py-4 text-center text-xs font-mono text-gray-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Pit Wall / Race Control escolar · Competición de Karts</span>
            <span>Hito M2: Acceso por Token, Presencia, Multi-Dispositivo y Recuperación</span>
          </div>
        </footer>
      )}
    </div>
  );
};
