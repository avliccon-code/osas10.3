import React, { useState, useEffect, useMemo } from 'react';
import {
  getAppointments,
  createAppointment,
  getUsers,
  updateAppointmentByAdmin,
  markAppointmentDoneByAdmin,
  reApproveAppointment,
  archiveAppointment,
  checkAppointmentConflict,
  referAppointmentToGuidance,
  updateGuidanceAppointmentStatus,
} from '../../services/storage';
import { Appointment, User, UserRole, AppointmentStatus } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { CollegeLogo } from '../common/CollegeLogo';
import {
  Calendar,
  Clock,
  Check,
  X,
  RefreshCw,
  Eye,
  CheckCircle2,
  User as UserIcon,
  Printer,
  RotateCcw,
  AlertTriangle,
  Send,
  Search,
  Archive,
  HeartHandshake,
  AlertCircle,
  Plus,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface StudentGrievancesModuleProps {
  role?: UserRole;
  currentUser?: User;
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

export const StudentGrievancesModule: React.FC<StudentGrievancesModuleProps> = ({ role = 'ADMIN', currentUser }) => {
  const [appointments, setAppointments] = useState<Appointment[]>(() => getAppointments(role));
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [printApp, setPrintApp] = useState<Appointment | null>(null);
  const [confirmArchiveApp, setConfirmArchiveApp] = useState<Appointment | null>(null);

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

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('02:00 PM');
  const [adminNotes, setAdminNotes] = useState('');
  const [guidanceFollowUpNotes, setGuidanceFollowUpNotes] = useState('');

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<'records' | 'form'>('records');

  // Form State (Student Grievance Form)
  const [students, setStudents] = useState<User[]>([]);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [selectedStudentUser, setSelectedStudentUser] = useState<User | null>(null);
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [description, setDescription] = useState('');
  const [actionTaken, setActionTaken] = useState('Verbal Warning Issued');
  const [preferredDate, setPreferredDate] = useState(() => {
    const d = new Date(Date.now() + 86400000 * 3);
    return d.toISOString().split('T')[0];
  });
  const [preferredTime, setPreferredTime] = useState('10:00 AM');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const allUsers = getUsers();
      setStudents(allUsers.filter((u) => u.role === 'STUDENT'));
    } catch {
      setStudents([]);
    }
  }, []);

  const studentSuggestions = useMemo(() => {
    if (!studentSearchInput.trim()) return [];
    const q = studentSearchInput.toLowerCase().trim();
    return students
      .filter(
        (s) =>
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          s.fullName.toLowerCase().includes(q) ||
          (s.course && s.course.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [students, studentSearchInput]);

  const handleAdminCreateGrievance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentUser) {
      setFormError('Mangyaring pumili ng estudyante para sa grievance record na ito.');
      return;
    }
    if (!description.trim()) {
      setFormError('Mangyaring ilagay ang detalye o concern ng student grievance.');
      return;
    }
    if (!privacyConsent) {
      setFormError('Mangyaring basahin at lagyan ng tsek ang Data Privacy Consent bago magsumite.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      const submitDate = role === 'GUIDANCE_ADMIN' ? new Date().toISOString().split('T')[0] : preferredDate;
      const submitTime = role === 'GUIDANCE_ADMIN' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : preferredTime;

      createAppointment(selectedStudentUser, description.trim(), submitDate, submitTime, {
        actionTaken: actionTaken.trim() || 'Verbal Warning Issued',
        completeAddress: selectedStudentUser.address || selectedStudentUser.permanentAddress || 'N/A',
        academicProgram: selectedStudentUser.section || selectedStudentUser.course || 'N/A',
        course: selectedStudentUser.course || 'N/A',
        yearLevel: selectedStudentUser.yearLevel || '1st Year',
        contactNumber: selectedStudentUser.contactNumber || 'N/A',
        isGuidanceWalkIn: role === 'GUIDANCE_ADMIN',
        office: role === 'GUIDANCE_ADMIN' ? 'GUIDANCE_WALK_IN' : undefined,
      });
      setFormSuccessMessage(`Matagumpay na naitala ang student grievance para kay ${selectedStudentUser.fullName}!`);
      setDescription('');
      setActionTaken('Verbal Warning Issued');
      setSelectedStudentUser(null);
      setStudentSearchInput('');
      setPrivacyConsent(false);
      refreshList();
      setTimeout(() => setFormSuccessMessage(''), 6000);
    } catch (err: any) {
      setFormError(err?.message || 'Nagkaroon ng problema sa pag-save ng student grievance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRemainingExpirationText = (completedAt?: string) => {
    if (!completedAt) return '1 week expiration';
    const completedTime = new Date(completedAt).getTime();
    if (isNaN(completedTime)) return '1 week expiration';
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const msLeft = completedTime + oneWeek - Date.now();
    if (msLeft <= 0) return 'Expiring to Vault now';
    const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000));
    const hoursLeft = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (daysLeft > 0) {
      return `Expires in ${daysLeft}d ${hoursLeft}h (➔ Archive Vault)`;
    }
    return `Expires in ${hoursLeft}h (➔ Archive Vault)`;
  };

  const refreshList = () => {
    const fresh = getAppointments(role);
    setAppointments(fresh);
    setSelectedApp((prev) => {
      if (!prev) return null;
      const freshSelected = fresh.find((a) => a.id === prev.id);
      return freshSelected || prev;
    });
  };

  useEffect(() => {
    refreshList();
    const interval = setInterval(refreshList, 1000);
    window.addEventListener('osas_storage_updated', refreshList);
    window.addEventListener('storage', refreshList);
    return () => {
      clearInterval(interval);
      window.removeEventListener('osas_storage_updated', refreshList);
      window.removeEventListener('storage', refreshList);
    };
  }, [role]);

  const handlePrint = () => {
    window.print();
  };

  const handleApprove = (id: string) => {
    // 1. Strict Conflict Check before approval
    const conflict = checkAppointmentConflict(id);
    if (conflict.hasConflict) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: conflict.conflictingAppointment?.studentName || 'Ibang Estudyante',
        conflictStudentId: conflict.conflictingAppointment?.studentId || conflict.conflictingAppointment?.id,
        date: conflict.formattedConflictDate || target?.preferredDate || '',
        time: conflict.formattedConflictTime || target?.preferredTime || '',
        message:
          conflict.message ||
          `Mayroon nang aprubadong appointment sa parehong petsa at oras. Bawal ang duplicate approval.`,
      });
      return;
    }

    try {
      const actorName = currentUser?.fullName || (role === 'GUIDANCE_ADMIN' ? 'Maria Mel B. Glemao' : 'Princess Ann T. Ruzol');
      const note = role === 'GUIDANCE_ADMIN' ? 'Approved by Guidance Admin' : 'Approved by OSAS Admin';
      updateAppointmentByAdmin(id, 'APPROVED', undefined, undefined, note, actorName);
      const fresh = getAppointments(role);
      setAppointments(fresh);
      const updated = fresh.find((a) => a.id === id);
      if (updated) setSelectedApp(updated);
    } catch (err: any) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: 'Existing Approved Appointment',
        date: target?.preferredDate || '',
        time: target?.preferredTime || '',
        message: err.message || 'Hindi maaprubahan ang appointment dahil sa schedule conflict.',
      });
    }
  };



  const handleReApprove = (id: string) => {
    // Strict Conflict Check on re-approval
    const conflict = checkAppointmentConflict(id);
    if (conflict.hasConflict) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: conflict.conflictingAppointment?.studentName || 'Ibang Estudyante',
        conflictStudentId: conflict.conflictingAppointment?.studentId || conflict.conflictingAppointment?.id,
        date: conflict.formattedConflictDate || target?.preferredDate || '',
        time: conflict.formattedConflictTime || target?.preferredTime || '',
        message:
          conflict.message ||
          `Mayroon nang aprubadong appointment sa parehong petsa at oras. Bawal ang duplicate approval.`,
      });
      return;
    }

    try {
      const actorName = currentUser?.fullName || (role === 'GUIDANCE_ADMIN' ? 'Maria Mel B. Glemao' : 'Princess Ann T. Ruzol');
      reApproveAppointment(id, actorName);
      const fresh = getAppointments(role);
      setAppointments(fresh);
      const updated = fresh.find((a) => a.id === id);
      if (updated) setSelectedApp(updated);
    } catch (err: any) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: 'Existing Approved Appointment',
        date: target?.preferredDate || '',
        time: target?.preferredTime || '',
        message: err.message || 'Hindi maaprubahan ang appointment dahil sa schedule conflict.',
      });
    }
  };

  const handleConfirmArchive = () => {
    if (!confirmArchiveApp) return;
    const actorName = currentUser?.fullName || (role === 'GUIDANCE_ADMIN' ? 'Maria Mel B. Glemao' : 'Princess Ann T. Ruzol');
    archiveAppointment(confirmArchiveApp.id, actorName);
    const fresh = getAppointments(role);
    setAppointments(fresh);
    setConfirmArchiveApp(null);
    setSelectedApp(null);
  };

  const handleRescheduleSubmit = (id: string) => {
    if (role === 'ADMIN' && (selectedApp?.status === 'REFERRED_TO_GUIDANCE' || selectedApp?.referredToGuidance)) {
      alert('This appointment has been referred to the Guidance Admin. Only the Guidance Admin is authorized to reschedule it.');
      return;
    }

    if (!rescheduleDate) {
      alert('Please select a preferred date for rescheduling.');
      return;
    }

    // Check conflict against the new reschedule date/time
    const conflict = checkAppointmentConflict(id, rescheduleDate, rescheduleTime);
    if (conflict.hasConflict) {
      const target = appointments.find((a) => a.id === id);
      setConflictModalData({
        isOpen: true,
        candidateStudent: target?.studentName || 'Student',
        conflictStudent: conflict.conflictingAppointment?.studentName || 'Ibang Estudyante',
        conflictStudentId: conflict.conflictingAppointment?.studentId || conflict.conflictingAppointment?.id,
        date: rescheduleDate,
        time: rescheduleTime,
        message: `Hindi maaaring ilipat sa ${rescheduleDate} nang ${rescheduleTime} dahil mayroon nang kasalukuyang aprubadong appointment si ${conflict.conflictingAppointment?.studentName}. Mangyaring pumili ng ibang bakanteng petsa o oras.`,
      });
      return;
    }

    const actorName = currentUser?.fullName || (role === 'GUIDANCE_ADMIN' ? 'Maria Mel B. Glemao' : 'Princess Ann T. Ruzol');
    const actorRole = role === 'GUIDANCE_ADMIN' ? 'GUIDANCE_ADMIN' : 'ADMIN';
    updateAppointmentByAdmin(
      id,
      'RESCHEDULED',
      rescheduleDate,
      rescheduleTime,
      adminNotes || (role === 'GUIDANCE_ADMIN' ? 'Rescheduled by Guidance Admin.' : 'Rescheduled by OSAS Admin due to conflict/session availability.'),
      actorName,
      actorRole
    );
    const fresh = getAppointments(role);
    setAppointments(fresh);
    const updated = fresh.find((a) => a.id === id);
    if (updated) setSelectedApp(updated);
  };

  const handleMarkDone = (id: string) => {
    const actorName = currentUser?.fullName || (role === 'GUIDANCE_ADMIN' ? 'Maria Mel B. Glemao' : 'Princess Ann T. Ruzol');
    markAppointmentDoneByAdmin(id, actorName);
    const fresh = getAppointments(role);
    setAppointments(fresh);
    const updated = fresh.find((a) => a.id === id);
    if (updated) setSelectedApp(updated);
  };

  const filteredAppointments = appointments.filter((a) => {
    const matchesSearch =
      (a.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.studentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.studentEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'REFERRED' || statusFilter === 'REFERRED_TO_GUIDANCE'
        ? a.status === 'REFERRED' || a.status === 'REFERRED_TO_GUIDANCE' || Boolean(a.referredToGuidance || a.referredFromOsas || a.isReferredFromOsas)
        : a.status === statusFilter);
    return matchesSearch && matchesStatus;
  });


  return (
    <div className="space-y-6">
      {/* Background content (hidden during print when print preview modal is open) */}
      <div className={`space-y-6 ${printApp ? 'print:hidden' : ''}`}>
        {/* Header Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-2xl text-blue-600 dark:text-blue-400">
                <Calendar className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {role === 'GUIDANCE_ADMIN' ? 'Referred Student Grievances' : 'Student Grievances Module'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {role === 'GUIDANCE_ADMIN'
                    ? 'Review, approve, or reject student grievances referred from OSAS'
                    : 'Manage student grievances, consultation sessions, hearing schedules, and grievance filing.'}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation: Student Grievances Records & Student Grievance Form */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'records'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Student Grievances Records</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  activeTab === 'records' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {appointments.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'form'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>{role === 'GUIDANCE_ADMIN' ? 'Student Grievance Form – Walk-In' : 'Student Grievance Form'}</span>
            </button>
          </div>
        </div>

        {/* TAB 1: STUDENT GRIEVANCES RECORDS */}
        {activeTab === 'records' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-2xl">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {role === 'GUIDANCE_ADMIN' ? 'Referred Student Grievances' : 'Student Grievances Records'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {role === 'GUIDANCE_ADMIN'
                    ? 'Review, approve, or reject student grievances referred from OSAS'
                    : 'Manage student grievances, consultation sessions, and scheduling approvals'}
                </p>
              </div>
            </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search grievance..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="RESCHEDULED">Rescheduled</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        {/* Student Grievance Records Cards */}
        <div className="grid grid-cols-1 gap-4 mt-4">
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-10 text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              No student grievance records found matching filters.
            </div>
          ) : (
            filteredAppointments.map((a) => {
              const isCompleted = a.status === 'COMPLETED';
              const isRejected = a.status === 'REJECTED';
              const isReferred = a.status === 'REFERRED' || a.status === 'REFERRED_TO_GUIDANCE' || a.referredToGuidance || a.referredFromOsas;

              return (
                <div
                  key={a.id}
                  className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-2xs"
                >
                  {/* Left: Student Details & Concern */}
                  <div className="space-y-2 flex-1">
                    <div>
                      <span className="font-black text-slate-900 dark:text-white text-sm block">{a.studentName}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {a.studentId} • {a.studentEmail}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase block mb-0.5">Concern / Purpose</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{a.description}</p>
                    </div>
                  </div>

                  {/* Right: Status & Action */}
                  <div className="flex flex-row items-center gap-4 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Status:</span>
                      <span
                        className={`px-2.5 py-1 text-[10px] font-black rounded-full border inline-block ${
                          isCompleted
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                            : isRejected
                            ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300'
                            : a.status === 'APPROVED'
                            ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300'
                            : a.status === 'RESCHEDULED'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300'
                            : isReferred
                            ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
                        }`}
                      >
                        {a.status === 'REFERRED' || a.status === 'REFERRED_TO_GUIDANCE' ? 'Referred' : a.status}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedApp(a);
                        setRescheduleDate(a.adminPreferredDate || a.preferredDate);
                        setRescheduleTime(a.adminPreferredTime || a.preferredTime);
                        setAdminNotes(a.adminNotes || '');
                        setGuidanceFollowUpNotes(a.guidanceFollowUpNotes || a.adminNotes || '');
                      }}
                      className="px-4 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold rounded-xl border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer text-xs shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* TAB 2: STUDENT GRIEVANCE FORM */}
      {activeTab === 'form' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-2xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Student Grievance Form
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                File an official student grievance or schedule a consultation session with OSAS Admin & Guidance Counselors
              </p>
            </div>
          </div>

          {formSuccessMessage && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{formSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('records')}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                View in Records
              </button>
            </div>
          )}

          {formError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleAdminCreateGrievance} className="space-y-6">
            {/* Student Information Section (Matching OSAS Intervention Form) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-blue-600" /> Student Information & Profile
              </h4>

              {!selectedStudentUser ? (
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Search Student by ID or Name *
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Type student name or ID (e.g., Juan Dela Cruz, 2024-0101)..."
                      value={studentSearchInput}
                      onChange={(e) => {
                        setStudentSearchInput(e.target.value);
                        setShowStudentSuggestions(true);
                        setFormError(null);
                      }}
                      onFocus={() => setShowStudentSuggestions(true)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />

                    {showStudentSuggestions && studentSuggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {studentSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudentUser(s);
                              setStudentSearchInput(`${s.fullName} (${s.studentId || 'No ID'})`);
                              setShowStudentSuggestions(false);
                              setFormError(null);
                            }}
                            className="w-full p-3 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs shrink-0">
                                {s.fullName.charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                  {s.fullName}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  {s.studentId || 'No ID'} • {s.course || 'No Course'} • {s.yearLevel || ''}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                              Select
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                        {selectedStudentUser.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">
                          {selectedStudentUser.fullName}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                          Student Number: {selectedStudentUser.studentId || 'N/A'} • Course: {selectedStudentUser.course || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentUser(null);
                        setStudentSearchInput('');
                      }}
                      className="w-7 h-7 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full flex items-center justify-center text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                      title="Clear Student Selection"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Detailed Student Info Grid: Student Number, Full Name, Course, Academic Program, Year Level, Contact Number, Complete Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Student Number</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedStudentUser.studentId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Full Name</span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedStudentUser.fullName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Course</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentUser.course || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Academic Program</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentUser.section || selectedStudentUser.course || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Year Level</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentUser.yearLevel || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Number</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedStudentUser.contactNumber || 'N/A'}</span>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Complete Address</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedStudentUser.address || selectedStudentUser.permanentAddress || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 1. Reason / Concern / Purpose */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason / Concern / Purpose *
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the reason, concern, or purpose of the student grievance..."
                className="w-full p-3.5 text-xs border border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Action Taken & Date & Time */}
            {role === 'GUIDANCE_ADMIN' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Action Taken (Verbal / Written & Others) *
                  </label>
                  <input
                    type="text"
                    list="action-taken-options"
                    required
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    placeholder="Select or type action taken..."
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                  <datalist id="action-taken-options">
                    <option value="Verbal Warning Issued" />
                    <option value="Written Warning Issued" />
                    <option value="Guidance Counseling Session Conducted" />
                    <option value="Parent / Guardian Conference Conducted" />
                    <option value="Others" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Date & Time (Automatic System Time)
                  </label>
                  <div className="px-3.5 py-2.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono font-bold flex items-center justify-between h-[38px]">
                    <span>{new Date().toLocaleDateString()}</span>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Action Taken (Verbal / Written & Others) *
                  </label>
                  <input
                    type="text"
                    list="action-taken-options"
                    required
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    placeholder="Select or type action taken (Verbal/Written & Others)..."
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                  <datalist id="action-taken-options">
                    <option value="Verbal Warning Issued" />
                    <option value="Written Warning Issued" />
                    <option value="Guidance Counseling Session Conducted" />
                    <option value="Parent / Guardian Conference Conducted" />
                    <option value="Others" />
                  </datalist>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={formatTime24h(preferredTime)}
                      onChange={(e) => setPreferredTime(formatTime12h(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono cursor-pointer"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 4. Confidentiality & Privacy Note + Checkbox */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Confidentiality & Privacy Notice (RA 10173)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Student grievance details and stated concerns are treated with utmost confidentiality by the OSAS and Guidance Counseling office. Personal records are processed strictly in accordance with Republic Act No. 10173 and Guidance Counselor professional ethics.
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
                  I confirm consent to process this student grievance and consultation record with strict confidentiality pursuant to RA 10173. *
                </span>
              </label>
            </div>

            {/* 5. Submit Student Grievance Button */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={!privacyConsent || !selectedStudentUser || !description.trim() || isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-blue-500/20"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Adding...' : 'Add Student Grievance'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW DETAILED APPOINTMENT MODAL */}
      {selectedApp && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedApp(null)}
          title={`Appointment Review - ${selectedApp.studentName}`}
          subtitle={`Appointment ID: #${selectedApp.id}`}
          maxWidth="lg"
        >
          <div className="space-y-4 p-2 text-xs">
            {/* Header Action Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Consultation Case Review</span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Student Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedApp.studentId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Full Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedApp.studentName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Course / Academic Program</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedApp.course || selectedApp.academicProgram || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Year Level</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedApp.yearLevel || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Number</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedApp.contactNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {selectedApp.status === 'REFERRED' || selectedApp.status === 'REFERRED_TO_GUIDANCE' ? 'Referred' : selectedApp.status}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Complete Address</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedApp.completeAddress || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                  Reason / Concern / Purpose
                </span>
                <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 leading-relaxed">
                  {selectedApp.description}
                </p>
              </div>

              {selectedApp.actionTaken && (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                    Action Taken
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 font-semibold">
                    {selectedApp.actionTaken}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40">
                  <span className="font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider block text-[10px]">
                    Submitted Date & Time
                  </span>
                  <p className="font-mono text-blue-700 dark:text-blue-300 font-bold mt-0.5">
                    {selectedApp.preferredDate} @ {selectedApp.preferredTime}
                  </p>
                </div>
              </div>
            </div>

            {/* Referred from OSAS Banner inside Modal */}
            {(selectedApp.status === 'REFERRED' || selectedApp.status === 'REFERRED_TO_GUIDANCE' || selectedApp.referredToGuidance || selectedApp.referredFromOsas) && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-black text-indigo-900 dark:text-indigo-300 block text-[11px]">
                    Referred from OSAS
                  </span>
                  {selectedApp.guidanceReferralDate && (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                      • {new Date(selectedApp.guidanceReferralDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider block mb-1">
                    Reason for Referral
                  </span>
                  <p className="text-indigo-900 dark:text-indigo-200 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900 text-xs font-semibold">
                    {selectedApp.reason || selectedApp.guidanceReferralNotes || 'Referred from OSAS'}
                  </p>
                </div>
                {role === 'ADMIN' && (
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium pt-0.5">
                    ℹ️ Ang appointment na ito ay nasa ilalim na ng Guidance Admin para sa kanilang counseling review at aksyon (Approve / Reject).
                  </p>
                )}
              </div>
            )}

            {/* Live Conflict Warning Banner inside Modal */}
            {selectedApp.status !== 'APPROVED' && selectedApp.status !== 'COMPLETED' && (() => {
              const conflict = checkAppointmentConflict(selectedApp.id);
              if (!conflict.hasConflict || !conflict.conflictingAppointment) return null;
              return (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex items-start gap-3 text-rose-900 dark:text-rose-200">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <strong className="block font-black text-rose-900 dark:text-rose-200 text-xs sm:text-sm">
                      ⚠️ Schedule Conflict: Duplicate Approval Blocked
                    </strong>
                    <p className="leading-relaxed">
                      Mayroon nang kasalukuyang <strong>APPROVED</strong> na appointment sa parehong petsa at oras:
                    </p>
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900 font-mono text-[11px] text-rose-950 dark:text-rose-200 space-y-0.5">
                      <div><strong>Schedule:</strong> {conflict.formattedConflictDate} @ {conflict.formattedConflictTime}</div>
                      <div><strong>Naka-aprubang Estudyante:</strong> {conflict.conflictingAppointment.studentName} ({conflict.conflictingAppointment.studentId || '#' + conflict.conflictingAppointment.id})</div>
                    </div>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 font-bold">
                      Hindi maaaring aprubahan ito habang may conflict. Mangyaring gamitin ang Reschedule sa ibaba upang magtakda ng bagong libreng oras.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Reschedule Notes / Admin Notes (Omitted for Guidance Admin) */}
            {role !== 'GUIDANCE_ADMIN' && (selectedApp.adminNotes || selectedApp.rescheduleReason) && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-1">
                <span className="font-black text-purple-900 dark:text-purple-300 block text-[11px]">
                  Reschedule Reason & Admin Notes:
                </span>
                <p className="text-purple-800 dark:text-purple-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900 text-xs">
                  {selectedApp.adminNotes || selectedApp.rescheduleReason}
                </p>
              </div>
            )}

            {/* Follow-Up Notes (Shown for Guidance Admin and kept even if Completed if it has content) */}
            {role === 'GUIDANCE_ADMIN' && selectedApp.guidanceFollowUpNotes && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-1">
                <span className="font-black text-emerald-900 dark:text-emerald-200 block text-[11px]">
                  Follow-Up Notes:
                </span>
                <p className="text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 text-xs">
                  {selectedApp.guidanceFollowUpNotes}
                </p>
              </div>
            )}

            {/* Additional Notes Field for Guidance Admin / Reschedule Section for OSAS Admin */}
            {role === 'GUIDANCE_ADMIN' ? (
              selectedApp.status !== 'COMPLETED' && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" /> Additional Notes / Guidance Follow-Up Notes
                  </label>
                  <textarea
                    rows={3}
                    value={guidanceFollowUpNotes}
                    onChange={(e) => setGuidanceFollowUpNotes(e.target.value)}
                    placeholder="Enter guidance counseling notes or additional remarks..."
                    className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )
            ) : (
              selectedApp.status !== 'COMPLETED' && (() => {
                const isReferredToGuidance = selectedApp.status === 'REFERRED_TO_GUIDANCE' || !!selectedApp.referredToGuidance;
                const isRescheduleDisabled = role === 'ADMIN' && isReferredToGuidance;

                return (
                  <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-900 dark:text-purple-300 block flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        Reschedule Appointment (Set Date & Time)
                      </span>
                    </div>

                    {isRescheduleDisabled && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Appointment referred to Guidance Counselor. Only the Guidance Admin is authorized to reschedule this appointment.</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-purple-800 dark:text-purple-300">Set Date</label>
                        <input
                          type="date"
                          disabled={isRescheduleDisabled}
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className={`w-full px-3 py-2 text-xs border border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                            isRescheduleDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-purple-800 dark:text-purple-300">Set Time</label>
                        <input
                          type="time"
                          disabled={isRescheduleDisabled}
                          value={formatTime24h(rescheduleTime)}
                          onChange={(e) => setRescheduleTime(formatTime12h(e.target.value))}
                          className={`w-full px-3 py-2 text-xs border border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono ${
                            isRescheduleDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      disabled={isRescheduleDisabled}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder={
                        isRescheduleDisabled
                          ? 'Rescheduling locked: Handled exclusively by Guidance Admin'
                          : 'Optional admin note / reason for reschedule...'
                      }
                      className={`w-full px-3 py-1.5 text-xs border border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                        isRescheduleDisabled ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                );
              })()
            )}

            {selectedApp.status === 'COMPLETED' && (
              <div className="space-y-2">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Appointment Fully Completed & Verified
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mt-0.5">
                      Completed: {selectedApp.completedAt ? new Date(selectedApp.completedAt).toLocaleString() : 'Recently'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-amber-900 dark:text-amber-200">
                    <span className="font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      1-Week Expiration Policy: {getRemainingExpirationText(selectedApp.completedAt)}
                    </span>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      Completed appointments automatically expire after 1 week and move to <strong>System Settings &gt; System Archive Vault</strong>.
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmArchiveApp(selectedApp)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0 w-fit"
                  >
                    <Archive className="w-3.5 h-3.5" /> Move to Vault Now
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons Footer based on Status Rules */}
            {role === 'GUIDANCE_ADMIN' ? (
              selectedApp.status === 'COMPLETED' ? null : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      updateGuidanceAppointmentStatus(
                        selectedApp.id,
                        'COMPLETED',
                        guidanceFollowUpNotes,
                        currentUser?.fullName || 'Guidance Counselor'
                      );
                      refreshList();
                      setSelectedApp(null);
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Complete
                  </button>
                </div>
              )
            ) : (
              selectedApp.status === 'COMPLETED' ? null : selectedApp.status === 'REFERRED_TO_GUIDANCE' || selectedApp.referredToGuidance ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={true}
                    className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-slate-300 dark:bg-slate-700 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 opacity-60"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reschedule (Disabled)
                  </button>
                  <button
                    type="button"
                    disabled={true}
                    className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-slate-300 dark:bg-slate-700 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 opacity-60"
                  >
                    <Check className="w-4 h-4" />
                    Approve (Disabled)
                  </button>
                </div>
              ) : selectedApp.status === 'APPROVED' ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedApp.id)}
                    className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRescheduleSubmit(selectedApp.id)}
                    className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkDone(selectedApp.id)}
                    className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Done
                  </button>
                </div>
              ) : (
                /* Pending or Rescheduled */
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleRescheduleSubmit(selectedApp.id)}
                    className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedApp.id)}
                    className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                </div>
              )
            )}
          </div>
        </Modal>
      )}



      {/* CONFIRMATION MODAL FOR ARCHIVING REJECTED APPOINTMENT */}
      {confirmArchiveApp && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmArchiveApp(null)}
          onConfirm={handleConfirmArchive}
          title="Are you sure you want to delete this?"
          message={`Are you sure you want to delete/archive the rejected appointment record for "${confirmArchiveApp.studentName}" (${confirmArchiveApp.studentId})? It will be moved to System Settings > System Archive.`}
          confirmText="Yes"
          cancelText="No"
          type="danger"
          icon="trash"
        />
      )}
      </div>

      {/* Official Appointment Print Slip Preview Modal */}
      {printApp && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0">
          <div className="bg-white text-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl p-6 sm:p-8 space-y-4 print:shadow-none print:rounded-none print:max-w-none print:p-0">
            {/* Printable Header Bar (Hidden in Print) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Official Guidance &amp; Consultation Appointment Slip
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Final Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintApp(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div id="printable-appointment-slip" className="printable-document flex flex-col justify-between min-h-[95vh] sm:min-h-[1020px] print:min-h-screen print:h-full p-4 sm:p-6 bg-white text-slate-900 rounded-xl border border-slate-200 print:border-none print:p-0">
              <div className="space-y-4 shrink-0">
                {/* Institutional Header */}
                <div className="text-center pb-3 border-b-2 border-slate-900 space-y-1">
                  <div className="flex items-center justify-center gap-3 mb-1.5">
                    <CollegeLogo className="w-12 h-12" />
                    <div>
                      <h2 className="text-base font-black tracking-wide uppercase text-slate-900 leading-tight">
                        Dingalan Community College
                      </h2>
                      <p className="text-xs font-bold text-slate-700">Office of Student Affairs and Services (OSAS)</p>
                      <p className="text-[11px] text-slate-500 font-medium">Guidance, Counseling &amp; Student Welfare Unit</p>
                    </div>
                  </div>
                  <div className="inline-block bg-slate-100 border border-slate-300 px-3 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Official Guidance &amp; Consultation Appointment Slip
                  </div>
                </div>

                {/* Slip Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Appointment ID</span>
                    <span className="font-mono font-bold text-slate-900">#{printApp.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Date Filed</span>
                    <span className="font-semibold text-slate-800">{new Date(printApp.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Case Status</span>
                    <span className="font-bold text-slate-800 uppercase">{printApp.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year</span>
                    <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
                  </div>
                </div>
              </div>

              {/* Main Content Body */}
              <div className="printable-body flex-1 space-y-3 my-3">
                {/* Student Information */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    1. Student Client Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Student Full Name</span>
                      <span className="font-bold text-slate-900">{printApp.studentName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Student ID Number</span>
                      <span className="font-mono font-bold text-slate-900">{printApp.studentId}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Email Address</span>
                      <span className="font-medium text-slate-800">{printApp.studentEmail || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Consultation Schedule Information */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-2 bg-blue-50/20">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    2. Appointment Schedule Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Confirmed Date</span>
                      <span className="font-bold text-slate-900">{printApp.adminPreferredDate || printApp.preferredDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Confirmed Time Slot</span>
                      <span className="font-bold text-slate-900">{printApp.adminPreferredTime || printApp.preferredTime}</span>
                    </div>
                  </div>
                </div>

                {/* Purpose / Concern */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    3. Purpose of Appointment &amp; Consultation Concern
                  </h4>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-200">
                    {printApp.description}
                  </p>
                </div>

                {/* Admin / Counselor Notes */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    4. Guidance Counselor Findings &amp; Action Remarks
                  </h4>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-200">
                    {printApp.adminNotes || 'Scheduled for in-person consultation session at the OSAS Guidance Office.'}
                  </p>
                </div>

                {/* Completion & Verification Details */}
                <div className="border border-slate-300 rounded-lg p-2.5 bg-slate-50/50 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span><strong>OSAS Authority Status:</strong> {printApp.status === 'COMPLETED' ? 'Session Completed' : printApp.status}</span>
                    {printApp.completedAt && (
                      <span><strong>Completion Date:</strong> {new Date(printApp.completedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Signatures & Footer Block */}
              <div className="printable-footer-block mt-auto shrink-0 pt-6 space-y-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <div className="grid grid-cols-3 gap-6 text-center text-xs items-end">
                  <div className="flex flex-col items-center justify-end text-center">
                    <div className="w-full border-b border-slate-800 pb-8 mb-1" />
                    <p className="font-bold text-slate-900 leading-tight">{printApp.studentName}</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Student Conforme</p>
                  </div>
                  <div className="flex flex-col items-center justify-end text-center">
                    <div className="w-full border-b border-slate-800 pb-8 mb-1" />
                    <p className="font-bold text-slate-900 leading-tight">Guidance Counselor / Admin</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Attending Guidance Personnel</p>
                  </div>
                  <div className="flex flex-col items-center justify-end text-center">
                    <div className="w-full border-b border-slate-800 pb-8 mb-1" />
                    <p className="font-bold text-slate-900 leading-tight">OSAS Director / Head</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Office of Student Affairs &amp; Services</p>
                  </div>
                </div>

                <div className="text-center pt-2 text-[10px] text-slate-400 font-mono border-t border-slate-200">
                  Dingalan Community College • OSAS Guidance &amp; Consultation System • Official Transaction Slip
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STRICT APPOINTMENT CONFLICT VALIDATION MODAL */}
      {conflictModalData && (
        <Modal
          isOpen={conflictModalData.isOpen}
          onClose={() => setConflictModalData(null)}
          title="Bawal ang Duplicate Approval: Schedule Conflict"
          subtitle="Strict Conflict Prevention Check"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/60 rounded-xl text-rose-600 dark:text-rose-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-rose-900 dark:text-rose-100 text-sm">
                  Na-block ang Approval dahil sa Duplicate Schedule
                </h4>
                <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                  Mayroon nang kasalukuyang <strong>APPROVED</strong> na appointment sa eksaktong petsa at oras na ito. Upang maiwasan ang conflict at double-booking sa counseling session, hindi pinapayagan ang dalawang aprubadong appointment sa iisang slot.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Conflict Petsa at Oras:</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                  {conflictModalData.date} @ {conflictModalData.time}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Kasalukuyang Naka-Apruba:</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400">
                  {conflictModalData.conflictStudent} {conflictModalData.conflictStudentId ? `(${conflictModalData.conflictStudentId})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Hinihiling na Estudyante:</span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {conflictModalData.candidateStudent}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
              💡 <strong>Rekomendasyon:</strong> Gamitin ang <strong>Reschedule</strong> tool sa appointment details upang bigyan ng ibang libreng petsa o oras ang estudyante bago ito aprubahan.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setConflictModalData(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Isara (Cancel Approval)
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

