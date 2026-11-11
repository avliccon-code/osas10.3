import React, { useState, useEffect } from 'react';
import { User, Appointment } from '../../types';
import {
  getAppointments,
  createAppointment,
  safeLocalStorageSet,
} from '../../services/storage';
import { db } from '../../services/firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { Calendar, Clock, Plus, CheckCircle2, AlertCircle, Star, Send, XCircle, RotateCcw, ExternalLink, ShieldCheck } from 'lucide-react';

const GOOGLE_FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScNdiXXAePbStheorox7q1WM1onz4TG7WY6UwMShfJ8OWzVRg/viewform?usp=header';

interface StudentAppointmentsModuleProps {
  user: User;
}

const formatTime24h = (time12: string): string => {
  if (!time12) return '10:00';
  if (/^\d{2}:\d{2}$/.test(time12)) return time12;
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return '10:00';
  let [_, hStr, mStr, ampm] = match;
  let h = parseInt(hStr, 10);
  if (ampm && ampm.toUpperCase() === 'PM' && h < 12) h += 12;
  if (ampm && ampm.toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mStr}`;
};

const formatTime12h = (time24: string): string => {
  if (!time24) return '10:00 AM';
  if (time24.includes('AM') || time24.includes('PM')) return time24;
  const parts = time24.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

export const StudentAppointmentsModule: React.FC<StudentAppointmentsModuleProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>(() => getAppointments('STUDENT'));

  const [description, setDescription] = useState('');
  const [preferredDate, setPreferredDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );
  const [preferredTime, setPreferredTime] = useState('10:00 AM');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const refreshList = () => {
    setAppointments(getAppointments('STUDENT'));
  };

  useEffect(() => {
    refreshList();
    const interval = setInterval(refreshList, 1000);
    window.addEventListener('osas_storage_updated', refreshList);
    window.addEventListener('storage', refreshList);

    const mergeAppointmentSnapshot = (incomingList: Appointment[]) => {
      const map = new Map<string, Appointment>();
      try {
        const raw = localStorage.getItem('osas_appointments');
        const currentAll: Appointment[] = raw ? JSON.parse(raw) : getAppointments('STUDENT');
        if (Array.isArray(currentAll)) {
          currentAll.forEach((a) => {
            if (a && a.id) map.set(a.id, a);
          });
        }
      } catch {
        getAppointments('STUDENT').forEach((a) => {
          if (a && a.id) map.set(a.id, a);
        });
      }
      incomingList.forEach((a) => {
        if (a && a.id) {
          const existing = map.get(a.id);
          if (!existing || (a.updatedAt || 0) >= (existing.updatedAt || 0)) {
            map.set(a.id, existing ? { ...existing, ...a, isArchived: Boolean(a.isArchived ?? existing.isArchived) } : a);
          }
        }
      });
      const merged = Array.from(map.values());
      safeLocalStorageSet('osas_appointments', JSON.stringify(merged));
      setAppointments(
        merged
          .filter((a) => !a.isGuidanceWalkIn && a.office !== 'GUIDANCE_WALK_IN')
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      );
    };

    const unsubColl = onSnapshot(
      collection(db, 'appointments'),
      (snap) => {
        if (!snap.empty) {
          const docs = snap.docs.map((d) => d.data() as Appointment).filter((a) => a && a.id);
          if (docs.length > 0) {
            mergeAppointmentSnapshot(docs);
          }
        }
      },
      () => {}
    );

    const unsubStore = onSnapshot(
      doc(db, 'osas_store', 'osas_appointments'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.value) && data.value.length > 0) {
            mergeAppointmentSnapshot(data.value as Appointment[]);
          }
        }
      },
      () => {}
    );

    return () => {
      clearInterval(interval);
      window.removeEventListener('osas_storage_updated', refreshList);
      window.removeEventListener('storage', refreshList);
      unsubColl();
      unsubStore();
    };
  }, []);

  const studentIdVal = (user.studentId || user.id || '').trim().toLowerCase();
  const userIdVal = (user.id || '').trim().toLowerCase();
  const userEmailVal = (user.email || '').trim().toLowerCase();
  const studentAppointments = appointments
    .filter((a) => {
      const aStudId = (a.studentId || '').trim().toLowerCase();
      const aEmail = (a.studentEmail || '').trim().toLowerCase();
      return (
        (studentIdVal && aStudId === studentIdVal) ||
        (userIdVal && aStudId === userIdVal) ||
        (userEmailVal && aEmail === userEmailVal)
      );
    })
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date || a.preferredDate).getTime() || 0;
      const timeB = new Date(b.createdAt || b.date || b.preferredDate).getTime() || 0;
      return timeB - timeA;
    });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    if (!privacyConsent) {
      alert('Mangyaring basahin at lagyan ng tsek ang Data Privacy Consent bago magsumite ng student concern.');
      return;
    }

    createAppointment(user, description, preferredDate, preferredTime, { office: 'GUIDANCE' });
    setDescription('');
    setPrivacyConsent(false);
    setSuccessMessage('Student concern request successfully submitted to Guidance Advocate!');
    setTimeout(() => setSuccessMessage(''), 5000);
    refreshList();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Book Appointment / Submit Concerns Form (Col 5) */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-2xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Submit Concerns
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Submit a confidential student concern or request a session with Guidance Advocate
            </p>
          </div>
        </div>

        {successMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Concern / Purpose of Consultation *
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the nature of your student concern, inquiry, or incident details..."
              className="w-full p-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Preferred Date *
              </label>
              <input
                type="date"
                required
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Preferred Time *
              </label>
              <input
                type="time"
                required
                value={formatTime24h(preferredTime)}
                onChange={(e) => setPreferredTime(formatTime12h(e.target.value))}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono cursor-pointer"
              />
            </div>
          </div>

          {/* Data Privacy & Confidentiality Consent (RA 10173) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-bold text-xs uppercase tracking-wider">
                Confidentiality & Privacy Notice (RA 10173)
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Student concern details and stated concerns are treated with utmost confidentiality by the Guidance Advocate Counseling Office. Personal records are processed strictly in accordance with Republic Act No. 10173 and Guidance Counselor professional ethics.
            </p>
            <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer shrink-0"
              />
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                I give consent to the DCC Guidance Advocate Counseling Office to process my student concern and inquiry with strict confidentiality pursuant to RA 10173. *
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!privacyConsent}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-2xl shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-blue-500/20"
          >
            <Send className="w-4 h-4" /> Submit Student Concern
          </button>
        </form>
      </div>

      {/* Student's Concerns List (Col 7) */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              My Student Concerns History &amp; Live Status
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Real-time updates, consultation schedule notices, and resolution status
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
            {studentAppointments.length} Student Concerns
          </span>
        </div>

        <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
          {studentAppointments.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                You have not submitted any student concerns yet.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Use the form on the left to submit a student concern.</p>
            </div>
          ) : (
            studentAppointments.map((app) => {
              const isCompleted = app.status === 'COMPLETED';
              const isRejected = app.status === 'REJECTED';
              const isGuidanceResched =
                app.rescheduledByRole === 'GUIDANCE_ADMIN' ||
                (app.rescheduledByName && app.rescheduledByName.toLowerCase().includes('guidance')) ||
                Boolean(app.referredToGuidance && app.status === 'RESCHEDULED');
              const reschedulePrefix = isGuidanceResched
                ? 'Rescheduled by Guidance Advocate'
                : 'Rescheduled by OSAS Administrator';

              return (
                <div
                  key={app.id}
                  className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3 shadow-2xs overflow-hidden w-full max-w-full"
                >
                  <div className="flex flex-col-reverse sm:flex-row items-start sm:items-start justify-between gap-2.5 w-full">
                    <div className="space-y-1 w-full min-w-0">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white break-words">{app.description}</h4>
                      <p className="text-[11px] font-mono text-blue-700 dark:text-blue-400 font-bold break-words">
                        Requested Hearing / Consultation: {app.preferredDate} @ {app.preferredTime}
                      </p>

                      {app.adminPreferredDate && (
                        <div className="mt-2 p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl space-y-1 overflow-hidden w-full">
                          <p className="text-[11px] font-mono text-purple-900 dark:text-purple-300 font-bold break-words">
                            📅 {reschedulePrefix}: {app.adminPreferredDate} @ {app.adminPreferredTime}
                          </p>
                          {(app.adminNotes || app.rescheduleReason) && (
                            <div className="text-[11px] text-purple-800 dark:text-purple-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-purple-100 dark:border-purple-900/60 break-words">
                              <span className="font-black text-purple-900 dark:text-purple-300 block text-[10px] uppercase">
                                Reason for Schedule Change / Notice:
                              </span>
                              {app.adminNotes || app.rescheduleReason}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Referred to Guidance Banner */}
                      {app.status === 'REFERRED_TO_GUIDANCE' && (
                        <div className="mt-2 p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1 overflow-hidden w-full">
                          <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 break-words">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> Referred to Guidance Office
                          </p>
                          <p className="text-[10px] text-indigo-800 dark:text-indigo-300 break-words">
                            {app.guidanceReferralNotes || 'Your student grievance has been referred to Guidance Counseling Office for specialized consultation.'}
                          </p>
                        </div>
                      )}

                      {/* Rejection Notice Banner */}
                      {isRejected && (
                        <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl space-y-1 overflow-hidden w-full">
                          <p className="text-[11px] font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5 break-words">
                            <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" /> Student Grievance Request Declined
                          </p>
                          {app.adminNotes && (
                            <p className="text-[10px] text-red-800 dark:text-red-300 bg-white dark:bg-slate-900 p-2 rounded-lg border border-red-100 dark:border-red-900/60 break-words">
                              OSAS Note: {app.adminNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <span
                      className={`self-start sm:self-auto px-2.5 py-1 text-[10px] font-black rounded-full border shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                          : isRejected
                          ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300'
                          : app.status === 'APPROVED'
                          ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300'
                          : app.status === 'RESCHEDULED'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300'
                          : app.status === 'REFERRED_TO_GUIDANCE'
                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
                      }`}
                    >
                      {app.status === 'REFERRED_TO_GUIDANCE' ? 'REFERRED TO GUIDANCE' : app.status}
                    </span>
                  </div>

                  {/* Status / Completion Info */}
                  {!isRejected && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700">
                      {isCompleted ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-bold break-words">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Student Concerns Consultation — Review Session Completed by Guidance Advocate</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 break-words">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Rating and evaluation will open once Guidance Advocate completes your Student Concerns Consultation.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback Section for COMPLETED appointments */}
                  {isCompleted && (
                    <div className="pt-3 border-t border-amber-200/60 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-xl space-y-2">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <span className="text-xs text-amber-900 dark:text-amber-200 font-semibold break-words">
                          How was your Student Concerns Consultation?
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              GOOGLE_FEEDBACK_FORM_URL,
                              '_blank',
                              'noopener,noreferrer'
                            )
                          }
                          className="w-full sm:w-auto justify-center px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                          title="Open Google Form Feedback"
                        >
                          <Star className="w-3.5 h-3.5 fill-white" />
                          <span>Leave Feedback</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
