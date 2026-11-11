import React, { useState } from 'react';
import { Modal } from './Modal';
import { ShieldCheck, Cookie, Lock, FileText, CheckCircle2, AlertCircle, Info, ExternalLink, UserCheck } from 'lucide-react';

interface DataPrivacyAndCookieModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'cookies';
}

export const DataPrivacyAndCookieModal: React.FC<DataPrivacyAndCookieModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'cookies'>(defaultTab);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Privacy Notice & Cookie Policy"
      subtitle="Dingalan Community College - Office of Student Affairs and Services (OSAS)"
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Data Privacy Policy (RA 10173)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cookies')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'cookies'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Cookie className="w-4 h-4" />
            <span>Cookie & Storage Policy</span>
          </button>
        </div>

        {/* Tab 1: Philippine Data Privacy Act of 2012 (RA 10173) */}
        {activeTab === 'privacy' && (
          <div className="space-y-3.5 max-h-[58vh] overflow-y-auto pr-1.5 custom-scrollbar">
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wider text-[11px]">
                  Institutional Compliance Commitment
                </h4>
                <p className="text-[11px] text-blue-900 dark:text-blue-300 leading-relaxed">
                  Dingalan Community College (DCC) and the Office of Student Affairs and Services (OSAS) are strictly committed to protecting the privacy, confidentiality, and security of student, faculty, and administrative personal information in full compliance with the <strong>Philippine Data Privacy Act of 2012 (Republic Act No. 10173)</strong> and its Implementing Rules and Regulations (IRR).
                </p>
              </div>
            </div>

            {/* Section 1: Scope & What Information We Collect */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                Personal Information We Collect
              </h5>
              <p className="leading-relaxed pl-6.5 text-[11px]">
                In the delivery of student welfare, guidance counseling, scholarship grants, dormitory housing, and disciplinary services, we collect:
              </p>
              <ul className="list-disc list-inside pl-6.5 text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                <li><strong>Identification Data:</strong> Full name, Student ID number, institutional/registered email, course, year level, section, and contact number.</li>
                <li><strong>Application Requirements:</strong> Academic transcripts/grade slips, Certificate of Registration (COR), Certificate of Indigency, Certificate of Good Moral, and related scholarship documents.</li>
                <li><strong>Residency & Guidance Data:</strong> Permanent residential address, dormitory residency details, counseling appointment summaries, and disciplinary incident records.</li>
              </ul>
            </div>

            {/* Section 2: Lawful Basis & Purpose of Processing */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                Purpose of Data Processing
              </h5>
              <p className="leading-relaxed pl-6.5 text-[11px]">
                Your personal information is collected and processed solely for legitimate academic and institutional purposes, including:
              </p>
              <ul className="list-disc list-inside pl-6.5 text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                <li>Evaluating and awarding university and government-sponsored scholarship grants.</li>
                <li>Assessing dormitory accommodation eligibility, room assignments, and resident safety.</li>
                <li>Scheduling and documenting confidential guidance and counseling consultations.</li>
                <li>Investigating reported incidents, enforcing campus discipline, and issuing student clearances.</li>
                <li>Transmitting official academic notices, bulletin updates, and security alerts.</li>
              </ul>
            </div>

            {/* Section 3: Data Protection & Security Controls */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                Security Measures & Confidentiality
              </h5>
              <p className="leading-relaxed pl-6.5 text-[11px]">
                We maintain strict physical, technical, and organizational security controls:
              </p>
              <ul className="list-disc list-inside pl-6.5 text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                <li><strong>Cryptographic Hashing:</strong> Passwords are encrypted using salted SHA-256 cryptographic hashing and are never stored or logged in plain text.</li>
                <li><strong>Role-Based Access Control (RBAC):</strong> Student records, guidance notes, and disciplinary records are strictly partitioned and accessible only to authorized personnel.</li>
                <li><strong>Session Security:</strong> Inactivity timeouts automatically terminate dormant sessions after 30 minutes to safeguard unattended devices.</li>
                <li><strong>No Commercial Disclosure:</strong> DCC OSAS will NEVER sell, lease, or share your personal information with unauthorized third parties or commercial advertisers.</li>
              </ul>
            </div>

            {/* Section 4: Data Subject Rights */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-5 h-5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold">4</span>
                Your Rights as a Data Subject Under RA 10173
              </h5>
              <p className="leading-relaxed pl-6.5 text-[11px]">
                Under the Data Privacy Act of 2012, you have the right to:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6.5 text-[11px] pt-1">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong className="text-blue-700 dark:text-blue-400 block font-bold">Right to be Informed</strong>
                  <span className="text-slate-500">Know how your personal data is collected and processed.</span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong className="text-blue-700 dark:text-blue-400 block font-bold">Right to Access</strong>
                  <span className="text-slate-500">Request reasonable access to your student records.</span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong className="text-blue-700 dark:text-blue-400 block font-bold">Right to Rectification</strong>
                  <span className="text-slate-500">Dispute inaccuracies and correct outdated profile data.</span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong className="text-blue-700 dark:text-blue-400 block font-bold">Right to File a Complaint</strong>
                  <span className="text-slate-500">Address privacy concerns directly to OSAS or the NPC.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Cookie & Browser Storage Policy */}
        {activeTab === 'cookies' && (
          <div className="space-y-3.5 max-h-[58vh] overflow-y-auto pr-1.5 custom-scrollbar">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-start gap-3">
              <Cookie className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider text-[11px]">
                  Transparent Browser Storage Policy
                </h4>
                <p className="text-[11px] text-emerald-900 dark:text-emerald-300 leading-relaxed">
                  The STU-SERVE Portal uses web storage (Session Storage and Local Storage) exclusively to provide essential system functionality, keep your login session secure, and cache synchronized university announcements. <strong>We do NOT use third-party advertising or commercial tracking cookies.</strong>
                </p>
              </div>
            </div>

            {/* Breakdown of Storage Types */}
            <div className="space-y-3">
              {/* Strictly Necessary Session Storage */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-blue-600" />
                    Strictly Necessary Session Storage
                  </span>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200 rounded uppercase">
                    Always Active (Essential)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  These temporary session items are stored in your browser's <code className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">sessionStorage</code> and are automatically cleared when you close your browser tab or log out.
                </p>
                <div className="space-y-1 text-[11px] font-mono">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-800 dark:text-slate-200">osas_current_user</strong>: Authenticates your active portal session and verifies user permissions.
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-800 dark:text-slate-200">osas_active_module</strong>: Retains your currently active module during navigation.
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-800 dark:text-slate-200">osas_last_active_time</strong>: Monitors activity to execute automated 30-minute security timeouts.
                  </div>
                </div>
              </div>

              {/* Functional Local Storage */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Functional & Synchronization Storage
                  </span>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200 rounded uppercase">
                    Functional Cache
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Stored in <code className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">localStorage</code> to enable offline caching, theme preference, and live synchronization across DCC devices.
                </p>
                <div className="space-y-1 text-[11px] font-mono">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-800 dark:text-slate-200">osas_theme</strong>: Remembers your Dark / Light mode display preference.
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-800 dark:text-slate-200">osas_cookie_consent</strong>: Records your acknowledgment of the Data Privacy and Cookie Policy.
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-800 dark:text-slate-200">osas_announcements / osas_scholarships</strong>: Synchronized campus bulletins for immediate offline availability.
                  </div>
                </div>
              </div>

              {/* 3rd Party Tracking Statement */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 text-[11px]">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-slate-700 dark:text-slate-300">
                  <strong>Zero Third-Party Advertising:</strong> No cross-site profiling, commercial tracking pixels, or marketing cookies are embedded in this system.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            RA 10173 • National Privacy Commission (NPC) Compliant
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
