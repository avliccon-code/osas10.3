import React, { useState } from 'react';
import {
  getSafetyReports,
  getDisciplinaryReports,
  getAllStudentReports,
  UnifiedStudentReport,
  getAppointments,
  getScholarships,
  getDormRooms,
  getUsers,
  getScholarshipApplications,
  getDormApplicants,
  getInterventionRecords,
  updateAppointmentStatus,
  saveAppointment,
  checkAppointmentConflict,
} from '../../services/storage';
import { SystemModule, Appointment, DisciplinaryReport, User } from '../../types';
import { Modal } from '../common/Modal';
import { db } from '../../services/firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  ShieldAlert,
  Calendar,
  Award,
  Home,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ExternalLink,
  ArrowUpRight,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate?: (module: SystemModule) => void;
  currentUser?: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, currentUser }) => {
  const [activeModal, setActiveModal] = useState<
    'SAFETY' | 'APPOINTMENTS' | 'SCHOLARSHIPS' | 'DORM' | 'STUDENTS' | null
  >(null);
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

  const [appointmentsList, setAppointmentsList] = useState(() => getAppointments());
  const [safetyReportsList, setSafetyReportsList] = useState(() => getSafetyReports());
  const [disciplinaryReportsList, setDisciplinaryReportsList] = useState<DisciplinaryReport[]>(() => getDisciplinaryReports());
  const [allStudentReports, setAllStudentReports] = useState<UnifiedStudentReport[]>(() => getAllStudentReports());
  const [scholarships, setScholarships] = useState(() => getScholarships());
  const [dormRooms, setDormRooms] = useState(() => getDormRooms());
  const [users, setUsers] = useState(() => getUsers().filter((u) => u.role === 'STUDENT'));
  const [scholarshipApps, setScholarshipApps] = useState(() => getScholarshipApplications());
  const [dormApplicants, setDormApplicants] = useState(() => getDormApplicants());
  const [interventionReferrals, setInterventionReferrals] = useState(() => getInterventionRecords('ADMIN'));

  const [unsyncedModules, setUnsyncedModules] = useState<string[]>([]);

  const refreshDashboardData = () => {
    setAppointmentsList(getAppointments());
    setSafetyReportsList(getSafetyReports());
    setDisciplinaryReportsList(getDisciplinaryReports());
    setAllStudentReports(getAllStudentReports());
    setScholarships(getScholarships());
    setDormRooms(getDormRooms());
    setUsers(getUsers().filter((u) => u.role === 'STUDENT'));
    setScholarshipApps(getScholarshipApplications());
    setDormApplicants(getDormApplicants());
    setInterventionReferrals(getInterventionRecords('ADMIN'));
  };

  React.useEffect(() => {
    refreshDashboardData();
    const interval = setInterval(refreshDashboardData, 2000);
    window.addEventListener('osas_storage_updated', refreshDashboardData);
    window.addEventListener('storage', refreshDashboardData);

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
        markSyncResult('Referred Student Reports', true);
        refreshDashboardData();
      },
      () => markSyncResult('Referred Student Reports', false)
    );
    const unsubStoreReports = onSnapshot(
      doc(db, 'osas_store', 'osas_disciplinary_reports'),
      () => {
        markSyncResult('Referred Student Reports', true);
        refreshDashboardData();
      },
      () => markSyncResult('Referred Student Reports', false)
    );
    const unsubInterventions = onSnapshot(
      collection(db, 'interventions'),
      () => {
        markSyncResult('Intervention Referrals & Resolutions', true);
        refreshDashboardData();
      },
      () => markSyncResult('Intervention Referrals & Resolutions', false)
    );
    const unsubStoreInterventions = onSnapshot(
      doc(db, 'osas_store', 'osas_interventions'),
      () => {
        markSyncResult('Intervention Referrals & Resolutions', true);
        refreshDashboardData();
      },
      () => markSyncResult('Intervention Referrals & Resolutions', false)
    );
    const unsubAppointments = onSnapshot(
      collection(db, 'appointments'),
      () => {
        markSyncResult('Guidance Appointments', true);
        refreshDashboardData();
      },
      () => markSyncResult('Guidance Appointments', false)
    );

    return () => {
      clearInterval(interval);
      window.removeEventListener('osas_storage_updated', refreshDashboardData);
      window.removeEventListener('storage', refreshDashboardData);
      unsubReports();
      unsubStoreReports();
      unsubInterventions();
      unsubStoreInterventions();
      unsubAppointments();
    };
  }, []);

  // Dynamic accuracy calculations for Dormitory slots
  const totalDormCapacity = dormRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
  const totalDormOccupants = dormRooms.reduce((acc, r) => acc + (r.residents?.length || 0), 0);
  const remainingDormSlots = Math.max(0, totalDormCapacity - totalDormOccupants);
  const dormOccupancyPct = totalDormCapacity > 0 ? Math.round((totalDormOccupants / totalDormCapacity) * 100) : 0;

  // Actual Referred Student Reports (from Guidance to OSAS)
  const referredStudentReports = React.useMemo(() => {
    return disciplinaryReportsList
      .filter((r) => !r.isArchived && Boolean(r.referredToOsas))
      .sort((a, b) => {
        const timeB = new Date(b.resolvedAt || b.osasReferralDate || b.submittedAt || 0).getTime();
        const timeA = new Date(a.resolvedAt || a.osasReferralDate || a.submittedAt || 0).getTime();
        return timeB - timeA;
      });
  }, [disciplinaryReportsList]);

  const pendingReferredStudentReportsCount = referredStudentReports.filter(
    (r) => !Boolean(r.resolutionOutcome || r.resolutionDetails || r.status === 'RESOLVED')
  ).length;

  // Deduplicate and filter Referred Student Concerns / Interventions
  const osasGuidanceReferrals = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const rec of interventionReferrals) {
      if (!rec?.id || rec.isArchived) continue;
      const isReferral =
        Boolean(
          rec.referredToOsas ||
            rec.osasReferralDate ||
            rec.osasReferralReason ||
            rec.referredToGuidance ||
            rec.status === 'REFERRED' ||
            rec.guidanceStatus === 'REFERRED' ||
            rec.referredBy === 'OSAS Administrator' ||
            (rec.referredBy === 'Guidance Advocate' && rec.status === 'REFERRED') ||
            rec.osasApprovalName ||
            rec.referredByPersonnel ||
            rec.recommendedDesignation
        );
      if (isReferral && !map.has(rec.id)) {
        map.set(rec.id, rec);
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const timeB = new Date(b.osasReferralDate || b.createdAt || b.dateOfReferral || 0).getTime();
      const timeA = new Date(a.osasReferralDate || a.createdAt || a.dateOfReferral || 0).getTime();
      return timeB - timeA;
    });
  }, [interventionReferrals]);

  const pendingReferralsCount = osasGuidanceReferrals.filter(
    (r) => !['COMPLETED', 'RESOLVED'].includes(String(r.guidanceStatus || r.status || '').toUpperCase())
  ).length;

  // Actual Intervention Resolutions (Intervention records where a resolution was created or saved)
  const interventionResolutionsList = React.useMemo(() => {
    return interventionReferrals
      .filter(
        (r) =>
          !r.isArchived &&
          Boolean(
            r.problemResolved ||
            r.resolutionDetails ||
            r.guidanceActionTaken ||
            (r.resolutionActionSteps && r.resolutionActionSteps.length > 0) ||
            r.resolvedAt ||
            r.status === 'RESOLVED' ||
            r.status === 'COMPLETED'
          )
      )
      .sort((a, b) => {
        const timeB = new Date(b.resolvedAt || b.createdAt || b.dateOfReferral || 0).getTime();
        const timeA = new Date(a.resolvedAt || a.createdAt || a.dateOfReferral || 0).getTime();
        return timeB - timeA;
      });
  }, [interventionReferrals]);

  const pendingScholApps = scholarshipApps.filter((a) => a.status === 'PENDING').length;

  // Combined Student Applicants (Scholarship + Dormitory)
  const combinedApplicants = React.useMemo(() => {
    const scholItems = scholarshipApps.map((app) => {
      const grant = scholarships.find((s) => s.id === app.scholarshipId);
      return {
        id: `schol-${app.id}`,
        studentId: app.studentId,
        studentName: app.studentName,
        course: app.course || '',
        yearLevel: app.yearLevel || '',
        type: 'Scholarship' as const,
        programOrRoom: app.scholarshipTitle || grant?.title || 'Scholarship Grant',
        dateApplied: app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '',
        status: String(app.status || 'PENDING'),
        targetModule: 'scholarship' as SystemModule,
      };
    });

    const dormItems = dormApplicants.map((app) => ({
      id: `dorm-${app.id}`,
      studentId: app.studentId,
      studentName: app.studentName,
      course: '',
      yearLevel: '',
      type: 'Dormitory' as const,
      programOrRoom: app.assignedRoomNumber ? `Room ${app.assignedRoomNumber}` : app.reason || 'Dormitory Application',
      dateApplied: app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '',
      status: String(app.status || 'PENDING'),
      targetModule: 'dormitory' as SystemModule,
    }));

    return [...scholItems, ...dormItems];
  }, [scholarshipApps, dormApplicants, scholarships]);

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
        message: conflict.message || 'Mayroon nang kasalukuyang aprubadong appointment sa petsa at oras na ito. Bawal ang duplicate approval.',
      });
      return;
    }

    try {
      updateAppointmentStatus(app.id, 'APPROVED', 'Approved by Admin on Dashboard');
      setAppointmentsList(getAppointments());
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

  const handleRejectAppointment = (app: Appointment) => {
    updateAppointmentStatus(app.id, 'REJECTED', 'Rejected by Admin on Dashboard');
    setAppointmentsList(getAppointments());
    setSelectedAppointment(null);
  };

  const handleRescheduleAppointment = (app: Appointment) => {
    if (!rescheduleDate || !rescheduleTime) return;
    updateAppointmentStatus(
      app.id,
      'RESCHEDULED',
      rescheduleDate,
      rescheduleTime,
      `Rescheduled by Admin to ${rescheduleDate} at ${rescheduleTime}`,
      'Princess Ann T. Ruzol (Admin)'
    );
    setAppointmentsList(getAppointments());
    setSelectedAppointment(null);
  };

  const handleModuleRedirect = (mod: SystemModule) => {
    setActiveModal(null);
    if (onNavigate) onNavigate(mod);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner (OSAS Blue Theme matching Guidance Advocate Dashboard design) */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden border border-blue-700/40">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Office of Student Affairs & Services
            </div>
          </div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight">
            Welcome back, {currentUser?.fullName || 'OSAS Administrator'}
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed">
            Oversee referred student reports, guidance resolutions, scholarships, dormitory operations, and student records across Dingalan Community College.
          </p>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Referred Student Reports Card */}
        <div
          id="summary-card-safety"
          onClick={() => setActiveModal('STUDENTS')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700/60 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Referred Student Reports</p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-semibold transition-colors">
              <span>View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{referredStudentReports.length}</span>
            <span className="text-xs text-green-600 dark:text-green-400 font-bold pb-1">
              {pendingReferredStudentReportsCount} Active
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                Guidance Referrals
              </span>
            </div>
          </div>
        </div>

        {/* Scholarship Applicants Card */}
        <div
          id="summary-card-scholarships"
          onClick={() => setActiveModal('SCHOLARSHIPS')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700/60 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Scholarship Applicants</p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-400 font-semibold transition-colors">
              <span>View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{scholarshipApps.length}</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-bold pb-1">{pendingScholApps} Pending</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded border border-amber-200/60 dark:border-amber-800/60">
              {scholarships.length} Grants Active
            </span>
          </div>
        </div>

        {/* Dorm Occupancy Card */}
        <div
          id="summary-card-dorm"
          onClick={() => setActiveModal('DORM')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/60 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dorm Occupancy & Slots</p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-semibold transition-colors">
              <span>View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{dormOccupancyPct}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold pb-1">
              {totalDormOccupants} / {totalDormCapacity} Occupied
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all duration-300" style={{ width: `${dormOccupancyPct}%` }}></div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{remainingDormSlots} slots available</span>
            </div>
          </div>
        </div>

        {/* Intervention Resolutions Card */}
        <div
          id="summary-card-appointments"
          onClick={() => setActiveModal('APPOINTMENTS')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700/60 transition-all duration-200 cursor-pointer group hover:-translate-y-0.5"
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Intervention Resolutions</p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-semibold transition-colors">
              <span>View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{interventionResolutionsList.length}</span>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-bold pb-1">Case Resolutions</span>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-200 dark:border-blue-800">
              {interventionResolutionsList.length} Saved Resolutions
            </span>
          </div>
        </div>
      </div>

      {/* STUDENT APPLICANTS TABLE (Scholarship & Dormitory) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-2xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Student Applicants ({combinedApplicants.length})
            </h3>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              Scholarship & Dormitory
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleModuleRedirect('scholarship')}
              className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Scholarships <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleModuleRedirect('dormitory')}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Dormitory <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-2.5">Student Name</th>
                <th className="px-4 py-2.5">Application Type</th>
                <th className="px-4 py-2.5">Program / Room Details</th>
                <th className="px-4 py-2.5 text-center">Date Applied</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {combinedApplicants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                    No scholarship or dormitory applicants right now.
                  </td>
                </tr>
              ) : (
                combinedApplicants.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{app.studentName}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        ID: {app.studentId} {app.course ? `• ${app.course} (${app.yearLevel})` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          app.type === 'Scholarship'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {app.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 font-semibold max-w-xs truncate">
                      {app.programOrRoom}
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300 font-medium">
                      {app.dateApplied || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          app.status === 'ACCEPTED' || app.status === 'APPROVED' || app.status === 'ASSIGNED'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : app.status === 'REJECTED'
                            ? 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                            : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleModuleRedirect(app.targetModule)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg border border-blue-500 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        Manage <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reschedule Dialog Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800">
              Reschedule Appointment for {selectedAppointment.studentName}
            </h3>
            <p className="text-xs text-slate-500">
              Original request: {selectedAppointment.preferredDate} at {selectedAppointment.preferredTime}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">New Time</label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setSelectedAppointment(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRescheduleAppointment(selectedAppointment)}
                className="flex-1 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold"
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intervention Resolutions Modal */}
      <Modal
        isOpen={activeModal === 'APPOINTMENTS'}
        onClose={() => setActiveModal(null)}
        title="Intervention Resolutions Overview"
        subtitle="Saved student intervention cases and resolutions"
        maxWidth="2xl"
      >
        <div className="space-y-3">
          {interventionResolutionsList.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">No intervention resolutions recorded yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              {interventionResolutionsList.map((r) => {
                const actionText =
                  r.guidanceActionTaken ||
                  r.actionTakenSummary ||
                  (r.resolutionActionSteps && r.resolutionActionSteps.length > 0
                    ? r.resolutionActionSteps.map((s: any) => s.actionTaken).filter(Boolean).join('\n')
                    : '') ||
                  '';
                return (
                  <div key={r.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {r.studentName} ({r.studentId || 'No ID'})
                        </span>
                        {[r.course, r.yearLevel].filter(Boolean).length > 0 && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            • {[r.course, r.yearLevel].filter(Boolean).join(' - ')}
                          </span>
                        )}
                      </div>
                      {r.problemResolved && (
                        <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 font-semibold">
                          <span className="text-slate-400 uppercase text-[10px] font-bold mr-1">Resolved:</span>
                          {r.problemResolved}
                        </p>
                      )}
                      {(r.resolutionDetails || actionText) && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                          {r.resolutionDetails || actionText}
                        </p>
                      )}
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1.5 font-semibold">
                        Resolved: {r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString() : (r.dateOfReferral || 'Recorded')}
                        {r.status ? ` • Status: ${r.status}` : ''}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-full shrink-0 border border-emerald-200 dark:border-emerald-800">
                      {r.resolutionOutcome || r.status || 'RESOLVED'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => handleModuleRedirect('intervention')}
              className="py-2.5 px-5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              View Full Intervention Resolution <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'SCHOLARSHIPS'}
        onClose={() => setActiveModal(null)}
        title="Scholarship Programs & Applications Overview"
        subtitle="Active university scholarship grants and applicants"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1">
              Active Programs ({scholarships.length})
            </div>
            {scholarships.map((s) => (
              <div key={s.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{s.title}</h4>
                  <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">{s.amount || 'Subsidy'}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{s.description}</p>
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                  <span>Deadline: {s.deadline}</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                    s.status === 'ACTIVE'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => handleModuleRedirect('scholarship')}
              className="py-2.5 px-5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              View Full Scholarship Module <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'DORM'}
        onClose={() => setActiveModal(null)}
        title="Dormitory Facilities & Occupancy Overview"
        subtitle="Current state of university dorm rooms and occupancy"
        maxWidth="2xl"
      >
        <div className="space-y-3">
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {dormRooms.map((d) => (
              <div key={d.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{d.roomNumber} ({d.gender} Wing)</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Floor: {d.floor} | Occupants: {d.occupiedCount}/{d.capacity}</p>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                  d.status === 'AVAILABLE'
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                }`}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => handleModuleRedirect('dormitory')}
              className="py-2.5 px-5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              View Full Dormitory Module <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'STUDENTS'}
        onClose={() => setActiveModal(null)}
        title="Referred Student Reports Overview"
        subtitle="Student reports referred to OSAS for review and evaluation"
        maxWidth="2xl"
      >
        <div className="space-y-3">
          {referredStudentReports.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">No referred student reports recorded yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              {referredStudentReports.map((rep) => (
                <div key={rep.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {rep.reportedStudentName} {rep.reportedStudentId ? `(${rep.reportedStudentId})` : ''}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {rep.osasReferralDescription || rep.description}
                    </p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-semibold">
                      Referred By: {rep.osasReferralBy || 'Guidance Advocate'} • Date: {rep.osasReferralDate || rep.reportDate}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 rounded-full shrink-0 border border-blue-200 dark:border-blue-800">
                    {rep.resolutionOutcome || rep.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => handleModuleRedirect('refer_student_reports')}
              className="py-2.5 px-5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              View Full Referred Student Reports <ExternalLink className="w-4 h-4" />
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
          subtitle="Strict Schedule Conflict Policy Enforced"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-900 dark:text-red-200">
                  Hindi Maaaring I-approve ang Appointment
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
              Paunawa: Hangga't hindi pa nagiging "Completed" ang naunang appointment sa oras na ito, hindi puwedeng mag-apruba ng panibagong appointment sa parehong slot. Gamitin ang Reschedule upang magtakda ng ibang oras.
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
    </div>
  );
};

