import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OSAS_ARCHIVE_CATEGORIES,
  matchesArchiveCategoryFilter,
  filterArchiveItemsByCategoryAndTime,
  shouldAutoArchiveReportResolution,
  shouldAutoArchiveInterventionResolution,
} from './archiveUtils';
import { ArchiveItem, DisciplinaryReport, InterventionRecord } from '../types';

test('OSAS_ARCHIVE_CATEGORIES renames Scholarship Applications and Dormitory Applicants', () => {
  const labels: string[] = OSAS_ARCHIVE_CATEGORIES.map((c) => c.label);
  assert.ok(labels.includes('Rejected Scholarship Applications'));
  assert.ok(labels.includes('Rejected Dormitory Applicants'));
  assert.ok(!labels.includes('Scholarship Applications'));
  assert.ok(!labels.includes('Dormitory Applicants'));
});

test('matchesArchiveCategoryFilter maps rejected scholarship applications and dormitory applicants accurately', () => {
  const scholarshipItem: ArchiveItem = {
    id: '1',
    originalId: 'orig-1',
    type: 'REJECTED_SCHOLARSHIP_APPLICATION',
    title: 'Rejected App',
    deletedAt: new Date().toISOString(),
    data: {},
  };
  const legacyScholarshipItem = {
    id: '2',
    originalId: 'orig-2',
    type: 'SCHOLARSHIP_APPLICATION',
    title: 'Legacy Rejected App',
    deletedAt: new Date().toISOString(),
    data: {},
  } as unknown as ArchiveItem;
  const dormItem: ArchiveItem = {
    id: '3',
    originalId: 'orig-3',
    type: 'DORM_APPLICANT',
    title: 'Rejected Dorm App',
    deletedAt: new Date().toISOString(),
    data: {},
  };
  const rejectedDormItem = {
    id: '4',
    originalId: 'orig-4',
    type: 'REJECTED_DORM_APPLICANT',
    title: 'Rejected Dorm App 2',
    deletedAt: new Date().toISOString(),
    data: {},
  } as unknown as ArchiveItem;

  assert.equal(matchesArchiveCategoryFilter(scholarshipItem, 'REJECTED_SCHOLARSHIP_APPLICATION'), true);
  assert.equal(matchesArchiveCategoryFilter(legacyScholarshipItem, 'REJECTED_SCHOLARSHIP_APPLICATION'), true);
  assert.equal(matchesArchiveCategoryFilter(dormItem, 'DORM_APPLICANT'), true);
  assert.equal(matchesArchiveCategoryFilter(rejectedDormItem, 'DORM_APPLICANT'), true);
  assert.equal(matchesArchiveCategoryFilter(dormItem, 'REJECTED_SCHOLARSHIP_APPLICATION'), false);
});

test('filterArchiveItemsByCategoryAndTime returns matching items for OSAS categories', () => {
  const now = Date.now();
  const items: ArchiveItem[] = [
    {
      id: 'a1',
      originalId: 'orig-a1',
      type: 'REJECTED_SCHOLARSHIP_APPLICATION',
      title: 'S1',
      deletedAt: new Date(now - 1000).toISOString(),
      data: {},
    },
    {
      id: 'a2',
      originalId: 'orig-a2',
      type: 'DORM_APPLICANT',
      title: 'D1',
      deletedAt: new Date(now - 1000).toISOString(),
      data: {},
    },
  ];

  const filteredScholarships = filterArchiveItemsByCategoryAndTime(
    items,
    'REJECTED_SCHOLARSHIP_APPLICATION',
    'ALL',
    now
  );
  assert.equal(filteredScholarships.length, 1);
  assert.equal(filteredScholarships[0].id, 'a1');

  const filteredDorm = filterArchiveItemsByCategoryAndTime(items, 'DORM_APPLICANT', 'ALL', now);
  assert.equal(filteredDorm.length, 1);
  assert.equal(filteredDorm[0].id, 'a2');
});

test('shouldAutoArchiveReportResolution and shouldAutoArchiveInterventionResolution work as expected', () => {
  const now = Date.now();
  const twoMonthsAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();
  const mockReport = {
    id: 'r1',
    studentId: 's1',
    reporterName: 'Student',
    reportedStudentName: 'Target',
    incidentType: 'Bullying',
    description: 'Desc',
    location: 'Room 1',
    incidentDate: '2026-01-01',
    incidentTime: '10:00',
    status: 'RESOLVED',
    resolutionOutcome: 'RESOLVED',
    resolutionDetails: 'Resolved',
    resolvedAt: twoMonthsAgo,
    createdAt: twoMonthsAgo,
  } as unknown as DisciplinaryReport;

  assert.equal(shouldAutoArchiveReportResolution(mockReport, now), true);

  const mockIntervention = {
    id: 'i1',
    studentId: 's1',
    studentName: 'Student',
    referredBy: 'OSAS',
    reasons: ['Reason'],
    actionTaken: 'Action',
    status: 'COMPLETED',
    resolutionOutcome: 'RESOLVED',
    resolutionDetails: 'Resolved',
    resolvedAt: twoMonthsAgo,
    createdAt: twoMonthsAgo,
  } as unknown as InterventionRecord;

  assert.equal(shouldAutoArchiveInterventionResolution(mockIntervention, now), true);
});
