export type SystemModule =
  | 'dashboard'
  | 'safety_reports'
  | 'refer_student_reports'
  | 'register_student'
  | 'announcements'
  | 'scholarship'
  | 'student_grievances'
  | 'appointments'
  | 'disciplinary'
  | 'intervention'
  | 'dormitory'
  | 'student_records'
  | 'ratings'
  | 'activity_logs'
  | 'settings'
  | 'submit_feedback'
  | 'referred_disciplinary';

export type UserRole = 'ADMIN' | 'GUIDANCE_ADMIN' | 'STUDENT';

export interface User {
  id: string;
  uid?: string; // Firebase Auth / Firestore UID link
  studentId?: string; // e.g. "2026-000001"
  fullName: string;
  surname?: string;
  firstName?: string;
  middleName?: string;
  extensionName?: string;
  section?: string;
  email: string;
  contactNumber?: string;
  address?: string;
  permanentAddress?: string;
  role: UserRole;
  avatarUrl: string;
  yearLevel?: string;
  course?: string;
  academicProgram?: string;
  oneTimePassword?: string;
  password?: string;
  passwordHash?: string;
  passwordUpdatedAt?: string;
  updatedAt?: number;
  mustChangePassword?: boolean;
  isSuspended?: boolean;
  createdAt: string;
}

export type SafetyReportStatus = 'REPORTED' | 'RESOLVED' | 'ESCALATED';

export type GuidanceCaseStatus =
  | 'REFERRED'
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'FOLLOW_UP'
  | 'COMPLETED'
  | 'RESOLVED'
  | 'ACTIVE'
  | 'PENDING_COUNSELING'
  | 'PENDING_INTAKE';

export interface SafetyReport {
  id: string;
  studentId: string;
  studentName: string;
  isAnonymous: boolean;
  description: string;
  details?: string; // alias for description
  involvedPersons: string;
  location: string;
  evidenceUrl?: string;
  reportedAt: string;
  status: SafetyReportStatus;
  isUrgent: boolean;
  notes?: string;
  referredToGuidance?: boolean;
  guidanceReferralDate?: string;
  guidanceReferralNotes?: string;
  guidanceReferralBy?: string;
  guidanceFollowUpNotes?: string;
  guidanceNotes?: string;
  guidanceActionTaken?: string;
  guidanceStatus?: GuidanceCaseStatus;
  updatedAt?: number;
}

export type AnnouncementCategory = 'SCHOOL' | 'SCHOLARSHIP' | 'DORMITORY' | 'GUIDANCE';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  createdAt: string;
  expirationDate: string;
  imageUrl?: string;
  externalLink?: string;
  postedBy: string;
  isArchived?: boolean;
  scholarshipId?: string;
  dormRoomId?: string;
  heartReacts?: string[]; // Student names or IDs who heart reacted ("I am looking forward")
  updatedAt?: number;
}

export type ScholarshipStatus = 'ACTIVE' | 'CLOSED' | 'DRAFT';

export interface Scholarship {
  id: string;
  title: string;
  description: string;
  requirements: string;
  deadline: string;
  amount?: string;
  grantAmount?: number;
  maxSlots: number;
  status: ScholarshipStatus;
  createdAt: string;
  imageUrl?: string;
  isArchived?: boolean;
  updatedAt?: number;
}

export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface ScholarshipApplication {
  id: string;
  scholarshipId: string;
  scholarshipTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  course: string;
  yearLevel: string;
  appliedAt: string;
  approvedAt?: string;
  status: ApplicationStatus;
  adminNotes?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachments?: Array<{ name: string; url: string; size?: number; type?: string }>;
  updatedAt?: number;
}

export type AppointmentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'RESCHEDULED'
  | 'REJECTED'
  | 'REFERRED_TO_GUIDANCE'
  | 'REFERRED'
  | 'DONE_ADMIN'
  | 'DONE_STUDENT'
  | 'COMPLETED'
  | 'FOLLOW_UP';

export interface Appointment {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  description: string;
  preferredDate: string;
  preferredTime: string;
  status: AppointmentStatus;
  date?: string;
  time?: string;
  reason?: string;
  office?: string;
  targetOffice?: string;
  department?: string;
  adminPreferredDate?: string;
  adminPreferredTime?: string;
  adminNotes?: string;
  rescheduleReason?: string;
  rescheduledByRole?: 'ADMIN' | 'GUIDANCE_ADMIN';
  rescheduledByName?: string;
  referredToGuidance?: boolean;
  referredFromOsas?: boolean;
  isReferredFromOsas?: boolean;
  guidanceReferralDate?: string;
  guidanceReferralNotes?: string;
  guidanceReferralBy?: string;
  guidanceNotes?: string;
  guidanceActionTaken?: string;
  guidanceFollowUpNotes?: string;
  createdAt: string;
  completedAt?: string;
  adminMarkedDone?: boolean;
  studentMarkedDone?: boolean;
  isArchived?: boolean;
  archiveReason?: string;
  updatedAt?: number;
  actionTaken?: string;
  completeAddress?: string;
  address?: string;
  academicProgram?: string;
  course?: string;
  yearLevel?: string;
  contactNumber?: string;
  concerns?: string;
  purpose?: string;
  isGuidanceWalkIn?: boolean;
}

export interface DisciplinaryRecord {
  id: string;
  studentId: string;
  studentName: string;
  course?: string;
  yearLevel?: string;
  offenseType: string;
  description: string;
  sanction: string;
  reportedBy?: string; // Security Personnel, Faculty/Staff, OSAS Officer, Student, Anonymous Reporter
  actionTaken?: string; // Verbal Warning Issued, Written Warning Issued, Others
  actionTakenOther?: string;
  dateLogged: string;
  issuedBy: string;
  isArchived?: boolean;
  isArchivedByAdmin?: boolean;
  adminMarkedDone?: boolean;
  studentMarkedDone?: boolean;
  status?: 'SANCTIONED' | 'COMPLETED';
  reportId?: string;
  startDate?: string;
  completionDate?: string;
  remarks?: string;
  referredToGuidance?: boolean;
  guidanceReferralDate?: string;
  guidanceReferralNotes?: string;
  guidanceReferralBy?: string;
  guidanceCounselingNotes?: string;
  guidanceNotes?: string;
  guidanceConfidentialNotes?: string;
  guidanceActionTaken?: string;
  guidanceOutcomeSummary?: string;
  guidanceCounselorAssigned?: string;
  guidanceSessionsCount?: number;
  guidanceSessionCount?: number;
  guidanceFollowUpPlan?: string;
  guidanceCompletionDate?: string;
  guidanceStatus?: GuidanceCaseStatus;
  linkedInterventionId?: string;
  location?: string;
  evidenceFileName?: string;
  evidenceUrl?: string;
  reportDate?: string;
  reportTime?: string;
  incidentTypes?: string[];
  incidentTypeOther?: string;
  guidanceAssessment?: string;
  caseClassification?: 'Minor Concerns' | 'Moderate Concerns' | 'Serious and Major Concerns' | string;
  updatedAt?: number;
}

export type IncidentType =
  | 'Incident'
  | 'Disciplinary'
  | 'Tobacco/Nicotine use'
  | 'Vaping'
  | 'Possession of Prohibited Items'
  | 'Discipline'
  | 'Others';

export type DisciplinaryReportStatus =
  | 'SUBMITTED'
  | 'SAVED_RECORD'
  | 'UNDER_INVESTIGATION'
  | 'REFERRED_TO_OSAS'
  | 'OSAS_REMARKS_SAVED'
  | 'SANCTIONED'
  | 'Sanction'
  | 'RESOLVED'
  | 'UNRESOLVED'
  | 'ESCALATED'
  | 'DISMISSED'
  | 'Dismissed'
  | 'Dismiss Incident'
  | 'Resolved Incident';

export type DisciplinaryReporterRole =
  | 'Security Personnel'
  | 'Faculty/Staff'
  | 'OSAS Officer'
  | 'Student'
  | 'Anonymous Reporter';

export type DisciplinaryActionTaken =
  | 'Verbal Warning Issued'
  | 'Written Warning Issued'
  | 'Others';

export type ReportClassificationCategory = 'Grievance' | 'Incident' | 'Disciplinary';

export interface EndorsementLetterData {
  id: string;
  createdAt: string;
  higherOfficerName: string;
  higherOfficerTitle: string;
  institutionName?: string;
  institutionLocation?: string;
  subject: string;
  studentName: string;
  studentId?: string;
  courseYear?: string;
  caseBackground: string;
  actionsTaken: string;
  reasonForEndorsement: string;
  recommendation: string;
  endorsedByName: string;
  endorsedByTitle: string;
  notedByName?: string;
  notedByTitle?: string;
}

export interface ResolutionActionStep {
  id?: string;
  stepNumber: number;
  stepTitle?: string;
  dateTime: string;
  actionTaken: string;
  responsiblePerson: string;
  personInvolved?: string;
}

export interface DisciplinaryReport {
  id: string;
  reporterUserId?: string;
  reporterStudentId: string;
  reporterName: string;
  reporterRole?: DisciplinaryReporterRole | string;
  isAnonymousReporter?: boolean;
  reporterCourse: string;
  reporterYearLevel: string;
  reporterContactNumber?: string;
  reportedStudentName: string;
  reportedStudentId?: string;
  reportedStudentCourse?: string;
  reportedStudentYearLevel?: string;
  reportedStudentContact?: string;
  reportedStudentAddress?: string;
  incidentType: IncidentType | string;
  description: string;
  location: string;
  reportDate?: string;
  reportTime?: string;
  actionTaken?: DisciplinaryActionTaken | string;
  actionTakenOther?: string;
  evidenceFileName?: string;
  evidenceUrl?: string;
  submittedAt: string;
  status: DisciplinaryReportStatus;
  investigationNotes?: string;
  declarationAccepted: boolean;
  linkedRecordId?: string;
  disciplinaryRecordId?: string;
  classificationCategory?: ReportClassificationCategory;
  grievanceResolutionNotes?: string;
  incidentDocumentationNotes?: string;
  disciplinaryEvaluationNotes?: string;
  // Student Reports Record state
  isSavedRecord?: boolean;
  savedToRecordAt?: string;
  savedToRecordBy?: string;
  // Slip Notices history on this report
  slipNotices?: SlipNotice[];
  // Guidance -> OSAS Referral fields (same structure as OSAS Referral Form)
  referredToOsas?: boolean;
  referredFromOsas?: boolean;
  isReferredFromOsas?: boolean;
  osasReferralDate?: string;
  osasReferralBy?: string;
  osasReferralDesignation?: string;
  osasReferralReasons?: string[];
  osasReferralReasonsOther?: string;
  osasReferralDescription?: string;
  osasReferralFollowUpDate?: string;
  osasReferralResponsibleParties?: string;
  osasReferralCaseStatus?: string;
  osasReferralNextSteps?: string;
  osasReferralRecommendedDesignation?: string;
  osasReferralUrgency?: string;
  osasReferralAttachmentsType?: string;
  osasReferralAttachmentsOther?: string;
  osasReferralActionTakenSummary?: string;
  osasApprovalName?: string;
  osasApprovedByDesignation?: string;
  osasReceivingUnit?: string;
  // OSAS Remarks & Actions
  osasRemarks?: string;
  osasRemarksBy?: string;
  osasRemarksSavedAt?: string;
  // Guidance Resolution & Escalation
  problemResolved?: string;
  resolutionActionSteps?: ResolutionActionStep[];
  resolutionDetails?: string;
  resolutionActionTaken?: string;
  resolutionOutcome?: 'RESOLVED' | 'UNRESOLVED';
  resolvedAt?: string;
  resolvedBy?: string;
  // Endorsement Letter for Higher Officer
  endorsementLetter?: EndorsementLetterData;
  isResolutionArchived?: boolean;
  isArchived?: boolean;
  updatedAt?: number;
}

export type InterventionReferrerType =
  | 'Guidance Advocate'
  | 'OSAS Administrator'
  | 'OSAS Officer'
  | 'Faculty'
  | 'Counselor'
  | 'Parents/Guardian'
  | 'Self'
  | 'Peer'
  | 'Others';

export type InterventionReasonType =
  | 'Academic Concerns'
  | 'Behavioral Issues'
  | 'Mental Health Concerns'
  | 'Financial Concerns'
  | 'Family Problems'
  | 'Substance Use'
  | 'Attendance/Absenteeism'
  | 'Peer Conflict'
  | 'Disciplinary Rehabilitation'
  | 'Others';

export type InterventionStrategyType =
  | 'Academic Advising'
  | 'Counseling Services'
  | 'Referral to Guidance Counselor'
  | 'Peer Mediation'
  | 'Parent/Guardian Conference'
  | 'Financial Assistance Referral'
  | 'Monitoring and Follow-up'
  | 'Behavioral Agreement / Contract'
  | 'Others';

export type InterventionUrgency =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT'
  | 'IMMEDIATE'
  | 'WITHIN_3_DAYS'
  | 'WITHIN_1_WEEK'
  | 'FOR_MONITORING';

export type InterventionStatus =
  | 'REFERRED'
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'FOLLOW_UP'
  | 'COMPLETED'
  | 'ACTIVE'
  | 'RESOLVED'
  | 'FOLLOW_UP_REQUIRED';

export interface InterventionRecord {
  id: string;
  // 1. Student Information
  studentId: string;
  studentName: string;
  reportedStudentName?: string;
  course: string;
  yearLevel: string;
  contactNumber: string;
  address: string;
  email?: string;

  // 2. Referral Information
  dateOfReferral: string; // Automatic current date
  referredBy: InterventionReferrerType | string;
  referredByPersonnel?: string; // OSAS Admin personnel name
  referredByDesignation?: string; // e.g., 'OSAS Administrator'
  referredByOther?: string;
  nameOfReferrer?: string;
  relationshipToStudent?: string;
  reasonForReferral?: string; // Brief description or summary of concerns
  descriptionOfConcerns: string;

  // 3. Reason for Intervention (Checklist)
  reasons: string[]; // Academic Concerns, Behavioral Issues, Mental Health Concern, Financial Concern, Family Problems, Substance Use, Attendance/Absenteeism, Peer Conflict, Others
  reasonsOther?: string;

  // 4. Recommended Referral Designation
  recommendedDesignation?: string; // Fixed/designated: 'Guidance and Counseling Services'

  // 5. Summary of Action Taken by OSAS
  actionTakenSummary?: string; // List any interventions, interviews, or observations completed
  summaryOfActionTaken?: string;

  // 6. Urgency of Referral
  urgencyOfReferral?: string; // 'Immediate (safety/high risk concern)', 'Within 3 days', 'Within 1 week', 'For monitoring/consultation'
  urgencyLevel?: InterventionUrgency;
  specificSupportAreas?: string[];

  // 7. Attachments, if applicable
  attachmentsType?: string; // 'Incident reports', 'Medical report', 'Counseling notes', 'Academic records', 'Others'
  attachmentsOther?: string;

  // 8. OSAS Authorization and Signature
  osasApprovalName?: string;
  osasApprovalDate?: string;
  osasDesignation?: string;
  approvedBy?: string;
  createdBy: string;
  createdAt: string;

  // 9. Receive Unit Acknowledgement (Guidance Office)
  receivedByName?: string;
  receivedByPosition?: string;
  receivedDate?: string;
  receivedActionRemarks?: string;
  guidanceActionTakenRemarks?: string;

  // Optional linked disciplinary or strategy fields
  linkedDisciplinaryId?: string;
  linkedDisciplinaryOffense?: string;
  linkedDisciplinarySanction?: string;
  strategies?: string[];
  strategiesOther?: string;
  nextSteps?: string;
  followUpDate?: string;
  responsibleParties?: string;
  status: InterventionStatus;
  isArchived?: boolean;
  updatedAt?: number;

  // Guidance Administration & Intervention Tracking
  referredToGuidance?: boolean;
  guidanceReferralDate?: string;
  guidanceReferralNotes?: string;
  guidanceReferralBy?: string;
  guidanceStatus?: GuidanceCaseStatus;
  guidanceCounselorAssigned?: string;
  guidanceReceivedDate?: string;
  guidanceSessionCount?: number;
  guidanceSessionsCount?: number;
  guidanceLastSessionDate?: string;
  guidanceFollowUpPlan?: string;
  guidanceConfidentialNotes?: string; // Strictly confidential to Guidance Admin
  guidanceOutcomeSummary?: string;    // High-level outcome summary visible to OSAS Admin
  guidanceActionTaken?: string;
  guidanceCompletionDate?: string;
  guidanceNotes?: string;             // Alias for backwards compatibility
  // Guidance Intervention & Resolution Workflow fields
  problemConcernToAddress?: string;
  counselingApprovalStatus?: string;
  counselingScheduledDateTime?: string;
  interventionTypes?: string[];
  guidanceAdvocateName?: string;
  guidanceAdvocatePosition?: string;
  problemResolved?: string;
  resolutionActionSteps?: ResolutionActionStep[];
  resolutionOutcome?: 'RESOLVED' | 'UNRESOLVED';
  resolutionDetails?: string;
  resolutionActionTaken?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  osasRemarks?: string;
  osasRemarksBy?: string;
  osasRemarksSavedAt?: string;
  referredToOsas?: boolean;
  osasReferralDate?: string;
  osasReferralBy?: string;
  osasReferralReason?: string;
  osasReferralDescription?: string;
  osasSessionNotes?: string;
  osasSessionDate?: string;
  osasSessionConductedBy?: string;
  notes?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  sourceAppointmentId?: string;
  adminMarkedDone?: boolean;
  completedAt?: string;
}

export interface DormResident {
  id: string;
  studentId: string;
  studentName: string;
  assignedDate: string;
  contactNumber?: string;
  email?: string;
}

export interface DormRoom {
  id: string;
  roomNumber: string;
  floor: string;
  wingType?: string; // e.g. "Male Wing", "Female Wing", "Co-Ed Wing", "East Wing"
  capacity: number;
  gender: 'MALE' | 'FEMALE' | 'COED';
  occupiedCount: number;
  status: 'AVAILABLE' | 'FULL' | 'MAINTENANCE';
  residents: DormResident[];
  isArchived?: boolean;
  updatedAt?: number;
}

export interface DormApplicant {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  address: string;
  reason: string;
  attachmentUrl?: string;
  attachmentName?: string;
  appliedAt: string;
  status: ApplicationStatus;
  assignedRoomNumber?: string;
  updatedAt?: number;
}

export type DormReportStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export type DormReportIssueType =
  | 'WATER_SHORTAGE'
  | 'BROKEN_FAUCET'
  | 'STALKER'
  | 'ROOMMATE_CONFLICT'
  | 'MAINTENANCE'
  | 'OTHER';

export interface DormReport {
  id: string;
  studentId: string;
  studentName: string;
  roomNumber: string;
  issueType: DormReportIssueType;
  description: string;
  reportedAt: string;
  status: DormReportStatus;
  adminMarkedDone?: boolean;
  studentMarkedDone?: boolean;
  adminNotes?: string;
  completedAt?: string;
  isArchived?: boolean;
  expiredAt?: string;
}

export interface StudentFeedback {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  content: string;
  submittedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  module: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

export type SlipNoticePurpose =
  | 'Counseling'
  | 'Assessment'
  | 'Follow-up'
  | 'Routine Interview'
  | 'Meeting/Conference'
  | 'Other Services';

export interface SlipNotice {
  id: string;
  reportId?: string;
  dateSent: string;
  studentId?: string;
  studentName: string;
  course?: string;
  yearLevel?: string;
  contactNumber?: string;
  visitDate: string;
  visitTime: string;
  purposes: string[];
  counselorName: string;
  counselorTitle?: string;
  notes?: string;
}

export interface SystemNotification {
  id: string;
  userId: string; // 'ADMIN' or studentId
  title: string;
  message: string;
  type: 'SAFETY' | 'APPOINTMENT' | 'SCHOLARSHIP' | 'DORM' | 'ANNOUNCEMENT' | 'SYSTEM' | 'INTERVENTION' | 'INFO' | 'SLIP_NOTICE';
  isRead: boolean;
  createdAt: string;
  timestamp?: number;
  linkModule?: string;
  category?: AnnouncementCategory;
  announcementId?: string;
  slipNotice?: SlipNotice;
}

export type ArchiveType =
  | 'ANNOUNCEMENT'
  | 'SCHOLARSHIP'
  | 'REJECTED_SCHOLARSHIP_APPLICATION'
  | 'DORM_APPLICANT'
  | 'DISCIPLINARY'
  | 'DISCIPLINARY_REPORT'
  | 'INTERVENTION'
  | 'RESOLUTION'
  | 'DORM_ROOM'
  | 'DORM_RESIDENT'
  | 'STUDENT_RECORD'
  | 'SAFETY_REPORT'
  | 'APPOINTMENT'
  | 'EXPIRED_APPOINTMENT'
  | 'DORM_REPORT'
  | 'TRANSACTION_RATING'
  | 'EVALUATION_FEEDBACK';

export interface ArchiveItem {
  id: string;
  originalId: string;
  type: ArchiveType;
  title: string;
  deletedAt: string;
  data: any;
}

export interface EmergencyContact {
  id: string;
  name: string;
  department: string;
  phoneNumber: string;
  availableHours: string;
  icon: string;
}

export type TransactionCategory = 'APPOINTMENT' | 'DORM_REPORT';

export interface TransactionRating {
  id: string;
  transactionId: string;
  category: TransactionCategory;
  studentId: string;
  studentName: string;
  rating: number; // 1 to 5
  ratingLabel: string; // e.g., 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'
  comment?: string;
  createdAt: string;
  titleOrDetails?: string;
}

export interface OsasEvaluationQuestionAnswer {
  questionId: number;
  questionText: string;
  score: number; // 1 to 5
}

export interface OsasServiceEvaluation {
  id: string;
  studentId: string;
  studentName: string;
  answers: OsasEvaluationQuestionAnswer[];
  overallAverage: number;
  overallLabel: string;
  feedbackContent: string;
  submittedAt: string;
}

export interface PasswordResetOtpRecord {
  email: string;
  studentId?: string;
  userId: string;
  otp: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

