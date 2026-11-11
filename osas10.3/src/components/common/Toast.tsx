import React, { useEffect, useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'EMAIL';
  title: string;
  message: string;
  toEmail?: string;
}

interface ToastProps {
  toasts?: ToastMessage[];
  onClose?: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts = [], onClose }) => {
  const [internalToasts, setInternalToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleEmailSent = (e: any) => {
      const detail = e.detail;
      const newToast: ToastMessage = {
        id: `toast-${Date.now()}-${Math.random()}`,
        type: 'EMAIL',
        title: 'Email Dispatched',
        message: `Subject: ${detail.subject}`,
        toEmail: detail.toEmail,
      };
      setInternalToasts((prev) => [newToast, ...prev].slice(0, 4));
    };

    const handleSuccessTransaction = (e: any) => {
      const detail = e.detail;
      const newToast: ToastMessage = {
        id: `toast-${Date.now()}-${Math.random()}`,
        type: 'success',
        title: detail.title || detail.message || 'Transaction Successful!',
        message: detail.subMessage || detail.message || 'The requested operation was completed successfully.',
      };
      setInternalToasts((prev) => [newToast, ...prev].slice(0, 4));
    };

    window.addEventListener('osas_email_sent', handleEmailSent);
    window.addEventListener('osas_success_transaction', handleSuccessTransaction);
    return () => {
      window.removeEventListener('osas_email_sent', handleEmailSent);
      window.removeEventListener('osas_success_transaction', handleSuccessTransaction);
    };
  }, []);

  const allToasts = [...toasts, ...internalToasts];
  // Strictly display ONLY 1 active toast notification system-wide
  const activeToast = allToasts.length > 0 ? allToasts[allToasts.length - 1] : null;

  const removeToast = (id: string) => {
    setInternalToasts((prev) => prev.filter((t) => t.id !== id));
    if (onClose) onClose(id);
  };

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        removeToast(activeToast.id);
      }, 2500); // Disappears in 2.5 seconds
      return () => clearTimeout(timer);
    }
  }, [activeToast?.id]);

  if (!activeToast) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-50 flex flex-col max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:w-full px-2 pointer-events-none">
      <div
        key={activeToast.id}
        className="pointer-events-auto flex items-start gap-3 p-3.5 bg-slate-900/95 text-white rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md animate-in slide-in-from-bottom duration-300"
      >
        <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl shrink-0 mt-0.5">
          {activeToast.type === 'EMAIL' ? (
            <Mail className="w-5 h-5 text-blue-400" />
          ) : activeToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : activeToast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          ) : (
            <Info className="w-5 h-5 text-amber-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-black text-blue-300 uppercase tracking-wider">{activeToast.title}</h4>
            <button
              type="button"
              onClick={() => removeToast(activeToast.id)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              title="Close (x)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {activeToast.toEmail && (
            <p className="text-xs font-mono text-emerald-400 mt-0.5 truncate">To: {activeToast.toEmail}</p>
          )}
          <p className="text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed font-medium">{activeToast.message}</p>
        </div>
      </div>
    </div>
  );
};

export const ToastContainer = Toast;
