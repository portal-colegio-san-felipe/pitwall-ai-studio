import React, { useState } from 'react';
import { X, Disc, User, Check, RefreshCw } from 'lucide-react';
import { STANDARD_EQUIPMENT_OPTIONS } from '../../server/strategy';

interface StrategyChangeModalProps {
  isOpen: boolean;
  type: 'equipment' | 'personnel';
  teamName: string;
  currentValue: string;
  availablePilots?: string[];
  onClose: () => void;
  onSubmit: (newValue: string, reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export const StrategyChangeModal: React.FC<StrategyChangeModalProps> = ({
  isOpen,
  type,
  teamName,
  currentValue,
  availablePilots = [],
  onClose,
  onSubmit,
  isLoading = false
}) => {
  const [selectedValue, setSelectedValue] = useState<string>(
    type === 'equipment' ? currentValue || 'HARD' : currentValue || 'Piloto 1'
  );
  const [customInput, setCustomInput] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  if (!isOpen) return null;

  const isEquipment = type === 'equipment';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalValue = isCustom ? customInput.trim() : selectedValue.trim();
    if (!finalValue) return;
    await onSubmit(finalValue, reason.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#131720] border border-gray-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-400">
              {isEquipment ? <Disc className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {isEquipment ? 'Cambio de Compuesto / Calzado' : 'Relevo de Piloto / Personal'}
              </h3>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Escudería: <span className="text-white font-bold">{teamName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-[#0a0c10] border border-gray-800/80 rounded-lg text-xs font-mono">
            <span className="text-gray-500 uppercase">Asignación Actual: </span>
            <span className="text-cyan-400 font-bold">{currentValue || 'Sin asignar'}</span>
          </div>

          {isEquipment ? (
            <div className="space-y-2">
              <label className="text-xs font-mono text-gray-400 block uppercase">
                Seleccionar Nuevo Compuesto:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STANDARD_EQUIPMENT_OPTIONS.map((opt) => {
                  const isSelected = !isCustom && selectedValue === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedValue(opt.id);
                        setIsCustom(false);
                      }}
                      className={`p-3 rounded-lg border text-xs font-mono font-bold flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/80 border-blue-500 text-white shadow ring-1 ring-blue-400'
                          : 'bg-[#0a0c10] border-gray-800 text-gray-300 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-3 h-3 rounded-full border border-black/40"
                          style={{ backgroundColor: opt.color }}
                        />
                        <span>{opt.name}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsCustom(!isCustom)}
                  className="text-[11px] font-mono text-gray-400 hover:text-white cursor-pointer underline underline-offset-2"
                >
                  {isCustom ? '← Usar compuesto estándar' : '+ Otro compuesto personalizado'}
                </button>
              </div>

              {isCustom && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Ej. INTERMEDIO, LLUVIA_EXTREMA"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    required={isCustom}
                    className="w-full bg-[#0a0c10] border border-gray-800 rounded px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none uppercase"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-mono text-gray-400 block uppercase">
                Nombre del Piloto o Miembro:
              </label>
              <input
                type="text"
                placeholder="Ej. Carlos G., Lucía M., Piloto 2"
                value={isCustom ? customInput : selectedValue}
                onChange={(e) => {
                  setSelectedValue(e.target.value);
                  setCustomInput(e.target.value);
                }}
                required
                className="w-full bg-[#0a0c10] border border-gray-800 rounded px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(availablePilots.length > 0 ? availablePilots : ['Piloto 1', 'Piloto 2', 'Piloto 3', 'Piloto Reserva']).map((p) => {
                  const isSelected = (!isCustom && selectedValue === p) || customInput === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelectedValue(p);
                        setCustomInput(p);
                        setIsCustom(false);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer flex items-center space-x-1 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow ring-1 ring-blue-400'
                          : 'bg-[#0a0c10] hover:bg-gray-800 border border-gray-800 text-gray-300'
                      }`}
                    >
                      <User className="w-3 h-3 text-cyan-400" />
                      <span>{p}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-mono text-gray-400 block uppercase">
              Motivo / Nota Operativa (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ej. Parada programada, pinchazo, relevo obligatorio"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0a0c10] border border-gray-800 rounded px-3 py-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>

          <p className="text-[11px] text-gray-500 font-mono">
            Métrica neutral: Los stints y totales por compuesto/piloto se recalculan autoritativamente con sello de servidor.
          </p>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono text-xs rounded cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold rounded flex items-center space-x-1.5 cursor-pointer transition-colors shadow"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar Cambio</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
