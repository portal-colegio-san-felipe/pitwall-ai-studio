import React from 'react';
import { AlertTriangle, Flag, Trash2, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  variant?: 'purple' | 'danger' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  details = [],
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'purple',
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-rose-400" />,
          border: 'border-rose-700/60',
          badge: 'bg-rose-950/60 text-rose-300 border-rose-800',
          button: 'bg-rose-600 hover:bg-rose-500 text-white'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
          border: 'border-amber-700/60',
          badge: 'bg-amber-950/60 text-amber-300 border-amber-800',
          button: 'bg-amber-600 hover:bg-amber-500 text-black'
        };
      case 'purple':
      default:
        return {
          icon: <Flag className="w-6 h-6 text-purple-400" />,
          border: 'border-purple-700/60',
          badge: 'bg-purple-950/60 text-purple-300 border-purple-800',
          button: 'bg-purple-600 hover:bg-purple-500 text-white'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-lg bg-[#0d1117] border ${styles.border} rounded-xl shadow-2xl p-6 relative overflow-hidden`}
      >
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-3 mb-4">
          <div className={`p-2.5 rounded-lg border ${styles.badge} flex-shrink-0`}>
            {styles.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-mono">{title}</h3>
            <p className="text-sm text-gray-300 mt-1 font-sans">{message}</p>
          </div>
        </div>

        {details.length > 0 && (
          <div className="mb-6 bg-[#06080d] border border-gray-800/80 rounded-lg p-3 space-y-1.5 text-xs text-gray-300 font-mono">
            {details.map((item, idx) => (
              <div key={idx} className="flex items-start space-x-2">
                <span className="text-gray-500">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2 border-t border-gray-800/60">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono text-xs rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 ${styles.button} font-mono text-xs font-bold rounded transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 shadow`}
          >
            {isLoading && (
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
            )}
            <span>{isLoading ? 'Procesando...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
