import React, { useState, useEffect, useMemo } from 'react';
import {
  getDisciplinaryRecords,
  addDisciplinaryRecord,
  deleteDisciplinaryRecord,
  updateDisciplinaryStatus,
  referDisciplinaryRecordToGuidance,
  getInterventionRecords,
  logActivity,
} from '../../services/storage';
import {
  DisciplinaryRecord,
  DisciplinaryReport,
  InterventionRecord,
  IncidentType,
  DisciplinaryReporterRole,
  DisciplinaryActionTaken,
} from '../../types';
import { DisciplinaryActionForm, DisciplinaryActionFormInitialData } from './DisciplinaryActionForm';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { CollegeLogo } from '../common/CollegeLogo';
import { db } from '../../services/firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  hasGuidanceSanction,
  getSanctionStatusLabel,
  isSanctionEndDateReached,
} from '../../utils/sanctionUtils';
import {
  AlertOctagon,
  FileText,
  CheckCircle2,
  Calendar,
  Clock,
  Check,
  Search,
  Archive,
  Eye,
  X,
  Plus,
  AlertTriangle,
  FolderOpen,
  Shield,
  Tag,
  HeartHandshake,
  Send,
  AlertCircle,
  Upload,
  Printer,
  User,
  MapPin,
  Paperclip,
  Link2,
} from 'lucide-react';

export interface DisciplinaryModuleProps {
  sourceReport?: DisciplinaryReport | null;
  onClearSourceReport?: () => void;
}

export const DisciplinaryModule: React.FC<DisciplinaryModuleProps> = ({
  sourceReport,
  onClearSourceReport,
}) => {
  const [activeTab, setActiveTab] = useState<'daf_form' | 'records' | 'student_sanctions'>('daf_form');

  const [dafSubmittedSuccess, setDafSubmittedSuccess] = useState(false);
  const [successMessageTitle, setSuccessMessageTitle] = useState('Official Disciplinary Record Issued');

  const sourceReportInitialData = useMemo<DisciplinaryActionFormInitialData | undefined>(() => {
    if (!sourceReport) return undefined;
    return {
      reportedStudentName: sourceReport.reportedStudentName,
      reportedStudentId: sourceReport.reportedStudentId || '',
      reportedStudentCourse: sourceReport.reportedStudentCourse || '',
      reportedStudentYearLevel: sourceReport.reportedStudentYearLevel || '',
      reportedStudentContact: sourceReport.reportedStudentContact || '',
      contactNumber: sourceReport.reportedStudentContact || '',
      reportedStudentAddress: sourceReport.reportedStudentAddress || '',
      location: sourceReport.location,
      description: sourceReport.description,
      reportDate:
        sourceReport.reportDate ||
        (sourceReport.submittedAt ? sourceReport.submittedAt.split('T')[0] : ''),
      reportTime: sourceReport.reportTime || '',
      incidentTypes: [],
      actionTaken: sourceReport.actionTaken || '',
      sanction: '',
      evidenceFileName: sourceReport.evidenceFileName,
      evidenceUrl: sourceReport.evidenceUrl,
    };
  }, [sourceReport?.id]);

  useEffect(() => {
    if (sourceReport) {
      setActiveTab('daf_form');
      setDafSubmittedSuccess(false);
    }
  }, [sourceReport?.id]);

  const sortDisciplinaryRecordsNewestFirst = (list: DisciplinaryRecord[]): DisciplinaryRecord[] => {
    return [...list].sort((a, b) => {
      const timeB = b.updatedAt ? Number(b.updatedAt) : new Date(b.dateLogged || 0).getTime();
      const timeA = a.updatedAt ? Number(a.updatedAt) : new Date(a.dateLogged || 0).getTime();
      if (timeB !== timeA && !isNaN(timeB) && !isNaN(timeA)) return timeB - timeA;
      return new Date(b.dateLogged || 0).getTime() - new Date(a.dateLogged || 0).getTime();
    });
  };

  // Disciplinary Records & Guidance Intervention Referrals state
  const [records, setRecords] = useState<DisciplinaryRecord[]>(() =>
    sortDisciplinaryRecordsNewestFirst(getDisciplinaryRecords())
  );
  const [interventionReferrals, setInterventionReferrals] = useState<InterventionRecord[]>(() =>
    getInterventionRecords('GUIDANCE_ADMIN')
  );
  const [selectedReferralForSanction, setSelectedReferralForSanction] = useState<InterventionRecord | null>(null);
  const [sanctionInitialData, setSanctionInitialData] = useState<DisciplinaryActionFormInitialData | undefined>(undefined);

  const [selectedRecord, setSelectedRecord] = useState<DisciplinaryRecord | null>(null);
  const [showCreateSanctionFields, setShowCreateSanctionFields] = useState(false);
  const [sanctionText, setSanctionText] = useState('');
  const [sanctionEndDate, setSanctionEndDate] = useState('');
  const [recordSearchQuery, setRecordSearchQuery] = useState('');
  const [sanctionStatusFilter, setSanctionStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  // Confirmation & Print Modals
  const [confirmArchiveRecord, setConfirmArchiveRecord] = useState<DisciplinaryRecord | null>(null);
  const [printDisciplinaryRecord, setPrintDisciplinaryRecord] = useState<DisciplinaryRecord | null>(null);

  const handleDirectPrintDisciplinary = (rec: DisciplinaryRecord) => {
    setPrintDisciplinaryRecord(rec);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintDisciplinaryRecord(null), 500);
    }, 50);
  };

  const refreshAllData = () => {
    setRecords(sortDisciplinaryRecordsNewestFirst(getDisciplinaryRecords()));
    setInterventionReferrals(getInterventionRecords('GUIDANCE_ADMIN'));
  };

  useEffect(() => {
    refreshAllData();
    window.addEventListener('osas_storage_updated', refreshAllData);
    window.addEventListener('storage', refreshAllData);

    const unsubStoreDisc = onSnapshot(
      doc(db, 'osas_store', 'osas_disciplinary'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && Array.isArray(data.value)) {
            const map = new Map<string, DisciplinaryRecord>();
            getDisciplinaryRecords().forEach((r) => {
              if (r && r.id) map.set(r.id, r);
            });
            data.value.forEach((r: DisciplinaryRecord) => {
              if (r && r.id && !r.isArchivedByAdmin) {
                const existing = map.get(r.id);
                if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
                  map.set(r.id, r);
                }
              }
            });
            setRecords(sortDisciplinaryRecordsNewestFirst(Array.from(map.values())));
          }
        }
      },
      () => {}
    );

    const unsubCollDisc = onSnapshot(
      collection(db, 'disciplinary_records'),
      (snap) => {
        if (!snap.empty) {
          const map = new Map<string, DisciplinaryRecord>();
          getDisciplinaryRecords().forEach((r) => {
            if (r && r.id) map.set(r.id, r);
          });
          snap.docs.forEach((d) => {
            const r = d.data() as DisciplinaryRecord;
            if (r && r.id && !r.isArchivedByAdmin) {
              const existing = map.get(r.id);
              if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
                map.set(r.id, r);
              }
            }
          });
          setRecords(sortDisciplinaryRecordsNewestFirst(Array.from(map.values())));
        }
      },
      () => {}
    );

    return () => {
      window.removeEventListener('osas_storage_updated', refreshAllData);
      window.removeEventListener('storage', refreshAllData);
      unsubStoreDisc();
      unsubCollDisc();
    };
  }, []);

  const handleSelectGuidanceReferral = (intRec: InterventionRecord) => {
    setSelectedReferralForSanction(intRec);
    const existingLinkedRecord = records.find(
      (r) => r.linkedInterventionId === intRec.id || r.id === intRec.linkedDisciplinaryId
    );
    setSanctionInitialData({
      reportedByRole: 'OSAS Officer',
      reporterName:
        intRec.guidanceCounselorAssigned ||
        intRec.receivedByName ||
        'Maria Mel B. Glemao (Guidance Advocate)',
      reporterId: '',
      reporterCourse: 'Guidance Office',
      contactNumber: intRec.contactNumber || '',
      reportedStudentName: intRec.studentName,
      reportedStudentId: intRec.studentId,
      reportedStudentCourse: intRec.course,
      reportedStudentYearLevel: intRec.yearLevel,
      reportedStudentAddress: intRec.address,
      incidentType: (existingLinkedRecord?.offenseType as IncidentType) || 'Discipline',
      location: existingLinkedRecord?.location || 'DCC Main Campus',
      actionTaken: (existingLinkedRecord?.actionTaken as DisciplinaryActionTaken) || 'Written Warning Issued',
      description:
        existingLinkedRecord?.description ||
        intRec.reasonForReferral ||
        intRec.descriptionOfConcerns ||
        '',
      sanction:
        existingLinkedRecord?.sanction ||
        intRec.guidanceActionTaken ||
        'Guidance Counseling & Behavioral Sanction Compliance',
      startDate: existingLinkedRecord?.startDate || new Date().toISOString().split('T')[0],
      endDate:
        existingLinkedRecord?.completionDate ||
        intRec.followUpDate ||
        new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      remarks:
        existingLinkedRecord?.remarks ||
        intRec.guidanceOutcomeSummary ||
        `Originating from Guidance Referral #${intRec.id} (${intRec.dateOfReferral}).`,
      declarationAccepted: true,
    });
  };

  const handleStatusChangeForRecord = (
    recordId: string,
    newStatus: 'SANCTIONED' | 'COMPLETED',
    options?: { completionDate?: string; startDate?: string; sanction?: string }
  ) => {
    updateDisciplinaryStatus(recordId, newStatus, 'Guidance Advocate', options);
    refreshAllData();
    if (selectedRecord && selectedRecord.id === recordId) {
      setSelectedRecord({
        ...selectedRecord,
        status: newStatus,
        ...(options?.completionDate !== undefined ? { completionDate: options.completionDate } : {}),
        ...(options?.startDate !== undefined ? { startDate: options.startDate } : {}),
        ...(options?.sanction !== undefined ? { sanction: options.sanction } : {}),
      });
    }
  };

  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      rec.studentName.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
      rec.studentId.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
      rec.offenseType.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
      rec.description.toLowerCase().includes(recordSearchQuery.toLowerCase()) ||
      (rec.linkedInterventionId && rec.linkedInterventionId.toLowerCase().includes(recordSearchQuery.toLowerCase()));

    return matchesSearch;
  });

  // Sanctioned cases (after sanction workflow / repeated-case process)
  const sanctionedRecords = records.filter((rec) => hasGuidanceSanction(rec));
  const filteredSanctionedRecords = sanctionedRecords.filter((rec) => {
    if (sanctionStatusFilter === 'ACTIVE') return rec.status !== 'COMPLETED';
    if (sanctionStatusFilter === 'COMPLETED') return rec.status === 'COMPLETED';
    return true;
  });

  const getLinkedIntervention = (rec: DisciplinaryRecord): InterventionRecord | undefined => {
    if (rec.linkedInterventionId) {
      return interventionReferrals.find((i) => i.id === rec.linkedInterventionId);
    }
    return interventionReferrals.find((i) => i.linkedDisciplinaryId === rec.id);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-6 flex flex-col justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 rounded-2xl shrink-0">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Disciplinary Records &amp; Student Sanctions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage disciplinary action forms, official disciplinary records, and student sanctions
              </p>
            </div>
          </div>
        </div>

        {/* 3 Required Tabs: 1. Disciplinary Action Form, 2. Official Records, 3. Student Sanctions */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center sm:justify-start gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              if (onClearSourceReport) onClearSourceReport();
              setActiveTab('daf_form');
              setDafSubmittedSuccess(false);
            }}
            className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'daf_form'
                ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Disciplinary Action Form</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onClearSourceReport) onClearSourceReport();
              setActiveTab('records');
            }}
            className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'records'
                ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Official Disciplinary Records</span>
            <span
              className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                activeTab === 'records' ? 'bg-white text-red-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {records.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onClearSourceReport) onClearSourceReport();
              setActiveTab('student_sanctions');
              setDafSubmittedSuccess(false);
            }}
            className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'student_sanctions'
                ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>Student Sanctions</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {dafSubmittedSuccess && (
        <div className="max-w-4xl mx-auto p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h4 className="text-xs font-black uppercase">{successMessageTitle}</h4>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                The disciplinary record has been saved to Official Records and linked to the student&apos;s record without duplication.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDafSubmittedSuccess(false)}
            className="p-1 hover:bg-emerald-200/50 rounded-lg text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: DISCIPLINARY ACTION FORM */}
      {activeTab === 'daf_form' && (
        <div className="max-w-4xl mx-auto">
          <DisciplinaryActionForm
            key={sourceReport ? `report-${sourceReport.id}` : 'normal-daf'}
            isWalkIn={!sourceReport}
            sourceReportId={sourceReport?.id}
            initialData={sourceReportInitialData}
            formTitle="Disciplinary Action Form"
            formSubtitle="Official Guidance Disciplinary Action & Case Documentation Form"
            onSuccess={() => {
              if (onClearSourceReport) onClearSourceReport();
              refreshAllData();
              setSuccessMessageTitle('Disciplinary Record Issued');
              setDafSubmittedSuccess(true);
              setActiveTab('records');
            }}
          />
        </div>
      )}

      {/* TAB 3: STUDENT SANCTIONS */}
      {activeTab === 'student_sanctions' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-600" />
                Student Sanctions ({filteredSanctionedRecords.length})
              </h3>
              <select
                value={sanctionStatusFilter}
                onChange={(e) => setSanctionStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'COMPLETED')}
                className="w-full sm:w-auto px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="ALL">All Sanctions</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            {filteredSanctionedRecords.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <Shield className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No student sanctions found.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {sanctionedRecords.length === 0
                    ? 'Student sanctions created from Official Records will appear here.'
                    : 'No sanction records match the selected status filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSanctionedRecords.map((rec) => {
                  const isCompleted = rec.status === 'COMPLETED';
                  const statusLabel = getSanctionStatusLabel(rec.status);
                  const canShowCompleteButton = isCompleted || isSanctionEndDateReached(rec.completionDate);

                  return (
                    <div
                      key={rec.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {rec.studentName} ({rec.studentId})
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-black rounded uppercase bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                            {rec.offenseType}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase border animate-in zoom-in-95 duration-300 ${
                              isCompleted
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-red-700 dark:text-red-400">
                          Sanction: {rec.sanction}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Sanction End Date: {rec.completionDate || 'Ongoing'} • Status:{' '}
                          <strong className={isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                            {statusLabel}
                          </strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 animate-in zoom-in-95 duration-300">
                        <button
                          type="button"
                          onClick={() => handleStatusChangeForRecord(rec.id, 'SANCTIONED')}
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border cursor-pointer transition-all duration-300 ${
                            !isCompleted
                              ? 'bg-amber-500 text-white border-amber-600 shadow-2xs animate-pulse'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-amber-50'
                          }`}
                        >
                          Sanction (Active)
                        </button>
                        {canShowCompleteButton && (
                          <button
                            type="button"
                            onClick={() => handleStatusChangeForRecord(rec.id, 'COMPLETED')}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border cursor-pointer transition-all duration-300 animate-in zoom-in-95 ${
                              isCompleted
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-emerald-50 animate-pulse'
                            }`}
                          >
                            {isCompleted ? 'Completed' : 'Complete'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OFFICIAL RECORDS */}
      {activeTab === 'records' && (
        <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-red-600" />
                Official Disciplinary Records ({records.length})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Contains official disciplinary records originating from walk-in reports and Guidance referrals
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-64 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 shrink-0" />
                <input
                  type="text"
                  value={recordSearchQuery}
                  onChange={(e) => setRecordSearchQuery(e.target.value)}
                  placeholder="Search student, ID, offense..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <FolderOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No official records found.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {records.length === 0
                  ? 'No official disciplinary records have been logged yet.'
                  : 'Adjust filters or search query to find records.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecords.map((rec) => {
                const linkedIntervention = getLinkedIntervention(rec);

                return (
                  <div
                    key={rec.id}
                    className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col justify-between gap-4 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-2xs"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 text-[10px] font-black rounded uppercase bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                          {rec.offenseType}
                        </span>
                        {(rec.referredToGuidance || rec.linkedInterventionId || linkedIntervention) && (
                          <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                            <HeartHandshake className="w-3 h-3 text-amber-600" />
                            <span>
                              Guidance Referral {linkedIntervention ? `#${linkedIntervention.id}` : rec.linkedInterventionId ? `#${rec.linkedInterventionId}` : ''}
                            </span>
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          Record #{rec.id} • {rec.dateLogged}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {rec.studentName} <span className="text-xs font-mono text-slate-500">({rec.studentId})</span>
                        </h4>
                        {rec.course && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {rec.course} {rec.yearLevel ? `• ${rec.yearLevel}` : ''}
                          </p>
                        )}
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Violation / Disciplinary Concern:</span>
                        {rec.description}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        <div>
                          <span className="font-bold">Reported / Referred By:</span>{' '}
                          {rec.reportedBy === 'Anonymous Reporter' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                              <Shield className="w-3 h-3" /> Anonymous
                            </span>
                          ) : (
                            rec.reportedBy || rec.issuedBy || 'Guidance Office'
                          )}
                        </div>
                        {rec.location && (
                          <div>
                            <span className="font-bold">Location:</span> {rec.location}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Row at bottom */}
                    <div className="grid grid-cols-3 sm:flex sm:items-center sm:justify-end gap-1.5 sm:gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => {
                          setSelectedRecord(rec);
                          setShowCreateSanctionFields(false);
                          setSanctionText('');
                          setSanctionEndDate(rec.completionDate || '');
                        }}
                        className="w-full sm:w-auto px-1.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] sm:text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" /> <span>View Details</span>
                      </button>

                      <button
                        onClick={() => handleDirectPrintDisciplinary(rec)}
                        className="w-full sm:w-auto px-1.5 sm:px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] sm:text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Printer className="w-3.5 h-3.5 shrink-0" /> <span>Print</span>
                      </button>

                      <button
                        onClick={() => setConfirmArchiveRecord(rec)}
                        className="w-full sm:w-auto px-1.5 sm:px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-[11px] sm:text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 border border-amber-200 dark:border-amber-800 whitespace-nowrap"
                      >
                        <Archive className="w-3.5 h-3.5 shrink-0" /> <span>Archive</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: VIEW DETAILED DISCIPLINARY RECORD (Disciplinary Information Only — No Sanction Details) */}
      {selectedRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          title={`Disciplinary Violation Record - ${selectedRecord.studentName}`}
          subtitle={`Record ID: ${selectedRecord.id}`}
          maxWidth="md"
        >
          <div className="space-y-3 p-2 text-xs">
            <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-xl border border-red-200 dark:border-red-900/60 space-y-1">
              <span className="font-bold text-red-900 dark:text-red-300 uppercase text-[10px]">Offense Category</span>
              <p className="font-black text-red-800 dark:text-red-300 text-sm">{selectedRecord.offenseType}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px] block">Student Details</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {selectedRecord.studentName} (ID: {selectedRecord.studentId})
                </p>
                {selectedRecord.course && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedRecord.course} {selectedRecord.yearLevel ? `• ${selectedRecord.yearLevel}` : ''}
                  </p>
                )}
              </div>

              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px] block">Incident Location</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {selectedRecord.location || 'DCC Main Campus'}
                </p>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Incident Description</span>
              <p className="text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed mt-1">
                {selectedRecord.description}
              </p>
            </div>

            {selectedRecord.actionTaken && (
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Action Taken</span>
                <p className="text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 font-bold">
                  {selectedRecord.actionTaken === 'Others' && selectedRecord.actionTakenOther
                    ? selectedRecord.actionTakenOther
                    : selectedRecord.actionTaken}
                </p>
              </div>
            )}

            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Official Administrative Remarks</span>
              <p className="text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed mt-1 text-xs">
                {selectedRecord.remarks || 'No official administrative remarks recorded.'}
              </p>
            </div>

            {(() => {
              const linkedInt = getLinkedIntervention(selectedRecord);
              if (!linkedInt && !selectedRecord.linkedInterventionId) return null;
              return (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-900 dark:text-amber-300 uppercase text-[10px] flex items-center gap-1">
                      <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                      Linked Guidance Referral Record
                    </span>
                    <span className="font-mono text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      #{linkedInt?.id || selectedRecord.linkedInterventionId}
                    </span>
                  </div>
                  {linkedInt && (
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                      <div>
                        <strong>Referral Date:</strong> {linkedInt.dateOfReferral} •{' '}
                        <strong>Status:</strong> {linkedInt.status}
                      </div>
                      {linkedInt.guidanceCounselorAssigned && (
                        <div>
                          <strong>Counselor:</strong> {linkedInt.guidanceCounselorAssigned} (
                          {linkedInt.guidanceSessionCount ?? linkedInt.guidanceSessionsCount ?? 0} session(s))
                        </div>
                      )}
                      {linkedInt.guidanceOutcomeSummary && (
                        <div>
                          <strong>Guidance Outcome:</strong> {linkedInt.guidanceOutcomeSummary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="pt-2 text-[10px] text-slate-400 flex justify-between">
              <span>Date Logged: {selectedRecord.dateLogged}</span>
              <span>Issued By: {selectedRecord.issuedBy}</span>
            </div>

            {/* Modal Footer Actions: Cancel beside Create Sanction */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 pt-3">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (showCreateSanctionFields) {
                      setShowCreateSanctionFields(false);
                      setSanctionText('');
                      setSanctionEndDate(selectedRecord.completionDate || '');
                    } else {
                      setSelectedRecord(null);
                    }
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateSanctionFields((prev) => !prev);
                    setSanctionText('');
                    if (!sanctionEndDate && selectedRecord.completionDate) {
                      setSanctionEndDate(selectedRecord.completionDate);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Create Sanction</span>
                </button>
              </div>

              {showCreateSanctionFields && (
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/60 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Sanction
                    </label>
                    <input
                      type="text"
                      value={sanctionText}
                      onChange={(e) => setSanctionText(e.target.value)}
                      placeholder="Enter student sanction..."
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Sanction End Date
                    </label>
                    <input
                      type="date"
                      value={sanctionEndDate}
                      onChange={(e) => setSanctionEndDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const effectiveSanction =
                          sanctionText.trim() ||
                          (selectedRecord.sanction &&
                          selectedRecord.sanction.trim() !== '' &&
                          !selectedRecord.sanction.includes('Pending Sanction')
                            ? selectedRecord.sanction.trim()
                            : selectedRecord.actionTaken === 'Others' && selectedRecord.actionTakenOther
                            ? selectedRecord.actionTakenOther.trim()
                            : (selectedRecord.actionTaken || 'Disciplinary Sanction').trim());
                        handleStatusChangeForRecord(selectedRecord.id, 'SANCTIONED', {
                          completionDate: sanctionEndDate || undefined,
                          startDate: selectedRecord.startDate || selectedRecord.dateLogged,
                          sanction: effectiveSanction,
                        });
                        setSelectedRecord(null);
                        setShowCreateSanctionFields(false);
                        setActiveTab('student_sanctions');
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl border cursor-pointer transition-colors bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-2xs"
                    >
                      Active Sanction
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* PRINT OFFICIAL DISCIPLINARY SLIP */}
      {printDisciplinaryRecord && (
        <div className="direct-print-container">
          <div id="printable-disciplinary-slip" className="printable-document flex flex-col justify-between min-h-0 sm:min-h-[1020px] print:min-h-screen print:h-full bg-white text-slate-900 p-2 sm:p-4 rounded-xl border border-slate-200 print:border-none print:p-0">
            <div className="printable-body flex-1 space-y-4">
                {/* Institutional Header */}
                <div className="text-center pb-3 border-b-2 border-slate-900 space-y-1">
                  <div className="flex items-center justify-center gap-3 mb-1.5">
                    <CollegeLogo className="w-12 h-12" />
                    <div>
                      <h1 className="text-base font-black uppercase tracking-wider text-slate-900">
                        Dingalan Community College
                      </h1>
                      <p className="text-xs font-bold text-slate-700 uppercase">
                        Office of Student Affairs and Services (OSAS)
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Student Discipline &amp; Code of Conduct Enforcement
                      </p>
                    </div>
                  </div>
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest bg-red-800 text-white py-1 px-4 rounded inline-block">
                    Official Disciplinary Sanction Slip
                  </h2>
                </div>

                {/* Case Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Record ID</span>
                    <span className="font-mono font-bold text-slate-900">#{printDisciplinaryRecord.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Date Issued</span>
                    <span className="font-semibold text-slate-800">{printDisciplinaryRecord.dateLogged}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Record Status</span>
                    <span className="font-bold text-slate-800 uppercase">{printDisciplinaryRecord.status || 'SANCTIONED'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year</span>
                    <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
                  </div>
                </div>

                {/* Section 1: Student & Offense Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Student Information</p>
                    <p><strong>Full Name:</strong> {printDisciplinaryRecord.studentName}</p>
                    <p><strong>Student ID:</strong> {printDisciplinaryRecord.studentId}</p>
                    <p><strong>Course / Program:</strong> {printDisciplinaryRecord.course || '—'}</p>
                    <p><strong>Year Level:</strong> {printDisciplinaryRecord.yearLevel || '—'}</p>
                  </div>

                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Incident Classification</p>
                    <p><strong>Offense Type:</strong> <span className="text-red-700 font-bold">{printDisciplinaryRecord.offenseType}</span></p>
                    <p><strong>Sanction Period:</strong> {printDisciplinaryRecord.startDate || 'N/A'} to {printDisciplinaryRecord.completionDate || 'N/A'}</p>
                    <p><strong>Issued By:</strong> {printDisciplinaryRecord.issuedBy}</p>
                  </div>
                </div>

                {/* Incident Description */}
                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Incident Details</p>
                  <p className="text-slate-800 leading-relaxed italic">&quot;{printDisciplinaryRecord.description}&quot;</p>
                </div>

                {/* Imposed Sanctions */}
                <div className="space-y-1 p-3 bg-red-50/60 rounded-xl border border-red-200 text-xs">
                  <p className="font-black text-[10px] uppercase text-red-900 tracking-wider">Official Imposed Sanction</p>
                  <p className="font-bold text-red-900 leading-relaxed">{printDisciplinaryRecord.sanction}</p>
                </div>

                {/* Remarks if any */}
                {printDisciplinaryRecord.remarks && (
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Administrative Remarks</p>
                    <p className="text-slate-800">{printDisciplinaryRecord.remarks}</p>
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="printable-footer-block mt-auto shrink-0 pt-8 border-t border-slate-300">
                <div className="grid grid-cols-2 gap-8 text-center text-xs items-end max-w-md mx-auto">
                  <div className="space-y-4">
                    <div className="border-b border-slate-900 pb-1 font-bold">
                      {printDisciplinaryRecord.studentName}
                    </div>
                    <p className="font-bold text-slate-800 text-[11px] uppercase">
                      Student Signature / Conforme
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="border-b border-slate-900 pb-1 font-bold">
                      Princess Ann T. Ruzol
                    </div>
                    <p className="font-bold text-slate-800 text-[11px] uppercase">
                      OSAS Director / Administrator
                    </p>
                  </div>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* CONFIRM ARCHIVE RECORD MODAL */}
      {confirmArchiveRecord && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmArchiveRecord(null)}
          onConfirm={() => {
            deleteDisciplinaryRecord(confirmArchiveRecord.id, 'Princess Ann T. Ruzol (Admin)');
            setConfirmArchiveRecord(null);
            if (selectedRecord?.id === confirmArchiveRecord.id) {
              setSelectedRecord(null);
            }
            refreshAllData();
          }}
          title="Are you sure you want to delete this?"
          message={`Are you sure you want to delete/archive the disciplinary record for "${confirmArchiveRecord.studentName}"? It will be moved to System Settings > System Archive.`}
          confirmText="Yes"
          cancelText="No"
          type="danger"
        />
      )}
    </div>
  );
};
