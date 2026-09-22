import React, { useState } from 'react';
import { Play, Check, Plus, AlertCircle } from 'lucide-react';
import { SessionModel, TeamModel, SessionType } from '../types';

interface Props {
  initialSession?: SessionModel | null;
  availableTeams: TeamModel[];
  onSessionSaved: (session: SessionModel, sessions: SessionModel[]) => void;
  onCancel: () => void;
}

export const SessionFormModal: React.FC<Props> = ({
  initialSession,
  availableTeams,
  onSessionSaved,
  onCancel
}) => {
  const [name, setName] = useState(initialSession?.name || '');
  const [type, setType] = useState<SessionType>(initialSession?.type || 'race');
  const [targetLaps, setTargetLaps] = useState<string>(
    initialSession?.targetLaps !== undefined ? String(initialSession.targetLaps) : ''
  );
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(
    initialSession?.participatingTeamIds || availableTeams.map((t) => t.id)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const selectAllTeams = () => {
    setSelectedTeamIds(availableTeams.map((t) => t.id));
  };

  const deselectAllTeams = () => {
    setSelectedTeamIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre de la sesión o ronda es obligatorio.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initialSession?.id,
          name: name.trim(),
          type,
          targetLaps: targetLaps.trim() ? Number(targetLaps) : undefined,
          participatingTeamIds: selectedTeamIds
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message || 'Error al guardar la sesión.');
      }

      onSessionSaved(data.session, data.sessions);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error de comunicación';
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="session-form-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div id="session-form-modal" className="bg-[#131720] border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-3 border-b border-gray-800 pb-4">
          <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-400">
            <Play className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              {initialSession ? 'Modificar Sesión / Ronda' : 'Crear Nueva Sesión'}
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Vueltas objetivo y selección de escuderías participantes
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="input-session-name" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
              Nombre de la Sesión / Manga *
            </label>
            <input
              id="input-session-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Clasificación 1 / Gran Carrera Final"
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="select-session-type" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
                Tipo de Sesión
              </label>
              <select
                id="select-session-type"
                value={type}
                onChange={(e) => {
                  const val = e.target.value as SessionType;
                  setType(val);
                  if (val === 'qualifying' && !targetLaps) {
                    setTargetLaps('2'); // Sugerencia habitual para clasificación según reglamento
                  }
                }}
                className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="qualifying">Clasificación (Qualifying)</option>
                <option value="race">Carrera (Race)</option>
                <option value="generic">Entrenamiento / Libre (Generic)</option>
              </select>
            </div>

            <div>
              <label htmlFor="input-session-laps" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
                Vueltas Objetivo (Configurable)
              </label>
              <input
                id="input-session-laps"
                type="number"
                min={1}
                max={500}
                value={targetLaps}
                onChange={(e) => setTargetLaps(e.target.value)}
                placeholder="Ej: 2 (Clasif) o 30 (Carrera)"
                className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-gray-500 font-mono">No fijado en 30 por defecto</span>
            </div>
          </div>

          {/* Selección de Escuderías Participantes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-mono text-gray-300 uppercase tracking-wider">
                Escuderías Participantes ({selectedTeamIds.length} / {availableTeams.length})
              </label>
              <div className="space-x-2 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={selectAllTeams}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Todas
                </button>
                <span className="text-gray-600">|</span>
                <button
                  type="button"
                  onClick={deselectAllTeams}
                  className="text-gray-400 hover:underline cursor-pointer"
                >
                  Ninguna
                </button>
              </div>
            </div>

            {availableTeams.length === 0 ? (
              <div className="p-4 bg-[#0a0c10] border border-dashed border-gray-800 rounded-lg text-center text-xs text-gray-500">
                Aún no hay escuderías registradas en este evento. Puede agregarlas luego.
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto bg-[#0a0c10] border border-gray-800 rounded-lg p-2 space-y-1.5">
                {availableTeams.map((team) => {
                  const isSelected = selectedTeamIds.includes(team.id);
                  return (
                    <div
                      key={team.id}
                      onClick={() => toggleTeam(team.id)}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs ${
                        isSelected
                          ? 'bg-gray-800/80 text-white'
                          : 'bg-transparent text-gray-400 hover:bg-gray-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="font-medium">{team.name}</span>
                        {team.shortName && (
                          <span className="text-[10px] font-mono text-gray-500">
                            [{team.shortName}]
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Manejado por el onClick del contenedor
                        className="rounded border-gray-700 text-cyan-600 focus:ring-0 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              id="btn-cancel-session-form"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-submit-session-form"
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              {initialSession ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isSaving ? 'Guardando...' : initialSession ? 'Guardar Cambios' : 'Crear Sesión'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
