import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, Ban, X } from 'lucide-react';
import { DirectiveModel } from '../types';

interface DirectiveActionModalProps {
  isOpen: boolean;
  sessionId: string;
  directive: DirectiveModel;
  teamName: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const DirectiveActionModal: React.FC<DirectiveActionModalProps> = ({
  isOpen,
  sessionId,
  directive,
  teamName,
  onClose,
  onSuccess
}) => {
  const [resolutionReason, setResolutionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResolve = async (newStatus: 'SERVED' | 'CANCELLED') => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/directives/${directive.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolutionReason: resolutionReason.trim() || (newStatus === 'SERVED' ? 'Cumplida en boxes' : 'Cancelada por comisarios'),
          resolvedBy: 'Dirección de Carrera'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Error al actualizar directiva');

      onSuccess(data.message || `Directiva ${newStatus === 'SERVED' ? 'marcada como cumplida' : 'cancelada'}`);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#131720] border border-gray-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0e121a]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Directiva {directive.type}
              </h3>
              <p className="text-[11px] text-gray-400 font-mono">
                {teamName} • Estado: {directive.status}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-950/50 border border-rose-600/50 rounded-lg text-rose-300 font-mono text-[11px]">
              {errorMessage}
            </div>
          )}

          <div className="p-3 bg-[#0a0c10] border border-gray-800 rounded-xl space-y-1">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Descripción de la directiva</div>
            <div className="text-sm font-bold text-white">{directive.description}</div>
            <div className="text-[10px] text-gray-400 font-mono">
              Emitida a las {new Date(directive.issuedAt).toLocaleTimeString()} por {directive.issuedBy}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Nota / Justificación de Cierre (Opcional)
            </label>
            <input
              type="text"
              value={resolutionReason}
              onChange={(e) => setResolutionReason(e.target.value)}
              placeholder="Ej: Cumplida en parada de vuelta 12 / Desestimada tras consulta"
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2 grid grid-cols-2 gap-2 border-t border-gray-800">
            <button
              type="button"
              onClick={() => handleResolve('SERVED')}
              disabled={isSubmitting}
              className="py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Marcar CUMPLIDA (Served)</span>
            </button>

            <button
              type="button"
              onClick={() => handleResolve('CANCELLED')}
              disabled={isSubmitting}
              className="py-2.5 px-3 rounded-lg bg-rose-900/60 hover:bg-rose-800 border border-rose-700 text-rose-200 font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Ban className="w-4 h-4" />
              <span>CANCELAR Directiva</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
