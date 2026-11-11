import React from 'react';
import { AlertTriangle, Trash2, LogOut, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  icon?: 'trash' | 'logout' | 'alert' | 'check';
  showNoAndCancel?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure you want to delete this?',
  message = 'Are you sure you want to delete this? Deleting this item will move it to System Settings > System Archive.',
  confirmText = 'Yes',
  cancelText = 'No',
  type = 'danger',
  icon = 'trash',
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const displayCancelText = cancelText && cancelText.toLowerCase().includes('cancel') ? 'No' : (cancelText || 'No');
  const displayConfirmText = confirmText || 'Yes';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="text-center py-2 space-y-4">
        <div
          className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${
            type === 'danger'
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
              : type === 'warning'
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
              : 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
          }`}
        >
          {icon === 'logout' ? (
            <LogOut className="w-7 h-7 ml-0.5" />
          ) : icon === 'trash' ? (
            <Trash2 className="w-7 h-7" />
          ) : icon === 'check' ? (
            <CheckCircle2 className="w-7 h-7" />
          ) : (
            <AlertTriangle className="w-7 h-7" />
          )}
        </div>

        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed text-center px-2">
          {message}
        </p>

        <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            {displayCancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-6 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all cursor-pointer ${
              type === 'danger'
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-red-600/25'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
            }`}
          >
            {displayConfirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
