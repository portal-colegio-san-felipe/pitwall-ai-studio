import React from 'react';
import { Gauge, Shield, Flag, Monitor, Tv, Settings, BookOpen } from 'lucide-react';
import { ConnectionStatus, SystemHealth } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  currentPath: string;
  onNavigate: (path: string) => void;
  connectionStatus: ConnectionStatus;
  health: SystemHealth | null;
  onRetryConnection: () => void;
  isHidden?: boolean;
}

export const Header: React.FC<Props> = ({
  currentPath,
  onNavigate,
  connectionStatus,
  health,
  onRetryConnection,
  isHidden = false
}) => {
  if (isHidden) return null;

  const navItems = [
    { path: '/', label: 'Centro de Control', icon: Gauge },
    { path: '/race-control', label: 'Race Control', icon: Shield },
    { path: '/pit-wall', label: 'Pit Wall', icon: Flag },
    { path: '/display', label: 'Pantalla 16:9', icon: Monitor },
    { path: '/broadcast', label: 'Transmisión', icon: Tv },
    { path: '/manual', label: 'Manual', icon: BookOpen },
    { path: '/admin', label: 'Admin Técnica', icon: Settings }
  ];

  return (
    <header id="main-app-header" className="bg-[#11141c] border-b border-gray-800/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo y título de la aplicación */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onNavigate('/')}>
            <div className="w-9 h-9 rounded bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-black tracking-widest text-sm">
              PW
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-wider text-sm sm:text-base text-white uppercase">
                  Pit Wall & Race Control
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 rounded border border-emerald-700/60">
                  M5 AUDITORÍA
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono tracking-tight hidden sm:block">
                Carrera Escolar de Karts · Servidor Autoritativo
              </p>
            </div>
          </div>

          {/* Navegación entre superficies */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  id={`nav-${item.path.replace('/', '') || 'home'}`}
                  onClick={() => onNavigate(item.path)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Estados de presencia y persistencia */}
          <div className="flex items-center space-x-3">
            {health?.persistence && (
              <div
                id="header-persistence-badge"
                className={`hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
                  health.persistence.reachable
                    ? 'bg-gray-900 border-gray-700 text-emerald-400'
                    : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${health.persistence.reachable ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>PERSISTENCIA: {health.persistence.type.toUpperCase()}</span>
              </div>
            )}
            <StatusBadge
              status={connectionStatus}
              onRetry={onRetryConnection}
            />
          </div>
        </div>

        {/* Barra de navegación móvil */}
        <div className="md:hidden flex overflow-x-auto py-2 space-x-2 border-t border-gray-800/60 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-gray-400 hover:text-gray-200 bg-gray-900/60'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
