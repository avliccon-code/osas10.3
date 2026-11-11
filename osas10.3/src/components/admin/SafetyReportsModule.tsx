import React, { useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
  getDisciplinaryReports,
  getDisciplinaryRecords,
  saveDisciplinaryReportToRecord,
  appendSlipNoticeToReport,
  saveDraftStudentReportActionTaken,
  referStudentReportToOsas,
  saveOsasRemarksOnReport,
  saveStudentReportResolution,
  saveStudentReportEndorsementLetter,
  archiveDisciplinaryReport,
  archiveReportResolution,
  getUsers,
  sendNotification,
  logActivity,
  triggerSuccessTransaction,
  addInterventionRecord,
  referInterventionRecordToGuidance,
  referDisciplinaryReportFromOsas,
  safeLocalStorageSet,
  findUserAsync,
} from '../../services/storage';
import { db } from '../../services/firebase';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import {
  DisciplinaryReport,
  DisciplinaryRecord,
  SlipNotice,
  User as UserType,
  InterventionReasonType,
  EndorsementLetterData,
  ResolutionActionStep,
} from '../../types';
import { DisciplinaryActionForm } from './DisciplinaryActionForm';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  Check,
  Search,
  Eye,
  X,
  FileText,
  AlertOctagon,
  MapPin,
  Calendar,
  User,
  Shield,
  Paperclip,
  MessageSquare,
  FileCheck,
  FileSignature,
  Send,
  Printer,
  Archive,
  ChevronDown,
  ChevronUp,
  HeartHandshake,
  ArrowRight,
  FolderCheck,
  ClipboardCheck,
  Award,
  AlertCircle,
  Plus,
  Trash2,
  Tag,
} from 'lucide-react';
import { CollegeLogo } from '../common/CollegeLogo';

interface SafetyReportsModuleProps {
  role?: 'GUIDANCE_ADMIN' | 'ADMIN';
  currentUser?: UserType | null;
  onCreateDisciplinaryAction?: (report: DisciplinaryReport) => void;
}

const REASON_OPTIONS: InterventionReasonType[] = [
  'Academic Concerns',
  'Behavioral Issues',
  'Mental Health Concerns',
  'Financial Concerns',
  'Family Problems',
  'Substance Use',
  'Attendance/Absenteeism',
  'Peer Conflict',
  'Others',
];

const URGENCY_OPTIONS = [
  'Immediate (safety/high risk concern)',
  'Within 3 days',
  'Within 1 week',
  'For monitoring/consultation',
];

const ATTACHMENT_OPTIONS = [
  'Incident reports',
  'Medical report',
  'Counseling notes',
  'Academic records',
  'Others',
];

const SLIP_PURPOSES = [
  'Counseling',
  'Assessment',
  'Meeting/Conference',
  'Other Services',
];


export const SafetyReportsModule: React.FC<SafetyReportsModuleProps> = ({
  role = 'GUIDANCE_ADMIN',
  currentUser,
  onCreateDisciplinaryAction,
}) => {
  const isReportReferredToOsas = (r?: DisciplinaryReport | null): boolean => {
    if (!r) return false;
    return Boolean(
      r.referredToOsas ||
        r.status === 'REFERRED_TO_OSAS' ||
        r.status === 'OSAS_REMARKS_SAVED' ||
        r.osasReferralDate ||
        (Array.isArray(r.osasReferralReasons) && r.osasReferralReasons.length > 0)
    );
  };

  const sortReportsNewestFirst = (list: DisciplinaryReport[]): DisciplinaryReport[] => {
    const dedupMap = new Map<string, DisciplinaryReport>();
    list.forEach((item) => {
      if (item && item.id) {
        const existing = dedupMap.get(item.id);
        if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) {
          dedupMap.set(item.id, isReportReferredToOsas(item) ? { ...item, referredToOsas: true, isSavedRecord: true } : item);
        }
      }
    });
    return Array.from(dedupMap.values()).sort((a, b) => {
      const timeB = new Date(b.resolvedAt || b.savedToRecordAt || b.submittedAt || 0).getTime();
      const timeA = new Date(a.resolvedAt || a.savedToRecordAt || a.submittedAt || 0).getTime();
      if (timeB !== timeA && !isNaN(timeB) && !isNaN(timeA)) return timeB - timeA;
      return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
    });
  };

  const isOsasAdmin = role === 'ADMIN';
  const [reports, setReports] = useState<DisciplinaryReport[]>(() => sortReportsNewestFirst(getDisciplinaryReports()));
  const [disciplinaryRecords, setDisciplinaryRecords] = useState<DisciplinaryRecord[]>(() => getDisciplinaryRecords());
  const [expandedReportIds, setExpandedReportIds] = useState<Record<string, boolean>>({});
  const [expandedResolutionIds, setExpandedResolutionIds] = useState<Record<string, boolean>>({});

  // Guidance has 3 tabs: 'student_reports', 'student_reports_record', 'report_resolutions'
  const [activeTab, setActiveTab] = useState<'student_reports' | 'student_reports_record' | 'report_resolutions'>('student_reports');

  // OSAS Admin has 3 tabs: 'referred_reports', 'referral_form', and 'guidance_resolutions'
  const [osasActiveTab, setOsasActiveTab] = useState<'referred_reports' | 'referral_form' | 'guidance_resolutions'>('referred_reports');

  const refreshData = () => {
    setReports(sortReportsNewestFirst(getDisciplinaryReports()));
    setDisciplinaryRecords(getDisciplinaryRecords());
  };

  const toggleReportExpanded = (reportId: string) => {
    setExpandedReportIds((prev) => ({
      ...prev,
      [reportId]: !prev[reportId],
    }));
  };

  const toggleResolutionExpanded = (reportId: string) => {
    setExpandedResolutionIds((prev) => ({
      ...prev,
      [reportId]: !prev[reportId],
    }));
  };

  const [archiveResolutionTarget, setArchiveResolutionTarget] = useState<DisciplinaryReport | null>(null);

  const handleArchiveReportResolution = (rep: DisciplinaryReport) => {
    setArchiveResolutionTarget(rep);
  };

  const handleConfirmArchiveResolution = () => {
    if (!archiveResolutionTarget) return;
    const actorName =
      currentUser?.fullName ||
      (isOsasAdmin ? 'OSAS Administrator' : 'Guidance Advocate');
    archiveReportResolution(archiveResolutionTarget.id, actorName);
    setArchiveResolutionTarget(null);
    refreshData();
  };

  useEffect(() => {
    refreshData();
    window.addEventListener('osas_storage_updated', refreshData);
    window.addEventListener('storage', refreshData);

    let unsubStore: (() => void) | null = null;
    let unsubColl: (() => void) | null = null;

    const mergeReportItems = (
      existing: DisciplinaryReport | undefined,
      remote: DisciplinaryReport
    ): DisciplinaryReport => {
      if (!existing) {
        const hasRes = Boolean(
          remote.resolvedAt && remote.resolutionDetails && remote.resolutionDetails.trim()
        );
        const hasRem = Boolean(remote.osasRemarks && remote.osasRemarks.trim());
        if (hasRes && hasRem) {
          return { ...remote, resolutionOutcome: 'RESOLVED', status: 'RESOLVED' };
        }
        return remote;
      }

      const isRemoteNewer = (remote.updatedAt || 0) >= (existing.updatedAt || 0);
      const merged: DisciplinaryReport = isRemoteNewer
        ? { ...existing, ...remote }
        : { ...remote, ...existing };

      const existingSlips = Array.isArray(existing.slipNotices) ? existing.slipNotices : [];
      const remoteSlips = Array.isArray(remote.slipNotices) ? remote.slipNotices : [];
      if (existingSlips.length > 0 || remoteSlips.length > 0) {
        const slipMap = new Map<string, SlipNotice>();
        [...remoteSlips, ...existingSlips].forEach((s) => {
          if (s && typeof s === 'object') {
            const sKey = s.id || `${s.counselorTitle}-${s.dateSent}-${s.visitDate}-${s.visitTime}`;
            if (!slipMap.has(sKey)) {
              slipMap.set(sKey, s);
            }
          }
        });
        merged.slipNotices = Array.from(slipMap.values());
      }

      const hasRemoteRemarks = Boolean(remote.osasRemarks && remote.osasRemarks.trim());
      const hasExistingRemarks = Boolean(existing.osasRemarks && existing.osasRemarks.trim());
      if (hasRemoteRemarks || hasExistingRemarks) {
        const remarksSrc = hasRemoteRemarks ? remote : existing;
        merged.osasRemarks = remarksSrc.osasRemarks?.trim();
        merged.osasRemarksBy = remarksSrc.osasRemarksBy || merged.osasRemarksBy;
        merged.osasRemarksSavedAt = remarksSrc.osasRemarksSavedAt || merged.osasRemarksSavedAt;
      }

      if (remote.endorsementLetter || existing.endorsementLetter) {
        merged.endorsementLetter = remote.endorsementLetter || existing.endorsementLetter;
      }

      if (
        remote.disciplinaryRecordId ||
        existing.disciplinaryRecordId ||
        remote.linkedRecordId ||
        existing.linkedRecordId
      ) {
        const linkedId =
          remote.disciplinaryRecordId ||
          existing.disciplinaryRecordId ||
          remote.linkedRecordId ||
          existing.linkedRecordId;
        merged.disciplinaryRecordId = linkedId;
        merged.linkedRecordId = linkedId;
        merged.isSavedRecord = true;
      }

      if (isReportReferredToOsas(remote) || isReportReferredToOsas(existing)) {
        const refSrc = isReportReferredToOsas(remote) ? remote : existing;
        merged.referredToOsas = true;
        merged.isSavedRecord = true;
        merged.osasReferralDate = refSrc.osasReferralDate || merged.osasReferralDate;
        merged.osasReferralBy = refSrc.osasReferralBy || merged.osasReferralBy;
        merged.osasReferralDesignation = refSrc.osasReferralDesignation || merged.osasReferralDesignation;
        merged.osasReferralReasons =
          (Array.isArray(refSrc.osasReferralReasons) && refSrc.osasReferralReasons.length > 0
            ? refSrc.osasReferralReasons
            : merged.osasReferralReasons) || ['Referred by Guidance Advocate'];
        merged.osasReferralReasonsOther = refSrc.osasReferralReasonsOther || merged.osasReferralReasonsOther;
        merged.osasReferralDescription =
          refSrc.osasReferralDescription || merged.osasReferralDescription || merged.description;
        merged.osasReferralFollowUpDate = refSrc.osasReferralFollowUpDate || merged.osasReferralFollowUpDate;
        merged.osasReferralResponsibleParties =
          refSrc.osasReferralResponsibleParties || merged.osasReferralResponsibleParties;
        merged.osasReferralCaseStatus =
          refSrc.osasReferralCaseStatus || merged.osasReferralCaseStatus || 'REFERRED';
        merged.osasReferralNextSteps = refSrc.osasReferralNextSteps || merged.osasReferralNextSteps;
        merged.osasReferralRecommendedDesignation =
          refSrc.osasReferralRecommendedDesignation ||
          merged.osasReferralRecommendedDesignation ||
          'Office of Student Affairs and Services (OSAS)';
        merged.osasReferralUrgency =
          refSrc.osasReferralUrgency || merged.osasReferralUrgency || 'Within 3 days';
        merged.osasReferralAttachmentsType =
          refSrc.osasReferralAttachmentsType ||
          merged.osasReferralAttachmentsType ||
          'Incident reports';
        merged.osasReferralAttachmentsOther =
          refSrc.osasReferralAttachmentsOther || merged.osasReferralAttachmentsOther;
        merged.osasReferralActionTakenSummary =
          refSrc.osasReferralActionTakenSummary || merged.osasReferralActionTakenSummary;
        merged.osasApprovalName = refSrc.osasApprovalName || merged.osasApprovalName;
        merged.osasApprovedByDesignation =
          refSrc.osasApprovedByDesignation || merged.osasApprovedByDesignation || 'Guidance Advocate';
        merged.osasReceivingUnit =
          refSrc.osasReceivingUnit || merged.osasReceivingUnit || 'OSAS Administrator';
      }

      const hasRemoteRes = Boolean(
        remote.resolvedAt && remote.resolutionDetails && remote.resolutionDetails.trim()
      );
      const hasExistingRes = Boolean(
        existing.resolvedAt && existing.resolutionDetails && existing.resolutionDetails.trim()
      );
      if (hasRemoteRes || hasExistingRes) {
        const resSrc = hasRemoteRes ? remote : existing;
        merged.resolvedAt = resSrc.resolvedAt || merged.resolvedAt;
        merged.resolvedBy = resSrc.resolvedBy || merged.resolvedBy;
        merged.resolutionDetails = resSrc.resolutionDetails?.trim();
        merged.resolutionOutcome = resSrc.resolutionOutcome || merged.resolutionOutcome;
        merged.resolutionActionTaken = resSrc.resolutionActionTaken || merged.resolutionActionTaken;
        merged.resolutionActionSteps = resSrc.resolutionActionSteps || merged.resolutionActionSteps;
        merged.problemResolved = resSrc.problemResolved || merged.problemResolved;
      }

      const hasResolution = Boolean(
        merged.resolvedAt && merged.resolutionDetails && merged.resolutionDetails.trim()
      );
      const hasFinalRemarks = Boolean(merged.osasRemarks && merged.osasRemarks.trim());
      if (hasResolution && hasFinalRemarks) {
        merged.resolutionOutcome = 'RESOLVED';
        merged.status = 'RESOLVED';
      }

      return merged;
    };

    try {
      const storeDocRef = doc(db, 'osas_store', 'osas_disciplinary_reports');
      unsubStore = onSnapshot(
        storeDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data && Array.isArray(data.value)) {
              setReports((prev) => {
                const map = new Map<string, DisciplinaryReport>();
                prev.forEach((r) => map.set(r.id, r));
                (data.value as DisciplinaryReport[]).forEach((remote) => {
                  if (remote && remote.id) {
                    const existing = map.get(remote.id);
                    map.set(remote.id, mergeReportItems(existing, remote));
                  }
                });
                const sorted = sortReportsNewestFirst(Array.from(map.values()));
                safeLocalStorageSet('osas_disciplinary_reports', JSON.stringify(sorted));
                return sorted;
              });
            }
          }
        },
        () => {}
      );

      const collRef = collection(db, 'disciplinary_reports');
      unsubColl = onSnapshot(
        collRef,
        (snap) => {
          if (!snap.empty) {
            setReports((prev) => {
              const map = new Map<string, DisciplinaryReport>();
              prev.forEach((r) => map.set(r.id, r));
              snap.docs.forEach((d) => {
                const remote = d.data() as DisciplinaryReport;
                if (remote && remote.id) {
                  const existing = map.get(remote.id);
                  map.set(remote.id, mergeReportItems(existing, remote));
                }
              });
              const sorted = sortReportsNewestFirst(Array.from(map.values()));
              safeLocalStorageSet('osas_disciplinary_reports', JSON.stringify(sorted));
              return sorted;
            });
          }
        },
        () => {}
      );
      const discCollRef = collection(db, 'disciplinary_records');
      const unsubDiscColl = onSnapshot(
        discCollRef,
        (snap) => {
          if (!snap.empty) {
            setDisciplinaryRecords((prev) => {
              const map = new Map<string, DisciplinaryRecord>();
              prev.forEach((r) => {
                if (r && r.id) map.set(r.id, r);
              });
              snap.docs.forEach((d) => {
                const remote = d.data() as DisciplinaryRecord;
                if (remote && remote.id) {
                  const existing = map.get(remote.id);
                  map.set(remote.id, existing ? { ...existing, ...remote } : remote);
                }
              });
              const updatedList = Array.from(map.values());
              safeLocalStorageSet('osas_disciplinary', JSON.stringify(updatedList));
              return updatedList;
            });
          }
        },
        () => {}
      );

      const discStoreRef = doc(db, 'osas_store', 'osas_disciplinary');
      const unsubDiscStore = onSnapshot(
        discStoreRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data && Array.isArray(data.value)) {
              setDisciplinaryRecords((prev) => {
                const map = new Map<string, DisciplinaryRecord>();
                prev.forEach((r) => {
                  if (r && r.id) map.set(r.id, r);
                });
                (data.value as DisciplinaryRecord[]).forEach((remote) => {
                  if (remote && remote.id) {
                    const existing = map.get(remote.id);
                    map.set(remote.id, existing ? { ...existing, ...remote } : remote);
                  }
                });
                const updatedList = Array.from(map.values());
                safeLocalStorageSet('osas_disciplinary', JSON.stringify(updatedList));
                return updatedList;
              });
            }
          }
        },
        () => {}
      );

      return () => {
        window.removeEventListener('osas_storage_updated', refreshData);
        window.removeEventListener('storage', refreshData);
        if (unsubStore) unsubStore();
        if (unsubColl) unsubColl();
        unsubDiscColl();
        unsubDiscStore();
      };
    } catch (_) {}

    return () => {
      window.removeEventListener('osas_storage_updated', refreshData);
      window.removeEventListener('storage', refreshData);
      if (unsubStore) unsubStore();
      if (unsubColl) unsubColl();
    };
  }, []);

  const isReportSavedToRecord = (rep: DisciplinaryReport): boolean => {
    return Boolean(
      rep.isSavedRecord ||
        rep.referredToOsas ||
        rep.resolutionDetails ||
        rep.endorsementLetter ||
        rep.disciplinaryRecordId ||
        rep.linkedRecordId ||
        (rep.slipNotices && rep.slipNotices.length > 0) ||
        rep.status !== 'SUBMITTED'
    );
  };

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modal 1: Create Report (for incoming Student Reports tab)
  const [createReportTarget, setCreateReportTarget] = useState<DisciplinaryReport | null>(null);

  // Modal 2: View Complete Saved Record Details (for Student Reports Record / OSAS Refer Student Reports)
  const [viewRecordTarget, setViewRecordTarget] = useState<DisciplinaryReport | null>(null);

  // Modal 3: Send Slip Notice Modal State (Requirement 3)
  const [isSlipNoticeModalOpen, setIsSlipNoticeModalOpen] = useState(false);
  const [slipReport, setSlipReport] = useState<DisciplinaryReport | null>(null);
  const [slipDateSent, setSlipDateSent] = useState(() => new Date().toISOString().split('T')[0]);
  const [slipStudentName, setSlipStudentName] = useState('');
  const [slipStudentId, setSlipStudentId] = useState('');
  const [slipCourseYear, setSlipCourseYear] = useState('');
  const [slipContactNumber, setSlipContactNumber] = useState('');
  const [slipVisitDate, setSlipVisitDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [slipVisitTime24, setSlipVisitTime24] = useState('10:00');
  const [slipPurposes, setSlipPurposes] = useState<string[]>([]);
  const [slipError, setSlipError] = useState('');
  const [slipOtherService, setSlipOtherService] = useState('');
  const [slipAdvocateName, setSlipAdvocateName] = useState('Maria Mel B. Glemao');
  const [slipNotes, setSlipNotes] = useState('');
  const [allRegisteredStudents, setAllRegisteredStudents] = useState<UserType[]>([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // Modal 4: Refer to OSAS Office Modal State
  const [referModalReport, setReferModalReport] = useState<DisciplinaryReport | null>(null);
  const [refReasonText, setRefReasonText] = useState('');
  const [refDescription, setRefDescription] = useState('');
  const [refFormError, setRefFormError] = useState('');

  // OSAS Admin Tab 2: Referral Form State
  // 1. Student Information (student making/submitting report)
  const [formIsAnonymous, setFormIsAnonymous] = useState(false);
  const [formStudentSearch, setFormStudentSearch] = useState('');
  const [showFormStudentSuggestions, setShowFormStudentSuggestions] = useState(false);
  const [formStudentId, setFormStudentId] = useState('');
  const [formStudentName, setFormStudentName] = useState('');
  const [formAcademicProgram, setFormAcademicProgram] = useState('');
  const [formYearLevel, setFormYearLevel] = useState('');
  const [formContactNumber, setFormContactNumber] = useState('');
  const [formAddress, setFormAddress] = useState('');

  // 2. Reported Student Information (the student being reported)
  const [formReportedStudentSearch, setFormReportedStudentSearch] = useState('');
  const [showFormReportedStudentSuggestions, setShowFormReportedStudentSuggestions] = useState(false);
  const [formReportedStudentId, setFormReportedStudentId] = useState('');
  const [formReportedStudentName, setFormReportedStudentName] = useState('');
  const [formReportedAcademicProgram, setFormReportedAcademicProgram] = useState('');
  const [formReportedYearLevel, setFormReportedYearLevel] = useState('');
  const [formReportedContactNumber, setFormReportedContactNumber] = useState('');
  const [formReportedAddress, setFormReportedAddress] = useState('');

  // 3. Description & 4. Reason for Referral
  const [formReasonText, setFormReasonText] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubmitSuccess, setFormSubmitSuccess] = useState(false);
  const [formErrorMsg, setFormErrorMsg] = useState('');

  // Modal 5: OSAS Remarks Modal / Inline State (Requirement 5)
  const [osasRemarksTarget, setOsasRemarksTarget] = useState<DisciplinaryReport | null>(null);
  const [osasRemarksInput, setOsasRemarksInput] = useState('');

  // Modal 6: Create Resolution Modal State
  const [resolutionTarget, setResolutionTarget] = useState<DisciplinaryReport | null>(null);
  const [resProblemResolved, setResProblemResolved] = useState('');
  const [resActionSteps, setResActionSteps] = useState<ResolutionActionStep[]>([
    {
      stepNumber: 1,
      stepTitle: '',
      dateTime: new Date().toISOString().slice(0, 16),
      actionTaken: '',
      personInvolved: 'Guidance Advocate',
    },
  ]);
  const [resolutionOutcome, setResolutionOutcome] = useState<'RESOLVED' | 'UNRESOLVED'>('RESOLVED');
  const [resolutionActionTaken, setResolutionActionTaken] = useState('');
  const [resolutionDetails, setResolutionDetails] = useState('');
  const [resolutionError, setResolutionError] = useState('');

  // Modal 7: Create Endorsement Letter Modal State & Print State (Requirement 6 & 7)
  const [endorsementTarget, setEndorsementTarget] = useState<DisciplinaryReport | null>(null);
  const [endHigherOfficerName, setEndHigherOfficerName] = useState('');
  const [endHigherOfficerTitle, setEndHigherOfficerTitle] = useState('');
  const [endInstitutionName, setEndInstitutionName] = useState('');
  const [endInstitutionLocation, setEndInstitutionLocation] = useState('');
  const [endSubject, setEndSubject] = useState('');
  const [endCaseBackground, setEndCaseBackground] = useState('');
  const [endActionsTaken, setEndActionsTaken] = useState('Princess Ann T. Ruzol');
  const [endReasonForEndorsement, setEndReasonForEndorsement] = useState('');
  const [endRecommendation, setEndRecommendation] = useState('');
  const [endEndorsedByName, setEndEndorsedByName] = useState('Cristy C. Domingo');
  const [endEndorsedByTitle, setEndEndorsedByTitle] = useState('College President');
  const [endNotedByName, setEndNotedByName] = useState('Maria Mel B. Glemao');
  const [endNotedByTitle, setEndNotedByTitle] = useState('Guidance Advocate');
  const [endError, setEndError] = useState('');
  const [printEndorsementReport, setPrintEndorsementReport] = useState<DisciplinaryReport | null>(null);
  const [printResolutionReport, setPrintResolutionReport] = useState<DisciplinaryReport | null>(null);

  // Modal 8: Disciplinary Action Form for Severe Cases (Requirement 2 & 7)
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);
  const [recordTargetReport, setRecordTargetReport] = useState<DisciplinaryReport | null>(null);

  // Evidence Preview Lightbox
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const studs = getUsers().filter((u) => u.role === 'STUDENT');
      setAllRegisteredStudents(studs);
    } catch {
      setAllRegisteredStudents([]);
    }
  }, [isSlipNoticeModalOpen, referModalReport, osasActiveTab]);

  const handleDirectPrintResolution = (rep: DisciplinaryReport) => {
    flushSync(() => {
      setPrintEndorsementReport(null);
      setPrintResolutionReport(rep);
    });
    const cleanup = () => {
      setPrintResolutionReport(null);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const handleDirectPrintEndorsement = (rep: DisciplinaryReport) => {
    flushSync(() => {
      setPrintResolutionReport(null);
      setPrintEndorsementReport(rep);
    });
    const cleanup = () => {
      setPrintEndorsementReport(null);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const getCleanResolutionDetails = (rep: DisciplinaryReport): string => {
    let details = (rep.resolutionDetails || '').trim();
    if (!details) return '';
    if (rep.osasRemarks) {
      const escapedRemarks = rep.osasRemarks.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const prefixRegex = new RegExp(
        `^Following OSAS intervention\\s*\\(${escapedRemarks}\\),?\\s*`,
        'i'
      );
      details = details.replace(prefixRegex, '');
    }
    return details.trim();
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

  const formatReportDateTime = (rep: DisciplinaryReport): string => {
    let datePart = rep.reportDate?.trim() || '';
    let timePart = rep.reportTime?.trim() || '';
    if (!datePart || !timePart) {
      const dt = new Date(rep.submittedAt || Date.now());
      if (!isNaN(dt.getTime())) {
        if (!datePart) datePart = dt.toLocaleDateString();
        if (!timePart) timePart = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    if (datePart && timePart) {
      return `${datePart} • ${timePart}`;
    }
    return datePart || timePart || new Date().toLocaleString();
  };

  // Filtered lists (exclude archived records and keep newest first)
  const incomingReports = useMemo(
    () =>
      sortReportsNewestFirst(
        reports.filter((r) => !r.isArchived && !isReportSavedToRecord(r))
      ),
    [reports]
  );

  const isResolutionSaved = (r: DisciplinaryReport): boolean => {
    return Boolean(
      r.resolvedAt &&
        r.resolutionDetails &&
        r.resolutionDetails.trim()
    );
  };

  const isReportCaseResolved = (r: DisciplinaryReport): boolean => {
    const hasOsasRemarks = Boolean(r.osasRemarks && r.osasRemarks.trim());
    if (hasOsasRemarks) {
      return true;
    }
    if (r.resolutionOutcome === 'UNRESOLVED' || r.status === 'UNRESOLVED') {
      return false;
    }
    return r.resolutionOutcome === 'RESOLVED' || r.status === 'RESOLVED';
  };

  // Saved Guidance resolutions go only to Report Resolutions, not the student's report record
  const resolvedReports = useMemo(
    () =>
      sortReportsNewestFirst(
        reports.filter(
          (r) =>
            !r.isArchived &&
            !r.isResolutionArchived &&
            isResolutionSaved(r)
        )
      ),
    [reports]
  );

  const getLinkedDisciplinaryRecord = (rep: DisciplinaryReport): DisciplinaryRecord | undefined => {
    if (!rep || !rep.id) return undefined;
    const targetRecordId = (rep.disciplinaryRecordId || rep.linkedRecordId || '').trim();
    const lastSlip = Array.isArray(rep.slipNotices) && rep.slipNotices.length > 0 ? rep.slipNotices[0] : undefined;
    const reportStudentId = (rep.reportedStudentId || lastSlip?.studentId || '').trim().toLowerCase();

    return disciplinaryRecords.find((rec) => {
      if (!rec || rec.isArchived) return false;
      const recStudentId = (rec.studentId || '').trim().toLowerCase();
      const studentIdMatches = !reportStudentId || !recStudentId || recStudentId === reportStudentId;

      if (rec.reportId && rec.reportId === rep.id && studentIdMatches) {
        return true;
      }
      if (targetRecordId && rec.id === targetRecordId && studentIdMatches) {
        return true;
      }
      return false;
    });
  };

  const hasDisciplinaryActionForReport = (rep: DisciplinaryReport): boolean => {
    return Boolean(getLinkedDisciplinaryRecord(rep) || rep.disciplinaryRecordId || rep.linkedRecordId);
  };

  const savedRecordReports = useMemo(
    () =>
      sortReportsNewestFirst(
        reports.filter(
          (r) =>
            !r.isArchived &&
            isReportSavedToRecord(r) &&
            !isResolutionSaved(r)
        )
      ),
    [reports]
  );

  const osasReferredReports = useMemo(
    () =>
      sortReportsNewestFirst(
        reports.filter((r) => !r.isArchived && isReportReferredToOsas(r))
      ),
    [reports]
  );

  // Display all saved Guidance resolutions from Firestore
  const osasGuidanceResolutions = useMemo(
    () =>
      sortReportsNewestFirst(
        reports.filter(
          (r) =>
            !r.isArchived &&
            !r.isResolutionArchived &&
            isResolutionSaved(r)
        )
      ),
    [reports]
  );

  const displayedReports = useMemo(() => {
    const baseList = isOsasAdmin
      ? osasActiveTab === 'guidance_resolutions'
        ? osasGuidanceResolutions
        : osasReferredReports
      : activeTab === 'student_reports'
      ? incomingReports
      : activeTab === 'report_resolutions'
      ? resolvedReports
      : savedRecordReports;

    if (!searchQuery.trim()) return baseList;
    const q = searchQuery.toLowerCase();
    return baseList.filter(
      (rep) =>
        rep.id.toLowerCase().includes(q) ||
        rep.reportedStudentName.toLowerCase().includes(q) ||
        (rep.reportedStudentId && rep.reportedStudentId.toLowerCase().includes(q)) ||
        rep.location.toLowerCase().includes(q) ||
        rep.description.toLowerCase().includes(q) ||
        (!rep.isAnonymousReporter && rep.reporterName.toLowerCase().includes(q)) ||
        (rep.problemResolved && rep.problemResolved.toLowerCase().includes(q))
    );
  }, [
    isOsasAdmin,
    osasActiveTab,
    activeTab,
    incomingReports,
    savedRecordReports,
    resolvedReports,
    osasReferredReports,
    osasGuidanceResolutions,
    searchQuery,
  ]);

  // --- HANDLERS ---

  // 1. Save Report Records (moves/links same Firestore record to Student Reports Record)
  const handleSaveReportToRecords = (rep: DisciplinaryReport) => {
    const actorName = currentUser?.fullName || 'Maria Mel B. Glemao (Guidance Advocate)';
    saveDisciplinaryReportToRecord(rep.id, actorName);
    setCreateReportTarget(null);
    refreshData();
    setActiveTab('student_reports_record');
  };

  // 2. Open Send Slip Notice Modal (Requirement 3: Dear selectable/typeable with X clear button; student info/contact fields use placeholder ONLY with no default values)
  const handleOpenSendSlipNotice = (rep?: DisciplinaryReport | null) => {
    const target = rep || viewRecordTarget || createReportTarget;
    setSlipReport(target || null);
    setSlipDateSent(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setSlipVisitDate(d.toISOString().split('T')[0]);
    setSlipVisitTime24('10:00');
    setSlipPurposes([]);
    setSlipOtherService('');
    setSlipError('');
    setSlipAdvocateName(
      isOsasAdmin
        ? currentUser?.fullName || 'Princess Ann T. Ruzol'
        : currentUser?.fullName || 'Maria Mel B. Glemao'
    );
    setSlipNotes('');
    setShowStudentDropdown(false);

    // Automatically retrieve and display the Reported Student's Full Name, Student ID, Course & Level, and Contact Number
    const lastSlip =
      target?.slipNotices && target.slipNotices.length > 0
        ? target.slipNotices[0]
        : undefined;

    const rawReportedName =
      target &&
      target.reportedStudentName &&
      target.reportedStudentName !== 'Unspecified Student / General Report'
        ? target.reportedStudentName.trim()
        : lastSlip?.studentName?.trim() || (target as any)?.studentName?.trim() || '';

    const parenMatch = rawReportedName.match(/^(.+?)\s*\(([^)]+)\)$/);
    const reportedFullName = parenMatch ? parenMatch[1].trim() : rawReportedName;
    const embeddedId = parenMatch ? parenMatch[2].trim() : '';

    const candidateId = (
      target?.reportedStudentId ||
      (target as any)?.studentId ||
      lastSlip?.studentId ||
      embeddedId ||
      ''
    ).trim();

    // Fetch student registered list
    const studs = getUsers().filter((u) => u.role === 'STUDENT' || Boolean(u.studentId));
    setAllRegisteredStudents(studs);

    const matchedById = candidateId
      ? studs.find(
          (s) =>
            (s.studentId && s.studentId.toLowerCase().trim() === candidateId.toLowerCase()) ||
            (s.id && s.id.toLowerCase().trim() === candidateId.toLowerCase())
        )
      : undefined;

    const matchedByName =
      !matchedById && reportedFullName
        ? studs.find((s) => {
            const full = (
              s.fullName ||
              [s.firstName, s.middleName, s.surname, s.extensionName].filter(Boolean).join(' ')
            )
              .toLowerCase()
              .trim();
            const firstLast = [s.firstName, s.surname].filter(Boolean).join(' ').toLowerCase().trim();
            const q = reportedFullName.toLowerCase().trim();
            return full === q || (firstLast && firstLast === q);
          })
        : undefined;

    const matched = matchedById || matchedByName;

    const constructedMatchedName = matched
      ? matched.fullName ||
        [matched.firstName, matched.middleName, matched.surname, matched.extensionName]
          .filter(Boolean)
          .join(' ')
      : '';

    const fetchedName = constructedMatchedName || reportedFullName;
    const fetchedId = matched?.studentId || candidateId || matched?.id || '';
    const fetchedCourse =
      matched?.academicProgram || matched?.course
        ? `${matched.academicProgram || matched.course}${matched.yearLevel ? ` - ${matched.yearLevel}` : ''}`
        : target?.reportedStudentCourse
        ? `${target.reportedStudentCourse}${target.reportedStudentYearLevel ? ` - ${target.reportedStudentYearLevel}` : ''}`
        : lastSlip?.course
        ? `${lastSlip.course}${lastSlip.yearLevel ? ` - ${lastSlip.yearLevel}` : ''}`
        : '';
    const fetchedContact =
      matched?.contactNumber ||
      (matched as any)?.phoneNumber ||
      target?.reportedStudentContact ||
      (target as any)?.contactNumber ||
      lastSlip?.contactNumber ||
      '';

    setSlipStudentName(fetchedName);
    setSlipStudentId(fetchedId);
    setSlipCourseYear(fetchedCourse);
    setSlipContactNumber(fetchedContact);

    if (fetchedId || fetchedName) {
      findUserAsync(fetchedId || fetchedName, fetchedName)
        .then((remoteStudent) => {
          if (remoteStudent && (remoteStudent.role === 'STUDENT' || Boolean(remoteStudent.studentId))) {
            const remoteFullName =
              remoteStudent.fullName ||
              [
                remoteStudent.firstName,
                remoteStudent.middleName,
                remoteStudent.surname,
                remoteStudent.extensionName,
              ]
                .filter(Boolean)
                .join(' ') ||
              fetchedName;
            setSlipStudentName(remoteFullName);
            setSlipStudentId(remoteStudent.studentId || remoteStudent.id || fetchedId);
            setSlipCourseYear(
              remoteStudent.academicProgram || remoteStudent.course
                ? `${remoteStudent.academicProgram || remoteStudent.course}${
                    remoteStudent.yearLevel ? ` - ${remoteStudent.yearLevel}` : ''
                  }`
                : fetchedCourse
            );
            setSlipContactNumber(
              remoteStudent.contactNumber ||
                (remoteStudent as any).phoneNumber ||
                fetchedContact
            );
          }
        })
        .catch(() => {});
    }

    setIsSlipNoticeModalOpen(true);
  };

  const handleSelectStudentForSlip = (student: UserType) => {
    const selectedName = student.fullName || '';
    const selectedId = student.studentId || student.id || '';
    const selectedCourseYear =
      student.academicProgram || student.course
        ? `${student.academicProgram || student.course}${student.yearLevel ? ` - ${student.yearLevel}` : ''}`
        : '';
    const selectedContact = student.contactNumber || (student as any).phoneNumber || '';

    setSlipStudentName(selectedName);
    setSlipStudentId(selectedId);
    setSlipCourseYear(selectedCourseYear);
    setSlipContactNumber(selectedContact);
    setShowStudentDropdown(false);

    if (selectedId || selectedName) {
      findUserAsync(selectedId || selectedName, selectedName)
        .then((remoteStudent) => {
          if (remoteStudent && remoteStudent.role === 'STUDENT') {
            setSlipStudentName(remoteStudent.fullName || selectedName);
            setSlipStudentId(remoteStudent.studentId || remoteStudent.id || selectedId);
            setSlipCourseYear(
              remoteStudent.academicProgram || remoteStudent.course
                ? `${remoteStudent.academicProgram || remoteStudent.course}${
                    remoteStudent.yearLevel ? ` - ${remoteStudent.yearLevel}` : ''
                  }`
                : selectedCourseYear
            );
            setSlipContactNumber(
              remoteStudent.contactNumber ||
                (remoteStudent as any).phoneNumber ||
                selectedContact
            );
          }
        })
        .catch(() => {});
    }
  };

  const handleClearSlipStudentName = () => {
    setSlipStudentName('');
    setSlipStudentId('');
    setSlipCourseYear('');
    setSlipContactNumber('');
    setShowStudentDropdown(false);
  };

  const handleTogglePurpose = (purpose: string) => {
    setSlipError('');
    setSlipPurposes((prev) =>
      prev.includes(purpose) ? prev.filter((p) => p !== purpose) : [...prev, purpose]
    );
  };

  const handleSendSlipNotice = () => {
    if (!slipStudentName.trim()) {
      setSlipError('Student Full Name is required.');
      return;
    }

    if (slipPurposes.length === 0) {
      setSlipError('Please select at least one purpose under "For:" before sending the slip notice.');
      return;
    }

    setSlipError('');

    const formattedVisitTime = formatTime12h(slipVisitTime24);
    const slipId = `slip-${Date.now()}`;
    const counselorTitle = isOsasAdmin ? 'OSAS Administrator' : 'Guidance Advocate';
    const counselorName =
      slipAdvocateName.trim() ||
      (isOsasAdmin
        ? (currentUser?.fullName || 'Princess Ann T. Ruzol')
        : (currentUser?.fullName || 'Maria Mel B. Glemao'));

    const formattedPurposes = slipPurposes.map((p) =>
      (p === 'Other Services' || p === 'Others') && slipOtherService.trim()
        ? `Other Services: ${slipOtherService.trim()}`
        : p
    );

    const studentPool = [
      ...allRegisteredStudents,
      ...getUsers().filter((u) => u.role === 'STUDENT'),
    ];
    const normSlipId = slipStudentId.trim().toLowerCase();
    const normSlipName = slipStudentName.trim().toLowerCase();

    const matched =
      (normSlipId
        ? studentPool.find(
            (u) =>
              (u.studentId && u.studentId.trim().toLowerCase() === normSlipId) ||
              (u.id && u.id.trim().toLowerCase() === normSlipId)
          )
        : undefined) ||
      (normSlipName
        ? studentPool.find(
            (u) => u.fullName && u.fullName.trim().toLowerCase() === normSlipName
          )
        : undefined);

    const resolvedStudentId = (matched?.studentId || slipStudentId.trim() || matched?.id || '').trim();
    const resolvedStudentName = (matched?.fullName || slipStudentName.trim()).trim();

    const slipData: SlipNotice = {
      id: slipId,
      reportId: slipReport?.id,
      dateSent: slipDateSent,
      studentId: resolvedStudentId || undefined,
      studentName: resolvedStudentName,
      course: slipCourseYear.trim() || matched?.academicProgram || matched?.course || undefined,
      yearLevel: matched?.yearLevel || undefined,
      contactNumber: slipContactNumber.trim() || matched?.contactNumber || undefined,
      visitDate: slipVisitDate,
      visitTime: formattedVisitTime,
      purposes: formattedPurposes,
      counselorName,
      counselorTitle,
      notes: slipNotes.trim() || undefined,
    };

    const targetUserId = resolvedStudentId || `STUDENT_EXACT:${resolvedStudentName.toLowerCase()}`;

    const notifTitle = isOsasAdmin ? 'Official OSAS Slip Notice' : 'Official Guidance Slip Notice';
    const officeName = isOsasAdmin ? 'Office of Student Affairs and Services (OSAS)' : 'Guidance and Counseling Office';

    sendNotification(
      targetUserId,
      notifTitle,
      `Dear ${resolvedStudentName}, kindly visit me at the ${officeName} on ${slipVisitDate} at ${formattedVisitTime} for ${formattedPurposes.join(', ')}.`,
      'SLIP_NOTICE',
      undefined,
      undefined,
      undefined,
      slipData
    );

    if (slipReport) {
      const updatedWithSlip = appendSlipNoticeToReport(slipReport.id, slipData, slipAdvocateName);
      if (updatedWithSlip && viewRecordTarget && viewRecordTarget.id === updatedWithSlip.id) {
        setViewRecordTarget(updatedWithSlip);
      }
    }

    logActivity(
      'Send Slip Notice',
      isOsasAdmin ? 'Refer Student Reports' : 'Student Reports',
      slipAdvocateName,
      `Issued Slip Notice #${slipId} to ${slipStudentName} for visit on ${slipVisitDate} at ${formattedVisitTime}.`
    );

    triggerSuccessTransaction(
      'Slip Notice Sent',
      `Matagumpay na naipadala ang Call Slip Notice kay ${slipStudentName}. Makakatanggap ang mag-aaral ng notification.`
    );

    setIsSlipNoticeModalOpen(false);
    refreshData();
  };

  // 3. Open Refer to OSAS Modal
  const handleOpenReferModal = (rep: DisciplinaryReport) => {
    setReferModalReport(rep);
    setRefFormError('');
    setRefReasonText('');
    setRefDescription(rep.description || '');
  };

  const handleSubmitReferralToOsas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referModalReport) return;
    setRefFormError('');

    if (!refReasonText.trim()) {
      setRefFormError('Please enter the reason for referral.');
      return;
    }
    if (!refDescription.trim()) {
      setRefFormError('Please provide description/concerns.');
      return;
    }

    const actor = currentUser?.fullName || 'Maria Mel B. Glemao (Guidance Advocate)';
    const updated = referStudentReportToOsas(
      referModalReport.id,
      {
        reportedStudentId: referModalReport.reportedStudentId,
        reportedStudentName: referModalReport.reportedStudentName,
        reportedStudentCourse: referModalReport.reportedStudentCourse,
        reportedStudentYearLevel: referModalReport.reportedStudentYearLevel,
        reportedStudentContact: referModalReport.reportedStudentContact || referModalReport.contactNumber,
        osasReferralReasons: [refReasonText.trim()],
        osasReferralDescription: refDescription.trim(),
        resolutionActionTaken:
          resolutionActionTaken !== undefined && resolutionActionTaken !== ''
            ? resolutionActionTaken
            : referModalReport.resolutionActionTaken,
        problemResolved:
          resProblemResolved !== undefined && resProblemResolved !== ''
            ? resProblemResolved
            : referModalReport.problemResolved,
      },
      actor
    );

    if (updated && viewRecordTarget && viewRecordTarget.id === updated.id) {
      setViewRecordTarget(updated);
    }
    setReferModalReport(null);
    refreshData();
  };

  const handleSelectStudentForOsasForm = (st: UserType) => {
    setFormStudentSearch(`${st.fullName} (${st.studentId || st.id})`);
    setFormStudentId(st.studentId || st.id);
    setFormStudentName(st.fullName);
    setFormAcademicProgram(st.academicProgram || st.course || 'BS Information Technology');
    setFormYearLevel(st.yearLevel || '');
    setFormContactNumber(st.contactNumber || (st as any).phoneNumber || '');
    setFormAddress(st.permanentAddress || st.address || 'Dingalan, Aurora');
    setShowFormStudentSuggestions(false);
    setFormErrorMsg('');
  };

  const handleClearStudentForOsasForm = () => {
    setFormStudentSearch('');
    setFormStudentId('');
    setFormStudentName('');
    setFormAcademicProgram('');
    setFormYearLevel('');
    setFormContactNumber('');
    setFormAddress('');
    setShowFormStudentSuggestions(false);
  };

  const handleSelectReportedStudentForOsasForm = (st: UserType) => {
    setFormReportedStudentSearch(`${st.fullName} (${st.studentId || st.id})`);
    setFormReportedStudentId(st.studentId || st.id);
    setFormReportedStudentName(st.fullName);
    setFormReportedAcademicProgram(st.academicProgram || st.course || 'BS Information Technology');
    setFormReportedYearLevel(st.yearLevel || '');
    setFormReportedContactNumber(st.contactNumber || (st as any).phoneNumber || '');
    setFormReportedAddress(st.permanentAddress || st.address || 'Dingalan, Aurora');
    setShowFormReportedStudentSuggestions(false);
    setFormErrorMsg('');
  };

  const handleClearReportedStudentForOsasForm = () => {
    setFormReportedStudentSearch('');
    setFormReportedStudentId('');
    setFormReportedStudentName('');
    setFormReportedAcademicProgram('');
    setFormReportedYearLevel('');
    setFormReportedContactNumber('');
    setFormReportedAddress('');
    setShowFormReportedStudentSuggestions(false);
  };

  const handleSubmitOsasReferralForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMsg('');
    setFormSubmitSuccess(false);

    if (!formIsAnonymous && !formStudentName.trim()) {
      setFormErrorMsg('Please select or enter the student submitting the report.');
      return;
    }
    if (!formReportedStudentName.trim()) {
      setFormErrorMsg('Please select or enter the name of the student being reported.');
      return;
    }
    if (!formDescription.trim()) {
      setFormErrorMsg('Please enter the description.');
      return;
    }
    if (!formReasonText.trim()) {
      setFormErrorMsg('Please specify the Reason for Referral.');
      return;
    }

    const actor = currentUser?.fullName || 'Princess Ann T. Ruzol (OSAS Administrator)';
    const reporterStudentId = formIsAnonymous ? 'ANONYMOUS' : formStudentId.trim() || undefined;
    const reporterStudentName = formIsAnonymous ? 'Anonymous Reporter' : formStudentName.trim();
    const reporterCourse = formIsAnonymous ? 'N/A' : formAcademicProgram.trim() || 'N/A';
    const reporterYearLevel = formIsAnonymous ? 'N/A' : formYearLevel.trim() || 'N/A';
    const reporterContact = formIsAnonymous ? '' : formContactNumber.trim() || '';
    const reporterAddress = formIsAnonymous ? '' : formAddress.trim() || 'Dingalan, Aurora';

    referDisciplinaryReportFromOsas(
      {
        reportedStudentName: formReportedStudentName.trim(),
        reportedStudentId: formReportedStudentId.trim() || undefined,
        reportedStudentCourse: formReportedAcademicProgram.trim() || undefined,
        reportedStudentYearLevel: formReportedYearLevel.trim() || undefined,
        reportedStudentContact: formReportedContactNumber.trim() || undefined,
        reportedStudentAddress: formReportedAddress.trim() || undefined,
        incidentType: formReasonText.trim(),
        description: formDescription.trim(),
        location: 'Dingalan Community College',
        reporterName: reporterStudentName,
        reporterStudentId,
        reporterCourse,
        reporterYearLevel,
        reporterContactNumber: reporterContact,
        reporterAddress,
        isAnonymousReporter: formIsAnonymous,
      },
      actor
    );

    setFormSubmitSuccess(true);
    setFormIsAnonymous(false);
    handleClearStudentForOsasForm();
    handleClearReportedStudentForOsasForm();
    setFormReasonText('');
    setFormDescription('');
    refreshData();
  };

  // 4. Open & Save OSAS Remarks (Requirement 5)
  const handleOpenOsasRemarks = (rep: DisciplinaryReport) => {
    setOsasRemarksTarget(rep);
    setOsasRemarksInput(rep.osasRemarks || '');
  };

  const handleSaveOsasRemarks = (e: React.FormEvent) => {
    e.preventDefault();
    if (!osasRemarksTarget || !osasRemarksInput.trim()) return;
    const actor = currentUser?.fullName || 'Princess Ann T. Ruzol (OSAS Administrator)';
    const updated = saveOsasRemarksOnReport(osasRemarksTarget.id, osasRemarksInput.trim(), actor);
    if (updated && viewRecordTarget && viewRecordTarget.id === updated.id) {
      setViewRecordTarget(updated);
    }
    setOsasRemarksTarget(null);
    refreshData();
  };

  // 5. Open & Save Guidance Resolution
  const handleOpenCreateResolution = (rep: DisciplinaryReport) => {
    if (isResolutionSaved(rep)) return;
    setResolutionTarget(rep);
    setResolutionError('');
    setResolutionOutcome('RESOLVED');
    setResProblemResolved(rep.problemResolved || rep.description || '');
    const existingActionTaken =
      rep.resolutionActionTaken ||
      (rep.resolutionActionSteps && rep.resolutionActionSteps.length > 0
        ? rep.resolutionActionSteps
            .map((s) => s.actionTaken)
            .filter(Boolean)
            .join('\n')
        : '') ||
      '';
    setResolutionActionTaken(existingActionTaken);
    setResolutionDetails(getCleanResolutionDetails(rep));
  };

  const handleSaveResolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionTarget) return;

    if (resolutionOutcome !== 'RESOLVED') {
      return;
    }

    if (!resolutionDetails.trim()) {
      setResolutionError('Please enter the resolution details.');
      return;
    }

    const actor = currentUser?.fullName || 'Maria Mel B. Glemao (Guidance Advocate)';
    const cleanSteps: ResolutionActionStep[] = [
      {
        stepNumber: 1,
        stepTitle: 'Action Taken',
        dateTime: new Date().toISOString().slice(0, 16),
        actionTaken: resolutionActionTaken.trim() || 'Reviewed and resolved by Guidance Advocate.',
        responsiblePerson: actor,
        personInvolved: actor,
      },
    ];

    const updated = saveStudentReportResolution(
      resolutionTarget.id,
      {
        problemResolved: (resProblemResolved || resolutionTarget.description || '').trim(),
        resolutionActionSteps: cleanSteps,
        resolutionActionTaken: resolutionActionTaken.trim(),
        resolutionOutcome,
        resolutionDetails: resolutionDetails.trim(),
      },
      actor
    );

    if (updated && viewRecordTarget && viewRecordTarget.id === updated.id) {
      setViewRecordTarget(updated);
    }
    setResolutionTarget(null);
    refreshData();
    if (!isOsasAdmin) {
      setActiveTab('report_resolutions');
    }
  };

  // 6. Open & Save Endorsement Letter for Higher Officer (Requirement 6 & 7)
  const handleOpenEndorsementModal = (rep: DisciplinaryReport) => {
    setEndorsementTarget(rep);
    setEndError('');
    const existing = rep.endorsementLetter;

    const allUsers = getUsers();
    const studentPool = allRegisteredStudents.length > 0 ? allRegisteredStudents : allUsers.filter((u) => u.role === 'STUDENT');
    const matchedStudent = studentPool.find(
      (s) =>
        (rep.reportedStudentId && (s.studentId === rep.reportedStudentId || s.id === rep.reportedStudentId)) ||
        (rep.reportedStudentName && s.fullName.toLowerCase() === rep.reportedStudentName.toLowerCase()) ||
        (rep.reporterStudentId && (s.studentId === rep.reporterStudentId || s.id === rep.reporterStudentId))
    );

    const osasAdminUser = allUsers.find((u) => u.role === 'ADMIN');
    const guidanceAdvocateUser = allUsers.find((u) => u.role === 'GUIDANCE_ADMIN');
    const osasAdminFullName =
      (isOsasAdmin && currentUser?.fullName) || osasAdminUser?.fullName || 'Princess Ann T. Ruzol';
    const guidanceAdvocateFullName = guidanceAdvocateUser?.fullName || 'Maria Mel B. Glemao';

    const sName = existing?.studentName || rep.reportedStudentName || rep.reporterName || matchedStudent?.fullName || 'Student';
    const sCourse = rep.reportedStudentCourse || matchedStudent?.academicProgram || matchedStudent?.course || 'BS Information Technology';
    const sYear = rep.reportedStudentYearLevel || matchedStudent?.yearLevel || '1st Year';
    const defaultStudentCourseYear = existing?.courseYear
      ? `${sName}, ${existing.courseYear}`
      : [sName, sCourse, sYear].filter(Boolean).join(', ');

    const isOldDefaultOffice = existing?.institutionName === 'Dingalan Community College';
    const isOldDefaultLocation = existing?.institutionLocation === 'Dingalan, Aurora';
    const isOldDefaultPosition =
      existing?.higherOfficerName === 'College President' ||
      existing?.higherOfficerName === 'Office of the College President / Higher Officer' ||
      existing?.higherOfficerName === 'Name of Official Position';

    setEndHigherOfficerName(isOldDefaultPosition ? '' : (existing?.higherOfficerName || ''));
    setEndHigherOfficerTitle(
      existing?.higherOfficerTitle ||
        (existing?.createdAt
          ? new Date(existing.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }))
    );
    setEndInstitutionName(isOldDefaultOffice ? '' : (existing?.institutionName || ''));
    setEndInstitutionLocation(isOldDefaultLocation ? '' : (existing?.institutionLocation || ''));
    setEndSubject(existing?.subject || defaultStudentCourseYear);
    setEndCaseBackground(
      existing?.caseBackground ||
        rep.osasReferralDescription ||
        rep.problemResolved ||
        rep.description ||
        'reported student concern'
    );
    setEndActionsTaken(
      existing?.actionsTaken && existing.actionsTaken !== sName
        ? existing.actionsTaken
        : osasAdminFullName
    );
    setEndReasonForEndorsement(
      existing?.reasonForEndorsement ||
        'After initial assessment, this concern is beyond the authority of the Office of Student Affairs and Services (OSAS) to resolve. We therefore respectfully endorse it to your office for your review and appropriate action.'
    );
    setEndRecommendation(
      existing?.recommendation ||
        'Supporting documents, if any, are attached for your reference.'
    );
    setEndEndorsedByName(
      existing?.endorsedByName && existing.endorsedByName !== 'College President'
        ? existing.endorsedByName
        : 'Cristy C. Domingo'
    );
    setEndEndorsedByTitle(existing?.endorsedByTitle || 'College President');
    setEndNotedByName(
      existing?.notedByName || guidanceAdvocateFullName
    );
    setEndNotedByTitle(existing?.notedByTitle || 'Guidance Advocate');
  };

  const handleSaveEndorsementLetter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!endorsementTarget) return;
    if (!endHigherOfficerName.trim() || !endInstitutionName.trim() || !endInstitutionLocation.trim() || !endCaseBackground.trim() || !endSubject.trim()) {
      setEndError('Please complete all required fields (Name of Official Position, Office, Location, Student Info, and Case Background) for the Endorsement Letter.');
      return;
    }

    const allUsers = getUsers();
    const osasAdminUser = allUsers.find((u) => u.role === 'ADMIN');
    const guidanceAdvocateUser = allUsers.find((u) => u.role === 'GUIDANCE_ADMIN');
    const defaultOsasName =
      (isOsasAdmin && currentUser?.fullName) || osasAdminUser?.fullName || 'Princess Ann T. Ruzol';
    const defaultGuidanceName = guidanceAdvocateUser?.fullName || 'Maria Mel B. Glemao';

    const actor = currentUser?.fullName || (isOsasAdmin ? defaultOsasName : defaultGuidanceName);
    const courseYearStr = [endorsementTarget.reportedStudentCourse, endorsementTarget.reportedStudentYearLevel]
      .filter(Boolean)
      .join(', ');

    const updated = saveStudentReportEndorsementLetter(
      endorsementTarget.id,
      {
        higherOfficerName: endHigherOfficerName.trim(),
        higherOfficerTitle: endHigherOfficerTitle.trim() || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        institutionName: endInstitutionName.trim(),
        institutionLocation: endInstitutionLocation.trim(),
        subject: endSubject.trim(),
        studentName: endorsementTarget.reportedStudentName || endorsementTarget.reporterName,
        studentId: endorsementTarget.reportedStudentId || undefined,
        courseYear: courseYearStr || undefined,
        caseBackground: endCaseBackground.trim(),
        actionsTaken: endActionsTaken.trim() || defaultOsasName,
        reasonForEndorsement: endReasonForEndorsement.trim(),
        recommendation: endRecommendation.trim(),
        endorsedByName: endEndorsedByName.trim() || 'Cristy C. Domingo',
        endorsedByTitle: endEndorsedByTitle.trim() || 'College President',
        notedByName: endNotedByName.trim() || defaultGuidanceName,
        notedByTitle: endNotedByTitle.trim() || 'Guidance Advocate',
      },
      actor
    );

    if (updated && viewRecordTarget && viewRecordTarget.id === updated.id) {
      setViewRecordTarget(updated);
    }
    setEndorsementTarget(null);
    refreshData();
  };

  const handleOpenCreateRecordModal = (rep: DisciplinaryReport) => {
    if (hasDisciplinaryActionForReport(rep)) return;
    const studentPool = getUsers().filter((u) => u.role === 'STUDENT');
    const lastSlip = Array.isArray(rep.slipNotices) && rep.slipNotices.length > 0 ? rep.slipNotices[0] : undefined;
    const candId = (rep.reportedStudentId || lastSlip?.studentId || '').trim().toLowerCase();
    const candName = (
      (rep.reportedStudentName && rep.reportedStudentName !== 'Unspecified Student / General Report'
        ? rep.reportedStudentName
        : '') ||
      lastSlip?.studentName ||
      ''
    )
      .trim()
      .toLowerCase();
    const matched = studentPool.find(
      (u) =>
        (candId &&
          ((u.studentId && u.studentId.trim().toLowerCase() === candId) ||
            (u.id && u.id.trim().toLowerCase() === candId))) ||
        (candName && u.fullName && u.fullName.trim().toLowerCase() === candName)
    );
    const enrichedReport: DisciplinaryReport = {
      ...rep,
      reportedStudentId:
        matched?.studentId || matched?.id || rep.reportedStudentId || lastSlip?.studentId || '',
      reportedStudentName:
        matched?.fullName || rep.reportedStudentName || lastSlip?.studentName || '',
      reportedStudentCourse:
        matched?.academicProgram ||
        matched?.course ||
        rep.reportedStudentCourse ||
        lastSlip?.course ||
        '',
      reportedStudentYearLevel:
        matched?.yearLevel || rep.reportedStudentYearLevel || lastSlip?.yearLevel || '',
      reportedStudentContact:
        matched?.contactNumber ||
        (matched as any)?.phoneNumber ||
        rep.reportedStudentContact ||
        lastSlip?.contactNumber ||
        '',
      reportedStudentAddress:
        matched?.permanentAddress || matched?.address || rep.reportedStudentAddress || '',
    };
    if (onCreateDisciplinaryAction) {
      onCreateDisciplinaryAction(enrichedReport);
      return;
    }
    setRecordTargetReport(enrichedReport);
    setIsCreatingRecord(true);
  };

  const filteredSlipStudents = useMemo(() => {
    const q = slipStudentName.toLowerCase().trim();
    if (!q) return allRegisteredStudents.slice(0, 6);
    return allRegisteredStudents
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          (s.course && s.course.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [allRegisteredStudents, slipStudentName]);

  const filteredFormStudents = useMemo(() => {
    const q = formStudentSearch.toLowerCase().trim();
    if (!q) return [];
    return allRegisteredStudents
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          (s.course && s.course.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [allRegisteredStudents, formStudentSearch]);

  const filteredReportedStudents = useMemo(() => {
    const q = formReportedStudentSearch.toLowerCase().trim();
    if (!q) return [];
    return allRegisteredStudents
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          (s.course && s.course.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [allRegisteredStudents, formReportedStudentSearch]);

  return (
    <div className="space-y-6">
      <div className={`space-y-6 ${printEndorsementReport || printResolutionReport ? 'print:hidden' : ''}`}>
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 text-slate-900 dark:text-white shadow-xs relative border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {isOsasAdmin ? 'Referred Student Reports' : 'Guidance Advocate — Student Reports'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {isOsasAdmin
                ? 'Manage Student Reports referred by the Guidance Advocate. View complete report and referral details, submit referral records to Guidance, send Slip Notices, record OSAS Remarks, and review completed resolutions.'
                : 'Receive incoming student reports from the Student Portal, save report records, send slip notices, refer cases needing OSAS intervention, and record official resolutions.'}
            </p>
          </div>
        </div>

        {/* OSAS ADMINISTRATOR: 3 TABS (Matches Intervention module tab styling) */}
        {isOsasAdmin ? (
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center sm:justify-start gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setOsasActiveTab('referred_reports')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                osasActiveTab === 'referred_reports'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Referred Student Reports</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  osasActiveTab === 'referred_reports' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {osasReferredReports.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setOsasActiveTab('referral_form')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                osasActiveTab === 'referral_form'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Refer Student Reports</span>
            </button>

            <button
              type="button"
              onClick={() => setOsasActiveTab('guidance_resolutions')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                osasActiveTab === 'guidance_resolutions'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Guidance Resolutions</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  osasActiveTab === 'guidance_resolutions' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {osasGuidanceResolutions.length}
              </span>
            </button>
          </div>
        ) : (
          /* GUIDANCE ADVOCATE: EXACTLY 3 TABS (Matches Disciplinary Records tab layout & styling while preserving colors) */
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center sm:justify-start gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('student_reports')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'student_reports'
                  ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Student Reports</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  activeTab === 'student_reports'
                    ? 'bg-white text-red-700'
                    : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                }`}
              >
                {incomingReports.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('student_reports_record')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'student_reports_record'
                  ? 'bg-red-600 text-white shadow-md shadow-red-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <FolderCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Student Reports Record</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  activeTab === 'student_reports_record'
                    ? 'bg-white text-red-700'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {savedRecordReports.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('report_resolutions')}
              className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'report_resolutions'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Resolutions Report</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                  activeTab === 'report_resolutions'
                    ? 'bg-white text-blue-700'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {resolvedReports.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6">
        {isOsasAdmin && osasActiveTab === 'referral_form' ? (
          /* =========================================================================
             OSAS TAB 2: REFERRAL FORM
             Contains only:
             Student Information | Reason for Referral | Description | Referral Checklist
             Submits directly and refers to Guidance Advocate.
             ========================================================================= */
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-600" />
                  Student Reports Referral Form
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete the student information, referral reason, description, and checklist to refer this case to Guidance.
                </p>
              </div>
            </div>

            {formSubmitSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-200">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-black">Referral Record Submitted Successfully!</p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      The referral record has been transmitted to the Guidance Advocate for counseling and intervention.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormSubmitSuccess(false)}
                  className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {formErrorMsg && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-200 font-bold text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOsasReferralForm} className="space-y-6">
              {/* 1. Student Information */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" /> 1. Student Information
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                      The student making/submitting the report
                    </span>
                  </div>

                  {/* Anonymous Option / Toggle */}
                  <label className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer select-none shadow-2xs">
                    <input
                      type="checkbox"
                      checked={formIsAnonymous}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormIsAnonymous(checked);
                        if (checked) {
                          handleClearStudentForOsasForm();
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Anonymous
                    </span>
                  </label>
                </div>

                {formIsAnonymous && (
                  <div className="p-3.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-2.5 text-xs font-bold text-blue-800 dark:text-blue-200">
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>
                      This information will be kept anonymous and your identity will not be disclosed.
                    </span>
                  </div>
                )}

                {!formIsAnonymous && (
                  <>
                    {/* Search Registered Student with X/Clear button */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Student Search (Auto-fill)
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={formStudentSearch}
                          onChange={(e) => {
                            setFormStudentSearch(e.target.value);
                            setShowFormStudentSuggestions(true);
                          }}
                          onFocus={() => setShowFormStudentSuggestions(true)}
                          placeholder="Type student name or ID to auto-fill..."
                          className="w-full pl-9 pr-10 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                        />
                        {formStudentSearch && (
                          <button
                            type="button"
                            onClick={handleClearStudentForOsasForm}
                            className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Clear Student Information"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {showFormStudentSuggestions && filteredFormStudents.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                          {filteredFormStudents.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => handleSelectStudentForOsasForm(st)}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between cursor-pointer"
                            >
                              <div>
                                <p className="font-bold text-xs text-slate-900 dark:text-white">{st.fullName}</p>
                                <p className="text-[10px] text-slate-500">
                                  {[st.course, st.yearLevel].filter(Boolean).join(' • ')}
                                </p>
                              </div>
                              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                                {st.studentId || st.id}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 6 Display Fields: 1. Student ID, 2. Full Name, 3. Academic Program, 4. Year Level, 5. Contact Number, 6. Address / Permanent Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Student ID
                        </label>
                        <input
                          type="text"
                          value={formStudentId}
                          onChange={(e) => setFormStudentId(e.target.value)}
                          placeholder="e.g. 2026-000001"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required={!formIsAnonymous}
                          value={formStudentName}
                          onChange={(e) => setFormStudentName(e.target.value)}
                          placeholder="Student full name"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Academic Program
                        </label>
                        <input
                          type="text"
                          value={formAcademicProgram}
                          onChange={(e) => setFormAcademicProgram(e.target.value)}
                          placeholder="e.g. BS Information Technology"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Year Level
                        </label>
                        <input
                          type="text"
                          value={formYearLevel}
                          onChange={(e) => setFormYearLevel(e.target.value)}
                          placeholder="e.g. 1st Year / 2nd Year"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Contact Number
                        </label>
                        <input
                          type="text"
                          value={formContactNumber}
                          onChange={(e) => setFormContactNumber(e.target.value)}
                          placeholder="e.g. 09123456789"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Address / Permanent Address
                        </label>
                        <input
                          type="text"
                          value={formAddress}
                          onChange={(e) => setFormAddress(e.target.value)}
                          placeholder="e.g. Brgy. Poblacion, Dingalan, Aurora"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 2. Reported Student Information */}
              <div className="p-5 bg-red-50/40 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-red-600" /> 2. Reported Student Information *
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">The student being reported</span>
                </div>

                {/* Search Reported Student with X/Clear button */}
                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Reported Student Search (Auto-fill)
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={formReportedStudentSearch}
                      onChange={(e) => {
                        setFormReportedStudentSearch(e.target.value);
                        setShowFormReportedStudentSuggestions(true);
                      }}
                      onFocus={() => setShowFormReportedStudentSuggestions(true)}
                      placeholder="Type reported student name or ID to auto-fill..."
                      className="w-full pl-9 pr-10 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-red-500"
                    />
                    {formReportedStudentSearch && (
                      <button
                        type="button"
                        onClick={handleClearReportedStudentForOsasForm}
                        className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Clear Reported Student Information"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {showFormReportedStudentSuggestions && filteredReportedStudents.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredReportedStudents.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectReportedStudentForOsasForm(st)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <p className="font-bold text-xs text-slate-900 dark:text-white">{st.fullName}</p>
                            <p className="text-[10px] text-slate-500">
                              {[st.course, st.yearLevel].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                            {st.studentId || st.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6 Display Fields: 1. Student ID, 2. Full Name, 3. Academic Program, 4. Year Level, 5. Contact Number, 6. Address / Permanent Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Student ID
                    </label>
                    <input
                      type="text"
                      value={formReportedStudentId}
                      onChange={(e) => setFormReportedStudentId(e.target.value)}
                      placeholder="e.g. 2026-000002"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formReportedStudentName}
                      onChange={(e) => setFormReportedStudentName(e.target.value)}
                      placeholder="Reported student full name"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Academic Program
                    </label>
                    <input
                      type="text"
                      value={formReportedAcademicProgram}
                      onChange={(e) => setFormReportedAcademicProgram(e.target.value)}
                      placeholder="e.g. BS Information Technology"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Year Level
                    </label>
                    <input
                      type="text"
                      value={formReportedYearLevel}
                      onChange={(e) => setFormReportedYearLevel(e.target.value)}
                      placeholder="e.g. 1st Year / 2nd Year"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={formReportedContactNumber}
                      onChange={(e) => setFormReportedContactNumber(e.target.value)}
                      placeholder="e.g. 09123456789"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Address / Permanent Address
                    </label>
                    <input
                      type="text"
                      value={formReportedAddress}
                      onChange={(e) => setFormReportedAddress(e.target.value)}
                      placeholder="e.g. Brgy. Poblacion, Dingalan, Aurora"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Description */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" /> 3. Description *
                </h4>
                <p className="text-[11px] text-slate-500">
                  Original description submitted by the student (or detail concerns for walk-in).
                </p>
                <textarea
                  rows={4}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Enter description of incident or report concerns..."
                  className="w-full p-3.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* 4. Reason for Referral */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-600" /> 4. Reason for Referral *
                </h4>
                <p className="text-[11px] text-slate-500">
                  Specify the reason for referral to Guidance Advocate.
                </p>
                <input
                  type="text"
                  required
                  value={formReasonText}
                  onChange={(e) => setFormReasonText(e.target.value)}
                  placeholder="Enter specific reason for referral..."
                  className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Student Reports</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student, complainant, location, description..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isOsasAdmin
                  ? osasActiveTab === 'guidance_resolutions'
                    ? `Showing ${displayedReports.length} Guidance Resolution(s)`
                    : `Showing ${displayedReports.length} Referred Student Report(s)`
                  : activeTab === 'student_reports'
                  ? `Showing ${displayedReports.length} Incoming Student Report(s)`
                  : activeTab === 'report_resolutions'
                  ? `Showing ${displayedReports.length} Report Resolution(s)`
                  : `Showing ${displayedReports.length} Saved Student Report Record(s)`}
              </div>
            </div>

            {/* Empty State */}
            {displayedReports.length === 0 ? (
              <div className="py-14 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {isOsasAdmin
                    ? osasActiveTab === 'guidance_resolutions'
                      ? 'No saved Guidance resolutions yet.'
                      : 'No referred student reports from Guidance yet.'
                    : activeTab === 'student_reports'
                    ? 'No incoming student reports pending review.'
                    : activeTab === 'report_resolutions'
                    ? 'No saved case resolutions yet.'
                    : 'No saved records in Student Reports Record yet.'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isOsasAdmin
                    ? osasActiveTab === 'guidance_resolutions'
                      ? 'When Guidance saves a case resolution, the official resolution will automatically appear here.'
                      : 'When Guidance refers a Student Report for OSAS intervention, it will automatically appear here.'
                    : activeTab === 'student_reports'
                    ? 'Submitted reports from Student Portal → Submit Reports → Student Report will appear here.'
                    : activeTab === 'report_resolutions'
                     ? 'Complete and save a resolution in Student Reports Record to display official case resolutions here.'
                    : 'Click Receive Report on incoming student reports to move them here.'}
                </p>
              </div>
            ) : !isOsasAdmin && activeTab === 'student_reports' ? (
              /* =========================================================================
                 GUIDANCE TAB 1: STUDENT REPORTS (INCOMING)
                 Show: Reported Student, Reported By, Complainant, Location, Date & Time,
                 Description, Attachment availability/files, and Reason for Referral (when provided).
                 Button: Receive Report (immediately saves and moves into Student Reports Record).
                 ========================================================================= */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedReports.map((rep) => {
                  const isAnon = Boolean(rep.isAnonymousReporter || rep.reporterRole === 'Anonymous Reporter');
                  const hasAttachment = Boolean(rep.evidenceUrl || rep.evidenceFileName);
                  const referralReasonText =
                    Array.isArray(rep.osasReferralReasons) && rep.osasReferralReasons.length > 0
                      ? rep.osasReferralReasons.join(', ')
                      : (rep.referredFromOsas || rep.isReferredFromOsas) &&
                        rep.incidentType &&
                        rep.incidentType !== 'General Student Report'
                      ? rep.incidentType
                      : '';

                  return (
                    <div
                      key={rep.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col justify-between gap-3 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-2xs"
                    >
                      <div className="space-y-2 text-xs">
                        {/* Row 1: Reported Student & Complainant - Balanced Equal Sizes & Alignment */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                              Reported Student
                            </span>
                            <div className="mt-0.5">
                              <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {rep.reportedStudentName}
                                {rep.reportedStudentId ? ` (${rep.reportedStudentId})` : ''}
                              </p>
                              {(rep.reportedStudentCourse || rep.reportedStudentYearLevel) ? (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                                  {[rep.reportedStudentCourse, rep.reportedStudentYearLevel].filter(Boolean).join(' • ')}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-0.5">
                                  Student record details
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                              Complainant
                            </span>
                            <div className="mt-0.5">
                              <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {isAnon ? 'Anonymous Reporter' : (rep.reporterName || 'Student Reporter')}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                                {isAnon ? 'Anonymous Submission' : (rep.reporterRole || 'Student')}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Location + Date & Time + Attachments (Equal in size, increased height, time below date) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between min-h-[76px]">
                            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                              Location
                            </span>
                            <p className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-auto">
                              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span className="truncate">{rep.location}</span>
                            </p>
                          </div>

                          {(() => {
                            let datePart = rep.reportDate?.trim() || '';
                            let timePart = rep.reportTime?.trim() || '';
                            if (!datePart || !timePart) {
                              const dt = new Date(rep.submittedAt || Date.now());
                              if (!isNaN(dt.getTime())) {
                                if (!datePart) datePart = dt.toLocaleDateString();
                                if (!timePart) timePart = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              }
                            }
                            return (
                              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between min-h-[76px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                                  Date &amp; Time
                                </span>
                                <div className="mt-auto space-y-0.5 font-mono">
                                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                    <span>{datePart || 'No Date'}</span>
                                  </p>
                                  <p className="font-medium text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 pl-5">
                                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{timePart || 'No Time'}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between min-h-[76px]">
                            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                              Attachment
                            </span>
                            <div className="mt-auto">
                              {hasAttachment ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (rep.evidenceUrl) {
                                      setSelectedPreviewImage(rep.evidenceUrl);
                                    }
                                  }}
                                  className="flex items-center justify-between gap-1.5 w-full text-left group cursor-pointer"
                                  title="Click to view attachment"
                                >
                                  <span
                                    className="text-[11px] font-bold text-blue-700 dark:text-blue-300 truncate underline group-hover:text-blue-600"
                                  >
                                    {rep.evidenceFileName || 'Attached File'}
                                  </span>
                                  {rep.evidenceUrl && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md shrink-0 group-hover:bg-blue-100">
                                      View
                                    </span>
                                  )}
                                </button>
                              ) : (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                  No attachment
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Description + Reason for Referral (when provided) */}
                        <div className={referralReasonText ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : ''}>
                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-black text-slate-400 uppercase block mb-0.5">
                              Description
                            </span>
                            <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                              {rep.description}
                            </p>
                          </div>

                          {referralReasonText && (
                            <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/70">
                              <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase block mb-0.5">
                                Reason for Referral
                              </span>
                              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 line-clamp-2 leading-relaxed">
                                {referralReasonText}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions Bar: Receive Report */}
                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-200 dark:border-slate-700">
                        {rep.referredFromOsas || rep.isReferredFromOsas ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Referred from OSAS
                          </span>
                        ) : (
                          <div />
                        )}
                        <button
                          type="button"
                          onClick={() => handleSaveReportToRecords(rep)}
                          className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <FolderCheck className="w-3.5 h-3.5" /> Receive Report
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (!isOsasAdmin && activeTab === 'report_resolutions') ||
              (isOsasAdmin && osasActiveTab === 'guidance_resolutions') ? (
              /* =========================================================================
                 REPORT RESOLUTIONS (BLUE PALETTE) - VIEW-ONLY FOR GUIDANCE & OSAS
                 Vertical top-to-bottom order:
                 1. Student Information
                 2. Case Information
                 3. Problem Resolved
                 4. Actions Taken by Guidance Advocate
                 5. Resolution Details and Narrative
                 6. Disciplinary Action
                 7. Endorsement Letter
                 8. OSAS Administrator Remarks
                 ========================================================================= */
              <div className="flex flex-col space-y-4">
                {displayedReports.map((rep) => {
                  const isResolved = isReportCaseResolved(rep);
                  const isResolutionExpanded = Boolean(expandedResolutionIds[rep.id]);
                  return (
                    <div
                      key={rep.id}
                      className="p-5 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex flex-col justify-between gap-4 hover:border-blue-400 dark:hover:border-blue-700 transition-all shadow-2xs"
                    >
                      <div className="space-y-4">
                        {/* Header Row */}
                        <div
                          onClick={() => toggleResolutionExpanded(rep.id)}
                          className={`flex items-start justify-between gap-3 cursor-pointer select-none ${
                            isResolutionExpanded ? 'pb-3 border-b border-blue-200/70 dark:border-blue-900/60' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            <span className="px-2.5 py-1 text-[10px] font-mono font-black rounded-lg bg-blue-600 text-white">
                              Resolution #{rep.id}
                            </span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">
                              {rep.reportedStudentName}
                              {rep.reportedStudentId ? ` (${rep.reportedStudentId})` : ''}
                            </span>
                            <span
                              className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase border ${
                                isResolved
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                              }`}
                            >
                              {isResolved ? 'Case Resolved' : 'Unresolved'}
                            </span>
                            {hasDisciplinaryActionForReport(rep) && (
                              <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase border bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800">
                                Disciplinary Action Created
                              </span>
                            )}
                            {rep.resolvedAt && (
                              <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                {new Date(rep.resolvedAt).toLocaleString()}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleResolutionExpanded(rep.id);
                            }}
                            className="shrink-0 self-start ml-auto px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            {isResolutionExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>Hide Details</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span>Open Record</span>
                              </>
                            )}
                          </button>
                        </div>

                        {isResolutionExpanded && (
                          <div className="space-y-3 text-xs">
                            {/* Side-by-side Row: Student Information (left) & Case Information (right) - Without Numbering */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Student Information */}
                              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2 shadow-2xs flex flex-col justify-between">
                                <div>
                                  <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                    Student Information
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                                    <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase block">
                                        Reported Student
                                      </span>
                                      <p className="font-black text-slate-900 dark:text-white mt-0.5">
                                        {rep.reportedStudentName}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase block">
                                        Student ID &amp; Program
                                      </span>
                                      <p className="text-[11px] text-slate-700 dark:text-slate-300 font-mono font-bold mt-0.5">
                                        {rep.reportedStudentId || 'No ID'}
                                        {rep.reportedStudentCourse ? ` • ${rep.reportedStudentCourse}` : ''}
                                        {rep.reportedStudentYearLevel ? ` ${rep.reportedStudentYearLevel}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Case Information */}
                              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2 shadow-2xs flex flex-col justify-between">
                                <div>
                                  <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                    Case Information
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
                                    <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase block">
                                        Complainant / Reporter
                                      </span>
                                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                                        {rep.isAnonymousReporter ? 'Anonymous Reporter' : rep.reporterName}
                                      </p>
                                      <p className="text-[11px] text-slate-500">
                                        Role: {rep.isAnonymousReporter ? 'Anonymous Reporter' : rep.reporterRole || 'Student'}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase block">
                                        Location
                                      </span>
                                      <p className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <span>{rep.location}</span>
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase block">
                                        Date and Time
                                      </span>
                                      <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <span>{formatReportDateTime(rep)}</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 1. OSAS Administrator Remarks */}
                            {(() => {
                              const remarksText = rep.osasRemarks?.trim() || '';
                              const hasRemarks = Boolean(remarksText);
                              const osasDate = rep.osasRemarksSavedAt
                                ? new Date(rep.osasRemarksSavedAt).toLocaleString()
                                : rep.resolvedAt
                                ? new Date(rep.resolvedAt).toLocaleString()
                                : formatReportDateTime(rep);
                              const remarksLines = hasRemarks
                                ? remarksText.split('\n').map((l) => l.trim()).filter(Boolean)
                                : [];
                              return (
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-2 shadow-2xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/40 pb-2">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5">
                                      <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                      OSAS Administrator Remarks
                                    </span>
                                    {hasRemarks && (
                                      <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                        {osasDate}
                                      </span>
                                    )}
                                  </div>
                                  <ul className="space-y-1.5 pt-0.5">
                                    {hasRemarks ? (
                                      remarksLines.map((line, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-slate-800 dark:text-slate-200 leading-relaxed">
                                          <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">•</span>
                                          <span className="flex-1 font-semibold">{line}</span>
                                        </li>
                                      ))
                                    ) : (
                                      <li className="flex items-start gap-2 text-slate-500 dark:text-slate-400 italic">
                                        <span className="text-blue-400 font-bold shrink-0">•</span>
                                        <span>No Administrator Remarks Recorded</span>
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              );
                            })()}

                            {/* 2. Endorsement Letter */}
                            {(() => {
                              const letter = rep.endorsementLetter;
                              const hasLetter = Boolean(letter);
                              const letterDate = letter?.createdAt
                                ? new Date(letter.createdAt).toLocaleString()
                                : rep.resolvedAt
                                ? new Date(rep.resolvedAt).toLocaleString()
                                : formatReportDateTime(rep);
                              return (
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-2 shadow-2xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/40 pb-2">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5">
                                      <FileSignature className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                      Endorsement Letter
                                    </span>
                                    {hasLetter && (
                                      <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                        {letterDate}
                                      </span>
                                    )}
                                  </div>
                                  <ul className="space-y-1.5 pt-0.5">
                                    {hasLetter ? (
                                      <>
                                        <li className="flex items-start gap-2 text-slate-800 dark:text-slate-200 leading-relaxed">
                                          <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">•</span>
                                          <span className="flex-1 font-medium">
                                            Official OSAS Endorsement Letter addressed to {letter.higherOfficerName || 'Higher Authority'} ({letter.institutionName || 'Destination Office'})
                                          </span>
                                        </li>
                                        <li className="flex items-start gap-2 text-slate-800 dark:text-slate-200 leading-relaxed">
                                          <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">•</span>
                                          <span className="flex-1 font-medium">
                                            Approved By: {letter.endorsedByName || 'Cristy C. Domingo'} • Noted By: {letter.notedByName || 'Maria Mel B. Glemao'}
                                          </span>
                                        </li>
                                      </>
                                    ) : (
                                      <li className="flex items-start gap-2 text-slate-500 dark:text-slate-400 italic">
                                        <span className="text-blue-400 font-bold shrink-0">•</span>
                                        <span>No Endorsement Letter Recorded</span>
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              );
                            })()}

                            {/* 3. Disciplinary Action */}
                            {(() => {
                              const linkedDisc = getLinkedDisciplinaryRecord(rep);
                              const isCreated = Boolean(linkedDisc || rep.disciplinaryRecordId || rep.linkedRecordId);
                              const refId = linkedDisc?.id || rep.disciplinaryRecordId || rep.linkedRecordId || '';
                              const discDate = linkedDisc?.reportDate && linkedDisc?.reportTime
                                ? `${linkedDisc.reportDate} • ${linkedDisc.reportTime}`
                                : linkedDisc?.dateLogged
                                ? new Date(linkedDisc.dateLogged).toLocaleString()
                                : rep.resolvedAt
                                ? new Date(rep.resolvedAt).toLocaleString()
                                : formatReportDateTime(rep);
                              return (
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-2 shadow-2xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/40 pb-2">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1.5">
                                      <AlertOctagon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                      Disciplinary Action
                                    </span>
                                    {isCreated && (
                                      <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                        {discDate}
                                      </span>
                                    )}
                                  </div>
                                  <ul className="space-y-1.5 pt-0.5">
                                    {isCreated ? (
                                      <>
                                        <li className="flex items-start gap-2 text-slate-800 dark:text-slate-200 leading-relaxed">
                                          <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">•</span>
                                          <span className="flex-1 font-medium">
                                            Disciplinary Action Created — {refId ? `Official Record #${refId}` : 'Official Record'}
                                          </span>
                                        </li>
                                        <li className="flex items-start gap-2 text-slate-800 dark:text-slate-200 leading-relaxed">
                                          <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">•</span>
                                          <span className="flex-1 font-medium">
                                            Official disciplinary action record documented for this student report.
                                          </span>
                                        </li>
                                      </>
                                    ) : (
                                      <li className="flex items-start gap-2 text-slate-500 dark:text-slate-400 italic">
                                        <span className="text-blue-400 font-bold shrink-0">•</span>
                                        <span>No Disciplinary Action Recorded</span>
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              );
                            })()}

                            {/* 4. Resolution Details and Narrative */}
                            {(() => {
                              const resDate = rep.resolvedAt
                                ? new Date(rep.resolvedAt).toLocaleString()
                                : formatReportDateTime(rep);
                              const detailsText = getCleanResolutionDetails(rep) || '';
                              const detailsLines = detailsText
                                ? detailsText.split('\n').map((l) => l.trim()).filter(Boolean)
                                : ['No resolution details recorded.'];
                              return (
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-2 shadow-2xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/40 pb-2">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                      Resolution Details and Narrative
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                      {resDate}
                                    </span>
                                  </div>
                                  <ul className="space-y-1.5 pt-0.5">
                                    {detailsLines.map((line, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-slate-800 dark:text-slate-200 leading-relaxed">
                                        <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">•</span>
                                        <span className="flex-1 font-medium">{line}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })()}

                            {/* 5. Actions Taken by Guidance Advocate */}
                            {(() => {
                              const savedActionTaken =
                                rep.resolutionActionTaken ||
                                (rep.resolutionActionSteps && rep.resolutionActionSteps.length > 0
                                  ? rep.resolutionActionSteps
                                      .map((s) => s.actionTaken)
                                      .filter(Boolean)
                                      .join('\n')
                                  : '') ||
                                rep.actionTaken ||
                                '';
                              const actionDate = rep.resolvedAt
                                ? new Date(rep.resolvedAt).toLocaleString()
                                : formatReportDateTime(rep);
                              const actionLines = savedActionTaken
                                ? savedActionTaken.split('\n').map((l) => l.trim()).filter(Boolean)
                                : ['No action recorded.'];
                              return (
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-2 shadow-2xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/40 pb-2">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                      Actions Taken by Guidance Advocate
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                      {actionDate}
                                    </span>
                                  </div>
                                  <ul className="space-y-1.5 pt-0.5">
                                    {actionLines.map((line, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-slate-800 dark:text-slate-200 leading-relaxed">
                                        <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">•</span>
                                        <span className="flex-1 font-medium">{line}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })()}

                            {/* 6. Problem Resolved and Concerns Addressed */}
                            {(() => {
                              const problemDate = formatReportDateTime(rep);
                              const problemText = rep.problemResolved || rep.description || 'General student concern addressed.';
                              const problemLines = problemText.split('\n').map((l) => l.trim()).filter(Boolean);
                              return (
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-2 shadow-2xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-blue-900/40 pb-2">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                      Problem Resolved and Concerns Addressed
                                    </span>
                                    <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                                      {problemDate}
                                    </span>
                                  </div>
                                  <ul className="space-y-1.5 pt-0.5">
                                    {problemLines.map((line, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-slate-800 dark:text-slate-200 leading-relaxed">
                                        <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">•</span>
                                        <span className="flex-1 font-semibold">{line}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })()}

                            {/* Print & Archive Now Buttons at the bottom of the Report Resolution */}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-blue-200/70 dark:border-blue-900/60">
                              <button
                                type="button"
                                disabled={!isResolved}
                                onClick={() => handleDirectPrintResolution(rep)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Resolution</span>
                              </button>
                              <button
                                type="button"
                                disabled={!isResolved}
                                onClick={() => handleArchiveReportResolution(rep)}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>Archive Now</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
          /* =========================================================================
             GUIDANCE TAB 2: STUDENT REPORTS RECORD & OSAS REFER STUDENT REPORTS
             Shows complete saved report information, Send Slip, Create Resolution,
             Refer (to OSAS), OSAS Remarks, Disciplinary Action Form, and Endorsement Letter
             ========================================================================= */
          <div className="flex flex-col space-y-4">
            {displayedReports.map((rep) => {
              const isAnon = Boolean(rep.isAnonymousReporter || rep.reporterRole === 'Anonymous Reporter');
              const hasSavedResolution = isResolutionSaved(rep);
              const isResolved = hasSavedResolution && isReportCaseResolved(rep);
              const isUnresolved =
                !isResolved &&
                ((hasSavedResolution && rep.resolutionOutcome === 'UNRESOLVED') ||
                  rep.status === 'UNRESOLVED');
              const isCollapsibleRecord =
                (!isOsasAdmin && activeTab === 'student_reports_record') ||
                (isOsasAdmin && osasActiveTab === 'referred_reports');
              const isExpanded = isCollapsibleRecord ? Boolean(expandedReportIds[rep.id]) : true;

              return (
                <div
                  key={rep.id}
                  className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col justify-between gap-4 hover:border-red-300 dark:hover:border-red-700 transition-all shadow-2xs"
                >
                  <div className="space-y-4">
                    {/* Header Row */}
                    <div
                      onClick={isCollapsibleRecord ? () => toggleReportExpanded(rep.id) : undefined}
                      className={`flex items-start justify-between gap-3 ${
                        isExpanded ? 'pb-3 border-b border-slate-200 dark:border-slate-700' : ''
                      } ${isCollapsibleRecord ? 'cursor-pointer select-none' : ''}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <span className="px-2.5 py-1 text-[10px] font-mono font-black rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          Report #{rep.id}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {rep.reportedStudentName}
                          {rep.reportedStudentId ? ` (${rep.reportedStudentId})` : ''}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          • {formatReportDateTime(rep)}
                        </span>
                        {rep.referredToOsas && (
                          <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">
                            Referred to OSAS
                          </span>
                        )}
                        {rep.osasRemarks && (
                          <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300">
                            OSAS Remarks Saved
                          </span>
                        )}
                        {isResolved && (
                          <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                            Resolved
                          </span>
                        )}
                        {isUnresolved && (
                          <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            Unresolved
                          </span>
                        )}
                        {(rep.disciplinaryRecordId || rep.linkedRecordId) && (
                          <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300">
                            Disciplinary Record #{rep.disciplinaryRecordId || rep.linkedRecordId}
                            {rep.status === 'Sanction' ? ' (Sanctioned)' : ''}
                          </span>
                        )}
                      </div>

                      {isCollapsibleRecord && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleReportExpanded(rep.id);
                          }}
                          className="shrink-0 self-start ml-auto px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Hide Details</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>Open Record</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <>
                        {/* Core Report Information Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-black text-slate-400 uppercase block">
                              Reported Student
                            </span>
                            <p className="font-black text-slate-900 dark:text-white mt-0.5">
                              {rep.reportedStudentName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {rep.reportedStudentId || 'No ID'}
                              {rep.reportedStudentCourse ? ` • ${rep.reportedStudentCourse}` : ''}
                              {rep.reportedStudentYearLevel ? ` ${rep.reportedStudentYearLevel}` : ''}
                            </p>
                          </div>

                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-black text-slate-400 uppercase block">
                              Reported By / Complainant
                            </span>
                            <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                              {isAnon ? 'Anonymous Reporter' : rep.reporterName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Role: {isAnon ? 'Anonymous Reporter' : rep.reporterRole || 'Student'}
                              {!isAnon && rep.reporterStudentId ? ` (${rep.reporterStudentId})` : ''}
                            </p>
                          </div>

                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-black text-slate-400 uppercase block">
                              Location
                            </span>
                            <p className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span>{rep.location}</span>
                            </p>
                          </div>

                          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] font-black text-slate-400 uppercase block">
                              Date &amp; Time
                            </span>
                            <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{formatReportDateTime(rep)}</span>
                            </p>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                          <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                            Description
                          </span>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {rep.description}
                          </p>
                        </div>

                        {/* Slip Notices Sent */}
                        {rep.slipNotices && rep.slipNotices.length > 0 && (
                          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/70 text-xs flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase block">
                                Slip Notice History ({rep.slipNotices.length})
                              </span>
                              <p className="text-amber-900 dark:text-amber-200 font-semibold mt-0.5">
                                Latest Slip sent on {rep.slipNotices[0].dateSent} to {rep.slipNotices[0].studentName} • Visit:{' '}
                                {rep.slipNotices[0].visitDate} @ {rep.slipNotices[0].visitTime} (
                                {rep.slipNotices[0].purposes.join(', ')})
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Guidance -> OSAS Referral Summary */}
                        {rep.referredToOsas && (
                          <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800/70 text-xs space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                <HeartHandshake className="w-3.5 h-3.5 text-indigo-600" />
                                Guidance Referral to OSAS ({rep.osasReferralDate || 'Referred'})
                              </span>
                              {Boolean((rep.osasRemarks && rep.osasRemarks.trim()) || rep.endorsementLetter) && (
                                <span className="px-2 py-0.5 text-[10px] font-black rounded-md uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
                                  Completed
                                </span>
                              )}
                            </div>
                            {rep.osasReferralReasons && rep.osasReferralReasons.length > 0 && (
                              <p className="text-slate-700 dark:text-slate-300">
                                <strong>Reasons:</strong> {rep.osasReferralReasons.join(', ')}
                              </p>
                            )}
                            {rep.osasReferralDescription && (
                              <p className="text-slate-700 dark:text-slate-300">
                                <strong>Referral Narrative:</strong> {rep.osasReferralDescription}
                              </p>
                            )}
                          </div>
                        )}

                        {/* OSAS Remarks Box (Visible to both OSAS and Guidance for Review) */}
                        {rep.osasRemarks && (
                          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                                OSAS Remarks (By {rep.osasRemarksBy || 'OSAS Administrator'})
                              </span>
                              {rep.osasRemarksSavedAt && (
                                <span className="text-[10px] font-mono text-blue-700 dark:text-blue-300">
                                  {new Date(rep.osasRemarksSavedAt).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <p className="text-blue-950 dark:text-blue-100 font-semibold leading-relaxed whitespace-pre-line">
                              {rep.osasRemarks}
                            </p>
                          </div>
                        )}

                        {/* Completed Guidance Resolution Box (Visible to both Guidance & OSAS) */}
                        {hasSavedResolution && (
                          <div
                            className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                              !isResolved
                                ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                                : 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 dark:border-emerald-800/60">
                              <span
                                className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                                  !isResolved
                                    ? 'text-amber-900 dark:text-amber-200'
                                    : 'text-emerald-900 dark:text-emerald-200'
                                }`}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Guidance Resolution — {!isResolved ? 'Unresolved' : 'Case Resolved'}
                              </span>
                              {rep.resolvedAt && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  {new Date(rep.resolvedAt).toLocaleString()}
                                </span>
                              )}
                            </div>

                            {rep.problemResolved && (
                              <div>
                                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">
                                  Problem Resolved
                                </span>
                                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                                  {rep.problemResolved}
                                </p>
                              </div>
                            )}

                            {(() => {
                              const savedActionTaken =
                                rep.resolutionActionTaken ||
                                (rep.resolutionActionSteps && rep.resolutionActionSteps.length > 0
                                  ? rep.resolutionActionSteps
                                      .map((s) => s.actionTaken)
                                      .filter(Boolean)
                                      .join('\n')
                                  : '') ||
                                '';
                              if (!savedActionTaken) return null;
                              const lineCount = savedActionTaken
                                .split('\n')
                                .reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / 80)), 0);
                              return (
                                <div>
                                  <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block mb-1">
                                    Actions Taken by Guidance Advocate
                                  </span>
                                  <textarea
                                    rows={Math.max(2, lineCount)}
                                    readOnly
                                    value={savedActionTaken}
                                    className="w-full p-3 text-xs bg-white/90 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed focus:outline-none cursor-default resize-none overflow-hidden"
                                  />
                                </div>
                              );
                            })()}

                            {getCleanResolutionDetails(rep) && (
                              <div>
                                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">
                                  Resolution Details
                                </span>
                                <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line mt-0.5">
                                  {getCleanResolutionDetails(rep)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Endorsement Letter Summary (OSAS Admin only; never show Print Endorsement Letter in Guidance) */}
                        {isOsasAdmin && rep.endorsementLetter && (
                          <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-black text-purple-900 dark:text-purple-200 uppercase block">
                                Endorsement Letter for Higher Officer (#{rep.endorsementLetter.id})
                              </span>
                              <p className="text-purple-800 dark:text-purple-300 font-semibold mt-0.5">
                                To: {rep.endorsementLetter.higherOfficerName} ({rep.endorsementLetter.higherOfficerTitle}) •{' '}
                                {rep.endorsementLetter.subject}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Action Buttons Footer */}
                  {isExpanded && (() => {
                    const hasOsasSlipSent = Boolean(
                      rep.slipNotices && rep.slipNotices.some((s) => s.counselorTitle === 'OSAS Administrator')
                    );
                    const hasGuidanceSlipSent = Boolean(
                      rep.slipNotices && rep.slipNotices.some((s) => s.counselorTitle !== 'OSAS Administrator')
                    );

                    const hasOsasRemarksSaved = Boolean(
                      rep.osasRemarks && rep.osasRemarks.trim()
                    );
                    const hasEndorsementLetter = Boolean(rep.endorsementLetter);

                    return (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700 w-full">
                        {isOsasAdmin ? (
                          <>
                            {/* OSAS Administrator Actions: Send Slip Notice + Add OSAS Remarks + Create/Print Endorsement Letter */}
                            <button
                              type="button"
                              disabled={hasOsasSlipSent}
                              onClick={() => handleOpenSendSlipNotice(rep)}
                              className="w-full sm:w-52 min-h-[38px] px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                            >
                              <Send className="w-3.5 h-3.5 shrink-0" />
                              <span>Send Slip Notice</span>
                            </button>

                            <button
                              type="button"
                              disabled={hasOsasRemarksSaved}
                              onClick={() => handleOpenOsasRemarks(rep)}
                              className="w-full sm:w-52 min-h-[38px] px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                            >
                              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                              <span>Add OSAS Remarks</span>
                            </button>

                            {hasEndorsementLetter ? (
                              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEndorsementModal(rep)}
                                  className="w-full sm:w-auto min-h-[38px] px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                                >
                                  <FileSignature className="w-3.5 h-3.5 shrink-0" />
                                  <span>Update Endorsement Letter</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDirectPrintEndorsement(rep)}
                                  className="w-full sm:w-auto min-h-[38px] px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                                >
                                  <Printer className="w-3.5 h-3.5 shrink-0" />
                                  <span>Print Endorsement Letter</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenEndorsementModal(rep)}
                                className="w-full sm:w-52 min-h-[38px] px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                              >
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span>Create Endorsement Letter</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {/* Guidance Advocate Actions */}
                            <button
                              type="button"
                              disabled={hasGuidanceSlipSent}
                              onClick={() => handleOpenSendSlipNotice(rep)}
                              className="w-full sm:w-auto min-h-[36px] px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                            >
                              <Send className="w-3.5 h-3.5 shrink-0" />
                              <span>Send Slip Notice</span>
                            </button>

                            <button
                              type="button"
                              disabled={hasDisciplinaryActionForReport(rep)}
                              onClick={() => handleOpenCreateRecordModal(rep)}
                              className="w-full sm:w-auto min-h-[36px] px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                            >
                              <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                              <span>Create Disciplinary Action</span>
                            </button>

                            <button
                              type="button"
                              disabled={hasSavedResolution}
                              onClick={() => handleOpenCreateResolution(rep)}
                              className="w-full sm:w-auto min-h-[36px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Create Resolution</span>
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
          </>
        )}
      </div>

      {/* ===========================================================================
          MODAL 1: CREATE REPORT MODAL (Guidance Tab 1: Student Reports)
          Shows ONLY: Reported Student, Reported By, Complainant, Location, Date & Time, Description
          Button: Save Report Records
          =========================================================================== */}
      {createReportTarget && (
        <Modal
          isOpen={true}
          onClose={() => setCreateReportTarget(null)}
          title="Create Report"
          subtitle={`Student Report #${createReportTarget.id}`}
          maxWidth="lg"
        >
          <div className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Reported Student */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Reported Student
                </span>
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {createReportTarget.reportedStudentName}
                </p>
                {createReportTarget.reportedStudentId && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                    ID: {createReportTarget.reportedStudentId}
                  </p>
                )}
                {(createReportTarget.reportedStudentCourse || createReportTarget.reportedStudentYearLevel) && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {[createReportTarget.reportedStudentCourse, createReportTarget.reportedStudentYearLevel]
                      .filter(Boolean)
                      .join(' - ')}
                  </p>
                )}
              </div>

              {/* 2. Reported By & 3. Complainant */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Reported By
                  </span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {createReportTarget.isAnonymousReporter ||
                    createReportTarget.reporterRole === 'Anonymous Reporter'
                      ? 'Anonymous Reporter'
                      : createReportTarget.reporterRole || 'Student'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Complainant
                  </span>
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    {createReportTarget.isAnonymousReporter ||
                    createReportTarget.reporterRole === 'Anonymous Reporter'
                      ? 'Anonymous Reporter'
                      : createReportTarget.reporterName}
                  </p>
                  {!createReportTarget.isAnonymousReporter &&
                    createReportTarget.reporterRole !== 'Anonymous Reporter' && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {createReportTarget.reporterStudentId} • {createReportTarget.reporterCourse} -{' '}
                        {createReportTarget.reporterYearLevel}
                        {createReportTarget.reporterContactNumber
                          ? ` • ${createReportTarget.reporterContactNumber}`
                          : ''}
                      </p>
                    )}
                </div>
              </div>
            </div>

            {/* 4. Location & 5. Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Location
                </span>
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span>{createReportTarget.location}</span>
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Date &amp; Time
                </span>
                <p className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>{formatReportDateTime(createReportTarget)}</span>
                </p>
              </div>
            </div>

            {/* 6. Description */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                Description
              </span>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                {createReportTarget.description}
              </p>
            </div>

            {/* Reason for Referral (shown ONLY if Referred from OSAS) */}
            {(createReportTarget.referredFromOsas || createReportTarget.isReferredFromOsas) && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Reason for Referral
                </span>
                <p className="text-slate-800 dark:text-slate-200 font-semibold leading-relaxed whitespace-pre-line">
                  {createReportTarget.incidentType ||
                    (createReportTarget.osasReferralReasons && createReportTarget.osasReferralReasons.join(', ')) ||
                    'Referred from OSAS'}
                </p>
              </div>
            )}

            {createReportTarget.evidenceFileName && (
              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" /> {createReportTarget.evidenceFileName}
                </span>
                {createReportTarget.evidenceUrl && createReportTarget.evidenceUrl.startsWith('data:image/') && (
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewImage(createReportTarget.evidenceUrl || null)}
                    className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                  >
                    View Image
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCreateReportTarget(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveReportToRecords(createReportTarget)}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <FolderCheck className="w-4 h-4" />
                <span>Save Report Records</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===========================================================================
          MODAL 2: VIEW COMPLETE SAVED RECORD DETAILS
          =========================================================================== */}
      {viewRecordTarget && (
        <Modal
          isOpen={true}
          onClose={() => setViewRecordTarget(null)}
          title={`Student Report Record — #${viewRecordTarget.id}`}
          subtitle={`Saved Report Record • Submitted ${formatReportDateTime(viewRecordTarget)}`}
          maxWidth="xl"
        >
          <div className="space-y-4 p-1 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase block">Reported Student</span>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                  {viewRecordTarget.reportedStudentName}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                  ID: {viewRecordTarget.reportedStudentId || 'Not specified'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Course &amp; Year:{' '}
                  {[viewRecordTarget.reportedStudentCourse, viewRecordTarget.reportedStudentYearLevel]
                    .filter(Boolean)
                    .join(' - ') || 'N/A'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase block">
                  Reported By &amp; Complainant
                </span>
                <p className="font-bold text-slate-900 dark:text-white">
                  Reported By:{' '}
                  {viewRecordTarget.isAnonymousReporter ||
                  viewRecordTarget.reporterRole === 'Anonymous Reporter'
                    ? 'Anonymous Reporter'
                    : viewRecordTarget.reporterRole || 'Student'}
                </p>
                <p className="font-bold text-slate-900 dark:text-white">
                  Complainant:{' '}
                  {viewRecordTarget.isAnonymousReporter ||
                  viewRecordTarget.reporterRole === 'Anonymous Reporter'
                    ? 'Anonymous Reporter'
                    : viewRecordTarget.reporterName}
                </p>
                {!viewRecordTarget.isAnonymousReporter &&
                  viewRecordTarget.reporterRole !== 'Anonymous Reporter' && (
                    <p className="text-[11px] text-slate-500">
                      ID: {viewRecordTarget.reporterStudentId} • {viewRecordTarget.reporterCourse} -{' '}
                      {viewRecordTarget.reporterYearLevel}
                    </p>
                  )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase block">Location</span>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">{viewRecordTarget.location}</p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase block">Date &amp; Time</span>
                <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatReportDateTime(viewRecordTarget)}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Description</span>
              <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {viewRecordTarget.description}
              </p>
            </div>

            {viewRecordTarget.referredToOsas && (
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-[11px] font-black text-indigo-900 dark:text-indigo-200 uppercase">
                    Guidance Referral to OSAS Details
                  </h5>
                  {Boolean(
                    (viewRecordTarget.osasRemarks && viewRecordTarget.osasRemarks.trim()) ||
                      viewRecordTarget.endorsementLetter
                  ) && (
                    <span className="px-2 py-0.5 text-[10px] font-black rounded-md uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0">
                      Completed
                    </span>
                  )}
                </div>
                <p>
                  <strong>Date Referred:</strong> {viewRecordTarget.osasReferralDate} •{' '}
                  <strong>Referred By:</strong> {viewRecordTarget.osasReferralBy} (
                  {viewRecordTarget.osasReferralDesignation || 'Guidance Advocate'})
                </p>
                <p>
                  <strong>Reasons for Intervention:</strong>{' '}
                  {(viewRecordTarget.osasReferralReasons || []).join(', ')}
                </p>
                <p>
                  <strong>Concerns &amp; Observations:</strong> {viewRecordTarget.osasReferralDescription}
                </p>
                {viewRecordTarget.osasReferralNextSteps && (
                  <p>
                    <strong>Follow-up Plan / Next Steps:</strong> {viewRecordTarget.osasReferralNextSteps}
                  </p>
                )}
                {viewRecordTarget.osasReferralActionTakenSummary && (
                  <p>
                    <strong>Summary of Action Taken:</strong> {viewRecordTarget.osasReferralActionTakenSummary}
                  </p>
                )}
              </div>
            )}

            {viewRecordTarget.osasRemarks && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-1">
                <h5 className="text-[11px] font-black text-blue-900 dark:text-blue-200 uppercase">
                  OSAS Remarks ({viewRecordTarget.osasRemarksBy || 'OSAS Administrator'})
                </h5>
                <p className="text-blue-950 dark:text-blue-100 font-semibold whitespace-pre-line">
                  {viewRecordTarget.osasRemarks}
                </p>
              </div>
            )}

            {viewRecordTarget.resolutionDetails && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-1">
                <h5 className="text-[11px] font-black text-emerald-900 dark:text-emerald-200 uppercase">
                  Guidance Resolution ({viewRecordTarget.resolutionOutcome || 'RESOLVED'})
                </h5>
                {viewRecordTarget.resolutionActionTaken && (
                  <p>
                    <strong>Action Taken:</strong> {viewRecordTarget.resolutionActionTaken}
                  </p>
                )}
                <p className="whitespace-pre-line">{viewRecordTarget.resolutionDetails}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              {(() => {
                const modalSlipSent = isOsasAdmin
                  ? Boolean(
                      viewRecordTarget.slipNotices &&
                        viewRecordTarget.slipNotices.some((s) => s.counselorTitle === 'OSAS Administrator')
                    )
                  : Boolean(
                      viewRecordTarget.slipNotices &&
                        viewRecordTarget.slipNotices.some((s) => s.counselorTitle !== 'OSAS Administrator')
                    );

                const modalOsasRemarksSaved = Boolean(
                  viewRecordTarget.osasRemarks && viewRecordTarget.osasRemarks.trim()
                );

                return (
                  <>
                    <button
                      type="button"
                      disabled={modalSlipSent}
                      onClick={() => handleOpenSendSlipNotice(viewRecordTarget)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Send Slip
                    </button>

                    {isOsasAdmin ? (
                      <button
                        type="button"
                        disabled={modalOsasRemarksSaved}
                        onClick={() => {
                          const rep = viewRecordTarget;
                          setViewRecordTarget(null);
                          handleOpenOsasRemarks(rep);
                        }}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Add OSAS Remarks
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isResolutionSaved(viewRecordTarget)}
                          onClick={() => {
                            const rep = viewRecordTarget;
                            setViewRecordTarget(null);
                            handleOpenCreateResolution(rep);
                          }}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Create Resolution
                        </button>
                      </>
                    )}
                  </>
                );
              })()}

              <button
                type="button"
                onClick={() => setViewRecordTarget(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===========================================================================
          MODAL 3: SEND SLIP NOTICE MODAL (Requirement 3)
          - Dear: selectable/typeable student name with an X clear button inside/end of field
          - Student information/contact fields use placeholder only, with no default values
          - Date and Time properly selectable/set
          - Six For checkboxes displayed 2 per row (grid-cols-2)
          - Replace Guidance Counselor with Guidance Advocate
          =========================================================================== */}
      {isSlipNoticeModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsSlipNoticeModalOpen(false)}
          title="Send Slip Notice"
          subtitle={
            isOsasAdmin
              ? 'Official Office of Student Affairs and Services (OSAS) Call Slip Notice'
              : 'Official Guidance and Counseling Office Call Slip Notice'
          }
          maxWidth="md"
        >
          <div className="space-y-4 p-1 text-xs">
            {/* Auto Date Sent */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-600 dark:text-slate-300">Date Sent:</span>
              <input
                type="date"
                value={slipDateSent}
                readOnly
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Dear: Student Name & Information */}
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black text-slate-900 dark:text-white">
                    Dear: *
                  </label>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    Student Full Name Required
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={slipStudentName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSlipStudentName(val);
                      setShowStudentDropdown(true);
                      const matched = allRegisteredStudents.find(
                        (s) => s.fullName.toLowerCase().trim() === val.toLowerCase().trim()
                      );
                      if (matched) {
                        setSlipStudentId(matched.studentId || matched.id || '');
                        setSlipCourseYear(
                          matched.academicProgram || matched.course
                            ? `${matched.academicProgram || matched.course}${matched.yearLevel ? ` - ${matched.yearLevel}` : ''}`
                            : ''
                        );
                        setSlipContactNumber(matched.contactNumber || (matched as any).phoneNumber || '');
                      }
                    }}
                    onFocus={() => {
                      setShowStudentDropdown(true);
                    }}
                    placeholder="Student Full Name Required"
                    className="w-full pl-3.5 pr-9 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-slate-900 dark:text-white placeholder:text-amber-600/80 dark:placeholder:text-amber-400/80 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {slipStudentName && (
                    <button
                      type="button"
                      onClick={handleClearSlipStudentName}
                      title="Clear student name"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {showStudentDropdown && filteredSlipStudents.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredSlipStudents.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleSelectStudentForSlip(st)}
                        className="w-full px-3 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {st.fullName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {st.studentId || st.id} • {st.course || st.academicProgram || 'N/A'} {st.yearLevel || ''}
                            {st.contactNumber ? ` • ${st.contactNumber}` : ''}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-amber-600">Select</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Student Information / Contact fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Student ID
                  </label>
                  <input
                    type="text"
                    value={slipStudentId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSlipStudentId(val);
                      const cleanVal = val.trim().toLowerCase();
                      if (cleanVal) {
                        const pool =
                          allRegisteredStudents.length > 0
                            ? allRegisteredStudents
                            : getUsers().filter((u) => u.role === 'STUDENT' || Boolean(u.studentId));
                        const matched = pool.find(
                          (s) =>
                            (s.studentId && s.studentId.toLowerCase().trim() === cleanVal) ||
                            (s.id && s.id.toLowerCase().trim() === cleanVal)
                        );
                        if (matched) {
                          setSlipStudentName(
                            matched.fullName ||
                              [matched.firstName, matched.middleName, matched.surname, matched.extensionName]
                                .filter(Boolean)
                                .join(' ')
                          );
                          setSlipCourseYear(
                            matched.academicProgram || matched.course
                              ? `${matched.academicProgram || matched.course}${matched.yearLevel ? ` - ${matched.yearLevel}` : ''}`
                              : ''
                          );
                          setSlipContactNumber(matched.contactNumber || (matched as any).phoneNumber || '');
                        }
                      }
                    }}
                    placeholder="e.g. 2026-000123"
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Course &amp; Level
                  </label>
                  <input
                    type="text"
                    value={slipCourseYear}
                    onChange={(e) => setSlipCourseYear(e.target.value)}
                    placeholder="e.g. BSIT - 1st Year"
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={slipContactNumber}
                    onChange={(e) => setSlipContactNumber(e.target.value)}
                    placeholder="e.g. 09171234567"
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Kindly visit me at the Office on + Selectable Date & Time */}
            <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-3">
              <p className="text-xs font-bold text-blue-950 dark:text-blue-200">
                {isOsasAdmin
                  ? 'Kindly visit me at the Office of Student Affairs and Services (OSAS) on'
                  : 'Kindly visit me at the Guidance and Counseling Office on'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={slipVisitDate}
                    onChange={(e) => setSlipVisitDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Time *
                  </label>
                  <input
                    type="time"
                    value={slipVisitTime24}
                    onChange={(e) => setSlipVisitTime24(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Four For checkboxes displayed 2 per row (grid-cols-2) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  For: *
                </label>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  Select at least one
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SLIP_PURPOSES.map((purpose) => {
                  const isChecked = slipPurposes.includes(purpose);
                  return (
                    <label
                      key={purpose}
                      onClick={() => handleTogglePurpose(purpose)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-amber-100/80 dark:bg-amber-950/80 border-amber-400 text-amber-950 dark:text-amber-100'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-amber-600 text-white' : 'border border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{purpose}</span>
                    </label>
                  );
                })}
              </div>
              {(slipPurposes.includes('Other Services') || slipPurposes.includes('Others')) && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={slipOtherService}
                    onChange={(e) => setSlipOtherService(e.target.value)}
                    placeholder="Specify other service..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              )}
              {slipError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-200 font-bold text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{slipError}</span>
                </div>
              )}
            </div>

            {/* Thank you very much. + Guidance Advocate field */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <p className="text-xs font-bold italic text-slate-700 dark:text-slate-300">
                Thank you very much.
              </p>

              <div>
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase mb-1">
                  {isOsasAdmin ? 'OSAS Administrator' : 'Guidance Advocate'}
                </label>
                <input
                  type="text"
                  value={slipAdvocateName}
                  onChange={(e) => setSlipAdvocateName(e.target.value)}
                  placeholder={isOsasAdmin ? 'OSAS Administrator Name' : 'Guidance Advocate Name'}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsSlipNoticeModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendSlipNotice}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Slip</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===========================================================================
          MODAL 4: REFER TO OSAS OFFICE
          Shows only:
          Reported Student | Reported By/Complainant | Location | Date & Time | Reason for Referral | Description/Concerns | Submit Referral Record to OSAS
          =========================================================================== */}
      {referModalReport && (
        <Modal
          isOpen={true}
          onClose={() => setReferModalReport(null)}
          title="Refer to OSAS Office"
          subtitle={`Refer Student Report #${referModalReport.id} to OSAS Office for review and administrative intervention`}
          maxWidth="lg"
        >
          <form onSubmit={handleSubmitReferralToOsas} className="space-y-4 p-1 text-xs">
            {refFormError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-200 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{refFormError}</span>
              </div>
            )}

            {/* 1. Reported Student */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Reported Student
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                {referModalReport.reportedStudentName}
                {referModalReport.reportedStudentId ? ` (${referModalReport.reportedStudentId})` : ''}
              </p>
              {(referModalReport.reportedStudentCourse || referModalReport.reportedStudentYearLevel) && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {[referModalReport.reportedStudentCourse, referModalReport.reportedStudentYearLevel]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              )}
            </div>

            {/* 2. Reported By / Complainant */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Reported By / Complainant
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                {referModalReport.isAnonymousReporter ? 'Anonymous Reporter' : referModalReport.reporterName}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Role: {referModalReport.isAnonymousReporter ? 'Anonymous Reporter' : referModalReport.reporterRole || 'Student'}
                {!referModalReport.isAnonymousReporter && referModalReport.reporterStudentId ? ` (${referModalReport.reporterStudentId})` : ''}
              </p>
            </div>

            {/* 3. Location & 4. Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Location
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span>{referModalReport.location}</span>
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Date &amp; Time
                </span>
                <p className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>{formatReportDateTime(referModalReport)}</span>
                </p>
              </div>
            </div>

            {/* 1. Description */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1">
                Description *
              </label>
              <textarea
                rows={4}
                required
                value={refDescription}
                onChange={(e) => setRefDescription(e.target.value)}
                placeholder="Description submitted by student..."
                className="w-full p-3.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* 2. Reason for Referral */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1">
                Reason for Referral *
              </label>
              <input
                type="text"
                required
                value={refReasonText}
                onChange={(e) => setRefReasonText(e.target.value)}
                placeholder="Enter reason for referral to OSAS Office..."
                className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* 7. Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReferModalReport(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Referral Record to OSAS</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===========================================================================
          MODAL 5: OSAS REMARKS MODAL (Requirement 5)
          Saves OSAS Remarks to the same Firestore record; automatically visible to Guidance
          =========================================================================== */}
      {osasRemarksTarget && (
        <Modal
          isOpen={true}
          onClose={() => setOsasRemarksTarget(null)}
          title={`OSAS Remarks — Report #${osasRemarksTarget.id}`}
          subtitle={`Referred Student: ${osasRemarksTarget.reportedStudentName}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveOsasRemarks} className="space-y-4 p-1 text-xs">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase block">
                Guidance Referral Summary
              </span>
              <p className="font-bold text-slate-900 dark:text-white">
                {osasRemarksTarget.reportedStudentName} ({osasRemarksTarget.reportedStudentId || 'No ID'})
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                {osasRemarksTarget.osasReferralDescription || osasRemarksTarget.description}
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1.5">
                OSAS Remarks (Describe what OSAS did to address/resolve the case) *
              </label>
              <textarea
                rows={4}
                required
                value={osasRemarksInput}
                onChange={(e) => setOsasRemarksInput(e.target.value)}
                placeholder="Enter detailed OSAS intervention remarks, conference outcomes, and actions taken..."
                className="w-full p-3.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOsasRemarksTarget(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save OSAS Remarks</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===========================================================================
          MODAL 6: CREATE RESOLUTION MODAL
          Shows:
          1. Student Information at the top
          2. Problem Resolved — the actual concern/problem addressed
          3. Action Taken — numbered step-by-step rows (Step/Action, Date & Time, Action Taken, Person Involved)
          4. Resolution Outcome (Case Resolved / Unresolved for Escalation)
          5. Resolution Details — text field
          Saves to the same original Firestore report
          =========================================================================== */}
      {resolutionTarget && (
        <Modal
          isOpen={true}
          onClose={() => setResolutionTarget(null)}
          title={`Create Resolution — Report #${resolutionTarget.id}`}
          subtitle="Official Guidance & Counseling Case Resolution"
          maxWidth="lg"
        >
          <form onSubmit={handleSaveResolution} className="space-y-4 p-1 text-xs">
            {resolutionError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 font-bold">
                {resolutionError}
              </div>
            )}

            {/* 1. Student Information at the top */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                    Student Information
                  </span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md">
                  Report #{resolutionTarget.id}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    Student Name
                  </span>
                  <p className="font-black text-slate-900 dark:text-white mt-0.5">
                    {resolutionTarget.reportedStudentName}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    Student ID
                  </span>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {resolutionTarget.reportedStudentId || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    Course &amp; Level
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {[resolutionTarget.reportedStudentCourse, resolutionTarget.reportedStudentYearLevel]
                      .filter(Boolean)
                      .join(' - ') || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Contact Number</span>
                  <span className="font-mono font-bold">{resolutionTarget.contactNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Incident Location</span>
                  <span className="font-semibold">{resolutionTarget.location}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Date &amp; Time</span>
                  <span>{formatReportDateTime(resolutionTarget)}</span>
                </div>
              </div>
            </div>

            {/* 2. Case Resolved — not editable */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1">
                Case Resolved *
              </label>
              <p className="text-[11px] text-slate-500 mb-1.5">
                The actual concern or problem addressed during the counseling / intervention process.
              </p>
              <textarea
                rows={2}
                readOnly
                disabled
                value={resProblemResolved}
                className="w-full p-3 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-300 cursor-not-allowed"
              />
            </div>

            {/* 3. Action Taken — single step-by-step text field */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1">
                Action Taken *
              </label>
              <p className="text-[11px] text-slate-500 mb-1.5">
                Enter the action taken step-by-step.
              </p>
              <textarea
                rows={4}
                required
                value={resolutionActionTaken}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setResolutionActionTaken(nextVal);
                  if (resolutionTarget) {
                    const updatedDraft = saveDraftStudentReportActionTaken(
                      resolutionTarget.id,
                      nextVal,
                      resProblemResolved
                    );
                    if (updatedDraft) {
                      setResolutionTarget(updatedDraft);
                    }
                  }
                }}
                placeholder="Enter action taken step-by-step..."
                className="w-full p-3.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* 4. Resolution Outcome */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1.5">
                Resolution Outcome *
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setResolutionOutcome('RESOLVED');
                  }}
                  className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    resolutionOutcome === 'RESOLVED'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Case Resolved</span>
                </button>

                <button
                  type="button"
                  disabled={hasDisciplinaryActionForReport(resolutionTarget) || isResolutionSaved(resolutionTarget)}
                  onClick={() => {
                    if (!hasDisciplinaryActionForReport(resolutionTarget) && !isResolutionSaved(resolutionTarget)) {
                      setResolutionOutcome('UNRESOLVED');
                    }
                  }}
                  className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    resolutionOutcome === 'UNRESOLVED'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span>Unresolved</span>
                </button>
              </div>
            </div>

            {/* OSAS Administrator Remarks — in a separate section below Resolution Outcome and above Resolution Details (shown only when available) */}
            {resolutionTarget.osasRemarks && (
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-1.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-black uppercase text-blue-950 dark:text-blue-200">
                    OSAS Administrator Remarks
                  </span>
                  {resolutionTarget.osasRemarksBy && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-300 font-bold">
                      • {resolutionTarget.osasRemarksBy}
                    </span>
                  )}
                </div>
                <p className="text-xs text-blue-900 dark:text-blue-100 whitespace-pre-line leading-relaxed font-medium pl-6">
                  {resolutionTarget.osasRemarks}
                </p>
              </div>
            )}

            {/* 5. Resolution Details — text field */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1">
                Resolution Details *
              </label>
              <textarea
                rows={4}
                required
                value={resolutionDetails}
                onChange={(e) => setResolutionDetails(e.target.value)}
                placeholder="Enter detailed resolution narrative, conditions, agreements, follow-up schedule, and closing remarks..."
                className="w-full p-3.5 text-xs border rounded-2xl text-slate-900 dark:text-white bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={hasDisciplinaryActionForReport(resolutionTarget) || resolutionOutcome !== 'UNRESOLVED'}
                onClick={() => {
                  if (!resolutionDetails.trim()) {
                    setResolutionError('Please enter the resolution details.');
                    return;
                  }

                  const actor = currentUser?.fullName || 'Maria Mel B. Glemao (Guidance Advocate)';
                  const actionTakenText =
                    resolutionActionTaken.trim() || 'Reviewed and referred to OSAS Office by Guidance Advocate.';
                  const cleanSteps: ResolutionActionStep[] = [
                    {
                      stepNumber: 1,
                      stepTitle: 'Action Taken',
                      dateTime: new Date().toISOString().slice(0, 16),
                      actionTaken: actionTakenText,
                      responsiblePerson: actor,
                      personInvolved: actor,
                    },
                  ];

                  const savedResolution = saveStudentReportResolution(
                    resolutionTarget.id,
                    {
                      problemResolved: (resProblemResolved || resolutionTarget.description || '').trim(),
                      resolutionActionSteps: cleanSteps,
                      resolutionActionTaken: actionTakenText,
                      resolutionOutcome: 'UNRESOLVED',
                      resolutionDetails: resolutionDetails.trim(),
                      referToOsas: true,
                    },
                    actor
                  );

                  if (savedResolution && viewRecordTarget && viewRecordTarget.id === savedResolution.id) {
                    setViewRecordTarget(savedResolution);
                  }
                  setResolutionTarget(null);
                  refreshData();
                  if (!isOsasAdmin) {
                    setActiveTab('report_resolutions');
                  }
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <HeartHandshake className="w-4 h-4" />
                <span>Refer to OSAS Office</span>
              </button>
              <button
                type="submit"
                disabled={resolutionOutcome !== 'RESOLVED'}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Resolution</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===========================================================================
          MODAL 7: CREATE ENDORSEMENT LETTER FOR HIGHER OFFICER (Requirement 6 & 7)
          =========================================================================== */}
      {endorsementTarget && (
        <Modal
          isOpen={true}
          onClose={() => setEndorsementTarget(null)}
          title={`Endorsement Letter — Report #${endorsementTarget.id}`}
          subtitle="Official OSAS Endorsement Letter"
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEndorsementLetter} className="space-y-4 p-1 text-xs">
            {endError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-bold">
                {endError}
              </div>
            )}

            {/* Official Endorsement Letter Template Preview & Editor */}
            <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-xs">
              {/* Institutional Header */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <div className="flex justify-center mb-1">
                  <CollegeLogo className="w-14 h-14 object-contain" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  Republic of the Philippines • Province of Aurora
                </p>
                <h1 className="text-base font-black uppercase tracking-wide text-slate-900">
                  Dingalan Community College
                </h1>
                <p className="text-xs font-bold text-slate-700">
                  Office of Student Affairs and Services (OSAS)
                </p>
              </div>

              {/* Date & Addressee Block */}
              <div className="space-y-2.5 text-xs leading-relaxed">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Date</label>
                  <input
                    type="text"
                    required
                    value={endHigherOfficerTitle}
                    onChange={(e) => setEndHigherOfficerTitle(e.target.value)}
                    placeholder="Date"
                    className="w-full sm:w-72 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Name of Official Position *
                  </label>
                  <input
                    type="text"
                    required
                    value={endHigherOfficerName}
                    onChange={(e) => setEndHigherOfficerName(e.target.value)}
                    placeholder="Enter Name of Official Position (e.g., College President)"
                    className="w-full sm:w-96 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Office *
                  </label>
                  <input
                    type="text"
                    required
                    value={endInstitutionName}
                    onChange={(e) => setEndInstitutionName(e.target.value)}
                    placeholder="Enter Destination Office (e.g., Office of the President)"
                    className="w-full sm:w-96 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={endInstitutionLocation}
                    onChange={(e) => setEndInstitutionLocation(e.target.value)}
                    placeholder="Enter Destination Location (e.g., Dingalan, Aurora)"
                    className="w-full sm:w-96 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900"
                  />
                </div>
              </div>

              {/* Salutation & Body */}
              <div className="space-y-4 text-xs leading-relaxed text-slate-900">
                <p className="font-bold">Dear Sir/Ma&apos;am:</p>

                <p>Greetings from the Office of Student Affairs and Services.</p>

                <div className="space-y-2">
                  <p>
                    This office received a concern from{' '}
                    <span className="font-bold text-slate-900">[{endSubject || 'Student Name, Course, Year & Section'}]</span>{' '}
                    regarding{' '}
                    <span className="font-bold text-slate-900">[{endCaseBackground || 'Brief Description of Concerns'}]</span>.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        Student Name, Course, Year &amp; Section *
                      </label>
                      <input
                        type="text"
                        required
                        value={endSubject}
                        onChange={(e) => setEndSubject(e.target.value)}
                        placeholder="Student Name, Course, Year & Section"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        Brief Description of Concerns *
                      </label>
                      <input
                        type="text"
                        required
                        value={endCaseBackground}
                        onChange={(e) => setEndCaseBackground(e.target.value)}
                        placeholder="Brief Description of Concerns"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <p>
                  After initial assessment, this concern is beyond the authority of the Office of Student Affairs and Services (OSAS) to resolve. We therefore respectfully endorse it to your office for your review and appropriate action.
                </p>

                <p>Supporting documents, if any, are attached for your reference.</p>

                <p>Thank you for your kind attention and support for our student.</p>
              </div>

              {/* Signatories */}
              <div className="space-y-4 pt-4 text-xs text-slate-900">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Respectfully Yours:
                  </label>
                  <input
                    type="text"
                    required
                    value={endActionsTaken}
                    onChange={(e) => setEndActionsTaken(e.target.value)}
                    placeholder="OSAS Administrator Name"
                    className="w-full sm:w-72 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                    OSAS Administrator
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Approved By:
                    </label>
                    <input
                      type="text"
                      required
                      value={endEndorsedByName}
                      onChange={(e) => setEndEndorsedByName(e.target.value)}
                      placeholder="Cristy C. Domingo"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                      College President
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                      Noted By:
                    </label>
                    <input
                      type="text"
                      required
                      value={endNotedByName}
                      onChange={(e) => setEndNotedByName(e.target.value)}
                      placeholder="Guidance Advocate Name"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                      Guidance Advocate
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEndorsementTarget(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Endorsement Letter</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===========================================================================
          MODAL 8: DISCIPLINARY ACTION FORM FOR SEVERE CASES (Requirement 2 & 7)
          Sanction is only created when actually required; does not auto-sanction.
          =========================================================================== */}
      {isCreatingRecord && recordTargetReport && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsCreatingRecord(false);
            setRecordTargetReport(null);
          }}
          title={`Disciplinary Action Form — Report #${recordTargetReport.id}`}
          subtitle="Severe cases may use Disciplinary Action Form. A Sanction is only created when actually required."
          maxWidth="xl"
        >
          <DisciplinaryActionForm
            isModal={true}
            sourceReportId={recordTargetReport.id}
            initialData={{
              reportedStudentName: recordTargetReport.reportedStudentName,
              reportedStudentId: recordTargetReport.reportedStudentId || '',
              reportedStudentCourse: recordTargetReport.reportedStudentCourse || '',
              reportedStudentYearLevel: recordTargetReport.reportedStudentYearLevel || '',
              reportedStudentContact: recordTargetReport.reportedStudentContact || '',
              reportedStudentAddress: recordTargetReport.reportedStudentAddress || '',
              location: recordTargetReport.location,
              description: recordTargetReport.description,
              reportDate: recordTargetReport.reportDate || (recordTargetReport.submittedAt ? recordTargetReport.submittedAt.split('T')[0] : undefined),
              reportTime: recordTargetReport.reportTime,
              incidentTypes: [],
              actionTaken: recordTargetReport.actionTaken || '',
              sanction: '',
              evidenceFileName: recordTargetReport.evidenceFileName,
              evidenceUrl: recordTargetReport.evidenceUrl,
            }}
            onCancel={() => {
              setIsCreatingRecord(false);
              setRecordTargetReport(null);
            }}
            onSuccess={() => {
              setIsCreatingRecord(false);
              setRecordTargetReport(null);
              refreshData();
            }}
          />
        </Modal>
      )}

      {/* Confirm Archive Resolution */}
      {archiveResolutionTarget && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setArchiveResolutionTarget(null)}
          onConfirm={handleConfirmArchiveResolution}
          title="Are you sure you want to archive this?"
          message={`Are you sure you want to archive the record for "${archiveResolutionTarget.reportedStudentName}" (${archiveResolutionTarget.reportedStudentId || archiveResolutionTarget.id})? It will be moved to System Settings > System Archive Vault without permanently deleting it.`}
          confirmText="Yes"
          cancelText="No"
          type="danger"
          icon="trash"
        />
      )}
      </div>

      {/* ===========================================================================
          PRINTABLE HARD-COPY ENDORSEMENT LETTER VIEW (Requirement 4 & 5)
          =========================================================================== */}
      {printEndorsementReport && printEndorsementReport.endorsementLetter && (
        <div className="direct-print-container">
          <div id="printable-endorsement-slip" className="printable-document bg-white text-slate-900 w-full max-w-3xl p-8 space-y-6 print:max-w-none print:p-6">
            {/* Institutional Letterhead */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <div className="flex justify-center mb-1">
                <CollegeLogo className="w-16 h-16 object-contain" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
                Republic of the Philippines • Province of Aurora
              </p>
              <h1 className="text-lg font-black uppercase tracking-wide text-slate-900">
                Dingalan Community College
              </h1>
              <p className="text-xs font-bold text-slate-700">
                Office of Student Affairs and Services (OSAS)
              </p>
            </div>

            {/* Official Endorsement Letter Content */}
            {(() => {
              const letter = printEndorsementReport.endorsementLetter;
              const dateDisplay =
                letter.higherOfficerTitle && letter.higherOfficerTitle.trim()
                  ? letter.higherOfficerTitle.trim()
                  : new Date(letter.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    });
              const studentCourseYearDisplay =
                letter.subject && !letter.subject.startsWith('Official Case Endorsement')
                  ? letter.subject
                  : [
                      letter.studentName || printEndorsementReport.reportedStudentName || printEndorsementReport.reporterName,
                      letter.courseYear ||
                        [printEndorsementReport.reportedStudentCourse, printEndorsementReport.reportedStudentYearLevel]
                          .filter(Boolean)
                          .join(', '),
                    ]
                      .filter(Boolean)
                      .join(', ');
              const concernDisplay =
                letter.caseBackground ||
                printEndorsementReport.osasReferralDescription ||
                printEndorsementReport.problemResolved ||
                printEndorsementReport.description;
              const osasAdminSignatory =
                letter.actionsTaken || 'Princess Ann T. Ruzol';
              const approvedBySignatory =
                letter.endorsedByName || 'Cristy C. Domingo';
              const notedBySignatory =
                letter.notedByName || 'Maria Mel B. Glemao';

              return (
                <div className="space-y-5 text-xs leading-relaxed text-slate-900 pt-2">
                  {/* Date & Addressee */}
                  <div className="space-y-1">
                    <p className="font-bold">{dateDisplay}</p>
                    {letter.higherOfficerName ? <p className="font-bold">{letter.higherOfficerName}</p> : null}
                    {letter.institutionName ? <p className="font-semibold">{letter.institutionName}</p> : null}
                    {letter.institutionLocation ? <p>{letter.institutionLocation}</p> : null}
                  </div>

                  <p className="font-bold pt-2">Dear Sir/Ma&apos;am:</p>

                  <p>Greetings from the Office of Student Affairs and Services.</p>

                  <p>
                    This office received a concern from <strong>{studentCourseYearDisplay}</strong> regarding{' '}
                    <strong>{concernDisplay}</strong>.
                  </p>

                  <p>
                    {letter.reasonForEndorsement ||
                      'After initial assessment, this concern is beyond the authority of the Office of Student Affairs and Services (OSAS) to resolve. We therefore respectfully endorse it to your office for your review and appropriate action.'}
                  </p>

                  <p>
                    {letter.recommendation ||
                      'Supporting documents, if any, are attached for your reference.'}
                  </p>

                  <p>Thank you for your kind attention and support for our student.</p>

                  <div className="space-y-4 pt-6">
                    <div>
                      <p className="font-semibold text-slate-700">Respectfully Yours:</p>
                      <p className="font-bold text-slate-900 mt-1">{osasAdminSignatory}</p>
                      <p className="text-[11px] text-slate-600">OSAS Administrator</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6 pt-2">
                      <div>
                        <p className="font-semibold text-slate-700">Approved By:</p>
                        <p className="font-bold text-slate-900 mt-1">{approvedBySignatory}</p>
                        <p className="text-[11px] text-slate-600">{letter.endorsedByTitle || 'College President'}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">Noted By:</p>
                        <p className="font-bold text-slate-900 mt-1">{notedBySignatory}</p>
                        <p className="text-[11px] text-slate-600">{letter.notedByTitle || 'Guidance Advocate'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {selectedPreviewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 print:hidden"
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute top-3 right-3 p-1.5 bg-slate-800 text-white rounded-full hover:bg-slate-700 z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={selectedPreviewImage} alt="Evidence Full Preview" className="w-full h-auto rounded-xl" />
          </div>
        </div>
      )}

      {/* ===========================================================================
          PRINTABLE HARD-COPY REPORT RESOLUTION FORM
          =========================================================================== */}
      {printResolutionReport && (
        <div className="direct-print-container">
          <div id="printable-resolution-slip" className="printable-document bg-white text-slate-900 w-full max-w-3xl p-8 space-y-6 print:max-w-none print:p-6">
            {/* Institutional Letterhead */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <div className="flex justify-center mb-1">
                <CollegeLogo className="w-16 h-16 object-contain" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
                Republic of the Philippines • Province of Aurora
              </p>
              <h1 className="text-lg font-black uppercase tracking-wide text-slate-900">
                Dingalan Community College
              </h1>
              <p className="text-xs font-bold text-slate-700">
                Guidance and Counseling Office &amp; Office of Student Affairs and Services (OSAS)
              </p>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 pt-2">
                OFFICIAL STUDENT REPORT RESOLUTION FORM
              </h2>
            </div>

            {/* Resolution Metadata */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-slate-300">
              <div>
                <span className="font-bold text-slate-600">Resolution Reference: </span>
                <span className="font-mono font-black text-slate-900">Resolution #{printResolutionReport.id}</span>
              </div>
              <div>
                <span className="font-bold text-slate-600">Resolution Status: </span>
                <span className="font-black uppercase text-slate-900">
                  {isReportCaseResolved(printResolutionReport)
                    ? 'Case Resolved'
                    : 'Unresolved'}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-600">Date Resolved: </span>
                <span className="font-mono font-semibold text-slate-900">
                  {printResolutionReport.resolvedAt
                    ? new Date(printResolutionReport.resolvedAt).toLocaleString()
                    : new Date().toLocaleString()}
                </span>
              </div>
            </div>

            {/* Side-by-side: Student Information & Case Information - Without Numbering */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              {/* Student Information */}
              <div className="space-y-2 border border-slate-300 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-black uppercase tracking-wider text-slate-900 mb-2">
                    Student Information
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Reported Student</span>
                      <p className="font-black text-slate-900 mt-0.5">{printResolutionReport.reportedStudentName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Student ID &amp; Program</span>
                      <p className="text-[11px] font-mono text-slate-700 mt-0.5">
                        {printResolutionReport.reportedStudentId || 'No ID'}
                        {printResolutionReport.reportedStudentCourse
                          ? ` • ${printResolutionReport.reportedStudentCourse}`
                          : ''}
                        {printResolutionReport.reportedStudentYearLevel
                          ? ` ${printResolutionReport.reportedStudentYearLevel}`
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Case Information */}
              <div className="space-y-2 border border-slate-300 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-black uppercase tracking-wider text-slate-900 mb-2">
                    Case Information
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Complainant / Reporter</span>
                      <p className="font-bold text-slate-900 mt-0.5">
                        {printResolutionReport.isAnonymousReporter
                          ? 'Anonymous Reporter'
                          : printResolutionReport.reporterName}
                      </p>
                      <p className="text-[11px] text-slate-700">
                        Role:{' '}
                        {printResolutionReport.isAnonymousReporter
                          ? 'Anonymous Reporter'
                          : printResolutionReport.reporterRole || 'Student'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Incident Location</span>
                      <p className="font-bold text-slate-900 mt-0.5">{printResolutionReport.location}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Date and Time</span>
                      <p className="font-mono font-bold text-slate-900 mt-0.5">
                        {formatReportDateTime(printResolutionReport)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 1. OSAS Administrator Remarks */}
            {(() => {
              const remarksText = printResolutionReport.osasRemarks?.trim() || '';
              const hasRemarks = Boolean(remarksText);
              const osasDate = printResolutionReport.osasRemarksSavedAt
                ? new Date(printResolutionReport.osasRemarksSavedAt).toLocaleString()
                : printResolutionReport.resolvedAt
                ? new Date(printResolutionReport.resolvedAt).toLocaleString()
                : formatReportDateTime(printResolutionReport);
              const remarksLines = hasRemarks
                ? remarksText.split('\n').map((l) => l.trim()).filter(Boolean)
                : [];
              return (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black uppercase tracking-wider text-slate-900">
                      OSAS Administrator Remarks
                    </h3>
                    {hasRemarks && (
                      <span className="font-mono text-[11px] text-slate-600 font-bold">
                        {osasDate}
                      </span>
                    )}
                  </div>
                  <div className="border border-slate-300 rounded-xl p-3.5">
                    <ul className="space-y-1.5">
                      {hasRemarks ? (
                        remarksLines.map((line, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-900 leading-relaxed">
                            <span className="font-black text-slate-900 shrink-0">•</span>
                            <span className="flex-1 font-semibold">{line}</span>
                          </li>
                        ))
                      ) : (
                        <li className="flex items-start gap-2 text-slate-500 italic">
                          <span className="font-black text-slate-400 shrink-0">•</span>
                          <span>No Administrator Remarks Recorded</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })()}

            {/* 2. Endorsement Letter */}
            {(() => {
              const letter = printResolutionReport.endorsementLetter;
              const hasLetter = Boolean(letter);
              const letterDate = letter?.createdAt
                ? new Date(letter.createdAt).toLocaleString()
                : printResolutionReport.resolvedAt
                ? new Date(printResolutionReport.resolvedAt).toLocaleString()
                : formatReportDateTime(printResolutionReport);
              return (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black uppercase tracking-wider text-slate-900">
                      Endorsement Letter
                    </h3>
                    {hasLetter && (
                      <span className="font-mono text-[11px] text-slate-600 font-bold">
                        {letterDate}
                      </span>
                    )}
                  </div>
                  <div className="border border-slate-300 rounded-xl p-3.5 space-y-2">
                    {hasLetter ? (
                      <ul className="space-y-1.5">
                        <li className="flex items-start gap-2 text-slate-900 leading-relaxed">
                          <span className="font-black text-slate-900 shrink-0">•</span>
                          <span className="flex-1 font-medium">
                            Official OSAS Endorsement Letter addressed to {letter.higherOfficerName || 'Higher Authority'} ({letter.institutionName || 'Destination Office'})
                          </span>
                        </li>
                        <li className="flex items-start gap-2 text-slate-900 leading-relaxed">
                          <span className="font-black text-slate-900 shrink-0">•</span>
                          <span className="flex-1 font-medium">
                            Approved By: {letter.endorsedByName || 'Cristy C. Domingo'} • Noted By: {letter.notedByName || 'Maria Mel B. Glemao'} • Respectfully Yours: {letter.actionsTaken || 'Princess Ann T. Ruzol'}
                          </span>
                        </li>
                        {letter.reasonForEndorsement && (
                          <li className="flex items-start gap-2 text-slate-900 leading-relaxed">
                            <span className="font-black text-slate-900 shrink-0">•</span>
                            <span className="flex-1 font-medium">
                              Reason: {letter.reasonForEndorsement}
                            </span>
                          </li>
                        )}
                        {letter.recommendation && (
                          <li className="flex items-start gap-2 text-slate-900 leading-relaxed">
                            <span className="font-black text-slate-900 shrink-0">•</span>
                            <span className="flex-1 font-medium">
                              Recommendation: {letter.recommendation}
                            </span>
                          </li>
                        )}
                      </ul>
                    ) : (
                      <ul className="space-y-1.5">
                        <li className="flex items-start gap-2 text-slate-500 italic">
                          <span className="font-black text-slate-400 shrink-0">•</span>
                          <span>No Endorsement Letter Recorded</span>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 3. Disciplinary Action */}
            {(() => {
              const linkedDisc = getLinkedDisciplinaryRecord(printResolutionReport);
              const isCreated = Boolean(
                linkedDisc || printResolutionReport.disciplinaryRecordId || printResolutionReport.linkedRecordId
              );
              const refId =
                linkedDisc?.id || printResolutionReport.disciplinaryRecordId || printResolutionReport.linkedRecordId || '';
              const discDate = linkedDisc?.reportDate && linkedDisc?.reportTime
                ? `${linkedDisc.reportDate} • ${linkedDisc.reportTime}`
                : linkedDisc?.dateLogged
                ? new Date(linkedDisc.dateLogged).toLocaleString()
                : printResolutionReport.resolvedAt
                ? new Date(printResolutionReport.resolvedAt).toLocaleString()
                : formatReportDateTime(printResolutionReport);
              return (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black uppercase tracking-wider text-slate-900">
                      Disciplinary Action
                    </h3>
                    {isCreated && (
                      <span className="font-mono text-[11px] text-slate-600 font-bold">
                        {discDate}
                      </span>
                    )}
                  </div>
                  <div className="border border-slate-300 rounded-xl p-3.5">
                    <ul className="space-y-1.5">
                      {isCreated ? (
                        <>
                          <li className="flex items-start gap-2 text-slate-900 leading-relaxed">
                            <span className="font-black text-slate-900 shrink-0">•</span>
                            <span className="flex-1 font-medium">
                              Disciplinary Action Created — {refId ? `Official Record #${refId}` : 'Official Record'}
                            </span>
                          </li>
                          <li className="flex items-start gap-2 text-slate-900 leading-relaxed">
                            <span className="font-black text-slate-900 shrink-0">•</span>
                            <span className="flex-1 font-medium">
                              Official disciplinary action record documented for this student report.
                            </span>
                          </li>
                        </>
                      ) : (
                        <li className="flex items-start gap-2 text-slate-500 italic">
                          <span className="font-black text-slate-400 shrink-0">•</span>
                          <span>No Disciplinary Action Recorded</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })()}

            {/* 4. Resolution Details and Narrative */}
            {(() => {
              const resDate = printResolutionReport.resolvedAt
                ? new Date(printResolutionReport.resolvedAt).toLocaleString()
                : formatReportDateTime(printResolutionReport);
              const detailsText = getCleanResolutionDetails(printResolutionReport) || '';
              const detailsLines = detailsText
                ? detailsText.split('\n').map((l) => l.trim()).filter(Boolean)
                : ['No resolution details recorded.'];
              return (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black uppercase tracking-wider text-slate-900">
                      Resolution Details and Narrative
                    </h3>
                    <span className="font-mono text-[11px] text-slate-600 font-bold">
                      {resDate}
                    </span>
                  </div>
                  <div className="border border-slate-300 rounded-xl p-3.5">
                    <ul className="space-y-1.5">
                      {detailsLines.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-slate-900 leading-relaxed">
                          <span className="font-black text-slate-900 shrink-0">•</span>
                          <span className="flex-1 font-medium">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}

            {/* 5. Actions Taken by Guidance Advocate */}
            {(() => {
              const savedActionTaken =
                printResolutionReport.resolutionActionTaken ||
                (printResolutionReport.resolutionActionSteps && printResolutionReport.resolutionActionSteps.length > 0
                  ? printResolutionReport.resolutionActionSteps
                      .map((s) => s.actionTaken)
                      .filter(Boolean)
                      .join('\n')
                  : '') ||
                printResolutionReport.actionTaken ||
                '';
              const actionDate = printResolutionReport.resolvedAt
                ? new Date(printResolutionReport.resolvedAt).toLocaleString()
                : formatReportDateTime(printResolutionReport);
              const actionLines = savedActionTaken
                ? savedActionTaken.split('\n').map((l) => l.trim()).filter(Boolean)
                : ['No action recorded.'];
              return (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black uppercase tracking-wider text-slate-900">
                      Actions Taken by Guidance Advocate
                    </h3>
                    <span className="font-mono text-[11px] text-slate-600 font-bold">
                      {actionDate}
                    </span>
                  </div>
                  <div className="border border-slate-300 rounded-xl p-3.5">
                    <ul className="space-y-1.5">
                      {actionLines.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-slate-900 leading-relaxed">
                          <span className="font-black text-slate-900 shrink-0">•</span>
                          <span className="flex-1 font-medium">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}

            {/* 6. Problem Resolved and Concerns Addressed */}
            {(() => {
              const problemDate = formatReportDateTime(printResolutionReport);
              const problemText = printResolutionReport.problemResolved || printResolutionReport.description || 'General student concern addressed.';
              const problemLines = problemText.split('\n').map((l) => l.trim()).filter(Boolean);
              return (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black uppercase tracking-wider text-slate-900">
                      Problem Resolved and Concerns Addressed
                    </h3>
                    <span className="font-mono text-[11px] text-slate-600 font-bold">
                      {problemDate}
                    </span>
                  </div>
                  <div className="border border-slate-300 rounded-xl p-3.5">
                    <ul className="space-y-1.5">
                      {problemLines.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-slate-900 leading-relaxed">
                          <span className="font-black text-slate-900 shrink-0">•</span>
                          <span className="flex-1 font-semibold">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}

            {/* Signatories */}
            <div className="grid grid-cols-2 gap-8 pt-6 text-xs">
              <div>
                <p className="text-slate-600 mb-6">Prepared and documented by:</p>
                <p className="font-black uppercase text-slate-900 underline">Guidance Advocate</p>
                <p className="font-semibold text-slate-700">Guidance and Counseling Office</p>
              </div>
              <div>
                <p className="text-slate-600 mb-6">Noted by:</p>
                <p className="font-black uppercase text-slate-900 underline">
                  {printResolutionReport.osasRemarksBy || 'OSAS Administrator'}
                </p>
                <p className="font-semibold text-slate-700">
                  Office of Student Affairs and Services (OSAS)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
