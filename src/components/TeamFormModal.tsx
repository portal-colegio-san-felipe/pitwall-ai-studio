import React, { useState } from 'react';
import { Flag, Plus, Check, AlertCircle, User, X } from 'lucide-react';
import { TeamModel } from '../types';

interface Props {
  initialTeam?: TeamModel | null;
  onTeamSaved: (team: TeamModel, teams: TeamModel[]) => void;
  onCancel: () => void;
}

const PRESET_COLORS = [
  '#00d2ff', // Cyan / Azul Eléctrico
  '#10b981', // Verde Esmeralda
  '#f59e0b', // Ámbar / Naranja
  '#ef4444', // Rojo Competición
  '#a855f7', // Púrpura
  '#ec4899', // Rosa
  '#eab308', // Amarillo
  '#6366f1', // Índigo
  '#14b8a6', // Turquesa
  '#f97316'  // Naranja Intenso
];

export const TeamFormModal: React.FC<Props> = ({ initialTeam, onTeamSaved, onCancel }) => {
  const [name, setName] = useState(initialTeam?.name || '');
  const [shortName, setShortName] = useState(initialTeam?.shortName || '');
  const [color, setColor] = useState(initialTeam?.color || PRESET_COLORS[0]);
  const [number, setNumber] = useState(initialTeam?.number !== undefined ? String(initialTeam.number) : '');
  const [kartName, setKartName] = useState(initialTeam?.kartName || '');
  const [pilots, setPilots] = useState<string[]>(initialTeam?.pilots || []);
  const [newPilotName, setNewPilotName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddPilot = () => {
    const trimmed = newPilotName.trim();
    if (!trimmed) return;
    if (pilots.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      setError(`El piloto "${trimmed}" ya está registrado en este equipo.`);
      return;
    }
    setPilots([...pilots, trimmed]);
    setNewPilotName('');
    setError(null);
  };

  const handleRemovePilot = (indexToRemove: number) => {
    setPilots(pilots.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre de la escudería es obligatorio.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initialTeam?.id,
          name: name.trim(),
          shortName: shortName.trim() || undefined,
          color,
          number: number ? Number(number) : undefined,
          kartName: kartName.trim() || undefined,
          pilots
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message || 'Error al guardar la escudería.');
      }

      onTeamSaved(data.team, data.teams);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error de comunicación';
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="team-form-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div id="team-form-modal" className="bg-[#131720] border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-3 border-b border-gray-800 pb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-black font-bold shadow-md"
            style={{ backgroundColor: color }}
          >
            <Flag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              {initialTeam ? 'Editar Escudería' : 'Registrar Nueva Escudería'}
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Configuración sin límite estricto de 4 equipos
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
            <label htmlFor="input-team-name" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
              Nombre de la Escudería *
            </label>
            <input
              id="input-team-name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!shortName && e.target.value.length > 0) {
                  setShortName(e.target.value.slice(0, 3).toUpperCase());
                }
              }}
              placeholder="Ej: Rayo Escolar / Escudería Verde"
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="input-team-short-name" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
                Sigla (3-4 letras)
              </label>
              <input
                id="input-team-short-name"
                type="text"
                maxLength={5}
                value={shortName}
                onChange={(e) => setShortName(e.target.value.toUpperCase())}
                placeholder="Ej: RAY"
                className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label htmlFor="input-team-number" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
                Dorsal (Opcional)
              </label>
              <input
                id="input-team-number"
                type="number"
                min={1}
                max={999}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ej: 7"
                className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="input-team-kart" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
              Kart Asignado (Opcional)
            </label>
            <input
              id="input-team-kart"
              type="text"
              value={kartName}
              onChange={(e) => setKartName(e.target.value)}
              placeholder="Ej: Kart Alfa / Chasis 02"
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Pilotos Registrados (Pre-sesión) */}
          <div className="space-y-2 p-3 bg-[#0a0c10] border border-gray-800 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-mono text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pilotos del Equipo (Registro Pre-Sesión)</span>
              </label>
              <span className="text-[10px] font-mono text-gray-500">{pilots.length} registrados</span>
            </div>
            
            <p className="text-[11px] text-gray-400 font-mono">
              Registre a los alumnos / pilotos que integran la escudería antes del inicio de la manga.
            </p>

            <div className="flex items-center space-x-2">
              <input
                id="input-pilot-name"
                type="text"
                value={newPilotName}
                onChange={(e) => setNewPilotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPilot();
                  }
                }}
                placeholder="Nombre del piloto (ej: Lucas, Sofía, Mateo)"
                className="flex-1 bg-[#131720] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-medium"
              />
              <button
                type="button"
                id="btn-add-pilot"
                onClick={handleAddPilot}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Añadir</span>
              </button>
            </div>

            {pilots.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {pilots.map((p, idx) => (
                  <span
                    key={`${p}-${idx}`}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-500/40 text-blue-200 text-xs font-mono"
                  >
                    <span>{p}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePilot(idx)}
                      className="text-blue-400 hover:text-white transition-colors cursor-pointer ml-1"
                      title={`Eliminar ${p}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[11px] font-mono text-gray-500 italic py-0.5">
                No hay pilotos registrados aún. Puede agregarlos ahora o durante la estrategia.
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-2">
              Color Distintivo
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                    color === c ? 'scale-110 border-white shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 ml-2"
                title="Color personalizado"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              id="btn-cancel-team-form"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-submit-team-form"
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              {initialTeam ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isSaving ? 'Guardando...' : initialTeam ? 'Guardar Cambios' : 'Registrar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
