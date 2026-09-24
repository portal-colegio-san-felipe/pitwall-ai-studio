import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Ban,
  RotateCcw,
  RefreshCw,
  Clock,
  Filter,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { LapRecordModel, TeamModel, RaceAuditRecord } from '../types';
import { LapCorrectionModal } from './LapCorrectionModal';
import { ManualLapModal } from './ManualLapModal';
import { PlusCircle } from 'lucide-react';

interface Props {
  sessionId: string;
  sessionName: string;
  teams: TeamModel[];
  onLapInvalidatedOrRestored?: () => void;
}

export const RaceAuditAndLapsPanel: React.FC<Props> = ({
  sessionId,
  sessionName,
  teams,
  onLapInvalidatedOrRestored
}) => {
  const [activeTab, setActiveTab] = useState<'laps' | 'audit'>('laps');
  const [laps, setLaps] = useState<LapRecordModel[]>([]);
  const [auditEvents, setAuditEvents] = useState<RaceAuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [selectedLapForInvalidation, setSelectedLapForInvalidation] = useState<LapRecordModel | null>(null);
  const [showManualLapModal, setShowManualLapModal] = useState(false);
  const [restoringLapId, setRestoringLapId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchLaps = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}/laps`);
      if (res.ok) {
        const data = await res.json();
        setLaps(data.laps || []);
      }
    } catch (err) {
      console.error('Error al cargar vueltas:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditEvents(data.events || []);
      }
    } catch (err) {
      console.error('Error al cargar auditoría:', err);
    }
  }, [sessionId]);

  const refreshAll = useCallback(() => {
    fetchLaps();
    fetchAudit();
  }, [fetchLaps, fetchAudit]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleInvalidate = async (lapId: string, reason: string, actor: string) => {
    const res = await fetch(`/api/sessions/${sessionId}/laps/${lapId}/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, actor })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'Error al invalidar la vuelta');
    }

    setActionSuccessMsg('Vuelta invalidada correctamente y proyecciones recalculadas.');
    setTimeout(() => setActionSuccessMsg(null), 4000);
    refreshAll();
    onLapInvalidatedOrRestored?.();
  };

  const handleRestore = async (lapId: string) => {
    const reason = window.prompt('Indique el motivo para restaurar esta vuelta:', 'Corrección de error en invalidación previa');
    if (!reason || !reason.trim()) return;

    try {
      setRestoringLapId(lapId);
      const res = await fetch(`/api/sessions/${sessionId}/laps/${lapId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), actor: 'Director de Carrera' })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error?.message || 'Error al restaurar la vuelta');
        return;
      }

      setActionSuccessMsg('Vuelta restaurada con éxito y clasificaciones actualizadas.');
      setTimeout(() => setActionSuccessMsg(null), 4000);
      refreshAll();
      onLapInvalidatedOrRestored?.();
    } catch (err) {
      console.error(err);
      alert('Error de red al restaurar vuelta');
    } finally {
      setRestoringLapId(null);
    }
  };

  const formatLapTime = (ms: number) => {
    const totalSecs = ms / 1000;
    const minutes = Math.floor(totalSecs / 60);
    const seconds = Math.floor(totalSecs % 60);
    const millis = Math.floor(ms % 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const filteredLaps = selectedTeamFilter === 'all'
    ? laps
    : laps.filter((l) => l.teamId === selectedTeamFilter);

  // Ordenar vueltas de más reciente a más antigua
  const sortedLaps = [...filteredLaps].sort((a, b) => b.serverTimestamp - a.serverTimestamp);

  return (
    <div className="bg-[#131720] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Encabezado del Panel M5 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Auditoría & Correcciones (M5)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80">
                {sessionName}
              </span>
            </h2>
            <p className="text-xs text-gray-400 font-mono">
              Control no destructivo de vueltas, recálculo instantáneo y registro inmutable
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Selector de Pestaña */}
          <div className="bg-[#0a0c10] border border-gray-800 rounded-lg p-1 flex space-x-1 font-mono text-xs">
            <button
              onClick={() => setActiveTab('laps')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'laps'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Vueltas ({laps.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Log Auditoría ({auditEvents.length})
            </button>
          </div>

          <button
            id="btn-open-manual-lap-panel"
            onClick={() => setShowManualLapModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs rounded-lg flex items-center space-x-1 transition-colors cursor-pointer shadow"
            title="Registrar manualmente una vuelta a una escudería"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Contar Vuelta</span>
          </button>

          <button
            onClick={refreshAll}
            title="Actualizar datos de auditoría"
            className="p-1.5 bg-[#0a0c10] hover:bg-gray-800 border border-gray-800 rounded-lg text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs rounded-xl flex items-center space-x-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* PESTAÑA: HISTORIAL DE VUELTAS & ACCIÓN DE INVALIDACIÓN */}
      {activeTab === 'laps' && (
        <div className="space-y-3">
          {/* Filtro por escudería */}
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 text-gray-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtrar por escudería:</span>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                className="bg-[#0a0c10] border border-gray-700 rounded px-2 py-1 text-white outline-none cursor-pointer"
              >
                <option value="all">Todas las escuderías ({laps.length} vueltas)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-[11px] text-gray-400">
              Válidas: <span className="text-emerald-400 font-bold">{laps.filter((l) => l.isValid).length}</span> |
              Invalidadas: <span className="text-rose-400 font-bold">{laps.filter((l) => !l.isValid).length}</span>
            </div>
          </div>

          {/* Tabla de Vueltas */}
          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0a0c10]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#131720] text-gray-400 uppercase text-[11px] border-b border-gray-800">
                <tr>
                  <th className="py-2.5 px-3">Vuelta</th>
                  <th className="py-2.5 px-3">Escudería</th>
                  <th className="py-2.5 px-3 text-right">Tiempo</th>
                  <th className="py-2.5 px-3">Hora Registro</th>
                  <th className="py-2.5 px-3">Estado / Auditoría</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {sortedLaps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500 font-mono">
                      No hay vueltas registradas para esta manga.
                    </td>
                  </tr>
                ) : (
                  sortedLaps.map((lap) => {
                    const team = teams.find((t) => t.id === lap.teamId);
                    return (
                      <tr
                        key={lap.id}
                        className={`transition-colors ${
                          lap.isValid
                            ? 'hover:bg-gray-800/30'
                            : 'bg-rose-950/10 hover:bg-rose-950/20 text-gray-500'
                        }`}
                      >
                        <td className="py-2 px-3 font-bold text-white">
                          #{lap.lapNumber}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: team?.color || '#3b82f6' }}
                            />
                            <span className="font-semibold text-gray-200">
                              {team?.name || lap.teamId}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-bold font-mono">
                          <span
                            className={
                              lap.isValid ? 'text-cyan-400' : 'line-through text-gray-500'
                            }
                          >
                            {formatLapTime(lap.lapTimeMs)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-400 text-[11px]">
                          {new Date(lap.serverTimestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3">
                          {lap.isValid ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Válida</span>
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/80">
                                <XCircle className="w-3 h-3" />
                                <span>Invalidada</span>
                              </span>
                              <div className="text-[10px] text-rose-400/90 font-sans">
                                {lap.invalidationReason || 'Sin motivo'}
                                {lap.invalidatedBy ? ` · por ${lap.invalidatedBy}` : ''}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {lap.isValid ? (
                            <button
                              onClick={() => setSelectedLapForInvalidation(lap)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 hover:border-rose-600 rounded text-rose-300 text-[11px] font-semibold cursor-pointer transition-colors"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Invalidar</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(lap.id)}
                              disabled={restoringLapId === lap.id}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/80 hover:border-emerald-600 rounded text-emerald-300 text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Restaurar</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PESTAÑA: LOG INMUTABLE DE AUDITORÍA */}
      {activeTab === 'audit' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-mono flex items-center justify-between pb-1">
            <span>Eventos inmutables registrados cronológicamente en el servidor:</span>
            <span>Total: {auditEvents.length} eventos</span>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {auditEvents.length === 0 ? (
              <div className="p-6 text-center text-gray-500 font-mono text-xs bg-[#0a0c10] border border-gray-800 rounded-xl">
                No hay eventos de auditoría registrados aún para esta manga.
              </div>
            ) : (
              auditEvents.map((evt) => {
                const team = evt.teamId ? teams.find((t) => t.id === evt.teamId) : undefined;
                const isInvalidation = evt.type === 'LAP_INVALIDATED';
                const isRestoration = evt.type === 'LAP_RESTORED';
                const isLapReg = evt.type === 'LAP_REGISTERED';
                const isManualLap = evt.type === 'LAP_MANUALLY_RECORDED';

                return (
                  <div
                    key={evt.id}
                    className={`p-3 rounded-xl border text-xs font-mono flex items-start justify-between gap-3 ${
                      isInvalidation
                        ? 'bg-rose-950/20 border-rose-800/60 text-rose-200'
                        : isRestoration
                        ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-200'
                        : isManualLap
                        ? 'bg-amber-950/25 border-amber-800/60 text-amber-200'
                        : isLapReg
                        ? 'bg-[#0a0c10] border-gray-800 text-gray-300'
                        : 'bg-purple-950/20 border-purple-800/60 text-purple-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isInvalidation
                              ? 'bg-rose-900 text-rose-200'
                              : isRestoration
                              ? 'bg-emerald-900 text-emerald-200'
                              : isManualLap
                              ? 'bg-amber-900 text-amber-200'
                              : isLapReg
                              ? 'bg-gray-800 text-cyan-300'
                              : 'bg-purple-900 text-purple-200'
                          }`}
                        >
                          {evt.type}
                        </span>

                        {team && (
                          <div className="flex items-center space-x-1 text-white font-bold">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                            <span>{team.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-300 font-sans">
                        {isInvalidation && (
                          <span>
                            Vuelta #{String(evt.payload.lapNumber || '')} invalidada por{' '}
                            <strong className="text-white">{evt.actor}</strong>. Motivo:{' '}
                            <em className="text-rose-300">"{String(evt.payload.reason || '')}"</em>
                          </span>
                        )}
                        {isRestoration && (
                          <span>
                            Vuelta #{String(evt.payload.lapNumber || '')} restaurada por{' '}
                            <strong className="text-white">{evt.actor}</strong>. Motivo:{' '}
                            <em className="text-emerald-300">"{String(evt.payload.reason || '')}"</em>
                          </span>
                        )}
                        {isManualLap && (
                          <span>
                            Vuelta #{String(evt.payload.lapNumber || '')} registrada manualmente por{' '}
                            <strong className="text-white">{evt.actor}</strong> (
                            <span className="font-mono font-bold text-amber-300">
                              {evt.payload.lapTimeMs ? formatLapTime(Number(evt.payload.lapTimeMs)) : ''}
                            </span>
                            ). Motivo: <em className="text-amber-200">"{String(evt.payload.reason || '')}"</em>
                          </span>
                        )}
                        {isLapReg && (
                          <span>
                            Vuelta #{String(evt.payload.lapNumber || '')} registrada:{' '}
                            <span className="font-mono font-bold text-cyan-400">
                              {evt.payload.lapTimeMs ? formatLapTime(Number(evt.payload.lapTimeMs)) : ''}
                            </span>{' '}
                            (actor: {evt.actor})
                          </span>
                        )}
                        {!isInvalidation && !isRestoration && !isLapReg && !isManualLap && (
                          <span>{JSON.stringify(evt.payload)}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-gray-500 flex-shrink-0 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(evt.serverTimestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal de Invalidación */}
      {selectedLapForInvalidation && (
        <LapCorrectionModal
          lap={selectedLapForInvalidation}
          team={teams.find((t) => t.id === selectedLapForInvalidation.teamId)}
          isOpen={!!selectedLapForInvalidation}
          onClose={() => setSelectedLapForInvalidation(null)}
          onConfirmInvalidate={handleInvalidate}
        />
      )}

      {/* Modal de Conteo Manual de Vuelta */}
      {showManualLapModal && (
        <ManualLapModal
          sessionId={sessionId}
          teams={teams}
          onClose={() => setShowManualLapModal(false)}
          onSuccess={(msg) => {
            setActionSuccessMsg(msg);
            setTimeout(() => setActionSuccessMsg(null), 4000);
            refreshAll();
            onLapInvalidatedOrRestored?.();
          }}
        />
      )}
    </div>
  );
};
