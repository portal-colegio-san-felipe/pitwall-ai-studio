import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface Props {
  status: ConnectionStatus;
  onRetry?: () => void;
  showRetryButton?: boolean;
}

export const StatusBadge: React.FC<Props> = ({ status, onRetry, showRetryButton = true }) => {
  if (status === 'ONLINE') {
    return (
      <div id="status-badge-online" className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-950/60 border border-emerald-500/40 rounded-full text-emerald-400 text-xs font-semibold tracking-wider uppercase">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <Wifi className="w-3.5 h-3.5" />
        <span>EN LÍNEA</span>
      </div>
    );
  }

  if (status === 'RECONNECTING') {
    return (
      <div id="status-badge-reconnecting" className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-950/60 border border-amber-500/40 rounded-full text-amber-400 text-xs font-semibold tracking-wider uppercase">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>RECONECTANDO</span>
      </div>
    );
  }

  return (
    <div id="status-badge-offline" className="inline-flex items-center space-x-2">
      <div className="inline-flex items-center space-x-2 px-3 py-1 bg-rose-950/60 border border-rose-500/40 rounded-full text-rose-400 text-xs font-semibold tracking-wider uppercase">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <WifiOff className="w-3.5 h-3.5" />
        <span>SIN CONEXIÓN</span>
      </div>
      {showRetryButton && onRetry && (
        <button
          id="btn-retry-connection"
          onClick={onRetry}
          className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-xs font-medium text-gray-200 transition-colors cursor-pointer"
          title="Reintentar conexión con el servidor autoritativo"
        >
          <RefreshCw className="w-3 h-3" />
          <span>REINTENTAR CONEXIÓN</span>
        </button>
      )}
    </div>
  );
};
