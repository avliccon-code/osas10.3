import React, { useState, useEffect, useMemo } from 'react';
import {
  InterventionRecord,
  InterventionReferrerType,
  InterventionReasonType,
  InterventionStrategyType,
  InterventionStatus,
  InterventionUrgency,
  Appointment,
  AppointmentStatus,
  User,
  ResolutionActionStep,
} from '../../types';
import {
  getInterventionRecords,
  addInterventionRecord,
  updateInterventionRecord,
  archiveInterventionRecord,
  referInterventionRecordToGuidance,
  updateGuidanceInterventionStatus,
  getUsers,
  findUserAsync,
  sendNotification,
  getAppointments,
  updateAppointmentByAdmin,
  markAppointmentDoneByAdmin,
  reApproveAppointment,
  archiveAppointment,
  checkAppointmentConflict,
  referAppointmentToGuidance,
  referStudentConcernFromOsas,
  safeLocalStorageSet,
} from '../../services/storage';
import { CollegeLogo } from '../common/CollegeLogo';
import { ConfirmModal } from '../common/ConfirmModal';
import { Modal } from '../common/Modal';
import { db } from '../../services/firebase';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  HeartHandshake,
  Plus,
  Search,
  Eye,
  Printer,
  Archive,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  User as UserIcon,
  Calendar,
  FileText,
  CheckSquare,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit3,
  Shield,
  RotateCcw,
  Check,
  X,
  Trash2,
  MessageSquare,
  AlertOctagon,
  Send,
} from 'lucide-react';

export type InterventionTab = 'grievances' | 'intervention-form' | 'referral-form' | 'intervention-records' | 'resolutions';

interface InterventionModuleProps {
  currentUser?: User;
  initialTab?: InterventionTab;
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
  const trimmed = time24.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const period = ampmMatch[3].toUpperCase();
    if (h === 0) h = 12;
    else if (h > 12) h = h % 12;
    return `${String(h).padStart(2, '0')}:${m} ${period}`;
  }
  if (trimmed.toUpperCase().includes('AM') || trimmed.toUpperCase().includes('PM')) return trimmed;
  const parts = trimmed.split(':');
  let h = parseInt(parts[0], 10);
  const m = (parts[1] || '00').slice(0, 2);
  if (isNaN(h)) return trimmed;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
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

const POPUP_REASON_OPTIONS = [
  'Academic concerns',
  'Behavioral issues',
  'Mental health concern',
  'Financial concern',
  'Family problems',
  'Substance use',
  'Attendance/absenteeism',
  'Peer conflict',
  'Others',
];

const STRATEGY_OPTIONS: InterventionStrategyType[] = [
  'Academic Advising',
  'Counseling Services',
  'Referral to Guidance Counselor',
  'Peer Mediation',
  'Parent/Guardian Conference',
  'Financial Assistance Referral',
  'Monitoring and Follow-up',
  'Others',
];

const REFERRER_OPTIONS: InterventionReferrerType[] = [
  'Faculty',
  'Counselor',
  'Parents/Guardian',
  'Self',
  'Peer',
  'Others',
];

export const InterventionModule: React.FC<InterventionModuleProps> = ({ currentUser, initialTab }) => {
  const isGuidance = currentUser?.role === 'GUIDANCE_ADMIN';
  const resolvedInitialTab: InterventionTab = isGuidance
    ? initialTab || 'grievances'
    : 'resolutions';

  const [activeTab, setActiveTab] = useState<InterventionTab>(resolvedInitialTab);

  useEffect(() => {
    if (!isGuidance) {
      setActiveTab('resolutions');
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isGuidance]);

  // Shared Users State
  const [students, setStudents] = useState<User[]>([]);

  // ==========================================
  // TAB 1: STUDENT GRIEVANCES STATE & LOGIC
  // ==========================================
  const [appointments, setAppointments] = useState<Appointment[]>(() =>
    getAppointments(isGuidance ? 'GUIDANCE_ADMIN' : 'ADMIN')
  );
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [selectedWalkInRecord, setSelectedWalkInRecord] = useState<Appointment | null>(null);
  const [printApp, setPrintApp] = useState<Appointment | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [confirmArchiveApp, setConfirmArchiveApp] = useState<Appointment | null>(null);
  const [confirmReferId, setConfirmReferId] = useState<string | null>(null);

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

  const [grievanceSearchQuery, setGrievanceSearchQuery] = useState('');
  const [grievanceStatusFilter, setGrievanceStatusFilter] = useState<string>('ALL');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('02:00 PM');
  const [adminNotes, setAdminNotes] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [archiveAppReason, setArchiveAppReason] = useState('');
  const [archiveAppError, setArchiveAppError] = useState('');

  // ==========================================
  // TAB 2 & 3: INTERVENTION RECORDS & FORM STATE
  // ==========================================
  const [records, setRecords] = useState<InterventionRecord[]>([]);

  // Search & Filter State for Intervention Records & Resolutions
  const [searchQuery, setSearchQuery] = useState('');
  const [resolutionSearchQuery, setResolutionSearchQuery] = useState('');
  const [filterReason, setFilterReason] = useState<string>('ALL');
  const [filterReferrer, setFilterReferrer] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals for Intervention Records
  const [selectedRecord, setSelectedRecord] = useState<InterventionRecord | null>(null);
  const [activeMetricModal, setActiveMetricModal] = useState<'TOTAL' | 'ACTIVE' | 'FOLLOW_UP_REQUIRED' | 'RESOLVED' | null>(null);
  const [printRecord, setPrintRecord] = useState<InterventionRecord | null>(null);
  const [editRecord, setEditRecord] = useState<InterventionRecord | null>(null);
  const [archiveConfirmRecord, setArchiveConfirmRecord] = useState<InterventionRecord | null>(null);
  const [referToGuidanceRecord, setReferToGuidanceRecord] = useState<InterventionRecord | null>(null);
  const [editingReferralRecord, setEditingReferralRecord] = useState<InterventionRecord | null>(null);

  // Refer to Guidance / Referral Form Fields
  const [popupDateOfReferral, setPopupDateOfReferral] = useState(new Date().toISOString().split('T')[0]);
  const [popupReferredByPersonnel, setPopupReferredByPersonnel] = useState('Princess Ann T. Ruzol (OSAS Officer)');
  const [popupReferredByDesignation, setPopupReferredByDesignation] = useState('OSAS Administrator');
  const [popupReasonForReferral, setPopupReasonForReferral] = useState('');
  const [popupReasons, setPopupReasons] = useState<string[]>([]);
  const [popupReasonsOther, setPopupReasonsOther] = useState('');
  const [popupRecommendedDesignation] = useState('Guidance and Counseling Services');
  const [popupActionTakenSummary, setPopupActionTakenSummary] = useState('');
  const [popupUrgencyOfReferral, setPopupUrgencyOfReferral] = useState('Within 3 days');
  const [popupAttachmentsType, setPopupAttachmentsType] = useState('None / Not Applicable');
  const [popupAttachmentsOther, setPopupAttachmentsOther] = useState('');
  const [popupOsasApprovalName, setPopupOsasApprovalName] = useState('Princess Ann T. Ruzol');
  const [popupOsasApprovalDate, setPopupOsasApprovalDate] = useState(new Date().toISOString().split('T')[0]);
  const [popupApprovedBy, setPopupApprovedBy] = useState('OSAS Administrator');
  const [popupReceivedByName, setPopupReceivedByName] = useState('Maria Mel B. Glemao');
  const [popupReceivedByPosition, setPopupReceivedByPosition] = useState('Registered Guidance Counselor (RGC)');
  const [popupReceivedDate, setPopupReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [popupReceivedActionRemarks, setPopupReceivedActionRemarks] = useState(
    'Acknowledged and received by Guidance and Counseling Office for intake counseling and case management.'
  );
  const [popupError, setPopupError] = useState<string | null>(null);

  // Intervention / Referral Form Fields State
  const [isFromStudentConcerns, setIsFromStudentConcerns] = useState(false);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);
  const [selectedStudentUser, setSelectedStudentUser] = useState<User | null>(null);

  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');

  const [dateOfReferral, setDateOfReferral] = useState(new Date().toISOString().split('T')[0]);
  const [referredBy, setReferredBy] = useState<InterventionReferrerType>(() =>
    isGuidance ? 'Guidance Advocate' : 'OSAS Administrator'
  );
  const [referredByOther, setReferredByOther] = useState('');
  const [nameOfReferrer, setNameOfReferrer] = useState('');
  const [relationshipToStudent, setRelationshipToStudent] = useState('');

  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [reasonsOther, setReasonsOther] = useState('');
  const [descriptionOfConcerns, setDescriptionOfConcerns] = useState('');

  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [strategiesOther, setStrategiesOther] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [followUpDate, setFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [responsibleParties, setResponsibleParties] = useState('OSAS Administrator, Guidance Counselor');
  const [status, setStatus] = useState<InterventionStatus>(() => (isGuidance ? 'ACTIVE' : 'REFERRED'));

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Counseling Approval & Intervention Type (Guidance Intervention Form)
  const [counselingApprovalStatus, setCounselingApprovalStatus] = useState('');
  const [counselingScheduledDateTime, setCounselingScheduledDateTime] = useState('');
  const [selectedInterventionTypes, setSelectedInterventionTypes] = useState<string[]>([]);

  // Separate OSAS Intervention Form State for Counseling Approval & Schedule Date & Time
  const [osasCounselingApprovalStatus, setOsasCounselingApprovalStatus] = useState('Approved');
  const [osasCounselingScheduledDateTime, setOsasCounselingScheduledDateTime] = useState('');

  // Helper to convert date/time strings into datetime-local format (YYYY-MM-DDTHH:mm)
  const toDateTimeLocalValue = (val: string, timeVal?: string): string => {
    if (!val || val === 'Not specified') return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
      return val.slice(0, 16);
    }
    let datePart = val.trim();
    let timePart = (timeVal || '').trim();
    if (datePart.includes('@')) {
      const parts = datePart.split('@');
      datePart = parts[0].trim();
      timePart = (parts[1] || '').trim();
    } else if (datePart.includes(' ') && /^\d{4}-\d{2}-\d{2}\s+/.test(datePart)) {
      const firstSpace = datePart.indexOf(' ');
      const d = datePart.slice(0, firstSpace).trim();
      const t = datePart.slice(firstSpace + 1).trim();
      datePart = d;
      if (!timePart) timePart = t;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        const hh = String(parsed.getHours()).padStart(2, '0');
        const mm = String(parsed.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d}T${hh}:${mm}`;
      }
      return '';
    }
    let hh = '09';
    let mm = '00';
    if (timePart) {
      const ampmMatch = timePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      const h24Match = timePart.match(/(\d{1,2}):(\d{2})/);
      if (ampmMatch) {
        let h = parseInt(ampmMatch[1], 10);
        mm = ampmMatch[2];
        const period = ampmMatch[3].toUpperCase();
        if (period === 'PM' && h < 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        hh = String(h).padStart(2, '0');
      } else if (h24Match) {
        hh = String(parseInt(h24Match[1], 10)).padStart(2, '0');
        mm = h24Match[2];
      }
    }
    return `${datePart}T${hh}:${mm}`;
  };

  // Helper to separate Schedule Date and Schedule Time (12-hour AM/PM) for Intervention Records
  const getScheduleDateAndTime12h = (rec: InterventionRecord): { scheduleDate: string; scheduleTime: string } => {
    const raw = (rec.counselingScheduledDateTime || rec.dateOfReferral || '').trim();
    if (!raw || raw === 'Not specified') {
      return {
        scheduleDate: rec.dateOfReferral || 'Not specified',
        scheduleTime: 'Not specified',
      };
    }

    if (raw.includes('T') && /^\d{4}-\d{2}-\d{2}T/.test(raw)) {
      const [datePart, timePartRaw] = raw.split('T');
      const hhmm = (timePartRaw || '').slice(0, 5);
      return {
        scheduleDate: datePart || rec.dateOfReferral || 'Not specified',
        scheduleTime: hhmm ? formatTime12h(hhmm) : 'Not specified',
      };
    }

    if (raw.includes('@')) {
      const [datePart, timePartRaw] = raw.split('@');
      const cleanTime = (timePartRaw || '').trim();
      return {
        scheduleDate: datePart.trim() || rec.dateOfReferral || 'Not specified',
        scheduleTime: cleanTime ? formatTime12h(cleanTime) : 'Not specified',
      };
    }

    const spaceMatch = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (spaceMatch) {
      return {
        scheduleDate: spaceMatch[1],
        scheduleTime: formatTime12h(spaceMatch[2].trim()),
      };
    }

    return {
      scheduleDate: raw,
      scheduleTime: '09:00 AM',
    };
  };

  // Create Resolution for Intervention Records (Requirement 5 & 6)
  const [resolutionTargetRecord, setResolutionTargetRecord] = useState<InterventionRecord | null>(null);
  const [resProblemResolved, setResProblemResolved] = useState('');
  const [resActionSteps, setResActionSteps] = useState<ResolutionActionStep[]>([]);
  const [resActionTakenText, setResActionTakenText] = useState('');
  const [resOutcome, setResOutcome] = useState<'RESOLVED' | 'UNRESOLVED'>('RESOLVED');
  const [resDetails, setResDetails] = useState('');
  const [resError, setResError] = useState('');
  const [printResolutionRecord, setPrintResolutionRecord] = useState<InterventionRecord | null>(null);

  const handleDirectPrintRecord = (rec: InterventionRecord) => {
    setPrintRecord(rec);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintRecord(null), 500);
    }, 50);
  };

  const handleDirectPrintResolution = (rec: InterventionRecord) => {
    setPrintResolutionRecord(rec);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintResolutionRecord(null), 500);
    }, 50);
  };

  const handleDirectPrintApp = (app: Appointment) => {
    setPrintApp(app);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintApp(null), 500);
    }, 50);
  };

  // Guidance -> Refer to OSAS Office Modal State
  const [referToOsasRecord, setReferToOsasRecord] = useState<InterventionRecord | null>(null);
  const [referToOsasDate, setReferToOsasDate] = useState(new Date().toISOString().split('T')[0]);
  const [referToOsasReason, setReferToOsasReason] = useState('');
  const [referToOsasDescription, setReferToOsasDescription] = useState('');
  const [referToOsasError, setReferToOsasError] = useState('');

  // OSAS Admin -> Record Session / OSAS Remarks Modal State
  const [osasSessionRecord, setOsasSessionRecord] = useState<InterventionRecord | null>(null);
  const [osasSessionRemarks, setOsasSessionRemarks] = useState('');
  const [osasSessionDate, setOsasSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [osasSessionConductedBy, setOsasSessionConductedBy] = useState('Princess Ann T. Ruzol (OSAS Administrator)');
  const [osasSessionActionTaken, setOsasSessionActionTaken] = useState('');
  const [osasSessionError, setOsasSessionError] = useState('');

  const [expandedRecordIds, setExpandedRecordIds] = useState<Record<string, boolean>>({});
  const [expandedResolutionIds, setExpandedResolutionIds] = useState<Record<string, boolean>>({});

  // OSAS Admin Referral Form Tab State (1. Student Info, 2. Description, 3. Date & Time, 4. Reason for Referral)
  const [osasRefStudentSearch, setOsasRefStudentSearch] = useState('');
  const [showOsasRefStudentSuggestions, setShowOsasRefStudentSuggestions] = useState(false);
  const [osasRefStudentId, setOsasRefStudentId] = useState('');
  const [osasRefStudentName, setOsasRefStudentName] = useState('');
  const [osasRefCourse, setOsasRefCourse] = useState('');
  const [osasRefYearLevel, setOsasRefYearLevel] = useState('1st Year');
  const [osasRefContactNumber, setOsasRefContactNumber] = useState('');
  const [osasRefAddress, setOsasRefAddress] = useState('');
  const [osasRefDescription, setOsasRefDescription] = useState('');
  const [osasRefDateTime, setOsasRefDateTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [osasRefReason, setOsasRefReason] = useState('');
  const [osasRefErrorMsg, setOsasRefErrorMsg] = useState('');
  const [osasRefSuccess, setOsasRefSuccess] = useState(false);

  const osasRefFilteredStudents = useMemo(() => {
    if (!osasRefStudentSearch.trim()) return [];
    const q = osasRefStudentSearch.toLowerCase().trim();
    return students
      .filter(
        (s) =>
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          s.fullName.toLowerCase().includes(q) ||
          (s.course && s.course.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [students, osasRefStudentSearch]);

  const handleSelectOsasRefStudent = (st: User) => {
    const sId = st.studentId || st.id || '';
    const sName = st.fullName || '';
    const sProgram = st.academicProgram || st.course || 'BS Information Technology';
    const sYear = st.yearLevel || '1st Year';
    const sContact = st.contactNumber || '';
    const sAddr = st.permanentAddress || st.address || '';

    setOsasRefStudentSearch(`${sName} (${sId || 'No ID'})`);
    setOsasRefStudentId(sId);
    setOsasRefStudentName(sName);
    setOsasRefCourse(sProgram);
    setOsasRefYearLevel(sYear);
    setOsasRefContactNumber(sContact);
    setOsasRefAddress(sAddr);
    setShowOsasRefStudentSuggestions(false);
    setOsasRefErrorMsg('');

    findUserAsync(sId || st.email || sName)
      .then((remoteUser) => {
        if (remoteUser) {
          setOsasRefStudentId(remoteUser.studentId || remoteUser.id || sId);
          setOsasRefStudentName(remoteUser.fullName || sName);
          setOsasRefCourse(remoteUser.academicProgram || remoteUser.course || sProgram);
          setOsasRefYearLevel(remoteUser.yearLevel || sYear);
          setOsasRefContactNumber(remoteUser.contactNumber || sContact);
          setOsasRefAddress(remoteUser.permanentAddress || remoteUser.address || sAddr);
        }
      })
      .catch(() => {});
  };

  const handleClearOsasRefStudent = () => {
    setOsasRefStudentSearch('');
    setOsasRefStudentId('');
    setOsasRefStudentName('');
    setOsasRefCourse('');
    setOsasRefYearLevel('1st Year');
    setOsasRefContactNumber('');
    setOsasRefAddress('');
    setShowOsasRefStudentSuggestions(false);
  };

  const handleSubmitOsasReferralForm = (e: React.FormEvent) => {
    e.preventDefault();
    setOsasRefErrorMsg('');

    if (!osasRefStudentName.trim()) {
      setOsasRefErrorMsg('Please enter or select the Student Full Name in Section 1.');
      return;
    }
    if (!osasRefDescription.trim()) {
      setOsasRefErrorMsg('Please enter the Description in Section 2.');
      return;
    }
    if (!osasRefDateTime) {
      setOsasRefErrorMsg('Please provide the Date & Time in Section 3.');
      return;
    }
    if (!osasRefReason.trim()) {
      setOsasRefErrorMsg('Please specify the Reason for Referral in Section 4.');
      return;
    }

    const createdByName = currentUser?.fullName || 'Princess Ann T. Ruzol';
    const refDateOnly = osasRefDateTime.includes('T')
      ? osasRefDateTime.split('T')[0]
      : new Date().toISOString().split('T')[0];
    const refTimePart = osasRefDateTime.includes('T')
      ? formatTime12h(osasRefDateTime.split('T')[1])
      : '09:00 AM';

    const matchedStudent = students.find(
      (s) =>
        (s.studentId && osasRefStudentId && s.studentId.trim().toLowerCase() === osasRefStudentId.trim().toLowerCase()) ||
        (s.fullName && osasRefStudentName && s.fullName.trim().toLowerCase() === osasRefStudentName.trim().toLowerCase())
    );

    referStudentConcernFromOsas(
      {
        studentId: osasRefStudentId.trim() || matchedStudent?.studentId || 'N/A',
        studentName: osasRefStudentName.trim(),
        studentEmail: matchedStudent?.email || undefined,
        description: osasRefDescription.trim(),
        preferredDate: refDateOnly,
        preferredTime: refTimePart || '09:00 AM',
        reason: osasRefReason.trim(),
        course: osasRefCourse.trim() || matchedStudent?.academicProgram || matchedStudent?.course || 'N/A',
        academicProgram: osasRefCourse.trim() || matchedStudent?.academicProgram || matchedStudent?.course || 'N/A',
        yearLevel: osasRefYearLevel.trim() || matchedStudent?.yearLevel || 'N/A',
        contactNumber: osasRefContactNumber.trim() || matchedStudent?.contactNumber || 'N/A',
        completeAddress: osasRefAddress.trim() || matchedStudent?.permanentAddress || matchedStudent?.address || 'N/A',
      },
      createdByName
    );

    loadData();
    handleClearOsasRefStudent();
    setOsasRefDescription('');
    setOsasRefDateTime(new Date().toISOString().slice(0, 16));
    setOsasRefReason('');
    setOsasRefSuccess(true);
    setTimeout(() => {
      setOsasRefSuccess(false);
      setActiveTab('intervention-records');
    }, 900);
  };

  const toggleRecordExpanded = (recordId: string) => {
    setExpandedRecordIds((prev) => ({
      ...prev,
      [recordId]: !prev[recordId],
    }));
  };

  const toggleResolutionExpanded = (recordId: string) => {
    setExpandedResolutionIds((prev) => ({
      ...prev,
      [recordId]: !prev[recordId],
    }));
  };

  // ==========================================
  // REAL-TIME DATA LOADING & SYNCHRONIZATION
  // ==========================================
  const loadData = () => {
    const roleKey = isGuidance ? 'GUIDANCE_ADMIN' : 'ADMIN';
    const rawRecords = getInterventionRecords(roleKey);
    // Deduplicate by id and load records sorted newest first
    const uniqueMap = new Map<string, InterventionRecord>();
    for (const rec of rawRecords) {
      if (!rec?.id) continue;
      if (!uniqueMap.has(rec.id)) {
        uniqueMap.set(rec.id, rec);
      }
    }
    const freshRecords = Array.from(uniqueMap.values()).sort((a, b) => {
      const timeB = new Date(b.resolvedAt || b.osasReferralDate || b.createdAt || b.dateOfReferral || 0).getTime();
      const timeA = new Date(a.resolvedAt || a.osasReferralDate || a.createdAt || a.dateOfReferral || 0).getTime();
      if (timeB !== timeA && !isNaN(timeB) && !isNaN(timeA)) return timeB - timeA;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    setRecords(freshRecords);
    setSelectedRecord((prev) => {
      if (!prev) return null;
      const updated = freshRecords.find((r) => r.id === prev.id);
      return updated || prev;
    });
    const freshApps = getAppointments(roleKey).sort((a, b) => {
      const timeB = new Date(b.createdAt || b.preferredDate || 0).getTime();
      const timeA = new Date(a.createdAt || a.preferredDate || 0).getTime();
      return timeB - timeA;
    });
    setAppointments(freshApps);
    setSelectedApp((prev) => {
      if (!prev) return null;
      const updated = freshApps.find((a) => a.id === prev.id);
      return updated || prev;
    });

    try {
      const allUsers = getUsers();
      setStudents(allUsers.filter((u) => u.role === 'STUDENT'));
    } catch {
      setStudents([]);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    window.addEventListener('osas_storage_updated', loadData);
    window.addEventListener('storage', loadData);

    const mergeRemoteAppointments = (incoming: Appointment[]) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      try {
        const raw = localStorage.getItem('osas_appointments');
        const current: Appointment[] = raw ? JSON.parse(raw) : [];
        const map = new Map<string, Appointment>();
        current.forEach((a) => {
          if (a && a.id) map.set(a.id, a);
        });
        let changed = false;
        incoming.forEach((a) => {
          if (a && a.id) {
            const existing = map.get(a.id);
            if (!existing || (a.updatedAt || 0) >= (existing.updatedAt || 0)) {
              map.set(a.id, existing ? { ...existing, ...a } : a);
              changed = true;
            }
          }
        });
        if (changed) {
          safeLocalStorageSet('osas_appointments', JSON.stringify(Array.from(map.values())));
        }
      } catch {}
      loadData();
    };

    const mergeRemoteInterventions = (incoming: InterventionRecord[]) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      try {
        const raw = localStorage.getItem('osas_interventions');
        const current: InterventionRecord[] = raw ? JSON.parse(raw) : [];
        const map = new Map<string, InterventionRecord>();
        current.forEach((r) => {
          if (r && r.id) map.set(r.id, r);
        });
        let changed = false;
        incoming.forEach((r) => {
          if (r && r.id) {
            const existing = map.get(r.id);
            if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
              map.set(r.id, existing ? { ...existing, ...r } : r);
              changed = true;
            }
          }
        });
        if (changed) {
          safeLocalStorageSet('osas_interventions', JSON.stringify(Array.from(map.values())));
        }
      } catch {}
      loadData();
    };

    const unsubApps = onSnapshot(
      collection(db, 'appointments'),
      (snap) => {
        if (!snap.empty) {
          mergeRemoteAppointments(snap.docs.map((d) => d.data() as Appointment));
        } else {
          loadData();
        }
      },
      () => {}
    );
    const unsubStoreApps = onSnapshot(
      doc(db, 'osas_store', 'osas_appointments'),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.value)) {
          mergeRemoteAppointments(snap.data().value as Appointment[]);
        } else {
          loadData();
        }
      },
      () => {}
    );
    const unsubIntv = onSnapshot(
      collection(db, 'interventions'),
      (snap) => {
        if (!snap.empty) {
          mergeRemoteInterventions(snap.docs.map((d) => d.data() as InterventionRecord));
        } else {
          loadData();
        }
      },
      () => {}
    );
    const unsubStoreIntv = onSnapshot(
      doc(db, 'osas_store', 'osas_interventions'),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.value)) {
          mergeRemoteInterventions(snap.data().value as InterventionRecord[]);
        } else {
          loadData();
        }
      },
      () => {}
    );

    return () => {
      clearInterval(interval);
      window.removeEventListener('osas_storage_updated', loadData);
      window.removeEventListener('storage', loadData);
      unsubApps();
      unsubStoreApps();
      unsubIntv();
      unsubStoreIntv();
    };
  }, [isGuidance]);

  // ==========================================
  // STUDENT GRIEVANCES ACTION HANDLERS
  // ==========================================
  const handleApproveAppointment = (id: string) => {
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
      const actorName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'Princess Ann T. Ruzol');
      const note = isGuidance ? 'Approved by Guidance Advocate' : 'Approved by OSAS Admin';
      updateAppointmentByAdmin(id, 'APPROVED', undefined, undefined, note, actorName, isGuidance ? 'GUIDANCE_ADMIN' : 'ADMIN');
      loadData();
      setSelectedApp((prev) => (prev && prev.id === id ? { ...prev, status: 'APPROVED' } : prev));
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

  const handleConfirmRejectAppointment = () => {
    if (!confirmRejectId) return;
    const actorName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'Princess Ann T. Ruzol');
    const note = 'Appointment request declined. Please re-schedule or contact Guidance/OSAS office.';
    updateAppointmentByAdmin(
      confirmRejectId,
      'REJECTED',
      undefined,
      undefined,
      note,
      actorName,
      isGuidance ? 'GUIDANCE_ADMIN' : 'ADMIN'
    );
    loadData();
    setConfirmRejectId(null);
  };

  const handleConfirmReferAppointment = () => {
    if (!confirmReferId) return;
    const actorName = currentUser?.fullName || 'Princess Ann T. Ruzol';
    referAppointmentToGuidance(
      confirmReferId,
      'Referred from OSAS Admin for guidance evaluation and counseling.',
      actorName
    );
    loadData();
    setConfirmReferId(null);
  };

  const handleReApproveAppointment = (id: string) => {
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
      const actorName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'Princess Ann T. Ruzol');
      reApproveAppointment(id, actorName);
      loadData();
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

  const handleConfirmArchiveAppointment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!confirmArchiveApp) return;
    if (!archiveAppReason.trim()) {
      setArchiveAppError('Please enter a reason for archive.');
      return;
    }
    const actorName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'Princess Ann T. Ruzol');
    archiveAppointment(confirmArchiveApp.id, actorName, archiveAppReason.trim());
    loadData();
    setArchiveAppReason('');
    setArchiveAppError('');
    setConfirmArchiveApp(null);
    setSelectedApp(null);
  };

  const handleRescheduleSubmit = (id: string) => {
    if (
      selectedApp &&
      (selectedApp.status === 'RESCHEDULED' ||
        Boolean(selectedApp.adminPreferredDate) ||
        Boolean(selectedApp.rescheduledByName))
    ) {
      return;
    }

    if (!isGuidance && (selectedApp?.status === 'REFERRED' || selectedApp?.status === 'REFERRED_TO_GUIDANCE' || selectedApp?.referredToGuidance || selectedApp?.referredFromOsas)) {
      alert('This appointment has been referred to the Guidance Admin. Only the Guidance Admin is authorized to reschedule it.');
      return;
    }

    if (!rescheduleDate) {
      setRescheduleError('Please select a preferred date for rescheduling.');
      return;
    }

    if (!adminNotes.trim()) {
      setRescheduleError('Please enter a reason for reschedule.');
      return;
    }

    setRescheduleError('');

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

    const actorName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'Princess Ann T. Ruzol');
    const trimmedNotes = adminNotes.trim();
    updateAppointmentByAdmin(
      id,
      'RESCHEDULED',
      rescheduleDate,
      rescheduleTime,
      trimmedNotes,
      actorName,
      isGuidance ? 'GUIDANCE_ADMIN' : 'ADMIN'
    );
    setSelectedApp((prev) =>
      prev && prev.id === id
        ? {
            ...prev,
            status: 'RESCHEDULED',
            adminPreferredDate: rescheduleDate,
            adminPreferredTime: rescheduleTime,
            adminNotes: trimmedNotes,
            rescheduleReason: trimmedNotes,
            rescheduledByRole: isGuidance ? 'GUIDANCE_ADMIN' : 'ADMIN',
            rescheduledByName: actorName,
          }
        : prev
    );
    loadData();
  };

  const handleMarkAppointmentDone = (id: string) => {
    const actorName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'Princess Ann T. Ruzol');
    markAppointmentDoneByAdmin(id, actorName);
    loadData();
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const matchesSearch =
        (a.studentName || '').toLowerCase().includes(grievanceSearchQuery.toLowerCase()) ||
        (a.studentId || '').toLowerCase().includes(grievanceSearchQuery.toLowerCase()) ||
        (a.studentEmail || '').toLowerCase().includes(grievanceSearchQuery.toLowerCase()) ||
        (a.description || '').toLowerCase().includes(grievanceSearchQuery.toLowerCase());

      const matchesStatus =
        grievanceStatusFilter === 'ALL' ||
        (grievanceStatusFilter === 'REFERRED' || grievanceStatusFilter === 'REFERRED_TO_GUIDANCE'
          ? a.status === 'REFERRED' || a.status === 'REFERRED_TO_GUIDANCE' || Boolean(a.referredToGuidance || a.referredFromOsas || a.isReferredFromOsas)
          : a.status === grievanceStatusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [appointments, grievanceSearchQuery, grievanceStatusFilter]);

  const rejectTargetApp = confirmRejectId ? appointments.find((a) => a.id === confirmRejectId) : null;
  const referTargetApp = confirmReferId ? appointments.find((a) => a.id === confirmReferId) : null;

  // ==========================================
  // INTERVENTION FORM & RECORDS HANDLERS
  // ==========================================
  const togglePopupReason = (reason: string) => {
    setPopupReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  // In Intervention Records -> View Details -> Refer to Guidance:
  // Open the Referral Form tab and populate it with the complete selected record details without duplicating the record
  const openReferToGuidancePopup = (rec: InterventionRecord) => {
    setEditingReferralRecord(rec);
    setSelectedRecord(null);
    setReferToGuidanceRecord(null);

    // Populate Student Info
    const matchedStudent = students.find(
      (s) => s.studentId === rec.studentId || s.id === rec.studentId
    );
    setSelectedStudentUser(matchedStudent || null);
    setStudentSearchInput(`${rec.studentName} (${rec.studentId || 'No ID'})`);
    setStudentId(rec.studentId || '');
    setStudentName(rec.studentName || '');
    setCourse(rec.course || '');
    setYearLevel(rec.yearLevel || '');
    setContactNumber(rec.contactNumber || '');
    setAddress(rec.address || '');
    setEmail(rec.email || '');

    // Populate Referral & Context Info
    setDateOfReferral(rec.dateOfReferral || new Date().toISOString().split('T')[0]);
    const validReferrer = REFERRER_OPTIONS.includes(rec.referredBy as InterventionReferrerType)
      ? (rec.referredBy as InterventionReferrerType)
      : 'Faculty';
    setReferredBy(validReferrer);
    setReferredByOther(rec.referredByOther || '');
    setNameOfReferrer(rec.nameOfReferrer || rec.referredByPersonnel || '');
    setRelationshipToStudent(rec.relationshipToStudent || rec.referredByDesignation || '');

    // Populate Reasons
    const normalizedReasons: string[] = [];
    (rec.reasons || []).forEach((r) => {
      const exactMatch = REASON_OPTIONS.find(
        (opt) => opt.toLowerCase() === r.toLowerCase() || opt.toLowerCase().startsWith(r.toLowerCase().slice(0, 8))
      );
      if (exactMatch && !normalizedReasons.includes(exactMatch)) {
        normalizedReasons.push(exactMatch);
      } else if (!exactMatch && r && !normalizedReasons.includes('Others')) {
        normalizedReasons.push('Others');
      }
    });
    setSelectedReasons(normalizedReasons);
    setReasonsOther(rec.reasonsOther || '');

    // Populate Description & Concerns
    setDescriptionOfConcerns(rec.descriptionOfConcerns || rec.reasonForReferral || '');

    // Populate Strategies & Follow-up Plan
    setSelectedStrategies(Array.isArray(rec.strategies) ? [...rec.strategies] : []);
    setStrategiesOther(rec.strategiesOther || '');
    setNextSteps(rec.nextSteps || '');
    setFollowUpDate(rec.followUpDate || new Date().toISOString().split('T')[0]);
    setResponsibleParties(rec.responsibleParties || 'OSAS Administrator, Guidance Counselor');
    setStatus('REFERRED');

    // Populate Referral-Specific Information
    setPopupDateOfReferral(rec.dateOfReferral || new Date().toISOString().split('T')[0]);
    setPopupReferredByPersonnel(rec.referredByPersonnel || 'Princess Ann T. Ruzol (OSAS Officer)');
    setPopupReferredByDesignation(rec.referredByDesignation || 'OSAS Administrator');
    setPopupReasonForReferral(rec.reasonForReferral || rec.descriptionOfConcerns || '');
    setPopupActionTakenSummary(
      rec.actionTakenSummary ||
        rec.summaryOfActionTaken ||
        (rec.strategies && rec.strategies.length > 0
          ? `Strategies applied: ${rec.strategies.join(', ')}. Next steps: ${rec.nextSteps || 'Initial consultation completed.'}`
          : 'Initial intake interview and preliminary observations completed by OSAS.')
    );
    setPopupUrgencyOfReferral(rec.urgencyOfReferral || 'Within 3 days');
    setPopupAttachmentsType(rec.attachmentsType || 'None / Not Applicable');
    setPopupAttachmentsOther(rec.attachmentsOther || '');
    setPopupOsasApprovalName(rec.osasApprovalName || currentUser?.fullName || 'Princess Ann T. Ruzol');
    setPopupOsasApprovalDate(rec.osasApprovalDate || new Date().toISOString().split('T')[0]);
    setPopupApprovedBy(rec.approvedBy || 'OSAS Administrator');
    setPopupReceivedByName(rec.receivedByName || 'Maria Mel B. Glemao');
    setPopupReceivedByPosition(rec.receivedByPosition || 'Registered Guidance Counselor (RGC)');
    setPopupReceivedDate(rec.receivedDate || new Date().toISOString().split('T')[0]);
    setPopupReceivedActionRemarks(
      rec.receivedActionRemarks ||
        'Acknowledged and received by Guidance and Counseling Office for intake counseling and case management.'
    );
    setFormError(null);
    setPopupError(null);

    // Switch directly to the Referral Form / Intervention Form tab
    setActiveTab('intervention-form');
  };

  const handleConfirmReferral = () => {
    if (!referToGuidanceRecord) return;
    if (!popupReasonForReferral.trim()) {
      setPopupError('Please provide a brief description or summary of concerns for the referral.');
      return;
    }
    if (popupReasons.length === 0) {
      setPopupError('Please select at least one Reason for Intervention from the checklist.');
      return;
    }
    if (popupReasons.includes('Others') && !popupReasonsOther.trim()) {
      setPopupError('Please specify the other reason for intervention.');
      return;
    }
    if (popupAttachmentsType === 'Others' && !popupAttachmentsOther.trim()) {
      setPopupError('Please specify the other attachment details.');
      return;
    }

    let urgencyLevel: InterventionUrgency = 'MEDIUM';
    if (popupUrgencyOfReferral.startsWith('Immediate')) {
      urgencyLevel = 'URGENT';
    } else if (popupUrgencyOfReferral.startsWith('Within 3')) {
      urgencyLevel = 'HIGH';
    } else if (popupUrgencyOfReferral.startsWith('Within 1')) {
      urgencyLevel = 'MEDIUM';
    } else {
      urgencyLevel = 'LOW';
    }

    referInterventionRecordToGuidance(referToGuidanceRecord.id, {
      dateOfReferral: popupDateOfReferral,
      referredByPersonnel: popupReferredByPersonnel,
      referredBy: popupReferredByPersonnel,
      referredByDesignation: popupReferredByDesignation,
      reasonForReferral: popupReasonForReferral,
      descriptionOfConcerns: popupReasonForReferral,
      reasons: popupReasons,
      reasonsOther: popupReasons.includes('Others') ? popupReasonsOther : undefined,
      recommendedDesignation: popupRecommendedDesignation,
      actionTakenSummary: popupActionTakenSummary,
      summaryOfActionTaken: popupActionTakenSummary,
      urgencyOfReferral: popupUrgencyOfReferral,
      urgency: urgencyLevel,
      urgencyLevel: urgencyLevel,
      attachmentsType: popupAttachmentsType,
      attachmentsOther: popupAttachmentsType === 'Others' ? popupAttachmentsOther : undefined,
      osasApprovalName: popupOsasApprovalName,
      osasApprovalDate: popupOsasApprovalDate,
      approvedBy: popupApprovedBy,
      receivedByName: popupReceivedByName,
      receivedByPosition: popupReceivedByPosition,
      receivedDate: popupReceivedDate,
      receivedActionRemarks: popupReceivedActionRemarks,
      notes: `${popupReasonForReferral}\n\nSummary of Action Taken by OSAS:\n${popupActionTakenSummary}`,
    });

    setReferToGuidanceRecord(null);
    loadData();
  };

  const studentSuggestions = useMemo(() => {
    if (!studentSearchInput.trim()) return [];
    const q = studentSearchInput.toLowerCase().trim();
    return students.filter(
      (s) =>
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        s.fullName.toLowerCase().includes(q) ||
        (s.course && s.course.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [students, studentSearchInput]);

  const handleSelectStudent = (student: User) => {
    const sId = student.studentId || student.id || '';
    const sName = student.fullName || '';
    const sProgram = student.academicProgram || student.course || 'BS Information Technology';
    const sYear = student.yearLevel || '1st Year';
    const sContact = student.contactNumber || '09171234567';
    const sAddr = student.permanentAddress || student.address || 'Dingalan, Aurora';

    setSelectedStudentUser(student);
    setStudentSearchInput(`${sName} (${sId || 'No ID'})`);
    setStudentId(sId);
    setStudentName(sName);
    setCourse(sProgram);
    setYearLevel(sYear);
    setContactNumber(sContact);
    setAddress(sAddr);
    setEmail(student.email || '');
    setShowStudentSuggestions(false);
    setFormError(null);

    // Also fetch latest complete student record from Firestore asynchronously
    findUserAsync(sId || student.email || sName)
      .then((remoteUser) => {
        if (remoteUser) {
          setSelectedStudentUser(remoteUser);
          setStudentId(remoteUser.studentId || remoteUser.id || sId);
          setStudentName(remoteUser.fullName || sName);
          setCourse(remoteUser.academicProgram || remoteUser.course || sProgram);
          setYearLevel(remoteUser.yearLevel || sYear);
          setContactNumber(remoteUser.contactNumber || sContact);
          setAddress(remoteUser.permanentAddress || remoteUser.address || sAddr);
          setEmail(remoteUser.email || student.email || '');
        }
      })
      .catch(() => {});

    if (!isGuidance) {
      // Link to existing Guidance-referred intervention record for this student if present so no duplicate is created
      const existingReferred = records.find(
        (r) =>
          (r.referredToOsas || r.osasReferralDate || r.referredBy === 'Guidance Advocate') &&
          ((r.studentId && sId && r.studentId.trim().toLowerCase() === sId.trim().toLowerCase()) ||
            (r.studentName && sName && r.studentName.trim().toLowerCase() === sName.trim().toLowerCase()))
      );
      if (existingReferred) {
        setEditingReferralRecord(existingReferred);
        setDescriptionOfConcerns(
          existingReferred.osasReferralDescription ||
            existingReferred.problemConcernToAddress ||
            existingReferred.descriptionOfConcerns ||
            ''
        );
        setSelectedReasons(
          Array.isArray(existingReferred.reasons) && existingReferred.reasons.length > 0
            ? existingReferred.reasons
            : existingReferred.interventionTypes || []
        );
        setCounselingApprovalStatus(existingReferred.counselingApprovalStatus || 'Approved');
        setCounselingScheduledDateTime(existingReferred.counselingScheduledDateTime || 'Not specified');
        setOsasSessionRemarks(existingReferred.osasRemarks || '');
        setOsasSessionDate(existingReferred.osasSessionDate || new Date().toISOString().split('T')[0]);
        setOsasSessionConductedBy(
          existingReferred.osasRemarksBy || currentUser?.fullName || 'Princess Ann T. Ruzol (OSAS Administrator)'
        );
        setPopupActionTakenSummary(existingReferred.actionTakenSummary || '');
        return;
      }
    }

    // When Intervention Form is opened directly, keep Problem and Concerns to Address, Counseling Approval, and Schedule Date & Time completely blank
    if (isGuidance && !isFromStudentConcerns) {
      setDescriptionOfConcerns('');
      setCounselingApprovalStatus('');
      setCounselingScheduledDateTime('');
    }
  };

  const handleClearSelectedStudent = () => {
    setSelectedStudentUser(null);
    setStudentSearchInput('');
    setStudentId('');
    setStudentName('');
    setCourse('');
    setYearLevel('');
    setContactNumber('');
    setAddress('');
    setEmail('');
    if (isGuidance && !isFromStudentConcerns) {
      setDescriptionOfConcerns('');
      setCounselingApprovalStatus('');
      setCounselingScheduledDateTime('');
    }
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const toggleStrategy = (strategy: string) => {
    setSelectedStrategies((prev) =>
      prev.includes(strategy) ? prev.filter((s) => s !== strategy) : [...prev, strategy]
    );
  };

  const resetForm = () => {
    setIsFromStudentConcerns(false);
    setEditingReferralRecord(null);
    handleClearSelectedStudent();
    setDateOfReferral(new Date().toISOString().split('T')[0]);
    setReferredBy(isGuidance ? 'Guidance Advocate' : 'OSAS Administrator');
    setReferredByOther('');
    setNameOfReferrer('');
    setRelationshipToStudent('');
    setSelectedReasons([]);
    setReasonsOther('');
    setDescriptionOfConcerns('');
    setSelectedStrategies([]);
    setStrategiesOther('');
    setNextSteps('');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setFollowUpDate(d.toISOString().split('T')[0]);
    setResponsibleParties('OSAS Administrator, Guidance Counselor');
    setStatus(isGuidance ? 'ACTIVE' : 'REFERRED');
    setCounselingApprovalStatus('');
    setCounselingScheduledDateTime('');
    setSelectedInterventionTypes([]);
    setOsasCounselingApprovalStatus('Approved');
    setOsasCounselingScheduledDateTime('');
    setPopupActionTakenSummary('');
    setPopupUrgencyOfReferral('Within 3 days');
    setPopupAttachmentsType('None / Not Applicable');
    setPopupAttachmentsOther('');
    setOsasSessionRemarks('');
    setOsasSessionDate(new Date().toISOString().split('T')[0]);
    setOsasSessionConductedBy(currentUser?.fullName || 'Princess Ann T. Ruzol (OSAS Administrator)');
    setFormError(null);
  };

  const handleOpenOsasFormForRecord = (rec: InterventionRecord) => {
    setEditingReferralRecord(rec);
    setSelectedRecord(null);

    const matchedStudent = students.find(
      (s) =>
        (s.studentId && rec.studentId && s.studentId.trim().toLowerCase() === rec.studentId.trim().toLowerCase()) ||
        s.id === rec.studentId ||
        (s.fullName && rec.studentName && s.fullName.trim().toLowerCase() === rec.studentName.trim().toLowerCase())
    );

    const sId = rec.studentId || matchedStudent?.studentId || '';
    const sName = rec.studentName || matchedStudent?.fullName || '';
    const sCourse = rec.course || matchedStudent?.academicProgram || matchedStudent?.course || 'BS Information Technology';
    const sYear = rec.yearLevel || matchedStudent?.yearLevel || '1st Year';
    const sContact = rec.contactNumber || matchedStudent?.contactNumber || '09171234567';
    const sAddress = rec.address || matchedStudent?.permanentAddress || matchedStudent?.address || 'Dingalan, Aurora';

    setSelectedStudentUser(matchedStudent || null);
    setStudentSearchInput(`${sName} (${sId || 'No ID'})`);
    setStudentId(sId);
    setStudentName(sName);
    setCourse(sCourse);
    setYearLevel(sYear);
    setContactNumber(sContact);
    setAddress(sAddress);
    setEmail(rec.email || matchedStudent?.email || '');

    setDateOfReferral(rec.osasReferralDate || rec.dateOfReferral || new Date().toISOString().split('T')[0]);
    setSelectedReasons(
      Array.isArray(rec.reasons) && rec.reasons.length > 0
        ? rec.reasons
        : rec.interventionTypes || []
    );
    setReasonsOther(rec.reasonsOther || '');
    setDescriptionOfConcerns(rec.osasReferralDescription || rec.problemConcernToAddress || rec.descriptionOfConcerns || '');
    const normalizedApproval =
      rec.counselingApprovalStatus === 'PENDING'
        ? 'Pending'
        : rec.counselingApprovalStatus === 'APPROVED'
        ? 'Approved'
        : rec.counselingApprovalStatus === 'RESCHEDULED'
        ? 'Rescheduled'
        : rec.counselingApprovalStatus === 'COMPLETED'
        ? 'Completed'
        : rec.counselingApprovalStatus || 'Approved';
    setOsasCounselingApprovalStatus(normalizedApproval);
    setOsasCounselingScheduledDateTime(toDateTimeLocalValue(rec.counselingScheduledDateTime || ''));

    setOsasSessionRemarks(rec.osasRemarks || '');
    setOsasSessionDate(rec.osasSessionDate || new Date().toISOString().split('T')[0]);
    setOsasSessionConductedBy(rec.osasRemarksBy || currentUser?.fullName || 'Princess Ann T. Ruzol (OSAS Administrator)');
    setPopupActionTakenSummary(rec.actionTakenSummary || '');
    setFormError(null);
    setActiveTab('intervention-form');

    findUserAsync(sId, sName).then((firestoreStudent) => {
      if (firestoreStudent) {
        setSelectedStudentUser(firestoreStudent);
        const resolvedId = rec.studentId || firestoreStudent.studentId || firestoreStudent.id || sId;
        const resolvedName = rec.studentName || firestoreStudent.fullName || sName;
        setStudentId(resolvedId);
        setStudentName(resolvedName);
        setStudentSearchInput(`${resolvedName} (${resolvedId})`);
        setCourse(rec.course || firestoreStudent.academicProgram || firestoreStudent.course || sCourse);
        setYearLevel(rec.yearLevel || firestoreStudent.yearLevel || sYear);
        setContactNumber(rec.contactNumber || firestoreStudent.contactNumber || sContact);
        setAddress(rec.address || firestoreStudent.permanentAddress || firestoreStudent.address || sAddress);
        setEmail(rec.email || firestoreStudent.email || '');
      }
    });
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!studentName.trim() || !studentId.trim()) {
      setFormError('Please select or enter valid Student Information (Student ID and Full Name are required).');
      return;
    }

    if (isGuidance) {
      if (!descriptionOfConcerns.trim()) {
        setFormError('Please enter the Problem / Concern to Address.');
        return;
      }
      if (selectedInterventionTypes.length === 0) {
        setFormError('Please select at least one Intervention Type.');
        return;
      }
    } else {
      if (!osasSessionRemarks.trim()) {
        setFormError('Please enter the OSAS Remarks describing what happened during the session.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const createdByName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'OSAS Administrator');

      if (!isGuidance) {
        // OSAS Admin: Save OSAS session & remarks to the SAME original Firestore intervention record (no duplicates)
        const targetRecord =
          editingReferralRecord ||
          records.find(
            (r) =>
              (r.referredToOsas || r.osasReferralDate || r.referredBy === 'Guidance Advocate') &&
              ((r.studentId && r.studentId.trim().toLowerCase() === studentId.trim().toLowerCase()) ||
                (r.studentName && r.studentName.trim().toLowerCase() === studentName.trim().toLowerCase()))
          ) ||
          records.find(
            (r) =>
              (r.studentId && r.studentId.trim().toLowerCase() === studentId.trim().toLowerCase()) ||
              (r.studentName && r.studentName.trim().toLowerCase() === studentName.trim().toLowerCase())
          );

        if (targetRecord) {
          updateInterventionRecord(
            targetRecord.id,
            {
              studentId: studentId.trim(),
              studentName: studentName.trim(),
              course: course.trim() || targetRecord.course || 'N/A',
              yearLevel: yearLevel.trim() || targetRecord.yearLevel || 'N/A',
              contactNumber: contactNumber.trim() || targetRecord.contactNumber || 'N/A',
              address: address.trim() || targetRecord.address || 'N/A',
              counselingApprovalStatus: osasCounselingApprovalStatus || targetRecord.counselingApprovalStatus || 'Approved',
              counselingScheduledDateTime: osasCounselingScheduledDateTime || targetRecord.counselingScheduledDateTime || undefined,
              osasRemarks: osasSessionRemarks.trim(),
              osasRemarksBy: osasSessionConductedBy || createdByName,
              osasRemarksSavedAt: new Date().toISOString(),
              osasSessionDate: osasSessionDate || new Date().toISOString().split('T')[0],
              osasSessionConductedBy: osasSessionConductedBy || createdByName,
              actionTakenSummary: popupActionTakenSummary.trim() || targetRecord.actionTakenSummary || undefined,
              summaryOfActionTaken: popupActionTakenSummary.trim() || targetRecord.summaryOfActionTaken || undefined,
            },
            createdByName
          );

          sendNotification(
            'GUIDANCE_ADMIN',
            `OSAS Session Remarks Saved: ${studentName.trim()}`,
            `OSAS Administrator recorded session remarks for ${studentName.trim()}'s referred intervention.`,
            'INTERVENTION'
          );
        } else {
          // Fallback if OSAS creates a record when none existed yet
          addInterventionRecord(
            {
              studentId: studentId.trim(),
              studentName: studentName.trim(),
              course: course.trim() || 'N/A',
              yearLevel: yearLevel.trim() || 'N/A',
              contactNumber: contactNumber.trim() || 'N/A',
              address: address.trim() || 'N/A',
              email: email.trim() || undefined,
              dateOfReferral,
              referredBy: 'Guidance Advocate',
              referredToOsas: true,
              osasReferralDate: dateOfReferral,
              reasons: selectedReasons.length > 0 ? selectedReasons : selectedInterventionTypes,
              descriptionOfConcerns: descriptionOfConcerns.trim() || osasSessionRemarks.trim(),
              problemConcernToAddress: descriptionOfConcerns.trim() || osasSessionRemarks.trim(),
              counselingApprovalStatus: osasCounselingApprovalStatus || 'Approved',
              counselingScheduledDateTime: osasCounselingScheduledDateTime || undefined,
              interventionTypes: selectedInterventionTypes,
              strategies: [],
              nextSteps: '',
              responsibleParties: 'OSAS Administrator, Guidance Advocate',
              status: 'REFERRED',
              osasRemarks: osasSessionRemarks.trim(),
              osasRemarksBy: osasSessionConductedBy || createdByName,
              osasRemarksSavedAt: new Date().toISOString(),
              osasSessionDate: osasSessionDate || new Date().toISOString().split('T')[0],
              osasSessionConductedBy: osasSessionConductedBy || createdByName,
              actionTakenSummary: popupActionTakenSummary.trim() || undefined,
            },
            createdByName
          );
        }

        resetForm();
        loadData();
        setActiveTab('intervention-records');
        return;
      }

      // Guidance Advocate: Create or update Intervention Record (if an intervention for this student concern already exists, update it instead of duplicating)
      const existingGuidanceRec =
        editingReferralRecord ||
        records.find(
          (r) =>
            ((r.studentId && r.studentId.trim().toLowerCase() === studentId.trim().toLowerCase()) ||
              (r.studentName && r.studentName.trim().toLowerCase() === studentName.trim().toLowerCase())) &&
            (r.problemConcernToAddress || r.descriptionOfConcerns || '').trim().toLowerCase() ===
              descriptionOfConcerns.trim().toLowerCase()
        );

      if (existingGuidanceRec) {
        updateInterventionRecord(
          existingGuidanceRec.id,
          {
            studentId: studentId.trim(),
            studentName: studentName.trim(),
            course: course.trim() || 'N/A',
            yearLevel: yearLevel.trim() || 'N/A',
            contactNumber: contactNumber.trim() || 'N/A',
            address: address.trim() || 'N/A',
            email: email.trim() || undefined,
            dateOfReferral,
            referredBy: 'Guidance Advocate',
            reasons: selectedInterventionTypes,
            descriptionOfConcerns: descriptionOfConcerns.trim(),
            problemConcernToAddress: descriptionOfConcerns.trim(),
            counselingApprovalStatus: counselingApprovalStatus || 'Approved',
            counselingScheduledDateTime: counselingScheduledDateTime || undefined,
            interventionTypes: selectedInterventionTypes,
            guidanceAdvocateName: currentUser?.fullName || 'Maria Mel B. Glemao',
            guidanceAdvocatePosition: 'Guidance Advocate',
            strategies: [],
          },
          createdByName
        );
      } else {
        addInterventionRecord(
          {
            studentId: studentId.trim(),
            studentName: studentName.trim(),
            course: course.trim() || 'N/A',
            yearLevel: yearLevel.trim() || 'N/A',
            contactNumber: contactNumber.trim() || 'N/A',
            address: address.trim() || 'N/A',
            email: email.trim() || undefined,
            dateOfReferral,
            referredBy: 'Guidance Advocate',
            reasons: selectedInterventionTypes,
            descriptionOfConcerns: descriptionOfConcerns.trim(),
            problemConcernToAddress: descriptionOfConcerns.trim(),
            counselingApprovalStatus: counselingApprovalStatus || 'Approved',
            counselingScheduledDateTime: counselingScheduledDateTime || undefined,
            interventionTypes: selectedInterventionTypes,
            guidanceAdvocateName: currentUser?.fullName || 'Maria Mel B. Glemao',
            guidanceAdvocatePosition: 'Guidance Advocate',
            strategies: [],
            nextSteps: '',
            responsibleParties: 'Guidance Advocate',
            status: 'ACTIVE',
          },
          createdByName
        );
      }

      resetForm();
      loadData();
      setActiveTab('intervention-records');
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateInterventionFromConcern = (app: Appointment) => {
    resetForm();
    setIsFromStudentConcerns(true);
    setSelectedApp(null);

    // Auto-fetch complete student record from Firestore / user database
    const allUsers = getUsers();
    const matchedStudent = allUsers.find(
      (s) =>
        (s.studentId && app.studentId && s.studentId.trim().toLowerCase() === app.studentId.trim().toLowerCase()) ||
        (s.id && app.studentId && s.id === app.studentId) ||
        (s.fullName && app.studentName && s.fullName.trim().toLowerCase() === app.studentName.trim().toLowerCase()) ||
        (s.email && app.studentEmail && s.email.trim().toLowerCase() === app.studentEmail.trim().toLowerCase())
    );

    const sId = matchedStudent?.studentId || app.studentId || '';
    const sName = matchedStudent?.fullName || app.studentName || '';
    const sCourse =
      matchedStudent?.academicProgram ||
      matchedStudent?.course ||
      app.academicProgram ||
      app.course ||
      'BS Information Technology';
    const sYear = matchedStudent?.yearLevel || app.yearLevel || '1st Year';
    const sContact = matchedStudent?.contactNumber || app.contactNumber || '09171234567';
    const sAddress =
      matchedStudent?.permanentAddress ||
      matchedStudent?.address ||
      app.completeAddress ||
      app.address ||
      'Dingalan, Aurora';
    const sEmail = matchedStudent?.email || app.studentEmail || '';

    setStudentId(sId);
    setStudentName(sName);
    setCourse(sCourse);
    setYearLevel(sYear);
    setContactNumber(sContact);
    setAddress(sAddress);
    setEmail(sEmail);
    setSelectedStudentUser(
      matchedStudent ||
        ({
          id: sId || `stud-${Date.now()}`,
          studentId: sId,
          fullName: sName,
          course: sCourse,
          academicProgram: sCourse,
          yearLevel: sYear,
          contactNumber: sContact,
          address: sAddress,
          permanentAddress: sAddress,
          email: sEmail,
          role: 'STUDENT',
          createdAt: new Date().toISOString(),
        } as User)
    );
    setStudentSearchInput(`${sName} (${sId || 'No ID'})`);

    // Asynchronously fetch complete student record directly from Firestore to ensure all 6 fields are populated from Firestore
    findUserAsync(sId || sEmail || sName)
      .then((remoteStudent) => {
        if (remoteStudent) {
          const fullId = remoteStudent.studentId || remoteStudent.id || sId;
          const fullName = remoteStudent.fullName || sName;
          const fullProg = remoteStudent.academicProgram || remoteStudent.course || sCourse;
          const fullYear = remoteStudent.yearLevel || sYear;
          const fullContact = remoteStudent.contactNumber || sContact;
          const fullAddress = remoteStudent.permanentAddress || remoteStudent.address || sAddress;
          setSelectedStudentUser(remoteStudent);
          setStudentId(fullId);
          setStudentName(fullName);
          setCourse(fullProg);
          setYearLevel(fullYear);
          setContactNumber(fullContact);
          setAddress(fullAddress);
          setEmail(remoteStudent.email || sEmail);
          setStudentSearchInput(`${fullName} (${fullId || 'No ID'})`);
        }
      })
      .catch(() => {});

    // 2. Problem / Concern to Address — display the student's original submitted concern; not a new/empty value
    const originalConcern = app.description || app.concerns || app.purpose || '';
    setDescriptionOfConcerns(originalConcern);

    // 3. Counseling Approval — dropdown with existing status options, including Pending and Approved
    const rawStatus = app.status || 'APPROVED';
    const statusLabel =
      rawStatus === 'APPROVED'
        ? 'Approved'
        : rawStatus === 'RESCHEDULED'
        ? 'Rescheduled'
        : rawStatus === 'COMPLETED'
        ? 'Completed'
        : rawStatus === 'PENDING' || rawStatus === 'REFERRED' || rawStatus === 'REFERRED_TO_GUIDANCE'
        ? 'Pending'
        : rawStatus;
    setCounselingApprovalStatus(statusLabel);

    // 4. Schedule Date & Time — settable date/time field (auto-populated from concern schedule)
    const schedDate = app.adminPreferredDate || app.preferredDate || '';
    const schedTime = app.adminPreferredTime || app.preferredTime || '';
    setCounselingScheduledDateTime(toDateTimeLocalValue(schedDate, schedTime));

    // All 4 Intervention Type checkboxes must be unchecked by default
    setSelectedInterventionTypes([]);
    setFormError(null);
    setActiveTab('intervention-form');
  };

  // Handler to open Refer to OSAS Office modal
  const handleOpenReferToOsas = (rec: InterventionRecord) => {
    setReferToOsasRecord(rec);
    setReferToOsasDate(rec.osasReferralDate || new Date().toISOString().split('T')[0]);
    setReferToOsasReason(
      rec.osasReferralReason ||
        (rec.interventionTypes && rec.interventionTypes.length > 0
          ? rec.interventionTypes.join(', ')
          : rec.reasons && rec.reasons.length > 0
          ? rec.reasons.join(', ')
          : '')
    );
    setReferToOsasDescription(
      rec.osasReferralDescription || rec.problemConcernToAddress || rec.descriptionOfConcerns || ''
    );
    setReferToOsasError('');
  };

  const handleSubmitReferToOsas = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referToOsasRecord) return;
    if (!referToOsasReason.trim()) {
      setReferToOsasError('Please provide the Reason for Intervention.');
      return;
    }
    if (!referToOsasDescription.trim()) {
      setReferToOsasError('Please provide the Description.');
      return;
    }

    const actorName = currentUser?.fullName || 'Maria Mel B. Glemao';
    updateInterventionRecord(
      referToOsasRecord.id,
      {
        referredToOsas: true,
        osasReferralDate: referToOsasDate,
        osasReferralBy: actorName,
        osasReferralReason: referToOsasReason.trim(),
        osasReferralDescription: referToOsasDescription.trim(),
        reasonForReferral: referToOsasReason.trim(),
        status: referToOsasRecord.status === 'COMPLETED' || referToOsasRecord.status === 'RESOLVED' ? referToOsasRecord.status : 'REFERRED',
      },
      actorName
    );

    sendNotification(
      'ADMIN',
      `New Referred Intervention: ${referToOsasRecord.studentName}`,
      `Guidance Advocate referred ${referToOsasRecord.studentName} to the OSAS Office for intervention and evaluation.`,
      'INTERVENTION'
    );

    setReferToOsasRecord(null);
    loadData();
  };

  // Handlers for OSAS Admin recording session remarks via modal
  const handleOpenOsasSessionModal = (rec: InterventionRecord) => {
    setOsasSessionRecord(rec);
    setOsasSessionRemarks(rec.osasRemarks || '');
    setOsasSessionDate(rec.osasSessionDate || new Date().toISOString().split('T')[0]);
    setOsasSessionConductedBy(rec.osasRemarksBy || currentUser?.fullName || 'Princess Ann T. Ruzol (OSAS Administrator)');
    setOsasSessionActionTaken(rec.actionTakenSummary || '');
    setOsasSessionError('');
  };

  const handleSaveOsasRemarks = (e: React.FormEvent) => {
    e.preventDefault();
    if (!osasSessionRecord) return;
    if (!osasSessionRemarks.trim()) {
      setOsasSessionError('Please enter OSAS Remarks describing what happened during the session.');
      return;
    }

    const actorName = currentUser?.fullName || 'Princess Ann T. Ruzol (OSAS Administrator)';
    updateInterventionRecord(
      osasSessionRecord.id,
      {
        osasRemarks: osasSessionRemarks.trim(),
        osasRemarksBy: osasSessionConductedBy || actorName,
        osasRemarksSavedAt: new Date().toISOString(),
        osasSessionDate: osasSessionDate,
        osasSessionConductedBy: osasSessionConductedBy || actorName,
        actionTakenSummary: osasSessionActionTaken.trim() || osasSessionRecord.actionTakenSummary || undefined,
      },
      actorName
    );

    sendNotification(
      'GUIDANCE_ADMIN',
      `OSAS Session Remarks Saved: ${osasSessionRecord.studentName}`,
      `OSAS Administrator recorded session remarks for ${osasSessionRecord.studentName}'s referred intervention.`,
      'INTERVENTION'
    );

    setOsasSessionRecord(null);
    loadData();
  };

  const handleMarkInterventionDone = (id: string) => {
    const actorName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'OSAS Administrator');
    const rec = records.find((r) => r.id === id);
    if (rec && (rec.status === 'COMPLETED' || rec.status === 'RESOLVED' || Boolean(rec.completedAt))) {
      return;
    }
    updateInterventionRecord(
      id,
      {
        status: 'COMPLETED',
        guidanceStatus: 'COMPLETED',
        completedAt: new Date().toISOString(),
      },
      actorName
    );

    // Move the existing Mark Done function to Intervention Records, including the same student-facing Leave Feedback behavior
    if (rec) {
      const allApps = getAppointments();
      const matchingApp = allApps.find(
        (a) =>
          (a.studentId === rec.studentId || (a.studentName && rec.studentName && a.studentName.toLowerCase() === rec.studentName.toLowerCase())) &&
          a.status !== 'COMPLETED'
      );
      if (matchingApp) {
        markAppointmentDoneByAdmin(matchingApp.id, actorName);
      }
    }

    loadData();
  };

  const handleOpenCreateResolutionForRecord = (record: InterventionRecord) => {
    setResolutionTargetRecord(record);
    setResProblemResolved(record.problemResolved || record.problemConcernToAddress || record.descriptionOfConcerns || '');
    const existingActionText =
      record.guidanceActionTaken ||
      (record.resolutionActionSteps && record.resolutionActionSteps.length > 0
        ? record.resolutionActionSteps
            .map((s) => s.actionTaken)
            .filter(Boolean)
            .join('\n')
        : '') ||
      '';
    setResActionTakenText(existingActionText);
    setResOutcome('RESOLVED');
    setResDetails(record.resolutionDetails || '');
    setResError('');
  };

  const handleSaveResolutionForRecord = (e: React.FormEvent) => {
    e.preventDefault();
    setResError('');

    if (!resolutionTargetRecord) return;
    if (!resActionTakenText.trim()) {
      setResError('Please enter the Action Taken step-by-step.');
      return;
    }
    if (!resDetails.trim()) {
      setResError('Please provide the Resolution Details narrative.');
      return;
    }

    const actorName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'OSAS Administrator');
    const nowIso = new Date().toISOString();
    const steps: ResolutionActionStep[] = [
      {
        stepNumber: 1,
        stepTitle: 'Action Taken',
        dateTime: nowIso.slice(0, 16),
        actionTaken: resActionTakenText.trim(),
        responsiblePerson: actorName,
        personInvolved: actorName,
      },
    ];

    updateInterventionRecord(
      resolutionTargetRecord.id,
      {
        problemResolved: (
          resProblemResolved ||
          resolutionTargetRecord.problemConcernToAddress ||
          resolutionTargetRecord.descriptionOfConcerns ||
          ''
        ).trim(),
        resolutionActionSteps: steps,
        guidanceActionTaken: resActionTakenText.trim(),
        actionTakenSummary: resActionTakenText.trim(),
        resolutionOutcome: resOutcome,
        resolutionDetails: resDetails.trim(),
        resolvedAt: nowIso,
        resolvedBy: actorName,
        status: 'COMPLETED',
        guidanceStatus: 'COMPLETED',
        completedAt: nowIso,
      },
      actorName
    );

    // Replace the bottom Save Resolution action with the existing Mark Done function (including triggering the student's Leave Feedback)
    const allApps = getAppointments();
    const matchingApp = allApps.find(
      (a) =>
        (a.studentId === resolutionTargetRecord.studentId ||
          (a.studentName &&
            resolutionTargetRecord.studentName &&
            a.studentName.trim().toLowerCase() === resolutionTargetRecord.studentName.trim().toLowerCase())) &&
        a.status !== 'COMPLETED'
    );
    if (matchingApp) {
      markAppointmentDoneByAdmin(matchingApp.id, actorName);
    }

    setResolutionTargetRecord(null);
    loadData();
    setActiveTab('resolutions');
  };

  const resolutionRecords = useMemo(() => {
    return [...records]
      .filter(
        (r) =>
          r.problemResolved ||
          r.resolutionDetails ||
          r.guidanceActionTaken ||
          (r.resolutionActionSteps && r.resolutionActionSteps.length > 0)
      )
      .sort((a, b) => {
        const timeB = new Date(b.resolvedAt || b.createdAt || 0).getTime();
        const timeA = new Date(a.resolvedAt || a.createdAt || 0).getTime();
        return timeB - timeA;
      });
  }, [records]);

  const filteredResolutionRecords = useMemo(() => {
    const q = resolutionSearchQuery.trim().toLowerCase();
    if (!q) return resolutionRecords;
    return resolutionRecords.filter((rep) => {
      const actionText =
        rep.guidanceActionTaken ||
        rep.actionTakenSummary ||
        (rep.resolutionActionSteps && rep.resolutionActionSteps.length > 0
          ? rep.resolutionActionSteps
              .map((s) => s.actionTaken)
              .filter(Boolean)
              .join('\n')
          : '') ||
        '';
      return (
        (rep.id || '').toLowerCase().includes(q) ||
        (rep.studentName || '').toLowerCase().includes(q) ||
        (rep.studentId || '').toLowerCase().includes(q) ||
        (rep.course || '').toLowerCase().includes(q) ||
        (rep.yearLevel || '').toLowerCase().includes(q) ||
        (rep.problemResolved || '').toLowerCase().includes(q) ||
        (rep.problemConcernToAddress || '').toLowerCase().includes(q) ||
        (rep.descriptionOfConcerns || '').toLowerCase().includes(q) ||
        actionText.toLowerCase().includes(q) ||
        (rep.osasRemarks || '').toLowerCase().includes(q) ||
        (rep.resolutionDetails || '').toLowerCase().includes(q)
      );
    });
  }, [resolutionRecords, resolutionSearchQuery]);

  const handleArchive = (record: InterventionRecord) => {
    const adminName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'OSAS Administrator');
    archiveInterventionRecord(record.id, adminName);
    setArchiveConfirmRecord(null);
    setSelectedRecord(null);
    loadData();
  };

  const referredToOsasRecords = useMemo(() => {
    return [...records]
      .filter(
        (rec) =>
          Boolean(
            rec.referredToOsas ||
              rec.osasReferralDate ||
              rec.osasReferralReason ||
              rec.referredBy === 'OSAS Administrator' ||
              (rec.referredBy === 'Guidance Advocate' && rec.status === 'REFERRED')
          )
      )
      .sort((a, b) => {
        const timeB = new Date(b.osasReferralDate || b.createdAt || b.dateOfReferral || 0).getTime();
        const timeA = new Date(a.osasReferralDate || a.createdAt || a.dateOfReferral || 0).getTime();
        return timeB - timeA;
      });
  }, [records]);

  const filteredRecords = useMemo(() => {
    const sourceRecords = isGuidance ? records : referredToOsasRecords;
    return sourceRecords.filter((rec) => {
      const recReasons = Array.isArray(rec.reasons) ? rec.reasons : [];
      const matchesSearch =
        searchQuery.trim() === '' ||
        (rec.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.studentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.course || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.referredBy || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.nameOfReferrer && rec.nameOfReferrer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        recReasons.some((r) => r && r.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (rec.descriptionOfConcerns || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesReferrer =
        filterReferrer === 'ALL' || rec.referredBy === filterReferrer;

      const matchesStatus =
        filterStatus === 'ALL' || rec.status === filterStatus;

      return Boolean(matchesSearch && matchesReferrer && matchesStatus);
    });
  }, [records, referredToOsasRecords, isGuidance, searchQuery, filterReferrer, filterStatus]);

  const stats = useMemo(() => {
    return {
      total: records.length,
      active: records.filter((r) => r.status === 'ACTIVE').length,
      followUp: records.filter((r) => r.status === 'FOLLOW_UP_REQUIRED').length,
      resolved: records.filter((r) => r.status === 'RESOLVED').length,
    };
  }, [records]);

  const handlePrintSlip = (record: InterventionRecord) => {
    setPrintRecord(record);
  };

  const getStatusBadge = (recStatus: InterventionStatus) => {
    switch (recStatus) {
      case 'REFERRED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-800 flex items-center gap-1.5 w-fit">
            <Clock className="w-3 h-3 text-violet-600 dark:text-violet-400" />
            Referred to OSAS Office
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
            Intake Received
          </span>
        );
      case 'IN_PROGRESS':
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            In Progress (Counseling)
          </span>
        );
      case 'FOLLOW_UP':
      case 'FOLLOW_UP_REQUIRED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 w-fit">
            <Clock className="w-3 h-3 text-purple-600" />
            Follow-up Required
          </span>
        );
      case 'COMPLETED':
      case 'RESOLVED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-700">
            {recStatus}
          </span>
        );
    }
  };

  const getUrgencyBadge = (urgency?: InterventionUrgency) => {
    switch (urgency) {
      case 'URGENT':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            🚨 Urgent Priority
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            ⚡ High Priority
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Medium Priority
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Low Priority
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Background content (hidden during print when print modals are open) */}
      <div className={`space-y-6 ${printRecord || printApp ? 'print:hidden' : ''}`}>
        {/* Header Banner (Guidance only; removed for OSAS Intervention Resolution so Guidance Case Resolutions is the main content) */}
        {isGuidance && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs flex flex-col justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-2xl text-blue-600 dark:text-blue-400 shrink-0">
                  <HeartHandshake className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Student Concerns &amp; Intervention Module
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Comprehensive student concerns, intervention forms, and intervention records management.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center sm:justify-start gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('grievances')}
                className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'grievances'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Student Concerns</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    activeTab === 'grievances' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {appointments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setActiveTab('intervention-form');
                }}
                className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'intervention-form'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Intervention Form</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('intervention-records');
                  resetForm();
                }}
                className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'intervention-records'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Intervention Records</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    activeTab === 'intervention-records' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {records.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('resolutions')}
                className={`w-full sm:w-auto justify-center px-4 py-2.5 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'resolutions'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Resolutions</span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    activeTab === 'resolutions' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {resolutionRecords.length}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* View-Only Modal for Guidance Walk-In Records */}
        {selectedWalkInRecord && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedWalkInRecord(null)}
            title={`Guidance Walk-In Record - ${selectedWalkInRecord.studentName}`}
            subtitle={`Record ID: #${selectedWalkInRecord.id}`}
            maxWidth="lg"
          >
            <div className="space-y-4 p-2 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Student Number</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedWalkInRecord.studentId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Full Name</span>
                    <span className="font-bold text-slate-900 dark:text-white">{selectedWalkInRecord.studentName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Course / Academic Program</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedWalkInRecord.course || selectedWalkInRecord.academicProgram || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Year Level</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedWalkInRecord.yearLevel || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Number</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedWalkInRecord.contactNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {(() => {
                        const allInt = getInterventionRecords('ADMIN');
                        const match = allInt.find(inv => inv.studentId === selectedWalkInRecord.studentId || inv.studentId === selectedWalkInRecord.id);
                        return match?.status || selectedWalkInRecord.status;
                      })()}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Complete Address</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedWalkInRecord.completeAddress || 'N/A'}</span>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                    Reason / Concern / Purpose
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 leading-relaxed">
                    {selectedWalkInRecord.description}
                  </p>
                </div>

                {selectedWalkInRecord.actionTaken && (
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                      Action Taken
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 font-semibold">
                      {selectedWalkInRecord.actionTaken}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40">
                    <span className="font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider block text-[10px]">
                      Submitted Date & Time
                    </span>
                    <p className="font-mono text-blue-700 dark:text-blue-300 font-bold mt-0.5">
                      {selectedWalkInRecord.preferredDate} @ {selectedWalkInRecord.preferredTime}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedWalkInRecord(null)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close (View-Only)
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* TAB 1: STUDENT GRIEVANCES (RECORDS LAYOUT/DESIGN)        */}
        {/* ======================================================== */}
        {activeTab === 'grievances' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-2xl">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Student Concerns Records
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage student concerns, consultation sessions, and scheduling approvals
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative flex-1 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={grievanceSearchQuery}
                    onChange={(e) => setGrievanceSearchQuery(e.target.value)}
                    placeholder="Search student concerns..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <select
                  value={grievanceStatusFilter}
                  onChange={(e) => setGrievanceStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="RESCHEDULED">Rescheduled</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            {/* Appointments Table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3.5">Student Details</th>
                    <th className="p-3.5">Concern / Purpose</th>
                    <th className="p-3.5">Schedule</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        No student concerns found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((a) => {
                      const isCompleted = a.status === 'COMPLETED';
                      const isRejected = a.status === 'REJECTED';
                      const isReferred =
                        a.status === 'REFERRED' ||
                        a.status === 'REFERRED_TO_GUIDANCE' ||
                        a.referredToGuidance ||
                        a.referredFromOsas ||
                        a.isReferredFromOsas;

                      return (
                        <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5">
                            <span className="font-black text-slate-900 dark:text-white block">{a.studentName}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">
                              {a.studentId} • {a.studentEmail}
                            </span>
                          </td>

                          <td className="p-3.5 max-w-xs">
                            <p className="line-clamp-2 text-slate-700 dark:text-slate-300">{a.description}</p>
                          </td>

                          <td className="p-3.5 font-mono text-[11px] text-blue-700 dark:text-blue-400 font-bold">
                            <div>
                              {a.preferredDate} ({a.preferredTime})
                            </div>
                            {a.adminPreferredDate && (
                              <div className="text-purple-700 dark:text-purple-400 text-[10px] mt-0.5">
                                ↳ Resched: {a.adminPreferredDate} @ {a.adminPreferredTime}
                              </div>
                            )}
                            {/* Real-time Conflict Alert Badge in Table */}
                            {a.status !== 'APPROVED' && a.status !== 'COMPLETED' && (() => {
                              const conflictCheck = checkAppointmentConflict(a.id);
                              if (!conflictCheck.hasConflict || !conflictCheck.conflictingAppointment) return null;
                              return (
                                <div className="mt-1">
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black rounded-md bg-rose-100 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                    title={`May conflict sa approved appointment ni ${conflictCheck.conflictingAppointment.studentName}`}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                    Conflict: {conflictCheck.conflictingAppointment.studentName}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>

                          <td className="p-3.5">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${
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
                                {a.status === 'REFERRED' || a.status === 'REFERRED_TO_GUIDANCE'
                                  ? 'Referred'
                                  : a.status}
                              </span>

                              {/* 1-Week Auto Expiration Indicator for Completed Appointments */}
                              {isCompleted && a.completedAt && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-500" /> {getRemainingExpirationText(a.completedAt)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedApp(a);
                                setRescheduleDate(a.adminPreferredDate || a.preferredDate);
                                setRescheduleTime(a.adminPreferredTime || a.preferredTime);
                                const alreadyRescheduled =
                                  a.status === 'RESCHEDULED' ||
                                  Boolean(a.adminPreferredDate) ||
                                  Boolean(a.rescheduledByName);
                                setAdminNotes(alreadyRescheduled ? a.rescheduleReason || a.adminNotes || '' : '');
                                setRescheduleError('');
                              }}
                              className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold rounded-xl border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer text-xs shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: INTERVENTION FORM                                 */}
        {/* ======================================================== */}
        {activeTab === 'intervention-form' && (
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-8">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  {isGuidance ? 'Guidance & Counseling Services' : 'OSAS Referred Intervention & Session Form'}
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {editingReferralRecord
                    ? `${isGuidance ? 'Edit Intervention' : 'OSAS Intervention Session & Remarks'} — Case #${editingReferralRecord.id}`
                    : isGuidance
                    ? 'Intervention Form'
                    : 'OSAS Intervention Form'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editingReferralRecord
                    ? `Recording intervention session and OSAS Remarks for ${editingReferralRecord.studentName} (${editingReferralRecord.studentId}). Saves directly to the existing Firestore record.`
                    : isGuidance
                    ? 'Create a student intervention record linked to the student concern and counseling schedule.'
                    : 'Select a Guidance-referred intervention record or student to record OSAS session details and OSAS Remarks.'}
                </p>
              </div>
              {editingReferralRecord && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('intervention-records');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Back to Referred Records
                </button>
              )}
            </div>

            {formError && (
              <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 text-xs font-bold flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-8">
              {/* Section 1: Student Information */}
              <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      1
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Student Information *
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Automatically populated from Firestore student record
                      </p>
                    </div>
                  </div>
                  {(selectedStudentUser || studentId) && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Filled
                    </span>
                  )}
                </div>

                {/* Student Lookup Searchbox */}
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Search by Student ID or Full Name *
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={studentSearchInput}
                      readOnly={isGuidance && isFromStudentConcerns}
                      disabled={isGuidance && isFromStudentConcerns}
                      onChange={(e) => {
                        if (isGuidance && isFromStudentConcerns) return;
                        setStudentSearchInput(e.target.value);
                        setShowStudentSuggestions(true);
                      }}
                      onFocus={() => {
                        if (!(isGuidance && isFromStudentConcerns)) setShowStudentSuggestions(true);
                      }}
                      placeholder="Type student name or ID (e.g., Juan Dela Cruz, 2024-0101)..."
                      className={`w-full pl-10 pr-10 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold ${
                        isGuidance && isFromStudentConcerns
                          ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                      }`}
                    />
                    {studentSearchInput && !(isGuidance && isFromStudentConcerns) && (
                      <button
                        type="button"
                        onClick={handleClearSelectedStudent}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Suggestions Dropdown */}
                  {!(isGuidance && isFromStudentConcerns) && showStudentSuggestions && studentSuggestions.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Matching Registered Students (Click to Select)
                      </div>
                      {studentSuggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectStudent(s)}
                          className="w-full px-4 py-2.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {s.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              ID: {s.studentId || s.id} • {s.academicProgram || s.course || 'BSIT'} ({s.yearLevel || '1st Year'})
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                            Select ➔
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Student Details Grid: 6 Required Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Student ID *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={isGuidance && isFromStudentConcerns}
                      disabled={isGuidance && isFromStudentConcerns}
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. 2024-0101"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl font-mono font-bold text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 ${
                        isGuidance && isFromStudentConcerns
                          ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={isGuidance && isFromStudentConcerns}
                      disabled={isGuidance && isFromStudentConcerns}
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Full name of student..."
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl font-bold text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 ${
                        isGuidance && isFromStudentConcerns
                          ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Academic Program *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={isGuidance && isFromStudentConcerns}
                      disabled={isGuidance && isFromStudentConcerns}
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="e.g. BS Information Technology"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl font-semibold text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 ${
                        isGuidance && isFromStudentConcerns
                          ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Year Level *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={isGuidance && isFromStudentConcerns}
                      disabled={isGuidance && isFromStudentConcerns}
                      value={yearLevel}
                      onChange={(e) => setYearLevel(e.target.value)}
                      placeholder="e.g. 3rd Year"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl font-semibold text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 ${
                        isGuidance && isFromStudentConcerns
                          ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Contact Number *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={isGuidance && isFromStudentConcerns}
                      disabled={isGuidance && isFromStudentConcerns}
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="e.g. 09171234567"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl font-mono font-semibold text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 ${
                        isGuidance && isFromStudentConcerns
                          ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Address/Permanent Address *
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={isGuidance && isFromStudentConcerns}
                      disabled={isGuidance && isFromStudentConcerns}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Brgy. Dingalan, Aurora"
                      className={`w-full px-3.5 py-2 text-xs border rounded-xl font-semibold text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 ${
                        isGuidance && isFromStudentConcerns
                          ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Guidance-Specific Sections */}
              {isGuidance && (
                <>
                  {/* Section 2: Problem / Concern to Address */}
                  <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        2
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Problem / Concern to Address *
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Displays the student's original submitted concern
                        </p>
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={4}
                        required
                        readOnly={isFromStudentConcerns}
                        disabled={isFromStudentConcerns}
                        value={descriptionOfConcerns}
                        onChange={(e) => setDescriptionOfConcerns(e.target.value)}
                        placeholder="State the student's problem, concern, or purpose of counseling..."
                        className={`w-full p-4 text-xs border border-slate-300 dark:border-slate-600 rounded-2xl text-slate-900 dark:text-white leading-relaxed ${
                          isFromStudentConcerns
                            ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                            : 'bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Section 3: Schedule Date & Time */}
                  <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        3
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Schedule Date &amp; Time
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Settable intervention schedule date &amp; time
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Schedule Date &amp; Time
                      </label>
                      <input
                        type="datetime-local"
                        readOnly={isFromStudentConcerns}
                        disabled={isFromStudentConcerns}
                        value={counselingScheduledDateTime}
                        onChange={(e) => setCounselingScheduledDateTime(e.target.value)}
                        className={`w-full h-11 px-4 text-xs font-mono font-bold border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white ${
                          isFromStudentConcerns
                            ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                            : 'bg-white dark:bg-slate-900 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Section 4: Intervention Type (Checklist only) */}
                  <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          4
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            Intervention Type (Checklist) *
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Select one or more applicable intervention modalities
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 font-bold">
                        {selectedInterventionTypes.length} Selected
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        'Counseling Intervention',
                        'Academic Intervention',
                        'Behavioral Intervention',
                        'Parent Conference',
                      ].map((type) => {
                        const isChecked = selectedInterventionTypes.includes(type);
                        return (
                          <label
                            key={type}
                            className={`p-3.5 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer select-none ${
                              isChecked
                                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 shadow-2xs font-bold'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedInterventionTypes((prev) =>
                                  prev.includes(type)
                                    ? prev.filter((t) => t !== type)
                                    : [...prev, type]
                                );
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-xs">{type}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 5: Guidance Information */}
                  <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        5
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Guidance Information
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Automatically populated, not editable
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          Guidance Name
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={currentUser?.fullName || 'Maria Mel B. Glemao'}
                          className="w-full h-10 px-3.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-not-allowed focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          Position
                        </label>
                        <input
                          type="text"
                          readOnly
                          value="Guidance Advocate"
                          className="w-full h-10 px-3.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-not-allowed focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* OSAS Administrator Referred Intervention Form Sections */}
              {!isGuidance && (
                <>
                  {/* Section 2: Referred Intervention Details from Guidance */}
                  <div className="p-6 bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        2
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Referred Intervention Details
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Guidance referral information, Reason for Intervention, and Description
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Counseling Approval
                        </label>
                        <select
                          value={osasCounselingApprovalStatus || 'Approved'}
                          onChange={(e) => setOsasCounselingApprovalStatus(e.target.value)}
                          className="w-full h-10 px-3.5 text-xs font-black border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Rescheduled">Rescheduled</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Schedule Date &amp; Time
                        </label>
                        <input
                          type="datetime-local"
                          value={osasCounselingScheduledDateTime}
                          onChange={(e) => setOsasCounselingScheduledDateTime(e.target.value)}
                          className="w-full h-10 px-3.5 text-xs font-mono font-bold border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Reason for Intervention
                      </label>
                      <input
                        type="text"
                        value={
                          editingReferralRecord?.osasReferralReason ||
                          selectedReasons.join(', ') ||
                          selectedInterventionTypes.join(', ')
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedReasons(val ? [val] : []);
                        }}
                        placeholder="Reason for intervention..."
                        className="w-full h-10 px-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Problem / Concern to Address *
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={descriptionOfConcerns}
                        onChange={(e) => setDescriptionOfConcerns(e.target.value)}
                        placeholder="Student's concern and referral description..."
                        className="w-full p-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Section 3: OSAS Intervention Session & OSAS Remarks */}
                  <div className="p-6 bg-blue-50/50 dark:bg-blue-950/20 rounded-3xl border border-blue-200 dark:border-blue-800/80 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        3
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          OSAS Intervention Session &amp; OSAS Remarks *
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Record what happened during the OSAS intervention session. Saved to the same Firestore record so Guidance can view and use it in Resolution.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Session Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={osasSessionDate}
                          onChange={(e) => setOsasSessionDate(e.target.value)}
                          className="w-full h-10 px-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          OSAS Officer / Conducted By *
                        </label>
                        <input
                          type="text"
                          required
                          value={osasSessionConductedBy}
                          onChange={(e) => setOsasSessionConductedBy(e.target.value)}
                          className="w-full h-10 px-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        OSAS Remarks (What happened during the session) *
                      </label>
                      <textarea
                        rows={5}
                        required
                        value={osasSessionRemarks}
                        onChange={(e) => setOsasSessionRemarks(e.target.value)}
                        placeholder="Describe what happened during the OSAS intervention session, findings, student response, and agreements..."
                        className="w-full p-4 text-xs border border-blue-300 dark:border-blue-700 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Form Submit Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto px-5 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-2xl transition-colors cursor-pointer"
                >
                  Clear Form
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-blue-500/20 transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Saving Record...'
                      : !isGuidance
                      ? 'Save OSAS Session & Remarks'
                      : editingReferralRecord
                      ? 'Update Intervention Record'
                      : 'Create Intervention'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* OSAS ADMIN TAB: REFERRAL FORM                            */}
        {/* ======================================================== */}
        {!isGuidance && activeTab === 'referral-form' && (
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Student Concerns Referral Form
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete the student referral information below to refer an intervention record to the Guidance Office.
                </p>
              </div>
            </div>

            {osasRefSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Referral Record submitted and referred to Guidance successfully!
              </div>
            )}

            {osasRefErrorMsg && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-200">
                {osasRefErrorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitOsasReferralForm} className="space-y-5">
              {/* 1. Student Information (No Anonymous option) */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-blue-600" /> 1. Student Information *
                  </h4>
                </div>

                {/* Search Registered Student with X/Clear button */}
                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Student Search (Auto-fill)
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={osasRefStudentSearch}
                      onChange={(e) => {
                        setOsasRefStudentSearch(e.target.value);
                        setShowOsasRefStudentSuggestions(true);
                      }}
                      onFocus={() => setShowOsasRefStudentSuggestions(true)}
                      placeholder="Type student name or ID to auto-fill..."
                      className="w-full pl-9 pr-10 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                    />
                    {osasRefStudentSearch && (
                      <button
                        type="button"
                        onClick={handleClearOsasRefStudent}
                        className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Clear Student Information"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {showOsasRefStudentSuggestions && osasRefFilteredStudents.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {osasRefFilteredStudents.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectOsasRefStudent(st)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <p className="font-bold text-xs text-slate-900 dark:text-white">{st.fullName}</p>
                            <p className="text-[10px] text-slate-500">
                              {[st.academicProgram || st.course, st.yearLevel].filter(Boolean).join(' • ')}
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
                      value={osasRefStudentId}
                      onChange={(e) => setOsasRefStudentId(e.target.value)}
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
                      required
                      value={osasRefStudentName}
                      onChange={(e) => setOsasRefStudentName(e.target.value)}
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
                      value={osasRefCourse}
                      onChange={(e) => setOsasRefCourse(e.target.value)}
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
                      value={osasRefYearLevel}
                      onChange={(e) => setOsasRefYearLevel(e.target.value)}
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
                      value={osasRefContactNumber}
                      onChange={(e) => setOsasRefContactNumber(e.target.value)}
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
                      value={osasRefAddress}
                      onChange={(e) => setOsasRefAddress(e.target.value)}
                      placeholder="e.g. Brgy. Poblacion, Dingalan, Aurora"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Description */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" /> 2. Description *
                </h4>
                <p className="text-[11px] text-slate-500">
                  Enter description of student concern or intervention details.
                </p>
                <textarea
                  rows={4}
                  required
                  value={osasRefDescription}
                  onChange={(e) => setOsasRefDescription(e.target.value)}
                  placeholder="Enter description of concern or intervention details..."
                  className="w-full p-3.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* 3. Date & Time and 4. Reason for Referral (Side-by-Side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 3. Date & Time */}
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" /> 3. Date &amp; Time *
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Date and time of the referral.
                  </p>
                  <input
                    type="datetime-local"
                    required
                    value={osasRefDateTime}
                    onChange={(e) => setOsasRefDateTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* 4. Reason for Referral */}
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-blue-600" /> 4. Reason for Referral *
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Specify the reason for referral to Guidance Advocate.
                  </p>
                  <input
                    type="text"
                    required
                    value={osasRefReason}
                    onChange={(e) => setOsasRefReason(e.target.value)}
                    placeholder="Enter specific reason for referral..."
                    className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Student Concerns</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: INTERVENTION RECORDS / REFERRED INTERVENTION RECORDS */}
        {/* ======================================================== */}
        {activeTab === 'intervention-records' && (
          <div className="space-y-6">
            {/* Search and Filters Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative w-full sm:max-w-sm md:max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search student, ID, reason, concern..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Status Filter */}
                <div className="w-full sm:w-48">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Cases</option>
                    <option value="REFERRED">Referred Cases</option>
                    <option value="COMPLETED">Completed Cases</option>
                    <option value="RESOLVED">Resolved Cases</option>
                  </select>
                </div>
              </div>

              {/* Records List Display */}
              {filteredRecords.length === 0 ? (
                <div className="py-14 text-center space-y-3">
                  <HeartHandshake className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {isGuidance ? 'No intervention records found.' : 'No referred intervention records found.'}
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {searchQuery || filterReason !== 'ALL' || filterReferrer !== 'ALL' || filterStatus !== 'ALL'
                      ? 'No records match your selected filter criteria.'
                      : isGuidance
                      ? 'Click "Intervention Form" tab to create your first intervention record.'
                      : 'Interventions referred by the Guidance Office to OSAS will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredRecords.map((rec) => {
                    const isDone =
                      rec.status === 'COMPLETED' ||
                      rec.status === 'RESOLVED' ||
                      Boolean(rec.completedAt);
                    const interventionTypeList =
                      rec.interventionTypes && rec.interventionTypes.length > 0
                        ? rec.interventionTypes
                        : rec.reasons || [];
                    const isExpanded = Boolean(expandedRecordIds[rec.id]);

                    return (
                      <div
                        key={rec.id}
                        className="p-5 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl transition-all shadow-2xs hover:shadow-md space-y-4"
                      >
                        {/* Top Row: Student info & Status (Clickable to expand/collapse details) */}
                        <div
                          onClick={() => toggleRecordExpanded(rec.id)}
                          className={`flex items-start justify-between gap-3 cursor-pointer select-none ${
                            isExpanded ? 'pb-3 border-b border-slate-200/60 dark:border-slate-700/60' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-black text-sm">
                              {rec.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                  {rec.studentName}
                                </h3>
                                <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-bold">
                                  ID: {rec.studentId}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {rec.course} • {rec.yearLevel} • {rec.contactNumber} • {rec.address}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start ml-auto">
                            {!isGuidance ? (
                              <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-800 flex items-center gap-1.5 w-fit">
                                <Clock className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                                Referred to OSAS Office
                              </span>
                            ) : (
                              getStatusBadge(rec.status)
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRecordExpanded(rec.id);
                              }}
                              className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
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
                          </div>
                        </div>

                        {isExpanded && (
                          <>
                            {/* Middle Details Grid: Actual Intervention Form Fields Only (No Intervention Strategies) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {/* Column 1: Schedule Date, Schedule Time, Guidance Information */}
                              <div className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                  Guidance &amp; Schedule Details
                                </span>
                                <div className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                                  <UserIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                  <span>
                                    Guidance Name:{' '}
                                    <strong className="text-slate-900 dark:text-white">
                                      {rec.guidanceAdvocateName || rec.nameOfReferrer || 'Maria Mel B. Glemao'}
                                    </strong>{' '}
                                    ({rec.guidanceAdvocatePosition || 'Guidance Advocate'})
                                  </span>
                                </div>
                                {(() => {
                                  const { scheduleDate, scheduleTime } = getScheduleDateAndTime12h(rec);
                                  return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                                      <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                          Schedule Date
                                        </span>
                                        <strong className="font-mono text-blue-700 dark:text-blue-300">
                                          {scheduleDate}
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                          Schedule Time
                                        </span>
                                        <strong className="font-mono text-blue-700 dark:text-blue-300">
                                          {scheduleTime}
                                        </strong>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Column 2: Intervention Type / Reason for Intervention */}
                              <div className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                  Intervention Type
                                </span>
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {interventionTypeList.map((reason) => (
                                    <span
                                      key={reason}
                                      className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg text-[11px] font-bold border border-blue-200/60 dark:border-blue-800/40"
                                    >
                                      {reason === 'Others' && rec.reasonsOther ? `Other: ${rec.reasonsOther}` : reason}
                                    </span>
                                  ))}
                                  {interventionTypeList.length === 0 && (
                                    <span className="text-[11px] text-slate-400 italic">None specified</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Problem / Concern to Address */}
                            <div className="text-xs bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                Problem / Concern to Address
                              </span>
                              <p className="text-slate-700 dark:text-slate-200 font-medium">
                                {rec.problemConcernToAddress || rec.descriptionOfConcerns}
                              </p>
                            </div>

                            {/* Action Taken */}
                            {(() => {
                              const savedActionText =
                                rec.guidanceActionTaken ||
                                (rec.resolutionActionSteps && rec.resolutionActionSteps.length > 0
                                  ? rec.resolutionActionSteps
                                      .map((s) => s.actionTaken)
                                      .filter(Boolean)
                                      .join('\n')
                                  : '') ||
                                '';
                              if (!savedActionText) return null;
                              return (
                                <div className="text-xs bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                    Action Taken
                                  </span>
                                  <p className="text-slate-700 dark:text-slate-200 font-medium whitespace-pre-line leading-relaxed">
                                    {savedActionText}
                                  </p>
                                </div>
                              );
                            })()}

                            {/* Referral to OSAS Office Details (if referred to OSAS) */}
                            {(rec.referredToOsas || rec.osasReferralReason || rec.osasReferralDescription) && (
                              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 text-xs space-y-1">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider">
                                    Referral to OSAS Office Information
                                  </span>
                                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                                    Referred on {rec.osasReferralDate || rec.dateOfReferral} by {rec.osasReferralBy || rec.guidanceAdvocateName || 'Guidance Advocate'}
                                  </span>
                                </div>
                                {rec.osasReferralReason && (
                                  <p className="text-slate-800 dark:text-slate-200">
                                    <strong>Reason for Intervention:</strong> {rec.osasReferralReason}
                                  </p>
                                )}
                                {rec.osasReferralDescription && (
                                  <p className="text-slate-700 dark:text-slate-300">
                                    <strong>Description:</strong> {rec.osasReferralDescription}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Saved OSAS Remarks (visible to both OSAS and Guidance) */}
                            {rec.osasRemarks && (
                              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 tracking-wider flex items-center gap-1">
                                    <MessageSquare className="w-3.5 h-3.5" /> OSAS Remarks
                                  </span>
                                  {rec.osasSessionDate && (
                                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                                      Session Date: {rec.osasSessionDate} • {rec.osasRemarksBy || 'OSAS Administrator'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-800 dark:text-slate-100 font-semibold whitespace-pre-line">
                                  {rec.osasRemarks}
                                </p>
                              </div>
                            )}

                            {/* Logged-on-by small text line placed below Refer to OSAS Office / Remarks and above the action buttons */}
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                              Logged on: {new Date(rec.createdAt).toLocaleDateString()} by {rec.createdBy}
                            </p>

                            {/* Action Buttons: clean row/area at the bottom, responsive on desktop and mobile, no horizontal scrolling */}
                            <div
                              className={`w-full pt-2 border-t border-slate-200/70 dark:border-slate-800 ${
                                isGuidance
                                  ? 'flex flex-wrap items-center justify-end gap-2'
                                  : 'grid grid-cols-1 sm:grid-cols-3 gap-2'
                              }`}
                            >
                              {isGuidance ? (
                                <>
                                  {/* Keep Create Resolution only, positioned at the lower-right */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCreateResolutionForRecord(rec)}
                                    className="w-full sm:w-auto min-h-[36px] px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-center"
                                  >
                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                    <span>Create Resolution</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  {/* OSAS Actions on Referred Intervention Records: Equal in size/width */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRecord(rec)}
                                    className="w-full min-h-[38px] px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs text-center"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                    <span>View Details</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenOsasFormForRecord(rec)}
                                    className="w-full min-h-[38px] px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-center"
                                  >
                                    <Plus className="w-3.5 h-3.5 shrink-0" />
                                    <span>Create Intervention</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenOsasSessionModal(rec)}
                                    className="w-full min-h-[38px] px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-200 dark:border-indigo-800 shadow-2xs text-center"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>OSAS Remarks</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: RESOLUTIONS (BLUE PALETTE)                       */}
        {/* ======================================================== */}
        {/* ======================================================== */}
        {/* TAB 4: RESOLUTIONS (BLUE PALETTE)                       */}
        {/* ======================================================== */}
        {activeTab === 'resolutions' && isGuidance && (
          /* GUIDANCE ADVOCATE: Clean Intervention Records layout with search bar and records list only */
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            {/* Search Bar matching Intervention Records layout */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-sm md:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search resolution records..."
                  value={resolutionSearchQuery}
                  onChange={(e) => setResolutionSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {resolutionSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setResolutionSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                Showing {filteredResolutionRecords.length} resolutions
              </div>
            </div>

            {/* Records List Display */}
            {filteredResolutionRecords.length === 0 ? (
              <div className="py-14 text-center space-y-3">
                <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {resolutionSearchQuery.trim() ? 'No Matching Resolution Records' : 'No Saved Resolutions Yet'}
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {resolutionSearchQuery.trim()
                    ? 'No records match your search query.'
                    : 'Resolutions created from student concerns will appear here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredResolutionRecords.map((rep) => {
                  const isResolutionExpanded = Boolean(expandedResolutionIds[rep.id]);
                  const savedActionText =
                    rep.guidanceActionTaken ||
                    rep.actionTakenSummary ||
                    (rep.resolutionActionSteps && rep.resolutionActionSteps.length > 0
                      ? rep.resolutionActionSteps
                          .map((s) => s.actionTaken)
                          .filter(Boolean)
                          .join('\n')
                      : '') ||
                    '';
                  const actionLineCount = savedActionText
                    ? savedActionText.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / 80)), 0)
                    : 2;

                  return (
                    <div
                      key={rep.id}
                      className="p-5 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl transition-all shadow-2xs hover:shadow-md space-y-4"
                    >
                      {/* Top Row: Student info & Toggle (No status badges, filters, or extra sections) */}
                      <div
                        onClick={() => toggleResolutionExpanded(rep.id)}
                        className={`flex items-start justify-between gap-3 cursor-pointer select-none ${
                          isResolutionExpanded ? 'pb-3 border-b border-slate-200/60 dark:border-slate-700/60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <span className="px-2.5 py-1 text-[10px] font-mono font-black rounded-lg bg-blue-600 text-white">
                            Resolution #{rep.id}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {rep.studentName}
                            {rep.studentId ? ` (${rep.studentId})` : ''}
                          </span>
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
                          className="shrink-0 self-start ml-auto px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
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
                        <div className="space-y-4">
                          {/* Student Info & Incident Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                                Student Name
                              </span>
                              <p className="font-black text-slate-900 dark:text-white mt-0.5">
                                {rep.studentName}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {rep.studentId || 'No ID'}
                              </p>
                            </div>

                            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                                Course &amp; Year
                              </span>
                              <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                                {[rep.course, rep.yearLevel].filter(Boolean).join(' - ') || 'N/A'}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Contact: {rep.contactNumber || 'N/A'}
                              </p>
                            </div>

                            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                                Date
                              </span>
                              <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{rep.dateOfReferral || new Date(rep.createdAt).toLocaleDateString()}</span>
                              </p>
                            </div>
                          </div>

                          {/* Problem Resolved Box */}
                          {(rep.problemResolved || rep.problemConcernToAddress) && (
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                                Problem Resolved / Concern Addressed
                              </span>
                              <p className="font-bold text-slate-900 dark:text-white leading-relaxed">
                                {rep.problemResolved || rep.problemConcernToAddress}
                              </p>
                            </div>
                          )}

                          {/* Actions Taken by Guidance Advocate */}
                          {savedActionText && (
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                                Actions Taken by Guidance Advocate
                              </span>
                              <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                                {savedActionText}
                              </p>
                            </div>
                          )}

                          {/* NOTE: OSAS Administrator Remarks and Guidance Administrator Remarks removed completely */}

                          {/* Resolution Details */}
                          {rep.resolutionDetails && (
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block">
                                Resolution Details &amp; Narrative
                              </span>
                              <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                                {rep.resolutionDetails}
                              </p>
                            </div>
                          )}

                          {/* Print & Archive Buttons at bottom */}
                          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => handleDirectPrintResolution(rep)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print Resolution</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setArchiveConfirmRecord(rep)}
                              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>Archive Now</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'resolutions' && !isGuidance && (
          /* OSAS ADMINISTRATOR: Exact UI reference matching OSAS -> Referred Student Reports -> Guidance Resolution (view-only, no tabs, no Administrator Remarks) */
          <div className="space-y-6">
            {/* Top Banner Card (No tabs) */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 text-slate-900 dark:text-white shadow-xs relative border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Intervention Resolution
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                    Official Guidance and Counseling Intervention Resolutions and Documented Intervention Outcomes.
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content Card: Search bar above records, clean record containers, simple divider lines */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-6">
              {/* Search Bar above the records */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="relative flex-1 w-full sm:max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={resolutionSearchQuery}
                    onChange={(e) => setResolutionSearchQuery(e.target.value)}
                    placeholder="Search resolution records..."
                    className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {resolutionSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setResolutionSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Showing {filteredResolutionRecords.length} intervention resolutions
                </div>
              </div>

              {filteredResolutionRecords.length === 0 ? (
                <div className="py-14 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {resolutionSearchQuery.trim() ? 'No matching resolution records.' : 'No saved Guidance resolutions yet.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {resolutionSearchQuery.trim()
                      ? 'No resolution records match your search query.'
                      : 'When Guidance saves a case resolution, the official resolution will automatically appear here.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredResolutionRecords.map((rep) => {
                    const isResolutionExpanded = Boolean(expandedResolutionIds[rep.id]);
                    const savedActionText =
                      rep.guidanceActionTaken ||
                      rep.actionTakenSummary ||
                      (rep.resolutionActionSteps && rep.resolutionActionSteps.length > 0
                        ? rep.resolutionActionSteps
                            .map((s) => s.actionTaken)
                            .filter(Boolean)
                            .join('\n')
                        : '') ||
                      '';
                    const actionLineCount = savedActionText
                      ? savedActionText.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / 80)), 0)
                      : 2;

                    return (
                      <div key={rep.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="p-5 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex flex-col justify-between gap-4 hover:border-blue-400 dark:hover:border-blue-700 transition-all shadow-2xs">
                          <div className="space-y-4">
                            {/* Header Row matching OSAS -> Referred Student Reports -> Guidance Resolution */}
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
                                  {rep.studentName}
                                  {rep.studentId ? ` (${rep.studentId})` : ''}
                                </span>
                                <span className="px-2.5 py-1 text-[10px] font-black rounded-lg uppercase border bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">
                                  Case Resolved
                                </span>
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
                              <>
                                {/* Student Info & Incident Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                  <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-950 shadow-2xs">
                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase block">
                                      Student Name
                                    </span>
                                    <p className="font-black text-slate-900 dark:text-white mt-0.5">
                                      {rep.studentName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 font-mono">
                                      {rep.studentId || 'No ID'}
                                    </p>
                                  </div>

                                  <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-950 shadow-2xs">
                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase block">
                                      Course &amp; Year
                                    </span>
                                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                                      {[rep.course, rep.yearLevel].filter(Boolean).join(' - ') || 'N/A'}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      Contact: {rep.contactNumber || 'N/A'}
                                    </p>
                                  </div>

                                  <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-950 shadow-2xs">
                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase block">
                                      Date
                                    </span>
                                    <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span>{rep.dateOfReferral || new Date(rep.createdAt).toLocaleDateString()}</span>
                                    </p>
                                  </div>
                                </div>

                                {/* Problem Resolved Box */}
                                {(rep.problemResolved || rep.problemConcernToAddress) && (
                                  <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                      Problem Resolved / Concern Addressed
                                    </span>
                                    <p className="font-bold text-slate-900 dark:text-white leading-relaxed">
                                      {rep.problemResolved || rep.problemConcernToAddress}
                                    </p>
                                  </div>
                                )}

                                {/* Actions Taken by Guidance Advocate */}
                                {savedActionText && (
                                  <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                      Actions Taken by Guidance Advocate
                                    </span>
                                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                                      {savedActionText}
                                    </p>
                                  </div>
                                )}

                                {/* Resolution Details */}
                                {rep.resolutionDetails && (
                                  <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
                                      Resolution Details &amp; Narrative
                                    </span>
                                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                                      {rep.resolutionDetails}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STUDENT GRIEVANCES DETAILED MODAL                        */}
        {/* ======================================================== */}
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

              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                      Student Profile
                    </span>
                    <p className="font-black text-slate-900 dark:text-white text-sm">
                      {selectedApp.studentName}{' '}
                      <span className="text-slate-500 font-mono text-xs font-normal">({selectedApp.studentId})</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{selectedApp.studentEmail}</p>
                  </div>
                  <span className={`px-3 py-1 text-[11px] font-black rounded-full border ${
                    selectedApp.status === 'COMPLETED'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                      : selectedApp.status === 'REJECTED'
                      ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300'
                      : selectedApp.status === 'APPROVED'
                      ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300'
                      : selectedApp.status === 'RESCHEDULED'
                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300'
                      : selectedApp.status === 'REFERRED' || selectedApp.status === 'REFERRED_TO_GUIDANCE' || selectedApp.referredToGuidance || selectedApp.referredFromOsas
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
                  }`}>
                    Status: {selectedApp.status === 'REFERRED' || selectedApp.status === 'REFERRED_TO_GUIDANCE' ? 'Referred' : selectedApp.status}
                  </span>
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                    Concern / Purpose of Counseling
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 leading-relaxed">
                    {selectedApp.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40">
                    <span className="font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider block text-[10px]">
                      Student Preferred Schedule
                    </span>
                    <p className="font-mono text-blue-700 dark:text-blue-300 font-bold mt-0.5">
                      {selectedApp.preferredDate} @ {selectedApp.preferredTime}
                    </p>
                  </div>

                  {selectedApp.adminPreferredDate && (
                    <div className="p-2.5 bg-purple-50/60 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/40">
                      <span className="font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider block text-[10px]">
                        Admin Rescheduled Schedule
                      </span>
                      <p className="font-mono text-purple-700 dark:text-purple-300 font-bold mt-0.5">
                        {selectedApp.adminPreferredDate} @ {selectedApp.adminPreferredTime}
                      </p>
                    </div>
                  )}
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
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium pt-0.5">
                    ℹ️ Ang appointment na ito ay nasa ilalim na ng Guidance Admin para sa kanilang counseling review at aksyon (Approve / Reject).
                  </p>
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

              {/* Reschedule Notes if present */}
              {(selectedApp.rescheduleReason || selectedApp.adminNotes) && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-1">
                  <span className="font-black text-purple-900 dark:text-purple-300 block text-[11px]">
                    Reschedule Reason &amp; Admin Notes:
                  </span>
                  <p className="text-purple-800 dark:text-purple-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900 text-xs">
                    {selectedApp.rescheduleReason || selectedApp.adminNotes}
                  </p>
                </div>
              )}

              {/* Reschedule Section (Only if not COMPLETED & not REJECTED) */}
              {selectedApp.status !== 'COMPLETED' && selectedApp.status !== 'REJECTED' && (() => {
                const isReferredToGuidance = selectedApp.status === 'REFERRED' || selectedApp.status === 'REFERRED_TO_GUIDANCE' || !!selectedApp.referredToGuidance || !!selectedApp.referredFromOsas;
                const isAlreadyRescheduled =
                  selectedApp.status === 'RESCHEDULED' ||
                  Boolean(selectedApp.adminPreferredDate) ||
                  Boolean(selectedApp.rescheduledByName);
                const isRescheduleDisabled = (!isGuidance && isReferredToGuidance) || isAlreadyRescheduled;

                return (
                  <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-900 dark:text-purple-300 block flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        Reschedule Appointment (Set Date &amp; Time)
                      </span>
                    </div>

                    {!isGuidance && isReferredToGuidance && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Appointment referred to Guidance Counselor. Only the Guidance Admin is authorized to reschedule this appointment.</span>
                      </div>
                    )}

                    {rescheduleError && (
                      <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-[11px] font-bold">
                        {rescheduleError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-purple-800 dark:text-purple-300">Set Date</label>
                        <input
                          type="date"
                          disabled={isRescheduleDisabled}
                          value={rescheduleDate}
                          onChange={(e) => {
                            setRescheduleDate(e.target.value);
                            setRescheduleError('');
                          }}
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
                          onChange={(e) => {
                            setRescheduleTime(formatTime12h(e.target.value));
                            setRescheduleError('');
                          }}
                          className={`w-full px-3 py-2 text-xs border border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono ${
                            isRescheduleDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-purple-800 dark:text-purple-300">
                        Reason for Reschedule *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isRescheduleDisabled}
                        value={adminNotes}
                        onChange={(e) => {
                          setAdminNotes(e.target.value);
                          setRescheduleError('');
                        }}
                        placeholder={
                          !isGuidance && isReferredToGuidance
                            ? 'Rescheduling locked: Handled exclusively by Guidance Admin'
                            : 'Required reason for reschedule...'
                        }
                        className={`w-full px-3 py-1.5 text-xs border border-purple-300 dark:border-purple-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                          isRescheduleDisabled ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  </div>
                );
              })()}

              {selectedApp.status === 'COMPLETED' && (
                <div className="space-y-2">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Appointment Fully Completed &amp; Verified
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
                      onClick={() => {
                        setArchiveAppReason('');
                        setArchiveAppError('');
                        setConfirmArchiveApp(selectedApp);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0 w-fit"
                    >
                      <Archive className="w-3.5 h-3.5" /> Move to Vault Now
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons Footer based on Status Rules */}
              {(() => {
                const isAlreadyRescheduled =
                  selectedApp.status === 'RESCHEDULED' ||
                  Boolean(selectedApp.adminPreferredDate) ||
                  Boolean(selectedApp.rescheduledByName);
                return (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      {isAlreadyRescheduled && selectedApp.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setArchiveAppReason('');
                            setArchiveAppError('');
                            setConfirmArchiveApp(selectedApp);
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Archive className="w-4 h-4" />
                          Archive
                        </button>
                      )}
                    </div>

                    {selectedApp.status === 'COMPLETED' ? null : !isGuidance && (selectedApp.status === 'REFERRED' || selectedApp.status === 'REFERRED_TO_GUIDANCE' || selectedApp.referredToGuidance || selectedApp.referredFromOsas) ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          disabled={true}
                          className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-slate-300 dark:bg-slate-700 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 opacity-60"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reschedule (Disabled)
                        </button>
                        <button
                          type="button"
                          disabled={true}
                          className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-slate-300 dark:bg-slate-700 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 opacity-60"
                        >
                          <Check className="w-4 h-4" />
                          Approve (Disabled)
                        </button>
                      </div>
                    ) : selectedApp.status === 'APPROVED' || selectedApp.status === 'RESCHEDULED' || isAlreadyRescheduled ? (
                      /* Approved or Rescheduled concerns: Replace Approve with Create Intervention. Do not require another approval. */
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          disabled={isAlreadyRescheduled}
                          onClick={() => handleRescheduleSubmit(selectedApp.id)}
                          className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreateInterventionFromConcern(selectedApp)}
                          className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Create Intervention
                        </button>
                      </div>
                    ) : (
                      /* Pending / Rescheduled concerns: Buttons: Reschedule and Approve only */
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          disabled={isAlreadyRescheduled}
                          onClick={() => handleRescheduleSubmit(selectedApp.id)}
                          className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveAppointment(selectedApp.id)}
                          className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* INTERVENTION DETAILED VIEW MODAL                         */}
        {/* ======================================================== */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Intervention Case Details
                    </h3>
                    <p className="text-[11px] text-slate-500">Record ID: {selectedRecord.id}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5 text-xs max-h-[70vh] overflow-y-auto">
                {/* 1. Student Information (6 Fields) */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      1. Student Information
                    </span>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedRecord.status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Student ID</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{selectedRecord.studentId}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Full Name</span>
                      <strong className="text-slate-900 dark:text-white">{selectedRecord.studentName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Academic Program</span>
                      <strong className="text-slate-900 dark:text-white">{selectedRecord.course}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Year Level</span>
                      <strong className="text-slate-900 dark:text-white">{selectedRecord.yearLevel}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Contact Number</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{selectedRecord.contactNumber}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Address/Permanent Address</span>
                      <strong className="text-slate-900 dark:text-white">{selectedRecord.address}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Problem / Concern to Address */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    2. Problem / Concern to Address
                  </span>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap leading-relaxed">
                    {selectedRecord.problemConcernToAddress || selectedRecord.descriptionOfConcerns}
                  </div>
                </div>

                {/* 3 & 4. Counseling Approval & Schedule Date & Time (Side-by-Side) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                      3. Counseling Approval
                    </span>
                    <p className="text-slate-900 dark:text-white font-black">
                      {selectedRecord.counselingApprovalStatus || 'Approved'}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                      4. Schedule Date &amp; Time
                    </span>
                    <p className="text-blue-700 dark:text-blue-300 font-mono font-bold">
                      {selectedRecord.counselingScheduledDateTime || selectedRecord.dateOfReferral}
                    </p>
                  </div>
                </div>

                {/* 5. Intervention Type */}
                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-2">
                  <span className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300 tracking-wider block">
                    5. Intervention Type
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(selectedRecord.interventionTypes && selectedRecord.interventionTypes.length > 0
                      ? selectedRecord.interventionTypes
                      : selectedRecord.reasons || []
                    ).map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 font-bold text-blue-950 dark:text-blue-200"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{r === 'Others' && selectedRecord.reasonsOther ? `Other: ${selectedRecord.reasonsOther}` : r}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* 6. Guidance Information */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    6. Guidance Information
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Guidance Name</span>
                      <strong className="text-slate-900 dark:text-white">
                        {selectedRecord.guidanceAdvocateName || selectedRecord.nameOfReferrer || 'Maria Mel B. Glemao'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Position</span>
                      <strong className="text-slate-900 dark:text-white">
                        {selectedRecord.guidanceAdvocatePosition || 'Guidance Advocate'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Referral to OSAS Office Information (when referred) */}
                {(selectedRecord.referredToOsas || selectedRecord.osasReferralReason || selectedRecord.osasReferralDescription) && (
                  <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                    <span className="text-[10px] font-black uppercase text-indigo-800 dark:text-indigo-300 tracking-wider block">
                      Referral to OSAS Office Information
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Date of Referral</span>
                        <strong className="text-slate-900 dark:text-white">
                          {selectedRecord.osasReferralDate || selectedRecord.dateOfReferral}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Referred By</span>
                        <strong className="text-slate-900 dark:text-white">
                          {selectedRecord.osasReferralBy || selectedRecord.guidanceAdvocateName || 'Guidance Advocate'}
                        </strong>
                      </div>
                    </div>
                    {selectedRecord.osasReferralReason && (
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Reason for Intervention</span>
                        <p className="text-slate-900 dark:text-white font-semibold mt-0.5">
                          {selectedRecord.osasReferralReason}
                        </p>
                      </div>
                    )}
                    {selectedRecord.osasReferralDescription && (
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Description</span>
                        <p className="text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">
                          {selectedRecord.osasReferralDescription}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* OSAS Session & Remarks (when recorded by OSAS) */}
                {selectedRecord.osasRemarks && (
                  <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300 tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                        OSAS Remarks
                      </span>
                      {selectedRecord.osasSessionDate && (
                        <span className="text-[10px] font-mono text-blue-700 dark:text-blue-300 font-bold">
                          Session Date: {selectedRecord.osasSessionDate} • {selectedRecord.osasRemarksBy || 'OSAS Administrator'}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-900 dark:text-white font-semibold whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-100 dark:border-blue-900">
                      {selectedRecord.osasRemarks}
                    </p>
                  </div>
                )}
              </div>

              {/* View Details Actions: Archive */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const rec = selectedRecord;
                    setSelectedRecord(null);
                    setArchiveConfirmRecord(rec);
                  }}
                  className="px-4 py-2.5 min-h-[42px] bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border border-red-200 dark:border-red-800 transition-colors"
                >
                  <Archive className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Archive</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* REFER TO GUIDANCE 9-POINT FORM POPUP MODAL               */}
        {/* ======================================================== */}
        {referToGuidanceRecord && (
          <Modal
            isOpen={true}
            onClose={() => setReferToGuidanceRecord(null)}
            title="OSAS Student Intervention Referral to Guidance Office"
            subtitle={`Case: #${referToGuidanceRecord.id} • ${referToGuidanceRecord.studentName} (${referToGuidanceRecord.studentId})`}
            maxWidth="3xl"
          >
            <div className="space-y-4 p-1 text-xs">
              {popupError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{popupError}</span>
                </div>
              )}

              {/* 1. Student Information */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                      1
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Student Information
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Auto-filled from student record (Non-editable)
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold">
                    Non-editable
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Student ID</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.studentId}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono font-bold cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Student Full Name</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.studentName}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-bold cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Course / Academic Program</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.course}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Year Level</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.yearLevel}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Contact Number</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.contactNumber || 'On Record'}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-not-allowed select-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Complete Address</label>
                    <input
                      type="text"
                      readOnly
                      value={referToGuidanceRecord.address || 'Campus Residence / On Record'}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-not-allowed select-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Referral Information */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Referral Information
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Originator details, position, referral date, and concern summary
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Date of Referral (Automatic) *
                    </label>
                    <input
                      type="date"
                      readOnly
                      value={popupDateOfReferral}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-bold cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Referred by OSAS Personnel (Dropdown) *
                    </label>
                    <select
                      value={popupReferredByPersonnel}
                      onChange={(e) => setPopupReferredByPersonnel(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="Princess Ann T. Ruzol (OSAS Officer)">Princess Ann T. Ruzol (OSAS Officer)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Designation / Position (Dropdown) *
                    </label>
                    <select
                      value={popupReferredByDesignation}
                      onChange={(e) => setPopupReferredByDesignation(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="OSAS Administrator">OSAS Administrator</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Reason for Referral (Brief Description / Summary of Concerns) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={popupReasonForReferral}
                    onChange={(e) => setPopupReasonForReferral(e.target.value)}
                    placeholder="Provide brief description or summary of concerns..."
                    className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* 3. Reason for Intervention (Checklist) */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                      3
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Reason for Intervention (Check all that apply) *
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Check all categories triggering this referral
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {popupReasons.length} Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {POPUP_REASON_OPTIONS.map((item) => {
                    const isChecked = popupReasons.includes(item);
                    return (
                      <label
                        key={item}
                        className={`p-2 rounded-xl border text-xs flex items-center gap-2.5 cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-bold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePopupReason(item)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="capitalize">{item}</span>
                      </label>
                    );
                  })}
                </div>

                {popupReasons.includes('Others') && (
                  <div className="pt-1 space-y-1">
                    <label className="text-[11px] font-bold text-blue-900 dark:text-blue-200">
                      Specify Other Reason *
                    </label>
                    <input
                      type="text"
                      required
                      value={popupReasonsOther}
                      onChange={(e) => setPopupReasonsOther(e.target.value)}
                      placeholder="Specify other reason for intervention..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 4. Recommended Referral Designation */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    4
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Recommended Referral Designation *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Designated service unit
                    </p>
                  </div>
                </div>

                <select
                  value={popupRecommendedDesignation}
                  disabled
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold cursor-not-allowed select-none"
                >
                  <option value="Guidance and Counseling Services">Guidance and Counseling Services</option>
                </select>
              </div>

              {/* 5. Summary of Action Taken by OSAS */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    5
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Summary of Action Taken by OSAS *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      List any interventions, interviews, or observations completed
                    </p>
                  </div>
                </div>

                <textarea
                  rows={3}
                  required
                  value={popupActionTakenSummary}
                  onChange={(e) => setPopupActionTakenSummary(e.target.value)}
                  placeholder="List any interventions, interviews, or observations completed by OSAS..."
                  className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* 6. Urgency of Referral */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    6
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Urgency of Referral *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Intake urgency prioritization
                    </p>
                  </div>
                </div>

                <select
                  value={popupUrgencyOfReferral}
                  onChange={(e) => setPopupUrgencyOfReferral(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="Immediate (safety/high risk concern)">Immediate (safety/high risk concern)</option>
                  <option value="Within 3 days">Within 3 days</option>
                  <option value="Within 1 week">Within 1 week</option>
                  <option value="For monitoring/consultation">For monitoring/consultation</option>
                </select>
              </div>

              {/* 7. Attachments, if applicable */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    7
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Attachments, if applicable
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Supporting case documentation
                    </p>
                  </div>
                </div>

                <select
                  value={popupAttachmentsType}
                  onChange={(e) => setPopupAttachmentsType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="None / Not Applicable">None / Not Applicable</option>
                  <option value="Incident reports">Incident reports</option>
                  <option value="Medical report">Medical report</option>
                  <option value="Counseling notes">Counseling notes</option>
                  <option value="Academic records">Academic records</option>
                  <option value="Others">Others</option>
                </select>

                {popupAttachmentsType === 'Others' && (
                  <div className="pt-1 space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Specify Other Attachments *
                    </label>
                    <input
                      type="text"
                      required
                      value={popupAttachmentsOther}
                      onChange={(e) => setPopupAttachmentsOther(e.target.value)}
                      placeholder="Specify other document details..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 8. OSAS Authorization and Signature */}
              <div className="p-4 bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                    8
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      OSAS Authorization and Signature *
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Formal authorization by OSAS officer
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      OSAS Officer Approval Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={popupOsasApprovalName}
                      onChange={(e) => setPopupOsasApprovalName(e.target.value)}
                      placeholder="Princess Ann T. Ruzol"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Date of Approval (Automatic) *
                    </label>
                    <input
                      type="date"
                      readOnly
                      value={popupOsasApprovalDate}
                      className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-bold cursor-not-allowed select-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Approved by *
                    </label>
                    <select
                      value={popupApprovedBy}
                      onChange={(e) => setPopupApprovedBy(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="OSAS Administrator">OSAS Administrator</option>
                      <option value="Dean of Student Affairs">Dean of Student Affairs</option>
                      <option value="Head of Student Welfare">Head of Student Welfare</option>
                      <option value="Intervention Supervisor">Intervention Supervisor</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 9. Receive Unit Acknowledgement */}
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                    9
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                      Receive Unit Acknowledgement (Guidance Office)
                    </h4>
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-400">
                      Guidance receiving office endorsement acknowledgement
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300">
                      Received by Name
                    </label>
                    <input
                      type="text"
                      value={popupReceivedByName}
                      onChange={(e) => setPopupReceivedByName(e.target.value)}
                      placeholder="Guidance Counselor"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300">
                      Position
                    </label>
                    <input
                      type="text"
                      value={popupReceivedByPosition}
                      onChange={(e) => setPopupReceivedByPosition(e.target.value)}
                      placeholder="Registered Guidance Counselor (RGC)"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300">
                      Date of Receive (Automatic)
                    </label>
                    <input
                      type="date"
                      readOnly
                      value={popupReceivedDate}
                      className="w-full px-3 py-2 text-xs bg-indigo-100/70 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-slate-800 dark:text-slate-200 font-bold cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300">
                    Action Taken / Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={popupReceivedActionRemarks}
                    onChange={(e) => setPopupReceivedActionRemarks(e.target.value)}
                    placeholder="Initial action taken or receiving remarks..."
                    className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReferToGuidanceRecord(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReferral}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>Confirm &amp; Submit Referral to Guidance</span>
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* ======================================================== */}
        {/* UPDATE INTERVENTION STATUS MODAL                         */}
        {/* ======================================================== */}
        {editRecord && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  <span>{isGuidance ? 'Update Guidance Intervention Details' : 'Update Intervention Status'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300">
                Updating case status &amp; details for <strong>{editRecord.studentName}</strong> ({editRecord.studentId}).
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Case Status
                  </label>
                  <select
                    value={editRecord.status}
                    onChange={(e) =>
                      setEditRecord({ ...editRecord, status: e.target.value as InterventionStatus })
                    }
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                  >
                    <option value="REFERRED">REFERRED (Forwarded to Guidance Counselor)</option>
                    <option value="RECEIVED">RECEIVED (Intake Received by Guidance)</option>
                    <option value="ACTIVE">ACTIVE / IN PROGRESS (Ongoing counseling &amp; monitoring)</option>
                    <option value="FOLLOW_UP_REQUIRED">FOLLOW_UP_REQUIRED (Pending milestone check)</option>
                    <option value="RESOLVED">RESOLVED / COMPLETED (Intervention successfully closed)</option>
                  </select>
                </div>

                {isGuidance && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Counselor Assigned
                        </label>
                        <input
                          type="text"
                          value={editRecord.guidanceCounselorAssigned || currentUser?.fullName || 'Guidance Counselor'}
                          onChange={(e) =>
                            setEditRecord({ ...editRecord, guidanceCounselorAssigned: e.target.value })
                          }
                          className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Sessions Conducted
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editRecord.guidanceSessionCount ?? editRecord.guidanceSessionsCount ?? 0}
                          onChange={(e) => {
                            const count = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setEditRecord({
                              ...editRecord,
                              guidanceSessionCount: count,
                              guidanceSessionsCount: count,
                            });
                          }}
                          className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Guidance Intervention Action Taken / Program
                      </label>
                      <textarea
                        rows={2}
                        value={editRecord.guidanceActionTaken || ''}
                        onChange={(e) =>
                          setEditRecord({ ...editRecord, guidanceActionTaken: e.target.value })
                        }
                        placeholder="Describe counseling sessions, behavioral agreements, or rehabilitation actions..."
                        className="w-full p-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Guidance Outcome Summary
                      </label>
                      <textarea
                        rows={2}
                        value={editRecord.guidanceOutcomeSummary || ''}
                        onChange={(e) =>
                          setEditRecord({ ...editRecord, guidanceOutcomeSummary: e.target.value })
                        }
                        placeholder="Summarize the counseling progress or final outcome..."
                        className="w-full p-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Confidential Counseling Notes (Restricted to Guidance)
                      </label>
                      <textarea
                        rows={2}
                        value={editRecord.guidanceConfidentialNotes || editRecord.guidanceNotes || ''}
                        onChange={(e) =>
                          setEditRecord({
                            ...editRecord,
                            guidanceConfidentialNotes: e.target.value,
                            guidanceNotes: e.target.value,
                          })
                        }
                        placeholder="Enter confidential clinical or counseling notes..."
                        className="w-full p-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={editRecord.followUpDate || ''}
                    onChange={(e) => setEditRecord({ ...editRecord, followUpDate: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Follow-up Notes / Progress Updates
                  </label>
                  <textarea
                    rows={3}
                    value={editRecord.nextSteps}
                    onChange={(e) => setEditRecord({ ...editRecord, nextSteps: e.target.value })}
                    className="w-full p-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const adminName = currentUser?.fullName || (isGuidance ? 'Guidance Advocate' : 'OSAS Administrator');
                    updateInterventionRecord(
                      editRecord.id,
                      {
                        status: editRecord.status,
                        nextSteps: editRecord.nextSteps,
                        followUpDate: editRecord.followUpDate,
                        guidanceCounselorAssigned: editRecord.guidanceCounselorAssigned,
                        guidanceSessionCount: editRecord.guidanceSessionCount ?? editRecord.guidanceSessionsCount,
                        guidanceSessionsCount: editRecord.guidanceSessionCount ?? editRecord.guidanceSessionsCount,
                        guidanceActionTaken: editRecord.guidanceActionTaken,
                        guidanceFollowUpPlan: editRecord.nextSteps,
                        guidanceOutcomeSummary: editRecord.guidanceOutcomeSummary,
                        guidanceConfidentialNotes: editRecord.guidanceConfidentialNotes,
                        guidanceNotes: editRecord.guidanceConfidentialNotes || editRecord.guidanceNotes,
                      },
                      adminName
                    );
                    if (isGuidance) {
                      updateGuidanceInterventionStatus(editRecord.id, {
                        status: editRecord.status,
                        guidanceCounselorAssigned: editRecord.guidanceCounselorAssigned || adminName,
                        guidanceSessionCount: editRecord.guidanceSessionCount ?? editRecord.guidanceSessionsCount,
                        guidanceFollowUpPlan: editRecord.nextSteps,
                        guidanceOutcomeSummary: editRecord.guidanceOutcomeSummary,
                        guidanceConfidentialNotes: editRecord.guidanceConfidentialNotes || editRecord.guidanceNotes,
                        guidanceActionTaken: editRecord.guidanceActionTaken,
                        updatedBy: adminName,
                      });
                    }
                    setEditRecord(null);
                    loadData();
                  }}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CONFIRMATION MODALS (GRIEVANCES & INTERVENTIONS)         */}
        {/* ======================================================== */}
        {/* Confirm Refer Appointment to Guidance */}
        <ConfirmModal
          isOpen={!!confirmReferId}
          onClose={() => setConfirmReferId(null)}
          onConfirm={handleConfirmReferAppointment}
          title="Refer Appointment to Guidance"
          message={
            referTargetApp
              ? `Sigurado ka ba na gusto mong i-refer sa Guidance Admin ang appointment request ni "${referTargetApp.studentName}"? Ito ay mai-forward sa Guidance Admin → Referred Appointments para sa counseling review at evaluation.`
              : 'Sigurado ka ba na gusto mong i-refer ang appointment na ito sa Guidance Admin?'
          }
          confirmText="Oo, I-forward sa Guidance"
          cancelText="Kanselahin"
          type="info"
          icon="info"
        />

        {/* Confirm Reject Appointment */}
        <ConfirmModal
          isOpen={!!confirmRejectId}
          onClose={() => setConfirmRejectId(null)}
          onConfirm={handleConfirmRejectAppointment}
          title="Are you sure you want to reject this appointment?"
          message={
            rejectTargetApp
              ? `Sigurado ka ba na gusto mong i-reject ang appointment request na ito ni "${rejectTargetApp.studentName}"?`
              : 'Sigurado ka ba na gusto mong i-reject ang appointment request na ito?'
          }
          confirmText="Yes"
          cancelText="No"
          type="danger"
          icon="alert"
        />

        {/* Confirm Archive Appointment */}
        {confirmArchiveApp && (
          <Modal
            isOpen={true}
            onClose={() => {
              setConfirmArchiveApp(null);
              setArchiveAppReason('');
              setArchiveAppError('');
            }}
            title="Are you sure?"
            subtitle={`Archive student concern for ${confirmArchiveApp.studentName} (${confirmArchiveApp.studentId})`}
            maxWidth="md"
          >
            <form onSubmit={handleConfirmArchiveAppointment} className="space-y-4 p-1 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to archive the concern record for{' '}
                <strong>{confirmArchiveApp.studentName}</strong> ({confirmArchiveApp.studentId})? Please enter a reason for archiving below.
              </p>

              {archiveAppError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 font-bold">
                  {archiveAppError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Reason for Archive *
                </label>
                <textarea
                  rows={3}
                  required
                  value={archiveAppReason}
                  onChange={(e) => {
                    setArchiveAppReason(e.target.value);
                    setArchiveAppError('');
                  }}
                  placeholder="Enter reason for archiving this concern..."
                  className="w-full p-3 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmArchiveApp(null);
                    setArchiveAppReason('');
                    setArchiveAppError('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Confirm Archive
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Confirm Archive Intervention Record */}
        {archiveConfirmRecord && (
          <ConfirmModal
            isOpen={true}
            onClose={() => setArchiveConfirmRecord(null)}
            onConfirm={() => {
              handleArchive(archiveConfirmRecord);
              setArchiveConfirmRecord(null);
            }}
            title="Are you sure you want to archive this?"
            message={`Are you sure you want to archive the record for "${archiveConfirmRecord.studentName}" (${archiveConfirmRecord.studentId})? It will be moved to System Settings > System Archive Vault without permanently deleting it.`}
            confirmText="Yes"
            cancelText="No"
            type="danger"
            icon="trash"
          />
        )}
      </div>

      {/* ======================================================== */}
      {/* STRICT APPOINTMENT SCHEDULE CONFLICT MODAL               */}
      {/* ======================================================== */}
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

      {/* ======================================================== */}
      {/* OFFICIAL APPOINTMENT PRINT SLIP                          */}
      {/* ======================================================== */}
      {printApp && (
        <div className="direct-print-container">
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
        )}

      {/* ======================================================== */}
      {/* OFFICIAL INTERVENTION CASE PRINT SLIP                     */}
      {/* ======================================================== */}
      {printRecord && (
        <div className="direct-print-container">
          {/* Printable Document Body */}
          <div id="printable-intervention-slip" className="printable-document flex flex-col justify-between min-h-0 sm:min-h-[1020px] print:min-h-screen print:h-full bg-white text-slate-900 p-2 sm:p-4 rounded-xl border border-slate-200 print:border-none print:p-0">
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
                        Guidance and Counseling Center • Student Support Services
                      </p>
                    </div>
                  </div>
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest bg-slate-900 text-white py-1 px-4 rounded inline-block">
                    Student Intervention &amp; Case Referral Record
                  </h2>
                </div>

                {/* Case Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Case Number</span>
                    <span className="font-mono font-bold text-slate-900">#{printRecord.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Date of Referral</span>
                    <span className="font-semibold text-slate-800">{printRecord.dateOfReferral}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Case Status</span>
                    <span className="font-bold text-slate-800 uppercase">{printRecord.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year</span>
                    <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
                  </div>
                </div>

                {/* Section 1: Student & Intervention Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Student Information</p>
                    <p><strong>Student ID:</strong> {printRecord.studentId}</p>
                    <p><strong>Full Name:</strong> {printRecord.studentName}</p>
                    <p><strong>Academic Program:</strong> {printRecord.course}</p>
                    <p><strong>Year Level:</strong> {printRecord.yearLevel}</p>
                    <p><strong>Contact Number:</strong> {printRecord.contactNumber || '—'}</p>
                    <p><strong>Address:</strong> {printRecord.address || '—'}</p>
                  </div>

                  <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Intervention Details</p>
                    <p><strong>Counseling Approval:</strong> {printRecord.counselingApprovalStatus || printRecord.status}</p>
                    <p><strong>Schedule Date &amp; Time:</strong> {[printRecord.scheduledDate, printRecord.scheduledTime].filter(Boolean).join(' • ') || printRecord.dateOfReferral}</p>
                    <p><strong>Intervention Type:</strong> {(printRecord.interventionTypes && printRecord.interventionTypes.length > 0 ? printRecord.interventionTypes : printRecord.reasons || []).join(', ') || '—'}</p>
                    <p><strong>Guidance Information:</strong> {printRecord.guidanceAdvocateName || 'Maria Mel B. Glemao'} ({printRecord.guidanceAdvocatePosition || 'Guidance Advocate'})</p>
                  </div>
                </div>

                {/* Section 2: Problem / Concern to Address */}
                <div className="space-y-1 text-xs">
                  <p className="font-black text-[11px] uppercase tracking-wider text-slate-700">
                    Problem / Concern to Address:
                  </p>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {printRecord.problemConcernToAddress || printRecord.descriptionOfConcerns}
                  </p>
                </div>

                {/* Section 3: Referral to OSAS Information (when referred) */}
                {(printRecord.referredToOsas || printRecord.osasReferralReason || printRecord.osasReferralDescription) && (
                  <div className="space-y-1 text-xs">
                    <p className="font-black text-[11px] uppercase tracking-wider text-slate-700">
                      Referral to OSAS Office Information:
                    </p>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <p><strong>Date of Referral:</strong> {printRecord.osasReferralDate || printRecord.dateOfReferral}</p>
                      <p><strong>Referred By:</strong> {printRecord.osasReferralBy || printRecord.guidanceAdvocateName || 'Guidance Advocate'}</p>
                      <p><strong>Reason for Intervention:</strong> {printRecord.osasReferralReason || (printRecord.interventionTypes || printRecord.reasons || []).join(', ') || '—'}</p>
                      <p><strong>Description:</strong> {printRecord.osasReferralDescription || printRecord.problemConcernToAddress || printRecord.descriptionOfConcerns}</p>
                    </div>
                  </div>
                )}

                {/* Section 4: OSAS Remarks (when available) */}
                {(printRecord.osasRemarks || printRecord.osasSessionNotes || printRecord.notes) && (
                  <div className="space-y-1 text-xs">
                    <p className="font-black text-[11px] uppercase tracking-wider text-slate-700">
                      OSAS Administrator Remarks:
                    </p>
                    <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                      {printRecord.osasRemarks || printRecord.osasSessionNotes || printRecord.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Signatures Block in printable-footer-block */}
              <div className="printable-footer-block mt-auto shrink-0 pt-8 border-t border-slate-300">
                <div className="grid grid-cols-2 gap-8 text-center text-xs items-end max-w-md mx-auto">
                  <div>
                    <div className="border-b border-slate-900 pb-1 font-bold">
                      {printRecord.studentName}
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">Student Signature / Conforme</p>
                  </div>

                  <div>
                    <div className="border-b border-slate-900 pb-1 font-bold">
                      Princess Ann T. Ruzol
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">OSAS Administrator</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* ======================================================== */}
      {/* GUIDANCE CASE RESOLUTION MODAL                           */}
      {/* ======================================================== */}
      {resolutionTargetRecord && (
        <Modal
          isOpen={true}
          onClose={() => setResolutionTargetRecord(null)}
          title={`Create Resolution — Record #${resolutionTargetRecord.id}`}
          subtitle="Official Guidance & Counseling Case Resolution"
          maxWidth="lg"
        >
          <form onSubmit={handleSaveResolutionForRecord} className="space-y-4 p-1 text-xs">
            {resError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 font-bold">
                {resError}
              </div>
            )}

            {/* 1. Student Information at top */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                    Student Information
                  </span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md">
                  Record #{resolutionTargetRecord.id}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    Student Name
                  </span>
                  <p className="font-black text-slate-900 dark:text-white mt-0.5">
                    {resolutionTargetRecord.studentName}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    Student ID
                  </span>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {resolutionTargetRecord.studentId || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    Course &amp; Level
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {[resolutionTargetRecord.course, resolutionTargetRecord.yearLevel]
                      .filter(Boolean)
                      .join(' - ') || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="pt-2.5 text-xs border-t border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Contact Number</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{resolutionTargetRecord.contactNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Date of Referral</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{resolutionTargetRecord.dateOfReferral || 'N/A'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Address</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 break-words leading-relaxed">{resolutionTargetRecord.address || 'N/A'}</p>
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

            {/* 3. Action Taken — single text field */}
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
                value={resActionTakenText}
                onChange={(e) => setResActionTakenText(e.target.value)}
                placeholder="Enter action taken step-by-step..."
                className="w-full p-3.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* 4. Resolution Outcome */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1.5">
                Resolution Outcome *
              </label>
              <div>
                <button
                  type="button"
                  onClick={() => setResOutcome('RESOLVED')}
                  className="w-full p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all bg-blue-600 text-white border-blue-600 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Case Resolved</span>
                </button>
              </div>
            </div>

            {/* OSAS Administrator Remarks — in a separate section below Resolution Outcome and above Resolution Details (shown only when available) */}
            {(resolutionTargetRecord.osasRemarks || resolutionTargetRecord.osasSessionNotes || resolutionTargetRecord.notes) && (
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-1.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-black uppercase text-blue-950 dark:text-blue-200">
                    OSAS Administrator Remarks
                  </span>
                </div>
                <p className="text-xs text-blue-900 dark:text-blue-100 whitespace-pre-line leading-relaxed font-medium pl-6">
                  {resolutionTargetRecord.osasRemarks || resolutionTargetRecord.osasSessionNotes || resolutionTargetRecord.notes}
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
                value={resDetails}
                onChange={(e) => setResDetails(e.target.value)}
                placeholder="Enter detailed resolution narrative, conditions, agreements, follow-up schedule, and closing remarks..."
                className="w-full p-3.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setResolutionTargetRecord(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Resolution</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* PRINTABLE CASE RESOLUTION RECORD SLIP                     */}
      {/* ======================================================== */}
      {printResolutionRecord && (
        <div className="direct-print-container">
          {/* Printable Document Body */}
          <div id="printable-resolution-slip" className="printable-document flex flex-col justify-between min-h-0 sm:min-h-[1020px] print:min-h-screen print:h-full bg-white text-slate-900 p-2 sm:p-4 rounded-xl border border-slate-200 print:border-none print:p-0">
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
                        Guidance and Counseling Center • Student Support Services
                      </p>
                    </div>
                  </div>
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest bg-blue-900 text-white py-1 px-4 rounded inline-block">
                    Official Guidance Case Resolution Record
                  </h2>
                </div>

                {/* Case Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Record ID</span>
                    <span className="font-mono font-bold text-slate-900">#{printResolutionRecord.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Date of Referral</span>
                    <span className="font-semibold text-slate-800">{printResolutionRecord.dateOfReferral || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Resolution Outcome</span>
                    <span className="font-bold text-slate-900 uppercase">
                      {printResolutionRecord.resolutionOutcome === 'UNRESOLVED'
                        ? 'Unresolved'
                        : 'Case Resolved'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year</span>
                    <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
                  </div>
                </div>

                {/* Section 1: Student Information */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    1. Student Client Profile
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Full Name</span>
                      <span className="font-bold text-slate-900">{printResolutionRecord.studentName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Student ID Number</span>
                      <span className="font-mono font-bold text-slate-900">{printResolutionRecord.studentId || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Academic Program &amp; Year</span>
                      <span className="font-medium text-slate-800">
                        {[printResolutionRecord.course, printResolutionRecord.yearLevel].filter(Boolean).join(' - ') || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Contact Number</span>
                      <span className="font-mono text-slate-800">{printResolutionRecord.contactNumber || '—'}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Permanent Address</span>
                      <span className="text-slate-800">{printResolutionRecord.address || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Problem Resolved / Concern */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    2. Problem Resolved / Actual Concern Addressed
                  </h4>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-200">
                    {printResolutionRecord.problemResolved ||
                      printResolutionRecord.problemConcernToAddress ||
                      printResolutionRecord.descriptionOfConcerns ||
                      'Concern processed and resolved through Guidance intervention procedures.'}
                  </p>
                </div>

                {/* Section 3: Action Taken */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    3. Action Taken
                  </h4>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-200">
                    {printResolutionRecord.guidanceActionTaken ||
                      printResolutionRecord.actionTakenSummary ||
                      (printResolutionRecord.resolutionActionSteps &&
                      printResolutionRecord.resolutionActionSteps.length > 0
                        ? printResolutionRecord.resolutionActionSteps
                            .map((st) => st.actionTaken)
                            .filter(Boolean)
                            .join('\n')
                        : '') ||
                      'Standard Guidance and Counseling intervention protocols executed.'}
                  </p>
                </div>

                {/* Section 4: OSAS Administrator Remarks (Separate section below Action Taken & above Resolution Details) */}
                {(printResolutionRecord.osasRemarks || printResolutionRecord.osasSessionNotes || printResolutionRecord.notes) && (
                  <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-1.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 border-b border-blue-200 pb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                      4. OSAS Administrator Remarks
                    </h4>
                    <p className="text-xs text-blue-950 whitespace-pre-wrap leading-relaxed p-2 bg-white rounded border border-blue-100">
                      {printResolutionRecord.osasRemarks || printResolutionRecord.osasSessionNotes || printResolutionRecord.notes}
                    </p>
                  </div>
                )}

                {/* Section 5: Resolution Details Narrative */}
                <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    {printResolutionRecord.osasRemarks || printResolutionRecord.osasSessionNotes || printResolutionRecord.notes ? '5. Resolution Details & Summary Agreement' : '4. Resolution Details & Summary Agreement'}
                  </h4>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-200">
                    {printResolutionRecord.resolutionDetails ||
                      'Case completed and closed under Guidance & Counseling resolution protocol.'}
                  </p>
                </div>
              </div>

              {/* Signatures & Footer Block */}
              <div className="printable-footer-block mt-auto shrink-0 pt-6 space-y-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <div className="grid grid-cols-3 gap-6 text-center text-xs items-end">
                  <div className="flex flex-col items-center justify-end text-center">
                    <div className="w-full border-b border-slate-800 pb-8 mb-1" />
                    <p className="font-bold text-slate-900 leading-tight">{printResolutionRecord.studentName}</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Student Conforme</p>
                  </div>
                  <div className="flex flex-col items-center justify-end text-center">
                    <div className="w-full border-b border-slate-800 pb-8 mb-1" />
                    <p className="font-bold text-slate-900 leading-tight">
                      {printResolutionRecord.guidanceAdvocateName || 'Maria Mel B. Glemao'}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {printResolutionRecord.guidanceAdvocatePosition || 'Guidance Advocate'}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-end text-center">
                    <div className="w-full border-b border-slate-800 pb-8 mb-1" />
                    <p className="font-bold text-slate-900 leading-tight">Princess Ann T. Ruzol</p>
                    <p className="text-[10px] text-slate-500 leading-tight">OSAS Administrator</p>
                  </div>
                </div>

                <div className="text-center pt-2 text-[10px] text-slate-400 font-mono border-t border-slate-200">
                  Dingalan Community College • OSAS Guidance &amp; Counseling Center • Official Case Resolution Record
                </div>
              </div>
            </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* REFER INTERVENTION TO OSAS OFFICE MODAL (GUIDANCE)       */}
      {/* ======================================================== */}
      {referToOsasRecord && (
        <Modal
          isOpen={true}
          onClose={() => setReferToOsasRecord(null)}
          title={`Refer to OSAS Office — Record #${referToOsasRecord.id}`}
          subtitle="Endorse Guidance Intervention Record to the Office of Student Affairs and Services"
          maxWidth="lg"
        >
          <form onSubmit={handleSubmitReferToOsas} className="space-y-4 p-1 text-xs">
            {referToOsasError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 font-bold">
                {referToOsasError}
              </div>
            )}

            {/* Actual Intervention Details */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                    Intervention Details
                  </span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md">
                  Record #{referToOsasRecord.id}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">1. Student ID</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {referToOsasRecord.studentId}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">2. Full Name</span>
                  <p className="font-black text-slate-900 dark:text-white mt-0.5">
                    {referToOsasRecord.studentName}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">3. Academic Program</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {referToOsasRecord.course || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">4. Year Level</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {referToOsasRecord.yearLevel || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">5. Contact Number</span>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {referToOsasRecord.contactNumber || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">6. Address/Permanent Address</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {referToOsasRecord.address || '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Counseling Approval</span>
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {referToOsasRecord.counselingApprovalStatus || referToOsasRecord.status}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Schedule Date &amp; Time</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {[referToOsasRecord.scheduledDate, referToOsasRecord.scheduledTime].filter(Boolean).join(' • ') || referToOsasRecord.dateOfReferral}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Intervention Type</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {(referToOsasRecord.interventionTypes && referToOsasRecord.interventionTypes.length > 0
                      ? referToOsasRecord.interventionTypes
                      : referToOsasRecord.reasons || []
                    ).join(', ') || '—'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Guidance Information</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {referToOsasRecord.guidanceAdvocateName || 'Maria Mel B. Glemao'} — {referToOsasRecord.guidanceAdvocatePosition || 'Guidance Advocate'}
                  </p>
                </div>
              </div>
            </div>

            {/* Referral Information */}
            <div className="p-4 bg-violet-50/70 dark:bg-violet-950/30 rounded-2xl border border-violet-200 dark:border-violet-800/70 space-y-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-black uppercase text-violet-950 dark:text-violet-200">
                  Referral Information
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Date of Referral *
                  </label>
                  <input
                    type="date"
                    required
                    value={referToOsasDate}
                    onChange={(e) => setReferToOsasDate(e.target.value)}
                    className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Referred By
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${referToOsasRecord.guidanceAdvocateName || 'Maria Mel B. Glemao'} (${referToOsasRecord.guidanceAdvocatePosition || 'Guidance Advocate'})`}
                    className="w-full p-2.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Reason for Intervention */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Intervention *
                </label>
                <input
                  type="text"
                  required
                  value={referToOsasReason}
                  onChange={(e) => setReferToOsasReason(e.target.value)}
                  placeholder="Enter reason for intervention referral..."
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={referToOsasDescription}
                  onChange={(e) => setReferToOsasDescription(e.target.value)}
                  placeholder="Describe the intervention details and reason for referring to OSAS Office..."
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReferToOsasRecord(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Referral to OSAS Office</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* OSAS INTERVENTION SESSION & REMARKS MODAL (OSAS ADMIN)   */}
      {/* ======================================================== */}
      {osasSessionRecord && (
        <Modal
          isOpen={true}
          onClose={() => setOsasSessionRecord(null)}
          title={`OSAS Intervention & Remarks — Record #${osasSessionRecord.id}`}
          subtitle={`${osasSessionRecord.studentName} (${osasSessionRecord.studentId})`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveOsasRemarks} className="space-y-4 p-1 text-xs">
            {osasSessionError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 font-bold">
                {osasSessionError}
              </div>
            )}

            {/* Complete Referred Intervention Details */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                    Referred Intervention Details
                  </span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md">
                  Record #{osasSessionRecord.id}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Student ID</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white">{osasSessionRecord.studentId}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Full Name</span>
                  <p className="font-black text-slate-900 dark:text-white">{osasSessionRecord.studentName}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Academic Program &amp; Year</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{osasSessionRecord.course} • {osasSessionRecord.yearLevel}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Reason for Intervention</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {osasSessionRecord.osasReferralReason || (osasSessionRecord.interventionTypes || osasSessionRecord.reasons || []).join(', ') || '—'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Description / Problem Addressed</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-line">
                    {osasSessionRecord.osasReferralDescription || osasSessionRecord.problemConcernToAddress || osasSessionRecord.descriptionOfConcerns}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Session Date &amp; Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={osasSessionDate}
                  onChange={(e) => setOsasSessionDate(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Conducted By *
                </label>
                <input
                  type="text"
                  required
                  value={osasSessionConductedBy}
                  onChange={(e) => setOsasSessionConductedBy(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                OSAS Remarks (What happened during the session) *
              </label>
              <textarea
                rows={4}
                required
                value={osasSessionRemarks}
                onChange={(e) => setOsasSessionRemarks(e.target.value)}
                placeholder="Describe what happened during the OSAS intervention session, agreements made, and findings for Guidance Resolution..."
                className="w-full p-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOsasSessionRecord(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save OSAS Remarks</span>
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default InterventionModule;
