import React, { useState } from 'react';
import { PlusCircle, ShieldAlert, Check, X } from 'lucide-react';
import { TeamModel } from '../types';

interface Props {
  sessionId: string;
  teams: TeamModel[];
  defaultTeamId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ManualLapModal: React.FC<Props> = ({
  sessionId,
  teams,
  defaultTeamId,
  onClose,
  onSuccess
}) => {
  const [teamId, setTeamId] = useState<string>(defaultTeamId || (teams[0]?.id || ''));
  const [timeMode, setTimeMode] = useState<'auto' | 'custom'>('auto');
  const [minutes, setMinutes] = useState('0');
  const [seconds, setSeconds] = useState('45');
  const [millis, setMillis] = useState('000');
  const [reason, setReason] = useState('Fallo de conexión / tablet en Pit Wall');
  const [customReason, setCustomReason] = useState('');
  const [actor, setActor] = useState('Dirección de Carrera');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = teams.find((t) => t.id === teamId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) {
      setError('Seleccione una escudería.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let lapTimeMs: number | undefined = undefined;
    if (timeMode === 'custom') {
      const m = parseInt(minutes || '0', 10);
      const s = parseInt(seconds || '0', 10);
      const ms = parseInt(millis || '0', 10);
      const calculated = m * 60000 + s * 1000 + ms;
      if (calculated <= 0) {
        setError('El tiempo de vuelta debe ser mayor a 0 ms.');
        setIsSubmitting(false);
        return;
      }
      lapTimeMs = calculated;
    }

    const finalReason = reason === 'OTRO' ? customReason.trim() : reason;
    if (!finalReason) {
      setError('Indique el motivo del conteo manual para la auditoría.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}/laps/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          lapTimeMs,
          reason: finalReason,
          actor: actor.trim() || 'Dirección de Carrera'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message || 'Error al registrar la vuelta manual');
      }

      onSuccess(data.message || `Vuelta registrada manualmente para ${selectedTeam?.name || 'la escudería'}`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de comunicación';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="manual-lap-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div id="manual-lap-modal" className="bg-[#131720] border border-gray-800 rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
                Conteo Manual de Vuelta
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Intervención de Dirección de Carrera (ej. corte de conexión o tablet en box)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          {/* Selección de Escudería */}
          <div>
            <label className="block text-gray-300 uppercase tracking-wider mb-1.5 font-bold">
              Escudería Beneficiaria *
            </label>
            <div className="grid grid-cols-1 gap-2">
              <select
                id="select-manual-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {teams.map((t, idx) => (
                  <option key={t.id} value={t.id}>
                    #{t.number !== undefined ? t.number : idx + 1} - {t.name} {t.kartName ? `(${t.kartName})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {selectedTeam && (
              <div className="mt-2 flex items-center space-x-2 px-3 py-1.5 rounded bg-[#0a0c10] border border-gray-800">
                <div
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedTeam.color }}
                />
                <span className="text-gray-300 font-bold">{selectedTeam.name}</span>
                <span className="text-gray-500">·</span>
                <span className="text-amber-400">Se agregará +1 vuelta con auditoría oficial</span>
              </div>
            )}
          </div>

          {/* Modalidad de Tiempo de Vuelta */}
          <div>
            <label className="block text-gray-300 uppercase tracking-wider mb-1.5 font-bold">
              Tiempo de Vuelta Asignado
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <button
                type="button"
                onClick={() => setTimeMode('auto')}
                className={`px-3 py-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  timeMode === 'auto'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-bold'
                    : 'bg-[#0a0c10] border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Automático (Delta en meta)
              </button>
              <button
                type="button"
                onClick={() => setTimeMode('custom')}
                className={`px-3 py-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  timeMode === 'custom'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-bold'
                    : 'bg-[#0a0c10] border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Manual (Especificar mm:ss)
              </button>
            </div>

            {timeMode === 'custom' ? (
              <div className="grid grid-cols-3 gap-2 bg-[#0a0c10] border border-gray-800 p-2.5 rounded-lg">
                <div>
                  <span className="text-[10px] text-gray-500 block mb-1">Minutos</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="w-full bg-[#131720] border border-gray-700 rounded px-2.5 py-1.5 text-white text-center font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block mb-1">Segundos</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value)}
                    className="w-full bg-[#131720] border border-gray-700 rounded px-2.5 py-1.5 text-white text-center font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block mb-1">Milisegundos</span>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={millis}
                    onChange={(e) => setMillis(e.target.value)}
                    className="w-full bg-[#131720] border border-gray-700 rounded px-2.5 py-1.5 text-white text-center font-bold"
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 bg-[#0a0c10] p-2.5 rounded-lg border border-gray-800">
                El servidor calculará el tiempo delta transcurrido desde la última vuelta o inicio de manga.
              </p>
            )}
          </div>

          {/* Motivo de la intervención (Auditoría inmutable) */}
          <div>
            <label className="block text-gray-300 uppercase tracking-wider mb-1.5 font-bold">
              Motivo de la Intervención (Auditoría) *
            </label>
            <select
              id="select-manual-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 mb-2"
            >
              <option value="Fallo de conexión / tablet en Pit Wall">Fallo de conexión / tablet en Pit Wall</option>
              <option value="Paso por meta confirmado visualmente por cronometradores">Paso por meta confirmado visualmente por cronometradores</option>
              <option value="Incidencia técnica de red WiFi">Incidencia técnica de red WiFi</option>
              <option value="Solicitud formal de comisarios de pista">Solicitud formal de comisarios de pista</option>
              <option value="OTRO">Otro motivo específico...</option>
            </select>

            {reason === 'OTRO' && (
              <input
                type="text"
                required
                placeholder="Describa el motivo detallado para el registro de auditoría"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            )}
          </div>

          {/* Comisario / Actor */}
          <div>
            <label className="block text-gray-300 uppercase tracking-wider mb-1.5 font-bold">
              Responsable que autoriza
            </label>
            <input
              type="text"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="Dirección de Carrera / Comisario #1"
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-3 border-t border-gray-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-confirm-manual-lap"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-lg"
            >
              {isSubmitting ? (
                <span>Registrando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Registrar Vuelta</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
