import React, { useState } from 'react';
import { User, Plus, X, Check, AlertCircle } from 'lucide-react';
import { TeamModel } from '../types';

interface Props {
  team: TeamModel;
  onPilotsUpdated: (updatedTeam: TeamModel, allTeams: TeamModel[]) => void;
  onClose: () => void;
}

export const TeamPilotsModal: React.FC<Props> = ({ team, onPilotsUpdated, onClose }) => {
  const [pilots, setPilots] = useState<string[]>(team.pilots || []);
  const [newPilotName, setNewPilotName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddPilot = () => {
    const trimmed = newPilotName.trim();
    if (!trimmed) return;
    if (pilots.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" ya está en la lista de pilotos.`);
      return;
    }
    setPilots([...pilots, trimmed]);
    setNewPilotName('');
    setError(null);
  };

  const handleRemovePilot = (indexToRemove: number) => {
    setPilots(pilots.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${team.id}/pilots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pilots })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message || 'Error al guardar los pilotos.');
      }
      onPilotsUpdated(data.team, data.teams);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#131720] border border-gray-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-bold text-xs"
              style={{ backgroundColor: team.color || '#3b82f6' }}
            >
              <User className="w-4 h-4 text-black" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wide">
                Pilotos de {team.name}
              </h3>
              <p className="text-[11px] text-gray-400 font-mono">
                Registro previo a la sesión deportiva
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs text-gray-400 font-mono">
            Añada los nombres de los pilotos que correrán los relevos en este kart.
          </p>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newPilotName}
              onChange={(e) => setNewPilotName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddPilot();
                }
              }}
              placeholder="Nombre del alumno / piloto (ej. Lucas)"
              className="flex-1 bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={handleAddPilot}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>

          <div className="bg-[#0a0c10] border border-gray-800 rounded-xl p-3 min-h-[100px] max-h-[200px] overflow-y-auto space-y-1.5">
            {pilots.length === 0 ? (
              <div className="text-xs font-mono text-gray-500 text-center py-6">
                Sin pilotos registrados. Escriba un nombre arriba para agregarlo.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pilots.map((p, idx) => (
                  <span
                    key={`${p}-${idx}`}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-950/70 border border-blue-500/40 text-blue-200 text-xs font-mono font-medium shadow-sm"
                  >
                    <span>{p}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePilot(idx)}
                      className="text-blue-400 hover:text-rose-400 transition-colors cursor-pointer ml-1"
                      title={`Eliminar ${p}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
          <span className="text-[11px] font-mono text-gray-500">
            {pilots.length} {pilots.length === 1 ? 'piloto registrado' : 'pilotos registrados'}
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold uppercase rounded-lg transition-colors cursor-pointer shadow"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Pilotos'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
