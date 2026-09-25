import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Clock, Ban, CheckCircle2, X } from 'lucide-react';
import { TeamModel } from '../types';

export type StewardingActionType = 'WARNING' | 'TIME_PENALTY' | 'PIT_REQUIRED' | 'DISQUALIFY' | 'REVERSE_DQ';

interface StewardingModalProps {
  isOpen: boolean;
  sessionId: string;
  teams: TeamModel[];
  defaultTeamId?: string;
  defaultAction?: StewardingActionType;
  isDisqualified?: boolean;
  onClose: () => void;
  onActionSuccess: (msg: string) => void;
}

export const StewardingModal: React.FC<StewardingModalProps> = ({
  isOpen,
  sessionId,
  teams,
  defaultTeamId,
  defaultAction = 'TIME_PENALTY',
  isDisqualified = false,
  onClose,
  onActionSuccess
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    defaultTeamId || (teams.length > 0 ? teams[0].id : '')
  );
  const [actionType, setActionType] = useState<StewardingActionType>(
    isDisqualified ? 'REVERSE_DQ' : defaultAction
  );
  const [seconds, setSeconds] = useState<number>(3);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedTeamId) {
      setErrorMessage('Seleccione una escudería.');
      return;
    }

    if (actionType !== 'PIT_REQUIRED' && !reason.trim()) {
      setErrorMessage('El motivo de la acción es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (actionType === 'WARNING') {
        const res = await fetch(`/api/sessions/${sessionId}/penalties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: selectedTeamId,
            type: 'WARNING',
            reason: reason.trim(),
            issuedBy: 'Dirección de Carrera'
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Error al emitir aviso');
        onActionSuccess(data.message || 'Aviso emitido');
      } else if (actionType === 'TIME_PENALTY') {
        const res = await fetch(`/api/sessions/${sessionId}/penalties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: selectedTeamId,
            type: 'TIME_PENALTY',
            seconds: Number(seconds),
            reason: reason.trim(),
            issuedBy: 'Dirección de Carrera'
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Error al aplicar penalización');
        onActionSuccess(data.message || `Penalización de +${seconds}s aplicada`);
      } else if (actionType === 'PIT_REQUIRED') {
        const res = await fetch(`/api/sessions/${sessionId}/directives`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: selectedTeamId,
            type: 'PIT_REQUIRED',
            description: reason.trim() || 'Parada en boxes obligatoria por indicación de comisarios',
            issuedBy: 'Dirección de Carrera'
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Error al emitir directiva');
        onActionSuccess(data.message || 'Directiva PIT_REQUIRED emitida');
      } else if (actionType === 'DISQUALIFY') {
        const res = await fetch(`/api/sessions/${sessionId}/disqualify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: selectedTeamId,
            reason: reason.trim(),
            actor: 'Dirección de Carrera'
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Error al descalificar');
        onActionSuccess(data.message || 'Escudería descalificada');
      } else if (actionType === 'REVERSE_DQ') {
        const res = await fetch(`/api/sessions/${sessionId}/reverse-disqualification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: selectedTeamId,
            reversalReason: reason.trim(),
            actor: 'Dirección de Carrera'
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Error al revertir descalificación');
        onActionSuccess(data.message || 'Descalificación revertida');
      }
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#131720] border border-gray-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Encabezado */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0e121a]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Comisariato Deportivo (M7)
              </h3>
              <p className="text-[11px] text-gray-400 font-mono">
                Sanciones, directivas y decisiones arbitrales manuales
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

        {/* Pestañas de Acción */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-2 bg-[#0a0c10] border-b border-gray-800 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setActionType('TIME_PENALTY')}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors ${
              actionType === 'TIME_PENALTY'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-gray-400 hover:bg-gray-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>+Segundos</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType('WARNING')}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors ${
              actionType === 'WARNING'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 font-bold'
                : 'text-gray-400 hover:bg-gray-800/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
            <span>Aviso/Nota</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType('PIT_REQUIRED')}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors ${
              actionType === 'PIT_REQUIRED'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-gray-400 hover:bg-gray-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
            <span>Pit Obligatorio</span>
          </button>

          <button
            type="button"
            onClick={() => setActionType(isDisqualified ? 'REVERSE_DQ' : 'DISQUALIFY')}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors ${
              actionType === 'DISQUALIFY' || actionType === 'REVERSE_DQ'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                : 'text-gray-400 hover:bg-gray-800/60'
            }`}
          >
            {isDisqualified ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Revertir DQ</span>
              </>
            ) : (
              <>
                <Ban className="w-3.5 h-3.5 text-rose-400" />
                <span>Descalificar</span>
              </>
            )}
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-950/50 border border-rose-600/50 rounded-lg text-rose-300 font-mono text-[11px]">
              {errorMessage}
            </div>
          )}

          {/* Selector de Escudería */}
          <div>
            <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Escudería Destino
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.number ? `(#${t.number})` : ''}
                </option>
              ))}
            </select>
            {selectedTeam && (
              <div className="mt-1 flex items-center space-x-2 text-[10px] text-gray-400 font-mono">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: selectedTeam.color }}
                />
                <span>{selectedTeam.kartName || 'Kart asignado'}</span>
              </div>
            )}
          </div>

          {/* Campo específico según la acción */}
          {actionType === 'TIME_PENALTY' && (
            <div>
              <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                Segundos de Penalización
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[3, 5, 10, 15].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeconds(s)}
                    className={`py-1.5 rounded-lg border text-center font-mono font-bold text-xs cursor-pointer transition-colors ${
                      seconds === s
                        ? 'bg-amber-950 text-amber-300 border-amber-500'
                        : 'bg-[#0a0c10] border-gray-800 text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    +{s}s
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={seconds}
                onChange={(e) => setSeconds(parseFloat(e.target.value) || 1)}
                className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                placeholder="Segundos de recargo"
                required
              />
              <p className="text-[10px] text-gray-500 mt-1">
                * El tiempo bruto en pista se preserva íntegro y separado; el recargo se aplica al total y a la clasificación.
              </p>
            </div>
          )}

          {actionType === 'PIT_REQUIRED' && (
            <div className="p-3 bg-cyan-950/30 border border-cyan-800/50 rounded-xl space-y-1.5">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold text-[11px]">
                <ShieldAlert className="w-4 h-4" />
                <span>Directiva PIT_REQUIRED</span>
              </div>
              <p className="text-[10px] text-gray-300 leading-relaxed">
                Emite una directiva oficial de paso obligatorio por boxes en estado <strong>PENDIENTE</strong>. Se reflejará de inmediato en el Pit Wall del equipo y en la pantalla de carrera. Podrá marcarse como cumplida una vez realizada la parada o cancelarse por comisarios.
              </p>
            </div>
          )}

          {actionType === 'DISQUALIFY' && (
            <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl space-y-1.5">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-[11px]">
                <Ban className="w-4 h-4" />
                <span>Descalificación de Sesión (DQ)</span>
              </div>
              <p className="text-[10px] text-gray-300 leading-relaxed">
                La escudería será marcada inmediatamente como <strong>DESCALIFICADA (DQ)</strong> en todas las pantallas. Sus tiempos brutos y vueltas se preservan para auditoría y la medida puede ser revertida de forma deliberada con justificación obligatoria.
              </p>
            </div>
          )}

          {actionType === 'REVERSE_DQ' && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl space-y-1.5">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-[11px]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Reversión Deliberada de Descalificación</span>
              </div>
              <p className="text-[10px] text-gray-300 leading-relaxed">
                La escudería retornará al estado <strong>ACTIVO</strong> y recuperará su posición deportiva correspondiente de acuerdo a sus vueltas registradas.
              </p>
            </div>
          )}

          {/* Motivo o Justificación */}
          <div>
            <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              {actionType === 'REVERSE_DQ'
                ? 'Justificación de la Reversión (Obligatoria)'
                : 'Motivo / Causa de la Decisión'}
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                actionType === 'WARNING'
                  ? 'Ej: Exceso de velocidad en el carril de aceleración'
                  : actionType === 'TIME_PENALTY'
                  ? 'Ej: Maniobra peligrosa / No respetar bandera amarilla'
                  : actionType === 'PIT_REQUIRED'
                  ? 'Ej: Revisión técnica obligatoria de dorsal suelto'
                  : actionType === 'DISQUALIFY'
                  ? 'Ej: Infracción antideportiva grave / Peso inferior al mínimo'
                  : 'Ej: Rectificación tras revisión de vídeo por Dirección de Carrera'
              }
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500 resize-none"
              required={actionType !== 'PIT_REQUIRED'}
            />
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-lg cursor-pointer transition-colors flex items-center space-x-1.5 disabled:opacity-50 ${
                actionType === 'DISQUALIFY'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : actionType === 'REVERSE_DQ'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : actionType === 'PIT_REQUIRED'
                  ? 'bg-cyan-600 hover:bg-cyan-500'
                  : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              <span>
                {isSubmitting
                  ? 'Procesando...'
                  : actionType === 'WARNING'
                  ? 'Emitir Aviso'
                  : actionType === 'TIME_PENALTY'
                  ? `Aplicar +${seconds}s`
                  : actionType === 'PIT_REQUIRED'
                  ? 'Emitir Pit Obligatorio'
                  : actionType === 'DISQUALIFY'
                  ? 'Descalificar Escudería'
                  : 'Revertir Descalificación'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
