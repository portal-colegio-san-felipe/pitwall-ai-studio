import React from 'react';
import { Gauge, Shield, Flag, Monitor, Tv, Settings, BookOpen, Lock, LogOut } from 'lucide-react';
import { ConnectionStatus, SystemHealth, TeamModel } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  currentPath: string;
  onNavigate: (path: string) => void;
  connectionStatus: ConnectionStatus;
  health: SystemHealth | null;
  onRetryConnection: () => void;
  isHidden?: boolean;
  authenticatedTeam?: TeamModel | null;
  onLogoutTeam?: () => void;
}

export const Header: React.FC<Props> = ({
  currentPath,
  onNavigate,
  connectionStatus,
  health,
  onRetryConnection,
  isHidden = false,
  authenticatedTeam = null,
  onLogoutTeam
}) => {
  if (isHidden) return null;

  const isPitWallLocked = !!authenticatedTeam;

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
          <div
            className={`flex items-center space-x-3 select-none ${
              isPitWallLocked ? 'cursor-default' : 'cursor-pointer'
            }`}
            onClick={() => {
              if (!isPitWallLocked) {
                onNavigate('/');
              }
            }}
            title={isPitWallLocked ? 'Modo Pit Wall activo para escudería' : 'Ir al Centro de Control'}
          >
            <div className="w-9 h-9 rounded bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-black tracking-widest text-sm">
              PW
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold tracking-wider text-sm sm:text-base text-white uppercase">
                  Pit Wall & Race Control
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 rounded border border-emerald-700/60">
                  M7 COMISARÍA
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
              const isLockedOut = isPitWallLocked && item.path !== '/pit-wall';

              if (isLockedOut) {
                return (
                  <button
                    key={item.path}
                    id={`nav-${item.path.replace('/', '') || 'home'}`}
                    disabled
                    title={`Acceso restringido para operadores de escudería (${authenticatedTeam.name}). Cierre sesión para acceder.`}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 opacity-40 cursor-not-allowed select-none border border-transparent"
                  >
                    <Icon className="w-3.5 h-3.5 text-gray-600" />
                    <span>{item.label}</span>
                    <Lock className="w-2.5 h-2.5 text-gray-600 ml-0.5" />
                  </button>
                );
              }

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
                  {isPitWallLocked && item.path === '/pit-wall' && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                      ACTIVO
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Estados de presencia, persistencia y control de sesión de escudería */}
          <div className="flex items-center space-x-3">
            {/* Si el usuario está autenticado como escudería en Pit Wall, mostrar indicador y botón de Salir */}
            {authenticatedTeam && onLogoutTeam && (
              <div
                id="header-team-session-badge"
                className="flex items-center space-x-2 pl-2 pr-1 py-1 rounded-lg bg-[#0a0c10] border border-cyan-900/60 shadow-sm"
              >
                <div className="flex items-center space-x-1.5 truncate max-w-[130px] sm:max-w-[170px]">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: authenticatedTeam.color || '#3b82f6' }}
                  />
                  <span className="text-xs font-bold text-gray-200 truncate">
                    {authenticatedTeam.name}
                  </span>
                </div>
                <button
                  id="btn-header-logout"
                  onClick={onLogoutTeam}
                  title={`Cerrar sesión de ${authenticatedTeam.name} y salir del modo Pit Wall`}
                  className="flex items-center space-x-1 px-2 py-1 rounded bg-rose-950/70 hover:bg-rose-900 active:scale-95 text-rose-300 border border-rose-800/80 text-xs font-semibold transition-all cursor-pointer"
                >
                  <LogOut className="w-3 h-3 text-rose-400" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            )}

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
        <div className="md:hidden flex items-center overflow-x-auto py-2 space-x-2 border-t border-gray-800/60 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            const isLockedOut = isPitWallLocked && item.path !== '/pit-wall';

            if (isLockedOut) {
              return (
                <button
                  key={item.path}
                  disabled
                  title="Acceso restringido para escudería"
                  className="flex-shrink-0 flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-medium text-gray-600 bg-gray-950/40 opacity-40 cursor-not-allowed select-none"
                >
                  <Icon className="w-3 h-3 text-gray-600" />
                  <span>{item.label}</span>
                  <Lock className="w-2 h-2 text-gray-600" />
                </button>
              );
            }

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

          {/* Botón de salir en móvil si está autenticado como escudería */}
          {authenticatedTeam && onLogoutTeam && (
            <button
              onClick={onLogoutTeam}
              className="flex-shrink-0 flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800 shadow cursor-pointer"
            >
              <LogOut className="w-3 h-3 text-rose-400" />
              <span>Salir</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
