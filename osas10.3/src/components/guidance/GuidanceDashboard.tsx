import React, { useState, useEffect } from 'react';
import {
  getAppointments,
  getDisciplinaryReports,
  getDisciplinaryRecords,
  getReferredDisciplinaryRecords,
  getUsers,
  getAnnouncements,
  updateAppointmentStatus,
  checkAppointmentConflict,
} from '../../services/storage';
import { Appointment, SystemModule, DisciplinaryRecord, DisciplinaryReport, User, Announcement } from '../../types';
import { Modal } from '../common/Modal';
import { db } from '../../services/firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  Calendar,
  AlertOctagon,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ChevronRight,
  Eye,
  Megaphone,
  UserCheck,
  ExternalLink,
  AlertCircle,
  HeartHandshake,
} from 'lucide-react';

interface GuidanceDashboardProps {
  onNavigate: (module: SystemModule) => void;
  currentUser?: User;
}

export const GuidanceDashboard: React.FC<GuidanceDashboardProps> = ({ onNavigate, currentUser }) => {
  const [activeModal, setActiveModal] = useState<
    'REPORTS' | 'CONCERNS' | 'DISCIPLINARY' | 'STUDENTS' | null
  >(null);
  const [studentReports, setStudentReports] = useState<DisciplinaryReport[]>(() =>
    getDisciplinaryReports()
      .filter((r) => !r.isArchived)
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
  );
  const [appointments, setAppointments] = useState<Appointment[]>(() => getAppointments('GUIDANCE_ADMIN'));
  const [disciplinaryRecords, setDisciplinaryRecords] = useState<DisciplinaryRecord[]>(() =>
    getDisciplinaryRecords()
  );
  const [referredDisciplinary, setReferredDisciplinary] = useState<DisciplinaryRecord[]>(() =>
    getReferredDisciplinaryRecords()
  );
  const [students, setStudents] = useState(() => getUsers().filter((u) => u.role === 'STUDENT'));
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => getAnnouncements().filter((a) => !a.isArchived));

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  // Strict Conflict Modal State
  const [conflictModalData, setConflictModalData] = useState<{
    isOpen: boolean;
    candidateStudent: string;
    conflictStudent: string;
    conflictStudentId?: string;
    date: string;
    time: string;
    message: string;
  } | null>(null);

  const [unsyncedModules, setUnsyncedModules] = useState<string[]>([]);

  const refreshData = () => {
    setStudentReports(
      getDisciplinaryReports()
        .filter((r) => !r.isArchived)
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
    );
    setAppointments(getAppointments('GUIDANCE_ADMIN'));
    setDisciplinaryRecords(getDisciplinaryRecords());
    setReferredDisciplinary(getReferredDisciplinaryRecords());
    setStudents(getUsers().filter((u) => u.role === 'STUDENT'));
    setAnnouncements(getAnnouncements().filter((a) => !a.isArchived));
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000);
    window.addEventListener('osas_storage_updated', refreshData);
    window.addEventListener('storage', refreshData);

    const markSyncResult = (moduleLabel: string, ok: boolean) => {
      setUnsyncedModules((prev) => {
        if (ok) {
          return prev.filter((m) => m !== moduleLabel);
        }
        return prev.includes(moduleLabel) ? prev : [...prev, moduleLabel];
      });
    };

    const unsubReports = onSnapshot(
      collection(db, 'disciplinary_reports'),
      () => {
        markSyncResult('Student Reports', true);
        refreshData();
      },
      () => markSyncResult('Student Reports', false)
    );
    const unsubStoreReports = onSnapshot(
      doc(db, 'osas_store', 'osas_disciplinary_reports'),
      () => {
        markSyncResult('Student Reports', true);
        refreshData();
      },
      () => markSyncResult('Student Reports', false)
    );
    const unsubConcerns = onSnapshot(
      collection(db, 'appointments'),
      () => {
        markSyncResult('Student Concerns', true);
        refreshData();
      },
      () => markSyncResult('Student Concerns', false)
    );
    const unsubStoreConcerns = onSnapshot(
      doc(db, 'osas_store', 'osas_appointments'),
      () => {
        markSyncResult('Student Concerns', true);
        refreshData();
      },
      () => markSyncResult('Student Concerns', false)
    );
    const unsubInterventions = onSnapshot(
      collection(db, 'interventions'),
      () => {
        markSyncResult('Student Concerns', true);
        refreshData();
      },
      () => markSyncResult('Student Concerns', false)
    );

    return () => {
      clearInterval(interval);
      window.removeEventListener('osas_storage_updated', refreshData);
      window.removeEventListener('storage', refreshData);
      unsubReports();
      unsubStoreReports();
      unsubConcerns();
      unsubStoreConcerns();
      unsubInterventions();
    };
  }, []);

  // Metrics
  const pendingReports = studentReports.filter((r) => r.status === 'SUBMITTED');
  const resolvedReportsCount = studentReports.filter(
    (r) =>
      Boolean(
        r.status === 'RESOLVED' ||
          (r.resolvedAt && r.resolutionDetails && r.resolutionDetails.trim()) ||
          (r.resolutionDetails && r.resolutionDetails.trim())
      )
  );
  const pendingAppointments = appointments.filter((a) => a.status === 'PENDING');
  const approvedAppointments = appointments.filter(
    (a) => a.status === 'APPROVED' || a.status === 'DONE_ADMIN' || a.status === 'DONE_STUDENT'
  );
  const sanctionedDisciplinaryCount = disciplinaryRecords.filter(
    (r) => Boolean(r.sanction && r.sanction.trim()) || r.status === 'SANCTIONED'
  );

  const handleApproveAppointment = (app: Appointment) => {
    const conflict = checkAppointmentConflict(app.id);
    if (conflict.hasConflict) {
      setConflictModalData({
        isOpen: true,
        candidateStudent: app.studentName,
        conflictStudent: conflict.conflictingAppointment?.studentName || 'Existing Student',
        conflictStudentId: conflict.conflictingAppointment?.studentId || conflict.conflictingAppointment?.id,
        date: conflict.formattedConflictDate || app.preferredDate || app.date || '',
        time: conflict.formattedConflictTime || app.preferredTime || app.time || '',
        message:
          conflict.message ||
          'Mayroon nang kasalukuyang aprubadong appointment sa petsa at oras na ito. Bawal ang duplicate approval.',
      });
      return;
    }

    try {
      updateAppointmentStatus(app.id, 'APPROVED', `Approved by ${currentUser?.fullName || 'Guidance Counselor'}`);
      refreshData();
      setSelectedAppointment(null);
    } catch (err: any) {
      setConflictModalData({
        isOpen: true,
        candidateStudent: app.studentName,
        conflictStudent: 'Existing Approved Appointment',
        date: app.preferredDate || app.date || '',
        time: app.preferredTime || app.time || '',
        message: err.message || 'Hindi maaprubahan ang appointment dahil sa schedule conflict.',
      });
    }
  };

  const handleReschedule = (app: Appointment) => {
    if (!rescheduleDate || !rescheduleTime) return;
    updateAppointmentStatus(
      app.id,
      'RESCHEDULED',
      rescheduleDate,
      rescheduleTime,
      `Rescheduled by Guidance Office to ${rescheduleDate} at ${rescheduleTime}`
    );
    refreshData();
    setSelectedAppointment(null);
    setRescheduleDate('');
    setRescheduleTime('');
  };

  const handleModuleRedirect = (mod: SystemModule) => {
    setActiveModal(null);
    onNavigate(mod);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
              <HeartHandshake className="w-3.5 h-3.5 shrink-0" /> Guidance & Counseling Administration
            </div>
          </div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight">
            Welcome back, {currentUser?.fullName || 'Guidance Counselor'}
          </h1>
          <p className="text-xs sm:text-sm text-indigo-100/80 leading-relaxed">
            Manage student counseling appointments, psychosocial interventions, and student welfare cases from Dingalan Community College.
          </p>
        </div>
      </div>

      {/* SUMMARY STAT CARDS (CLICKABLE WITH POPUPS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Student Reports */}
        <div
          onClick={() => setActiveModal('REPORTS')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Student Reports
            </p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-blue-600 font-semibold transition-colors">
              <span>View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{studentReports.length}</span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-bold pb-1">
              {pendingReports.length} New / Pending
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-200 dark:border-blue-800">
              {resolvedReportsCount.length} Resolved
            </span>
          </div>
        </div>

        {/* Card 2: Student Concerns */}
        <div
          onClick={() => setActiveModal('CONCERNS')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Student Concerns
            </p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-indigo-600 font-semibold transition-colors">
              <span>View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{appointments.length}</span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold pb-1">
              {pendingAppointments.length} Pending
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 rounded text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
              {approvedAppointments.length} Confirmed
            </span>
          </div>
        </div>

        {/* Card 3: Disciplinary Records */}
        <div
          onClick={() => setActiveModal('DISCIPLINARY')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-rose-300 dark:hover:border-rose-700 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Disciplinary Records
            </p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-rose-600 font-semibold transition-colors">
              <span>View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{disciplinaryRecords.length}</span>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-bold pb-1">
              {sanctionedDisciplinaryCount.length} Sanctioned
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 rounded text-[10px] font-bold border border-rose-200 dark:border-rose-800">
              Official Case Registry
            </span>
          </div>
        </div>

        {/* Card 4: Student Records */}
        <div
          onClick={() => setActiveModal('STUDENTS')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Student Records
            </p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-amber-600 font-semibold transition-colors">
              <span>View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{students.length}</span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-bold pb-1">
              Active Enrolled
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 rounded text-[10px] font-bold border border-amber-200 dark:border-amber-800">
              DCC Master Roster
            </span>
          </div>
        </div>
      </div>

      {/* GUIDANCE ANNOUNCEMENTS SECTION (FULL WIDTH) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-indigo-600" /> Guidance Announcements
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Counseling notices, wellness bulletins, and guidance programs ({announcements.length} posted)
            </p>
          </div>
          <button
            onClick={() => onNavigate('announcements')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {announcements.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-80" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No announcements posted yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">Guidance announcements will appear here when published.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      {ann.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">{ann.title}</h4>
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(ann.createdAt).toLocaleDateString()}</span>
                </div>

                {ann.imageUrl && (
                  <img src={ann.imageUrl} alt={ann.title} className="w-full h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                )}

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-line">
                  {ann.content}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                  <span>Posted by: <strong className="text-slate-700 dark:text-slate-300">{ann.postedBy}</strong></span>
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                    ❤️ {(ann.heartReacts?.length || 0)} Likes / Interests
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* POP-UP MODAL 1: STUDENT REPORTS */}
      <Modal
        isOpen={activeModal === 'REPORTS'}
        onClose={() => setActiveModal(null)}
        title="Student Reports Overview"
        subtitle="Submitted student reports, records, and case status"
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {studentReports.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No student reports on record.</p>
            ) : (
              studentReports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {rep.reportedStudentName} {rep.reportedStudentId ? `(${rep.reportedStudentId})` : ''}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Type: {rep.incidentType} • Location: {rep.location} • Date: {rep.reportDate || new Date(rep.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        rep.status === 'RESOLVED' || rep.resolutionOutcome === 'RESOLVED'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : rep.referredToOsas
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {rep.resolutionOutcome || rep.status}
                    </span>
                  </div>
                  {rep.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      {rep.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => handleModuleRedirect('safety_reports')}
              className="py-2.5 px-5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              View Full Student Reports <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>

      {/* POP-UP MODAL 2: STUDENT CONCERNS */}
      <Modal
        isOpen={activeModal === 'CONCERNS'}
        onClose={() => setActiveModal(null)}
        title="Student Concerns Overview"
        subtitle="Recent student concerns, counseling bookings, and schedule status"
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {appointments.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No student concerns on record.</p>
            ) : (
              appointments.map((app) => (
                <div
                  key={app.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{app.studentName}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        ID: {app.studentId} • Schedule: {app.adminPreferredDate || app.preferredDate || app.date} ({app.adminPreferredTime || app.preferredTime || app.time})
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        app.status === 'APPROVED' || app.status === 'DONE_ADMIN' || app.status === 'DONE_STUDENT'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                          : app.status === 'COMPLETED'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : app.status === 'REJECTED'
                          ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                  {(app.description || app.reason) && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      {app.description || app.reason}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => handleModuleRedirect('student_grievances')}
              className="py-2.5 px-5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              View Full Student Concerns <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>

      {/* POP-UP MODAL 3: DISCIPLINARY RECORDS */}
      <Modal
        isOpen={activeModal === 'DISCIPLINARY'}
        onClose={() => setActiveModal(null)}
        title="Disciplinary Records Overview"
        subtitle="Official student disciplinary cases, offenses, and sanction status"
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {disciplinaryRecords.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No disciplinary records on file.</p>
            ) : (
              disciplinaryRecords.map((rec) => {
                const hasSanction = Boolean(rec.sanction && rec.sanction.trim());
                return (
                  <div
                    key={rec.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {rec.studentName} {rec.studentId ? `(${rec.studentId})` : ''}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Offense: {rec.offenseType || 'Disciplinary Case'} • Date: {rec.reportDate || rec.dateLogged}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          rec.status === 'COMPLETED'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : hasSanction || rec.status === 'SANCTIONED'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {rec.status || (hasSanction ? 'SANCTIONED' : 'RECORDED')}
                      </span>
                    </div>
                    {rec.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        {rec.description}
                      </p>
                    )}
                    {hasSanction && (
                      <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                        Sanction: {rec.sanction}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => handleModuleRedirect('disciplinary')}
              className="py-2.5 px-5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              View Full Disciplinary Records <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>

      {/* POP-UP MODAL 4: STUDENT RECORDS */}
      <Modal
        isOpen={activeModal === 'STUDENTS'}
        onClose={() => setActiveModal(null)}
        title="Student Records"
        subtitle="Active enrolled students and profile master records"
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {students.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No enrolled student records found.</p>
            ) : (
              students.map((stud) => (
                <div
                  key={stud.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={stud.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${stud.fullName}`}
                      alt={stud.fullName}
                      className="w-8 h-8 rounded-full border border-slate-200"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {stud.fullName}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {stud.studentId} • {stud.yearLevel} • {stud.course}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Active
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => handleModuleRedirect('student_records')}
              className="py-2.5 px-5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              View Full Student Records <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>

      {/* STRICT APPOINTMENT SCHEDULE CONFLICT MODAL */}
      {conflictModalData?.isOpen && (
        <Modal
          isOpen={true}
          onClose={() => setConflictModalData(null)}
          title="Schedule Conflict Detected"
          subtitle="Strict Guidance Counseling Conflict Rule Enforced"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-900 dark:text-red-200">
                  Hindi Maaaring I-approve ang Counseling Appointment
                </h4>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  {conflictModalData.message}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Petsa at Oras:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {conflictModalData.date} ({conflictModalData.time})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Kasalukuyang Naka-schedule:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {conflictModalData.conflictStudent} {conflictModalData.conflictStudentId ? `(${conflictModalData.conflictStudentId})` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Bagong Aplikante:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {conflictModalData.candidateStudent}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              Paunawa: Bawal i-approve ang dalawang appointment na parehong date at oras hangga't hindi pa completed ang nauna. Gamitin ang Reschedule upang magtakda ng ibang petsa o oras.
            </p>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setConflictModalData(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Naiintindihan (Isara)
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reschedule Modal */}
      {selectedAppointment && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAppointment(null)}
          title="Reschedule Appointment"
          subtitle={`Student: ${selectedAppointment.studentName} (${selectedAppointment.studentId})`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-200 dark:border-blue-900/60">
              <span className="font-bold text-blue-900 dark:text-blue-300 block mb-1">Current Appointment Time:</span>
              <p className="text-blue-800 dark:text-blue-200 font-semibold">
                {selectedAppointment.preferredDate || selectedAppointment.date} at {selectedAppointment.preferredTime || selectedAppointment.time}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">New Date *</label>
              <input
                type="date"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">New Time *</label>
              <input
                type="time"
                required
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="px-3 py-2 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rescheduleDate || !rescheduleTime}
                onClick={() => handleReschedule(selectedAppointment)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
