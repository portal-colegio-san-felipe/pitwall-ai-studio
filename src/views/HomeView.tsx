import React from 'react';
import { Shield, Flag, Monitor, Tv, BookOpen, Settings, Trophy, Users, Play, Wifi } from 'lucide-react';
import { SystemHealth, EventModel, TeamModel, SessionModel } from '../types';

interface Props {
  health: SystemHealth | null;
  event?: EventModel | null;
  teams?: TeamModel[];
  sessions?: SessionModel[];
  onNavigate: (path: string) => void;
}

export const HomeView: React.FC<Props> = ({
  health,
  event,
  teams = [],
  sessions = [],
  onNavigate
}) => {
  const surfaces = [
    {
      id: 'race-control',
      path: '/race-control',
      title: 'Dirección de Carrera',
      role: 'Director de Carrera / Profesor',
      target: 'Escritorio',
      description: 'Gestión de eventos, asignación de mangas, tokens de escudería y supervisión de presencia en vivo.',
      icon: Shield,
      accent: 'border-blue-500/40 hover:border-blue-400 text-blue-400 bg-blue-950/20'
    },
    {
      id: 'pit-wall',
      path: '/pit-wall',
      title: 'Pit Wall de Escudería',
      role: 'Alumnos / Operadores de Box',
      target: 'Móvil / Tablet',
      description: 'Panel táctil de equipo con botón ergonómico de vueltas, telemetría de relevos y avisos oficiales.',
      icon: Flag,
      accent: 'border-emerald-500/40 hover:border-emerald-400 text-emerald-400 bg-emerald-950/20'
    },
    {
      id: 'display',
      path: '/display',
      title: 'Pantalla de Pista (16:9)',
      role: 'Lectura Pública / Proyector',
      target: 'Pantalla Gigante',
      description: 'Modo pantalla completa inmersiva (F11) con tabla de tiempos de alta visibilidad para pilotos y público.',
      icon: Monitor,
      accent: 'border-purple-500/40 hover:border-purple-400 text-purple-400 bg-purple-950/20'
    },
    {
      id: 'broadcast',
      path: '/broadcast',
      title: 'Gráficos de Transmisión',
      role: 'Producción / Streaming',
      target: 'Captura OBS / vMix',
      description: 'Gráficos de baja latencia con canal alfa para superposición limpia en la emisión escolar.',
      icon: Tv,
      accent: 'border-amber-500/40 hover:border-amber-400 text-amber-400 bg-amber-950/20'
    },
    {
      id: 'manual',
      path: '/manual',
      title: 'Manual de Operaciones',
      role: 'Documentación Oficial',
      target: 'Guía de Uso',
      description: 'Protocolos paso a paso para directores, boxes de alumnos, pantallas de pista y contingencias.',
      icon: BookOpen,
      accent: 'border-cyan-500/40 hover:border-cyan-400 text-cyan-400 bg-cyan-950/20'
    },
    {
      id: 'admin',
      path: '/admin',
      title: 'Administración Técnica',
      role: 'Soporte Técnico',
      target: 'Diagnóstico',
      description: 'Supervisión de salud del motor autoritativo y persistencia atómica en disco.',
      icon: Settings,
      accent: 'border-gray-700 hover:border-gray-500 text-gray-400 bg-gray-900/30'
    }
  ];

  return (
    <div className="space-y-6 py-6">
      {/* Cockpit Principal / Estado del Evento */}
      <div className="bg-[#131720] border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-700/60 rounded">
              SISTEMA OPERATIVO · M2
            </span>
            <span className="text-xs text-gray-400 font-mono">
              Acceso Único por Token & Presencia
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
            {event ? event.name : 'Competición Escolar de Karts'}
          </h1>

          <p className="text-xs text-gray-400 font-mono">
            {event?.edition ? `${event.edition} · ` : ''}
            {event?.configuredBy ? `Dirección: ${event.configuredBy}` : 'Plataforma autoritativa central'}
          </p>
        </div>

        {/* Métricas Operativas Rápidas */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 font-mono text-center">
          <div className="bg-[#0a0c10] border border-gray-800 rounded-xl p-3">
            <div className="text-[10px] text-gray-500 uppercase flex items-center justify-center space-x-1">
              <Users className="w-3 h-3 text-cyan-400" />
              <span>Escuderías</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{teams.length}</div>
          </div>

          <div className="bg-[#0a0c10] border border-gray-800 rounded-xl p-3">
            <div className="text-[10px] text-gray-500 uppercase flex items-center justify-center space-x-1">
              <Play className="w-3 h-3 text-purple-400" />
              <span>Mangas</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{sessions.length}</div>
          </div>

          <div className="bg-[#0a0c10] border border-gray-800 rounded-xl p-3">
            <div className="text-[10px] text-gray-500 uppercase flex items-center justify-center space-x-1">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>Servidor</span>
            </div>
            <div className="text-xs font-bold text-emerald-400 mt-2">
              {health?.status === 'healthy' ? 'OK' : 'INICIANDO'}
            </div>
          </div>
        </div>
      </div>

      {/* Lanzadera de Superficies de Operación */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-2">
            <span>SUPERFICIES Y ROLES OPERATIVOS</span>
          </h2>
          <span className="text-[11px] font-mono text-gray-500">Seleccione un módulo</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surfaces.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                id={`card-surface-${s.id}`}
                onClick={() => onNavigate(s.path)}
                className={`bg-[#131720] border rounded-xl p-5 transition-all duration-150 cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md ${s.accent}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-lg bg-[#0a0c10] border border-gray-800/80">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-gray-900 text-gray-300 border border-gray-800">
                      {s.target}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">{s.title}</h3>
                    <div className="text-xs font-mono text-cyan-400/90 mt-0.5">{s.role}</div>
                  </div>

                  <p className="text-xs text-gray-400 leading-relaxed font-sans">{s.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs font-semibold">
                  <span className="text-gray-500 font-mono text-[11px]">{s.path}</span>
                  <span className="text-white group-hover:translate-x-1 transition-transform">Acceder →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Acceso Directo de Inicio Rápido */}
      {!event && (
        <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Trophy className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <div className="text-xs text-cyan-200">
              <span className="font-bold">¿Listo para comenzar el Gran Premio?</span> Configure el evento inicial y dé de alta a las escuderías participantes en Race Control.
            </div>
          </div>
          <button
            onClick={() => onNavigate('/race-control')}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex-shrink-0"
          >
            Abrir Race Control
          </button>
        </div>
      )}
    </div>
  );
};
