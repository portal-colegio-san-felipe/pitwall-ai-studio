import React, { useState } from 'react';
import { Trophy, Plus, Check, AlertCircle } from 'lucide-react';
import { EventModel } from '../types';

interface Props {
  currentEvent: EventModel | null;
  onEventSaved: (event: EventModel) => void;
  onCancel?: () => void;
}

export const EventConfigModal: React.FC<Props> = ({ currentEvent, onEventSaved, onCancel }) => {
  const [name, setName] = useState(currentEvent?.name || '');
  const [edition, setEdition] = useState(currentEvent?.edition || '1');
  const [configuredBy, setConfiguredBy] = useState(currentEvent?.configuredBy || 'Director de Carrera');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del evento es obligatorio.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          edition: edition.trim(),
          configuredBy: configuredBy.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message || 'Error al guardar el evento.');
      }

      onEventSaved(data.event);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error de comunicación con el servidor';
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="event-config-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div id="event-config-modal" className="bg-[#131720] border border-gray-800 rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center space-x-3 border-b border-gray-800 pb-4">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wide">
              {currentEvent ? 'Modificar Evento Escolar' : 'Configurar Nuevo Evento'}
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Contenedor principal de la competición de karts
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
            <label htmlFor="input-event-name" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
              Nombre Oficial del Evento *
            </label>
            <input
              id="input-event-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Gran Premio Escolar San Felipe 2026"
              className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-event-edition" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
                Edición / Año
              </label>
              <input
                id="input-event-edition"
                type="text"
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                placeholder="Ej: 1ª Edición / 2026"
                className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label htmlFor="input-event-configured-by" className="block text-xs font-mono text-gray-300 uppercase tracking-wider mb-1.5">
                Responsable Deportivo
              </label>
              <input
                id="input-event-configured-by"
                type="text"
                value={configuredBy}
                onChange={(e) => setConfiguredBy(e.target.value)}
                placeholder="Profesor / Director de Carrera"
                className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-800 flex items-center justify-end space-x-3">
            {onCancel && (
              <button
                type="button"
                id="btn-cancel-event-config"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              id="btn-submit-event-config"
              disabled={isSaving}
              className="flex items-center space-x-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
            >
              {currentEvent ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isSaving ? 'Guardando...' : currentEvent ? 'Actualizar Evento' : 'Crear Evento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
