import React from 'react';
import { AlertTriangle, Clock, ArrowDownCircle, Ban } from 'lucide-react';
import { TeamStewardingState, TimePenaltyRecord } from '../types';

interface PitWallStewardNoticeProps {
  stewarding?: TeamStewardingState;
  onQuickPitIn?: () => void;
  isPitOpen?: boolean;
}

export const PitWallStewardNotice: React.FC<PitWallStewardNoticeProps> = ({
  stewarding,
  onQuickPitIn,
  isPitOpen
}) => {
  if (!stewarding) return null;

  const { isDisqualified, disqualification, activePitRequired, timePenalties, warnings } = stewarding;

  const activePenalties = timePenalties.filter((p: TimePenaltyRecord) => !p.cancelled);
  const totalPenaltySec = (stewarding.totalPenaltyMs / 1000).toFixed(3);
  const latestWarning = warnings[warnings.length - 1];

  const hasAnyNotice =
    isDisqualified || activePitRequired || activePenalties.length > 0 || warnings.length > 0;

  if (!hasAnyNotice) return null;

  return (
    <div className="space-y-2 mb-4">
      {/* 1. Alerta de Descalificación */}
      {isDisqualified && (
        <div className="p-3 bg-rose-950/90 border-2 border-rose-600 rounded-xl text-rose-100 shadow-lg flex items-start space-x-3 animate-pulse">
          <Ban className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-black text-rose-300 uppercase tracking-widest text-sm">
              ESCUDERÍA DESCALIFICADA (DQ)
            </div>
            <p className="mt-0.5 text-gray-200">
              Motivo: <span className="font-semibold text-white">{disqualification?.reason || 'Decisión de Comisaría Deportiva'}</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Dirección de Carrera ha descalificado a la escudería de la manga actual.
            </p>
          </div>
        </div>
      )}

      {/* 2. Directiva de Parada Obligatoria en Boxes (PIT_REQUIRED) */}
      {activePitRequired && (
        <div className="p-3.5 bg-orange-950/90 border-2 border-orange-500 rounded-xl text-orange-100 shadow-xl flex items-center justify-between space-x-3">
          <div className="flex items-start space-x-2.5">
            <ArrowDownCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5 animate-bounce" />
            <div className="text-xs">
              <div className="font-black text-orange-300 uppercase tracking-wider text-sm flex items-center space-x-1.5">
                <span>¡ORDEN DE COMISARÍA: PARADA EN BOXES OBLIGATORIA!</span>
              </div>
              <p className="mt-0.5 text-white font-medium">
                Motivo: {activePitRequired.reason}
              </p>
              <p className="text-[10px] text-orange-300/80">
                La directiva quedará cumplida automáticamente al registrar la entrada a boxes.
              </p>
            </div>
          </div>
          {onQuickPitIn && !isPitOpen && (
            <button
              onClick={onQuickPitIn}
              className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-black text-xs uppercase tracking-wider shadow transition-colors flex-shrink-0"
            >
              Entrar a Boxes
            </button>
          )}
        </div>
      )}

      {/* 3. Penalización de Tiempo Activa */}
      {activePenalties.length > 0 && (
        <div className="p-2.5 bg-amber-950/80 border border-amber-600/80 rounded-xl text-amber-100 flex items-start space-x-2.5 text-xs">
          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-black font-mono text-amber-300 uppercase">
                +{totalPenaltySec}s PENALIZACIÓN DE TIEMPO
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono">
                ({activePenalties.length} sanción{activePenalties.length > 1 ? 'es' : ''})
              </span>
            </div>
            <p className="text-gray-200 mt-0.5 text-[11px]">
              {activePenalties.map((p: TimePenaltyRecord) => p.reason).join(' | ')}
            </p>
          </div>
        </div>
      )}

      {/* 4. Advertencia Deportiva */}
      {latestWarning && !isDisqualified && (
        <div className="p-2.5 bg-yellow-950/60 border border-yellow-700/60 rounded-xl text-yellow-100 flex items-start space-x-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-yellow-300 uppercase text-[11px]">
              ADVERTENCIA DE DIRECCIÓN DE CARRERA:
            </span>{' '}
            <span className="text-gray-200 text-[11px]">{latestWarning.reason}</span>
          </div>
        </div>
      )}
    </div>
  );
};
