import React from 'react';
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  subMessage?: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  title = 'Tagumpay! (Transaction Successful)',
  message,
  subMessage = 'Naisagawa at na-update na ang transaksyon sa OSAS System.',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="text-center py-3 space-y-4">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-full animate-ping" />
          <div className="relative w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <CheckCircle2 className="w-9 h-9" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Naisagawa Nang Maayos!</span>
          </h4>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug px-2">
            {message}
          </p>
          {subMessage && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subMessage}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
          >
            <span>Ipagpatuloy / Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
};
