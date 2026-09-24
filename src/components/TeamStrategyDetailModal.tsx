import React, { useState } from 'react';
import { X, Wrench, Disc, User, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { TeamStrategyState, TeamModel, SessionModel } from '../types';

interface TeamStrategyDetailModalProps {
  isOpen: boolean;
  team: TeamModel;
  session: SessionModel;
  strategy?: TeamStrategyState;
  onClose: () => void;
  onPitIn: (teamId: string) => Promise<void>;
  onPitOut: (teamId: string) => Promise<void>;
  onChangeEquipment: (teamId: string) => void;
  onChangePersonnel: (teamId: string) => void;
}

export const TeamStrategyDetailModal: React.FC<TeamStrategyDetailModalProps> = ({
  isOpen,
  team,
  session,
  strategy,
  onClose,
  onPitIn,
  onPitOut,
  onChangeEquipment,
  onChangePersonnel
}) => {
  const [activeTab, setActiveTab] = useState<'pits' | 'equipment' | 'personnel'>('pits');
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const pitState = strategy?.pitState || 'ON_TRACK';
  const isInPit = pitState === 'IN_PIT';

  const formatDuration = (ms?: number) => {
    if (ms === undefined || ms === null) return '-';
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds} s`;
  };

  const handlePitAction = async (action: 'in' | 'out') => {
    setIsActionLoading(true);
    try {
      if (action === 'in') {
        await onPitIn(team.id);
      } else {
        await onPitOut(team.id);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#131720] border border-gray-800 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div
              className="w-4 h-10 rounded"
              style={{ backgroundColor: team.color || '#3b82f6' }}
            />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">{team.name}</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    isInPit
                      ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {isInPit ? 'EN BOXES' : 'EN PISTA'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Estrategia Neutral • {session.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen Superior de Métricas Neutrales */}
        <div className="grid grid-cols-3 gap-2.5 flex-shrink-0 text-xs font-mono">
          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-gray-500 uppercase flex items-center space-x-1">
              <Wrench className="w-3 h-3 text-amber-400" />
              <span>Paradas en Boxes</span>
            </div>
            <div className="text-lg font-black text-white font-tabular">
              {strategy?.pitStopCount || 0}
            </div>
            <div className="text-[10px] text-gray-400">
              Última: {formatDuration(strategy?.lastPitDurationMs)}
            </div>
          </div>

          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-gray-500 uppercase flex items-center space-x-1">
              <Disc className="w-3 h-3 text-blue-400" />
              <span>Compuesto Actual</span>
            </div>
            <div className="text-sm font-bold text-blue-300 truncate">
              {strategy?.currentEquipment || 'HARD'}
            </div>
            <div className="text-[10px] text-gray-400">
              Stint: {strategy?.equipmentStintLaps || 0} vueltas
            </div>
          </div>

          <div className="bg-[#0a0c10] border border-gray-800/80 rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-gray-500 uppercase flex items-center space-x-1">
              <User className="w-3 h-3 text-emerald-400" />
              <span>Piloto en Pista</span>
            </div>
            <div className="text-sm font-bold text-emerald-300 truncate">
              {strategy?.currentPersonnel || 'Piloto 1'}
            </div>
            <div className="text-[10px] text-gray-400">
              Relevo: {strategy?.personnelStintLaps || 0} vueltas
            </div>
          </div>
        </div>

        {/* Botones de Control Operativo Rápido */}
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-[#0a0c10] border border-gray-800/80 rounded-lg flex-shrink-0">
          <span className="text-[10px] font-mono text-gray-400 uppercase font-semibold mr-1">
            Acciones de Comisario:
          </span>
          {isInPit ? (
            <button
              onClick={() => handlePitAction('out')}
              disabled={isActionLoading}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors shadow"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" />
              <span>Marcar Salida de Boxes (PIT OUT)</span>
            </button>
          ) : (
            <button
              onClick={() => handlePitAction('in')}
              disabled={isActionLoading}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors shadow"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" />
              <span>Marcar Entrada a Boxes (PIT IN)</span>
            </button>
          )}

          <button
            onClick={() => onChangeEquipment(team.id)}
            className="px-2.5 py-1 bg-[#1a2130] hover:bg-blue-900/60 text-blue-300 border border-blue-800/60 font-mono text-xs font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <Disc className="w-3.5 h-3.5 text-blue-400" />
            <span>Cambiar Compuesto</span>
          </button>

          <button
            onClick={() => onChangePersonnel(team.id)}
            className="px-2.5 py-1 bg-[#1a2130] hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 font-mono text-xs font-bold rounded flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>Relevo de Piloto</span>
          </button>
        </div>

        {/* Pestañas de Detalle */}
        <div className="flex items-center space-x-2 border-b border-gray-800 flex-shrink-0">
          <button
            onClick={() => setActiveTab('pits')}
            className={`pb-2 text-xs font-mono font-bold transition-colors cursor-pointer border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'pits'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Historial de Boxes ({strategy?.pitStops?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('equipment')}
            className={`pb-2 text-xs font-mono font-bold transition-colors cursor-pointer border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'equipment'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Compuestos & Stints</span>
          </button>

          <button
            onClick={() => setActiveTab('personnel')}
            className={`pb-2 text-xs font-mono font-bold transition-colors cursor-pointer border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'personnel'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Pilotos & Relevos</span>
          </button>
        </div>

        {/* Contenido de Pestaña con Scroll */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {activeTab === 'pits' && (
            <div className="space-y-2">
              {!strategy?.pitStops || strategy.pitStops.length === 0 ? (
                <div className="p-6 bg-[#0a0c10] border border-gray-800/80 rounded-lg text-center text-gray-500 font-mono text-xs">
                  Sin paradas en boxes registradas para esta escudería en la manga.
                </div>
              ) : (
                <div className="space-y-1.5 font-mono text-xs">
                  {strategy.pitStops.map((stop, idx) => (
                    <div
                      key={stop.id || idx}
                      className="p-3 bg-[#0a0c10] border border-gray-800 rounded-lg flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center space-x-2">
                          <span>Parada #{idx + 1}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-800 text-gray-300">
                            Vuelta {stop.lapNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Entrada: {new Date(stop.pitInTimestamp).toLocaleTimeString('es-ES')}
                          {stop.pitOutTimestamp && (
                            <span> • Salida: {new Date(stop.pitOutTimestamp).toLocaleTimeString('es-ES')}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-amber-400 font-tabular">
                          {formatDuration(stop.durationMs)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {stop.durationMs !== undefined ? 'Completada' : 'En curso'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'equipment' && (
            <div className="space-y-3">
              {/* Totales por compuesto */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono text-gray-400 uppercase font-semibold">
                  Totales acumulados por compuesto:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                  {Object.entries(strategy?.equipmentTotals || { HARD: 0 }).map(([eq, count]) => (
                    <div
                      key={eq}
                      className="p-2.5 bg-[#0a0c10] border border-gray-800 rounded-lg"
                    >
                      <div className="text-[10px] text-gray-500 uppercase">{eq}</div>
                      <div className="text-base font-bold text-white font-tabular">{count} vueltas</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historial de cambios */}
              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-mono text-gray-400 uppercase font-semibold">
                  Historial de cambios de calzado:
                </div>
                {!strategy?.equipmentHistory || strategy.equipmentHistory.length === 0 ? (
                  <div className="p-4 bg-[#0a0c10] border border-gray-800/80 rounded-lg text-center text-gray-500 font-mono text-xs">
                    Compuesto de inicio por defecto: {strategy?.currentEquipment || 'HARD'}. Sin cambios registrados.
                  </div>
                ) : (
                  <div className="space-y-1.5 font-mono text-xs">
                    {strategy.equipmentHistory.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-2.5 bg-[#0a0c10] border border-gray-800 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-blue-300">
                            Cambio a {item.equipment}
                            {item.previousEquipment && (
                              <span className="text-gray-500 font-normal"> (desde {item.previousEquipment})</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Vuelta {item.lapNumber} • {new Date(item.serverTimestamp).toLocaleTimeString('es-ES')} • Por: {item.actor}
                          </div>
                          {item.reason && (
                            <div className="text-[10px] text-gray-400 italic mt-0.5">
                              Nota: {item.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'personnel' && (
            <div className="space-y-3">
              {/* Totales por piloto */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono text-gray-400 uppercase font-semibold">
                  Totales acumulados por piloto:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
                  {Object.entries(strategy?.personnelTotals || { 'Piloto 1': 0 }).map(([p, count]) => (
                    <div
                      key={p}
                      className="p-2.5 bg-[#0a0c10] border border-gray-800 rounded-lg"
                    >
                      <div className="text-[10px] text-gray-500 uppercase truncate">{p}</div>
                      <div className="text-base font-bold text-white font-tabular">{count} vueltas</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historial de relevos */}
              <div className="space-y-1.5 pt-2">
                <div className="text-[11px] font-mono text-gray-400 uppercase font-semibold">
                  Historial de relevos de personal:
                </div>
                {!strategy?.personnelHistory || strategy.personnelHistory.length === 0 ? (
                  <div className="p-4 bg-[#0a0c10] border border-gray-800/80 rounded-lg text-center text-gray-500 font-mono text-xs">
                    Piloto de inicio por defecto: {strategy?.currentPersonnel || 'Piloto 1'}. Sin relevos registrados.
                  </div>
                ) : (
                  <div className="space-y-1.5 font-mono text-xs">
                    {strategy.personnelHistory.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-2.5 bg-[#0a0c10] border border-gray-800 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-emerald-300">
                            Relevo: {item.personnel}
                            {item.previousPersonnel && (
                              <span className="text-gray-500 font-normal"> (releva a {item.previousPersonnel})</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Vuelta {item.lapNumber} • {new Date(item.serverTimestamp).toLocaleTimeString('es-ES')} • Por: {item.actor}
                          </div>
                          {item.reason && (
                            <div className="text-[10px] text-gray-400 italic mt-0.5">
                              Nota: {item.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-800 flex-shrink-0">
          <span className="text-[11px] text-gray-500 font-mono">
            Métricas de medición neutral (M6) • Sin inferencia ni penalizaciones automáticas
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono text-xs rounded cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
