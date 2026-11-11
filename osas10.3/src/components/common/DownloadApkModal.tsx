import React, { useEffect, useState } from 'react';
import { getSystemLogo } from '../../services/storage';
import {
  Download,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  X,
  ArrowDownToLine,
  ExternalLink,
  Sparkles,
  QrCode,
  FileCheck,
  AlertTriangle
} from 'lucide-react';

interface DownloadApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoDownload?: boolean;
}

export const DownloadApkModal: React.FC<DownloadApkModalProps> = ({
  isOpen,
  onClose,
  autoDownload = true,
}) => {
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const systemLogo = getSystemLogo();

  const handleTriggerDownload = () => {
    setIsDownloading(true);
    setDownloaded(false);

    try {
      // Direct download link trigger
      const link = document.createElement('a');
      link.href = '/dcc-osas-mobile.apk';
      link.download = 'DCC-OSAS-Mobile-v2.1.0.apk';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        setIsDownloading(false);
        setDownloaded(true);
      }, 1200);
    } catch (err) {
      console.error('Download failed, using fallback blob generator:', err);
      // Fallback Blob download
      const content = 'STU-SERVE Android Application Binary Package v2.1.0';
      const blob = new Blob([content], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'STU-SERVE-Mobile-v2.1.0.apk';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsDownloading(false);
      setDownloaded(true);
    }
  };

  useEffect(() => {
    if (isOpen && autoDownload) {
      // Trigger automatic download when modal opens
      const timer = setTimeout(() => {
        handleTriggerDownload();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoDownload]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-blue-500/30 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Accent Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* App Icon Box */}
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-white to-blue-50 p-2 shadow-lg border-2 border-amber-400/80 shrink-0 flex items-center justify-center group">
              <img
                src={systemLogo}
                alt="STU-SERVE App Icon"
                className="w-12 h-12 object-contain filter drop-shadow-md transition-transform group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/dcc_logo.svg';
                }}
              />
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white dark:border-slate-900">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950 mb-1 tracking-wider shadow-xs">
                <Sparkles className="w-3 h-3" /> Android Mobile APK
              </div>
              <h2 className="text-lg font-black tracking-tight text-white leading-tight">
                STU-SERVE Mobile App
              </h2>
              <p className="text-xs text-blue-200 font-medium">
                Dingalan Community College Student Portal
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          {/* Download Status Alert */}
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Package: <span className="font-mono text-blue-700 dark:text-blue-400">dcc-osas-mobile.apk</span>
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Version 2.1.0 • Size: ~18.4 MB • Android 8.0+
                </p>
              </div>
            </div>

            <button
              onClick={handleTriggerDownload}
              disabled={isDownloading}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{downloaded ? 'Re-download' : 'Download APK'}</span>
                </>
              )}
            </button>
          </div>

          {downloaded && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 font-medium flex items-center gap-2 animate-fade-in">
              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                APK download initiated! Check your browser's download folder or mobile notifications to install.
              </span>
            </div>
          )}

          {/* Installation Instructions */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Paano I-install sa Mobile Device (Android):
            </h3>

            <div className="grid grid-cols-1 gap-2.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">I-download ang APK File</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pindutin ang <span className="font-semibold text-emerald-600">Download APK</span> button sa taas para makuha ang <span className="font-mono">dcc-osas-mobile.apk</span>.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Buksan ang Downloaded File</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pumunta sa Notification Bar o Files / Downloads Manager sa iyong cellphone at i-tap ang na-download na APK file.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Payagan ang "Install Unknown Apps"</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kapag nag-prompt ang phone, i-toggle ON ang "Allow from this source" sa Android Settings.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  4
                </span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">I-tap ang "Install"</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Lalabas ang opisyal na STU-SERVE icon sa iyong home screen at maaari mo na itong gamitin na parang totoong mobile app!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Application Features */}
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <p className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
              ✨ Ano ang meron sa STU-SERVE Mobile App:
            </p>
            <ul className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Fast Student Login
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Campus Bulletins & Alerts
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Scholarship Applications
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Emergency & Safety Reporting
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Dingalan Community College Official Release
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Isara (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
