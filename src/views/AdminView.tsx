import React, { useState } from 'react';
import { Settings, Database, Server, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { SystemHealth } from '../types';

interface Props {
  health: SystemHealth | null;
  onRefreshHealth: () => void;
}

export const AdminView: React.FC<Props> = ({ health, onRefreshHealth }) => {
  const [testingStorage, setTestingStorage] = useState(false);
  const [storageFeedback, setStorageFeedback] = useState<string | null>(null);

  const handleTestStorage = async () => {
    setTestingStorage(true);
    setStorageFeedback(null);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.persistence?.reachable) {
        setStorageFeedback('Prueba de persistencia duradera exitosa. Lectura y escritura verificadas.');
      } else {
        setStorageFeedback('La persistencia duradera reportó error de alcance.');
      }
    } catch (err: unknown) {
      setStorageFeedback('Error de comunicación con el servidor autoritativo.');
    } finally {
      setTestingStorage(false);
      onRefreshHealth();
    }
  };

  return (
    <div className="space-y-6 py-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-300">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-gray-400 uppercase">Superficie de Soporte</div>
            <h1 className="text-xl font-bold text-white uppercase tracking-wide">
              Administración Técnica & Diagnóstico
            </h1>
          </div>
        </div>

        <button
          id="btn-admin-refresh-health"
          onClick={onRefreshHealth}
          className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs font-medium text-gray-200 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar Diagnóstico</span>
        </button>
      </div>

      {/* Diagnóstico de Persistencia Duradera */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-gray-200 uppercase tracking-wider">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Estado de Persistencia Duradera</span>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-900 text-cyan-400 border border-cyan-500/30">
            {health?.persistence?.type || 'file-durable'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-3 space-y-1">
            <div className="text-gray-500 uppercase text-[10px]">Accesibilidad</div>
            <div className={`font-bold ${health?.persistence?.reachable ? 'text-emerald-400' : 'text-rose-400'}`}>
              {health?.persistence?.reachable ? 'ALCANZABLE Y VERIFICADA' : 'NO DISPONIBLE'}
            </div>
          </div>

          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-3 space-y-1">
            <div className="text-gray-500 uppercase text-[10px]">Datos Semilla de Carrera</div>
            <div className={`font-bold ${!health?.persistence?.hasProductionSeedData ? 'text-emerald-400' : 'text-amber-400'}`}>
              {!health?.persistence?.hasProductionSeedData ? '0 DATOS FICTICIOS (CORRECTO)' : 'DETECTADOS'}
            </div>
          </div>

          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-3 space-y-1">
            <div className="text-gray-500 uppercase text-[10px]">Última Comprobación</div>
            <div className="text-gray-300 truncate">
              {health?.persistence?.checkedAt ? new Date(health.persistence.checkedAt).toLocaleTimeString('es-ES') : '--:--:--'}
            </div>
          </div>
        </div>

        {storageFeedback && (
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-lg text-xs font-mono text-cyan-300">
            {storageFeedback}
          </div>
        )}

        <div className="pt-2 flex flex-wrap gap-2">
          <button
            id="btn-admin-test-storage"
            onClick={handleTestStorage}
            disabled={testingStorage}
            className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingStorage ? 'animate-spin' : ''}`} />
            <span>Ejecutar Prueba de Escritura / Lectura de Persistencia</span>
          </button>

          <button
            id="btn-admin-reset-storage"
            onClick={async () => {
              if (window.confirm('¿Está seguro de reiniciar la persistencia y eliminar todos los datos de eventos y sesiones?')) {
                setTestingStorage(true);
                try {
                  const res = await fetch('/api/event', { method: 'DELETE' });
                  if (res.ok) {
                    setStorageFeedback('Base de datos reiniciada a limpio con éxito.');
                    onRefreshHealth();
                  }
                } finally {
                  setTestingStorage(false);
                }
              }
            }}
            disabled={testingStorage}
            className="flex items-center space-x-2 px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 text-rose-300 disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <span>Reiniciar Base de Datos a Limpio</span>
          </button>
        </div>
      </div>

      {/* Diagnóstico de Servidor y Plataforma */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-gray-200 uppercase tracking-wider">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Servidor Autoritativo Node.js</span>
          </div>
          <span className="text-xs font-mono text-emerald-400">PUERTO 3000 (OBLIGATORIO)</span>
        </div>

        <div className="space-y-2 text-xs font-mono text-gray-400">
          <div className="flex justify-between py-1 border-b border-gray-900">
            <span>Tiempo de Actividad (Uptime):</span>
            <span className="text-white">{health?.uptimeSeconds || 0} segundos</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-900">
            <span>Idioma Obligatorio de Interfaz:</span>
            <span className="text-emerald-400 font-bold">Español (es)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-900">
            <span>Hito Actual:</span>
            <span className="text-cyan-400 font-bold">M1 (Evento, Escuderías y Rondas)</span>
          </div>
        </div>
      </div>

      {/* Reglas de Seguridad e Invariantes */}
      <div className="bg-[#131720] border border-gray-800 rounded-xl p-6 space-y-3">
        <div className="flex items-center space-x-2 text-sm font-bold text-gray-200 uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Invariantes de Autoridad y Recuperación</span>
        </div>

        <ul className="space-y-2 text-xs text-gray-300">
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Las mutaciones autoritativas se validan únicamente en el servidor, no en el navegador del cliente.</span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Las acciones de cronometraje no se encolan sin conexión para evitar marcas de tiempo engañosas.</span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Los errores y correcciones se conservan en un historial de auditoría inmutable.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
