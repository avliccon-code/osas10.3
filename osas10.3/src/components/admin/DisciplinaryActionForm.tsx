import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  addDisciplinaryRecord,
  createDisciplinaryRecordFromReport,
  createDisciplinaryRecordFromIntervention,
  getUsers,
  findUserAsync,
  getDisciplinaryReports,
  getSafetyReports,
} from '../../services/storage';
import { db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  DisciplinaryRecord,
  IncidentType,
  DisciplinaryReporterRole,
  DisciplinaryActionTaken,
  User,
} from '../../types';
import {
  AlertOctagon,
  FileText,
  MapPin,
  Calendar,
  Clock,
  Paperclip,
  Check,
  X,
  AlertCircle,
  Search,
  Send,
  ClipboardList,
  ShieldAlert,
} from 'lucide-react';

export const INCIDENT_CHECKLIST_OPTIONS = [
  'Academic Misconduct',
  'Behavioral Misconduct',
  'Bullying/Harassment',
  'Fighting /Physical Altercation',
  'Disrespect and Insubordination',
  'Attendance Violation',
  'Property Damage',
  'Others',
] as const;

export const CASE_CLASSIFICATION_OPTIONS = [
  'Minor Concerns',
  'Moderate Concerns',
  'Serious and Major Concerns',
] as const;

export interface DisciplinaryActionFormInitialData {
  reportedByRole?: DisciplinaryReporterRole;
  reporterName?: string;
  reporterId?: string;
  reporterCourse?: string;
  contactNumber?: string;
  reportedStudentContact?: string;
  reportedStudentName?: string;
  reportedStudentId?: string;
  reportedStudentCourse?: string;
  reportedStudentYearLevel?: string;
  reportedStudentAddress?: string;
  incidentType?: string;
  incidentTypes?: string[];
  incidentTypeOther?: string;
  location?: string;
  reportDate?: string;
  reportTime?: string;
  actionTaken?: string;
  actionTakenOther?: string;
  description?: string;
  guidanceAssessment?: string;
  caseClassification?: 'Minor Concerns' | 'Moderate Concerns' | 'Serious and Major Concerns' | string;
  sanction?: string;
  startDate?: string;
  endDate?: string;
  remarks?: string;
  evidenceFileName?: string;
  evidenceUrl?: string;
  declarationAccepted?: boolean;
}

export interface DisciplinaryActionFormProps {
  initialData?: DisciplinaryActionFormInitialData;
  sourceReportId?: string;
  sourceInterventionId?: string;
  formTitle?: string;
  formSubtitle?: string;
  isModal?: boolean;
  isWalkIn?: boolean;
  onSuccess?: (createdRecord: DisciplinaryRecord) => void;
  onCancel?: () => void;
}

function normalizeTimeForInput(rawTime?: string): string {
  if (!rawTime) return '';
  const trimmed = rawTime.trim();
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hh = match24[1].padStart(2, '0');
    const mm = match24[2];
    return `${hh}:${mm}`;
  }
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const min = match12[2];
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}`;
  }
  return trimmed;
}

export const DisciplinaryActionForm: React.FC<DisciplinaryActionFormProps> = ({
  initialData,
  sourceReportId,
  sourceInterventionId,
  formTitle,
  formSubtitle,
  isModal = false,
  onSuccess,
  onCancel,
}) => {
  const isReadOnlyFromReport = Boolean(sourceReportId);

  // 1. Reported Student Information State
  const [dafReportedStudentName, setDafReportedStudentName] = useState(
    initialData?.reportedStudentName || ''
  );
  const [dafReportedStudentId, setDafReportedStudentId] = useState(
    initialData?.reportedStudentId || ''
  );
  const [dafReportedStudentCourse, setDafReportedStudentCourse] = useState(
    initialData?.reportedStudentCourse || ''
  );
  const [, setDafAcademicProgram] = useState(
    initialData?.reportedStudentCourse || ''
  );
  const [dafYearLevel, setDafYearLevel] = useState(
    initialData?.reportedStudentYearLevel || ''
  );
  const [dafContactNumber, setDafContactNumber] = useState(
    initialData?.reportedStudentContact || initialData?.contactNumber || ''
  );
  const [dafAddress, setDafAddress] = useState(
    initialData?.reportedStudentAddress || ''
  );

  const [studentsList, setStudentsList] = useState<User[]>([]);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [selectedStudentUser, setSelectedStudentUser] = useState<User | null>(null);
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);

  // 2. Report Information State: Date & Time, Location only
  const [dafReportDate, setDafReportDate] = useState(
    initialData?.reportDate || ''
  );
  const [dafReportTime, setDafReportTime] = useState(
    normalizeTimeForInput(initialData?.reportTime)
  );
  const [dafLocation, setDafLocation] = useState(
    initialData?.location || ''
  );

  // 3. Report Description
  const [dafDescription, setDafDescription] = useState(
    initialData?.description || ''
  );

  // 4. Type of Report State: Checklist (all 8 options unchecked by default when opened)
  const [selectedIncidentTypes, setSelectedIncidentTypes] = useState<string[]>(() => {
    if (initialData?.incidentTypes && initialData.incidentTypes.length > 0) {
      return initialData.incidentTypes;
    }
    return [];
  });
  const [otherIncidentText, setOtherIncidentText] = useState(
    initialData?.incidentTypeOther || ''
  );

  // 5. Guidance Assessment
  const [dafGuidanceAssessment, setDafGuidanceAssessment] = useState(
    initialData?.guidanceAssessment || ''
  );

  // 6. Case Classification
  const [dafCaseClassification, setDafCaseClassification] = useState<string>(
    initialData?.caseClassification || 'Minor Concerns'
  );

  // 7. Action Taken
  const [dafActionTaken, setDafActionTaken] = useState(
    initialData?.actionTaken || ''
  );

  // 8. Reporting Documents / Attached Files
  const [dafEvidenceFileName, setDafEvidenceFileName] = useState(
    initialData?.evidenceFileName || ''
  );
  const [dafEvidenceUrl, setDafEvidenceUrl] = useState(
    initialData?.evidenceUrl || ''
  );

  // 9. Administrative Certification Checkbox
  const [dafDeclarationAccepted, setDafDeclarationAccepted] = useState(
    initialData?.declarationAccepted || false
  );

  const [dafFormError, setDafFormError] = useState('');
  const [dafIsSubmitting, setDafIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const allUsers = getUsers();
      setStudentsList(allUsers.filter((u) => u.role === 'STUDENT'));
    } catch {
      setStudentsList([]);
    }
  }, []);

  const studentSuggestions = useMemo(() => {
    if (!studentSearchInput.trim()) return [];
    const q = studentSearchInput.toLowerCase().trim();
    return studentsList
      .filter(
        (s) =>
          (s.studentId && s.studentId.toLowerCase().includes(q)) ||
          s.fullName.toLowerCase().includes(q) ||
          (s.course && s.course.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [studentsList, studentSearchInput]);

  const handleSelectStudentForDaf = (s: User) => {
    setSelectedStudentUser(s);
    setStudentSearchInput(`${s.fullName} (${s.studentId || 'No ID'})`);
    setDafReportedStudentName(s.fullName);
    setDafReportedStudentId(s.studentId || s.id);
    const initialCourse = s.academicProgram || s.course || '';
    setDafReportedStudentCourse(initialCourse);
    setDafAcademicProgram(initialCourse);
    setDafYearLevel(s.yearLevel || '');
    setDafContactNumber(s.contactNumber || (s as any).phoneNumber || '');
    setDafAddress(s.permanentAddress || s.address || '');
    setShowStudentSuggestions(false);

    // Fetch full student profile from Firebase/Firestore via findUserAsync
    findUserAsync(s.studentId || s.id, s.fullName)
      .then((remote) => {
        if (remote && remote.role === 'STUDENT') {
          setSelectedStudentUser(remote);
          setDafReportedStudentName(remote.fullName);
          setDafReportedStudentId(remote.studentId || remote.id);
          const cVal = remote.academicProgram || remote.course || initialCourse;
          if (cVal) {
            setDafReportedStudentCourse(cVal);
            setDafAcademicProgram(cVal);
          }
          if (remote.yearLevel) setDafYearLevel(remote.yearLevel);
          if (remote.contactNumber || (remote as any).phoneNumber) {
            setDafContactNumber(remote.contactNumber || (remote as any).phoneNumber);
          }
          if (remote.permanentAddress || remote.address) {
            setDafAddress(remote.permanentAddress || remote.address);
          }
        }
      })
      .catch(() => {});
  };

  const handleClearStudentForDaf = () => {
    setSelectedStudentUser(null);
    setStudentSearchInput('');
    setDafReportedStudentName('');
    setDafReportedStudentId('');
    setDafReportedStudentCourse('');
    setDafAcademicProgram('');
    setDafYearLevel('');
    setDafContactNumber('');
    setDafAddress('');
  };

  const initializedSourceKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const currentSourceKey = sourceReportId
      ? `report:${sourceReportId}`
      : sourceInterventionId
      ? `intervention:${sourceInterventionId}`
      : initialData
      ? `initial:${initialData.reportedStudentId || ''}:${initialData.reportedStudentName || ''}:${initialData.reportDate || ''}:${initialData.description || ''}`
      : 'blank';

    if (initializedSourceKeyRef.current === currentSourceKey) {
      return;
    }
    initializedSourceKeyRef.current = currentSourceKey;

    if (initialData) {
      const studentIdToLookup = (initialData.reportedStudentId || (initialData as any).studentId || '').trim();
      const studentNameToLookup = (initialData.reportedStudentName || (initialData as any).studentName || '').trim();

      const studentPool = getUsers().filter((u) => u.role === 'STUDENT');
      const matched = studentPool.find((u) =>
        (studentIdToLookup && (
          (u.studentId && u.studentId.trim().toLowerCase() === studentIdToLookup.toLowerCase()) ||
          (u.id && u.id.trim().toLowerCase() === studentIdToLookup.toLowerCase())
        )) ||
        (studentNameToLookup && u.fullName && u.fullName.trim().toLowerCase() === studentNameToLookup.toLowerCase())
      );

      const fallbackContact =
        initialData.reportedStudentContact || initialData.contactNumber || '';

      if (matched) {
        setSelectedStudentUser(matched);
        setStudentSearchInput(`${matched.fullName} (${matched.studentId || matched.id || 'No ID'})`);
        setDafReportedStudentName(matched.fullName);
        setDafReportedStudentId(matched.studentId || matched.id);
        setDafReportedStudentCourse(matched.academicProgram || matched.course || initialData.reportedStudentCourse || '');
        setDafAcademicProgram(matched.academicProgram || matched.course || initialData.reportedStudentCourse || '');
        setDafYearLevel(matched.yearLevel || initialData.reportedStudentYearLevel || '');
        setDafContactNumber(matched.contactNumber || (matched as any).phoneNumber || fallbackContact);
        setDafAddress(matched.permanentAddress || matched.address || initialData.reportedStudentAddress || '');
      } else {
        setSelectedStudentUser(null);
        setDafReportedStudentName(initialData.reportedStudentName || '');
        setDafReportedStudentId(initialData.reportedStudentId || '');
        setDafReportedStudentCourse(initialData.reportedStudentCourse || '');
        setDafAcademicProgram(initialData.reportedStudentCourse || '');
        setDafYearLevel(initialData.reportedStudentYearLevel || '');
        setDafAddress(initialData.reportedStudentAddress || '');
        setDafContactNumber(fallbackContact);
        if (initialData.reportedStudentName && initialData.reportedStudentId) {
          setStudentSearchInput(
            `${initialData.reportedStudentName} (${initialData.reportedStudentId})`
          );
        } else if (initialData.reportedStudentName) {
          setStudentSearchInput(initialData.reportedStudentName);
        } else {
          setStudentSearchInput('');
        }
      }

      // Fetch latest report and student information directly from Firebase/Firestore
      const fetchLatestFromFirestore = async () => {
        try {
          let reportData: any = null;
          if (sourceReportId) {
            try {
              const snap1 = await getDoc(doc(db, 'safety_reports', sourceReportId));
              if (snap1.exists()) {
                reportData = { id: snap1.id, ...snap1.data() };
              }
            } catch {}

            if (!reportData) {
              try {
                const snap2 = await getDoc(doc(db, 'disciplinary_reports', sourceReportId));
                if (snap2.exists()) {
                  reportData = { id: snap2.id, ...snap2.data() };
                }
              } catch {}
            }
          }

          if (reportData) {
            const rDate = reportData.reportDate || (reportData.submittedAt ? reportData.submittedAt.split('T')[0] : '');
            const rTime = normalizeTimeForInput(reportData.reportTime);
            const rLoc = reportData.location || '';
            const rDesc = reportData.description || '';

            if (rDate) setDafReportDate(rDate);
            if (rTime) setDafReportTime(rTime);
            if (rLoc) setDafLocation(rLoc);
            if (rDesc) setDafDescription(rDesc);
          }

          const targetReport = reportData || initialData;
          const sIdLookup = (targetReport?.reportedStudentId || (targetReport as any)?.studentId || studentIdToLookup || '').trim();
          const sNameLookup = (targetReport?.reportedStudentName || (targetReport as any)?.studentName || studentNameToLookup || '').trim();

          if (sIdLookup || sNameLookup) {
            const remote = await findUserAsync(sIdLookup || sNameLookup, sNameLookup);
            if (remote && remote.role === 'STUDENT') {
              setSelectedStudentUser(remote);
              setStudentSearchInput(`${remote.fullName} (${remote.studentId || remote.id || 'No ID'})`);
              setDafReportedStudentName(remote.fullName);
              setDafReportedStudentId(remote.studentId || remote.id);
              const cVal = remote.academicProgram || remote.course || targetReport?.reportedStudentCourse || '';
              setDafReportedStudentCourse(cVal);
              setDafAcademicProgram(cVal);
              setDafYearLevel(remote.yearLevel || targetReport?.reportedStudentYearLevel || '');
              setDafContactNumber(remote.contactNumber || (remote as any).phoneNumber || targetReport?.reportedStudentContact || targetReport?.contactNumber || '');
              setDafAddress(remote.permanentAddress || remote.address || targetReport?.reportedStudentAddress || '');
            }
          }
        } catch (err) {
          console.warn('Error fetching report/student from Firebase in DisciplinaryActionForm:', err);
        }
      };

      fetchLatestFromFirestore();

      setDafReportDate(initialData.reportDate || '');
      setDafReportTime(normalizeTimeForInput(initialData.reportTime));
      setDafLocation(initialData.location || '');
      setDafDescription(initialData.description || '');
      setSelectedIncidentTypes(
        initialData.incidentTypes && initialData.incidentTypes.length > 0
          ? initialData.incidentTypes
          : []
      );
      setOtherIncidentText(initialData.incidentTypeOther || '');
      setDafGuidanceAssessment(initialData.guidanceAssessment || '');
      setDafCaseClassification(initialData.caseClassification || 'Minor Concerns');
      setDafActionTaken(initialData.actionTaken || '');
      setDafEvidenceFileName(
        initialData.evidenceFileName ||
          (initialData.evidenceUrl ? 'Attached Report Evidence' : '')
      );
      setDafEvidenceUrl(initialData.evidenceUrl || '');
      setDafDeclarationAccepted(Boolean(initialData.declarationAccepted));
      setDafFormError('');
    } else if (!sourceReportId) {
      // Reset to completely blank, editable state when opened normally
      setSelectedStudentUser(null);
      setStudentSearchInput('');
      setDafReportedStudentName('');
      setDafReportedStudentId('');
      setDafReportedStudentCourse('');
      setDafAcademicProgram('');
      setDafYearLevel('');
      setDafContactNumber('');
      setDafAddress('');
      setDafReportDate('');
      setDafReportTime('');
      setDafLocation('');
      setDafDescription('');
      setSelectedIncidentTypes([]);
      setOtherIncidentText('');
      setDafGuidanceAssessment('');
      setDafCaseClassification('Minor Concerns');
      setDafActionTaken('');
      setDafEvidenceFileName('');
      setDafEvidenceUrl('');
      setDafDeclarationAccepted(false);
      setDafFormError('');
    }
  }, [initialData, sourceReportId, sourceInterventionId]);

  const toggleIncidentType = (type: string) => {
    setSelectedIncidentTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnlyFromReport) return;
    const file = e.target.files?.[0];
    if (file) {
      setDafEvidenceFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setDafEvidenceUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearFile = () => {
    if (isReadOnlyFromReport) return;
    setDafEvidenceFileName('');
    setDafEvidenceUrl('');
  };

  const handleSubmitDafForm = (e: React.FormEvent) => {
    e.preventDefault();
    setDafFormError('');

    if (!dafReportedStudentName.trim()) {
      setDafFormError('Please enter the reported student full name.');
      return;
    }

    if (!dafReportedStudentId.trim()) {
      setDafFormError('Please provide the student ID number.');
      return;
    }

    if (!dafLocation.trim()) {
      setDafFormError('Please provide the campus location of the incident.');
      return;
    }

    if (!dafDescription.trim()) {
      setDafFormError('Please enter the report description.');
      return;
    }

    if (selectedIncidentTypes.length === 0) {
      setDafFormError('Please select at least one Type of Report from the checklist.');
      return;
    }

    if (selectedIncidentTypes.includes('Others') && !otherIncidentText.trim()) {
      setDafFormError('Please describe the specific incident type for "Others".');
      return;
    }

    if (!dafActionTaken.trim()) {
      setDafFormError('Please specify the action taken.');
      return;
    }

    if (!dafDeclarationAccepted) {
      setDafFormError('Please certify the administrative declaration before issuing this record.');
      return;
    }

    setDafIsSubmitting(true);

    try {
      const offenseTypeSummary = selectedIncidentTypes
        .map((t) => (t === 'Others' ? (otherIncidentText.trim() ? `Others: ${otherIncidentText.trim()}` : 'Others') : t))
        .join(', ');

      const payload = {
        studentId: dafReportedStudentId.trim(),
        studentName: dafReportedStudentName.trim(),
        course: dafReportedStudentCourse.trim() || undefined,
        yearLevel: dafYearLevel.trim() || undefined,
        offenseType: offenseTypeSummary,
        incidentTypes: selectedIncidentTypes,
        incidentTypeOther: selectedIncidentTypes.includes('Others') ? otherIncidentText.trim() : undefined,
        description: dafDescription.trim(),
        guidanceAssessment: dafGuidanceAssessment.trim() || undefined,
        caseClassification: dafCaseClassification,
        sanction: '',
        reportedBy: 'Guidance Office',
        actionTaken: dafActionTaken.trim(),
        actionTakenOther: dafActionTaken.trim(),
        location: dafLocation.trim(),
        reportDate: dafReportDate,
        reportTime: dafReportTime,
        remarks: dafGuidanceAssessment.trim()
          ? `Guidance Assessment: ${dafGuidanceAssessment.trim()} | Classification: ${dafCaseClassification}`
          : `Classification: ${dafCaseClassification}`,
        evidenceFileName: dafEvidenceFileName || undefined,
        evidenceUrl: dafEvidenceUrl || undefined,
      };

      let record: DisciplinaryRecord;
      if (sourceInterventionId) {
        record = createDisciplinaryRecordFromIntervention(
          sourceInterventionId,
          payload,
          'Maria Mel B. Glemao (Guidance Advocate)'
        );
      } else if (sourceReportId) {
        record = createDisciplinaryRecordFromReport(
          sourceReportId,
          payload,
          'Maria Mel B. Glemao (Guidance Advocate)'
        );
      } else {
        record = addDisciplinaryRecord(
          payload,
          'Maria Mel B. Glemao (Guidance Advocate)'
        );
      }

      if (onSuccess) {
        onSuccess(record);
      }
    } catch (err: any) {
      setDafFormError(err?.message || 'Failed to issue disciplinary action.');
    } finally {
      setDafIsSubmitting(false);
    }
  };

  const isStudentFieldReadOnly = false;
  const isImageAttachment = Boolean(
    dafEvidenceUrl &&
      (dafEvidenceUrl.startsWith('data:image/') ||
        /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(dafEvidenceUrl) ||
        /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(dafEvidenceFileName))
  );

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-3xl ${
        isModal ? 'p-1' : 'border border-slate-200 dark:border-slate-800 shadow-xs p-6'
      } space-y-6`}
    >
      <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="p-2 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 rounded-xl">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            {formTitle
              ? formTitle
              : sourceReportId
              ? `Disciplinary Action Form - Report #${sourceReportId}`
              : 'Disciplinary Action Form'}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {formSubtitle
              ? formSubtitle
              : 'Official Guidance Disciplinary Action & Case Documentation Form'}
          </p>
        </div>
      </div>

      {dafFormError && (
        <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl text-red-800 dark:text-red-200 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{dafFormError}</span>
        </div>
      )}

      <form onSubmit={handleSubmitDafForm} className="space-y-6">
        {/* SECTION 1: Reported Student Information (Offender) */}
        <div className="p-4 bg-red-50/40 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/40 space-y-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h4 className="text-xs font-black text-red-900 dark:text-red-200 uppercase tracking-wider">
              Reported Student Information *
            </h4>
          </div>

          {/* Student Search & Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Student Search &amp; Selection (Search student directory)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search student by full name, student ID, or course..."
                value={studentSearchInput}
                onChange={(e) => {
                  setStudentSearchInput(e.target.value);
                  setShowStudentSuggestions(true);
                }}
                onFocus={() => {
                  setShowStudentSuggestions(true);
                }}
                className="w-full pl-10 pr-10 py-2 text-xs border rounded-xl bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 shadow-xs"
              />
              {studentSearchInput && (
                <button
                  type="button"
                  onClick={handleClearStudentForDaf}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                  title="Clear selection"
                >
                  ✕
                </button>
              )}

              {showStudentSuggestions && studentSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {studentSuggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStudentForDaf(s)}
                      className="w-full p-2.5 text-left hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold flex items-center justify-center text-xs shrink-0">
                          {s.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {s.fullName}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {s.studentId || 'No ID'} • {s.course || ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-red-600">Select</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Student ID *
              </label>
              <input
                type="text"
                required
                readOnly={isStudentFieldReadOnly}
                value={dafReportedStudentId}
                onChange={(e) => {
                  if (!isStudentFieldReadOnly) setDafReportedStudentId(e.target.value);
                }}
                placeholder="Student ID"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl font-mono font-bold ${
                  isStudentFieldReadOnly
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reported Student Name *
              </label>
              <input
                type="text"
                required
                readOnly={isStudentFieldReadOnly}
                value={dafReportedStudentName}
                onChange={(e) => {
                  if (!isStudentFieldReadOnly) setDafReportedStudentName(e.target.value);
                }}
                placeholder="Full Name"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl font-bold ${
                  isStudentFieldReadOnly
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Course / Academic Program
              </label>
              <input
                type="text"
                readOnly={isStudentFieldReadOnly}
                value={dafReportedStudentCourse}
                onChange={(e) => {
                  if (!isStudentFieldReadOnly) setDafReportedStudentCourse(e.target.value);
                }}
                placeholder="Course / Academic Program"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl font-medium ${
                  isStudentFieldReadOnly
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Year Level
              </label>
              <input
                type="text"
                readOnly={isStudentFieldReadOnly}
                value={dafYearLevel}
                onChange={(e) => {
                  if (!isStudentFieldReadOnly) setDafYearLevel(e.target.value);
                }}
                placeholder="Year Level"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl font-medium ${
                  isStudentFieldReadOnly
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                readOnly={isStudentFieldReadOnly}
                value={dafContactNumber}
                onChange={(e) => {
                  if (!isStudentFieldReadOnly) setDafContactNumber(e.target.value);
                }}
                placeholder="Contact Number"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl font-mono font-medium ${
                  isStudentFieldReadOnly
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Complete Address
              </label>
              <input
                type="text"
                readOnly={isStudentFieldReadOnly}
                value={dafAddress}
                onChange={(e) => {
                  if (!isStudentFieldReadOnly) setDafAddress(e.target.value);
                }}
                placeholder="Complete Address"
                className={`w-full px-3.5 py-2 text-xs border rounded-xl font-medium ${
                  isStudentFieldReadOnly
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Report Information: Date & Time, Location only */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Report Information (Date &amp; Time, Location only) *
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Date *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  readOnly={isReadOnlyFromReport}
                  value={dafReportDate}
                  onChange={(e) => {
                    if (!isReadOnlyFromReport) setDafReportDate(e.target.value);
                  }}
                  className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl font-mono font-bold ${
                    isReadOnlyFromReport
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Time *
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="time"
                  required
                  readOnly={isReadOnlyFromReport}
                  value={dafReportTime}
                  onChange={(e) => {
                    if (!isReadOnlyFromReport) setDafReportTime(e.target.value);
                  }}
                  className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl font-mono font-bold ${
                    isReadOnlyFromReport
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Location *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  readOnly={isReadOnlyFromReport}
                  value={dafLocation}
                  onChange={(e) => {
                    if (!isReadOnlyFromReport) setDafLocation(e.target.value);
                  }}
                  placeholder="e.g. DCC Main Campus / Science Building"
                  className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl font-bold ${
                    isReadOnlyFromReport
                      ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Report Description (Placed directly below Report Information, followed by Type of Report) */}
        <div>
          <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1">
            Report Description *
          </label>
          <textarea
            rows={3}
            required
            readOnly={isReadOnlyFromReport}
            value={dafDescription}
            onChange={(e) => {
              if (!isReadOnlyFromReport) setDafDescription(e.target.value);
            }}
            placeholder="Describe the incident narrative, confession, or physical findings..."
            className={`w-full p-3.5 text-xs border rounded-2xl ${
              isReadOnlyFromReport
                ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500'
            }`}
          />
        </div>

        {/* SECTION 4: Type of Report (Checklist) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Type of Report *
            </h4>
          </div>
          <p className="text-[11px] text-slate-500">
            Select one or more violations applicable to this case:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {INCIDENT_CHECKLIST_OPTIONS.map((item, idx) => {
              const isChecked = selectedIncidentTypes.includes(item);
              return (
                <label
                  key={item}
                  className={`flex items-start sm:items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all min-w-0 overflow-hidden ${
                    isChecked
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleIncidentType(item)}
                    className="mt-0.5 sm:mt-0 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer shrink-0"
                  />
                  <span className="min-w-0 flex-1 break-words leading-snug">
                    {idx + 1}. {item}
                  </span>
                </label>
              );
            })}
          </div>

          {selectedIncidentTypes.includes('Others') && (
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300 mb-1">
                Specify Other Incident Violation *
              </label>
              <input
                type="text"
                required
                value={otherIncidentText}
                onChange={(e) => setOtherIncidentText(e.target.value)}
                placeholder="Enter specific incident or misconduct details..."
                className="w-full px-3.5 py-2 text-xs border border-amber-300 dark:border-amber-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
              />
            </div>
          )}
        </div>

        {/* SECTION 5: Guidance Assessment (Text field) */}
        <div>
          <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1">
            Guidance Assessment
          </label>
          <textarea
            rows={3}
            value={dafGuidanceAssessment}
            onChange={(e) => setDafGuidanceAssessment(e.target.value)}
            placeholder="Enter Guidance Advocate assessment, behavioral observations, psychological evaluation..."
            className="w-full p-3.5 text-xs border border-slate-300 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* SECTION 6: Case Classification (Dropdown) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Case Classification *
            </label>
          </div>
          <select
            value={dafCaseClassification}
            onChange={(e) => setDafCaseClassification(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold cursor-pointer focus:ring-2 focus:ring-purple-500"
          >
            {CASE_CLASSIFICATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            Selected classification helps determine the required intervention level and referral track.
          </p>
        </div>

        {/* SECTION 7: Action Taken (Text field) */}
        <div>
          <label className="block text-xs font-black text-slate-900 dark:text-white uppercase mb-1">
            Action Taken *
          </label>
          <input
            type="text"
            required
            value={dafActionTaken}
            onChange={(e) => setDafActionTaken(e.target.value)}
            placeholder="e.g. Verbal Warning Issued / Counseling Referral / Behavioral Contract / Parent Conference"
            className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* SECTION 8: Reporting Documents / Attached Files */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {isReadOnlyFromReport
              ? 'Attachments (From Original Student Report)'
              : 'Reporting Documents / Attached Files (Optional)'}
          </label>

          {isReadOnlyFromReport ? (
            dafEvidenceFileName || dafEvidenceUrl ? (
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate max-w-xs">
                    {dafEvidenceFileName || 'Attached Report Evidence'}
                  </span>
                </div>
                {isImageAttachment && dafEvidenceUrl && (
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 max-w-md">
                    <img
                      src={dafEvidenceUrl}
                      alt={dafEvidenceFileName || 'Report Attachment'}
                      className="max-h-56 w-auto rounded-lg object-contain"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                No files or images attached to the original report.
              </p>
            )
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:border-red-500 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-2xs">
                  <Paperclip className="w-4 h-4 text-red-600" />
                  <span>Attach File / Slip...</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {dafEvidenceFileName ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate max-w-xs">{dafEvidenceFileName}</span>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="text-slate-400 hover:text-red-500 ml-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">No document attached (optional)</span>
                )}
              </div>
              {isImageAttachment && dafEvidenceUrl && (
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 max-w-md">
                  <img
                    src={dafEvidenceUrl}
                    alt={dafEvidenceFileName || 'Attached Preview'}
                    className="max-h-56 w-auto rounded-lg object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 9: Administrative Certification Checkbox */}
        <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/60 space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={dafDeclarationAccepted}
              onChange={(e) => setDafDeclarationAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>Administrative Certification:</strong> I hereby certify that this disciplinary
              action form has been duly verified, administered with due process, and will be logged
              into the Official Disciplinary Records. *
            </span>
          </label>
        </div>

        {/* SECTION 10: Cancel and Issue Official Disciplinary Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          {isModal && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={dafIsSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {dafIsSubmitting ? 'Issuing Record...' : 'Issue Official Disciplinary Action'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
