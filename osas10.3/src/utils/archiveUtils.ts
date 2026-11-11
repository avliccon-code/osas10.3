import { ArchiveItem, DisciplinaryReport, InterventionRecord } from '../types';

export const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (1 month)
export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000;

export type ArchiveTimeFilter = 'ALL' | 'WEEK' | 'MONTH' | 'YEAR';

export function isReportResolutionSaved(rep: DisciplinaryReport | null | undefined): boolean {
  if (!rep) return false;
  return Boolean(rep.resolvedAt && rep.resolutionDetails && rep.resolutionDetails.trim());
}

export function isStudentReportCaseResolved(rep: DisciplinaryReport | null | undefined): boolean {
  if (!rep) return false;
  const hasOsasRemarks = Boolean(rep.osasRemarks && rep.osasRemarks.trim());
  if (hasOsasRemarks) {
    return true;
  }
  const outcomeUpper = String(rep.resolutionOutcome || '').trim().toUpperCase();
  const statusUpper = String(rep.status || '').trim().toUpperCase();
  if (outcomeUpper === 'UNRESOLVED' || statusUpper === 'UNRESOLVED' || statusUpper === 'REFERRED_TO_OSAS') {
    return false;
  }
  return (
    outcomeUpper === 'RESOLVED' ||
    outcomeUpper === 'CASE RESOLVED' ||
    statusUpper === 'RESOLVED' ||
    statusUpper === 'RESOLVED_BY_GUIDANCE'
  );
}

export function shouldAutoArchiveReportResolution(
  rep: DisciplinaryReport | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!rep || rep.isArchived || rep.isResolutionArchived) return false;
  if (!isReportResolutionSaved(rep)) return false;
  // Never auto-archive Unresolved records; only Case Resolved
  if (!isStudentReportCaseResolved(rep)) return false;

  // Use osasRemarksSavedAt if resolved via OSAS remarks, otherwise resolvedAt
  const effectiveResolvedAt =
    rep.osasRemarks && rep.osasRemarks.trim() && rep.osasRemarksSavedAt
      ? rep.osasRemarksSavedAt
      : rep.resolvedAt || '';
  const resolvedMs = new Date(effectiveResolvedAt).getTime();
  if (isNaN(resolvedMs)) return false;
  return nowMs - resolvedMs >= ONE_MONTH_MS;
}

export function isInterventionCaseResolved(rec: InterventionRecord | null | undefined): boolean {
  if (!rec) return false;
  const hasResolutionData = Boolean(
    rec.problemResolved ||
      rec.resolutionDetails ||
      rec.guidanceActionTaken ||
      (rec.resolutionActionSteps && rec.resolutionActionSteps.length > 0)
  );
  if (!hasResolutionData) return false;
  const outcomeUpper = String(rec.resolutionOutcome || '').trim().toUpperCase();
  const statusUpper = String(rec.status || '').trim().toUpperCase();
  if (outcomeUpper === 'UNRESOLVED' || statusUpper === 'UNRESOLVED') {
    return false;
  }
  return Boolean(
    outcomeUpper === 'RESOLVED' ||
      outcomeUpper === 'CASE RESOLVED' ||
      statusUpper === 'COMPLETED' ||
      statusUpper === 'RESOLVED' ||
      String(rec.guidanceStatus || '').toUpperCase() === 'COMPLETED' ||
      rec.resolvedAt
  );
}

export function shouldAutoArchiveInterventionResolution(
  rec: InterventionRecord | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!rec || rec.isArchived) return false;
  // Never auto-archive unresolved records; only Case Resolved
  if (!isInterventionCaseResolved(rec)) return false;

  const refDateStr = rec.resolvedAt || rec.completedAt || '';
  if (!refDateStr) return false;
  const resolvedMs = new Date(refDateStr).getTime();
  if (isNaN(resolvedMs)) return false;
  return nowMs - resolvedMs >= ONE_MONTH_MS;
}

export const OSAS_ARCHIVE_CATEGORIES = [
  { value: 'RESOLUTION', label: 'Guidance Resolutions', types: ['RESOLUTION'] },
  { value: 'INTERVENTION', label: 'Intervention Resolutions', types: ['INTERVENTION'] },
  { value: 'SCHOLARSHIP', label: 'Scholarship Grants', types: ['SCHOLARSHIP'] },
  {
    value: 'REJECTED_SCHOLARSHIP_APPLICATION',
    label: 'Rejected Scholarship Applications',
    types: ['REJECTED_SCHOLARSHIP_APPLICATION', 'SCHOLARSHIP_APPLICATION'],
  },
  { value: 'DORM_ROOM', label: 'Dormitory Rooms', types: ['DORM_ROOM'] },
  {
    value: 'DORM_APPLICANT',
    label: 'Rejected Dormitory Applicants',
    types: ['DORM_APPLICANT', 'REJECTED_DORM_APPLICANT', 'DORM_RESIDENT'],
  },
  { value: 'DORM_REPORT', label: 'Dormitory Reports', types: ['DORM_REPORT'] },
  {
    value: 'STUDENT_RECORD',
    label: 'Student Records',
    types: ['STUDENT_RECORD', 'USER'],
  },
  { value: 'ANNOUNCEMENT', label: 'Announcements', types: ['ANNOUNCEMENT'] },
] as const;

export function matchesArchiveCategoryFilter(item: ArchiveItem, categoryFilter: string): boolean {
  if (!categoryFilter || categoryFilter === 'ALL') return true;
  const t = String(item.type || '');
  if (categoryFilter === 'STUDENT_CONCERNS') {
    return (
      t === 'APPOINTMENT' ||
      t === 'EXPIRED_APPOINTMENT' ||
      t === 'STUDENT_CONCERN' ||
      t === 'STUDENT_CONCERNS'
    );
  }
  if (categoryFilter === 'STUDENT_RECORD') {
    return t === 'STUDENT_RECORD' || t === 'USER';
  }
  if (categoryFilter === 'DORM_APPLICANT' || categoryFilter === 'REJECTED_DORM_APPLICANT') {
    return t === 'DORM_APPLICANT' || t === 'REJECTED_DORM_APPLICANT' || t === 'DORM_RESIDENT';
  }
  if (categoryFilter === 'REJECTED_SCHOLARSHIP_APPLICATION') {
    return t === 'REJECTED_SCHOLARSHIP_APPLICATION' || t === 'SCHOLARSHIP_APPLICATION';
  }
  return t === categoryFilter;
}

export function getDynamicOsasArchiveCategories(items: ArchiveItem[]) {
  const safeItems = Array.isArray(items) ? items : [];
  return OSAS_ARCHIVE_CATEGORIES.filter((cat) =>
    safeItems.some((item) => matchesArchiveCategoryFilter(item, cat.value))
  );
}

export function getOsasReferredReportButtonStates(rep: DisciplinaryReport | null | undefined) {
  const hasOsasSlipSent = Boolean(
    rep?.slipNotices && rep.slipNotices.some((s) => s.counselorTitle === 'OSAS Administrator')
  );
  const hasOsasRemarksSaved = Boolean(rep?.osasRemarks && rep.osasRemarks.trim());
  const hasEndorsementLetter = Boolean(rep?.endorsementLetter);

  return {
    hasOsasSlipSent,
    hasOsasRemarksSaved,
    hasEndorsementLetter,
    sendSlipDisabled: hasOsasSlipSent || hasOsasRemarksSaved,
    addRemarksDisabled: hasOsasRemarksSaved,
    endorsementDisabled: hasEndorsementLetter ? false : hasOsasRemarksSaved,
    endorsementLabel: hasEndorsementLetter
      ? 'Print Endorsement Letter'
      : 'Create Endorsement Letter',
  };
}

export function filterArchiveItemsByCategoryAndTime(
  items: ArchiveItem[],
  categoryFilter: string,
  timeFilter: ArchiveTimeFilter,
  nowMs: number = Date.now()
): ArchiveItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!matchesArchiveCategoryFilter(item, categoryFilter)) {
      return false;
    }
    if (timeFilter !== 'ALL') {
      const rawDate = item.deletedAt || item.data?.resolvedAt || item.data?.createdAt;
      const itemMs = rawDate ? new Date(rawDate).getTime() : NaN;
      if (isNaN(itemMs)) return false;
      const diff = nowMs - itemMs;
      if (diff < 0) return true;
      if (timeFilter === 'WEEK' && diff > ONE_WEEK_MS) return false;
      if (timeFilter === 'MONTH' && diff > ONE_MONTH_MS) return false;
      if (timeFilter === 'YEAR' && diff > ONE_YEAR_MS) return false;
    }
    return true;
  });
}



