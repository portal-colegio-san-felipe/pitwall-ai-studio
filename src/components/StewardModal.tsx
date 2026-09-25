import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Clock,
  ArrowDownCircle,
  Ban,
  CheckCircle,
  ShieldAlert,
  History,
  Undo2
} from 'lucide-react';
import {
  TeamModel,
  SessionModel,
  TeamStewardingState,
  TimePenaltyRecord,
  PitRequiredRecord,
  WarningRecord
} from '../types';

interface StewardModalProps {
  isOpen: boolean;
  team: TeamModel;
  session: SessionModel;
  stewarding?: TeamStewardingState;
  onClose: () => void;
  onIssueWarning: (teamId: string, reason: string) => Promise<void>;
  onApplyTimePenalty: (teamId: string, seconds: number, reason: string) => Promise<void>;
  onCancelTimePenalty: (penaltyId: string, reason: string) => Promise<void>;
  onIssuePitRequired: (teamId: string, reason: string) => Promise<void>;
  onResolvePitRequired: (directiveId: string, status: 'SERVED' | 'CANCELLED', reason?: string) => Promise<void>;
  onDisqualify: (teamId: string, reason: string) => Promise<void>;
  onReinstate: (teamId: string, reason: string) => Promise<void>;
}

type TabType = 'warning' | 'penalty' | 'pit' | 'dq' | 'history';

export const StewardModal: React.FC<StewardModalProps> = ({
  isOpen,
  team,
  session,
  stewarding,
  onClose,
  onIssueWarning,
  onApplyTimePenalty,
  onCancelTimePenalty,
  onIssuePitRequired,
  onResolvePitRequired,
  onDisqualify,
  onReinstate
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('warning');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [warningReason, setWarningReason] = useState('');
  const [penaltySeconds, setPenaltySeconds] = useState<number>(3);
  const [penaltyReason, setPenaltyReason] = useState('');
  const [pitRequiredReason, setPitRequiredReason] = useState('');
  const [dqReason, setDqReason] = useState('');
  const [reinstateReason, setReinstateReason] = useState('');
  const [revokePenaltyId, setRevokePenaltyId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  if (!isOpen) return null;

  const handleWarningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningReason.trim()) {
      setErrorMsg('Debes especificar el motivo de la advertencia.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await onIssueWarning(team.id, warningReason.trim());
      setSuccessMsg('Advertencia emitida correctamente.');
      setWarningReason('');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al emitir advertencia');
    } finally {
      setLoading(false);
    }
  };

  const handlePenaltySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!penaltyReason.trim()) {
      setErrorMsg('Debes especificar el motivo de la penalización de tiempo.');
      return;
    }
    if (penaltySeconds <= 0) {
      setErrorMsg('Los segundos de penalización deben ser mayores a 0.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await onApplyTimePenalty(team.id, penaltySeconds, penaltyReason.trim());
      setSuccessMsg(`Penalización de +${penaltySeconds.toFixed(3)}s aplicada.`);
      setPenaltyReason('');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al aplicar penalización');
    } finally {
      setLoading(false);
    }
  };

  const handlePitRequiredSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pitRequiredReason.trim()) {
      setErrorMsg('Debes especificar el motivo de la parada obligatoria.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await onIssuePitRequired(team.id, pitRequiredReason.trim());
      setSuccessMsg('Orden de parada obligatoria en boxes emitida.');
      setPitRequiredReason('');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al emitir orden de boxes');
    } finally {
      setLoading(false);
    }
  };

  const handleDqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dqReason.trim()) {
      setErrorMsg('Debes especificar el motivo de la descalificación.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await onDisqualify(team.id, dqReason.trim());
      setSuccessMsg('Escudería descalificada de la sesión.');
      setDqReason('');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al descalificar escudería');
    } finally {
      setLoading(false);
    }
  };

  const handleReinstateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reinstateReason.trim()) {
      setErrorMsg('Debes especificar el motivo de readmisión / apelación.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await onReinstate(team.id, reinstateReason.trim());
      setSuccessMsg('Descalificación revocada y escudería readmitida.');
      setReinstateReason('');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al readmitir escudería');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokePenalty = async (penaltyId: string) => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await onCancelTimePenalty(penaltyId, revokeReason.trim() || 'Revocada por Dirección de Carrera');
      setSuccessMsg('Penalización de tiempo revocada.');
      setRevokePenaltyId(null);
      setRevokeReason('');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al revocar penalización');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDirective = async (directiveId: string, status: 'SERVED' | 'CANCELLED') => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await onResolvePitRequired(directiveId, status);
      setSuccessMsg(`Directiva marcada como ${status === 'SERVED' ? 'CUMPLIDA' : 'CANCELADA'}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar directiva');
    } finally {
      setLoading(false);
    }
  };

  const isDq = stewarding?.isDisqualified || false;
  const totalPenSec = stewarding ? (stewarding.totalPenaltyMs / 1000).toFixed(3) : '0.000';
  const hasActivePit = !!stewarding?.activePitRequired;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-gray-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0d1017]">
          <div className="flex items-center space-x-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: team.color || '#3b82f6' }}
            />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Comisaría Deportiva — {team.name}
                </h3>
                {isDq && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest bg-rose-950 border border-rose-600 text-rose-300">
                    DESCALIFICADO
                  </span>
                )}
                {stewarding && stewarding.totalPenaltyMs > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-600 text-amber-300">
                    +{totalPenSec}s PEN
                  </span>
                )}
                {hasActivePit && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950 border border-orange-600 text-orange-300 animate-pulse">
                    BOXES REQUERIDO
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Sesión: <span className="font-semibold text-gray-200">{session.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificaciones de Éxito / Error */}
        {errorMsg && (
          <div className="bg-rose-950/90 border-b border-rose-800 text-rose-200 px-4 py-2 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-800 text-emerald-200 px-4 py-2 text-xs flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tabs de Navegación */}
        <div className="flex border-b border-gray-800 bg-[#0a0c12] text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('warning')}
            className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'warning'
                ? 'border-yellow-500 text-yellow-400 bg-yellow-950/20'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Advertencia</span>
          </button>

          <button
            onClick={() => setActiveTab('penalty')}
            className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'penalty'
                ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Penalización de Tiempo</span>
          </button>

          <button
            onClick={() => setActiveTab('pit')}
            className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'pit'
                ? 'border-orange-500 text-orange-400 bg-orange-950/20'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Boxes Obligatorio</span>
          </button>

          <button
            onClick={() => setActiveTab('dq')}
            className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'dq'
                ? 'border-rose-500 text-rose-400 bg-rose-950/20'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40'
            }`}
          >
            <Ban className="w-4 h-4" />
            <span>Descalificación</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-1.5 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial ({stewarding ? stewarding.warnings.length + stewarding.timePenalties.length + stewarding.pitRequiredDirectives.length + (stewarding.disqualification ? 1 : 0) : 0})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: ADVERTENCIA */}
          {activeTab === 'warning' && (
            <form onSubmit={handleWarningSubmit} className="space-y-4">
              <div className="p-3 bg-yellow-950/20 border border-yellow-800/60 rounded-lg text-xs text-yellow-200 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p>
                  Las advertencias se comunican de inmediato en la pantalla de Pit Wall de la escudería sin aplicar sanción numérica de tiempo.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                  Motivo de la Advertencia *
                </label>
                <textarea
                  value={warningReason}
                  onChange={(e) => setWarningReason(e.target.value)}
                  placeholder="Ej: Límite de pista excedido en curva 3, conducción temeraria..."
                  rows={3}
                  className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Emitir Advertencia</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PENALIZACIÓN DE TIEMPO */}
          {activeTab === 'penalty' && (
            <form onSubmit={handlePenaltySubmit} className="space-y-4">
              <div className="p-3 bg-amber-950/20 border border-amber-800/60 rounded-lg text-xs text-amber-200 flex items-start space-x-2">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Regla de Preservación de Cronometraje Bruto:</p>
                  <p className="mt-0.5 text-gray-300">
                    Los tiempos brutos de vuelta se mantienen intactos y archivados. La penalización se suma en la clasificación ajustada y puede revocarse en cualquier momento con motivo auditado.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">
                  Tiempo a Añadir (Segundos) *
                </label>
                <div className="flex items-center space-x-2 mb-2">
                  {[3, 5, 10, 15, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setPenaltySeconds(sec)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-colors ${
                        penaltySeconds === sec
                          ? 'bg-amber-600 border-amber-500 text-black'
                          : 'bg-[#0a0c10] border-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      +{sec}s
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0.1"
                  value={penaltySeconds}
                  onChange={(e) => setPenaltySeconds(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                  Motivo de la Penalización *
                </label>
                <textarea
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  placeholder="Ej: Exceso de velocidad en el carril de boxes (+3.000s), contacto antideportivo..."
                  rows={3}
                  className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  <span>Aplicar +{penaltySeconds}s de Penalización</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PARADA OBLIGATORIA (PIT_REQUIRED) */}
          {activeTab === 'pit' && (
            <div className="space-y-4">
              {hasActivePit && stewarding?.activePitRequired && (
                <div className="p-4 bg-orange-950/40 border border-orange-700 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-orange-300 tracking-wider flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping inline-block mr-1" />
                      Directiva Activa: Parada Pendiente
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(stewarding.activePitRequired.serverTimestamp).toLocaleTimeString('es-ES')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-200">
                    Motivo: <span className="font-semibold text-white">{stewarding.activePitRequired.reason}</span>
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleResolveDirective(stewarding.activePitRequired!.id, 'SERVED')}
                      className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center space-x-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Marcar como Cumplida (SERVED)</span>
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleResolveDirective(stewarding.activePitRequired!.id, 'CANCELLED')}
                      className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs flex items-center space-x-1"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Cancelar Directiva (CANCELLED)</span>
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handlePitRequiredSubmit} className="space-y-4">
                <div className="p-3 bg-[#0a0c10] border border-gray-800 rounded-lg text-xs text-gray-300 flex items-start space-x-2">
                  <ArrowDownCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <p>
                    Emite la directiva obligatoria <span className="font-mono font-bold text-orange-300">PIT_REQUIRED</span>. Se notificará en el Pit Wall de la escudería en pantalla completa. La directiva pasará a <span className="font-mono text-emerald-300">SERVED</span> cuando la escudería efectúe la entrada en boxes o cuando Dirección de Carrera lo valide.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                    Motivo de la Orden de Entrada a Boxes *
                  </label>
                  <textarea
                    value={pitRequiredReason}
                    onChange={(e) => setPitRequiredReason(e.target.value)}
                    placeholder="Ej: Revisión técnica obligatoria de sujeción de casco, drive-through, parada obligatoria de reglamento..."
                    rows={3}
                    className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    <span>Emitir Directiva PIT_REQUIRED</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: DESCALIFICACIÓN (DQ / REINSTATE) */}
          {activeTab === 'dq' && (
            <div className="space-y-4">
              {isDq ? (
                <div className="p-4 bg-rose-950/60 border border-rose-700 rounded-lg space-y-3">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                    <span className="text-sm font-black text-rose-200 uppercase tracking-wider">
                      Escudería actualmente DESCALIFICADA
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 space-y-1">
                    <p>Motivo: <span className="font-semibold text-white">{stewarding?.disqualification?.reason}</span></p>
                    <p>Comisario: <span className="font-semibold text-gray-200">{stewarding?.disqualification?.actor}</span></p>
                    <p>Fecha/Hora: <span className="font-mono text-gray-400">{stewarding?.disqualification?.serverTimestamp ? new Date(stewarding.disqualification.serverTimestamp).toLocaleString('es-ES') : ''}</span></p>
                  </div>

                  <form onSubmit={handleReinstateSubmit} className="pt-2 border-t border-rose-900/60 space-y-3">
                    <p className="text-xs font-semibold text-emerald-300">
                      Revocación deliberada y readmisión de la escudería:
                    </p>
                    <textarea
                      value={reinstateReason}
                      onChange={(e) => setReinstateReason(e.target.value)}
                      placeholder="Motivo de la revocación / decisión de comisaría colegiada..."
                      rows={2}
                      className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Revertir Descalificación y Readmitir</span>
                    </button>
                  </form>
                </div>
              ) : (
                <form onSubmit={handleDqSubmit} className="space-y-4">
                  <div className="p-3 bg-rose-950/20 border border-rose-800/60 rounded-lg text-xs text-rose-200 flex items-start space-x-2">
                    <Ban className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <p>
                      La descalificación retira a la escudería de la clasificación oficial de la manga con estado <span className="font-mono font-bold">DQ</span>. Toda acción queda registrada con marca temporal y puede ser revertida de forma auditada por Dirección de Carrera.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">
                      Motivo Obligatorio de la Descalificación *
                    </label>
                    <textarea
                      value={dqReason}
                      onChange={(e) => setDqReason(e.target.value)}
                      placeholder="Ej: Infracción técnica no subsanable, reiterada negativa a cumplir bandera negra / boxes..."
                      rows={3}
                      className="w-full bg-[#0a0c10] border border-gray-700 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
                      required
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors"
                    >
                      Cerrar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Confirmar Descalificación de Escudería</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 5: HISTORIAL Y AUDITORÍA DE DECISIONES */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-400">
                Historial completo de notas, sanciones, penalizaciones de tiempo y directivas para <span className="text-white font-semibold">{team.name}</span>:
              </div>

              {/* Modal inline para revocar penalización */}
              {revokePenaltyId && (
                <div className="p-3 bg-amber-950/40 border border-amber-700 rounded-lg space-y-2">
                  <p className="text-xs font-bold text-amber-200">Revocar Penalización de Tiempo:</p>
                  <input
                    type="text"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    placeholder="Motivo de la revocación (ej: error en identificación de dorsal)..."
                    className="w-full bg-[#0a0c10] border border-gray-700 rounded p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setRevokePenaltyId(null)}
                      className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevokePenalty(revokePenaltyId)}
                      className="px-3 py-1 rounded bg-amber-600 text-black font-bold text-xs"
                    >
                      Confirmar Revocación
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {/* Penalizaciones de Tiempo */}
                {stewarding?.timePenalties.map((pen: TimePenaltyRecord) => (
                  <div
                    key={pen.id}
                    className={`p-3 rounded-lg border text-xs flex items-start justify-between ${
                      pen.cancelled
                        ? 'bg-gray-900/40 border-gray-800 opacity-60'
                        : 'bg-amber-950/20 border-amber-800/60'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className={`font-mono font-bold ${pen.cancelled ? 'line-through text-gray-400' : 'text-amber-400'}`}>
                          +{pen.seconds.toFixed(3)}s PENALIZACIÓN
                        </span>
                        {pen.cancelled && (
                          <span className="text-[10px] text-rose-400 font-bold uppercase bg-rose-950 px-1.5 py-0.2 rounded border border-rose-800">
                            REVOCADA
                          </span>
                        )}
                      </div>
                      <p className="text-gray-200">{pen.reason}</p>
                      {pen.cancelled && (
                        <p className="text-gray-400 text-[11px] italic">
                          Motivo revocación: {pen.cancelReason} ({pen.cancelledBy})
                        </p>
                      )}
                      <p className="text-[10px] text-gray-500 font-mono">
                        {new Date(pen.serverTimestamp).toLocaleTimeString('es-ES')} — {pen.actor}
                      </p>
                    </div>
                    {!pen.cancelled && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevokePenaltyId(pen.id);
                          setRevokeReason('');
                        }}
                        className="text-xs px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-amber-300 font-semibold"
                      >
                        Revocar
                      </button>
                    )}
                  </div>
                ))}

                {/* Directivas Boxes (PIT_REQUIRED) */}
                {stewarding?.pitRequiredDirectives.map((dir: PitRequiredRecord) => (
                  <div
                    key={dir.id}
                    className="p-3 rounded-lg border bg-orange-950/20 border-orange-800/60 text-xs flex items-start justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-orange-400">
                          PARADA OBLIGATORIA (PIT_REQUIRED)
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                            dir.status === 'SERVED'
                              ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                              : dir.status === 'CANCELLED'
                              ? 'bg-gray-900 border-gray-700 text-gray-400'
                              : 'bg-orange-950 border-orange-700 text-orange-300 animate-pulse'
                          }`}
                        >
                          {dir.status === 'SERVED' ? 'CUMPLIDA' : dir.status === 'CANCELLED' ? 'CANCELADA' : 'PENDIENTE'}
                        </span>
                      </div>
                      <p className="text-gray-200">{dir.reason}</p>
                      <p className="text-[10px] text-gray-500 font-mono">
                        {new Date(dir.serverTimestamp).toLocaleTimeString('es-ES')} — {dir.actor}
                      </p>
                    </div>
                    {dir.status === 'PENDING' && (
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleResolveDirective(dir.id, 'SERVED')}
                          className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold"
                        >
                          Cumplida
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveDirective(dir.id, 'CANCELLED')}
                          className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px]"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Advertencias */}
                {stewarding?.warnings.map((warn: WarningRecord) => (
                  <div
                    key={warn.id}
                    className="p-3 rounded-lg border bg-yellow-950/20 border-yellow-800/60 text-xs flex items-start justify-between"
                  >
                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-yellow-400">
                        ADVERTENCIA
                      </span>
                      <p className="text-gray-200">{warn.reason}</p>
                      <p className="text-[10px] text-gray-500 font-mono">
                        {new Date(warn.serverTimestamp).toLocaleTimeString('es-ES')} — {warn.actor}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Descalificación si existió */}
                {stewarding?.disqualification && (
                  <div className="p-3 rounded-lg border bg-rose-950/30 border-rose-800 text-xs space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-rose-400">
                        DESCALIFICACIÓN (DQ)
                      </span>
                      {stewarding.disqualification.reinstated ? (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                          REVOCADA / READMITIDA
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-rose-950 border border-rose-800 text-rose-300">
                          ACTIVA
                        </span>
                      )}
                    </div>
                    <p className="text-gray-200">{stewarding.disqualification.reason}</p>
                    {stewarding.disqualification.reinstated && (
                      <p className="text-gray-400 text-[11px] italic">
                        Motivo readmisión: {stewarding.disqualification.reinstateReason} ({stewarding.disqualification.reinstatedBy})
                      </p>
                    )}
                    <p className="text-[10px] text-gray-500 font-mono">
                      {new Date(stewarding.disqualification.serverTimestamp).toLocaleTimeString('es-ES')} — {stewarding.disqualification.actor}
                    </p>
                  </div>
                )}

                {(!stewarding ||
                  (stewarding.warnings.length === 0 &&
                    stewarding.timePenalties.length === 0 &&
                    stewarding.pitRequiredDirectives.length === 0 &&
                    !stewarding.disqualification)) && (
                  <div className="text-center py-6 text-xs text-gray-500">
                    No se han registrado sanciones ni advertencias para esta escudería.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
