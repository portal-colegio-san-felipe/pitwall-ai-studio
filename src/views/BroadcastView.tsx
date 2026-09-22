import React from 'react';
import { Tv, Radio, CheckCircle } from 'lucide-react';
import { SystemHealth } from '../types';

interface Props {
  health: SystemHealth | null;
}

export const BroadcastView: React.FC<Props> = ({ health }) => {
  return (
    <div className="space-y-4 py-4 max-w-6xl mx-auto">
      {/* Marco 16:9 de Gráficos de Transmisión (OBS) */}
      <div className="bg-[#0e1118] border-2 border-dashed border-gray-800 rounded-2xl p-6 sm:p-8 aspect-[16/9] flex flex-col justify-between relative overflow-hidden">
        {/* Marca de agua de producción */}
        <div className="absolute top-4 right-4 flex items-center space-x-2 px-3 py-1 bg-black/60 border border-amber-500/30 rounded font-mono text-[11px] text-amber-300">
          <Radio className="w-3.5 h-3.5 animate-pulse text-red-500" />
          <span>SALIDA DE GRÁFICOS OBS · 16:9</span>
        </div>

        {/* Encabezado Broadcast */}
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-400">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                TRANSMISIÓN EN VIVO · OVERLAY GRÁFICO
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white uppercase">
                Pit Wall / Race Control
              </h1>
            </div>
          </div>
        </div>

        {/* Muestra de Lower-Third / Tira Gráfica de Cronometraje */}
        <div className="bg-[#131720]/90 backdrop-blur-md border border-gray-700/80 rounded-xl p-4 shadow-2xl max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between border-b border-gray-700 pb-2 mb-2 font-mono text-xs">
            <span className="text-gray-300 font-bold uppercase">CARRERA ESCOLAR DE KARTS</span>
            <span className="text-emerald-400 font-semibold">GRÁFICO LISTO</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span>Servidor Autoritativo: {health?.status === 'healthy' ? 'CONECTADO' : 'VERIFICANDO'}</span>
            <span className="text-amber-300">Sin datos ficticios en producción</span>
          </div>
        </div>

        {/* Pie de Pantalla de Transmisión */}
        <div className="flex items-center justify-between text-xs font-mono text-gray-500">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>Independiente de la cámara, OBS y streaming (Invariante M0)</span>
          </div>
          <div>Formato 1080p / 16:9</div>
        </div>
      </div>
    </div>
  );
};
