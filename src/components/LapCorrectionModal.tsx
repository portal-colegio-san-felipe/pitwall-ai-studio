import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { LapRecordModel, TeamModel } from '../types';

interface Props {
  lap: LapRecordModel;
  team?: TeamModel;
  isOpen: boolean;
  onClose: () => void;
  onConfirmInvalidate: (lapId: string, reason: string, actor: string) => Promise<void>;
}

export const LapCorrectionModal: React.FC<Props> = ({
  lap,
  team,
  isOpen,
  onClose,
  onConfirmInvalidate
}) => {
  const [reason, setReason] = useState('');
  const [actor, setActor] = useState('Director de Carrera');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickReasons = [
    'Pulsación involuntaria o doble paso',
    'Atajo de pista / Límite de trazado excedido',
    'Error de identificación de kart en meta',
    'Sanción técnica de Dirección de Carrera'
  ];

  const formatLapTime = (ms: number) => {
    const totalSecs = ms / 1000;
    const minutes = Math.floor(totalSecs / 60);
    const seconds = Math.floor(totalSecs % 60);
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Debe especificar un motivo para el registro de auditoría');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirmInvalidate(lap.id, reason.trim(), actor.trim() || 'Director de Carrera');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al invalidar la vuelta');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#131720] border border-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              Invalidar Vuelta (Auditoría M5)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen de la Vuelta Seleccionada */}
        <div className="bg-[#0a0c10] border border-gray-800 rounded-xl p-3.5 space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Escudería:</span>
            <div className="flex items-center space-x-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: team?.color || '#3b82f6' }}
              />
              <span className="font-bold text-white">{team?.name || lap.teamId}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Número de Vuelta:</span>
            <span className="font-bold text-cyan-400">Vuelta #{lap.lapNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Tiempo Registrado:</span>
            <span className="font-bold text-purple-400">{formatLapTime(lap.lapTimeMs)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Hora de Registro:</span>
            <span className="text-gray-300">{new Date(lap.serverTimestamp).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Advertencia de Preservación de Auditoría */}
        <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl text-amber-300 text-xs flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Corrección no destructiva:</span> La vuelta no se borrará. Se marcará como inválida y se recalcularán automáticamente las posiciones, mejores vueltas y diferencias en todas las pantallas en vivo.
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">
            {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-gray-300 uppercase">
              Responsable de la decisión (Auditoría)
            </label>
            <input
              type="text"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="Ej. Director de Carrera / Comisario #1"
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-rose-500 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-gray-300 uppercase">
              Motivo formal de invalidación *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describa el motivo reglamentario..."
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-rose-500 outline-none"
            />
            {/* Opciones rápidas */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quickReasons.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setReason(q)}
                  className="px-2 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded text-[10px] text-gray-400 hover:text-white cursor-pointer transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-mono cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono tracking-wider uppercase transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Invalidando...' : 'Confirmar Invalidación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
