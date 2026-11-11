import {
  User,
  UserRole,
  SafetyReport,
  Announcement,
  AnnouncementCategory,
  Scholarship,
  ScholarshipApplication,
  Appointment,
  DisciplinaryRecord,
  DisciplinaryReport,
  DisciplinaryReportStatus,
  ReportClassificationCategory,
  DisciplinaryReporterRole,
  DisciplinaryActionTaken,
  IncidentType,
  InterventionRecord,
  InterventionReferrerType,
  InterventionReasonType,
  InterventionStrategyType,
  InterventionStatus,
  InterventionUrgency,
  GuidanceCaseStatus,
  DormResident,
  DormRoom,
  DormApplicant,
  DormReport,
  DormReportIssueType,
  DormReportStatus,
  StudentFeedback,
  ActivityLog,
  SystemNotification,
  ArchiveItem,
  ArchiveType,
  EmergencyContact,
  AppointmentStatus,
  ApplicationStatus,
  SafetyReportStatus,
  TransactionRating,
  TransactionCategory,
  OsasServiceEvaluation,
  OsasEvaluationQuestionAnswer,
  PasswordResetOtpRecord,
  SlipNotice,
  EndorsementLetterData,
  ResolutionActionStep,
} from '../types';
import {
  shouldAutoArchiveReportResolution,
  shouldAutoArchiveInterventionResolution,
} from '../utils/archiveUtils';
import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  updatePassword,
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { hashPassword, verifyUserCredentials } from '../utils/security';
import {
  ADMIN_EMAIL,
  sendEmail,
  sendStudentRegistrationEmail,
  sendPasswordResetEmail,
  sendAppointmentCreatedEmail,
  sendAppointmentStatusEmail,
  sendAnnouncementBroadcastEmail,
  sendSafetyReportAlertEmail,
  sendSafetyReportStatusUpdateEmail,
  sendScholarshipApplicationAlertEmail,
  sendScholarshipStatusEmail,
  sendDormApplicationAlertEmail,
  sendDormApplicationStatusEmail,
  sendDormReportAlertEmail,
  sendDormReportCompletedEmail,
  sendDisciplinaryReportAlertEmail,
  sendDisciplinaryReportStatusUpdateEmail,
  sendDisciplinaryRecordNoticeEmail,
  sendStudentFeedbackAlertEmail,
} from './emailService';

export const STORAGE_KEYS = {
  USERS: 'osas_users',
  ANNOUNCEMENTS: 'osas_announcements',
  SAFETY_REPORTS: 'osas_safety_reports',
  SCHOLARSHIPS: 'osas_scholarships',
  SCHOLARSHIP_APPS: 'osas_scholarship_apps',
  APPOINTMENTS: 'osas_appointments',
  DISCIPLINARY: 'osas_disciplinary',
  DISCIPLINARY_REPORTS: 'osas_disciplinary_reports',
  INTERVENTIONS: 'osas_interventions',
  DORM_ROOMS: 'osas_dorm_rooms',
  DORM_APPLICANTS: 'osas_dorm_applicants',
  DORM_REPORTS: 'osas_dorm_reports',
  FEEDBACKS: 'osas_feedbacks',
  ACTIVITY_LOGS: 'osas_activity_logs',
  NOTIFICATIONS: 'osas_notifications',
  ARCHIVE: 'osas_archive',
  PURGED_IDS: 'osas_purged_ids',
  RESTORED_IDS: 'osas_restored_ids',
  CURRENT_USER: 'osas_current_user',
  EMAIL_LOGS: 'osas_email_logs',
  SYSTEM_LOGO: 'osas_system_logo',
  COURSES: 'osas_courses',
  WING_TYPES: 'osas_wing_types',
  TRANSACTION_RATINGS: 'osas_transaction_ratings',
  OSAS_EVALUATIONS: 'osas_evaluations',
  PASSWORD_RESET_OTPS: 'osas_password_reset_otps',
};

// Initial Seed Users (Admin only, zero student records)
const initialUsers: User[] = [
  {
    id: 'admin-1',
    fullName: 'Princess Ann T. Ruzol',
    email: 'arnoldviena@gmail.com',
    role: 'ADMIN',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    createdAt: '2024-01-01',
  },
  {
    id: 'guidance-admin-1',
    fullName: 'Maria Mel B. Glemao',
    email: 'avliccon04@gmail.com',
    role: 'GUIDANCE_ADMIN',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    createdAt: '2024-01-01',
  },
];

// Initial Seed Announcements (Empty)
const initialAnnouncements: Announcement[] = [];

// Initial Scholarships (Empty)
const initialScholarships: Scholarship[] = [];

// Initial Safety Reports (Empty)
const initialSafetyReports: SafetyReport[] = [];

// Initial Dorm Rooms (Empty)
const initialDormRooms: DormRoom[] = [];

// Initial Appointments (Empty)
const initialAppointments: Appointment[] = [];

// Initial Emergency Contacts
export const emergencyContactsList: EmergencyContact[] = [
  { id: 'ec-1', name: 'University Campus Security Command', department: 'Main Gate Security Office', phoneNumber: '(02) 8920-1111 / 0917-888-9900', availableHours: '24/7 Hotlines', icon: 'ShieldAlert' },
  { id: 'ec-2', name: 'OSAS Crisis Response & Clinic', department: 'Student Welfare & Health Center', phoneNumber: '(02) 8920-2222 / 0920-555-4433', availableHours: '8:00 AM - 8:00 PM', icon: 'Cross' },
  { id: 'ec-3', name: 'Guidance & Psychological Counseling Desk', department: 'OSAS Counseling Wing', phoneNumber: '(02) 8920-3333', availableHours: '8:00 AM - 5:00 PM', icon: 'HeartHandshake' },
  { id: 'ec-4', name: 'Local City Emergency Rescue & Fire Station', department: 'National Emergency Bureau', phoneNumber: '911 / (02) 8928-0000', availableHours: '24/7 Hotline', icon: 'PhoneCall' },
];

// Helper to get from storage
export function getStoredData<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) {
      if (memoryStorage.has(key)) {
        return memoryStorage.get(key) as T;
      }
      return fallback;
    }
    try {
      const parsed = JSON.parse(item);
      // If we also have a memory version that holds full attachment data (e.g. for scholarship applications), prefer the rich memory version
      if (memoryStorage.has(key)) {
        const memVal = memoryStorage.get(key);
        if (Array.isArray(memVal) && Array.isArray(parsed) && memVal.length >= parsed.length) {
          return memVal as T;
        }
      }
      return parsed;
    } catch {
      // If parsing fails (e.g. unquoted raw string like data:image/png stored directly)
      if (typeof fallback === 'string') {
        return item as unknown as T;
      }
      if (memoryStorage.has(key)) {
        return memoryStorage.get(key) as T;
      }
      return fallback;
    }
  } catch {
    if (memoryStorage.has(key)) {
      return memoryStorage.get(key) as T;
    }
    return fallback;
  }
}

// Recursively sanitizes objects and arrays so Firestore never throws 'Unsupported field value: undefined'
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as any;
  if (Array.isArray(data)) {
    return data.map((item) => cleanForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}

// Helper to sanitize users object so giant base64 avatar strings are trimmed
function sanitizeUsers(users: any[]): any[] {
  if (!Array.isArray(users)) return users;
  return users.map((u) => {
    if (u && typeof u.avatarUrl === 'string' && u.avatarUrl.length > 50000) {
      return {
        ...u,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.fullName || u.id || 'user')}`,
      };
    }
    return u;
  });
}

// In-memory fallback storage for large datasets (e.g. applications with attachments) when localStorage quota is tight
const memoryStorage = new Map<string, any>();

// Helper to sanitize scholarship applications for localStorage caching while keeping them intact in memory & Firestore
function sanitizeScholarshipAppsForCache(apps: any[]): any[] {
  if (!Array.isArray(apps)) return apps;
  return apps.map((app) => {
    if (!app || typeof app !== 'object') return app;
    // If application has heavy base64 data URLs in attachments, keep lightweight placeholders in localStorage
    const clone = { ...app };
    if (Array.isArray(clone.attachments)) {
      clone.attachments = clone.attachments.map((att: any) => {
        if (att && typeof att.url === 'string' && att.url.length > 50000) {
          return {
            ...att,
            url: att.url.slice(0, 50) + '...[cached_in_firestore]',
          };
        }
        return att;
      });
    }
    if (typeof clone.attachmentUrl === 'string' && clone.attachmentUrl.length > 50000) {
      clone.attachmentUrl = clone.attachmentUrl.slice(0, 50) + '...[cached_in_firestore]';
    }
    return clone;
  });
}

function pruneNonEssentialStorage(): void {
  try {
    const logs = getStoredData<any[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
      if (logs && logs.length > 0) {
        localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(logs.slice(0, 15)));
      }
    } catch (_) {}

    const notifs = getStoredData<any[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    try {
      localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
      if (notifs && notifs.length > 0) {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs.slice(0, 100)));
      }
    } catch (_) {}

    const emails = getStoredData<any[]>(STORAGE_KEYS.EMAIL_LOGS, []);
    try {
      localStorage.removeItem(STORAGE_KEYS.EMAIL_LOGS);
      if (emails && emails.length > 0) {
        localStorage.setItem(STORAGE_KEYS.EMAIL_LOGS, JSON.stringify(emails.slice(0, 10)));
      }
    } catch (_) {}

    const usersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (usersRaw) {
      try {
        const parsed = JSON.parse(usersRaw);
        const sanitized = sanitizeUsers(parsed);
        localStorage.removeItem(STORAGE_KEYS.USERS);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitized));
      } catch (_) {}
    }

    const rawQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (rawQueue) {
      try {
        const parsed = JSON.parse(rawQueue);
        if (Array.isArray(parsed) && parsed.length > 10) {
          localStorage.removeItem(OFFLINE_QUEUE_KEY);
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(parsed.slice(-10)));
        }
      } catch (_) {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
    }
  } catch (_) {
    try {
      localStorage.removeItem(STORAGE_KEYS.EMAIL_LOGS);
      localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
    } catch (e) {}
  }
}

/**
 * Safe localStorage write helper that prevents QuotaExceededError crashes
 * and aggressively reclaims space by pruning logs and non-essential caches.
 */
export function safeLocalStorageSet(key: string, valStr: string): boolean {
  if (typeof window === 'undefined') return false;

  // Always keep the freshest raw parsed value in memoryStorage for instant retrieval
  try {
    memoryStorage.set(key, JSON.parse(valStr));
  } catch {
    memoryStorage.set(key, valStr);
  }

  try {
    localStorage.setItem(key, valStr);
    return true;
  } catch (err) {
    console.warn(`[Storage] Quota exceeded or error writing "${key}". Reclaiming space...`, err);
    pruneNonEssentialStorage();

    // Prepare a reduced payload if saving logs, notifications, or heavy application arrays
    let retryValStr = valStr;
    try {
      if (
        key === STORAGE_KEYS.ACTIVITY_LOGS ||
        key === STORAGE_KEYS.NOTIFICATIONS ||
        key === STORAGE_KEYS.EMAIL_LOGS
      ) {
        const parsed = JSON.parse(valStr);
        if (Array.isArray(parsed)) {
          retryValStr = JSON.stringify(parsed.slice(0, 15));
        }
      } else if (key === STORAGE_KEYS.SCHOLARSHIP_APPS) {
        const parsed = JSON.parse(valStr);
        if (Array.isArray(parsed)) {
          retryValStr = JSON.stringify(sanitizeScholarshipAppsForCache(parsed));
        }
      }
    } catch (_) {}

    try {
      // Remove before setting to free slot in storage table
      localStorage.removeItem(key);
      localStorage.setItem(key, retryValStr);
      return true;
    } catch (retryErr) {
      console.warn(`[Storage] Second write attempt failed for "${key}". Purging temporary logs...`, retryErr);
      try {
        localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
        localStorage.removeItem(STORAGE_KEYS.EMAIL_LOGS);
        localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        localStorage.removeItem(key);

        // If it's scholarship applications or dorm applicants, sanitize attachments to fit within quota
        let finalPayload = retryValStr;
        if (key === STORAGE_KEYS.SCHOLARSHIP_APPS) {
          try {
            const parsed = JSON.parse(retryValStr);
            finalPayload = JSON.stringify(sanitizeScholarshipAppsForCache(parsed));
          } catch (_) {}
        }

        localStorage.setItem(key, finalPayload);
        return true;
      } catch (finalErr) {
        // Quota is completely exhausted on this device's browser disk:
        // Value is safely preserved in memoryStorage, and Firestore remains authoritative source
        console.warn(`[Storage] Local quota full. "${key}" kept in memory and synchronized with Firestore.`);
        return true;
      }
    }
  }
}

// Centralized Synchronization & Offline Sync Engine
let lastSyncedServerTime = 0;
const OFFLINE_QUEUE_KEY = 'osas_offline_queue';
const CLEAN_RESET_EPOCH_KEY = 'osas_clean_reset_epoch';
const CURRENT_CLEAN_RESET_EPOCH = '2026-11-10-clean-reset-v7';

// One-time clean data reset migration for browsers holding pre-reset localStorage data
if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem(CLEAN_RESET_EPOCH_KEY) !== CURRENT_CLEAN_RESET_EPOCH) {
      Object.values(STORAGE_KEYS).forEach((k) => {
        if (k !== STORAGE_KEYS.SYSTEM_LOGO) {
          localStorage.removeItem(k);
          memoryStorage.delete(k);
        }
      });
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      localStorage.removeItem('osas_active_module');
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
      memoryStorage.set(STORAGE_KEYS.USERS, initialUsers);
      localStorage.setItem(CLEAN_RESET_EPOCH_KEY, CURRENT_CLEAN_RESET_EPOCH);
    }
  } catch (_) {}
}

// Immediate initial prune of existing bloated logs on startup
if (typeof window !== 'undefined') {
  try {
    const rawLogs = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    if (rawLogs) {
      const parsedLogs = JSON.parse(rawLogs);
      if (Array.isArray(parsedLogs) && parsedLogs.length > 30) {
        localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
        localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(parsedLogs.slice(0, 30)));
      }
    }
  } catch (_) {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
    } catch (e) {}
  }
}

/**
 * Safe asynchronous event dispatcher to prevent React state update during render cycles
 */
export function safeDispatchEvent(eventName: string, detail?: any): void {
  if (typeof window === 'undefined') return;
  setTimeout(() => {
    try {
      if (detail !== undefined) {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
      } else {
        window.dispatchEvent(new Event(eventName));
      }
    } catch (e) {
      console.warn('safeDispatchEvent warning:', e);
    }
  }, 0);
}

function queueOfflineSync(key: string, value: any): void {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ key, value, timestamp: Date.now() });
    const cappedQueue = queue.slice(-20);
    safeLocalStorageSet(OFFLINE_QUEUE_KEY, JSON.stringify(cappedQueue));
  } catch (err) {
    console.error('Error queuing offline sync item:', err);
  }
}

export function getPurgedIds(): Set<string> {
  const list = getStoredData<string[]>(STORAGE_KEYS.PURGED_IDS, []);
  return new Set(list);
}

export function savePurgedIds(ids: Set<string>): void {
  setStoredData(STORAGE_KEYS.PURGED_IDS, Array.from(ids));
}

export function getRestoredIds(): Set<string> {
  const list = getStoredData<string[]>(STORAGE_KEYS.RESTORED_IDS, []);
  return new Set(list);
}

export function saveRestoredIds(ids: Set<string>): void {
  setStoredData(STORAGE_KEYS.RESTORED_IDS, Array.from(ids));
}

function getItemTime(x: any): number {
  if (!x || typeof x !== 'object') return 0;
  if (typeof x.updatedAt === 'number') return x.updatedAt;
  if (x.updatedAt) {
    const t = new Date(x.updatedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const dates = [x.approvedAt, x.submittedAt, x.reportedAt, x.appliedAt, x.createdAt, x.dateReported, x.timestamp, x.date];
  for (const d of dates) {
    if (d) {
      const t = new Date(d).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
  }
  return 0;
}

function mergeCollectionWithLocal(key: string, incomingVal: any): { mergedVal: any; hasChanges: boolean } {
  if (incomingVal === undefined || incomingVal === null) {
    return { mergedVal: null, hasChanges: false };
  }

  // Preserve active device-specific session for current user
  if (key === STORAGE_KEYS.CURRENT_USER) {
    const localValStr = localStorage.getItem(key);
    return { mergedVal: localValStr ? JSON.parse(localValStr) : null, hasChanges: false };
  }

  let localVal: any;
  if (memoryStorage.has(key)) {
    localVal = memoryStorage.get(key);
  } else {
    const localValStr = localStorage.getItem(key);
    if (!localValStr) {
      let finalIncoming = incomingVal;
      if (Array.isArray(incomingVal)) {
        if (key === STORAGE_KEYS.ACTIVITY_LOGS) finalIncoming = incomingVal.slice(0, 40);
        else if (key === STORAGE_KEYS.NOTIFICATIONS) finalIncoming = incomingVal.slice(0, 40);
        else if (key === STORAGE_KEYS.EMAIL_LOGS) finalIncoming = incomingVal.slice(0, 20);
      }
      return { mergedVal: finalIncoming, hasChanges: true };
    }
    try {
      localVal = JSON.parse(localValStr);
    } catch {
      return { mergedVal: incomingVal, hasChanges: true };
    }
  }

  // If already identical to incoming cloud data, no changes needed
  if (JSON.stringify(localVal) === JSON.stringify(incomingVal)) {
    return { mergedVal: localVal, hasChanges: false };
  }

  // If incoming cloud data is explicitly empty, only accept if local is also empty
  if (Array.isArray(incomingVal) && incomingVal.length === 0) {
    if (Array.isArray(localVal) && localVal.length > 0) {
      // Local has active data; do NOT wipe local data with empty cloud payload
      return { mergedVal: localVal, hasChanges: false };
    }
    if (key === STORAGE_KEYS.USERS) {
      return { mergedVal: initialUsers, hasChanges: false };
    }
    return { mergedVal: [], hasChanges: false };
  }

  // If both local and incoming are arrays of items with an id, merge smartly
  if (Array.isArray(localVal) && Array.isArray(incomingVal)) {
    const purged = getPurgedIds();
    const restored = getRestoredIds();
    const map = new Map<string, any>();

    // For active collections (not ARCHIVE), build set of currently archived original IDs
    const archivedIds = new Set<string>();
    const archivedResolutionReportIds = new Set<string>();
    const archivedStudentIds = new Set<string>();
    if (key !== STORAGE_KEYS.ARCHIVE) {
      try {
        const rawArchive = localStorage.getItem(STORAGE_KEYS.ARCHIVE);
        const parsedArchive: ArchiveItem[] = rawArchive ? JSON.parse(rawArchive) : [];
        parsedArchive.forEach((a) => {
          const aid = String(a.id || '').trim();
          const aOrig = String(a.originalId || '').trim();
          const aDataId = String(a.data?.id || '').trim();
          if (!restored.has(aid) && !restored.has(aOrig) && !restored.has(aDataId)) {
            if (a.type === 'RESOLUTION') {
              if (aOrig) archivedResolutionReportIds.add(aOrig);
              if (aDataId) archivedResolutionReportIds.add(aDataId);
            } else {
              if (aid) archivedIds.add(aid);
              if (aOrig) archivedIds.add(aOrig);
              if (aDataId) archivedIds.add(aDataId);
            }
            if (a.type === 'STUDENT_RECORD' || (a.type as string) === 'USER') {
              if (a.data?.studentId) archivedStudentIds.add(String(a.data.studentId).trim().toLowerCase());
              if (a.data?.email) archivedStudentIds.add(String(a.data.email).trim().toLowerCase());
            }
          }
        });
      } catch (_) {}
    }

    const isExcluded = (item: any): boolean => {
      if (!item || typeof item !== 'object') return false;
      const id = String(item.id || '').trim();
      const origId = String(item.originalId || '').trim();
      const dataId = String(item.data?.id || '').trim();
      const studentId = String(item.studentId || item.data?.studentId || '').trim();
      const email = String(item.email || item.data?.email || '').trim().toLowerCase();

      if (id && purged.has(id)) return true;
      if (origId && purged.has(origId)) return true;
      if (dataId && purged.has(dataId)) return true;

      if (key === STORAGE_KEYS.USERS) {
        if (studentId && purged.has(studentId)) return true;
        if (email && purged.has(email)) return true;
        if (id && archivedIds.has(id)) return true;
        if (studentId && archivedStudentIds.has(studentId.toLowerCase())) return true;
        if (email && archivedStudentIds.has(email)) return true;
      } else if (key === STORAGE_KEYS.ARCHIVE) {
        if (
          (id && restored.has(id)) ||
          (origId && restored.has(origId)) ||
          (dataId && restored.has(dataId))
        ) {
          return true;
        }
      } else if (
        key !== STORAGE_KEYS.DISCIPLINARY_REPORTS &&
        key !== STORAGE_KEYS.INTERVENTIONS &&
        key !== STORAGE_KEYS.APPOINTMENTS &&
        key !== STORAGE_KEYS.DISCIPLINARY
      ) {
        if (
          (id && archivedIds.has(id)) ||
          (origId && archivedIds.has(origId)) ||
          (dataId && archivedIds.has(dataId))
        ) {
          return true;
        }
      }
      return false;
    };

    const applyArchiveFlagIfNeeded = (item: any) => {
      if (!item || typeof item !== 'object') return item;
      const id = item.id ? String(item.id) : '';
      if (key === STORAGE_KEYS.DISCIPLINARY_REPORTS && id && archivedResolutionReportIds.has(id) && !restored.has(id)) {
        item = { ...item, isResolutionArchived: true };
      }
      if (id && archivedIds.has(id) && !restored.has(id)) {
        if (key === STORAGE_KEYS.DISCIPLINARY) {
          return { ...item, isArchived: true, isArchivedByAdmin: true };
        }
        if (
          key === STORAGE_KEYS.DISCIPLINARY_REPORTS ||
          key === STORAGE_KEYS.INTERVENTIONS ||
          key === STORAGE_KEYS.APPOINTMENTS
        ) {
          return { ...item, isArchived: true };
        }
      }
      return item;
    };

    const isReportReferred = (r: any): boolean => {
      if (!r || typeof r !== 'object') return false;
      return Boolean(
        r.referredToOsas ||
          r.status === 'REFERRED_TO_OSAS' ||
          r.status === 'OSAS_REMARKS_SAVED' ||
          r.osasReferralDate ||
          (Array.isArray(r.osasReferralReasons) && r.osasReferralReasons.length > 0)
      );
    };

    // 1. Populate map with incoming items that have not been purged or archived
    incomingVal.forEach((item) => {
      if (item && typeof item === 'object' && item.id) {
        const id = String(item.id);
        if (!isExcluded(item)) {
          let normalized = applyArchiveFlagIfNeeded(item);
          if (key === STORAGE_KEYS.DISCIPLINARY_REPORTS && isReportReferred(normalized)) {
            normalized = { ...normalized, referredToOsas: true, isSavedRecord: true };
          }
          map.set(id, normalized);
        }
      }
    });

    // 2. Merge local items: preserve any valid local items not in map, resolve existing by freshest timestamp
    localVal.forEach((item) => {
      if (item && typeof item === 'object' && item.id) {
        const id = String(item.id);
        if (isExcluded(item)) return;

        const incomingItem = map.get(id);
        if (!incomingItem) {
          // Keep local item so records never disappear during sync transitions
          map.set(id, applyArchiveFlagIfNeeded(item));
        } else {
          // Both exist: resolve by best timestamp while preserving slipNotices, osasRemarks, endorsementLetter, and resolution state for disciplinary reports
          const localTime = getItemTime(item);
          const incomingTime = getItemTime(incomingItem);
          let merged =
            incomingTime >= localTime
              ? applyArchiveFlagIfNeeded({ ...item, ...incomingItem })
              : { ...incomingItem, ...item };

          if (key === STORAGE_KEYS.DISCIPLINARY_REPORTS) {
            const localSlips = Array.isArray(item.slipNotices) ? item.slipNotices : [];
            const incomingSlips = Array.isArray(incomingItem.slipNotices) ? incomingItem.slipNotices : [];
            if (localSlips.length > 0 || incomingSlips.length > 0) {
              const slipMap = new Map<string, any>();
              [...incomingSlips, ...localSlips].forEach((s) => {
                if (s && typeof s === 'object') {
                  const sKey = s.id || `${s.counselorTitle}-${s.dateSent}-${s.visitDate}-${s.visitTime}`;
                  if (!slipMap.has(sKey)) {
                    slipMap.set(sKey, s);
                  }
                }
              });
              merged.slipNotices = Array.from(slipMap.values());
            }

            const hasIncomingRemarks = Boolean(incomingItem.osasRemarks && String(incomingItem.osasRemarks).trim());
            const hasLocalRemarks = Boolean(item.osasRemarks && String(item.osasRemarks).trim());
            if (hasIncomingRemarks || hasLocalRemarks) {
              const remarksSource = hasIncomingRemarks ? incomingItem : item;
              merged.osasRemarks = String(remarksSource.osasRemarks).trim();
              merged.osasRemarksBy = remarksSource.osasRemarksBy || merged.osasRemarksBy;
              merged.osasRemarksSavedAt = remarksSource.osasRemarksSavedAt || merged.osasRemarksSavedAt;
            }

            if (incomingItem.endorsementLetter || item.endorsementLetter) {
              merged.endorsementLetter = incomingItem.endorsementLetter || item.endorsementLetter;
            }

            if (
              incomingItem.disciplinaryRecordId ||
              item.disciplinaryRecordId ||
              incomingItem.linkedRecordId ||
              item.linkedRecordId
            ) {
              const linkedId =
                incomingItem.disciplinaryRecordId ||
                item.disciplinaryRecordId ||
                incomingItem.linkedRecordId ||
                item.linkedRecordId;
              merged.disciplinaryRecordId = linkedId;
              merged.linkedRecordId = linkedId;
              merged.isSavedRecord = true;
            }

            if (isReportReferred(incomingItem) || isReportReferred(item)) {
              const refSource = isReportReferred(incomingItem) ? incomingItem : item;
              merged.referredToOsas = true;
              merged.isSavedRecord = true;
              merged.osasReferralDate = refSource.osasReferralDate || merged.osasReferralDate;
              merged.osasReferralBy = refSource.osasReferralBy || merged.osasReferralBy;
              merged.osasReferralDesignation = refSource.osasReferralDesignation || merged.osasReferralDesignation;
              merged.osasReferralReasons =
                (Array.isArray(refSource.osasReferralReasons) && refSource.osasReferralReasons.length > 0
                  ? refSource.osasReferralReasons
                  : merged.osasReferralReasons) || ['Referred by Guidance Advocate'];
              merged.osasReferralReasonsOther = refSource.osasReferralReasonsOther || merged.osasReferralReasonsOther;
              merged.osasReferralDescription =
                refSource.osasReferralDescription || merged.osasReferralDescription || merged.description;
              merged.osasReferralFollowUpDate = refSource.osasReferralFollowUpDate || merged.osasReferralFollowUpDate;
              merged.osasReferralResponsibleParties =
                refSource.osasReferralResponsibleParties || merged.osasReferralResponsibleParties;
              merged.osasReferralCaseStatus =
                refSource.osasReferralCaseStatus || merged.osasReferralCaseStatus || 'REFERRED';
              merged.osasReferralNextSteps = refSource.osasReferralNextSteps || merged.osasReferralNextSteps;
              merged.osasReferralRecommendedDesignation =
                refSource.osasReferralRecommendedDesignation ||
                merged.osasReferralRecommendedDesignation ||
                'Office of Student Affairs and Services (OSAS)';
              merged.osasReferralUrgency =
                refSource.osasReferralUrgency || merged.osasReferralUrgency || 'Within 3 days';
              merged.osasReferralAttachmentsType =
                refSource.osasReferralAttachmentsType ||
                merged.osasReferralAttachmentsType ||
                'Incident reports';
              merged.osasReferralAttachmentsOther =
                refSource.osasReferralAttachmentsOther || merged.osasReferralAttachmentsOther;
              merged.osasReferralActionTakenSummary =
                refSource.osasReferralActionTakenSummary || merged.osasReferralActionTakenSummary;
              merged.osasApprovalName = refSource.osasApprovalName || merged.osasApprovalName;
              merged.osasApprovedByDesignation =
                refSource.osasApprovedByDesignation || merged.osasApprovedByDesignation || 'Guidance Advocate';
              merged.osasReceivingUnit =
                refSource.osasReceivingUnit || merged.osasReceivingUnit || 'OSAS Administrator';
            }

            const hasIncomingRes = Boolean(
              incomingItem.resolvedAt &&
                incomingItem.resolutionDetails &&
                String(incomingItem.resolutionDetails).trim()
            );
            const hasLocalRes = Boolean(
              item.resolvedAt && item.resolutionDetails && String(item.resolutionDetails).trim()
            );
            if (hasIncomingRes || hasLocalRes) {
              const resSource = hasIncomingRes ? incomingItem : item;
              merged.resolvedAt = resSource.resolvedAt || merged.resolvedAt;
              merged.resolvedBy = resSource.resolvedBy || merged.resolvedBy;
              merged.resolutionDetails = String(resSource.resolutionDetails).trim();
              merged.resolutionOutcome = resSource.resolutionOutcome || merged.resolutionOutcome;
              merged.resolutionActionTaken = resSource.resolutionActionTaken || merged.resolutionActionTaken;
              merged.resolutionActionSteps = resSource.resolutionActionSteps || merged.resolutionActionSteps;
              merged.problemResolved = resSource.problemResolved || merged.problemResolved;
            }

            const hasResolution = Boolean(
              merged.resolvedAt && merged.resolutionDetails && String(merged.resolutionDetails).trim()
            );
            const hasFinalRemarks = Boolean(merged.osasRemarks && String(merged.osasRemarks).trim());
            if (hasResolution && hasFinalRemarks) {
              merged.resolutionOutcome = 'RESOLVED';
              merged.status = 'RESOLVED';
            }
          } else if (key === STORAGE_KEYS.INTERVENTIONS) {
            const hasIncomingRes = Boolean(
              incomingItem.resolvedAt ||
                (incomingItem.resolutionDetails && String(incomingItem.resolutionDetails).trim()) ||
                (incomingItem.problemResolved && String(incomingItem.problemResolved).trim())
            );
            const hasLocalRes = Boolean(
              item.resolvedAt ||
                (item.resolutionDetails && String(item.resolutionDetails).trim()) ||
                (item.problemResolved && String(item.problemResolved).trim())
            );
            if (hasIncomingRes || hasLocalRes) {
              const resSource = hasIncomingRes ? incomingItem : item;
              merged.resolvedAt = resSource.resolvedAt || merged.resolvedAt;
              merged.resolvedBy = resSource.resolvedBy || merged.resolvedBy;
              merged.resolutionDetails = resSource.resolutionDetails || merged.resolutionDetails;
              merged.problemResolved = resSource.problemResolved || merged.problemResolved;
              merged.resolutionActionTaken = resSource.resolutionActionTaken || merged.resolutionActionTaken;
              merged.resolutionActionSteps = resSource.resolutionActionSteps || merged.resolutionActionSteps;
              merged.resolutionOutcome = resSource.resolutionOutcome || merged.resolutionOutcome;
              merged.guidanceActionTaken = resSource.guidanceActionTaken || merged.guidanceActionTaken;
              merged.guidanceOutcomeSummary = resSource.guidanceOutcomeSummary || merged.guidanceOutcomeSummary;
              if (resSource.status === 'RESOLVED' || resSource.status === 'COMPLETED') {
                merged.status = resSource.status;
              }
            }
            if (incomingItem.referredToOsas || item.referredToOsas) {
              merged.referredToOsas = true;
              merged.osasReferralDate = incomingItem.osasReferralDate || item.osasReferralDate;
              merged.osasReferralReason = incomingItem.osasReferralReason || item.osasReferralReason;
            }
            if (incomingItem.isArchived || item.isArchived) {
              merged.isArchived = Boolean(incomingItem.isArchived ?? item.isArchived);
              merged.archivedAt = incomingItem.archivedAt || item.archivedAt;
              merged.archivedBy = incomingItem.archivedBy || item.archivedBy;
            }
          } else if (key === STORAGE_KEYS.APPOINTMENTS) {
            if (incomingItem.status === 'RESCHEDULED' || item.status === 'RESCHEDULED') {
              const resSource = incomingItem.status === 'RESCHEDULED' ? incomingItem : item;
              merged.rescheduleReason = resSource.rescheduleReason || merged.rescheduleReason;
              merged.adminNotes = resSource.adminNotes || merged.adminNotes;
              merged.adminPreferredDate = resSource.adminPreferredDate || merged.adminPreferredDate;
              merged.adminPreferredTime = resSource.adminPreferredTime || merged.adminPreferredTime;
              merged.hasRescheduled = Boolean(resSource.hasRescheduled ?? merged.hasRescheduled ?? true);
            }
            if (incomingItem.linkedInterventionId || item.linkedInterventionId) {
              merged.linkedInterventionId = incomingItem.linkedInterventionId || item.linkedInterventionId;
            }
            if (incomingItem.isArchived || item.isArchived) {
              merged.isArchived = Boolean(incomingItem.isArchived ?? item.isArchived);
            }
          } else if (key === STORAGE_KEYS.SCHOLARSHIP_APPS) {
            if (incomingItem.attachmentUrl || item.attachmentUrl) {
              merged.attachmentUrl = incomingItem.attachmentUrl || item.attachmentUrl;
              merged.attachmentName = incomingItem.attachmentName || item.attachmentName;
            }
            const incAtt = Array.isArray(incomingItem.attachments) ? incomingItem.attachments : [];
            const locAtt = Array.isArray(item.attachments) ? item.attachments : [];
            if (incAtt.length > 0 && incAtt.some((a: any) => a?.url)) {
              merged.attachments = incAtt;
            } else if (locAtt.length > 0) {
              merged.attachments = locAtt;
            }
          } else if (key === STORAGE_KEYS.DORM_APPLICANTS) {
            if (incomingItem.attachmentUrl || item.attachmentUrl) {
              merged.attachmentUrl = incomingItem.attachmentUrl || item.attachmentUrl;
              merged.attachmentName = incomingItem.attachmentName || item.attachmentName;
            }
          }

          if (key === STORAGE_KEYS.DISCIPLINARY_REPORTS) {
            if (incomingItem.evidenceUrl || item.evidenceUrl) {
              merged.evidenceUrl = incomingItem.evidenceUrl || item.evidenceUrl;
              merged.evidenceFileName = incomingItem.evidenceFileName || item.evidenceFileName;
            }
          }

          map.set(id, merged);
        }
      }
    });

    let mergedList = Array.from(map.values());
    if (key === STORAGE_KEYS.ACTIVITY_LOGS) {
      mergedList.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      mergedList = mergedList.slice(0, 40);
    } else if (key === STORAGE_KEYS.NOTIFICATIONS) {
      mergedList.sort((a, b) => {
        const timeA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      mergedList = mergedList.slice(0, 100);
    } else if (key === STORAGE_KEYS.EMAIL_LOGS) {
      mergedList.slice(0, 20);
    } else if (key === STORAGE_KEYS.USERS) {
      // Deduplicate student records by studentId (case-insensitive) keeping the freshest
      const studentMap = new Map<string, User>();
      const nonStudentList: User[] = [];
      mergedList.forEach((u: User) => {
        if (u.role === 'STUDENT' && u.studentId) {
          const sKey = u.studentId.trim().toLowerCase();
          const existing = studentMap.get(sKey);
          if (!existing || getItemTime(u) >= getItemTime(existing)) {
            studentMap.set(sKey, u);
          }
        } else {
          nonStudentList.push(u);
        }
      });
      mergedList = [...nonStudentList, ...Array.from(studentMap.values())];
      mergedList = sanitizeUsers(mergedList);
      // Keep active session profile in sync across devices if updated
      const current = getCurrentUser();
      if (current) {
        const updatedSelf = mergedList.find((u: User) => u.id === current.id || (u.studentId && u.studentId === current.studentId));
        if (updatedSelf) {
          safeLocalStorageSet(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedSelf));
        }
      }
    }

    const isSame =
      localVal.length === mergedList.length &&
      JSON.stringify(localVal) === JSON.stringify(mergedList);

    return { mergedVal: mergedList, hasChanges: !isSame };
  }

  // If incomingVal is an array of strings (e.g., courses, wing types)
  if (Array.isArray(localVal) && Array.isArray(incomingVal) && (typeof incomingVal[0] === 'string' || typeof localVal[0] === 'string')) {
    const combinedSet = new Set([...localVal, ...incomingVal]);
    const mergedList = Array.from(combinedSet);
    const isSame = localVal.length === mergedList.length && JSON.stringify(localVal) === JSON.stringify(mergedList);
    return { mergedVal: mergedList, hasChanges: !isSame };
  }

  // Default fallback for non-array or plain objects
  return { mergedVal: incomingVal, hasChanges: true };
}

let isSeededOrHydrated = false;
let firestoreListenerUnsub: (() => void) | null = null;
const syncDebounceTimers = new Map<string, any>();

function getNextPacificMidnight(): number {
  const now = new Date();
  const utcNow = now.getTime();
  // PDT is UTC-7 during daylight saving (March to November)
  const pdtDate = new Date(utcNow - 7 * 60 * 60 * 1000);
  const nextMidnightUtc = Date.UTC(
    pdtDate.getUTCFullYear(),
    pdtDate.getUTCMonth(),
    pdtDate.getUTCDate() + 1,
    7, 0, 0, 0 // 00:00 PDT is 07:00 UTC = 15:00 Philippine Time (UTC+8)
  );
  return nextMidnightUtc;
}

export function isFirestoreQuotaAvailable(): boolean {
  return true;
}

// Clean expired quota and ensure network is enabled on initial load
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('osas_firestore_quota_until');
  } catch (_) {}
  enableNetwork(db).catch(() => {});
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason?.message || String(event?.reason || '');
    if (reason.includes('resource-exhausted') || reason.includes('Quota limit exceeded')) {
      event.preventDefault();
    }
  });
}

export function setupFirestoreSync(): void {
  if (typeof window === 'undefined') return;
  if (firestoreListenerUnsub) return;

  try {
    enableNetwork(db).catch(() => {});
    const storeRef = collection(db, 'osas_store');
    firestoreListenerUnsub = onSnapshot(
      storeRef,
      (snapshot) => {
        let changed = false;

        if (!snapshot.empty) {
          isSeededOrHydrated = true;
          snapshot.docs.forEach((docSnap) => {
            const key = docSnap.id;
            const data = docSnap.data();
            if (data && data.value !== undefined) {
              const { mergedVal, hasChanges } = mergeCollectionWithLocal(key, data.value);
              if (hasChanges) {
                if (key === STORAGE_KEYS.SCHOLARSHIP_APPS && Array.isArray(mergedVal)) {
                  safeLocalStorageSet(key, JSON.stringify(sanitizeScholarshipAppsForCache(mergedVal)));
                  memoryStorage.set(key, mergedVal);
                } else {
                  safeLocalStorageSet(key, JSON.stringify(mergedVal));
                }
                changed = true;
              }
            }
          });
        } else {
          seedInitialDataIfNeeded();
        }

        if (changed) {
          safeDispatchEvent('osas_storage_updated');
          safeDispatchEvent('osas_logo_updated');
          safeDispatchEvent('osas_notifications_updated');
        }
      },
      (error: any) => {
        console.warn('[Firestore onSnapshot Note]', error?.message || error);
      }
    );

    // Synchronize directly with individual documents in 'users' collection across all clients
    const usersCollRef = collection(db, 'users');
    onSnapshot(
      usersCollRef,
      (usersSnap) => {
        if (!usersSnap.empty) {
          const userMap = new Map<string, User>();
          usersSnap.docs.forEach((d) => {
            const u = d.data() as User;
            if (u && (u.studentId || u.email || u.id)) {
              const primaryKey = (u.studentId || u.id || u.email || '').trim().toLowerCase();
              if (primaryKey) {
                const existing = userMap.get(primaryKey);
                if (!existing || (u.updatedAt || 0) >= (existing.updatedAt || 0)) {
                  userMap.set(primaryKey, u);
                }
              }
            }
          });
          const remoteUsersList = Array.from(userMap.values());
          if (remoteUsersList.length > 0) {
            const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.USERS, remoteUsersList);
            if (hasChanges) {
              safeLocalStorageSet(STORAGE_KEYS.USERS, JSON.stringify(mergedVal));
              safeDispatchEvent('osas_storage_updated');
            }
          }
        }
      },
      (error: any) => {
        console.warn('[Firestore users onSnapshot Note]', error?.message || error);
      }
    );

    // Synchronize directly with individual documents in 'scholarship_applications' collection across all clients
    const scholarshipAppsCollRef = collection(db, 'scholarship_applications');
    onSnapshot(
      scholarshipAppsCollRef,
      (appsSnap) => {
        if (!appsSnap.empty) {
          const appMap = new Map<string, ScholarshipApplication>();
          appsSnap.docs.forEach((d) => {
            const a = d.data() as ScholarshipApplication;
            if (a && a.id) {
              appMap.set(a.id, a);
            }
          });
          const remoteAppsList = Array.from(appMap.values());
          if (remoteAppsList.length > 0) {
            const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.SCHOLARSHIP_APPS, remoteAppsList);
            if (hasChanges) {
              safeLocalStorageSet(STORAGE_KEYS.SCHOLARSHIP_APPS, JSON.stringify(sanitizeScholarshipAppsForCache(mergedVal)));
              memoryStorage.set(STORAGE_KEYS.SCHOLARSHIP_APPS, mergedVal);
              safeDispatchEvent('osas_storage_updated');
            }
          }
        }
      },
      (error: any) => {
        console.warn('[Firestore scholarship_applications onSnapshot Note]', error?.message || error);
      }
    );

    // Synchronize directly with individual documents in 'disciplinary_reports' collection across all clients
    const disciplinaryReportsCollRef = collection(db, 'disciplinary_reports');
    onSnapshot(
      disciplinaryReportsCollRef,
      (reportsSnap) => {
        if (!reportsSnap.empty) {
          const repMap = new Map<string, DisciplinaryReport>();
          reportsSnap.docs.forEach((d) => {
            const r = d.data() as DisciplinaryReport;
            if (r && r.id) {
              repMap.set(r.id, r);
            }
          });
          const remoteReportsList = Array.from(repMap.values());
          if (remoteReportsList.length > 0) {
            const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.DISCIPLINARY_REPORTS, remoteReportsList);
            if (hasChanges) {
              safeLocalStorageSet(STORAGE_KEYS.DISCIPLINARY_REPORTS, JSON.stringify(mergedVal));
              safeDispatchEvent('osas_storage_updated');
            }
          }
        }
      },
      (error: any) => {
        console.warn('[Firestore disciplinary_reports onSnapshot Note]', error?.message || error);
      }
    );

    // Synchronize directly with individual documents in 'appointments' (Student Concerns) collection across all clients
    const appointmentsCollRef = collection(db, 'appointments');
    onSnapshot(
      appointmentsCollRef,
      (appSnap) => {
        if (!appSnap.empty) {
          const appMap = new Map<string, Appointment>();
          appSnap.docs.forEach((d) => {
            const a = d.data() as Appointment;
            if (a && a.id) {
              appMap.set(a.id, a);
            }
          });
          const remoteAppsList = Array.from(appMap.values());
          if (remoteAppsList.length > 0) {
            const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.APPOINTMENTS, remoteAppsList);
            if (hasChanges) {
              safeLocalStorageSet(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(mergedVal));
              safeDispatchEvent('osas_storage_updated');
            }
          }
        }
      },
      (error: any) => {
        console.warn('[Firestore appointments onSnapshot Note]', error?.message || error);
      }
    );

    // Synchronize directly with individual documents in 'disciplinary_records' collection across all clients
    const disciplinaryRecordsCollRef = collection(db, 'disciplinary_records');
    onSnapshot(
      disciplinaryRecordsCollRef,
      (discSnap) => {
        if (!discSnap.empty) {
          const discMap = new Map<string, DisciplinaryRecord>();
          discSnap.docs.forEach((d) => {
            const rec = d.data() as DisciplinaryRecord;
            if (rec && rec.id) {
              discMap.set(rec.id, rec);
            }
          });
          const remoteDiscList = Array.from(discMap.values());
          if (remoteDiscList.length > 0) {
            const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.DISCIPLINARY, remoteDiscList);
            if (hasChanges) {
              safeLocalStorageSet(STORAGE_KEYS.DISCIPLINARY, JSON.stringify(mergedVal));
              safeDispatchEvent('osas_storage_updated');
            }
          }
        }
      },
      (error: any) => {
        console.warn('[Firestore disciplinary_records onSnapshot Note]', error?.message || error);
      }
    );

    // Synchronize directly with individual documents in 'interventions' collection across all clients
    const interventionsCollRef = collection(db, 'interventions');
    onSnapshot(
      interventionsCollRef,
      (intvSnap) => {
        if (!intvSnap.empty) {
          const intvMap = new Map<string, InterventionRecord>();
          intvSnap.docs.forEach((d) => {
            const rec = d.data() as InterventionRecord;
            if (rec && rec.id) {
              intvMap.set(rec.id, rec);
            }
          });
          const remoteIntvList = Array.from(intvMap.values());
          if (remoteIntvList.length > 0) {
            const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.INTERVENTIONS, remoteIntvList);
            if (hasChanges) {
              safeLocalStorageSet(STORAGE_KEYS.INTERVENTIONS, JSON.stringify(mergedVal));
              safeDispatchEvent('osas_storage_updated');
            }
          }
        }
      },
      (error: any) => {
        console.warn('[Firestore interventions onSnapshot Note]', error?.message || error);
      }
    );

    // Synchronize directly with individual documents in 'notifications' collection across all clients
    const notificationsCollRef = collection(db, 'notifications');
    onSnapshot(
      notificationsCollRef,
      (notifSnap) => {
        if (!notifSnap.empty) {
          const notifMap = new Map<string, SystemNotification>();
          notifSnap.docs.forEach((d) => {
            const n = d.data() as SystemNotification;
            if (n && n.id) {
              notifMap.set(n.id, n);
            }
          });
          const remoteNotifList = Array.from(notifMap.values());
          if (remoteNotifList.length > 0) {
            const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.NOTIFICATIONS, remoteNotifList);
            if (hasChanges) {
              safeLocalStorageSet(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(mergedVal));
              safeDispatchEvent('osas_storage_updated');
              safeDispatchEvent('osas_notifications_updated');
            }
          }
        }
      },
      (error: any) => {
        console.warn('[Firestore notifications onSnapshot Note]', error?.message || error);
      }
    );

    // Synchronize directly with 'dorm_applicants', 'dorm_reports', and 'feedbacks' collections across all clients
    const extraSyncCollections: Array<{ coll: string; key: string }> = [
      { coll: 'dorm_applicants', key: STORAGE_KEYS.DORM_APPLICANTS },
      { coll: 'dorm_reports', key: STORAGE_KEYS.DORM_REPORTS },
      { coll: 'feedbacks', key: STORAGE_KEYS.FEEDBACKS },
      { coll: 'safety_reports', key: STORAGE_KEYS.SAFETY_REPORTS },
      { coll: 'scholarships', key: STORAGE_KEYS.SCHOLARSHIPS },
      { coll: 'dorm_rooms', key: STORAGE_KEYS.DORM_ROOMS },
      { coll: 'announcements', key: STORAGE_KEYS.ANNOUNCEMENTS },
      { coll: 'archive', key: STORAGE_KEYS.ARCHIVE },
    ];
    extraSyncCollections.forEach(({ coll, key }) => {
      onSnapshot(
        collection(db, coll),
        (snap) => {
          if (!snap.empty) {
            const itemMap = new Map<string, any>();
            snap.docs.forEach((d) => {
              const item = d.data();
              if (item && item.id) {
                itemMap.set(String(item.id), item);
              }
            });
            const remoteList = Array.from(itemMap.values());
            if (remoteList.length > 0) {
              const { mergedVal, hasChanges } = mergeCollectionWithLocal(key, remoteList);
              if (hasChanges) {
                safeLocalStorageSet(key, JSON.stringify(mergedVal));
                safeDispatchEvent('osas_storage_updated');
              }
            }
          }
        },
        () => {}
      );
    });
  } catch (err) {
    console.warn('[setupFirestoreSync Note]', err);
  }
}

export async function syncDataToServer(key: string, value: any, immediate = true): Promise<void> {
  if (typeof window === 'undefined') return;
  lastSyncedServerTime = Date.now();

  const doSync = async () => {
    if (!navigator.onLine) {
      queueOfflineSync(key, value);
      return;
    }

    // 1. Parallel Express server sync and Firebase Firestore cloud sync
    const expressSyncPromise = (async () => {
      try {
        const res = await fetch('/api/db/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data.lastUpdated) {
              lastSyncedServerTime = data.lastUpdated;
            }
          }
        }
      } catch (err) {
        // Silent handling for Express fallback
      }
    })();

    const firestoreSyncPromise = (async () => {
      const valToSync = cleanForFirestore(value);

      // Mirror individual records into dedicated Firestore collections independently so 1MB aggregate limit never blocks per-record sync
      const dedicatedCollectionMap: Record<string, string> = {
        [STORAGE_KEYS.USERS]: 'users',
        [STORAGE_KEYS.SCHOLARSHIP_APPS]: 'scholarship_applications',
        [STORAGE_KEYS.APPOINTMENTS]: 'appointments',
        [STORAGE_KEYS.DISCIPLINARY]: 'disciplinary_records',
        [STORAGE_KEYS.DISCIPLINARY_REPORTS]: 'disciplinary_reports',
        [STORAGE_KEYS.INTERVENTIONS]: 'interventions',
        [STORAGE_KEYS.NOTIFICATIONS]: 'notifications',
        [STORAGE_KEYS.DORM_APPLICANTS]: 'dorm_applicants',
        [STORAGE_KEYS.DORM_REPORTS]: 'dorm_reports',
        [STORAGE_KEYS.FEEDBACKS]: 'feedbacks',
        [STORAGE_KEYS.SAFETY_REPORTS]: 'safety_reports',
        [STORAGE_KEYS.SCHOLARSHIPS]: 'scholarships',
        [STORAGE_KEYS.DORM_ROOMS]: 'dorm_rooms',
        [STORAGE_KEYS.ANNOUNCEMENTS]: 'announcements',
        [STORAGE_KEYS.ARCHIVE]: 'archive',
      };
      const dedicatedColl = dedicatedCollectionMap[key];
      const dedicatedWritePromise = (async () => {
        if (dedicatedColl && Array.isArray(valToSync)) {
          await Promise.allSettled(
            valToSync
              .filter((item: any) => item && (item.id || item.studentId || item.email))
              .map((item: any) => {
                const docId = String(item.id || item.studentId || item.email);
                return setDoc(doc(db, dedicatedColl, docId), cleanForFirestore(item), { merge: true });
              })
          );
        }
      })();

      const storeWritePromise = (async () => {
        try {
          const docRef = doc(db, 'osas_store', key);
          const storeVal =
            key === STORAGE_KEYS.SCHOLARSHIP_APPS && Array.isArray(value)
              ? cleanForFirestore(sanitizeScholarshipAppsForCache(value))
              : valToSync;
          await setDoc(docRef, { value: storeVal, updatedAt: Date.now() });
        } catch (storeErr: any) {
          // If aggregate document exceeds Firestore 1MB limit, write a lightweight summary array without heavy base64 strings
          if (Array.isArray(value)) {
            try {
              const docRef = doc(db, 'osas_store', key);
              const lightVal = cleanForFirestore(
                value.map((item: any) => {
                  if (!item || typeof item !== 'object') return item;
                  const copy = { ...item };
                  if (typeof copy.evidenceUrl === 'string' && copy.evidenceUrl.length > 50000) delete copy.evidenceUrl;
                  if (typeof copy.attachmentUrl === 'string' && copy.attachmentUrl.length > 50000) delete copy.attachmentUrl;
                  if (typeof copy.imageUrl === 'string' && copy.imageUrl.length > 50000) delete copy.imageUrl;
                  return copy;
                })
              );
              await setDoc(docRef, { value: lightVal, updatedAt: Date.now() });
            } catch (_) {}
          }
          console.warn(`[Firestore Cloud Sync Note for ${key}]`, storeErr?.message || storeErr);
        }
      })();

      await Promise.allSettled([dedicatedWritePromise, storeWritePromise]);
    })();

    await Promise.allSettled([expressSyncPromise, firestoreSyncPromise]);
  };

  if (immediate) {
    if (syncDebounceTimers.has(key)) {
      clearTimeout(syncDebounceTimers.get(key));
      syncDebounceTimers.delete(key);
    }
    await doSync();
    return;
  }

  // Debounce syncing per key to avoid write bursts
  if (syncDebounceTimers.has(key)) {
    clearTimeout(syncDebounceTimers.get(key));
  }

  syncDebounceTimers.set(
    key,
    setTimeout(async () => {
      syncDebounceTimers.delete(key);
      await doSync();
    }, 300)
  );
}

export async function flushOfflineQueue(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  try {
    const rawQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!rawQueue) return;
    const queue = JSON.parse(rawQueue);
    if (!Array.isArray(queue) || queue.length === 0) return;

    for (const item of queue) {
      await fetch('/api/db/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: item.key, value: item.value }),
      }).catch(() => {});
    }

    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    fetchServerState();
  } catch (err) {
    console.warn('Error flushing offline queue:', err);
  }
}

export async function fetchServerState(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  try {
    const res = await fetch('/api/db');
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = await res.json();
        if (payload.data && typeof payload.data === 'object' && Object.keys(payload.data).length > 0) {
          let changed = false;
          Object.keys(payload.data).forEach((k) => {
            const serverVal = payload.data[k];
            if (serverVal !== undefined && serverVal !== null) {
              const { mergedVal, hasChanges } = mergeCollectionWithLocal(k, serverVal);
              if (hasChanges) {
                safeLocalStorageSet(k, JSON.stringify(mergedVal));
                changed = true;
              }
            }
          });

          if (payload.lastUpdated) {
            lastSyncedServerTime = Math.max(lastSyncedServerTime, payload.lastUpdated);
          }

          if (changed) {
            safeDispatchEvent('osas_storage_updated');
          }
        }
      }
    }
  } catch (err) {
    // Offline or static mode active
  }

  // Authoritative cloud fetch for scholarship applications across all devices
  try {
    const appsSnap = await getDocs(collection(db, 'scholarship_applications'));
    if (!appsSnap.empty) {
      const appMap = new Map<string, ScholarshipApplication>();
      appsSnap.docs.forEach((d) => {
        const a = d.data() as ScholarshipApplication;
        if (a && a.id) appMap.set(a.id, a);
      });
      const remoteApps = Array.from(appMap.values());
      if (remoteApps.length > 0) {
        const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.SCHOLARSHIP_APPS, remoteApps);
        if (hasChanges) {
          safeLocalStorageSet(STORAGE_KEYS.SCHOLARSHIP_APPS, JSON.stringify(sanitizeScholarshipAppsForCache(mergedVal)));
          memoryStorage.set(STORAGE_KEYS.SCHOLARSHIP_APPS, mergedVal);
          safeDispatchEvent('osas_storage_updated');
        }
      }
    }
  } catch (fsErr) {
    // Handled silently
  }

  // Authoritative cloud fetch for osas_store across all devices
  try {
    const storeSnap = await getDocs(collection(db, 'osas_store'));
    if (!storeSnap.empty) {
      let storeChanged = false;
      storeSnap.docs.forEach((docSnap) => {
        const key = docSnap.id;
        const data = docSnap.data();
        if (data && data.value !== undefined) {
          const { mergedVal, hasChanges } = mergeCollectionWithLocal(key, data.value);
          if (hasChanges) {
            if (key === STORAGE_KEYS.SCHOLARSHIP_APPS && Array.isArray(mergedVal)) {
              safeLocalStorageSet(key, JSON.stringify(sanitizeScholarshipAppsForCache(mergedVal)));
              memoryStorage.set(key, mergedVal);
            } else {
              safeLocalStorageSet(key, JSON.stringify(mergedVal));
            }
            storeChanged = true;
          }
        }
      });
      if (storeChanged) {
        safeDispatchEvent('osas_storage_updated');
      }
    }
  } catch (_) {}

  // Authoritative cloud fetch for student disciplinary reports across all devices
  try {
    const reportsSnap = await getDocs(collection(db, 'disciplinary_reports'));
    if (!reportsSnap.empty) {
      const repMap = new Map<string, DisciplinaryReport>();
      reportsSnap.docs.forEach((d) => {
        const r = d.data() as DisciplinaryReport;
        if (r && r.id) repMap.set(r.id, r);
      });
      const remoteReports = Array.from(repMap.values());
      if (remoteReports.length > 0) {
        const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.DISCIPLINARY_REPORTS, remoteReports);
        if (hasChanges) {
          safeLocalStorageSet(STORAGE_KEYS.DISCIPLINARY_REPORTS, JSON.stringify(mergedVal));
          safeDispatchEvent('osas_storage_updated');
        }
      }
    }
  } catch (fsErr) {
    // Handled silently
  }

  // Authoritative cloud fetch for student concerns (appointments) across all devices
  try {
    const appSnap = await getDocs(collection(db, 'appointments'));
    if (!appSnap.empty) {
      const appMap = new Map<string, Appointment>();
      appSnap.docs.forEach((d) => {
        const a = d.data() as Appointment;
        if (a && a.id) appMap.set(a.id, a);
      });
      const remoteApps = Array.from(appMap.values());
      if (remoteApps.length > 0) {
        const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.APPOINTMENTS, remoteApps);
        if (hasChanges) {
          safeLocalStorageSet(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(mergedVal));
          safeDispatchEvent('osas_storage_updated');
        }
      }
    }
  } catch (_) {}

  // Authoritative cloud fetch for disciplinary records across all devices
  try {
    const discSnap = await getDocs(collection(db, 'disciplinary_records'));
    if (!discSnap.empty) {
      const discMap = new Map<string, DisciplinaryRecord>();
      discSnap.docs.forEach((d) => {
        const rec = d.data() as DisciplinaryRecord;
        if (rec && rec.id) discMap.set(rec.id, rec);
      });
      const remoteDisc = Array.from(discMap.values());
      if (remoteDisc.length > 0) {
        const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.DISCIPLINARY, remoteDisc);
        if (hasChanges) {
          safeLocalStorageSet(STORAGE_KEYS.DISCIPLINARY, JSON.stringify(mergedVal));
          safeDispatchEvent('osas_storage_updated');
        }
      }
    }
  } catch (_) {}

  // Authoritative cloud fetch for intervention records across all devices
  try {
    const intvSnap = await getDocs(collection(db, 'interventions'));
    if (!intvSnap.empty) {
      const intvMap = new Map<string, InterventionRecord>();
      intvSnap.docs.forEach((d) => {
        const rec = d.data() as InterventionRecord;
        if (rec && rec.id) intvMap.set(rec.id, rec);
      });
      const remoteIntv = Array.from(intvMap.values());
      if (remoteIntv.length > 0) {
        const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.INTERVENTIONS, remoteIntv);
        if (hasChanges) {
          safeLocalStorageSet(STORAGE_KEYS.INTERVENTIONS, JSON.stringify(mergedVal));
          safeDispatchEvent('osas_storage_updated');
        }
      }
    }
  } catch (_) {}

  // Authoritative cloud fetch for dorm_applicants, dorm_reports, feedbacks, safety_reports, scholarships, dorm_rooms, announcements, archive
  const extraHydrateCollections: Array<{ coll: string; key: string }> = [
    { coll: 'dorm_applicants', key: STORAGE_KEYS.DORM_APPLICANTS },
    { coll: 'dorm_reports', key: STORAGE_KEYS.DORM_REPORTS },
    { coll: 'feedbacks', key: STORAGE_KEYS.FEEDBACKS },
    { coll: 'safety_reports', key: STORAGE_KEYS.SAFETY_REPORTS },
    { coll: 'scholarships', key: STORAGE_KEYS.SCHOLARSHIPS },
    { coll: 'dorm_rooms', key: STORAGE_KEYS.DORM_ROOMS },
    { coll: 'announcements', key: STORAGE_KEYS.ANNOUNCEMENTS },
    { coll: 'archive', key: STORAGE_KEYS.ARCHIVE },
  ];
  await Promise.allSettled(
    extraHydrateCollections.map(async ({ coll, key }) => {
      try {
        const snap = await getDocs(collection(db, coll));
        if (!snap.empty) {
          const itemMap = new Map<string, any>();
          snap.docs.forEach((d) => {
            const item = d.data();
            if (item && item.id) itemMap.set(String(item.id), item);
          });
          const remoteList = Array.from(itemMap.values());
          if (remoteList.length > 0) {
            const { mergedVal, hasChanges } = mergeCollectionWithLocal(key, remoteList);
            if (hasChanges) {
              safeLocalStorageSet(key, JSON.stringify(mergedVal));
              safeDispatchEvent('osas_storage_updated');
            }
          }
        }
      } catch (_) {}
    })
  );
}

export async function pollServerUpdates(): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  try {
    const res = await fetch(`/api/db/poll?since=${lastSyncedServerTime}`);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = await res.json();
        if (payload.updated && payload.data && typeof payload.data === 'object' && Object.keys(payload.data).length > 0) {
          let changed = false;
          Object.keys(payload.data).forEach((k) => {
            const serverVal = payload.data[k];
            if (serverVal !== undefined && serverVal !== null) {
              const { mergedVal, hasChanges } = mergeCollectionWithLocal(k, serverVal);
              if (hasChanges) {
                safeLocalStorageSet(k, JSON.stringify(mergedVal));
                changed = true;
              }
            }
          });

          if (payload.lastUpdated) {
            lastSyncedServerTime = payload.lastUpdated;
          }

          if (changed) {
            safeDispatchEvent('osas_storage_updated');
          }
        }
      }
    }
  } catch (err) {
    // Silent handling when offline or on static hosting
  }
}

// Global Network Status Events and Real-time Timer Initialization
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    safeDispatchEvent('osas_network_status_change');
    flushOfflineQueue();
  });
  window.addEventListener('offline', () => {
    safeDispatchEvent('osas_network_status_change');
  });

  // Cross-tab Instant Sync
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('osas_')) {
      safeDispatchEvent('osas_storage_updated');
    }
  });

  // Initial Sync & Start Polling Loop
  setupFirestoreSync();
  fetchServerState().then(() => flushOfflineQueue());
  setInterval(() => {
    pollServerUpdates();
  }, 1000);

  // Fast trigger on tab focus / visibility
  window.addEventListener('focus', () => {
    pollServerUpdates();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pollServerUpdates();
    }
  });
}

// Helper to save to storage safely with quota error fallback and server sync
export function setStoredData<T>(key: string, value: T, immediate = true): void {
  let targetVal: any = value;
  if (key === STORAGE_KEYS.USERS && Array.isArray(value)) {
    targetVal = sanitizeUsers(value);
  } else if (key === STORAGE_KEYS.CURRENT_USER && value && typeof (value as any).avatarUrl === 'string') {
    const cur = value as any;
    if (cur.avatarUrl.length > 50000) {
      targetVal = {
        ...cur,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cur.fullName || 'user')}`,
      };
    }
  } else if (key === STORAGE_KEYS.ACTIVITY_LOGS && Array.isArray(value)) {
    targetVal = value.slice(0, 40);
  } else if (key === STORAGE_KEYS.NOTIFICATIONS && Array.isArray(value)) {
    targetVal = value.slice(0, 100);
  } else if (key === STORAGE_KEYS.EMAIL_LOGS && Array.isArray(value)) {
    targetVal = value.slice(0, 20);
  } else if (key === STORAGE_KEYS.SCHOLARSHIP_APPS && Array.isArray(value)) {
    targetVal = sanitizeScholarshipAppsForCache(value);
  }

  const success = safeLocalStorageSet(key, JSON.stringify(targetVal));
  if (key === STORAGE_KEYS.SCHOLARSHIP_APPS && Array.isArray(value)) {
    // Keep full attachments in memoryStorage after safeLocalStorageSet so they are never overwritten by sanitized cache
    memoryStorage.set(key, value);
  }
  if (success) {
    safeDispatchEvent('osas_storage_updated');
  }

  // Push updates to Centralized Database server & Offline Queue (except per-device session user)
  if (key !== STORAGE_KEYS.CURRENT_USER) {
    syncDataToServer(key, key === STORAGE_KEYS.SCHOLARSHIP_APPS ? value : targetVal, immediate);
  }
}

// Perform complete data reset to zero old records while keeping app schema and admin accounts
export async function performCompleteDataReset(): Promise<void> {
  if (typeof window === 'undefined') return;

  Object.values(STORAGE_KEYS).forEach((key) => {
    if (key !== STORAGE_KEYS.CURRENT_USER && key !== STORAGE_KEYS.SYSTEM_LOGO) {
      localStorage.removeItem(key);
      memoryStorage.delete(key);
    }
  });
  localStorage.removeItem(OFFLINE_QUEUE_KEY);

  safeLocalStorageSet(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
  safeLocalStorageSet(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.SAFETY_REPORTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.SCHOLARSHIPS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.SCHOLARSHIP_APPS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.APPOINTMENTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DISCIPLINARY, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DISCIPLINARY_REPORTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.INTERVENTIONS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DORM_ROOMS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DORM_APPLICANTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DORM_REPORTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.FEEDBACKS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.ARCHIVE, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.PURGED_IDS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.RESTORED_IDS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.TRANSACTION_RATINGS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.OSAS_EVALUATIONS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.EMAIL_LOGS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.PASSWORD_RESET_OTPS, JSON.stringify([]));

  try {
    await fetch('/api/db/reset', { method: 'POST' });
  } catch (e) {
    // ignore
  }

  try {
    const keysToReset = Object.values(STORAGE_KEYS);
    for (const key of keysToReset) {
      if (key === STORAGE_KEYS.CURRENT_USER) {
        await deleteDoc(doc(db, 'osas_store', key)).catch(() => {});
      } else if (key !== STORAGE_KEYS.SYSTEM_LOGO && key !== STORAGE_KEYS.COURSES && key !== STORAGE_KEYS.WING_TYPES) {
        const docRef = doc(db, 'osas_store', key);
        let val: any = [];
        if (key === STORAGE_KEYS.USERS) val = initialUsers;
        await setDoc(docRef, { value: cleanForFirestore(val), updatedAt: Date.now() });
      }
    }

    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs) {
      if (d.id !== 'admin-1' && d.id !== 'guidance-admin-1') {
        await deleteDoc(d.ref).catch(() => {});
      }
    }
    for (const admin of initialUsers) {
      await setDoc(doc(db, 'users', admin.id), { ...cleanForFirestore(admin), uid: admin.id, updatedAt: Date.now() });
    }

    const collectionsToClear = [
      'scholarship_applications',
      'scholarship_apps',
      'disciplinary_reports',
      'appointments',
      'disciplinary_records',
      'interventions',
      'password_reset_otps',
      'dorm_reports',
      'announcements',
      'safety_reports',
      'scholarships',
      'disciplinary',
      'feedbacks',
      'notifications',
      'dorm_rooms',
      'dorm_applicants',
      'activity_logs',
      'archive',
    ];
    for (const collName of collectionsToClear) {
      const snap = await getDocs(collection(db, collName));
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
    }
  } catch (fsErr) {
    // ignore
  }

  // Re-apply clean local state after cloud & server reset completes in case any onSnapshot fired mid-reset
  Object.values(STORAGE_KEYS).forEach((key) => {
    if (key !== STORAGE_KEYS.CURRENT_USER && key !== STORAGE_KEYS.SYSTEM_LOGO) {
      localStorage.removeItem(key);
      memoryStorage.delete(key);
    }
  });
  safeLocalStorageSet(STORAGE_KEYS.USERS, JSON.stringify(initialUsers));
  memoryStorage.set(STORAGE_KEYS.USERS, initialUsers);
  safeLocalStorageSet(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.SAFETY_REPORTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.SCHOLARSHIPS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.SCHOLARSHIP_APPS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.APPOINTMENTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DISCIPLINARY, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DISCIPLINARY_REPORTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.INTERVENTIONS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DORM_ROOMS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DORM_APPLICANTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.DORM_REPORTS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.FEEDBACKS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.ARCHIVE, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.PURGED_IDS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.RESTORED_IDS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.TRANSACTION_RATINGS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.OSAS_EVALUATIONS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.EMAIL_LOGS, JSON.stringify([]));
  safeLocalStorageSet(STORAGE_KEYS.PASSWORD_RESET_OTPS, JSON.stringify([]));

  safeDispatchEvent('osas_storage_updated');
  safeDispatchEvent('osas_notifications_updated');
}

if (typeof window !== 'undefined') {
  (window as any).__performCompleteDataReset = performCompleteDataReset;
}

// Initialize default admin accounts if local storage has no users at all
export function seedInitialDataIfNeeded(): void {
  if (isSeededOrHydrated) return;
  isSeededOrHydrated = true;

  const currentUsers = getStoredData<User[]>(STORAGE_KEYS.USERS, []);
  if (currentUsers.length === 0) {
    setStoredData(STORAGE_KEYS.USERS, initialUsers, false);
  }
}

export function initStorageEngine(): void {
  seedInitialDataIfNeeded();
  setupFirestoreSync();
}

// Call initialization
initStorageEngine();

// --- SUCCESS TRANSACTION MODAL TRIGGER ---
export function triggerSuccessTransaction(message: string, subMessage?: string): void {
  safeDispatchEvent('osas_success_transaction', { message, subMessage });
}

// --- SYSTEM LOGO API ---
export function getSystemLogo(): string {
  const logo = getStoredData<string>(STORAGE_KEYS.SYSTEM_LOGO, '/dcc_logo.svg');
  return logo && logo.trim() ? logo : '/dcc_logo.svg';
}

export function setSystemLogo(logoUrl: string): void {
  setStoredData(STORAGE_KEYS.SYSTEM_LOGO, logoUrl);
  safeDispatchEvent('osas_logo_updated');
  triggerSuccessTransaction('System Logo Updated', 'The system logo has been successfully updated across OSAS.');
}

// --- COURSES API ---
export function getCourses(): string[] {
  return getStoredData<string[]>(STORAGE_KEYS.COURSES, ['BS ENTREPRENEURSHIP']);
}

export function addCourse(courseName: string, adminName?: string): string[] {
  const courses = getCourses();
  const trimmed = courseName.trim().toUpperCase();
  if (trimmed && !courses.includes(trimmed)) {
    const updated = [...courses, trimmed];
    setStoredData(STORAGE_KEYS.COURSES, updated);
    triggerSuccessTransaction('Course Added', `The academic program "${trimmed}" has been added.`);
    if (adminName) {
      logActivity('Add Course', 'System Settings', adminName, `Added course "${trimmed}".`);
    }
    return updated;
  }
  return courses;
}

export function deleteCourse(courseName: string, adminName?: string): string[] {
  const courses = getCourses();
  const updated = courses.filter((c) => c !== courseName);
  setStoredData(STORAGE_KEYS.COURSES, updated);
  triggerSuccessTransaction('Course Removed', `The program "${courseName}" has been deleted.`);
  if (adminName) {
    logActivity('Delete Course', 'System Settings', adminName, `Deleted course "${courseName}".`);
  }
  return updated;
}

// --- WING TYPES API ---
export function getWingTypes(): string[] {
  return ['Male Wing', 'Female Wing'];
}

export function addWingType(wingName: string): string[] {
  const wings = getWingTypes();
  const trimmed = wingName.trim();
  if (trimmed && !wings.includes(trimmed)) {
    const updated = [...wings, trimmed];
    setStoredData(STORAGE_KEYS.WING_TYPES, updated);
    triggerSuccessTransaction('Wing Type Added', `The dormitory wing "${trimmed}" has been added.`);
    return updated;
  }
  return wings;
}

export function deleteWingType(wingName: string): string[] {
  const wings = getWingTypes();
  const updated = wings.filter((w) => w !== wingName);
  setStoredData(STORAGE_KEYS.WING_TYPES, updated);
  triggerSuccessTransaction('Wing Type Removed', `The wing type "${wingName}" has been removed.`);
  return updated;
}

// --- DORM REPORTS API ---
export const DORM_REPORT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 Week Expiration

export function checkAndArchiveExpiredDormReports(): void {
  const list = getStoredData<DormReport[]>(STORAGE_KEYS.DORM_REPORTS, []);
  const now = Date.now();
  let hasExpired = false;
  const activeList: DormReport[] = [];

  list.forEach((rep) => {
    if (rep.status === 'COMPLETED' && rep.completedAt && !rep.isArchived) {
      const completedTime = new Date(rep.completedAt).getTime();
      if (!isNaN(completedTime) && now - completedTime >= DORM_REPORT_EXPIRATION_MS) {
        archiveItem(
          'DORM_REPORT',
          rep.id,
          `Expired Resolved Dorm Report - ${rep.studentName} (${rep.roomNumber}) [${rep.issueType}]`,
          { ...rep, isArchived: true, expiredAt: new Date().toISOString() },
          'System Auto-Expire (1 Week Policy)'
        );
        hasExpired = true;
        return;
      }
    }
    activeList.push(rep);
  });

  if (hasExpired) {
    setStoredData(STORAGE_KEYS.DORM_REPORTS, activeList);
  }
}

export function getDormReports(_role?: 'ADMIN' | 'STUDENT'): DormReport[] {
  checkAndArchiveExpiredDormReports();
  const reports = getStoredData<DormReport[]>(STORAGE_KEYS.DORM_REPORTS, []);

  const now = Date.now();

  return reports.filter((r) => {
    if (r.isArchived) return false;
    if (r.status === 'COMPLETED' && r.completedAt) {
      const completedTime = new Date(r.completedAt).getTime();
      if (!isNaN(completedTime) && now - completedTime >= DORM_REPORT_EXPIRATION_MS) {
        return false;
      }
    }
    return true;
  });
}

export function submitDormReport(
  student: User,
  roomNumber: string,
  issueType: DormReportIssueType,
  description: string
): DormReport {
  const reports = getDormReports();
  const newReport: DormReport = {
    id: `dr-${Date.now()}`,
    studentId: student.studentId || student.id,
    studentName: student.fullName,
    roomNumber,
    issueType,
    description,
    reportedAt: new Date().toISOString(),
    status: 'PENDING',
    adminMarkedDone: false,
    studentMarkedDone: false,
  };

  setStoredData(STORAGE_KEYS.DORM_REPORTS, [newReport, ...reports], true);
  try {
    setDoc(doc(db, 'dorm_reports', newReport.id), cleanForFirestore(newReport), { merge: true }).catch(() => {});
  } catch (_) {}
  sendNotification('ADMIN', 'New Dorm Report Submitted', `${student.fullName} (${roomNumber}): ${issueType}`, 'DORM');
  triggerSuccessTransaction('Dorm Report Submitted', 'Your dormitory report has been filed with OSAS administration.');
  logActivity('Dorm Report Submitted', 'Dormitory', student.fullName, `Reported dorm issue: ${issueType} in ${roomNumber}.`);

  // Dispatch email notification to Admin & confirmation to Student
  sendDormReportAlertEmail(newReport, student.email).catch((err) =>
    console.warn('[Dorm Report Email] Error:', err)
  );

  return newReport;
}

export function toggleDormReportMarkDone(reportId: string, role: 'ADMIN' | 'STUDENT', actorName: string): void {
  const reports = getStoredData<DormReport[]>(STORAGE_KEYS.DORM_REPORTS, []);
  let targetStudentId = '';
  let isCompleted = false;
  let finishedReport: DormReport | null = null;

  const updated = reports.map((r) => {
    if (r.id === reportId) {
      targetStudentId = r.studentId;
      // One-party process: when OSAS Admin marks done, automatically COMPLETED on student side
      if (role === 'ADMIN') {
        const nextDone = !r.adminMarkedDone;
        isCompleted = nextDone;
        const newStatus: DormReportStatus = nextDone ? 'COMPLETED' : 'PENDING';

        const res = {
          ...r,
          adminMarkedDone: nextDone,
          studentMarkedDone: nextDone,
          status: newStatus,
          completedAt: nextDone ? (r.completedAt || new Date().toISOString()) : undefined,
        };
        if (nextDone) {
          finishedReport = res;
        }
        return res;
      } else {
        const studentDone = !r.studentMarkedDone;
        isCompleted = studentDone;
        const newStatus: DormReportStatus = studentDone ? 'COMPLETED' : 'PENDING';

        const res = {
          ...r,
          adminMarkedDone: studentDone,
          studentMarkedDone: studentDone,
          status: newStatus,
          completedAt: studentDone ? (r.completedAt || new Date().toISOString()) : undefined,
        };
        if (studentDone) {
          finishedReport = res;
        }
        return res;
      }
    }
    return r;
  });

  setStoredData(STORAGE_KEYS.DORM_REPORTS, updated);

  if (targetStudentId) {
    if (isCompleted) {
      sendNotification(
        targetStudentId,
        `Dorm Maintenance Issue Resolved!`,
        `OSAS Admin marked your dorm maintenance report as resolved and completed.`,
        'DORM',
        'dormitory'
      );
      sendNotification(
        'ADMIN',
        `Dorm Maintenance Issue Resolved!`,
        `Dorm report ${reportId} for Student ID ${targetStudentId} is now resolved.`,
        'DORM',
        'dormitory'
      );

      const users = getUsers();
      const studentUser = users.find((u) => u.studentId === targetStudentId || u.id === targetStudentId);
      if (studentUser && studentUser.id !== targetStudentId) {
        sendNotification(
          studentUser.id,
          `Dorm Maintenance Issue Resolved!`,
          `OSAS Admin marked your dorm maintenance report as resolved and completed.`,
          'DORM',
          'dormitory'
        );
      }

      // Dispatch resolution email to student
      if (finishedReport) {
        if (studentUser?.email) {
          sendDormReportCompletedEmail(finishedReport, studentUser.email).catch((err) =>
            console.warn('[Dorm Report Completed Email] Error:', err)
          );
        }
      }
    } else if (role === 'ADMIN') {
      sendNotification(targetStudentId, `Dorm Report Updated by OSAS Admin`, `Admin ${actorName} updated dorm report status.`, 'DORM', 'dormitory');
    } else {
      sendNotification('ADMIN', `Dorm Report Updated by Student`, `Student ${actorName} updated dorm report status.`, 'DORM', 'dormitory');
    }
  }

  triggerSuccessTransaction('Dorm Report Updated', `${actorName} marked the dorm report as ${isCompleted ? 'Completed' : 'Pending'}.`);
  logActivity('Update Dorm Report', 'Dormitory', actorName, `Updated dorm report ${reportId} status to ${isCompleted ? 'COMPLETED' : 'PENDING'}.`);
}

// --- LOGGING & NOTIFICATIONS API ---
export function logActivity(action: string, module: string, performedBy: string, details: string): void {
  const logs = getStoredData<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
  const newLog: ActivityLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    action,
    module,
    performedBy,
    details,
    timestamp: new Date().toISOString(),
  };
  setStoredData(STORAGE_KEYS.ACTIVITY_LOGS, [newLog, ...logs].slice(0, 40));
}

export function triggerSimulatedEmail(toEmail: string, subject: string, body: string): void {
  sendEmail({
    to: toEmail,
    subject,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f766e; margin-top: 0;">OSAS Notification</h2>
      <p style="white-space: pre-line; font-size: 15px;">${body}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Office of Student Affairs and Services (OSAS) • Official System Communication</p>
    </div>`,
    text: body,
  }).catch((err) => console.warn('[triggerSimulatedEmail] Error:', err));
}

export function sendNotification(
  userId: string,
  title: string,
  message: string,
  type: SystemNotification['type'],
  linkModule?: string,
  category?: AnnouncementCategory,
  announcementId?: string,
  slipNotice?: SlipNotice
): void {
  const isSlip = type === 'SLIP_NOTICE' || Boolean(slipNotice);
  let resolvedTargetUserId = (userId || '').trim();

  if (isSlip) {
    const upperTarget = resolvedTargetUserId.toUpperCase();
    const isBroadcastToken =
      !resolvedTargetUserId ||
      upperTarget === 'ALL' ||
      upperTarget === 'ALL_USERS' ||
      upperTarget === 'STUDENT' ||
      upperTarget === 'ALL_STUDENTS';

    if (isBroadcastToken) {
      const exactId = (slipNotice?.studentId || '').trim();
      const exactName = (slipNotice?.studentName || '').trim();
      if (exactId && exactId.toUpperCase() !== 'N/A') {
        resolvedTargetUserId = exactId;
      } else if (exactName) {
        resolvedTargetUserId = `STUDENT_EXACT:${exactName.toLowerCase()}`;
      } else {
        // Never allow an untargeted or broadcast slip-notice notification
        return;
      }
    }
  }

  const notifs = getStoredData<SystemNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const now = Date.now();
  const newNotif: SystemNotification = {
    id: `notif-${now}-${Math.floor(Math.random() * 1000)}`,
    userId: resolvedTargetUserId,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date(now).toISOString(),
    timestamp: now,
    linkModule,
    category,
    announcementId,
    slipNotice,
  };
  const updated = [newNotif, ...notifs];
  setStoredData(STORAGE_KEYS.NOTIFICATIONS, updated, true);
  try {
    setDoc(doc(db, 'notifications', newNotif.id), cleanForFirestore(newNotif), { merge: true }).catch(() => {});
  } catch (_) {}
  safeDispatchEvent('osas_notifications_updated');
}

export function addNotification(params: { userId: string; title: string; message: string; type: SystemNotification['type']; linkModule?: string }): void {
  sendNotification(params.userId, params.title, params.message, params.type, params.linkModule);
}

function doesNotificationMatchUser(
  n: SystemNotification,
  userId: string,
  role: string,
  userFullName?: string,
  altUserId?: string
): boolean {
  if (!n) return false;

  const rawPassedId = (userId || '').trim().toLowerCase();
  let normStudentId = rawPassedId;
  let normAltId = (altUserId || '').trim().toLowerCase();
  let normFullName = (userFullName || '').trim().toLowerCase();

  if (role === 'STUDENT' && (!normFullName || !normAltId)) {
    const activeUser = getCurrentUser();
    if (
      activeUser &&
      activeUser.role === 'STUDENT' &&
      ((activeUser.studentId && activeUser.studentId.trim().toLowerCase() === rawPassedId) ||
        (activeUser.id && activeUser.id.trim().toLowerCase() === rawPassedId))
    ) {
      if (activeUser.studentId) normStudentId = activeUser.studentId.trim().toLowerCase();
      if (activeUser.id) normAltId = activeUser.id.trim().toLowerCase();
      if (!normFullName && activeUser.fullName) normFullName = activeUser.fullName.trim().toLowerCase();
    } else {
      const matchedStudent = getUsers().find(
        (u) =>
          u.role === 'STUDENT' &&
          ((u.studentId && u.studentId.trim().toLowerCase() === rawPassedId) ||
            (u.id && u.id.trim().toLowerCase() === rawPassedId))
      );
      if (matchedStudent) {
        if (matchedStudent.studentId) normStudentId = matchedStudent.studentId.trim().toLowerCase();
        if (matchedStudent.id) normAltId = matchedStudent.id.trim().toLowerCase();
        if (!normFullName && matchedStudent.fullName) normFullName = matchedStudent.fullName.trim().toLowerCase();
      }
    }
  }

  const isSlipNotice = n.type === 'SLIP_NOTICE' || Boolean(n.slipNotice);
  const notifTargetRaw = (n.userId || '').trim();
  const notifTargetUpper = notifTargetRaw.toUpperCase();
  const notifTargetLower = notifTargetRaw.toLowerCase();

  if (isSlipNotice) {
    // Slip notice notifications are strictly for the exact student recipient only
    if (role !== 'STUDENT') return false;
    if (!n.slipNotice) return false;

    const slipSid = (n.slipNotice.studentId || '').trim().toLowerCase();
    const slipSname = (n.slipNotice.studentName || '').trim().toLowerCase();
    const hasValidSlipSid = Boolean(slipSid && slipSid !== 'n/a');

    // 1. If the slip notice carries a studentId, it MUST match this student's studentId or id
    if (hasValidSlipSid) {
      const idMatches =
        (Boolean(normStudentId) && slipSid === normStudentId) ||
        (Boolean(normAltId) && slipSid === normAltId) ||
        (Boolean(rawPassedId) && slipSid === rawPassedId);
      return idMatches;
    }

    // 2. If n.userId is a specific non-broadcast ID (and not a name prefix), check exact ID match
    const isBroadcast =
      notifTargetUpper === 'ALL' ||
      notifTargetUpper === 'ALL_USERS' ||
      notifTargetUpper === 'STUDENT' ||
      notifTargetUpper === 'ALL_STUDENTS';

    if (!isBroadcast && notifTargetLower && !notifTargetLower.startsWith('student_exact:')) {
      const targetMatchesId =
        (Boolean(normStudentId) && notifTargetLower === normStudentId) ||
        (Boolean(normAltId) && notifTargetLower === normAltId) ||
        (Boolean(rawPassedId) && notifTargetLower === rawPassedId);
      if (targetMatchesId) return true;
      // If n.userId was set to another student's ID, never show it to this student
      return false;
    }

    if (notifTargetLower.startsWith('student_exact:')) {
      const expectedName = notifTargetLower.slice('student_exact:'.length).trim();
      return Boolean(normFullName && expectedName && normFullName === expectedName);
    }

    // 3. Only if no studentId was recorded on the slip and n.userId wasn't another student's ID, require exact fullName match
    if (!isBroadcast && normFullName && slipSname && normFullName === slipSname) {
      return true;
    }

    return false;
  }

  // Standard (non-slip-notice) notification matching
  if (notifTargetUpper === 'ALL' || notifTargetUpper === 'ALL_USERS') return true;
  if (
    (Boolean(rawPassedId) && notifTargetLower === rawPassedId) ||
    (Boolean(normStudentId) && notifTargetLower === normStudentId) ||
    (Boolean(normAltId) && notifTargetLower === normAltId)
  ) {
    return true;
  }
  if (role === 'ADMIN' && (notifTargetUpper === 'ADMIN' || notifTargetUpper === 'OSAS_ADMIN' || notifTargetUpper === 'ALL_ADMINS')) return true;
  if (role === 'GUIDANCE_ADMIN' && (notifTargetUpper === 'GUIDANCE_ADMIN' || notifTargetUpper === 'GUIDANCE' || notifTargetUpper === 'ALL_ADMINS')) return true;
  if (role === 'STUDENT' && (notifTargetUpper === 'STUDENT' || notifTargetUpper === 'ALL_STUDENTS')) return true;
  return false;
}

export function getNotifications(
  userId: string,
  role: string,
  userFullName?: string,
  altUserId?: string
): SystemNotification[] {
  const notifs = getStoredData<SystemNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const now = Date.now();
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days expiration window

  // 1. Expiration & integrity policy: Prune notifications that are read AND older than 1 month (30 days),
  // or corrupt broadcast/empty SLIP_NOTICE entries
  let hasPruned = false;
  const validNotifs = notifs.filter((n) => {
    if (!n) {
      hasPruned = true;
      return false;
    }
    const isSlip = n.type === 'SLIP_NOTICE' || Boolean(n.slipNotice);
    const upperUid = String(n.userId || '').trim().toUpperCase();
    if (
      isSlip &&
      (!n.slipNotice ||
        upperUid === 'ALL' ||
        upperUid === 'ALL_USERS' ||
        upperUid === 'STUDENT' ||
        upperUid === 'ALL_STUDENTS')
    ) {
      hasPruned = true;
      if (n.id) {
        try {
          deleteDoc(doc(db, 'notifications', n.id)).catch(() => {});
        } catch (_) {}
      }
      return false;
    }

    const isGuidanceSlipNotif =
      isSlip &&
      !(n.title || '').toLowerCase().includes('osas') &&
      !(n.slipNotice?.counselorTitle || '').toLowerCase().includes('osas') &&
      !(n.slipNotice?.counselorName || '').toLowerCase().includes('ruzol');

    if (isGuidanceSlipNotif) {
      return true;
    }

    const notifTime = n.timestamp || (n.createdAt ? new Date(n.createdAt).getTime() : 0);
    const age = now - notifTime;
    const isExpired = n.isRead && age > ONE_MONTH_MS;
    if (isExpired) {
      hasPruned = true;
      return false;
    }
    return true;
  });

  if (hasPruned) {
    setStoredData(STORAGE_KEYS.NOTIFICATIONS, validNotifs, true);
  }

  // 2. Filter for target role or specific userId
  const userNotifs = validNotifs.filter((n) =>
    doesNotificationMatchUser(n, userId, role, userFullName, altUserId)
  );

  // 3. Strictly sort from latest to oldest using actual Firestore timestamp / createdAt (Descending)
  userNotifs.sort((a, b) => {
    const timeA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeB - timeA;
  });

  if (role === 'STUDENT') {
    return userNotifs.map((n) => {
      if (n.type === 'SLIP_NOTICE' || n.slipNotice) {
        return n;
      }
      if (
        n.type === 'APPOINTMENT' ||
        n.linkModule === 'appointments' ||
        n.linkModule === 'student_grievances' ||
        (n.title && n.title.toLowerCase().includes('appointment')) ||
        (n.message && n.message.toLowerCase().includes('appointment'))
      ) {
        return {
          ...n,
          linkModule: 'student_grievances',
          title: n.title
            ? n.title
                .replace(/Appointments/g, 'Student Grievances')
                .replace(/appointments/g, 'student grievances')
                .replace(/Appointment/g, 'Student Grievance')
                .replace(/appointment/g, 'student grievance')
            : 'Student Grievance',
          message: n.message
            ? n.message
                .replace(/Appointments/g, 'Student Grievances')
                .replace(/appointments/g, 'student grievances')
                .replace(/Appointment/g, 'Student Grievance')
                .replace(/appointment/g, 'student grievance')
            : '',
        };
      }
      return n;
    });
  }

  return userNotifs;
}

export function markNotificationsRead(
  userId: string,
  role: string,
  userFullName?: string,
  altUserId?: string
): void {
  const notifs = getStoredData<SystemNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const updated = notifs.map((n) => {
    if (doesNotificationMatchUser(n, userId, role, userFullName, altUserId)) {
      const readNotif = { ...n, isRead: true };
      try {
        setDoc(doc(db, 'notifications', n.id), cleanForFirestore(readNotif), { merge: true }).catch(() => {});
      } catch (_) {}
      return readNotif;
    }
    return n;
  });
  setStoredData(STORAGE_KEYS.NOTIFICATIONS, updated, true);
  safeDispatchEvent('osas_notifications_updated');
}

export function markNotificationAsRead(id: string): void {
  const notifs = getStoredData<SystemNotification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
  const updated = notifs.map((n) => {
    if (n.id === id) {
      const readNotif = { ...n, isRead: true };
      try {
        setDoc(doc(db, 'notifications', n.id), cleanForFirestore(readNotif), { merge: true }).catch(() => {});
      } catch (_) {}
      return readNotif;
    }
    return n;
  });
  setStoredData(STORAGE_KEYS.NOTIFICATIONS, updated, true);
  safeDispatchEvent('osas_notifications_updated');
}

// --- USER & AUTH API ---
export function getUsers(): User[] {
  let users = getStoredData<User[]>(STORAGE_KEYS.USERS, initialUsers);
  if (!Array.isArray(users) || users.length === 0) {
    users = [...initialUsers];
  }
  let changed = false;

  // Auto-migrate any old Admin or Guidance Admin names
  users = users.map((u) => {
    if (u.role === 'ADMIN' && (u.fullName === 'Avliccon Alpuerto' || u.fullName === 'Dr. Maria Santos')) {
      changed = true;
      return { ...u, fullName: 'Princess Ann T. Ruzol' };
    }
    if (u.role === 'GUIDANCE_ADMIN' && (u.fullName === 'Guidance Counselor & Admin' || u.fullName === 'Guidance Counselor' || u.fullName === 'Maria Mel B. Glamau')) {
      changed = true;
      return { ...u, fullName: 'Maria Mel B. Glemao' };
    }
    return u;
  });

  if (users.length > 0 && !users.some((u) => u.role === 'GUIDANCE_ADMIN')) {
    const guidanceAdmin: User = {
      id: 'guidance-admin-1',
      fullName: 'Maria Mel B. Glemao',
      email: 'avliccon04@gmail.com',
      role: 'GUIDANCE_ADMIN',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      createdAt: '2024-01-01',
    };
    users.push(guidanceAdmin);
    changed = true;
  }
  // Ensure Guidance Admin email is updated to avliccon04@gmail.com
  users = users.map((u) => {
    if (u.role === 'GUIDANCE_ADMIN' && u.email !== 'avliccon04@gmail.com') {
      changed = true;
      return { ...u, email: 'avliccon04@gmail.com' };
    }
    return u;
  });


  const purged = getPurgedIds();
  const archive = getArchiveItems();
  const archivedStudentIds = new Set(
    archive
      .filter((a) => a.type === 'STUDENT_RECORD' || (a.type as string) === 'USER')
      .flatMap((a) => [a.originalId, a.data?.id, a.data?.studentId, a.data?.email?.toLowerCase()].filter(Boolean) as string[])
  );

  return users.filter((u) => {
    if (purged.has(u.id)) return false;
    if (archivedStudentIds.has(u.id)) return false;
    return true;
  });
}

export function getCurrentUser(): User | null {
  return getStoredData<User | null>(STORAGE_KEYS.CURRENT_USER, null);
}

export function setCurrentUser(user: User | null): void {
  setStoredData(STORAGE_KEYS.CURRENT_USER, user);
}

/**
 * Provisions student credentials into Firebase Authentication in background worker
 * without disturbing the active administrator session.
 */
export async function syncStudentToFirebaseAuth(
  email: string,
  pass: string,
  displayName: string
): Promise<string | null> {
  try {
    const workerAppName = 'osas_auth_worker';
    const workerApp =
      getApps().find((a) => a.name === workerAppName) ||
      initializeApp(firebaseConfig, workerAppName);
    const workerAuth = getAuth(workerApp);
    const cred = await createUserWithEmailAndPassword(workerAuth, email.trim(), pass);
    if (cred && cred.user) {
      try {
        await updateProfile(cred.user, { displayName });
      } catch (_) {}
      return cred.user.uid;
    }
  } catch (err: any) {
    // If user exists or auth domain is not enabled in local preview, graceful fallback
    console.warn('[Firebase Auth Provisioning Note]', err?.code || err?.message || err);
  }
  return null;
}

/**
 * Asynchronously locates a user across local state, Firestore centralized store,
 * individual Firestore user documents, and backend synchronization endpoints.
 * Guarantees that newly registered students on Device A are instantly accessible on Device B with zero delay.
 */
export async function findUserAsync(emailOrStudentId: string, passwordOrOtp?: string): Promise<User | null> {
  const rawInput = String(emailOrStudentId || '').trim();
  const clean = rawInput.toLowerCase();
  if (!clean) return null;
  const cleanNoDash = clean.replace(/[^a-z0-9]/g, '');

  const matchUser = (u: User | any): boolean => {
    if (!u || typeof u !== 'object') return false;
    const uEmail = (u.email || '').trim().toLowerCase();
    const uStudentId = (u.studentId || '').trim().toLowerCase();
    const uStudentIdClean = uStudentId.replace(/[^a-z0-9]/g, '');
    const uId = (u.id || '').trim().toLowerCase();
    const uUid = (u.uid || '').trim().toLowerCase();
    return (
      uEmail === clean ||
      uEmail === rawInput.toLowerCase() ||
      uStudentId === clean ||
      uStudentIdClean === cleanNoDash ||
      uId === clean ||
      uId === `stud-${cleanNoDash}` ||
      uUid === clean ||
      (u.studentId && u.studentId.trim() === rawInput) ||
      (u.id && u.id.trim() === rawInput)
    );
  };

  const candidateMap = new Map<string, User>();
  const addCandidate = (u: User | any) => {
    if (u && matchUser(u)) {
      const sId = (u.studentId || '').trim().toLowerCase();
      // Group same studentId under one candidate entry, keeping the freshest
      const key =
        u.role === 'STUDENT' && sId
          ? `stud_${sId.replace(/[^a-z0-9]/g, '')}`
          : String(u.id || u.email || '').trim().toLowerCase();
      if (key) {
        const existing = candidateMap.get(key);
        if (!existing || getItemTime(u) >= getItemTime(existing)) {
          candidateMap.set(key, u as User);
        }
      }
    }
  };

  // Check local state first as baseline with safe optional chaining
  const localUsers = getUsers();
  localUsers.forEach(addCandidate);

  // If local user is found and password matches, return immediately with zero delay
  if (passwordOrOtp) {
    for (const c of candidateMap.values()) {
      if (await verifyUserCredentials(passwordOrOtp, c)) {
        return c;
      }
    }
  }

  // 1. Fetch directly from Firestore centralized collection osas_store/osas_users in parallel with direct doc lookups
  const fetchTasks: Promise<any>[] = [];

  fetchTasks.push(
    getDoc(doc(db, 'osas_store', STORAGE_KEYS.USERS))
      .then((osasSnap) => {
        if (osasSnap.exists()) {
          const docData = osasSnap.data();
          if (docData && Array.isArray(docData.value)) {
            const { mergedVal, hasChanges } = mergeCollectionWithLocal(STORAGE_KEYS.USERS, docData.value);
            if (hasChanges) {
              safeLocalStorageSet(STORAGE_KEYS.USERS, JSON.stringify(mergedVal));
              safeDispatchEvent('osas_storage_updated');
            }
            (mergedVal as User[]).forEach(addCandidate);
          }
        }
      })
      .catch((err) => {
        console.warn('[Firestore] Direct osas_users fetch note:', err);
      })
  );

  // 2. Direct document lookup from Firestore 'users' collection in parallel
  const directKeys = Array.from(
    new Set([
      clean,
      rawInput,
      rawInput.toLowerCase(),
      cleanNoDash,
      `stud-${clean}`,
      `stud-${cleanNoDash}`,
      `stud-${clean.replace(/[^a-z0-9]/g, '')}`,
    ])
  ).filter(Boolean);

  for (const docKey of directKeys) {
    fetchTasks.push(
      getDoc(doc(db, 'users', docKey))
        .then((directSnap) => {
          if (directSnap.exists()) {
            const rawUser = directSnap.data() as User;
            if (rawUser) {
              addCandidate({
                ...rawUser,
                id: rawUser.id || directSnap.id,
                uid: rawUser.uid || rawUser.id || directSnap.id,
              });
            }
          }
        })
        .catch(() => {})
    );
  }

  // 3. Query Firestore 'users' collection by email or studentId in parallel
  try {
    const usersColl = collection(db, 'users');
    const queries = [
      query(usersColl, where('email', '==', clean)),
      query(usersColl, where('email', '==', rawInput)),
      query(usersColl, where('studentId', '==', rawInput)),
      query(usersColl, where('studentId', '==', clean)),
      query(usersColl, where('studentId', '==', cleanNoDash)),
      query(usersColl, where('id', '==', rawInput)),
      query(usersColl, where('id', '==', clean)),
      query(usersColl, where('id', '==', `stud-${cleanNoDash}`)),
    ];

    for (const q of queries) {
      fetchTasks.push(
        getDocs(q)
          .then((snap) => {
            snap.docs.forEach((d) => {
              const rawUser = d.data() as User;
              if (rawUser) {
                addCandidate({
                  ...rawUser,
                  id: rawUser.id || d.id,
                  uid: rawUser.uid || rawUser.id || d.id,
                });
              }
            });
          })
          .catch(() => {})
      );
    }
  } catch (_) {}

  // Await all cloud queries in parallel (prevents sequential waterfall)
  await Promise.allSettled(fetchTasks);

  const candidates = Array.from(candidateMap.values());
  if (candidates.length === 0) return null;

  const cacheAndReturn = (selected: User): User => {
    const currentList = getUsers();
    const updated = [
      ...currentList.filter(
        (u) =>
          u.id !== selected.id &&
          (u.studentId || '').trim().toLowerCase() !== (selected.studentId || '').trim().toLowerCase() &&
          (u.email || '').trim().toLowerCase() !== (selected.email || '').trim().toLowerCase()
      ),
      selected,
    ];
    setStoredData(STORAGE_KEYS.USERS, updated, false);
    memoryStorage.set(STORAGE_KEYS.USERS, updated);
    safeDispatchEvent('osas_storage_updated');
    return selected;
  };

  // Resolve matching candidate if password or OTP was provided
  if (passwordOrOtp) {
    for (const c of candidates) {
      if (await verifyUserCredentials(passwordOrOtp, c)) {
        return cacheAndReturn(c);
      }
    }
  }

  // If no password or none matched, prioritize exact student ID, then role preference
  const byStudentId = candidates.find(
    (c) =>
      (c.studentId || '').trim().toLowerCase() === clean ||
      (c.studentId || '').replace(/[^a-z0-9]/g, '').toLowerCase() === cleanNoDash ||
      (c.id || '').trim().toLowerCase() === clean
  );
  if (byStudentId) return cacheAndReturn(byStudentId);

  const students = candidates
    .filter((c) => c.role === 'STUDENT')
    .sort((a, b) => getItemTime(b) - getItemTime(a));
  if (students.length > 0) return cacheAndReturn(students[0]);

  const fallbackCandidate = candidates.sort((a, b) => getItemTime(b) - getItemTime(a))[0];
  return fallbackCandidate ? cacheAndReturn(fallbackCandidate) : null;
}

export function updateUserProfile(userId: string, updates: Partial<User>): User | null {
  const users = getUsers();
  let updatedUser: User | null = null;
  const newUsers = users.map((u) => {
    if (u.id === userId || (u.studentId && u.studentId === userId)) {
      updatedUser = { ...u, ...updates, updatedAt: Date.now() };
      return updatedUser;
    }
    return u;
  });
  setStoredData(STORAGE_KEYS.USERS, newUsers, true);

  if (updatedUser) {
    try {
      const u = updatedUser as User;
      const userDocRef = doc(db, 'users', u.id);
      setDoc(userDocRef, { ...cleanForFirestore(u), uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true }).catch(() => {});

      if (u.studentId) {
        const studentDocRef = doc(db, 'users', u.studentId.trim().toLowerCase());
        setDoc(studentDocRef, { ...cleanForFirestore(u), uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true }).catch(() => {});
      }
    } catch (_) {}
  }

  const cur = getCurrentUser();
  if (cur && (cur.id === userId || (cur.studentId && cur.studentId === userId)) && updatedUser) {
    setCurrentUser(updatedUser);
  }

  logActivity('Update Profile', 'Account Management', updatedUser ? (updatedUser as User).fullName : userId, 'User updated profile information.');
  return updatedUser;
}

export async function updateUserPassword(
  userIdOrUser: string | User,
  newPasswordPlain: string
): Promise<User | null> {
  const targetUserObj =
    typeof userIdOrUser === 'object' && userIdOrUser !== null ? (userIdOrUser as User) : null;
  const isStringInput = typeof userIdOrUser === 'string';
  const cleanInput = isStringInput ? userIdOrUser.trim() : '';
  const isEmailInput = cleanInput.includes('@');

  const rawTargetId = (targetUserObj?.id || (!isEmailInput ? cleanInput : '')).trim();
  const targetStudentId = (targetUserObj?.studentId || (!isEmailInput ? cleanInput : '')).trim();
  const targetEmail = (targetUserObj?.email || (isEmailInput ? cleanInput : '')).trim().toLowerCase();
  const targetCleanNoDash = targetStudentId.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const rawCleanNoDash = rawTargetId.replace(/[^a-z0-9]/gi, '').toLowerCase();

  const users = getUsers();
  const hashedPassword = await hashPassword(newPasswordPlain.trim());
  let updatedUser: User | null = null;
  const nowTime = Date.now();
  const nowIso = new Date(nowTime).toISOString();

  let matchedExisting = false;
  const newUsers = users.map((u) => {
    const isTarget =
      (targetUserObj && (
        (targetUserObj.id && u.id && u.id.toLowerCase() === targetUserObj.id.toLowerCase()) ||
        (targetUserObj.studentId && u.studentId && (
          u.studentId.trim().toLowerCase() === targetUserObj.studentId.trim().toLowerCase() ||
          u.studentId.replace(/[^a-z0-9]/gi, '').toLowerCase() === targetUserObj.studentId.replace(/[^a-z0-9]/gi, '').toLowerCase()
        )) ||
        (targetUserObj.email && u.email && u.email.trim().toLowerCase() === targetUserObj.email.trim().toLowerCase()) ||
        (targetUserObj.uid && u.uid && u.uid === targetUserObj.uid)
      )) ||
      (rawTargetId && u.id && (u.id === rawTargetId || u.id.toLowerCase() === rawTargetId.toLowerCase())) ||
      (targetStudentId && u.studentId && (
        u.studentId.trim().toLowerCase() === targetStudentId.toLowerCase() ||
        u.studentId.replace(/[^a-z0-9]/gi, '').toLowerCase() === targetCleanNoDash
      )) ||
      (rawTargetId && u.studentId && (
        u.studentId.trim().toLowerCase() === rawTargetId.toLowerCase() ||
        u.studentId.replace(/[^a-z0-9]/gi, '').toLowerCase() === rawCleanNoDash
      )) ||
      (targetEmail && u.email && u.email.trim().toLowerCase() === targetEmail) ||
      (rawTargetId && u.email && u.email.trim().toLowerCase() === rawTargetId.toLowerCase());

    if (isTarget) {
      matchedExisting = true;
      updatedUser = {
        ...u,
        ...(targetUserObj || {}),
        id: u.id || targetUserObj?.id || rawTargetId,
        studentId: u.studentId || targetUserObj?.studentId || targetStudentId,
        email: u.email || targetUserObj?.email || targetEmail,
        password: hashedPassword,
        passwordHash: hashedPassword,
        oneTimePassword: '', // Clear temporary OTP immediately
        mustChangePassword: false, // Mark password setup complete
        passwordUpdatedAt: nowIso,
        updatedAt: nowTime,
      };
      return updatedUser;
    }
    return u;
  });

  // If not matched in existing users array, use targetUserObj or retrieve from memoryStorage or Firestore
  if (!matchedExisting) {
    let baseUser: User | null = targetUserObj;

    if (!baseUser && memoryStorage.has(STORAGE_KEYS.USERS)) {
      const memUsers = memoryStorage.get(STORAGE_KEYS.USERS);
      if (Array.isArray(memUsers)) {
        baseUser =
          memUsers.find(
            (u: User) =>
              (rawTargetId && (u.id === rawTargetId || (u.studentId && u.studentId.trim().toLowerCase() === rawTargetId.toLowerCase()))) ||
              (targetStudentId && u.studentId && u.studentId.trim().toLowerCase() === targetStudentId.toLowerCase()) ||
              (targetEmail && u.email && u.email.trim().toLowerCase() === targetEmail)
          ) || null;
      }
    }

    if (!baseUser) {
      try {
        baseUser = await findUserAsync(rawTargetId || targetStudentId || targetEmail);
      } catch (_) {}
    }

    if (baseUser) {
      updatedUser = {
        ...baseUser,
        password: hashedPassword,
        passwordHash: hashedPassword,
        oneTimePassword: '',
        mustChangePassword: false,
        passwordUpdatedAt: nowIso,
        updatedAt: nowTime,
      };
      newUsers.push(updatedUser);
    }
  }

  if (!updatedUser) {
    console.warn('[updateUserPassword] Target user could not be found to update password:', rawTargetId || targetEmail);
    return null;
  }

  setStoredData(STORAGE_KEYS.USERS, newUsers, true);
  memoryStorage.set(STORAGE_KEYS.USERS, newUsers);

  try {
    const u = updatedUser as User;
    const cleanedU = cleanForFirestore(u);
    const cleanedUsers = cleanForFirestore(newUsers);
    const writePromises: Promise<any>[] = [
      setDoc(doc(db, 'users', u.id), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true }),
      setDoc(doc(db, 'osas_store', STORAGE_KEYS.USERS), { value: cleanedUsers, updatedAt: Date.now() }, { merge: true }),
    ];

    if (u.studentId) {
      const cleanSId = u.studentId.trim();
      const cleanNoDash = cleanSId.replace(/[^a-z0-9]/gi, '').toLowerCase();
      writePromises.push(
        setDoc(doc(db, 'users', cleanSId.toLowerCase()), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true }),
        setDoc(doc(db, 'users', cleanSId), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true }),
        setDoc(doc(db, 'users', cleanNoDash), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true }),
        setDoc(doc(db, 'users', `stud-${cleanNoDash}`), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true })
      );
    }

    if (u.email && u.email !== 'arnoldviena@gmail.com' && u.email !== 'avliccon04@gmail.com') {
      writePromises.push(
        setDoc(doc(db, 'users', u.email.trim().toLowerCase()), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true })
      );
    }

    if (u.uid && u.uid !== u.id) {
      writePromises.push(
        setDoc(doc(db, 'users', u.uid), { ...cleanedU, uid: u.uid, updatedAt: Date.now() }, { merge: true })
      );
    }

    // Provision/update Firebase Auth in background
    if (u.email) {
      try {
        const workerAppName = 'osas_auth_worker';
        const workerApp =
          getApps().find((a) => a.name === workerAppName) ||
          initializeApp(firebaseConfig, workerAppName);
        const workerAuth = getAuth(workerApp);
        createUserWithEmailAndPassword(workerAuth, u.email.trim(), newPasswordPlain.trim())
          .catch((authErr: any) => {
            if (authErr?.code === 'auth/email-already-in-use') {
              const oldOtp = targetUserObj?.oneTimePassword || targetUserObj?.password || '';
              if (oldOtp) {
                signInWithEmailAndPassword(workerAuth, u.email.trim(), oldOtp.trim())
                  .then((cred) => {
                    if (cred?.user) {
                      updatePassword(cred.user, newPasswordPlain.trim()).catch(() => {});
                    }
                  })
                  .catch(() => {});
              }
            }
          });
      } catch (_) {}
    }

    writePromises.push(
      fetch('/api/db/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: STORAGE_KEYS.USERS, value: newUsers }),
      }).catch(() => {})
    );

    await Promise.allSettled(writePromises);
  } catch (err) {
    console.warn('[Firestore updateUserPassword Write Note]', err);
  }

  // Update current session across storage
  const cur = getCurrentUser();
  if (
    !cur ||
    (cur.id === updatedUser.id ||
      (cur.studentId && updatedUser.studentId && cur.studentId.trim().toLowerCase() === updatedUser.studentId.trim().toLowerCase()) ||
      (cur.email && updatedUser.email && cur.email.trim().toLowerCase() === updatedUser.email.trim().toLowerCase()))
  ) {
    setCurrentUser(updatedUser);
  }

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('osas_current_user', JSON.stringify(updatedUser));
      safeLocalStorageSet(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    } catch (_) {}
  }

  const roleLabel = updatedUser.role === 'ADMIN' ? 'Administrator' : 'Student';
  const nameLabel = updatedUser.fullName || rawTargetId;

  logActivity(
    'Update Password',
    'Security Setup',
    nameLabel,
    `${roleLabel} successfully updated their account password. System has locked out old credentials.`
  );

  triggerSuccessTransaction(
    'Password Updated Successfully',
    'Matagumpay na na-update ang iyong secure password. Tanging ang bagong password na lamang ang tatanggapin ng system.'
  );

  return updatedUser;
}

// --- FORGOT PASSWORD OTP MANAGEMENT ---

export async function requestPasswordResetOtp(emailOrStudentId: string): Promise<{
  success: boolean;
  message: string;
  email?: string;
  user?: User;
  expiresInMinutes?: number;
}> {
  const cleanInput = emailOrStudentId.trim().toLowerCase();
  const targetUser = await findUserAsync(cleanInput);

  if (!targetUser) {
    return {
      success: false,
      message: 'Hindi rehistrado ang email address na ito sa OSAS portal. Pakisuri ang iyong registered email.',
    };
  }

  if (targetUser.isSuspended) {
    return {
      success: false,
      message: '⛔ This account has been SUSPENDED by OSAS Admin. Password reset is not permitted.',
    };
  }

  // Generate a random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000; // 15-minute expiration

  const records = getStoredData<PasswordResetOtpRecord[]>(STORAGE_KEYS.PASSWORD_RESET_OTPS, []);
  // Filter out pending unused OTPs for this email to prevent collisions
  const filtered = records.filter((r) => r.email.toLowerCase() !== targetUser.email.toLowerCase());

  const newRecord: PasswordResetOtpRecord = {
    email: targetUser.email,
    studentId: targetUser.studentId,
    userId: targetUser.id,
    otp,
    createdAt: now,
    expiresAt,
    used: false,
  };

  setStoredData(STORAGE_KEYS.PASSWORD_RESET_OTPS, [newRecord, ...filtered], true);

  // Directly write to Firestore collection 'password_reset_otps' with email doc ID for instant cross-device availability
  try {
    const cleanEmailKey = targetUser.email.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    await setDoc(doc(db, 'password_reset_otps', cleanEmailKey), cleanForFirestore(newRecord));
  } catch (err) {
    console.warn('[Firestore OTP Direct Write Note]', err);
  }

  try {
    await sendPasswordResetEmail(
      {
        name: targetUser.fullName,
        email: targetUser.email,
        studentId: targetUser.studentId,
      },
      otp
    );
  } catch (err) {
    console.warn('[Forgot Password] Email notification error:', err);
  }

  logActivity(
    'Password Reset Request',
    'Account Security',
    targetUser.fullName,
    `Dispatched 6-digit verification OTP to registered email ${targetUser.email} (valid for 15 minutes).`
  );

  return {
    success: true,
    message: `Matagumpay na naipadala ang 6-digit verification code sa ${targetUser.email}.`,
    email: targetUser.email,
    user: targetUser,
    expiresInMinutes: 15,
  };
}

export async function verifyPasswordResetOtp(
  email: string,
  enteredOtp: string
): Promise<{
  valid: boolean;
  message: string;
  user?: User;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = enteredOtp.trim();

  if (!cleanOtp || cleanOtp.length !== 6) {
    return {
      valid: false,
      message: 'Mangyaring maglagay ng kumpletong 6-digit verification code.',
    };
  }

  // Check local records first
  const records = getStoredData<PasswordResetOtpRecord[]>(STORAGE_KEYS.PASSWORD_RESET_OTPS, []);
  let matchingRecord = records.find(
    (r) => r.email.toLowerCase() === cleanEmail && r.otp === cleanOtp
  );

  // If not found in local cache (e.g. on another device), fetch directly from Firestore
  if (!matchingRecord) {
    try {
      const cleanEmailKey = cleanEmail.replace(/[^a-z0-9_.-]/g, '_');
      const directDocSnap = await getDoc(doc(db, 'password_reset_otps', cleanEmailKey));
      if (directDocSnap.exists()) {
        const cloudRecord = directDocSnap.data() as PasswordResetOtpRecord;
        if (cloudRecord && cloudRecord.otp === cleanOtp) {
          matchingRecord = cloudRecord;
        }
      }

      if (!matchingRecord) {
        const storeDocSnap = await getDoc(doc(db, 'osas_store', STORAGE_KEYS.PASSWORD_RESET_OTPS));
        if (storeDocSnap.exists()) {
          const storeRecords = storeDocSnap.data()?.value;
          if (Array.isArray(storeRecords)) {
            const foundInStore = storeRecords.find(
              (r: any) => r.email?.toLowerCase() === cleanEmail && r.otp === cleanOtp
            );
            if (foundInStore) {
              matchingRecord = foundInStore;
            }
          }
        }
      }
    } catch (fsErr) {
      console.warn('[Firestore OTP Verification Read Note]', fsErr);
    }
  }

  if (!matchingRecord) {
    return {
      valid: false,
      message: 'Maling verification code. Pakisuri ang 6-digit OTP na ipinadala sa iyong email.',
    };
  }

  if (matchingRecord.used) {
    return {
      valid: false,
      message: 'Nagamit na ang verification code na ito. One-time use lamang ito. Humiling ng panibagong code.',
    };
  }

  if (Date.now() > matchingRecord.expiresAt) {
    return {
      valid: false,
      message: 'Nag-expire na ang verification code (lampas 15 minuto). Humiling ng panibagong OTP.',
    };
  }

  // Strict One-Time Use: Mark this OTP as used immediately so it can NEVER be reused
  const updatedRecords = records.map((r) =>
    r.email.toLowerCase() === cleanEmail && r.otp === cleanOtp ? { ...r, used: true } : r
  );
  setStoredData(STORAGE_KEYS.PASSWORD_RESET_OTPS, updatedRecords, true);

  try {
    const cleanEmailKey = cleanEmail.replace(/[^a-z0-9_.-]/g, '_');
    await setDoc(doc(db, 'password_reset_otps', cleanEmailKey), { ...matchingRecord, used: true }, { merge: true });
  } catch (_) {}

  // Fetch target user asynchronously to ensure cross-device consistency
  const targetUser = await findUserAsync(cleanEmail);

  if (!targetUser) {
    return {
      valid: false,
      message: 'Hindi mahanap ang nauugnay na account sa portal.',
    };
  }

  const roleName = targetUser.role === 'ADMIN' ? 'Admin' : 'Student';
  logActivity(
    'Verify Reset OTP',
    'Account Security',
    targetUser.fullName,
    `${roleName} successfully verified 6-digit password reset OTP.`
  );

  return {
    valid: true,
    message: 'Matagumpay na na-verify ang OTP code.',
    user: targetUser,
  };
}


export function toggleUserSuspension(userId: string, adminName: string): boolean {
  const users = getUsers();
  let nextStatus = false;
  let targetName = '';
  const newUsers = users.map((u) => {
    if (u.id === userId || u.studentId === userId) {
      nextStatus = !u.isSuspended;
      targetName = u.fullName;
      return { ...u, isSuspended: nextStatus, updatedAt: Date.now() };
    }
    return u;
  });
  setStoredData(STORAGE_KEYS.USERS, newUsers);
  logActivity(
    nextStatus ? 'Suspend Account' : 'Reactivate Account',
    'Student Management',
    adminName,
    `Admin ${nextStatus ? 'SUSPENDED' : 'REACTIVATED'} student account for ${targetName} (${userId}).`
  );
  return nextStatus;
}

export async function registerStudentAccount(
  data: {
    studentId: string;
    fullName: string;
    surname?: string;
    firstName?: string;
    middleName?: string;
    extensionName?: string;
    section?: string;
    email: string;
    address?: string;
    permanentAddress?: string;
    contactNumber?: string;
    yearLevel: string;
    course: string;
    oneTimePassword: string;
  },
  adminName: string
): Promise<User> {
  const currentUsers = getUsers();
  const addressVal = data.permanentAddress || data.address || '';
  const newId = `stud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const cleanId = String(data.studentId || '').trim();
  const cleanEmail = String(data.email || '').trim().toLowerCase();
  const cleanOtp = String(data.oneTimePassword || '').trim() || Math.floor(100000 + Math.random() * 900000).toString();

  const newUser: User = {
    id: newId,
    uid: newId,
    studentId: cleanId,
    fullName: data.fullName.trim(),
    surname: data.surname?.trim() || '',
    firstName: data.firstName?.trim() || '',
    middleName: data.middleName?.trim() || '',
    extensionName: data.extensionName?.trim() || '',
    section: data.section?.trim() || '',
    email: cleanEmail,
    address: addressVal,
    permanentAddress: addressVal,
    contactNumber: data.contactNumber || '',
    role: 'STUDENT',
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.fullName)}`,
    yearLevel: data.yearLevel,
    course: data.course,
    oneTimePassword: cleanOtp,
    password: cleanOtp,
    passwordHash: '',
    mustChangePassword: true,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: Date.now(),
  };

  // 1. Clear any old purge tombstones and archive records for this student ID or email
  const purged = getPurgedIds();
  let purgedChanged = false;
  if (purged.has(newUser.id)) { purged.delete(newUser.id); purgedChanged = true; }
  if (cleanId && purged.has(cleanId)) { purged.delete(cleanId); purgedChanged = true; }
  if (cleanId && purged.has(cleanId.toLowerCase())) { purged.delete(cleanId.toLowerCase()); purgedChanged = true; }
  if (cleanEmail && purged.has(cleanEmail)) { purged.delete(cleanEmail); purgedChanged = true; }
  if (purgedChanged) savePurgedIds(purged);

  const archiveItems = getArchiveItems();
  const filteredArchive = archiveItems.filter((a) => {
    if (a.type !== 'STUDENT_RECORD' && (a.type as string) !== 'USER') return true;
    const match =
      a.originalId === newUser.id ||
      a.originalId === cleanId ||
      a.data?.id === newUser.id ||
      (a.data?.studentId && String(a.data.studentId).trim().toLowerCase() === cleanId.toLowerCase()) ||
      (a.data?.email && String(a.data.email).trim().toLowerCase() === cleanEmail);
    return !match;
  });
  if (filteredArchive.length !== archiveItems.length) {
    setStoredData(STORAGE_KEYS.ARCHIVE, filteredArchive, true);
  }

  // 2. Immediately save locally and dispatch storage event
  const updatedUsers = [
    ...currentUsers.filter(
      (u) =>
        u.id !== newUser.id &&
        (u.studentId || '').trim().toLowerCase() !== cleanId.toLowerCase() &&
        (u.email || '').trim().toLowerCase() !== cleanEmail
    ),
    newUser,
  ];
  setStoredData(STORAGE_KEYS.USERS, updatedUsers, true);
  safeDispatchEvent('osas_storage_updated');

  // 3. Fully persist to Firestore centralized store, individual docs, and Express backend (AWAITED)
  try {
    // Merge remote users if any so we never drop users registered from another device
    let finalUsersToWrite = updatedUsers;
    try {
      const osasSnap = await getDoc(doc(db, 'osas_store', STORAGE_KEYS.USERS));
      if (osasSnap.exists()) {
        const remoteArr = osasSnap.data()?.value;
        if (Array.isArray(remoteArr)) {
          const map = new Map<string, User>();
          const getUserMapKey = (u: User) => {
            if (u.role === 'STUDENT' && u.studentId) {
              return `stud_${u.studentId.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
            }
            return String(u.id || u.email || '').trim().toLowerCase();
          };
          remoteArr.forEach((u: User) => {
            if (u && (u.studentId || u.id || u.email)) {
              map.set(getUserMapKey(u), u);
            }
          });
          finalUsersToWrite.forEach((u: User) => {
            if (u && (u.studentId || u.id || u.email)) {
              map.set(getUserMapKey(u), u);
            }
          });
          finalUsersToWrite = Array.from(map.values());
          setStoredData(STORAGE_KEYS.USERS, finalUsersToWrite, false);
        }
      }
    } catch (_) {}

    const cleanedNewUser = cleanForFirestore(newUser);
    const cleanedFinalUsers = cleanForFirestore(finalUsersToWrite);

    const writePromises: Promise<any>[] = [
      setDoc(doc(db, 'osas_store', STORAGE_KEYS.USERS), { value: cleanedFinalUsers, updatedAt: Date.now() }, { merge: true }),
      setDoc(doc(db, 'users', newUser.id), { ...cleanedNewUser, uid: newUser.uid || newUser.id, updatedAt: Date.now() }, { merge: true }),
    ];

    if (cleanId) {
      const cleanNoDash = cleanId.replace(/[^a-z0-9]/gi, '').toLowerCase();
      writePromises.push(
        setDoc(doc(db, 'users', cleanId.toLowerCase()), { ...cleanedNewUser, uid: newUser.uid || newUser.id, updatedAt: Date.now() }, { merge: true }),
        setDoc(doc(db, 'users', cleanId), { ...cleanedNewUser, uid: newUser.uid || newUser.id, updatedAt: Date.now() }, { merge: true }),
        setDoc(doc(db, 'users', cleanNoDash), { ...cleanedNewUser, uid: newUser.uid || newUser.id, updatedAt: Date.now() }, { merge: true }),
        setDoc(doc(db, 'users', `stud-${cleanNoDash}`), { ...cleanedNewUser, uid: newUser.uid || newUser.id, updatedAt: Date.now() }, { merge: true })
      );
    }

    // Only write cleanEmail doc if email does not belong to administrator accounts
    if (cleanEmail && cleanEmail !== 'arnoldviena@gmail.com' && cleanEmail !== 'avliccon04@gmail.com') {
      writePromises.push(
        setDoc(doc(db, 'users', cleanEmail), { ...cleanedNewUser, uid: newUser.uid || newUser.id, updatedAt: Date.now() }, { merge: true })
      );
    }

    // Direct synchronous call to Express central database backend if available
    writePromises.push(
      fetch('/api/db/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: STORAGE_KEYS.USERS, value: updatedUsers }),
      }).catch((e) => console.warn('[Backend Sync Warning]', e))
    );

    await Promise.allSettled(writePromises);
  } catch (err) {
    console.warn('[Firestore Student Registration Write Warning]', err);
  }

  // 4. Provision Firebase Auth account in background (non-blocking)
  syncStudentToFirebaseAuth(cleanEmail, cleanOtp, data.fullName)
    .then((authUid) => {
      if (authUid && authUid !== newUser.id) {
        newUser.uid = authUid;
        setDoc(doc(db, 'users', authUid), { ...cleanForFirestore(newUser), uid: authUid, updatedAt: Date.now() }, { merge: true }).catch(() => {});
      }
    })
    .catch((err) => {
      console.warn('[Firebase Auth Provisioning Note]', err);
    });

  // 5. Dispatch Professional HTML Email to Student's Email via SMTP in background (non-blocking)
  sendStudentRegistrationEmail(
    {
      id: newUser.id,
      studentId: cleanId,
      name: data.fullName,
      email: cleanEmail,
      course: data.course,
      yearLevel: data.yearLevel,
    },
    cleanOtp
  ).catch((err) => {
    console.warn('[Student Registration Email] Error:', err);
  });

  // 6. Send notification to newly registered student account
  addNotification({
    userId: cleanId,
    title: 'Welcome to STU-SERVE Portal!',
    message: `Your student account (${cleanId}) has been created. Your credentials were emailed to ${cleanEmail}.`,
    type: 'SYSTEM',
  });

  logActivity('Register Student', 'Student Management', adminName, `Registered new student ${data.fullName} (${cleanId}). Dispatch email sent with OTP.`);

  triggerSuccessTransaction('Student Account Created', `Rehistrado na si ${data.fullName} (${cleanId}) at na-email na ang OTP credentials.`);

  return newUser;
}

export interface BulkRegistrationRecord {
  studentId: string;
  surname?: string;
  firstName?: string;
  middleName?: string;
  extensionName?: string;
  fullName?: string;
  email: string;
  permanentAddress?: string;
  contactNumber?: string;
  year?: string | number;
  section?: string;
  yearLevel?: string;
  course?: string;
}

export interface BulkRegistrationSummary {
  total: number;
  registeredCount: number;
  duplicateCount: number;
  invalidCount: number;
  registered: User[];
  duplicates: Array<{ studentId: string; fullName: string; reason: string }>;
  invalid: Array<{ rowNumber: number; studentId: string; fullName: string; reason: string }>;
}

export async function bulkRegisterStudents(
  records: BulkRegistrationRecord[],
  adminName: string
): Promise<BulkRegistrationSummary> {
  const existingUsers = getUsers();
  const existingIds = new Set(
    existingUsers.map((u) => (u.studentId || u.id || '').trim().toLowerCase()).filter(Boolean)
  );
  const existingEmails = new Set(
    existingUsers.map((u) => (u.email || '').trim().toLowerCase()).filter(Boolean)
  );

  const registered: User[] = [];
  const duplicates: Array<{ studentId: string; fullName: string; reason: string }> = [];
  const invalid: Array<{ rowNumber: number; studentId: string; fullName: string; reason: string }> = [];

  const seenInBatch = new Set<string>();

  records.forEach((rec, idx) => {
    const rowNum = idx + 1;
    const cleanId = String(rec.studentId || '').trim();
    const cleanEmail = String(rec.email || '').trim().toLowerCase();

    // Construct full name if breakdown was provided
    let calculatedFullName = (rec.fullName || '').trim();
    if (!calculatedFullName && (rec.firstName || rec.surname)) {
      const parts = [
        rec.firstName || '',
        rec.middleName || '',
        rec.surname || '',
        rec.extensionName || '',
      ].filter(Boolean);
      calculatedFullName = parts.join(' ').trim();
    }

    // Validation checks
    if (!cleanId) {
      invalid.push({ rowNumber: rowNum, studentId: '—', fullName: calculatedFullName || '—', reason: 'Missing Student ID Number' });
      return;
    }
    if (!calculatedFullName) {
      invalid.push({ rowNumber: rowNum, studentId: cleanId, fullName: '—', reason: 'Missing Student Full Name' });
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      invalid.push({ rowNumber: rowNum, studentId: cleanId, fullName: calculatedFullName, reason: 'Invalid or missing Email Address' });
      return;
    }

    // Check duplicate in existing database or in this batch
    const lowerId = cleanId.toLowerCase();
    if (existingIds.has(lowerId) || seenInBatch.has(lowerId)) {
      duplicates.push({ studentId: cleanId, fullName: calculatedFullName, reason: 'Student ID already registered in database' });
      return;
    }
    if (existingEmails.has(cleanEmail)) {
      duplicates.push({ studentId: cleanId, fullName: calculatedFullName, reason: `Email address (${cleanEmail}) already in use` });
      return;
    }

    // Format Year & Section (e.g., "3rd Year - A")
    let formattedYearLevel = (rec.yearLevel || '').trim();
    if (!formattedYearLevel) {
      let rawYear = String(rec.year || '1').trim();
      if (rawYear === '1') rawYear = '1st Year';
      else if (rawYear === '2') rawYear = '2nd Year';
      else if (rawYear === '3') rawYear = '3rd Year';
      else if (rawYear === '4') rawYear = '4th Year';
      else if (!rawYear.toLowerCase().includes('year')) rawYear = `${rawYear} Year`;

      const sec = (rec.section || '').trim().toUpperCase();
      formattedYearLevel = sec ? `${rawYear} - ${sec}` : rawYear;
    }

    // Clean contact number
    let cleanContact = (rec.contactNumber || '').replace(/\D/g, '');
    if (cleanContact && cleanContact.length === 10 && cleanContact.startsWith('9')) {
      cleanContact = '0' + cleanContact;
    }

    // Generate unique 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    seenInBatch.add(lowerId);

    const newId = `stud-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
    const newUser: User = {
      id: newId,
      uid: newId,
      studentId: cleanId,
      fullName: calculatedFullName,
      surname: rec.surname?.trim() || '',
      firstName: rec.firstName?.trim() || '',
      middleName: rec.middleName?.trim() || '',
      extensionName: rec.extensionName?.trim() || '',
      section: rec.section?.trim().toUpperCase() || '',
      email: cleanEmail,
      contactNumber: cleanContact || '09170000000',
      address: rec.permanentAddress || 'Dingalan, Aurora',
      permanentAddress: rec.permanentAddress || 'Dingalan, Aurora',
      role: 'STUDENT',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(calculatedFullName)}`,
      yearLevel: formattedYearLevel,
      course: rec.course?.trim() || 'BS Information Technology',
      oneTimePassword: otp,
      password: otp,
      passwordHash: '',
      mustChangePassword: true,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: Date.now(),
    };

    registered.push(newUser);
  });

  if (registered.length > 0) {
    // Clear any purged IDs and archive records for the newly registered batch
    const purged = getPurgedIds();
    let purgedChanged = false;
    registered.forEach((u) => {
      if (purged.has(u.id)) { purged.delete(u.id); purgedChanged = true; }
      if (u.studentId && purged.has(u.studentId)) { purged.delete(u.studentId); purgedChanged = true; }
      if (u.studentId && purged.has(u.studentId.toLowerCase())) { purged.delete(u.studentId.toLowerCase()); purgedChanged = true; }
      if (u.email && purged.has(u.email.toLowerCase())) { purged.delete(u.email.toLowerCase()); purgedChanged = true; }
    });
    if (purgedChanged) savePurgedIds(purged);

    const archiveItems = getArchiveItems();
    const batchIdSet = new Set(registered.map((r) => (r.studentId || r.id).trim().toLowerCase()));
    const batchEmailSet = new Set(registered.map((r) => (r.email || '').trim().toLowerCase()));
    const filteredArchive = archiveItems.filter((a) => {
      if (a.type !== 'STUDENT_RECORD' && (a.type as string) !== 'USER') return true;
      const mOrig = (a.originalId || '').trim().toLowerCase();
      const mDataId = (a.data?.id || '').trim().toLowerCase();
      const mStudentId = (a.data?.studentId || '').trim().toLowerCase();
      const mEmail = (a.data?.email || '').trim().toLowerCase();
      return !batchIdSet.has(mOrig) && !batchIdSet.has(mDataId) && !batchIdSet.has(mStudentId) && !batchEmailSet.has(mEmail);
    });
    if (filteredArchive.length !== archiveItems.length) {
      setStoredData(STORAGE_KEYS.ARCHIVE, filteredArchive, true);
    }

    const currentUsers = getUsers();
    const existingIdSet = new Set(registered.map((r) => (r.studentId || r.id).trim().toLowerCase()));
    const existingEmailSet = new Set(registered.map((r) => (r.email || '').trim().toLowerCase()));
    const filteredCurrent = currentUsers.filter(
      (u) =>
        !existingIdSet.has((u.studentId || u.id || '').trim().toLowerCase()) &&
        !existingEmailSet.has((u.email || '').trim().toLowerCase())
    );
    const updatedUsers = [...filteredCurrent, ...registered];
    setStoredData(STORAGE_KEYS.USERS, updatedUsers, true);
    safeDispatchEvent('osas_storage_updated');

    // Sync all registered student docs directly to Firestore and Express server in parallel (AWAITED)
    try {
      let finalUsersToWrite = updatedUsers;
      try {
        const osasSnap = await getDoc(doc(db, 'osas_store', STORAGE_KEYS.USERS));
        if (osasSnap.exists()) {
          const remoteArr = osasSnap.data()?.value;
          if (Array.isArray(remoteArr)) {
            const map = new Map<string, User>();
            const getUserMapKey = (u: User) => {
              if (u.role === 'STUDENT' && u.studentId) {
                return `stud_${u.studentId.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
              }
              return String(u.id || u.email || '').trim().toLowerCase();
            };
            remoteArr.forEach((u: User) => {
              if (u && (u.studentId || u.id || u.email)) {
                map.set(getUserMapKey(u), u);
              }
            });
            finalUsersToWrite.forEach((u: User) => {
              if (u && (u.studentId || u.id || u.email)) {
                map.set(getUserMapKey(u), u);
              }
            });
            finalUsersToWrite = Array.from(map.values());
            setStoredData(STORAGE_KEYS.USERS, finalUsersToWrite, false);
          }
        }
      } catch (_) {}

      const cleanedFinalUsers = cleanForFirestore(finalUsersToWrite);
      const writePromises: Promise<any>[] = [];
      writePromises.push(
        setDoc(doc(db, 'osas_store', STORAGE_KEYS.USERS), { value: cleanedFinalUsers, updatedAt: Date.now() }, { merge: true })
      );

      writePromises.push(
        fetch('/api/db/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: STORAGE_KEYS.USERS, value: updatedUsers }),
        }).catch((e) => console.warn('[Backend Sync Warning]', e))
      );

      registered.forEach((u) => {
        const cleanedU = cleanForFirestore(u);
        writePromises.push(
          setDoc(doc(db, 'users', u.id), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true })
        );
        if (u.studentId) {
          const sClean = u.studentId.trim();
          const sNoDash = sClean.replace(/[^a-z0-9]/gi, '').toLowerCase();
          writePromises.push(
            setDoc(doc(db, 'users', sClean.toLowerCase()), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true }),
            setDoc(doc(db, 'users', sClean), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true }),
            setDoc(doc(db, 'users', sNoDash), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true }),
            setDoc(doc(db, 'users', `stud-${sNoDash}`), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true })
          );
        }
        const uEmail = (u.email || '').trim().toLowerCase();
        if (uEmail && uEmail !== 'arnoldviena@gmail.com' && uEmail !== 'avliccon04@gmail.com') {
          writePromises.push(
            setDoc(doc(db, 'users', uEmail), { ...cleanedU, uid: u.uid || u.id, updatedAt: Date.now() }, { merge: true })
          );
        }
      });

      await Promise.allSettled(writePromises);
    } catch (_) {}

    // Provision Firebase Auth & send registration emails asynchronously
    registered.forEach((u) => {
      if (u.email && u.oneTimePassword) {
        syncStudentToFirebaseAuth(u.email, u.oneTimePassword, u.fullName)
          .then((authUid) => {
            if (authUid && authUid !== u.id) {
              u.uid = authUid;
              setDoc(doc(db, 'users', authUid), { ...cleanForFirestore(u), uid: authUid, updatedAt: Date.now() }, { merge: true }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      sendStudentRegistrationEmail(
        {
          id: u.id,
          studentId: u.studentId || '',
          name: u.fullName,
          email: u.email,
          course: u.course || 'BS Information Technology',
          yearLevel: u.yearLevel || '1st Year',
        },
        u.oneTimePassword || '123456'
      ).catch(() => {});
    });

    logActivity(
      'Batch Register Students',
      'Student Management',
      adminName,
      `Batch imported and registered ${registered.length} students from attached student list file.`
    );

    triggerSuccessTransaction(
      'Batch Registration Successful',
      `Matagumpay na na-rehistro ang ${registered.length} estudyante. ${duplicates.length} duplicate(s) at ${invalid.length} invalid record(s) ang nilaktawan.`
    );
  }

  return {
    total: records.length,
    registeredCount: registered.length,
    duplicateCount: duplicates.length,
    invalidCount: invalid.length,
    registered,
    duplicates,
    invalid,
  };
}

export function getCurrentSchoolYear(): string {
  return localStorage.getItem('osas_current_school_year') || '2025-2026';
}

export function setCurrentSchoolYear(sy: string): void {
  safeLocalStorageSet('osas_current_school_year', sy);
  window.dispatchEvent(new Event('osas_storage_updated'));
}

export interface YearProgressionResult {
  fromSchoolYear: string;
  toSchoolYear: string;
  totalStudents: number;
  promotedCount: number;
  graduatedCount: number;
  unchangedCount: number;
}

export function progressSchoolYear(newSchoolYear: string, adminName: string): YearProgressionResult {
  const currentSY = getCurrentSchoolYear();
  const users = getUsers();

  let promotedCount = 0;
  let graduatedCount = 0;
  let unchangedCount = 0;

  const updatedUsers = users.map((u) => {
    if (u.role !== 'STUDENT') return u;

    const currentLevel = u.yearLevel || '';
    let nextLevel = currentLevel;

    // Progression logic
    if (currentLevel.includes('1st Year') || currentLevel.startsWith('1')) {
      nextLevel = currentLevel.replace(/1st Year|1/i, '2nd Year');
      promotedCount++;
    } else if (currentLevel.includes('2nd Year') || currentLevel.startsWith('2')) {
      nextLevel = currentLevel.replace(/2nd Year|2/i, '3rd Year');
      promotedCount++;
    } else if (currentLevel.includes('3rd Year') || currentLevel.startsWith('3')) {
      nextLevel = currentLevel.replace(/3rd Year|3/i, '4th Year');
      promotedCount++;
    } else if (currentLevel.includes('4th Year') || currentLevel.startsWith('4')) {
      nextLevel = `Graduated (A.Y. ${currentSY})`;
      graduatedCount++;
    } else {
      unchangedCount++;
    }

    return {
      ...u,
      yearLevel: nextLevel,
      updatedAt: Date.now(),
    };
  });

  setStoredData(STORAGE_KEYS.USERS, updatedUsers);
  setCurrentSchoolYear(newSchoolYear);

  logActivity(
    'Academic Year Progression',
    'Student Management',
    adminName,
    `Advanced School Year from ${currentSY} to ${newSchoolYear}. Promoted: ${promotedCount}, Graduated: ${graduatedCount}.`
  );

  triggerSuccessTransaction(
    'Academic Year Advanced',
    `Matagumpay na nai-advance ang Academic Year sa ${newSchoolYear}. ${promotedCount} estudyante ang na-promote at ${graduatedCount} ang naging Graduated.`
  );

  return {
    fromSchoolYear: currentSY,
    toSchoolYear: newSchoolYear,
    totalStudents: users.filter((u) => u.role === 'STUDENT').length,
    promotedCount,
    graduatedCount,
    unchangedCount,
  };
}

export function deleteStudentRecord(studentIdOrId: string, deletedBy: string): void {
  const users = getStoredData<User[]>(STORAGE_KEYS.USERS, []);
  const target = users.find((u) => u.id === studentIdOrId || u.studentId === studentIdOrId);
  if (target) {
    const studentIdToMatch = (target.studentId || '').trim().toLowerCase();
    const internalIdToMatch = (target.id || '').trim().toLowerCase();
    const fullNameToMatch = (target.fullName || '').trim().toLowerCase();

    const isStudentMatch = (candidateId?: string | null, candidateName?: string | null) => {
      const cId = String(candidateId || '').trim().toLowerCase();
      if (cId && (cId === studentIdToMatch || (internalIdToMatch && cId === internalIdToMatch))) return true;
      if (candidateName && fullNameToMatch) {
        const cName = String(candidateName).trim().toLowerCase();
        if (cName === fullNameToMatch || (studentIdToMatch && cName.includes(`(${studentIdToMatch})`))) return true;
      }
      return false;
    };

    // 1. Archive primary Student Record (User)
    archiveItem('STUDENT_RECORD', target.id, `${target.fullName} (${target.studentId || target.email})`, target, deletedBy);
    const updatedUsers = users.filter((u) => u.id !== studentIdOrId && u.studentId !== studentIdOrId && u.id !== target.id);
    setStoredData(STORAGE_KEYS.USERS, updatedUsers);

    // 2. Cascade Archive Disciplinary Reports & Safety Reports for this student
    const discReports = getStoredData<DisciplinaryReport[]>(STORAGE_KEYS.DISCIPLINARY_REPORTS, []);
    let discReportsChanged = false;
    const updatedDiscReports = discReports.map((rep) => {
      if (
        isStudentMatch(rep.reportedStudentId, rep.reportedStudentName) ||
        (!rep.isAnonymousReporter && isStudentMatch(rep.reporterStudentId, rep.reporterName)) ||
        isStudentMatch((rep as any).studentId)
      ) {
        discReportsChanged = true;
        const archivedRep = { ...rep, isArchived: true, isResolutionArchived: true };
        archiveItem('DISCIPLINARY_REPORT', rep.id, `Student Report #${rep.id} - ${rep.reportedStudentName || target.fullName}`, archivedRep, deletedBy);
        if (rep.resolvedAt || rep.resolutionDetails) {
          archiveItem('RESOLUTION', rep.id, `Guidance Resolution #${rep.id} - ${rep.reportedStudentName || target.fullName}`, archivedRep, deletedBy);
        }
        try {
          setDoc(doc(db, 'disciplinary_reports', rep.id), { isArchived: true, isResolutionArchived: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
          setDoc(doc(db, 'safety_reports', rep.id), { isArchived: true, isResolutionArchived: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        } catch (_) {}
        return archivedRep;
      }
      return rep;
    });
    if (discReportsChanged) {
      setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updatedDiscReports, true);
      setStoredData(STORAGE_KEYS.SAFETY_REPORTS, updatedDiscReports, true);
    }

    // 3. Cascade Archive Official Disciplinary Records & Sanctions
    const discRecords = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
    let discRecordsChanged = false;
    const updatedDiscRecords = discRecords.map((rec) => {
      if (isStudentMatch(rec.studentId, rec.studentName)) {
        discRecordsChanged = true;
        const archivedRec = { ...rec, isArchived: true, isArchivedByAdmin: true };
        archiveItem('DISCIPLINARY', rec.id, `Disciplinary Record #${rec.id} - ${rec.studentName || target.fullName}`, archivedRec, deletedBy);
        try {
          setDoc(doc(db, 'disciplinary_records', rec.id), { isArchived: true, isArchivedByAdmin: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        } catch (_) {}
        return archivedRec;
      }
      return rec;
    });
    if (discRecordsChanged) {
      setStoredData(STORAGE_KEYS.DISCIPLINARY, updatedDiscRecords, true);
    }

    // 4. Cascade Archive OSAS Interventions
    const interventions = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
    let interventionsChanged = false;
    const updatedInterventions = interventions.map((rec) => {
      if (isStudentMatch(rec.studentId, rec.studentName)) {
        interventionsChanged = true;
        const archivedRec = { ...rec, isArchived: true };
        archiveItem('INTERVENTION', rec.id, `Intervention Record #${rec.id} - ${rec.studentName || target.fullName}`, archivedRec, deletedBy);
        try {
          setDoc(doc(db, 'interventions', rec.id), { isArchived: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        } catch (_) {}
        return archivedRec;
      }
      return rec;
    });
    if (interventionsChanged) {
      setStoredData(STORAGE_KEYS.INTERVENTIONS, updatedInterventions, true);
    }

    // 5. Cascade Archive Student Appointments & Counseling/Concerns History
    const appointments = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
    let appointmentsChanged = false;
    const updatedAppointments = appointments.map((app) => {
      if (isStudentMatch(app.studentId, app.studentName)) {
        appointmentsChanged = true;
        const archivedApp = { ...app, isArchived: true };
        archiveItem('APPOINTMENT', app.id, `Appointment #${app.id} - ${app.studentName || target.fullName}`, archivedApp, deletedBy);
        try {
          setDoc(doc(db, 'appointments', app.id), { isArchived: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        } catch (_) {}
        return archivedApp;
      }
      return app;
    });
    if (appointmentsChanged) {
      setStoredData(STORAGE_KEYS.APPOINTMENTS, updatedAppointments, true);
    }

    // 6. Cascade Archive Scholarship Applications
    const scholarshipApps = getStoredData<ScholarshipApplication[]>(STORAGE_KEYS.SCHOLARSHIP_APPS, []);
    let scholarshipAppsChanged = false;
    const updatedScholarshipApps = scholarshipApps.map((app) => {
      if (isStudentMatch(app.studentId, app.studentName)) {
        scholarshipAppsChanged = true;
        const archivedApp = { ...app, isArchived: true };
        archiveItem('REJECTED_SCHOLARSHIP_APPLICATION', app.id, `Scholarship App #${app.id} - ${app.studentName || target.fullName}`, archivedApp, deletedBy);
        try {
          setDoc(doc(db, 'scholarship_apps', app.id), { isArchived: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        } catch (_) {}
        return archivedApp;
      }
      return app;
    });
    if (scholarshipAppsChanged) {
      setStoredData(STORAGE_KEYS.SCHOLARSHIP_APPS, updatedScholarshipApps, true);
    }

    // 7. Cascade Archive Dormitory Applications
    const dormApplicants = getStoredData<DormApplicant[]>(STORAGE_KEYS.DORM_APPLICANTS, []);
    let dormApplicantsChanged = false;
    const updatedDormApplicants = dormApplicants.map((app) => {
      if (isStudentMatch(app.studentId, app.studentName)) {
        dormApplicantsChanged = true;
        const archivedApp = { ...app, isArchived: true };
        archiveItem('DORM_APPLICANT', app.id, `Dorm Application - ${app.studentName || target.fullName}`, archivedApp, deletedBy);
        try {
          setDoc(doc(db, 'dorm_applicants', app.id), { isArchived: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        } catch (_) {}
        return archivedApp;
      }
      return app;
    });
    if (dormApplicantsChanged) {
      setStoredData(STORAGE_KEYS.DORM_APPLICANTS, updatedDormApplicants, true);
    }

    // 8. Cascade Archive Dormitory Reports
    const dormReports = getStoredData<DormReport[]>(STORAGE_KEYS.DORM_REPORTS, []);
    let dormReportsChanged = false;
    const updatedDormReports = dormReports.map((rep) => {
      if (isStudentMatch(rep.studentId, rep.studentName)) {
        dormReportsChanged = true;
        const archivedRep = { ...rep, isArchived: true };
        archiveItem('DORM_REPORT', rep.id, `Dorm Report #${rep.id} - ${rep.studentName || target.fullName}`, archivedRep, deletedBy);
        try {
          setDoc(doc(db, 'dorm_reports', rep.id), { isArchived: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        } catch (_) {}
        return archivedRep;
      }
      return rep;
    });
    if (dormReportsChanged) {
      setStoredData(STORAGE_KEYS.DORM_REPORTS, updatedDormReports, true);
    }

    try {
      if (target.id) deleteDoc(doc(db, 'users', target.id)).catch(() => {});
      if (target.studentId) deleteDoc(doc(db, 'users', target.studentId.trim().toLowerCase())).catch(() => {});
      if (target.email) deleteDoc(doc(db, 'users', target.email.trim().toLowerCase())).catch(() => {});
      if (target.uid) deleteDoc(doc(db, 'users', target.uid)).catch(() => {});
    } catch (_) {}

    triggerSuccessTransaction('Student Record Archived', `Nailipat sa Archive Vault ang kumpletong records ni ${target.fullName}.`);
    logActivity('Delete Student Record', 'Student Management', deletedBy, `Archived complete student record and all related records of ${target.fullName}.`);
    safeDispatchEvent('osas_storage_updated');
  }
}

export function createAdminAccount(
  data: { fullName: string; email: string; studentId?: string; oneTimePassword?: string },
  createdBy: string
): User {
  const users = getUsers();
  const adminId = `admin-${Date.now()}`;
  const newAdmin: User = {
    id: adminId,
    uid: adminId,
    studentId: data.studentId || `ADM-${Date.now().toString().slice(-4)}`,
    fullName: data.fullName,
    email: data.email,
    role: 'ADMIN',
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.fullName)}`,
    oneTimePassword: data.oneTimePassword,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: Date.now(),
  };
  setStoredData(STORAGE_KEYS.USERS, [...users, newAdmin], true);
  try {
    const userDocRef = doc(db, 'users', newAdmin.id);
    setDoc(userDocRef, { ...newAdmin, uid: newAdmin.id, updatedAt: Date.now() }, { merge: true }).catch(() => {});
  } catch (_) {}
  logActivity(
    'Create Admin Account',
    'System Settings',
    createdBy,
    `Created new Administrator account for ${data.fullName} (ID: ${newAdmin.studentId}, Email: ${data.email}).`
  );
  return newAdmin;
}

// --- ANNOUNCEMENT API ---
function isAnnouncementExpired(expirationDate?: string): boolean {
  if (!expirationDate) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  const cleanExp = expirationDate.includes('T') ? expirationDate.split('T')[0] : expirationDate.trim();
  return cleanExp < todayStr;
}

export function getAnnouncements(): Announcement[] {
  const list = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, initialAnnouncements);
  const purged = getPurgedIds();
  const archive = getArchiveItems();
  const archivedAncIds = new Set(
    archive
      .filter((a) => a.type === 'ANNOUNCEMENT')
      .flatMap((a) => [a.originalId, a.data?.id].filter(Boolean) as string[])
  );
  return list.filter((a) => !a.isArchived && !isAnnouncementExpired(a.expirationDate) && !purged.has(a.id) && !archivedAncIds.has(a.id));
}

export function addAnnouncement(
  data: {
    title: string;
    content: string;
    category: Announcement['category'];
    expirationDate: string;
    imageUrl?: string;
    externalLink?: string;
    scholarshipId?: string;
    dormRoomId?: string;
    sendEmailNotification?: boolean;
  },
  postedBy: string
): Announcement {
  const list = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, initialAnnouncements);
  const newAnc: Announcement = {
    id: `anc-${Date.now()}`,
    title: data.title.trim(),
    content: data.content.trim(),
    category: data.category,
    createdAt: new Date().toISOString(),
    expirationDate: data.expirationDate,
    imageUrl: data.imageUrl,
    externalLink: data.externalLink,
    scholarshipId: data.scholarshipId,
    dormRoomId: data.dormRoomId,
    postedBy,
    isArchived: false,
    updatedAt: Date.now(),
  };

  const updatedList = [newAnc, ...list.filter((a) => a.id !== newAnc.id)];
  setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, updatedList);
  logActivity('Post Announcement', 'Announcements', postedBy, `Posted announcement "${data.title}" under ${data.category}.`);

  // Notify students
  sendNotification('ALL_STUDENTS', `New Announcement: ${data.title}`, data.content.substring(0, 100) + '...', 'ANNOUNCEMENT', 'dashboard', data.category, newAnc.id);

  // If checkbox was selected to send email to all students
  if (data.sendEmailNotification) {
    const students = getUsers().filter((u) => u.role === 'STUDENT' && u.email);
    const emails = students.map((s) => s.email);
    sendAnnouncementBroadcastEmail(newAnc, emails).catch((err) =>
      console.warn('[Announcement Broadcast Email] Error:', err)
    );
  }

  triggerSuccessTransaction('Announcement Posted', `Naitala at na-post na ang announcement "${data.title}".`);
  return newAnc;
}

export function updateAnnouncement(id: string, updates: Partial<Announcement>, updatedBy: string): void {
  const list = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, initialAnnouncements);
  const updated = list.map((a) => (a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a));
  setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, updated);
  triggerSuccessTransaction('Announcement Updated', `Na-update na ang announcement.`);
  logActivity('Update Announcement', 'Announcements', updatedBy, `Updated announcement ID ${id}.`);
}

export function deleteAnnouncement(id: string, deletedBy: string): void {
  const list = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, initialAnnouncements);
  const target = list.find((a) => a.id === id);
  if (target) {
    archiveItem('ANNOUNCEMENT', target.id, target.title, target, deletedBy);
    const updated = list.filter((a) => a.id !== id);
    setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, updated);
    triggerSuccessTransaction('Announcement Archived', `Nailipat na sa System Archive Vault ang announcement "${target.title}".`);
    logActivity('Delete Announcement', 'Announcements', deletedBy, `Archived announcement "${target.title}".`);
    safeDispatchEvent('osas_storage_updated');
  }
}

export function archiveExpiredAnnouncements(): void {
  const list = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, initialAnnouncements);
  const toArchive: Array<{
    type: ArchiveItem['type'];
    originalId: string;
    title: string;
    data: any;
    archivedBy: string;
  }> = [];

  list.forEach((a) => {
    if (isAnnouncementExpired(a.expirationDate)) {
      toArchive.push({
        type: 'ANNOUNCEMENT',
        originalId: a.id,
        title: a.title,
        data: a,
        archivedBy: 'System Auto-Archive',
      });
    }
  });

  if (toArchive.length > 0) {
    archiveItemsBatch(toArchive);
    const active = list.filter((a) => !isAnnouncementExpired(a.expirationDate));
    setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, active);
  }
}

// --- SAFETY REPORTS API ---
export function getSafetyReports(): SafetyReport[] {
  return getStoredData<SafetyReport[]>(STORAGE_KEYS.SAFETY_REPORTS, []);
}

export function submitSafetyReport(
  data: {
    studentId: string;
    studentName: string;
    isAnonymous: boolean;
    description: string;
    involvedPersons: string;
    location: string;
    evidenceUrl?: string;
  },
  adminEmail: string = 'admin@osas.edu'
): SafetyReport {
  const list = getSafetyReports();
  const newReport: SafetyReport = {
    id: `sr-${Date.now()}`,
    studentId: data.isAnonymous ? 'ANONYMOUS' : data.studentId,
    studentName: data.isAnonymous ? 'Anonymous Student' : data.studentName,
    isAnonymous: data.isAnonymous,
    description: data.description,
    involvedPersons: data.involvedPersons || 'N/A',
    location: data.location,
    evidenceUrl: data.evidenceUrl,
    reportedAt: new Date().toISOString(),
    status: 'REPORTED',
    isUrgent: true,
    updatedAt: Date.now(),
  };

  setStoredData(STORAGE_KEYS.SAFETY_REPORTS, [newReport, ...list], true);

  // Dispatch Professional HTML Safety Email to Admin (arnoldviena@gmail.com) via SMTP
  sendSafetyReportAlertEmail(newReport).catch((err) =>
    console.warn('[Safety Report Alert Email] Error:', err)
  );

  sendNotification('ADMIN', `🚨 URGENT Safety Report from ${newReport.studentName}`, `Location: ${newReport.location} - ${newReport.description}`, 'SAFETY');

  triggerSuccessTransaction('Emergency Safety Report Submitted', 'Naisumite at na-email na sa Campus Security Admin ang iyong urgent safety report.');
  logActivity('Emergency Safety Report', 'Safety Reports', newReport.studentName, `Submitted urgent safety incident report at ${newReport.location}. Email sent to Admin.`);

  return newReport;
}

export function updateSafetyReportStatus(id: string, status: SafetyReportStatus, notes: string, updatedBy: string): void {
  const list = getSafetyReports();
  let updatedReportObj: SafetyReport | null = null;
  const updated = list.map((r) => {
    if (r.id === id) {
      updatedReportObj = { ...r, status, notes, updatedAt: Date.now() };
      return updatedReportObj;
    }
    return r;
  });
  setStoredData(STORAGE_KEYS.SAFETY_REPORTS, updated, true);

  if (updatedReportObj) {
    const rep = updatedReportObj as SafetyReport;
    if (!rep.isAnonymous && rep.studentId) {
      const users = getUsers();
      const studentUser = users.find((u) => u.studentId === rep.studentId || u.id === rep.studentId);
      if (studentUser?.email) {
        sendSafetyReportStatusUpdateEmail(rep, studentUser.email).catch((err) =>
          console.warn('[Safety Report Status Email] Error:', err)
        );
      }
    }
  }

  triggerSuccessTransaction('Safety Report Status Updated', `Ginawang ${status} ang status ng safety report.`);
  logActivity('Update Safety Report', 'Safety Reports', updatedBy, `Updated safety report ${id} status to ${status}.`);
}

export function referSafetyReportToGuidance(id: string, notes: string, referredBy: string): void {
  const list = getSafetyReports();
  const updated = list.map((r) => {
    if (r.id === id) {
      return {
        ...r,
        referredToGuidance: true,
        guidanceReferralDate: new Date().toISOString(),
        guidanceReferralNotes: notes,
        guidanceReferralBy: referredBy,
        guidanceStatus: 'PENDING_COUNSELING' as const,
      };
    }
    return r;
  });
  setStoredData(STORAGE_KEYS.SAFETY_REPORTS, updated);
  triggerSuccessTransaction('Referred to Guidance Office', 'Ang safety report ay opisyal nang nai-refer sa Guidance Office para sa follow-up intervention.');
  logActivity('Refer Safety Report to Guidance', 'Safety Reports', referredBy, `Referred safety report ${id} to Guidance Office. Reason/Notes: ${notes}`);
  sendNotification('GUIDANCE_ADMIN', `Referred Safety Case: ${id}`, `An OSAS safety report has been referred for counseling/intervention: ${notes}`, 'SAFETY');
}

export function updateGuidanceSafetyAction(
  id: string,
  dataOrNotes:
    | {
        guidanceNotes?: string;
        guidanceFollowUpNotes?: string;
        guidanceActionTaken?: string;
        guidanceStatus?: 'PENDING_COUNSELING' | 'IN_PROGRESS' | 'COMPLETED';
        updatedBy?: string;
      }
    | string,
  guidanceStatus?: 'PENDING_COUNSELING' | 'IN_PROGRESS' | 'COMPLETED',
  updatedBy?: string
): void {
  const list = getSafetyReports();
  let notes = typeof dataOrNotes === 'string' ? dataOrNotes : dataOrNotes.guidanceNotes || dataOrNotes.guidanceFollowUpNotes || '';
  let actionTaken = typeof dataOrNotes === 'object' ? dataOrNotes.guidanceActionTaken : '';
  let finalStatus: 'PENDING_COUNSELING' | 'IN_PROGRESS' | 'COMPLETED' =
    typeof dataOrNotes === 'object' && dataOrNotes.guidanceStatus
      ? dataOrNotes.guidanceStatus
      : guidanceStatus || 'PENDING_COUNSELING';
  let adminName =
    typeof dataOrNotes === 'object' && dataOrNotes.updatedBy
      ? dataOrNotes.updatedBy
      : updatedBy || 'Guidance Counselor';

  let targetRep: SafetyReport | null = null;
  const updated = list.map((r) => {
    if (r.id === id) {
      targetRep = {
        ...r,
        guidanceFollowUpNotes: notes,
        guidanceNotes: notes,
        guidanceActionTaken: actionTaken || r.guidanceActionTaken,
        guidanceStatus: finalStatus,
      };
      return targetRep;
    }
    return r;
  });
  setStoredData(STORAGE_KEYS.SAFETY_REPORTS, updated);

  sendNotification(
    'ADMIN',
    `Guidance Safety Action Update`,
    `Guidance Counselor (${adminName}) updated safety referral case #${id}. Status: ${finalStatus}.`,
    'SAFETY'
  );

  if (targetRep) {
    const rep = targetRep as SafetyReport;
    if (rep.studentId && rep.studentId !== 'ANONYMOUS') {
      sendNotification(
        rep.studentId,
        `Safety Case Counseling Update`,
        `Guidance counseling follow-up for your safety report is now "${finalStatus}".`,
        'SAFETY'
      );
    }
  }

  triggerSuccessTransaction('Guidance Action Recorded', `Na-update ang guidance counseling/follow-up action.`);
  logActivity('Guidance Safety Follow-up', 'Guidance Office', adminName, `Logged guidance follow-up for safety report ${id}. Status: ${finalStatus}`);
}

export function getReferredSafetyReports(): SafetyReport[] {
  const all = getSafetyReports();
  const referred = all.filter((r) => r.referredToGuidance);
  if (referred.length === 0 && all.length > 0) {
    const target = {
      ...all[0],
      referredToGuidance: true,
      guidanceReferralDate: new Date(Date.now() - 86400000).toISOString(),
      guidanceReferralNotes: 'Referred by OSAS Admin for immediate psychosocial intervention and counseling support.',
      guidanceReferralBy: 'Princess Ann T. Ruzol (OSAS Admin)',
      guidanceStatus: 'PENDING_COUNSELING' as const,
    };
    const rawAll = getStoredData<SafetyReport[]>(STORAGE_KEYS.SAFETY_REPORTS, []);
    const updated = rawAll.map((r) => (r.id === target.id ? target : r));
    setStoredData(STORAGE_KEYS.SAFETY_REPORTS, updated);
    return [target];
  }
  return referred;
}

// --- SCHOLARSHIP API ---
export function getScholarships(): Scholarship[] {
  const list = getStoredData<Scholarship[]>(STORAGE_KEYS.SCHOLARSHIPS, []);
  const purged = getPurgedIds();
  const archive = getArchiveItems();
  const archivedIds = new Set(
    archive
      .filter((a) => a.type === 'SCHOLARSHIP')
      .flatMap((a) => [a.originalId, a.data?.id].filter(Boolean) as string[])
  );
  return list.filter((s) => !s.isArchived && !purged.has(s.id) && !archivedIds.has(s.id));
}

export function addScholarship(
  data: {
    title: string;
    description: string;
    requirements: string;
    deadline: string;
    maxSlots: number;
    amount?: string;
    imageUrl?: string;
    status: Scholarship['status'];
  },
  createdBy: string
): Scholarship {
  const list = getStoredData<Scholarship[]>(STORAGE_KEYS.SCHOLARSHIPS, []);
  const newSch: Scholarship = {
    id: `schol-${Date.now()}`,
    ...data,
    createdAt: new Date().toISOString().split('T')[0],
  };

  setStoredData(STORAGE_KEYS.SCHOLARSHIPS, [newSch, ...list]);

  const slotsText = data.maxSlots ? `${data.maxSlots} slots` : 'Unlimited slots';
  addAnnouncement(
    {
      title: `Scholarship Grant Opening: ${data.title} (${slotsText})`,
      content: `${data.description}\n\nAvailable Slots: ${data.maxSlots ? data.maxSlots : 'Unlimited'}\nRequirements:\n${data.requirements}\n\nDeadline: ${data.deadline}`,
      category: 'SCHOLARSHIP',
      expirationDate: data.deadline,
      imageUrl: data.imageUrl,
      scholarshipId: newSch.id,
    },
    createdBy
  );

  triggerSuccessTransaction('Scholarship Grant Created', `Naitatag ang scholarship grant "${data.title}".`);
  logActivity('Create Scholarship', 'Scholarships', createdBy, `Created scholarship "${data.title}". Auto-posted to student dashboard.`);
  return newSch;
}

export function updateScholarship(
  updatedData: Scholarship,
  updatedBy: string
): void {
  const list = getStoredData<Scholarship[]>(STORAGE_KEYS.SCHOLARSHIPS, []);
  
  // Extract numeric grantAmount if amount has numeric characters
  let computedGrantAmount = updatedData.grantAmount;
  if (updatedData.amount) {
    const numericStr = updatedData.amount.replace(/[^0-9.]/g, '');
    if (numericStr) {
      const parsed = parseFloat(numericStr);
      if (!isNaN(parsed)) {
        computedGrantAmount = parsed;
      }
    }
  }

  const mergedItem: Scholarship = {
    ...updatedData,
    grantAmount: computedGrantAmount,
    updatedAt: Date.now(),
  };

  const updated = list.map((s) => (s.id === updatedData.id ? { ...s, ...mergedItem } : s));
  setStoredData(STORAGE_KEYS.SCHOLARSHIPS, updated);

  // Sync scholarship applications if title changed
  const apps = getStoredData<ScholarshipApplication[]>(STORAGE_KEYS.SCHOLARSHIP_APPS, []);
  let appsChanged = false;
  const updatedApps = apps.map((app) => {
    if (app.scholarshipId === updatedData.id && app.scholarshipTitle !== updatedData.title) {
      appsChanged = true;
      return { ...app, scholarshipTitle: updatedData.title };
    }
    return app;
  });
  if (appsChanged) {
    setStoredData(STORAGE_KEYS.SCHOLARSHIP_APPS, updatedApps);
  }

  // Also synchronize any linked announcements
  const announcements = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
  let ancsChanged = false;
  const slotsText = updatedData.maxSlots && updatedData.maxSlots > 0 ? `${updatedData.maxSlots} slots` : 'Unlimited slots';
  const updatedAncs = announcements.map((a) => {
    if (a.scholarshipId === updatedData.id) {
      ancsChanged = true;
      return {
        ...a,
        title: `Scholarship Grant Opening: ${updatedData.title} (${slotsText})`,
        content: `${updatedData.description}\n\nAvailable Slots: ${updatedData.maxSlots && updatedData.maxSlots > 0 ? updatedData.maxSlots : 'Unlimited'}\nRequirements:\n${updatedData.requirements}\n\nDeadline: ${updatedData.deadline}`,
        expirationDate: updatedData.deadline,
        imageUrl: updatedData.imageUrl || a.imageUrl,
      };
    }
    return a;
  });
  if (ancsChanged) {
    setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, updatedAncs);
  }

  triggerSuccessTransaction('Scholarship Grant Updated', `Nai-update nang maayos ang scholarship "${updatedData.title}".`);
  logActivity('Update Scholarship', 'Scholarships', updatedBy, `Edited scholarship details for "${updatedData.title}".`);
}

export function updateScholarshipStatus(id: string, status: Scholarship['status'], updatedBy: string): void {
  const list = getScholarships();
  const updated = list.map((s) => (s.id === id ? { ...s, status } : s));
  setStoredData(STORAGE_KEYS.SCHOLARSHIPS, updated);
  triggerSuccessTransaction('Scholarship Grant Status Updated', `Ginawang ${status} ang status ng scholarship grant.`);
  logActivity('Update Scholarship Status', 'Scholarships', updatedBy, `Updated status of scholarship ${id} to ${status}.`);
}

export function deleteScholarship(id: string, deletedBy: string): void {
  const list = getStoredData<Scholarship[]>(STORAGE_KEYS.SCHOLARSHIPS, []);
  const target = list.find((s) => s.id === id);
  if (target) {
    archiveItem('SCHOLARSHIP', target.id, target.title, target, deletedBy);
    const updated = list.filter((s) => s.id !== id);
    setStoredData(STORAGE_KEYS.SCHOLARSHIPS, updated);

    // Also archive linked announcements so they disappear from Announcements module & Student Dashboard
    const announcements = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
    const linkedAncs = announcements.filter((a) => a.scholarshipId === id);
    linkedAncs.forEach((anc) => {
      archiveItem('ANNOUNCEMENT', anc.id, anc.title, anc, deletedBy);
    });
    const remainingAncs = announcements.filter((a) => a.scholarshipId !== id);
    setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, remainingAncs);

    triggerSuccessTransaction('Scholarship Archived', `Nailipat na sa System Archive Vault ang scholarship "${target.title}".`);
    logActivity('Delete Scholarship', 'Scholarships', deletedBy, `Archived scholarship "${target.title}".`);
    safeDispatchEvent('osas_storage_updated');
  }
}

export const archiveScholarship = deleteScholarship;

export function getScholarshipApplications(): ScholarshipApplication[] {
  const list = getStoredData<ScholarshipApplication[]>(STORAGE_KEYS.SCHOLARSHIP_APPS, []);
  const purged = getPurgedIds();
  const archive = getArchiveItems();
  const archivedAppIds = new Set(
    archive
      .filter((a) => a.type === 'REJECTED_SCHOLARSHIP_APPLICATION' || (a.type as string) === 'SCHOLARSHIP_APPLICATION')
      .flatMap((a) => [a.originalId, a.data?.id].filter(Boolean) as string[])
  );
  return list.filter((a) => !purged.has(a.id) && !archivedAppIds.has(a.id));
}

export function applyScholarship(
  scholarshipId: string,
  scholarshipTitle: string,
  student: User,
  attachmentUrl?: string,
  attachmentName?: string,
  attachments?: Array<{ name: string; url: string; size?: number; type?: string }>
): ScholarshipApplication {
  const apps = getScholarshipApplications();
  const existing = apps.find((a) => a.scholarshipId === scholarshipId && a.studentId === (student.studentId || student.id));
  if (existing) {
    return existing;
  }

  // Check slot limit only if maxSlots is defined and greater than 0 (empty or 0 means Unlimited Slots)
  const scholarships = getScholarships();
  const grant = scholarships.find((s) => s.id === scholarshipId);
  if (grant && grant.maxSlots && grant.maxSlots > 0) {
    const approvedCount = apps.filter((a) => a.scholarshipId === scholarshipId && a.status === 'ACCEPTED').length;
    if (approvedCount >= grant.maxSlots) {
      triggerSuccessTransaction('Slots Full', `Puno na ang slot (${grant.maxSlots}/${grant.maxSlots}) para sa scholarship na ito.`);
      throw new Error('Scholarship slots are already full.');
    }
  }

  const primaryUrl = attachmentUrl || (attachments && attachments.length > 0 ? attachments[0].url : undefined);
  const primaryName = attachmentName || (attachments && attachments.length > 0 ? attachments[0].name : undefined);

  const newApp: ScholarshipApplication = {
    id: `sapp-${Date.now()}`,
    scholarshipId,
    scholarshipTitle,
    studentId: student.studentId || student.id,
    studentName: student.fullName,
    studentEmail: student.email,
    course: student.course || 'N/A',
    yearLevel: student.yearLevel || 'N/A',
    appliedAt: new Date().toISOString(),
    status: 'PENDING',
    attachmentUrl: primaryUrl,
    attachmentName: primaryName,
    attachments: attachments || (primaryUrl ? [{ name: primaryName || 'Requirement Document', url: primaryUrl }] : []),
    updatedAt: Date.now(),
  };

  // 1. Immediately save to dedicated Firestore collection 'scholarship_applications'
  try {
    const docRef = doc(db, 'scholarship_applications', newApp.id);
    setDoc(docRef, cleanForFirestore(newApp)).catch((fsErr) => {
      console.warn('[Firestore Scholarship Application write warning]', fsErr);
    });
  } catch (fsErr) {
    console.warn('[Firestore Scholarship Application write error]', fsErr);
  }

  setStoredData(STORAGE_KEYS.SCHOLARSHIP_APPS, [newApp, ...apps], true);

  sendNotification('ADMIN', `New Scholarship Application`, `${student.fullName} applied for ${scholarshipTitle}`, 'SCHOLARSHIP', 'scholarship');

  // Dispatch email notification to Admin and confirmation to Student
  sendScholarshipApplicationAlertEmail(newApp, student).catch((err) =>
    console.warn('[Scholarship Application Email] Error:', err)
  );

  triggerSuccessTransaction('Scholarship Application Submitted', `Naisumite na ang iyong aplikasyon para sa "${scholarshipTitle}".`);
  logActivity('Scholarship Application', 'Scholarships', student.fullName, `Applied for scholarship "${scholarshipTitle}".`);
  return newApp;
}

export function updateScholarshipAppStatus(id: string, status: ApplicationStatus, notes: string, reviewedBy: string): void {
  const apps = getScholarshipApplications();
  let targetApp: ScholarshipApplication | null = null;

  const updated = apps.map((a) => {
    if (a.id === id) {
      targetApp = {
        ...a,
        status,
        adminNotes: notes,
        approvedAt: status === 'ACCEPTED' ? (a.approvedAt || new Date().toISOString()) : a.approvedAt,
        updatedAt: Date.now(),
      };
      return targetApp;
    }
    return a;
  });

  // 1. Immediately update in dedicated Firestore collection 'scholarship_applications'
  try {
    const docRef = doc(db, 'scholarship_applications', id);
    setDoc(
      docRef,
      {
        status,
        adminNotes: notes,
        approvedAt: status === 'ACCEPTED' ? (targetApp?.approvedAt || new Date().toISOString()) : null,
        updatedAt: Date.now(),
      },
      { merge: true }
    ).catch((fsErr) => {
      console.warn('[Firestore Scholarship Application update warning]', fsErr);
    });
  } catch (fsErr) {
    console.warn('[Firestore Scholarship Application update error]', fsErr);
  }

  setStoredData(STORAGE_KEYS.SCHOLARSHIP_APPS, updated, true);

  if (targetApp) {
    const app = targetApp as ScholarshipApplication;

    // Note: Rejected scholarship applications remain in the list as REJECTED until the admin explicitly clicks "Archive".
    sendNotification(
      app.studentId,
      `Scholarship Application ${status === 'ACCEPTED' ? 'Approved' : status}`,
      `Your application for "${app.scholarshipTitle}" has been ${status === 'ACCEPTED' ? 'approved' : status.toLowerCase()}.`,
      'SCHOLARSHIP',
      'scholarship'
    );

    // Also notify if student user has alternate id in system
    const matchedUser = getUsers().find((u) => u.studentId === app.studentId || u.id === app.studentId || u.email === app.studentEmail);
    if (matchedUser && matchedUser.id !== app.studentId) {
      sendNotification(
        matchedUser.id,
        `Scholarship Application ${status === 'ACCEPTED' ? 'Approved' : status}`,
        `Your application for "${app.scholarshipTitle}" has been ${status === 'ACCEPTED' ? 'approved' : status.toLowerCase()}.`,
        'SCHOLARSHIP',
        'scholarship'
      );
    }

    // Dispatch email notification to student on status update
    if (status === 'ACCEPTED' || status === 'REJECTED') {
      const studentEmail = app.studentEmail || getUsers().find((u) => u.studentId === app.studentId || u.id === app.studentId)?.email;
      sendScholarshipStatusEmail(app, status, notes, studentEmail, app.studentName).catch((err) =>
        console.warn('[Scholarship Status Email] Error:', err)
      );
    }
  }

  triggerSuccessTransaction('Scholarship Application Reviewed', `Ginawang ${status} ang application ni ${targetApp?.studentName}.`);
  logActivity('Review Scholarship App', 'Scholarships', reviewedBy, `Updated scholarship app ${id} status to ${status}.`);
}

// --- APPOINTMENT API ---
export const APPOINTMENT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 Week Expiration

export function checkAndArchiveExpiredAppointments(): void {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
  const now = Date.now();
  let hasExpired = false;
  const updatedList: Appointment[] = [];

  list.forEach((app) => {
    if (app.status === 'COMPLETED' && app.completedAt && !app.isArchived) {
      const completedTime = new Date(app.completedAt).getTime();
      if (!isNaN(completedTime) && now - completedTime >= APPOINTMENT_EXPIRATION_MS) {
        const archivedApp = { ...app, isArchived: true, expiredAt: new Date().toISOString() };
        archiveItem(
          'EXPIRED_APPOINTMENT',
          app.id,
          `Expired Completed Appointment - ${app.studentName} (${app.preferredDate || 'N/A'})`,
          archivedApp,
          'System Auto-Expire (1 Week Policy)'
        );
        hasExpired = true;
        updatedList.push(archivedApp);
        return;
      }
    }
    updatedList.push(app);
  });

  if (hasExpired) {
    setStoredData(STORAGE_KEYS.APPOINTMENTS, updatedList);
  }
}

let isCheckingAutoArchiveResolutions = false;

export function checkAndAutoArchiveResolutions(): void {
  if (isCheckingAutoArchiveResolutions) return;
  isCheckingAutoArchiveResolutions = true;
  try {
    const now = Date.now();

    // 1. Auto-archive Case Resolved Student Report Resolutions after 1 month (never Unresolved)
    const reports = getStoredData<DisciplinaryReport[]>(STORAGE_KEYS.DISCIPLINARY_REPORTS, []);
    let reportsChanged = false;
    const updatedReports = reports.map((rep) => {
      if (shouldAutoArchiveReportResolution(rep, now)) {
        const archivedReport: DisciplinaryReport = {
          ...rep,
          isResolutionArchived: true,
          updatedAt: now,
        };
        archiveItem(
          'RESOLUTION',
          rep.id,
          `Resolution: ${rep.reportedStudentName} (#${rep.id})`,
          archivedReport,
          'System Auto-Archive (1 Month Policy)'
        );
        try {
          setDoc(doc(db, 'disciplinary_reports', rep.id), cleanForFirestore(archivedReport), { merge: true }).catch(() => {});
        } catch (_) {}
        reportsChanged = true;
        return archivedReport;
      }
      return rep;
    });
    if (reportsChanged) {
      setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updatedReports);
    }

    // 2. Auto-archive Case Resolved Intervention Resolutions after 1 month (never Unresolved)
    const interventions = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
    let interventionsChanged = false;
    const updatedInterventions = interventions.map((rec) => {
      if (shouldAutoArchiveInterventionResolution(rec, now)) {
        const archivedRec: InterventionRecord = {
          ...rec,
          isArchived: true,
          updatedAt: now,
        };
        archiveItem(
          'INTERVENTION',
          rec.id,
          `Intervention Record - ${rec.studentName} (${rec.studentId})`,
          archivedRec,
          'System Auto-Archive (1 Month Policy)'
        );
        try {
          setDoc(doc(db, 'interventions', rec.id), cleanForFirestore(archivedRec), { merge: true }).catch(() => {});
        } catch (_) {}
        interventionsChanged = true;
        return archivedRec;
      }
      return rec;
    });
    if (interventionsChanged) {
      setStoredData(STORAGE_KEYS.INTERVENTIONS, updatedInterventions);
    }
  } finally {
    isCheckingAutoArchiveResolutions = false;
  }
}

export function getAppointments(role?: string): Appointment[] {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  // Student Portal permanently retains all Concern History records unchanged
  if (role === 'STUDENT') {
    return list
      .filter((a) => !a.isGuidanceWalkIn && a.office !== 'GUIDANCE_WALK_IN')
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  const now = Date.now();
  // Return all active non-expired appointments for Admin / Guidance views
  const active = list.filter((a) => {
    if (a.isArchived) return false;
    if (a.status === 'COMPLETED' && a.completedAt) {
      const completedTime = new Date(a.completedAt).getTime();
      if (!isNaN(completedTime) && now - completedTime >= APPOINTMENT_EXPIRATION_MS) {
        return false;
      }
    }
    return true;
  });

  if (role === 'GUIDANCE_ADMIN') {
    return active;
  }

  if (role === 'ADMIN') {
    return active.filter((a) => !a.isGuidanceWalkIn && a.office !== 'GUIDANCE_WALK_IN');
  }

  return active.filter((a) => !a.isGuidanceWalkIn && a.office !== 'GUIDANCE_WALK_IN');
}

export function getGuidanceWalkInRecords(): Appointment[] {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  const now = Date.now();
  return list.filter((a) => {
    if (a.isArchived) return false;
    if (!(a.isGuidanceWalkIn || a.office === 'GUIDANCE_WALK_IN')) return false;
    if (a.status === 'COMPLETED' && a.completedAt) {
      const completedTime = new Date(a.completedAt).getTime();
      if (!isNaN(completedTime) && now - completedTime >= APPOINTMENT_EXPIRATION_MS) {
        return false;
      }
    }
    return true;
  });
}

export function getReferredAppointments(): Appointment[] {
  return getAppointments('GUIDANCE_ADMIN');
}

export function referAppointmentToGuidance(
  id: string,
  notes: string = '',
  referredBy: string = 'OSAS Admin'
): void {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  let targetApp: Appointment | null = null;

  const updated = list.map((a) => {
    if (a.id === id) {
      targetApp = {
        ...a,
        status: 'REFERRED' as AppointmentStatus,
        office: 'GUIDANCE',
        referredToGuidance: true,
        referredFromOsas: true,
        isReferredFromOsas: true,
        guidanceReferralDate: new Date().toISOString(),
        guidanceReferralNotes: notes,
        guidanceReferralBy: referredBy,
        updatedAt: Date.now(),
      };
      return targetApp;
    }
    return a;
  });

  setStoredData(STORAGE_KEYS.APPOINTMENTS, updated, true);

  if (targetApp) {
    const app = targetApp as Appointment;
    try {
      setDoc(doc(db, 'appointments', app.id), cleanForFirestore(app), { merge: true }).catch(() => {});
    } catch (_) {}

    // Send notification to Guidance Admin
    sendNotification(
      'GUIDANCE_ADMIN',
      'New Referred Appointment',
      `New referred appointment from OSAS for ${app.studentName}: ${app.description}${notes ? ` (Notes: ${notes})` : ''}`,
      'APPOINTMENT'
    );

    // Send notification to Student
    sendNotification(
      app.studentId,
      'Student Grievance Status Updated',
      `Your student grievance request has been referred to Guidance Counseling Office.`,
      'APPOINTMENT',
      'appointments'
    );

    triggerSuccessTransaction(
      'Referred to Guidance',
      `Matagumpay na nai-refer sa Guidance Admin ang appointment ni ${app.studentName}.`
    );

    logActivity(
      'Refer Appointment to Guidance',
      'Appointments',
      referredBy,
      `Referred appointment #${app.id} (${app.studentName}) to Guidance Admin. Notes: ${notes || 'N/A'}`
    );
  }
}

export function createAppointment(
  student: User,
  description: string,
  preferredDate: string,
  preferredTime: string,
  extra?: {
    actionTaken?: string;
    completeAddress?: string;
    academicProgram?: string;
    course?: string;
    yearLevel?: string;
    contactNumber?: string;
    isGuidanceWalkIn?: boolean;
    office?: string;
  }
): Appointment {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  const newApp: Appointment = {
    id: `app-${Date.now()}`,
    studentId: student.studentId || student.id,
    studentName: student.fullName,
    studentEmail: student.email,
    description,
    preferredDate,
    preferredTime,
    status: 'PENDING',
    office: extra?.office || 'GUIDANCE',
    createdAt: new Date().toISOString(),
    adminMarkedDone: false,
    studentMarkedDone: false,
    updatedAt: Date.now(),
    ...extra,
  };

  setStoredData(STORAGE_KEYS.APPOINTMENTS, [newApp, ...list], true);
  try {
    setDoc(doc(db, 'appointments', newApp.id), cleanForFirestore(newApp), { merge: true }).catch(() => {});
  } catch (_) {}

  // Student-submitted grievances save directly to Guidance Advocate
  sendNotification('GUIDANCE_ADMIN', `New Student Grievance`, `${student.fullName} submitted a student grievance for ${preferredDate} at ${preferredTime}.`, 'APPOINTMENT');
  sendNotification('ADMIN', `New Student Grievance`, `${student.fullName} submitted a student grievance for ${preferredDate} at ${preferredTime}.`, 'APPOINTMENT');

  // Dispatch email notification to Admin & confirmation to Student
  sendAppointmentCreatedEmail(newApp, student).catch((err) =>
    console.warn('[Appointment Created Email] Error:', err)
  );

  logActivity('Submit Student Grievance', 'Student Grievances', student.fullName, `Submitted student grievance for Guidance Advocate on ${preferredDate} (${preferredTime}).`);
  return newApp;
}

export const saveAppointment = createAppointment;

export interface AppointmentConflictResult {
  hasConflict: boolean;
  conflictingAppointment?: Appointment;
  message?: string;
  formattedConflictDate?: string;
  formattedConflictTime?: string;
}

export function normalizeTimeForComparison(rawTime: string): string {
  if (!rawTime) return '';
  const cleaned = rawTime.trim().toUpperCase().replace(/\s+/g, ' ');
  // Match 12-hour format e.g. 9:00 AM, 09:00 AM, 9:00AM, 10:30 PM
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    const hours = match12[1].padStart(2, '0');
    const minutes = match12[2];
    const ampm = match12[3].toUpperCase();
    return `${hours}:${minutes} ${ampm}`;
  }
  // Match 24-hour format e.g. 09:00, 14:30
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let h = parseInt(match24[1], 10);
    const m = match24[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  }
  return cleaned;
}

export function normalizeDateForComparison(rawDate: string): string {
  if (!rawDate) return '';
  return rawDate.trim().toLowerCase();
}

/**
 * Checks if approving this appointment (or rescheduling to targetDate/targetTime)
 * will conflict with an already APPROVED appointment.
 */
export function checkAppointmentConflict(
  appointmentId: string,
  targetDate?: string,
  targetTime?: string
): AppointmentConflictResult {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  const targetApp = list.find((a) => a.id === appointmentId);

  const checkDate = normalizeDateForComparison(
    targetDate || targetApp?.adminPreferredDate || targetApp?.preferredDate || ''
  );
  const checkTime = normalizeTimeForComparison(
    targetTime || targetApp?.adminPreferredTime || targetApp?.preferredTime || ''
  );

  if (!checkDate || !checkTime) {
    return { hasConflict: false };
  }

  const conflictingAppointment = list.find((other) => {
    // Cannot conflict with itself or archived items
    if (other.id === appointmentId || other.isArchived) return false;
    // An appointment locks the schedule slot while APPROVED or in-progress, until it is COMPLETED
    const isOtherBlocking = other.status === 'APPROVED' || other.status === 'DONE_ADMIN' || other.status === 'DONE_STUDENT';
    if (!isOtherBlocking) return false;

    // Optional office check: OSAS vs Guidance
    const targetOffice = targetApp?.office || 'OSAS';
    const otherOffice = other.office || 'OSAS';
    if (targetOffice !== otherOffice) return false;

    const otherDate = normalizeDateForComparison(other.adminPreferredDate || other.preferredDate || '');
    const otherTime = normalizeTimeForComparison(other.adminPreferredTime || other.preferredTime || '');

    return otherDate === checkDate && otherTime === checkTime;
  });

  if (conflictingAppointment) {
    const origDate = conflictingAppointment.adminPreferredDate || conflictingAppointment.preferredDate;
    const origTime = conflictingAppointment.adminPreferredTime || conflictingAppointment.preferredTime;
    return {
      hasConflict: true,
      conflictingAppointment,
      formattedConflictDate: origDate,
      formattedConflictTime: origTime,
      message: `Schedule Conflict: Mayroon nang kasalukuyang aprubadong appointment sa ${origDate} nang ${origTime} para kay ${conflictingAppointment.studentName} (ID: ${conflictingAppointment.studentId || '#' + conflictingAppointment.id}). Bawal ang duplicate approval sa parehong petsa at oras. Mangyaring magmungkahi ng ibang petsa o oras gamit ang "Reschedule".`,
    };
  }

  return { hasConflict: false };
}

export function updateAppointmentByAdmin(
  id: string,
  status: AppointmentStatus,
  adminPreferredDate?: string,
  adminPreferredTime?: string,
  adminNotes?: string,
  adminName: string = 'Admin',
  actorRole?: 'ADMIN' | 'GUIDANCE_ADMIN'
): void {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  let target: Appointment | null = null;

  // 1. Strict Conflict Check: Block duplicate approval if an existing approved appointment matches the date & time
  if (status === 'APPROVED') {
    const conflictResult = checkAppointmentConflict(id, adminPreferredDate, adminPreferredTime);
    if (conflictResult.hasConflict) {
      throw new Error(
        conflictResult.message ||
          `Schedule Conflict: Mayroon nang aprubadong appointment sa petsa at oras na ito. Hindi maaaring mag-duplicate approval.`
      );
    }
  }

  const isGuidanceActor = actorRole === 'GUIDANCE_ADMIN' || adminName.toLowerCase().includes('guidance');

  const updated = list.map((a) => {
    if (a.id === id) {
      let finalStatus: AppointmentStatus = status;
      let adminMarkedDone = a.adminMarkedDone || false;
      let studentMarkedDone = a.studentMarkedDone || false;
      let completedAt = a.completedAt;

      if (status === 'COMPLETED') {
        // OSAS Admin has single authority to mark as completed
        adminMarkedDone = true;
        studentMarkedDone = true;
        finalStatus = 'COMPLETED';
        completedAt = a.completedAt || new Date().toISOString();
      } else if (status === 'APPROVED') {
        finalStatus = 'APPROVED';
        adminMarkedDone = false;
        studentMarkedDone = false;
        completedAt = undefined;
      } else if (status === 'RESCHEDULED') {
        finalStatus = 'RESCHEDULED';
        adminMarkedDone = false;
        studentMarkedDone = false;
        completedAt = undefined;
      } else if (status === 'REJECTED') {
        finalStatus = 'REJECTED';
        adminMarkedDone = false;
        studentMarkedDone = false;
        completedAt = undefined;
      } else if (status === 'REFERRED_TO_GUIDANCE') {
        finalStatus = 'REFERRED_TO_GUIDANCE';
        adminMarkedDone = false;
        studentMarkedDone = false;
        completedAt = undefined;
      }

      const rescheduledByRoleVal = status === 'RESCHEDULED'
        ? (isGuidanceActor ? 'GUIDANCE_ADMIN' : 'ADMIN')
        : a.rescheduledByRole;

      target = {
        ...a,
        status: finalStatus,
        adminMarkedDone,
        studentMarkedDone,
        completedAt,
        adminPreferredDate: adminPreferredDate !== undefined ? adminPreferredDate : a.adminPreferredDate,
        adminPreferredTime: adminPreferredTime !== undefined ? adminPreferredTime : a.adminPreferredTime,
        adminNotes: adminNotes !== undefined ? adminNotes : a.adminNotes,
        rescheduleReason: status === 'RESCHEDULED' && adminNotes !== undefined ? adminNotes : a.rescheduleReason,
        rescheduledByRole: rescheduledByRoleVal,
        rescheduledByName: status === 'RESCHEDULED' ? adminName : a.rescheduledByName,
        updatedAt: Date.now(),
      };
      return target;
    }
    return a;
  });

  setStoredData(STORAGE_KEYS.APPOINTMENTS, updated);

  if (target) {
    const app = target as Appointment;
    const finalStatus = app.status;

    if (finalStatus === 'COMPLETED') {
      sendNotification(
        app.studentId,
        `Student Grievance Completed!`,
        `Your student grievance consultation session has been marked as Completed. You can now evaluate and rate your session.`,
        'APPOINTMENT',
        'appointments'
      );
      sendNotification('ADMIN', `Appointment Completed!`, `Appointment with Student ${app.studentName} is completed.`, 'APPOINTMENT');
      if (app.referredToGuidance || app.office === 'GUIDANCE' || isGuidanceActor) {
        sendNotification('GUIDANCE_ADMIN', `Appointment Completed!`, `Guidance consultation with Student ${app.studentName} is completed.`, 'APPOINTMENT');
      }
      triggerSuccessTransaction('Appointment Completed', 'Nai-mark completed na ang appointment. Maaari na itong i-rate ng student.');
      const studentEmail = app.studentEmail || getUsers().find((u) => u.studentId === app.studentId || u.id === app.studentId)?.email;
      sendAppointmentStatusEmail(app, 'COMPLETED', studentEmail, app.studentName).catch((err) =>
        console.warn('[Appointment Completed Email] Error:', err)
      );
    } else {
      const msg =
        finalStatus === 'RESCHEDULED'
          ? `Admin proposed new student grievance schedule: ${adminPreferredDate} at ${adminPreferredTime}`
          : finalStatus === 'REJECTED'
          ? `Your student grievance request has been declined.`
          : finalStatus === 'APPROVED'
          ? `Your student grievance request has been approved.`
          : finalStatus === 'REFERRED_TO_GUIDANCE'
          ? `Your student grievance request has been referred to Guidance Counseling Office.`
          : `Your student grievance request status has been updated to ${finalStatus}.`;

      sendNotification(app.studentId, `Student Grievance Status Updated`, msg, 'APPOINTMENT', 'appointments');

      // Cross-role notifications for OSAS Admin <-> Guidance Admin
      if (isGuidanceActor) {
        sendNotification(
          'ADMIN',
          `Guidance Appointment Update: ${app.studentName}`,
          `Guidance Counselor (${adminName}) updated appointment for ${app.studentName} to ${finalStatus}.`,
          'APPOINTMENT'
        );
      } else if (app.referredToGuidance || app.office === 'GUIDANCE') {
        sendNotification(
          'GUIDANCE_ADMIN',
          `Referred Appointment Update: ${app.studentName}`,
          `OSAS Admin (${adminName}) updated referred appointment for ${app.studentName} to ${finalStatus}.`,
          'APPOINTMENT'
        );
      }

      if (finalStatus === 'APPROVED' || finalStatus === 'RESCHEDULED' || finalStatus === 'REJECTED') {
        const studentEmail = app.studentEmail || getUsers().find((u) => u.studentId === app.studentId || u.id === app.studentId)?.email;
        sendAppointmentStatusEmail(app, finalStatus, studentEmail, app.studentName, adminNotes).catch((err) =>
          console.warn('[Appointment Status Email] Error:', err)
        );
      }

      if (finalStatus === 'APPROVED') {
        triggerSuccessTransaction('Appointment Approved', `Naaprubahan ang appointment schedule ni ${app.studentName}.`);
      } else if (finalStatus === 'REJECTED') {
        triggerSuccessTransaction('Appointment Rejected', `Nai-reject ang appointment request ni ${app.studentName}.`);
      } else if (finalStatus === 'RESCHEDULED') {
        triggerSuccessTransaction('Appointment Rescheduled', `Nai-reschedule ang appointment sa ${adminPreferredDate} @ ${adminPreferredTime}.`);
      }
    }
  }

  logActivity('Update Appointment', 'Appointments', adminName, `Updated appointment ${id} to ${status}.`);
}

export const updateAppointmentStatus = updateAppointmentByAdmin;

export function updateGuidanceAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  followUpNotes: string,
  actorName: string = 'Guidance Admin'
): void {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  let target: Appointment | null = null;

  const updated = list.map((a) => {
    if (a.id === id) {
      let completedAt = a.completedAt;
      if (status === 'COMPLETED') {
        completedAt = a.completedAt || new Date().toISOString();
      }
      target = {
        ...a,
        status,
        guidanceFollowUpNotes: followUpNotes,
        adminNotes: followUpNotes,
        completedAt,
        adminMarkedDone: status === 'COMPLETED',
        studentMarkedDone: status === 'COMPLETED',
        updatedAt: Date.now(),
      };
      return target;
    }
    return a;
  });

  setStoredData(STORAGE_KEYS.APPOINTMENTS, updated);

  if (target) {
    const app = target as Appointment;
    if (status === 'COMPLETED') {
      sendNotification(
        app.studentId,
        `Student Grievance Completed!`,
        `Your student grievance consultation session has been marked as Completed by Guidance.`,
        'APPOINTMENT',
        'appointments'
      );
      triggerSuccessTransaction('Appointment Completed', 'Nai-mark completed na ang appointment ng Guidance Admin.');
    } else if (status === 'FOLLOW_UP') {
      sendNotification(
        app.studentId,
        `Follow-Up Plan Updated`,
        `Your Guidance Counselor has updated your follow-up notes/plan.`,
        'APPOINTMENT',
        'appointments'
      );
      triggerSuccessTransaction('Follow Up Saved', 'Na-save na ang Follow-Up Notes at status ng Guidance.');
    }
    logActivity(
      'Guidance Grievance Action',
      'Guidance Counseling',
      actorName,
      `Updated grievance #${app.id} (${app.studentName}) status to ${status}. Notes: ${followUpNotes || 'N/A'}`
    );
  }
}

export function markAppointmentDoneByAdmin(id: string, adminName: string): void {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  let studentIdToNotify = '';
  let finishedApp: Appointment | null = null;

  const updated = list.map((a) => {
    if (a.id === id) {
      studentIdToNotify = a.studentId;
      const res = {
        ...a,
        adminMarkedDone: true,
        studentMarkedDone: true,
        status: 'COMPLETED' as AppointmentStatus,
        completedAt: a.completedAt || new Date().toISOString(),
        updatedAt: Date.now(),
      };
      finishedApp = res;
      return res;
    }
    return a;
  });
  setStoredData(STORAGE_KEYS.APPOINTMENTS, updated);

  if (studentIdToNotify && finishedApp) {
    sendNotification(
      studentIdToNotify,
      `Student Grievance Completed!`,
      `OSAS Counselor has marked your student grievance as Completed. You can now evaluate and rate the guidance service.`,
      'APPOINTMENT',
      'appointments'
    );
    sendNotification('ADMIN', `Appointment Completed!`, `Appointment with Student ID ${studentIdToNotify} is completed.`, 'APPOINTMENT');
    triggerSuccessTransaction('Appointment Completed', 'Nai-mark Completed na ang appointment ng OSAS. Maaari na itong i-rate ng student.');

    const studentEmail = (finishedApp as Appointment).studentEmail || getUsers().find((u) => u.studentId === studentIdToNotify || u.id === studentIdToNotify)?.email;
    sendAppointmentStatusEmail(finishedApp, 'COMPLETED', studentEmail, (finishedApp as Appointment).studentName).catch((err) =>
      console.warn('[Appointment Completed Email] Error:', err)
    );
  }

  logActivity('Mark Appointment Completed', 'Appointments', adminName, `Admin marked appointment ${id} as Completed.`);
}

export function markAppointmentDoneByStudent(id: string, studentName: string): void {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  let studentIdVal = '';
  let isBothDone = false;
  let finishedApp: Appointment | null = null;

  const updated = list.map((a) => {
    if (a.id === id) {
      studentIdVal = a.studentId;
      const isAdminDone = a.adminMarkedDone || false;
      const finalStatus: AppointmentStatus = isAdminDone ? 'COMPLETED' : 'DONE_STUDENT';
      isBothDone = finalStatus === 'COMPLETED';
      const res = {
        ...a,
        studentMarkedDone: true,
        status: finalStatus,
        completedAt: finalStatus === 'COMPLETED' ? (a.completedAt || new Date().toISOString()) : undefined,
        updatedAt: Date.now(),
      };
      if (isBothDone) finishedApp = res;
      return res;
    }
    return a;
  });
  setStoredData(STORAGE_KEYS.APPOINTMENTS, updated);

  if (isBothDone) {
    sendNotification(studentIdVal, `Student Grievance Fully Completed!`, `Both Admin and Student have marked the student grievance as Done.`, 'APPOINTMENT', 'appointments');
    sendNotification('ADMIN', `Appointment Fully Completed!`, `Student ${studentName} (${studentIdVal}) has confirmed completion of appointment.`, 'APPOINTMENT');
    triggerSuccessTransaction('Appointment Fully Completed!', 'Nai-confirm mo na ang appointment. Kumpleto na ang counseling session!');

    if (finishedApp) {
      const studentEmail = (finishedApp as Appointment).studentEmail || getUsers().find((u) => u.studentId === studentIdVal || u.id === studentIdVal)?.email;
      sendAppointmentStatusEmail(finishedApp, 'COMPLETED', studentEmail, (finishedApp as Appointment).studentName).catch((err) =>
        console.warn('[Appointment Completed Email] Error:', err)
      );
    }
  } else {
    sendNotification('ADMIN', `Appointment Marked Done by Student`, `Student ${studentName} marked their appointment task step as Done.`, 'APPOINTMENT');
    triggerSuccessTransaction('Marked Done (Pending Admin)', 'Nai-mark done mo na ang appointment. Naghihintay ng verification mula kay Admin.');
  }

  logActivity('Mark Appointment Done', 'Appointments', studentName, `Student marked appointment ${id} as Done.`);
}

export function reApproveAppointment(id: string, adminName: string): void {
  const conflict = checkAppointmentConflict(id);
  if (conflict.hasConflict) {
    throw new Error(
      conflict.message ||
        `Schedule Conflict: Mayroon nang aprubadong appointment sa parehong petsa at oras. Hindi maaaring i-re-approve.`
    );
  }

  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  let studentIdVal = '';
  let targetApp: Appointment | null = null;
  const updated = list.map((a) => {
    if (a.id === id) {
      studentIdVal = a.studentId;
      targetApp = {
        ...a,
        status: 'APPROVED' as AppointmentStatus,
        adminMarkedDone: false,
        studentMarkedDone: false,
        completedAt: undefined,
        adminNotes: a.adminNotes ? `${a.adminNotes} (Re-approved by Admin)` : 'Re-approved by Admin',
        updatedAt: Date.now(),
      };
      return targetApp;
    }
    return a;
  });
  setStoredData(STORAGE_KEYS.APPOINTMENTS, updated);
  if (studentIdVal) {
    sendNotification(studentIdVal, 'Student Grievance Re-Approved!', `Your previously rejected student grievance request has been re-approved by OSAS Admin.`, 'APPOINTMENT', 'appointments');
    if (targetApp) {
      const app = targetApp as Appointment;
      const studentEmail = app.studentEmail || getUsers().find((u) => u.studentId === studentIdVal || u.id === studentIdVal)?.email;
      sendAppointmentStatusEmail(app, 'APPROVED', studentEmail, app.studentName, 'Re-approved by Admin').catch((err) =>
        console.warn('[Appointment Re-approved Email] Error:', err)
      );
    }
  }
  triggerSuccessTransaction('Appointment Re-Approved', 'Ang appointment ay matagumpay na naibalik at naaprubahan.');
  logActivity('Re-approve Appointment', 'Appointments', adminName, `Re-approved appointment ${id}.`);
}

export function archiveAppointment(id: string, adminName: string, archiveReason?: string): void {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
  const target = list.find((a) => a.id === id);
  if (!target) return;

  const trimmedReason = archiveReason?.trim() || undefined;

  // Mark as archived in storage without deleting so Student Portal Concern History remains intact
  const updated = list.map((a) =>
    a.id === id
      ? {
          ...a,
          isArchived: true,
          ...(trimmedReason ? { archiveReason: trimmedReason } : {}),
          updatedAt: Date.now(),
        }
      : a
  );
  setStoredData(STORAGE_KEYS.APPOINTMENTS, updated, true);

  try {
    setDoc(
      doc(db, 'appointments', id),
      cleanForFirestore({
        ...target,
        isArchived: true,
        ...(trimmedReason ? { archiveReason: trimmedReason } : {}),
        updatedAt: Date.now(),
      }),
      { merge: true }
    ).catch(() => {});
  } catch (_) {}

  const archiveType: ArchiveItem['type'] = target.status === 'COMPLETED' ? 'EXPIRED_APPOINTMENT' : 'APPOINTMENT';
  const prefix = target.status === 'COMPLETED' ? 'Completed Appointment' : 'Appointment';

  archiveItem(
    archiveType,
    target.id,
    `${prefix}: ${target.studentName} (${target.preferredDate || 'N/A'})`,
    { ...target, isArchived: true, ...(trimmedReason ? { archiveReason: trimmedReason } : {}) },
    adminName
  );

  triggerSuccessTransaction('Archived!', `Inilipat ang appointment ni "${target.studentName}" sa System Settings Archive Vault.`);
  logActivity(
    'Archive Appointment',
    'Appointments',
    adminName,
    `Archived appointment ${id} for ${target.studentName}${trimmedReason ? ` (Reason: ${trimmedReason})` : ''}.`
  );
}

// --- DISCIPLINARY REPORTS API ---
export function getDisciplinaryReports(): DisciplinaryReport[] {
  checkAndAutoArchiveResolutions();
  return getStoredData<DisciplinaryReport[]>(STORAGE_KEYS.DISCIPLINARY_REPORTS, []);
}

export function submitDisciplinaryReport(
  data: {
    reportedStudentName: string;
    reportedStudentId?: string;
    reportedStudentCourse?: string;
    reportedStudentYearLevel?: string;
    incidentType: string;
    description: string;
    location: string;
    reportDate?: string;
    reportTime?: string;
    reporterRole?: string;
    isAnonymousReporter?: boolean;
    actionTaken?: string;
    actionTakenOther?: string;
    evidenceFileName?: string;
    evidenceUrl?: string;
    contactNumber?: string;
    declarationAccepted: boolean;
  },
  reporterUser: User
): DisciplinaryReport {
  const reports = getDisciplinaryReports();
  const isAnonymous = Boolean(data.isAnonymousReporter || data.reporterRole === 'Anonymous Reporter');
  const reporterStudentId = isAnonymous ? 'ANONYMOUS' : (reporterUser.studentId || reporterUser.id);
  const reporterName = isAnonymous ? 'Anonymous Reporter' : reporterUser.fullName;
  const reporterCourse = isAnonymous ? 'N/A' : (reporterUser.course || 'N/A');
  const reporterYearLevel = isAnonymous ? 'N/A' : (reporterUser.yearLevel || 'N/A');
  const reporterContactNumber = isAnonymous ? '' : (data.contactNumber || '');

  const newReport: DisciplinaryReport = {
    id: `drep-${Date.now()}`,
    reporterUserId: reporterUser.id,
    reporterStudentId,
    reporterName,
    reporterRole: data.reporterRole || 'Student',
    isAnonymousReporter: isAnonymous,
    reporterCourse,
    reporterYearLevel,
    reporterContactNumber,
    reportedStudentName: data.reportedStudentName,
    reportedStudentId: data.reportedStudentId || '',
    reportedStudentCourse: data.reportedStudentCourse || '',
    reportedStudentYearLevel: data.reportedStudentYearLevel || '',
    incidentType: data.incidentType,
    description: data.description,
    location: data.location,
    reportDate: data.reportDate || new Date().toISOString().split('T')[0],
    reportTime: data.reportTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    actionTaken: data.actionTaken,
    actionTakenOther: data.actionTakenOther,
    evidenceFileName: data.evidenceFileName,
    evidenceUrl: data.evidenceUrl,
    submittedAt: new Date().toISOString(),
    status: 'SUBMITTED',
    isSavedRecord: false,
    declarationAccepted: data.declarationAccepted,
    updatedAt: Date.now(),
  };

  const updatedReports = [newReport, ...reports.filter((r) => r.id !== newReport.id)];
  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updatedReports, true);

  sendNotification(
    'GUIDANCE_ADMIN',
    `New Student Report: ${data.reportedStudentName}`,
    `${reporterName} submitted a student report regarding ${data.reportedStudentName} at ${data.location}.`,
    'SAFETY',
    'safety_reports'
  );

  sendNotification(
    'ADMIN',
    `New Report/Concern: ${data.incidentType}`,
    `${reporterName} reported ${data.reportedStudentName} for "${data.incidentType}" at ${data.location}.`,
    'SAFETY',
    'safety_reports'
  );

  // Dispatch email notification to OSAS Admin & confirmation to Reporter
  sendDisciplinaryReportAlertEmail(newReport).catch((err) =>
    console.warn('[Disciplinary Report Alert Email] Error:', err)
  );

  triggerSuccessTransaction(
    'Student Report Submitted',
    'Naisumite na ang iyong Student Report sa Guidance Advocate. Ito ay dadaan sa masusing pagsusuri at imbestigasyon.'
  );

  logActivity(
    'Submit Student Report',
    'Student Reports',
    reporterName,
    `Submitted student report against "${data.reportedStudentName}" at ${data.location}.`
  );

  // Immediately save to dedicated Firestore collection 'disciplinary_reports' and merge with 'osas_store/osas_disciplinary_reports'
  (async () => {
    try {
      const cleanedNewReport = cleanForFirestore(newReport);
      await setDoc(doc(db, 'disciplinary_reports', newReport.id), cleanedNewReport, { merge: true });

      const storeDocRef = doc(db, 'osas_store', STORAGE_KEYS.DISCIPLINARY_REPORTS);
      const storeSnap = await getDoc(storeDocRef);
      const map = new Map<string, DisciplinaryReport>();
      if (storeSnap.exists()) {
        const remoteArr = storeSnap.data()?.value;
        if (Array.isArray(remoteArr)) {
          remoteArr.forEach((r: DisciplinaryReport) => {
            if (r && r.id) map.set(r.id, r);
          });
        }
      }
      getDisciplinaryReports().forEach((r) => {
        if (r && r.id) {
          const existing = map.get(r.id);
          if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
            map.set(r.id, { ...existing, ...r });
          }
        }
      });
      map.set(newReport.id, newReport);
      const mergedList = Array.from(map.values());
      setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, mergedList, false);
      await setDoc(storeDocRef, { value: cleanForFirestore(mergedList), updatedAt: Date.now() }, { merge: true });
      safeDispatchEvent('osas_storage_updated');
    } catch (fsErr) {
      console.warn('[Firestore Disciplinary Report write warning]', fsErr);
    }
  })();

  return newReport;
}

export function referDisciplinaryReportFromOsas(
  data: {
    reportedStudentName: string;
    reportedStudentId?: string;
    reportedStudentCourse?: string;
    reportedStudentYearLevel?: string;
    reportedStudentContact?: string;
    reportedStudentAddress?: string;
    incidentType: string;
    description: string;
    location?: string;
    reporterName?: string;
    reporterStudentId?: string;
    reporterCourse?: string;
    reporterYearLevel?: string;
    reporterContactNumber?: string;
    reporterAddress?: string;
    isAnonymousReporter?: boolean;
  },
  actorName: string = 'OSAS Administrator'
): DisciplinaryReport {
  const reports = getDisciplinaryReports();
  const isAnonymous = Boolean(data.isAnonymousReporter);
  const reporterStudentId = isAnonymous ? 'ANONYMOUS' : (data.reporterStudentId || undefined);
  const reporterName = isAnonymous ? 'Anonymous Reporter' : (data.reporterName || 'Student Reporter');

  const existingReport = reports.find(
    (r) =>
      !r.isArchived &&
      (r.reportedStudentName || '').trim().toLowerCase() === (data.reportedStudentName || '').trim().toLowerCase() &&
      (r.incidentType || '').trim().toLowerCase() === (data.incidentType || '').trim().toLowerCase() &&
      (r.description || '').trim().toLowerCase() === (data.description || '').trim().toLowerCase()
  );

  const newReport: DisciplinaryReport = existingReport
    ? {
        ...existingReport,
        referredFromOsas: true,
        isReferredFromOsas: true,
        updatedAt: Date.now(),
      }
    : {
        id: `drep-${Date.now()}`,
        reporterStudentId: reporterStudentId || '',
        reporterName,
        reporterRole: isAnonymous ? 'Anonymous Reporter' : 'Student',
        isAnonymousReporter: isAnonymous,
        reporterCourse: isAnonymous ? 'N/A' : (data.reporterCourse || 'N/A'),
        reporterYearLevel: isAnonymous ? 'N/A' : (data.reporterYearLevel || 'N/A'),
        reporterContactNumber: isAnonymous ? '' : (data.reporterContactNumber || ''),
        reportedStudentName: data.reportedStudentName,
        reportedStudentId: data.reportedStudentId || '',
        reportedStudentCourse: data.reportedStudentCourse || '',
        reportedStudentYearLevel: data.reportedStudentYearLevel || '',
        reportedStudentContact: data.reportedStudentContact || '',
        reportedStudentAddress: data.reportedStudentAddress || '',
        incidentType: data.incidentType,
        description: data.description,
        location: data.location || 'Dingalan Community College',
        reportDate: new Date().toISOString().split('T')[0],
        reportTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        submittedAt: new Date().toISOString(),
        status: 'SUBMITTED',
        isSavedRecord: false,
        referredFromOsas: true,
        isReferredFromOsas: true,
        declarationAccepted: true,
        updatedAt: Date.now(),
      };

  const updatedReports = [newReport, ...reports.filter((r) => r.id !== newReport.id)];
  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updatedReports, true);

  sendNotification(
    'GUIDANCE_ADMIN',
    `New Student Report: ${data.reportedStudentName}`,
    `OSAS Administrator referred student report regarding ${data.reportedStudentName} (${data.incidentType}).`,
    'SAFETY',
    'safety_reports'
  );

  triggerSuccessTransaction(
    'Student Report Referred to Guidance',
    `Matagumpay na naipadala ang Student Report laban kay ${data.reportedStudentName} sa Guidance Advocate.`
  );

  logActivity(
    'Refer Student Report to Guidance',
    'Student Reports',
    actorName,
    `Referred student report regarding "${data.reportedStudentName}" to Guidance Advocate.`
  );

  (async () => {
    try {
      const cleanedNewReport = cleanForFirestore(newReport);
      await setDoc(doc(db, 'disciplinary_reports', newReport.id), cleanedNewReport, { merge: true });

      const storeDocRef = doc(db, 'osas_store', STORAGE_KEYS.DISCIPLINARY_REPORTS);
      const storeSnap = await getDoc(storeDocRef);
      const map = new Map<string, DisciplinaryReport>();
      if (storeSnap.exists()) {
        const remoteArr = storeSnap.data()?.value;
        if (Array.isArray(remoteArr)) {
          remoteArr.forEach((r: DisciplinaryReport) => {
            if (r && r.id) map.set(r.id, r);
          });
        }
      }
      getDisciplinaryReports().forEach((r) => {
        if (r && r.id) {
          const existing = map.get(r.id);
          if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
            map.set(r.id, { ...existing, ...r });
          }
        }
      });
      map.set(newReport.id, newReport);
      const mergedList = Array.from(map.values());
      setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, mergedList, false);
      await setDoc(storeDocRef, { value: cleanForFirestore(mergedList), updatedAt: Date.now() }, { merge: true });
      safeDispatchEvent('osas_storage_updated');
    } catch (fsErr) {
      console.warn('[Firestore Disciplinary Report write warning]', fsErr);
    }
  })();

  return newReport;
}

export function referStudentConcernFromOsas(
  data: {
    studentId: string;
    studentName: string;
    studentEmail?: string;
    description: string;
    preferredDate?: string;
    preferredTime?: string;
    reason?: string;
    course?: string;
    academicProgram?: string;
    yearLevel?: string;
    contactNumber?: string;
    completeAddress?: string;
  },
  actorName: string = 'OSAS Administrator'
): Appointment {
  const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, initialAppointments);
  const now = new Date();
  const dateOnly = data.preferredDate || now.toISOString().split('T')[0];
  const timeOnly = data.preferredTime || '09:00 AM';

  const existingApp = list.find(
    (a) =>
      !a.isArchived &&
      ((data.studentId && a.studentId && a.studentId.trim().toLowerCase() === data.studentId.trim().toLowerCase()) ||
        (data.studentName && a.studentName && a.studentName.trim().toLowerCase() === data.studentName.trim().toLowerCase())) &&
      (a.description || '').trim().toLowerCase() === (data.description || '').trim().toLowerCase()
  );

  const newApp: Appointment = existingApp
    ? {
        ...existingApp,
        studentId: data.studentId || existingApp.studentId || 'N/A',
        studentName: data.studentName || existingApp.studentName,
        description: data.description || existingApp.description,
        preferredDate: dateOnly,
        preferredTime: timeOnly,
        status: 'REFERRED',
        office: 'GUIDANCE',
        referredToGuidance: true,
        referredFromOsas: true,
        isReferredFromOsas: true,
        guidanceReferralDate: `${dateOnly} @ ${timeOnly}`,
        guidanceReferralNotes: data.description,
        guidanceReferralBy: actorName,
        reason: data.reason || existingApp.reason || 'General Concern',
        course: data.course || data.academicProgram || existingApp.course || 'N/A',
        academicProgram: data.academicProgram || data.course || existingApp.academicProgram || 'N/A',
        yearLevel: data.yearLevel || existingApp.yearLevel || 'N/A',
        contactNumber: data.contactNumber || existingApp.contactNumber || 'N/A',
        completeAddress: data.completeAddress || existingApp.completeAddress || 'N/A',
        updatedAt: Date.now(),
      }
    : {
        id: `app-${Date.now()}`,
        studentId: data.studentId || 'N/A',
        studentName: data.studentName,
        studentEmail:
          data.studentEmail ||
          `${(data.studentId || 'student').trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@student.dcc.edu.ph`,
        description: data.description,
        preferredDate: dateOnly,
        preferredTime: timeOnly,
        status: 'REFERRED',
        office: 'GUIDANCE',
        createdAt: now.toISOString(),
        adminMarkedDone: false,
        studentMarkedDone: false,
        referredToGuidance: true,
        referredFromOsas: true,
        isReferredFromOsas: true,
        guidanceReferralDate: `${dateOnly} @ ${timeOnly}`,
        guidanceReferralNotes: data.description,
        guidanceReferralBy: actorName,
        reason: data.reason || 'General Concern',
        course: data.course || data.academicProgram || 'N/A',
        academicProgram: data.academicProgram || data.course || 'N/A',
        yearLevel: data.yearLevel || 'N/A',
        contactNumber: data.contactNumber || 'N/A',
        completeAddress: data.completeAddress || 'N/A',
        updatedAt: Date.now(),
      };

  const updatedList = [newApp, ...list.filter((a) => a.id !== newApp.id)];
  setStoredData(STORAGE_KEYS.APPOINTMENTS, updatedList, true);

  sendNotification(
    'GUIDANCE_ADMIN',
    `New Student Concern (Referred from OSAS): ${data.studentName}`,
    `OSAS Administrator referred student concern for ${data.studentName}: ${data.description.slice(0, 100)}...`,
    'APPOINTMENT',
    'appointments'
  );

  triggerSuccessTransaction(
    'Student Concern Referred to Guidance',
    `Matagumpay na nai-refer ang Student Concern ni ${data.studentName} sa Guidance Advocate.`
  );

  logActivity(
    'Refer Student Concern to Guidance',
    'Student Concerns',
    actorName,
    `Referred student concern for ${data.studentName} (${data.studentId}) to Guidance Advocate.`
  );

  (async () => {
    try {
      const cleanedApp = cleanForFirestore(newApp);
      await setDoc(doc(db, 'appointments', newApp.id), cleanedApp, { merge: true });

      const storeDocRef = doc(db, 'osas_store', STORAGE_KEYS.APPOINTMENTS);
      const storeSnap = await getDoc(storeDocRef);
      const map = new Map<string, Appointment>();
      if (storeSnap.exists()) {
        const remoteArr = storeSnap.data()?.value;
        if (Array.isArray(remoteArr)) {
          remoteArr.forEach((a: Appointment) => {
            if (a && a.id) map.set(a.id, a);
          });
        }
      }
      getAppointments('GUIDANCE_ADMIN').forEach((a) => {
        if (a && a.id) {
          const existing = map.get(a.id);
          if (!existing || (a.updatedAt || 0) >= (existing.updatedAt || 0)) {
            map.set(a.id, { ...existing, ...a });
          }
        }
      });
      map.set(newApp.id, newApp);
      const mergedList = Array.from(map.values());
      setStoredData(STORAGE_KEYS.APPOINTMENTS, mergedList, false);
      await setDoc(storeDocRef, { value: cleanForFirestore(mergedList), updatedAt: Date.now() }, { merge: true });
      safeDispatchEvent('osas_storage_updated');
    } catch (fsErr) {
      console.warn('[Firestore Appointment write warning]', fsErr);
    }
  })();

  return newApp;
}

export function saveDisciplinaryReportToRecord(
  reportId: string,
  savedBy: string
): DisciplinaryReport | null {
  const reports = getDisciplinaryReports();
  let targetReport: DisciplinaryReport | null = null;
  const nowIso = new Date().toISOString();

  const updated = reports.map((r) => {
    if (r.id === reportId) {
      targetReport = {
        ...r,
        isSavedRecord: true,
        savedToRecordAt: r.savedToRecordAt || nowIso,
        savedToRecordBy: savedBy,
        status: r.status === 'SUBMITTED' ? 'SAVED_RECORD' : r.status,
        updatedAt: Date.now(),
      };
      return targetReport;
    }
    return r;
  });

  if (!targetReport) return null;

  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);

  try {
    const docRef = doc(db, 'disciplinary_reports', reportId);
    setDoc(docRef, cleanForFirestore(targetReport), { merge: true }).catch(() => {});
  } catch (_) {}

  triggerSuccessTransaction(
    'Report Saved to Records',
    'Matagumpay na nai-save ang Student Report sa Student Reports Record.'
  );
  logActivity('Save Report Record', 'Student Reports', savedBy, `Saved report #${reportId} to Student Reports Record.`);
  return targetReport;
}

export function appendSlipNoticeToReport(
  reportId: string,
  slipNotice: SlipNotice,
  updatedBy: string
): DisciplinaryReport | null {
  const reports = getDisciplinaryReports();
  let targetReport: DisciplinaryReport | null = null;

  const updated = reports.map((r) => {
    if (r.id === reportId) {
      const existingSlips = Array.isArray(r.slipNotices) ? r.slipNotices : [];
      const candidateId = (slipNotice.studentId || r.reportedStudentId || '').trim();
      const candidateName = (
        slipNotice.studentName ||
        (r.reportedStudentName && r.reportedStudentName !== 'Unspecified Student / General Report'
          ? r.reportedStudentName
          : '')
      ).trim();
      const matchedStudent = getUsers().find(
        (u) =>
          u.role === 'STUDENT' &&
          ((candidateId &&
            ((u.studentId && u.studentId.trim().toLowerCase() === candidateId.toLowerCase()) ||
              (u.id && u.id.trim().toLowerCase() === candidateId.toLowerCase()))) ||
            (candidateName &&
              u.fullName &&
              u.fullName.trim().toLowerCase() === candidateName.toLowerCase()))
      );

      targetReport = {
        ...r,
        isSavedRecord: true,
        reportedStudentId:
          r.reportedStudentId ||
          slipNotice.studentId ||
          matchedStudent?.studentId ||
          matchedStudent?.id ||
          '',
        reportedStudentName:
          r.reportedStudentName && r.reportedStudentName !== 'Unspecified Student / General Report'
            ? r.reportedStudentName
            : matchedStudent?.fullName || slipNotice.studentName || r.reportedStudentName,
        reportedStudentCourse:
          r.reportedStudentCourse ||
          matchedStudent?.academicProgram ||
          matchedStudent?.course ||
          slipNotice.course ||
          '',
        reportedStudentYearLevel:
          r.reportedStudentYearLevel ||
          matchedStudent?.yearLevel ||
          slipNotice.yearLevel ||
          '',
        reportedStudentContact:
          r.reportedStudentContact ||
          matchedStudent?.contactNumber ||
          (matchedStudent as any)?.phoneNumber ||
          slipNotice.contactNumber ||
          '',
        reportedStudentAddress:
          r.reportedStudentAddress ||
          matchedStudent?.permanentAddress ||
          matchedStudent?.address ||
          '',
        slipNotices: [slipNotice, ...existingSlips],
        investigationNotes: `Call Slip Notice #${slipNotice.id} issued to ${slipNotice.studentName} on ${slipNotice.dateSent} for visit on ${slipNotice.visitDate} at ${slipNotice.visitTime}. Purposes: ${slipNotice.purposes.join(', ')}.`,
        updatedAt: Date.now(),
      };
      return targetReport;
    }
    return r;
  });

  if (!targetReport) return null;
  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);

  try {
    const docRef = doc(db, 'disciplinary_reports', reportId);
    setDoc(docRef, cleanForFirestore(targetReport), { merge: true }).catch(() => {});
  } catch (_) {}

  logActivity('Issue Slip Notice on Report', 'Student Reports', updatedBy, `Attached Slip Notice #${slipNotice.id} to Report #${reportId}.`);
  return targetReport;
}

export function saveDraftStudentReportActionTaken(
  reportId: string,
  actionTakenText: string,
  problemResolvedText?: string
): DisciplinaryReport | null {
  const reports = getDisciplinaryReports();
  let targetReport: DisciplinaryReport | null = null;

  const updated = reports.map((r) => {
    if (r.id === reportId) {
      const hasSavedResolution = Boolean(
        r.status === 'RESOLVED' ||
          (r.resolvedAt && r.resolutionDetails && r.resolutionDetails.trim()) ||
          (r.resolutionDetails && r.resolutionDetails.trim())
      );
      targetReport = {
        ...r,
        isSavedRecord: true,
        resolutionActionTaken: actionTakenText,
        problemResolved: problemResolvedText !== undefined ? problemResolvedText : r.problemResolved,
        resolutionOutcome: hasSavedResolution ? r.resolutionOutcome : undefined,
        updatedAt: Date.now(),
      };
      return targetReport;
    }
    return r;
  });

  if (!targetReport) return null;

  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);

  try {
    const docRef = doc(db, 'disciplinary_reports', reportId);
    setDoc(docRef, cleanForFirestore(targetReport), { merge: true }).catch(() => {});
  } catch (_) {}

  return targetReport;
}

export function referStudentReportToOsas(
  reportId: string,
  referralData: {
    reportedStudentId?: string;
    reportedStudentName?: string;
    reportedStudentCourse?: string;
    reportedStudentYearLevel?: string;
    reportedStudentContact?: string;
    reportedStudentAddress?: string;
    osasReferralReasons: string[];
    osasReferralReasonsOther?: string;
    osasReferralDescription: string;
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
    resolutionActionTaken?: string;
    problemResolved?: string;
  },
  referredBy: string
): DisciplinaryReport | null {
  const reports = getDisciplinaryReports();
  let targetReport: DisciplinaryReport | null = null;
  const nowDate = new Date().toISOString().split('T')[0];

  const wasAlreadyReferred = reports.some((r) => r.id === reportId && Boolean(r.referredToOsas));

  const updated = reports.map((r) => {
    if (r.id === reportId) {
      const lastSlip =
        Array.isArray(r.slipNotices) && r.slipNotices.length > 0 ? r.slipNotices[0] : undefined;
      const candidateId = (
        referralData.reportedStudentId ||
        r.reportedStudentId ||
        lastSlip?.studentId ||
        ''
      ).trim();
      const rawName = (
        referralData.reportedStudentName ||
        (r.reportedStudentName && r.reportedStudentName !== 'Unspecified Student / General Report'
          ? r.reportedStudentName
          : '') ||
        lastSlip?.studentName ||
        ''
      ).trim();
      const matchedStudent = getUsers().find(
        (u) =>
          u.role === 'STUDENT' &&
          ((candidateId &&
            ((u.studentId && u.studentId.trim().toLowerCase() === candidateId.toLowerCase()) ||
              (u.id && u.id.trim().toLowerCase() === candidateId.toLowerCase()))) ||
            (rawName && u.fullName && u.fullName.trim().toLowerCase() === rawName.toLowerCase()))
      );

      targetReport = {
        ...r,
        isSavedRecord: true,
        reportedStudentId:
          referralData.reportedStudentId ||
          r.reportedStudentId ||
          matchedStudent?.studentId ||
          matchedStudent?.id ||
          lastSlip?.studentId ||
          '',
        reportedStudentName:
          matchedStudent?.fullName ||
          referralData.reportedStudentName ||
          r.reportedStudentName,
        reportedStudentCourse:
          referralData.reportedStudentCourse ||
          r.reportedStudentCourse ||
          matchedStudent?.academicProgram ||
          matchedStudent?.course ||
          lastSlip?.course ||
          '',
        reportedStudentYearLevel:
          referralData.reportedStudentYearLevel ||
          r.reportedStudentYearLevel ||
          matchedStudent?.yearLevel ||
          lastSlip?.yearLevel ||
          '',
        reportedStudentContact:
          referralData.reportedStudentContact ||
          r.reportedStudentContact ||
          matchedStudent?.contactNumber ||
          (matchedStudent as any)?.phoneNumber ||
          lastSlip?.contactNumber ||
          '',
        reportedStudentAddress:
          referralData.reportedStudentAddress ||
          r.reportedStudentAddress ||
          matchedStudent?.permanentAddress ||
          matchedStudent?.address ||
          '',
        resolutionActionTaken:
          referralData.resolutionActionTaken !== undefined
            ? referralData.resolutionActionTaken
            : r.resolutionActionTaken,
        problemResolved:
          referralData.problemResolved !== undefined
            ? referralData.problemResolved
            : r.problemResolved,
        referredToOsas: true,
        osasReferralDate: r.osasReferralDate || nowDate,
        osasReferralBy: referredBy,
        osasReferralDesignation: referralData.osasApprovedByDesignation || 'Guidance Advocate',
        osasReferralReasons:
          referralData.osasReferralReasons && referralData.osasReferralReasons.length > 0
            ? referralData.osasReferralReasons
            : r.osasReferralReasons || ['Referred by Guidance Advocate'],
        osasReferralReasonsOther: referralData.osasReferralReasonsOther ?? r.osasReferralReasonsOther,
        osasReferralDescription: referralData.osasReferralDescription || r.osasReferralDescription || r.description,
        osasReferralFollowUpDate: referralData.osasReferralFollowUpDate ?? r.osasReferralFollowUpDate,
        osasReferralResponsibleParties:
          referralData.osasReferralResponsibleParties ?? r.osasReferralResponsibleParties,
        osasReferralCaseStatus: referralData.osasReferralCaseStatus || r.osasReferralCaseStatus || 'REFERRED',
        osasReferralNextSteps: referralData.osasReferralNextSteps ?? r.osasReferralNextSteps,
        osasReferralRecommendedDesignation:
          referralData.osasReferralRecommendedDesignation ||
          r.osasReferralRecommendedDesignation ||
          'Office of Student Affairs and Services (OSAS)',
        osasReferralUrgency: referralData.osasReferralUrgency || r.osasReferralUrgency || 'Within 3 days',
        osasReferralAttachmentsType:
          referralData.osasReferralAttachmentsType || r.osasReferralAttachmentsType || 'Incident reports',
        osasReferralAttachmentsOther:
          referralData.osasReferralAttachmentsOther ?? r.osasReferralAttachmentsOther,
        osasReferralActionTakenSummary:
          referralData.osasReferralActionTakenSummary ?? r.osasReferralActionTakenSummary,
        osasApprovalName: referralData.osasApprovalName || referredBy,
        osasApprovedByDesignation: referralData.osasApprovedByDesignation || 'Guidance Advocate',
        osasReceivingUnit: referralData.osasReceivingUnit || 'OSAS Administrator',
        status:
          r.resolutionOutcome === 'UNRESOLVED' || r.status === 'UNRESOLVED'
            ? 'UNRESOLVED'
            : 'REFERRED_TO_OSAS',
        investigationNotes: `Referred by Guidance Advocate (${referredBy}) to OSAS for intervention on ${nowDate}. Reason: ${referralData.osasReferralReasons.join(', ')}.`,
        updatedAt: Date.now(),
      };
      return targetReport;
    }
    return r;
  });

  if (!targetReport) return null;

  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);

  try {
    const docRef = doc(db, 'disciplinary_reports', reportId);
    setDoc(docRef, cleanForFirestore(targetReport), { merge: true }).catch(() => {});
  } catch (_) {}

  if (!wasAlreadyReferred) {
    sendNotification(
      'ADMIN',
      `Referred Student Report: ${(targetReport as DisciplinaryReport).reportedStudentName}`,
      `Guidance Advocate referred Report #${reportId} regarding ${(targetReport as DisciplinaryReport).reportedStudentName} to OSAS Refer Student Reports.`,
      'INTERVENTION',
      'refer_student_reports'
    );
  }

  triggerSuccessTransaction(
    'Referred to OSAS',
    `Matagumpay na nai-refer ang Student Report #${reportId} sa OSAS Administrator → Refer Student Reports.`
  );
  logActivity(
    'Refer Student Report to OSAS',
    'Student Reports',
    referredBy,
    `Referred report #${reportId} (${(targetReport as DisciplinaryReport).reportedStudentName}) to OSAS.`
  );

  return targetReport;
}

export function saveOsasRemarksOnReport(
  reportId: string,
  osasRemarks: string,
  updatedBy: string
): DisciplinaryReport | null {
  const reports = getDisciplinaryReports();
  let targetReport: DisciplinaryReport | null = null;
  const nowIso = new Date().toISOString();

  const updated = reports.map((r) => {
    if (r.id === reportId) {
      const hasSavedResolution = Boolean(
        r.resolvedAt && r.resolutionDetails && r.resolutionDetails.trim()
      );
      const shouldResolveOnOsasRemarks =
        r.resolutionOutcome === 'UNRESOLVED' ||
        r.status === 'UNRESOLVED' ||
        hasSavedResolution;
      targetReport = {
        ...r,
        osasRemarks: osasRemarks.trim(),
        osasRemarksBy: updatedBy,
        osasRemarksSavedAt: nowIso,
        resolutionOutcome: shouldResolveOnOsasRemarks ? 'RESOLVED' : r.resolutionOutcome,
        status: shouldResolveOnOsasRemarks
          ? 'RESOLVED'
          : r.status === 'REFERRED_TO_OSAS'
            ? 'OSAS_REMARKS_SAVED'
            : r.status,
        investigationNotes: `OSAS Remarks (${updatedBy}): ${osasRemarks.trim()}`,
        updatedAt: Date.now(),
      };
      return targetReport;
    }
    return r;
  });

  if (!targetReport) return null;

  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);

  try {
    const docRef = doc(db, 'disciplinary_reports', reportId);
    setDoc(docRef, cleanForFirestore(targetReport), { merge: true }).catch(() => {});
  } catch (_) {}

  sendNotification(
    'GUIDANCE_ADMIN',
    `OSAS Remarks Saved: Report #${reportId}`,
    `OSAS Administrator saved remarks on referred report #${reportId} (${(targetReport as DisciplinaryReport).reportedStudentName}) for Guidance review.`,
    'INTERVENTION',
    'safety_reports'
  );

  triggerSuccessTransaction(
    'OSAS Remarks Saved',
    `Matagumpay na nai-save ang OSAS Remarks sa Report #${reportId}. Makikita na ito agad ng Guidance Advocate para sa review at resolution.`
  );
  logActivity('Save OSAS Remarks', 'Refer Student Reports', updatedBy, `Saved OSAS Remarks on report #${reportId}.`);
  return targetReport;
}

export function saveStudentReportResolution(
  reportId: string,
  resolutionData: {
    problemResolved?: string;
    resolutionActionSteps?: ResolutionActionStep[];
    resolutionDetails: string;
    resolutionActionTaken?: string;
    resolutionOutcome: 'RESOLVED' | 'UNRESOLVED';
    referToOsas?: boolean;
  },
  updatedBy: string
): DisciplinaryReport | null {
  const reports = getDisciplinaryReports();
  let targetReport: DisciplinaryReport | null = null;
  const nowIso = new Date().toISOString();
  const nowDate = nowIso.split('T')[0];

  const isUnresolvedReferral =
    resolutionData.resolutionOutcome === 'UNRESOLVED' || Boolean(resolutionData.referToOsas);
  const wasAlreadyReferred = reports.some((r) => r.id === reportId && Boolean(r.referredToOsas));

  const newStatus: DisciplinaryReportStatus =
    resolutionData.resolutionOutcome === 'RESOLVED' ? 'RESOLVED' : 'UNRESOLVED';

  const updated = reports.map((r) => {
    if (r.id === reportId) {
      const hasExistingRemarks = Boolean(r.osasRemarks && r.osasRemarks.trim());
      const finalOutcome =
        resolutionData.resolutionOutcome === 'UNRESOLVED' && hasExistingRemarks
          ? 'RESOLVED'
          : resolutionData.resolutionOutcome;
      const finalStatus: DisciplinaryReportStatus =
        finalOutcome === 'RESOLVED' ? 'RESOLVED' : newStatus;

      targetReport = {
        ...r,
        isSavedRecord: true,
        problemResolved: resolutionData.problemResolved?.trim() || r.problemResolved || r.description,
        resolutionActionSteps: resolutionData.resolutionActionSteps || [],
        resolutionDetails: resolutionData.resolutionDetails.trim(),
        resolutionActionTaken: resolutionData.resolutionActionTaken?.trim() || r.actionTaken,
        actionTaken: resolutionData.resolutionActionTaken?.trim() || r.actionTaken,
        resolutionOutcome: finalOutcome,
        resolvedAt: nowIso,
        resolvedBy: updatedBy,
        status: finalStatus,
        ...(isUnresolvedReferral
          ? {
              referredToOsas: true,
              osasReferralDate: r.osasReferralDate || nowDate,
              osasReferralBy: r.osasReferralBy || updatedBy,
              osasReferralDesignation: r.osasReferralDesignation || 'Guidance Advocate',
              osasReferralReasons:
                r.osasReferralReasons && r.osasReferralReasons.length > 0
                  ? r.osasReferralReasons
                  : [resolutionData.resolutionDetails.trim() || 'Referred by Guidance Advocate to OSAS Office'],
              osasReferralDescription:
                r.osasReferralDescription ||
                resolutionData.problemResolved?.trim() ||
                r.description ||
                resolutionData.resolutionDetails.trim(),
              osasReferralCaseStatus: r.osasReferralCaseStatus || 'REFERRED',
              osasReferralRecommendedDesignation:
                r.osasReferralRecommendedDesignation ||
                'Office of Student Affairs and Services (OSAS)',
              osasReferralUrgency: r.osasReferralUrgency || 'Within 3 days',
              osasReferralAttachmentsType: r.osasReferralAttachmentsType || 'Incident reports',
              osasReferralActionTakenSummary:
                r.osasReferralActionTakenSummary ||
                resolutionData.resolutionActionTaken?.trim() ||
                r.actionTaken,
              osasApprovalName: r.osasApprovalName || updatedBy,
              osasApprovedByDesignation: r.osasApprovedByDesignation || 'Guidance Advocate',
              osasReceivingUnit: r.osasReceivingUnit || 'OSAS Administrator',
            }
          : {}),
        investigationNotes: `Resolution (${finalOutcome}): ${resolutionData.resolutionDetails.trim()}`,
        updatedAt: Date.now(),
      };
      return targetReport;
    }
    return r;
  });

  if (!targetReport) return null;

  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);

  try {
    const docRef = doc(db, 'disciplinary_reports', reportId);
    setDoc(docRef, cleanForFirestore(targetReport), { merge: true }).catch(() => {});
  } catch (_) {}

  const rep = targetReport as DisciplinaryReport;
  if (isUnresolvedReferral && !wasAlreadyReferred) {
    sendNotification(
      'ADMIN',
      `Referred Student Report: ${rep.reportedStudentName}`,
      `Guidance Advocate referred Report #${reportId} regarding ${rep.reportedStudentName} to OSAS Refer Student Reports.`,
      'INTERVENTION',
      'refer_student_reports'
    );
    logActivity(
      'Refer Student Report to OSAS',
      'Student Reports',
      updatedBy,
      `Referred report #${reportId} (${rep.reportedStudentName}) to OSAS.`
    );
  } else if (rep.referredToOsas) {
    sendNotification(
      'ADMIN',
      `Guidance Resolution Completed: Report #${reportId}`,
      `Guidance Advocate recorded a ${resolutionData.resolutionOutcome} resolution for Report #${reportId} (${rep.reportedStudentName}).`,
      'SAFETY',
      'refer_student_reports'
    );
  }

  if (!rep.isAnonymousReporter && rep.reporterStudentId !== 'ANONYMOUS') {
    const targetRecipientIds = new Set<string>();
    if (rep.reporterStudentId) targetRecipientIds.add(rep.reporterStudentId);
    if (rep.reporterUserId) targetRecipientIds.add(rep.reporterUserId);
    if (rep.reporterName) {
      const matchedUser = getUsers().find(
        (u) =>
          u.role === 'STUDENT' &&
          u.fullName.trim().toLowerCase() === rep.reporterName.trim().toLowerCase()
      );
      if (matchedUser?.studentId) targetRecipientIds.add(matchedUser.studentId);
      if (matchedUser?.id) targetRecipientIds.add(matchedUser.id);
    }
    targetRecipientIds.forEach((recipientId) => {
      sendNotification(
        recipientId,
        `Student Report Resolution Saved`,
        `Your submitted report regarding "${rep.reportedStudentName}" has been resolved (${resolutionData.resolutionOutcome}). Please leave your feedback in Report History.`,
        'SYSTEM',
        'safety_reports'
      );
    });
  }

  triggerSuccessTransaction(
    isUnresolvedReferral ? 'Referred to OSAS' : 'Resolution Saved',
    isUnresolvedReferral
      ? `Matagumpay na naitala ang Resolution (${resolutionData.resolutionOutcome}) at nai-refer ang Student Report #${reportId} sa OSAS Administrator → Referred Student Reports.`
      : `Matagumpay na naitala ang Resolution (${resolutionData.resolutionOutcome}) para sa Report #${reportId}.`
  );
  logActivity('Create Report Resolution', 'Student Reports', updatedBy, `Created ${resolutionData.resolutionOutcome} resolution for report #${reportId}.`);
  return targetReport;
}

export function saveStudentReportEndorsementLetter(
  reportId: string,
  endorsementData: Omit<EndorsementLetterData, 'id' | 'createdAt'>,
  updatedBy: string
): DisciplinaryReport | null {
  const reports = getDisciplinaryReports();
  let targetReport: DisciplinaryReport | null = null;
  const nowIso = new Date().toISOString();

  const letter: EndorsementLetterData = {
    ...endorsementData,
    id: `end-${Date.now()}`,
    createdAt: nowIso,
  };

  const updated = reports.map((r) => {
    if (r.id === reportId) {
      targetReport = {
        ...r,
        isSavedRecord: true,
        endorsementLetter: letter,
        status: r.status,
        investigationNotes: `Endorsement Letter #${letter.id} created for Higher Officer (${letter.higherOfficerName} - ${letter.higherOfficerTitle}).`,
        updatedAt: Date.now(),
      };
      return targetReport;
    }
    return r;
  });

  if (!targetReport) return null;

  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);

  try {
    const docRef = doc(db, 'disciplinary_reports', reportId);
    setDoc(docRef, cleanForFirestore(targetReport), { merge: true }).catch(() => {});
  } catch (_) {}

  triggerSuccessTransaction(
    'Endorsement Letter Created',
    `Matagumpay na nagawa ang Endorsement Letter para sa Higher Officer (${letter.higherOfficerName}). Maaari na itong i-print.`
  );
  logActivity('Create Endorsement Letter', 'Student Reports', updatedBy, `Created Endorsement Letter #${letter.id} for report #${reportId}.`);
  return targetReport;
}

export function updateDisciplinaryReportStatus(
  id: string,
  status: DisciplinaryReportStatus,
  investigationNotes: string,
  updatedBy: string
): void {
  const reports = getDisciplinaryReports();
  let targetReport: DisciplinaryReport | null = null;
  const updated = reports.map((r) => {
    if (r.id === id) {
      targetReport = {
        ...r,
        status,
        investigationNotes: investigationNotes !== undefined ? investigationNotes : r.investigationNotes,
        updatedAt: Date.now(),
      };
      return targetReport;
    }
    return r;
  });

  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);

  // Directly update Firestore document in 'disciplinary_reports' collection for real-time sync
  try {
    const docRef = doc(db, 'disciplinary_reports', id);
    setDoc(
      docRef,
      {
        status,
        investigationNotes: investigationNotes !== undefined ? investigationNotes : (targetReport ? (targetReport as DisciplinaryReport).investigationNotes : ''),
        updatedAt: Date.now(),
      },
      { merge: true }
    ).catch(() => {});
  } catch (_) {}

  if (targetReport) {
    const rep = targetReport as DisciplinaryReport;
    if (!rep.isAnonymousReporter && rep.reporterStudentId !== 'ANONYMOUS') {
      sendNotification(
        rep.reporterStudentId,
        `Disciplinary Report Status Updated`,
        `Your submitted incident report regarding "${rep.reportedStudentName}" is now ${status.replace('_', ' ')}.`,
        'SYSTEM',
        'disciplinary'
      );

      const reporterEmail = getUsers().find(
        (u) => u.studentId === rep.reporterStudentId || u.id === rep.reporterStudentId
      )?.email;

      if (reporterEmail) {
        sendDisciplinaryReportStatusUpdateEmail(rep, reporterEmail).catch((err) =>
          console.warn('[Disciplinary Report Status Email] Error:', err)
        );
      }
    }
  }

  triggerSuccessTransaction('Report Status Updated', `Updated report status to ${status}.`);
  logActivity('Update Disciplinary Report', 'Disciplinary Records', updatedBy, `Updated report ${id} status to ${status}.`);
}

export function updateDisciplinaryReportReview(
  id: string,
  data: {
    status?: DisciplinaryReportStatus;
    classificationCategory?: ReportClassificationCategory;
    investigationNotes?: string;
    grievanceResolutionNotes?: string;
    incidentDocumentationNotes?: string;
    disciplinaryEvaluationNotes?: string;
    actionTaken?: string;
  },
  updatedBy: string
): void {
  const reports = getDisciplinaryReports();
  let targetReport: DisciplinaryReport | null = null;
  const updated = reports.map((r) => {
    if (r.id === id) {
      targetReport = {
        ...r,
        status: data.status !== undefined ? data.status : r.status,
        classificationCategory: data.classificationCategory !== undefined ? data.classificationCategory : r.classificationCategory,
        investigationNotes: data.investigationNotes !== undefined ? data.investigationNotes : r.investigationNotes,
        grievanceResolutionNotes: data.grievanceResolutionNotes !== undefined ? data.grievanceResolutionNotes : r.grievanceResolutionNotes,
        incidentDocumentationNotes: data.incidentDocumentationNotes !== undefined ? data.incidentDocumentationNotes : r.incidentDocumentationNotes,
        disciplinaryEvaluationNotes: data.disciplinaryEvaluationNotes !== undefined ? data.disciplinaryEvaluationNotes : r.disciplinaryEvaluationNotes,
        actionTaken: data.actionTaken !== undefined ? data.actionTaken : r.actionTaken,
        updatedAt: Date.now(),
      };
      return targetReport;
    }
    return r;
  });

  setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);

  // Directly update Firestore document in 'disciplinary_reports' collection for real-time sync
  try {
    if (targetReport) {
      const docRef = doc(db, 'disciplinary_reports', id);
      setDoc(docRef, cleanForFirestore(targetReport), { merge: true }).catch(() => {});
    }
  } catch (_) {}

  triggerSuccessTransaction('Report Review Updated', 'Updated report review details successfully.');
  logActivity('Update Report Review', 'Reports/Concerns', updatedBy, `Updated review details for report #${id}.`);
}

export function createDisciplinaryRecordFromReport(
  reportId: string,
  recordData: {
    studentId: string;
    studentName: string;
    course?: string;
    yearLevel?: string;
    offenseType: string;
    description: string;
    sanction: string;
    reportedBy?: string;
    actionTaken?: string;
    actionTakenOther?: string;
    startDate?: string;
    completionDate?: string;
    status?: 'SANCTIONED' | 'COMPLETED';
    remarks?: string;
    location?: string;
    evidenceFileName?: string;
    evidenceUrl?: string;
    reportDate?: string;
    reportTime?: string;
    incidentTypes?: string[];
    incidentTypeOther?: string;
    guidanceAssessment?: string;
    caseClassification?: string;
  },
  adminName: string
): DisciplinaryRecord {
  // Resolve student info accurately against registered students directory
  const allUsers = getUsers();
  const matchedUser = allUsers.find(
    (u) =>
      (recordData.studentId && u.studentId && u.studentId.trim().toLowerCase() === recordData.studentId.trim().toLowerCase()) ||
      (u.fullName && recordData.studentName && u.fullName.trim().toLowerCase() === recordData.studentName.trim().toLowerCase()) ||
      u.id === recordData.studentId
  );

  const resolvedStudentId = (matchedUser?.studentId || recordData.studentId || '').trim();
  const resolvedStudentName = (matchedUser?.fullName || recordData.studentName || '').trim();
  const resolvedCourse = recordData.course?.trim() || matchedUser?.course || '';
  const resolvedYearLevel = recordData.yearLevel?.trim() || matchedUser?.yearLevel || '';
  const hasActualSanction = Boolean(recordData.sanction && recordData.sanction.trim().length > 0);

  // Prevent duplicate entries linked by reportId and studentId
  const existingRecords = getDisciplinaryRecords();
  const existingDuplicate = existingRecords.find((r) => {
    if (reportId) {
      return (
        r.reportId === reportId &&
        (!resolvedStudentId || !r.studentId || r.studentId.trim().toLowerCase() === resolvedStudentId.toLowerCase())
      );
    }
    return (
      Boolean(resolvedStudentId) &&
      r.studentId === resolvedStudentId &&
      r.offenseType === recordData.offenseType &&
      r.sanction === recordData.sanction &&
      r.dateLogged === new Date().toISOString().split('T')[0]
    );
  });

  let newRec: DisciplinaryRecord;
  if (existingDuplicate) {
    newRec = existingDuplicate;
    const updatedRecords = existingRecords.map((r) =>
      r.id === existingDuplicate.id
        ? {
            ...r,
            reportId: reportId || r.reportId,
            studentId: resolvedStudentId || r.studentId,
            sanction: hasActualSanction ? recordData.sanction.trim() : r.sanction,
            startDate: recordData.startDate || r.startDate,
            completionDate: recordData.completionDate || r.completionDate,
            status: hasActualSanction ? ('SANCTIONED' as const) : r.status,
            actionTaken: recordData.actionTaken || r.actionTaken,
            actionTakenOther: recordData.actionTakenOther || r.actionTakenOther,
            guidanceAssessment: recordData.guidanceAssessment || r.guidanceAssessment,
            caseClassification: recordData.caseClassification || r.caseClassification,
            incidentTypes: recordData.incidentTypes || r.incidentTypes,
            incidentTypeOther: recordData.incidentTypeOther || r.incidentTypeOther,
            reportDate: recordData.reportDate || r.reportDate,
            reportTime: recordData.reportTime || r.reportTime,
          }
        : r
    );
    setStoredData(STORAGE_KEYS.DISCIPLINARY, updatedRecords, true);
    newRec = updatedRecords.find((r) => r.id === existingDuplicate.id) || existingDuplicate;
    try {
      const recDocRef = doc(db, 'disciplinary_records', newRec.id);
      setDoc(recDocRef, cleanForFirestore(newRec), { merge: true }).catch(() => {});
    } catch (_) {}
  } else {
    newRec = addDisciplinaryRecord(
      {
        studentId: resolvedStudentId,
        studentName: resolvedStudentName,
        course: resolvedCourse,
        yearLevel: resolvedYearLevel,
        offenseType: recordData.offenseType || 'Discipline',
        description: recordData.description,
        sanction: hasActualSanction ? recordData.sanction.trim() : '',
        reportedBy: recordData.reportedBy,
        actionTaken: recordData.actionTaken,
        actionTakenOther: recordData.actionTakenOther,
        startDate: hasActualSanction ? recordData.startDate : undefined,
        completionDate: hasActualSanction ? recordData.completionDate : undefined,
        remarks: recordData.remarks,
        location: recordData.location,
        evidenceFileName: recordData.evidenceFileName,
        evidenceUrl: recordData.evidenceUrl,
        status: hasActualSanction ? (recordData.status || 'SANCTIONED') : undefined,
        reportDate: recordData.reportDate,
        reportTime: recordData.reportTime,
        incidentTypes: recordData.incidentTypes,
        incidentTypeOther: recordData.incidentTypeOther,
        guidanceAssessment: recordData.guidanceAssessment,
        caseClassification: recordData.caseClassification,
      },
      adminName
    );

    // Link back with extended fields including reportId and studentId
    const records = getDisciplinaryRecords();
    let finalLinkedRec: DisciplinaryRecord = newRec;
    const updatedRecords = records.map((r) => {
      if (r.id === newRec.id) {
        finalLinkedRec = {
          ...r,
          reportId,
          studentId: resolvedStudentId || r.studentId,
          offenseType: recordData.offenseType || 'Discipline',
          sanction: hasActualSanction ? recordData.sanction.trim() : '',
          startDate: hasActualSanction ? recordData.startDate : undefined,
          completionDate: hasActualSanction ? recordData.completionDate : undefined,
          status: hasActualSanction ? (recordData.status || 'SANCTIONED') : undefined,
          remarks: recordData.remarks,
          location: recordData.location || r.location,
          evidenceFileName: recordData.evidenceFileName || r.evidenceFileName,
          evidenceUrl: recordData.evidenceUrl || r.evidenceUrl,
          reportDate: recordData.reportDate || r.reportDate,
          reportTime: recordData.reportTime || r.reportTime,
          incidentTypes: recordData.incidentTypes || r.incidentTypes,
          incidentTypeOther: recordData.incidentTypeOther || r.incidentTypeOther,
          guidanceAssessment: recordData.guidanceAssessment || r.guidanceAssessment,
          caseClassification: recordData.caseClassification || r.caseClassification,
        };
        return finalLinkedRec;
      }
      return r;
    });
    newRec = finalLinkedRec;
    setStoredData(STORAGE_KEYS.DISCIPLINARY, updatedRecords, true);
    try {
      const recDocRef = doc(db, 'disciplinary_records', newRec.id);
      setDoc(recDocRef, cleanForFirestore(newRec), { merge: true }).catch(() => {});
    } catch (_) {}
  }

  // Keep original Student Report in Student Reports (do not delete or remove)
  if (reportId) {
    const reports = getDisciplinaryReports();
    let updatedTarget: DisciplinaryReport | null = null;
    const updatedReports = reports.map((r) => {
      if (r.id === reportId) {
        updatedTarget = {
          ...r,
          isSavedRecord: true,
          status: (hasActualSanction ? 'Sanction' : (r.status === 'SUBMITTED' ? 'SAVED_RECORD' : r.status)) as DisciplinaryReportStatus,
          classificationCategory: 'Disciplinary' as ReportClassificationCategory,
          disciplinaryRecordId: newRec.id,
          linkedRecordId: newRec.id,
          actionTaken: recordData.actionTaken || r.actionTaken,
          actionTakenOther: recordData.actionTakenOther || r.actionTakenOther,
          updatedAt: Date.now(),
        };
        return updatedTarget;
      }
      return r;
    });
    setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updatedReports, true);

    try {
      if (updatedTarget) {
        const docRef = doc(db, 'disciplinary_reports', reportId);
        setDoc(docRef, cleanForFirestore(updatedTarget), { merge: true }).catch(() => {});
      }
    } catch (_) {}
  }

  triggerSuccessTransaction(
    hasActualSanction ? 'Disciplinary Sanction Created' : 'Disciplinary Action Recorded',
    hasActualSanction
      ? `Opisyal nang naitala ang disciplinary sanction para kay ${resolvedStudentName}.`
      : `Opisyal nang naitala sa Official Records ang disciplinary action para kay ${resolvedStudentName} (walang automatic sanction).`
  );

  return newRec;
}

export interface UnifiedStudentReport {
  id: string;
  studentId: string;
  studentName: string;
  incidentType: string;
  location: string;
  description: string;
  status: string;
  reportedAt: string;
  isUrgent?: boolean;
  classificationCategory?: string;
  disciplinaryRecordId?: string;
  rawDisciplinary?: DisciplinaryReport;
  rawSafety?: SafetyReport;
}

export function getAllStudentReports(): UnifiedStudentReport[] {
  const discReports = getDisciplinaryReports();
  const safetyReports = getSafetyReports();

  const unified: UnifiedStudentReport[] = [];

  discReports.forEach((d) => {
    unified.push({
      id: d.id,
      studentId: d.reportedStudentId || d.reporterStudentId || 'N/A',
      studentName: d.reportedStudentName || d.reporterName || 'Student',
      incidentType: d.incidentType || 'Incident',
      location: d.location || 'Campus',
      description: d.description || '',
      status: d.status || 'SUBMITTED',
      reportedAt: d.submittedAt || new Date().toISOString(),
      isUrgent: true,
      classificationCategory: d.classificationCategory,
      disciplinaryRecordId: d.disciplinaryRecordId || d.linkedRecordId,
      rawDisciplinary: d,
    });
  });

  safetyReports.forEach((s) => {
    if (!unified.some((u) => u.id === s.id)) {
      unified.push({
        id: s.id,
        studentId: s.studentId || 'N/A',
        studentName: s.studentName || 'Student',
        incidentType: 'Safety Concern',
        location: s.location || 'Campus',
        description: s.description || '',
        status: s.status || 'REPORTED',
        reportedAt: s.reportedAt || new Date().toISOString(),
        isUrgent: s.isUrgent,
        rawSafety: s,
      });
    }
  });

  unified.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  return unified;
}

export function archiveDisciplinaryReport(id: string, archivedBy: string): void {
  const reports = getDisciplinaryReports();
  const target = reports.find((r) => r.id === id);
  if (target) {
    const archivedReport: DisciplinaryReport = { ...target, isArchived: true, updatedAt: Date.now() };
    archiveItem(
      'DISCIPLINARY_REPORT',
      target.id,
      `Disciplinary Report: ${target.reportedStudentName} (${target.incidentType})`,
      archivedReport,
      archivedBy
    );
    // Keep record stored (marked isArchived: true) so Student Portal Report History is permanently preserved
    const updated = reports.map((r) => (r.id === id ? archivedReport : r));
    setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);
    try {
      setDoc(doc(db, 'disciplinary_reports', id), archivedReport, { merge: true }).catch(() => {});
    } catch (_) {}
    triggerSuccessTransaction('Report Archived', 'Ang Report Resolution ay inilipat na sa System Archive Vault.');
    logActivity('Archive Disciplinary Report', 'Disciplinary Records', archivedBy, `Archived report against ${target.reportedStudentName}.`);
  }
}

export function archiveReportResolution(id: string, archivedBy: string): void {
  const reports = getDisciplinaryReports();
  const target = reports.find((r) => r.id === id);
  if (target) {
    const archivedReport: DisciplinaryReport = { ...target, isResolutionArchived: true, updatedAt: Date.now() };
    archiveItem(
      'RESOLUTION',
      target.id,
      `Resolution: ${target.reportedStudentName} (#${target.id})`,
      archivedReport,
      archivedBy
    );
    const updated = reports.map((r) => (r.id === id ? archivedReport : r));
    setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, updated, true);
    try {
      setDoc(doc(db, 'disciplinary_reports', id), { isResolutionArchived: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    } catch (_) {}
    triggerSuccessTransaction('Resolution Archived', 'The resolution has been moved to the System Archive Vault.');
    logActivity('Archive Resolution', 'Resolutions', archivedBy, `Archived resolution for ${target.reportedStudentName} (#${id}).`);
    safeDispatchEvent('osas_storage_updated');
  }
}

export const archiveDisciplinaryReportResolution = archiveReportResolution;

// --- DISCIPLINARY RECORDS API ---
export function getDisciplinaryRecords(role?: UserRole | 'ADMIN' | 'GUIDANCE_ADMIN' | 'STUDENT'): DisciplinaryRecord[] {
  const all = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
  if (role === 'STUDENT') {
    return all;
  }
  return all.filter((rec) => !rec.isArchivedByAdmin);
}

export function getReferredDisciplinaryRecords(): DisciplinaryRecord[] {
  const allDisc = getDisciplinaryRecords().filter((rec) => rec.referredToGuidance);
  const allIntv = getReferredInterventionRecords();
  const map = new Map<string, DisciplinaryRecord>();

  allDisc.forEach((d) => {
    const key = d.linkedInterventionId || d.id;
    map.set(key, d);
  });

  allIntv.forEach((inv) => {
    const key = inv.id;
    const existing = map.get(key) || (inv.linkedDisciplinaryId ? allDisc.find((d) => d.id === inv.linkedDisciplinaryId) : undefined);
    if (existing) {
      map.set(key, {
        ...existing,
        guidanceStatus: (inv.status as any) || existing.guidanceStatus || 'REFERRED',
        guidanceCounselorAssigned: inv.guidanceCounselorAssigned || existing.guidanceCounselorAssigned,
        guidanceSessionCount: inv.guidanceSessionCount ?? inv.guidanceSessionsCount ?? existing.guidanceSessionCount,
        guidanceActionTaken: inv.guidanceActionTaken || existing.guidanceActionTaken,
        guidanceOutcomeSummary: inv.guidanceOutcomeSummary || existing.guidanceOutcomeSummary,
        guidanceFollowUpPlan: inv.guidanceFollowUpPlan || existing.guidanceFollowUpPlan,
        guidanceConfidentialNotes: inv.guidanceConfidentialNotes || inv.guidanceNotes || existing.guidanceConfidentialNotes,
        linkedInterventionId: inv.id,
      });
    } else {
      map.set(key, {
        id: inv.id,
        studentId: inv.studentId,
        studentName: inv.studentName,
        course: inv.course,
        yearLevel: inv.yearLevel,
        offenseType: (inv.reasons && inv.reasons[0]) || 'Student Intervention Referral',
        sanction: inv.recommendedDesignation || 'Guidance and Counseling Services',
        description: inv.reasonForReferral || inv.descriptionOfConcerns || inv.guidanceReferralNotes || '',
        reportedBy: inv.nameOfReferrer || inv.referredBy || 'OSAS Administrator',
        actionTaken: inv.summaryOfActionTaken || inv.actionTakenSummary || 'Referred to Guidance',
        dateLogged: inv.dateOfReferral || new Date().toISOString().split('T')[0],
        issuedBy: inv.guidanceReferralBy || inv.createdBy || 'OSAS Administrator',
        isArchivedByAdmin: false,
        isArchived: false,
        status: 'SANCTIONED',
        referredToGuidance: true,
        guidanceReferralDate: inv.guidanceReferralDate || inv.createdAt,
        guidanceReferralNotes: inv.guidanceReferralNotes || inv.reasonForReferral || inv.descriptionOfConcerns,
        guidanceReferralBy: inv.guidanceReferralBy || inv.nameOfReferrer || inv.referredBy,
        guidanceStatus: (inv.status as any) || inv.guidanceStatus || 'REFERRED',
        guidanceCounselorAssigned: inv.guidanceCounselorAssigned,
        guidanceSessionCount: inv.guidanceSessionCount ?? inv.guidanceSessionsCount,
        guidanceActionTaken: inv.guidanceActionTaken,
        guidanceOutcomeSummary: inv.guidanceOutcomeSummary,
        guidanceFollowUpPlan: inv.guidanceFollowUpPlan,
        guidanceConfidentialNotes: inv.guidanceConfidentialNotes || inv.guidanceNotes,
        linkedInterventionId: inv.id,
      });
    }
  });

  return Array.from(map.values());
}

export function referDisciplinaryRecordToGuidance(
  id: string,
  dataOrNotes:
    | {
        reason?: string;
        urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        specificSupportAreas?: string[];
        notes: string;
        referredBy: string;
      }
    | string,
  referredByFallback?: string
): void {
  const allDisc = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
  const allIntv = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
  const allUsers = getUsers();

  const isObj = typeof dataOrNotes === 'object';
  const notes = isObj ? dataOrNotes.notes : dataOrNotes;
  const referredBy = isObj ? dataOrNotes.referredBy : referredByFallback || 'Princess Ann T. Ruzol (OSAS Admin)';
  const reason = isObj && dataOrNotes.reason ? dataOrNotes.reason : 'Disciplinary Rehabilitation';
  const urgency = isObj && dataOrNotes.urgency ? dataOrNotes.urgency : 'MEDIUM';
  const supportAreas = isObj && dataOrNotes.specificSupportAreas ? dataOrNotes.specificSupportAreas : [];

  let targetStudentName = '';
  let targetStudentId = '';
  let targetOffense = '';
  let targetSanction = '';
  const existingIntv = allIntv.find((inv) => inv.linkedDisciplinaryId === id);
  const generatedIntvId = existingIntv ? existingIntv.id : `intv-disc-${Date.now()}`;

  const updatedDisc = allDisc.map((r) => {
    if (r.id === id) {
      targetStudentName = r.studentName;
      targetStudentId = r.studentId;
      targetOffense = r.offenseType;
      targetSanction = r.sanction;
      return {
        ...r,
        referredToGuidance: true,
        guidanceReferralDate: new Date().toISOString(),
        guidanceReferralNotes: notes,
        guidanceReferralBy: referredBy,
        guidanceStatus: 'REFERRED' as const,
        linkedInterventionId: r.linkedInterventionId || generatedIntvId,
      };
    }
    return r;
  });
  setStoredData(STORAGE_KEYS.DISCIPLINARY, updatedDisc);

  // Find student profile for contact/course info
  const studentUser = allUsers.find(
    (u) => u.studentId === targetStudentId || u.id === targetStudentId || u.fullName.toLowerCase() === targetStudentName.toLowerCase()
  );

  // Check if an intervention already exists linked to this disciplinary record
  const existingIntvIndex = allIntv.findIndex((inv) => inv.linkedDisciplinaryId === id || inv.id === generatedIntvId);
  if (existingIntvIndex >= 0) {
    allIntv[existingIntvIndex] = {
      ...allIntv[existingIntvIndex],
      referredToGuidance: true,
      guidanceReferralDate: new Date().toISOString(),
      guidanceReferralNotes: notes,
      guidanceReferralBy: referredBy,
      guidanceStatus: 'REFERRED',
      dateOfReferral: new Date().toISOString().split('T')[0],
      reasons: Array.from(new Set([...allIntv[existingIntvIndex].reasons, reason, 'Disciplinary Rehabilitation'])),
      descriptionOfConcerns: notes || allIntv[existingIntvIndex].descriptionOfConcerns,
      urgencyLevel: urgency,
      specificSupportAreas: supportAreas.length > 0 ? supportAreas : allIntv[existingIntvIndex].specificSupportAreas,
      status: 'REFERRED',
      linkedDisciplinaryOffense: targetOffense,
      linkedDisciplinarySanction: targetSanction,
    };
    setStoredData(STORAGE_KEYS.INTERVENTIONS, allIntv);
  } else {
    const newIntv: InterventionRecord = {
      id: generatedIntvId,
      studentId: targetStudentId || 'STUDENT',
      studentName: targetStudentName || 'Student',
      course: studentUser?.course || '',
      yearLevel: studentUser?.yearLevel || '',
      contactNumber: studentUser?.contactNumber || '',
      address: studentUser?.address || '',
      dateOfReferral: new Date().toISOString().split('T')[0],
      referredBy: 'OSAS Officer',
      nameOfReferrer: referredBy,
      relationshipToStudent: 'OSAS Disciplinary Officer',
      reasons: [reason, 'Disciplinary Rehabilitation'],
      descriptionOfConcerns: notes || `Referred by OSAS Disciplinary Office regarding ${targetOffense}. Sanction: ${targetSanction}.`,
      urgencyLevel: urgency,
      specificSupportAreas: supportAreas.length > 0 ? supportAreas : ['Emotional Regulation', 'Behavioral Adjustment'],
      linkedDisciplinaryId: id,
      linkedDisciplinaryOffense: targetOffense,
      linkedDisciplinarySanction: targetSanction,
      referredToGuidance: true,
      guidanceReferralDate: new Date().toISOString(),
      guidanceReferralNotes: notes,
      guidanceReferralBy: referredBy,
      guidanceStatus: 'REFERRED',
      strategies: ['Counseling Services', 'Referral to Guidance Counselor', 'Behavioral Agreement / Contract'],
      nextSteps: 'Initial counseling intake interview and behavioral reflection session.',
      responsibleParties: 'Guidance Counselor, Student, OSAS Officer',
      status: 'REFERRED',
      createdAt: new Date().toISOString(),
      createdBy: referredBy,
      isArchived: false,
    };
    setStoredData(STORAGE_KEYS.INTERVENTIONS, [newIntv, ...allIntv]);
  }

  triggerSuccessTransaction(
    'Referred to Guidance Office',
    `Ang disciplinary case para kay ${targetStudentName} ay opisyal nang nai-endorse sa Guidance Admin para sa counseling at intervention.`
  );
  logActivity(
    'Refer Disciplinary Case to Guidance',
    'Disciplinary Records',
    referredBy,
    `Referred disciplinary record #${id} (${targetStudentName} - ${targetOffense}) to Guidance Office. Reason: ${reason}. Urgency: ${urgency}. Notes: ${notes}`
  );
  sendNotification(
    'GUIDANCE_ADMIN',
    `New Guidance Referral: ${targetStudentName}`,
    `OSAS Admin referred ${targetStudentName} (${targetOffense}) for counseling intervention. Priority: ${urgency}.`,
    'SYSTEM',
    'referred_disciplinary'
  );

  if (targetStudentId) {
    sendNotification(
      targetStudentId,
      `Guidance Counseling Referral`,
      `Your case regarding ${targetOffense} has been endorsed to the Guidance Counseling Office for guidance and support.`,
      'SYSTEM',
      'disciplinary'
    );
  }
}

export function updateGuidanceDisciplinaryAction(
  id: string,
  dataOrNotes:
    | {
        guidanceNotes?: string;
        guidanceCounselingNotes?: string;
        guidanceConfidentialNotes?: string;
        guidanceOutcomeSummary?: string;
        guidanceActionTaken?: string;
        guidanceStatus?: GuidanceCaseStatus | 'REFERRED' | 'RECEIVED' | 'IN_PROGRESS' | 'FOLLOW_UP' | 'COMPLETED';
        guidanceFollowUpPlan?: string;
        guidanceSessionCount?: number;
        guidanceCounselorAssigned?: string;
        guidanceCompletionDate?: string;
        updatedBy?: string;
      }
    | string,
  actionTaken?: string,
  guidanceStatus?: GuidanceCaseStatus | 'REFERRED' | 'RECEIVED' | 'IN_PROGRESS' | 'FOLLOW_UP' | 'COMPLETED',
  updatedBy?: string
): void {
  const allDisc = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
  const allIntv = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);

  const isObj = typeof dataOrNotes === 'object';
  const confidentialNotes = isObj
    ? dataOrNotes.guidanceConfidentialNotes || dataOrNotes.guidanceCounselingNotes || dataOrNotes.guidanceNotes || ''
    : dataOrNotes || '';
  const outcomeSummary = isObj ? dataOrNotes.guidanceOutcomeSummary || '' : '';
  const finalAction = isObj ? dataOrNotes.guidanceActionTaken || '' : actionTaken || '';
  const finalStatus = (isObj && dataOrNotes.guidanceStatus ? dataOrNotes.guidanceStatus : guidanceStatus || 'IN_PROGRESS') as
    | 'REFERRED'
    | 'RECEIVED'
    | 'IN_PROGRESS'
    | 'FOLLOW_UP'
    | 'COMPLETED';
  const counselorName = isObj && dataOrNotes.guidanceCounselorAssigned
    ? dataOrNotes.guidanceCounselorAssigned
    : isObj && dataOrNotes.updatedBy
    ? dataOrNotes.updatedBy
    : updatedBy || 'Guidance Counselor';
  const sessionCount = isObj && typeof dataOrNotes.guidanceSessionCount === 'number' ? dataOrNotes.guidanceSessionCount : undefined;
  const followUpPlan = isObj ? dataOrNotes.guidanceFollowUpPlan : undefined;

  let targetStudentName = '';
  let targetStudentId = '';
  let linkedIntvId = id.replace(/^INTV-REF-/, '');

  // Update Disciplinary Record if one exists
  const updatedDisc = allDisc.map((r) => {
    if (r.id === id || r.linkedInterventionId === id || r.linkedInterventionId === linkedIntvId) {
      targetStudentName = r.studentName;
      targetStudentId = r.studentId;
      if (r.linkedInterventionId) linkedIntvId = r.linkedInterventionId;
      return {
        ...r,
        guidanceActionTaken: finalAction,
        guidanceOutcomeSummary: outcomeSummary,
        guidanceStatus: finalStatus,
        guidanceCounselorAssigned: counselorName,
        guidanceSessionCount: sessionCount !== undefined ? sessionCount : r.guidanceSessionCount,
        guidanceFollowUpPlan: followUpPlan !== undefined ? followUpPlan : r.guidanceFollowUpPlan,
        guidanceConfidentialNotes: confidentialNotes || r.guidanceConfidentialNotes,
        guidanceReferralBy: r.guidanceReferralBy || counselorName,
      };
    }
    return r;
  });
  setStoredData(STORAGE_KEYS.DISCIPLINARY, updatedDisc);

  // Sync with corresponding InterventionRecord
  const updatedIntv = allIntv.map((inv) => {
    if (inv.id === id || inv.linkedDisciplinaryId === id || (linkedIntvId && inv.id === linkedIntvId)) {
      if (!targetStudentName && inv.studentName) targetStudentName = inv.studentName;
      if (!targetStudentId && inv.studentId) targetStudentId = inv.studentId;
      return {
        ...inv,
        status: finalStatus,
        guidanceStatus: finalStatus,
        guidanceCounselorAssigned: counselorName,
        guidanceConfidentialNotes: confidentialNotes,
        guidanceNotes: confidentialNotes,
        guidanceOutcomeSummary: outcomeSummary,
        guidanceActionTaken: finalAction,
        guidanceActionTakenRemarks: finalAction,
        receivedActionRemarks: finalAction,
        guidanceFollowUpPlan: followUpPlan !== undefined ? followUpPlan : inv.guidanceFollowUpPlan,
        guidanceSessionCount: sessionCount !== undefined ? sessionCount : inv.guidanceSessionCount,
        guidanceSessionsCount: sessionCount !== undefined ? sessionCount : inv.guidanceSessionsCount,
        guidanceLastSessionDate: new Date().toISOString().split('T')[0],
        guidanceReceivedDate: inv.guidanceReceivedDate || (finalStatus !== 'REFERRED' ? new Date().toISOString() : undefined),
        guidanceCompletionDate: finalStatus === 'COMPLETED' ? new Date().toISOString() : inv.guidanceCompletionDate,
      };
    }
    return inv;
  });
  setStoredData(STORAGE_KEYS.INTERVENTIONS, updatedIntv);

  triggerSuccessTransaction(
    'Guidance Intervention Updated',
    `Matagumpay na na-update ang intervention status (${finalStatus}) para kay ${targetStudentName || 'estudyante'}.`
  );
  logActivity(
    'Guidance Intervention Action',
    'Guidance Office',
    counselorName,
    `Updated guidance intervention for case #${id} (${targetStudentName}). Status: ${finalStatus}. Action: ${finalAction}`
  );

  // Notify OSAS Admin on all updates
  sendNotification(
    'ADMIN',
    `Guidance Case Update: ${targetStudentName || 'Student'}`,
    `Guidance Counselor (${counselorName}) updated referral case for ${targetStudentName || 'student'}. Status: ${finalStatus}. Action: ${finalAction || 'Session conducted'}.`,
    'SYSTEM',
    'intervention'
  );

  // Notify Student
  if (targetStudentId) {
    sendNotification(
      targetStudentId,
      `Guidance Counseling Case Update`,
      `Your guidance counseling referral status is now "${finalStatus}". Counselor: ${counselorName}.`,
      'SYSTEM',
      'disciplinary'
    );
  }
}

// --- INTERVENTION RECORDS API ---
export function getReferredInterventionRecords(): InterventionRecord[] {
  const all = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
  return all.filter(
    (rec) =>
      !rec.isArchived &&
      (rec.referredToGuidance ||
        rec.status === 'REFERRED' ||
        rec.status === 'RECEIVED' ||
        rec.status === 'IN_PROGRESS' ||
        rec.status === 'FOLLOW_UP' ||
        rec.status === 'COMPLETED' ||
        Boolean(rec.guidanceStatus) ||
        Boolean(rec.linkedDisciplinaryId))
  );
}

export function referInterventionRecordToGuidance(
  id: string,
  dataOrNotes:
    | (Partial<InterventionRecord> & {
        reason?: string;
        notes?: string;
        urgency?: InterventionUrgency;
      })
    | string,
  referredByFallback?: string
): void {
  const allIntv = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
  const allDisc = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);

  const isObj = typeof dataOrNotes === 'object';
  const notes = isObj ? (dataOrNotes.notes || dataOrNotes.reasonForReferral || dataOrNotes.descriptionOfConcerns || '') : dataOrNotes;
  const referredBy = isObj ? (dataOrNotes.referredBy || 'Princess Ann T. Ruzol (OSAS Administrator)') : referredByFallback || 'Princess Ann T. Ruzol (OSAS Administrator)';
  const reason = isObj && dataOrNotes.reason ? dataOrNotes.reason : 'Behavioral Issues';
  const urgency = isObj && dataOrNotes.urgency ? dataOrNotes.urgency : 'MEDIUM';
  const urgencyOfReferral = isObj && dataOrNotes.urgencyOfReferral ? dataOrNotes.urgencyOfReferral : 'Within 3 days';
  const supportAreas = isObj && dataOrNotes.specificSupportAreas ? dataOrNotes.specificSupportAreas : [];

  let targetStudentName = '';
  let linkedDiscId: string | undefined;

  const updatedIntv = allIntv.map((rec) => {
    if (rec.id === id) {
      targetStudentName = (isObj && dataOrNotes.studentName) ? dataOrNotes.studentName : rec.studentName;
      linkedDiscId = rec.linkedDisciplinaryId;
      return {
        ...rec,
        ...(isObj ? dataOrNotes : {}),
        id: rec.id,
        studentId: isObj && dataOrNotes.studentId ? dataOrNotes.studentId : rec.studentId,
        studentName: targetStudentName,
        course: isObj && dataOrNotes.course !== undefined ? dataOrNotes.course : rec.course,
        yearLevel: isObj && dataOrNotes.yearLevel !== undefined ? dataOrNotes.yearLevel : rec.yearLevel,
        contactNumber: isObj && dataOrNotes.contactNumber !== undefined ? dataOrNotes.contactNumber : rec.contactNumber,
        address: isObj && dataOrNotes.address !== undefined ? dataOrNotes.address : rec.address,
        dateOfReferral: isObj && dataOrNotes.dateOfReferral ? dataOrNotes.dateOfReferral : rec.dateOfReferral,
        nameOfReferrer: isObj && dataOrNotes.nameOfReferrer !== undefined ? dataOrNotes.nameOfReferrer : rec.nameOfReferrer,
        relationshipToStudent: isObj && dataOrNotes.relationshipToStudent !== undefined ? dataOrNotes.relationshipToStudent : rec.relationshipToStudent,
        referredByOther: isObj && dataOrNotes.referredByOther !== undefined ? dataOrNotes.referredByOther : rec.referredByOther,
        descriptionOfConcerns: isObj && dataOrNotes.descriptionOfConcerns !== undefined ? dataOrNotes.descriptionOfConcerns : rec.descriptionOfConcerns,
        strategies: isObj && dataOrNotes.strategies && dataOrNotes.strategies.length > 0 ? dataOrNotes.strategies : rec.strategies,
        strategiesOther: isObj && dataOrNotes.strategiesOther !== undefined ? dataOrNotes.strategiesOther : rec.strategiesOther,
        followUpDate: isObj && dataOrNotes.followUpDate !== undefined ? dataOrNotes.followUpDate : rec.followUpDate,
        nextSteps: isObj && dataOrNotes.nextSteps !== undefined ? dataOrNotes.nextSteps : rec.nextSteps,
        responsibleParties: isObj && dataOrNotes.responsibleParties !== undefined ? dataOrNotes.responsibleParties : rec.responsibleParties,
        referredToGuidance: true,
        guidanceReferralDate: rec.guidanceReferralDate || new Date().toISOString(),
        guidanceReferralNotes: notes,
        guidanceReferralBy: referredBy,
        guidanceStatus: (rec.guidanceStatus && rec.guidanceStatus !== 'REFERRED' ? rec.guidanceStatus : 'REFERRED') as any,
        status: (rec.status && rec.status !== 'ACTIVE' ? rec.status : 'REFERRED') as any,
        urgency: urgency,
        urgencyLevel: urgency,
        urgencyOfReferral: urgencyOfReferral,
        specificSupportAreas: supportAreas.length > 0 ? supportAreas : rec.specificSupportAreas,
        reasons: isObj && dataOrNotes.reasons && dataOrNotes.reasons.length > 0 ? dataOrNotes.reasons : (reason ? Array.from(new Set([...rec.reasons, reason])) : rec.reasons),
        reasonsOther: isObj && dataOrNotes.reasonsOther !== undefined ? dataOrNotes.reasonsOther : rec.reasonsOther,
        referredByPersonnel: isObj && dataOrNotes.referredByPersonnel ? dataOrNotes.referredByPersonnel : (rec.referredByPersonnel || rec.nameOfReferrer || referredBy),
        referredBy: isObj && dataOrNotes.referredBy ? dataOrNotes.referredBy : rec.referredBy,
        referredByDesignation: isObj && dataOrNotes.referredByDesignation ? dataOrNotes.referredByDesignation : (rec.referredByDesignation || rec.relationshipToStudent || 'OSAS Administrator'),
        reasonForReferral: isObj && dataOrNotes.reasonForReferral ? dataOrNotes.reasonForReferral : (rec.reasonForReferral || notes),
        recommendedDesignation: isObj && dataOrNotes.recommendedDesignation ? dataOrNotes.recommendedDesignation : (rec.recommendedDesignation || 'Guidance and Counseling Services'),
        actionTakenSummary: isObj && dataOrNotes.actionTakenSummary ? dataOrNotes.actionTakenSummary : rec.actionTakenSummary,
        summaryOfActionTaken: isObj && dataOrNotes.summaryOfActionTaken ? dataOrNotes.summaryOfActionTaken : rec.summaryOfActionTaken,
        attachmentsType: isObj && dataOrNotes.attachmentsType ? dataOrNotes.attachmentsType : rec.attachmentsType,
        attachmentsOther: isObj && dataOrNotes.attachmentsOther ? dataOrNotes.attachmentsOther : rec.attachmentsOther,
        osasApprovalName: isObj && dataOrNotes.osasApprovalName ? dataOrNotes.osasApprovalName : (rec.osasApprovalName || 'Princess Ann T. Ruzol'),
        osasApprovalDate: isObj && dataOrNotes.osasApprovalDate ? dataOrNotes.osasApprovalDate : (rec.osasApprovalDate || new Date().toISOString().split('T')[0]),
        approvedBy: isObj && dataOrNotes.approvedBy ? dataOrNotes.approvedBy : (rec.approvedBy || 'OSAS Administrator'),
        receivedByName: isObj && dataOrNotes.receivedByName ? dataOrNotes.receivedByName : (rec.receivedByName || 'Guidance Counselor'),
        receivedByPosition: isObj && dataOrNotes.receivedByPosition ? dataOrNotes.receivedByPosition : (rec.receivedByPosition || 'Registered Guidance Counselor (RGC)'),
        receivedDate: isObj && dataOrNotes.receivedDate ? dataOrNotes.receivedDate : (rec.receivedDate || new Date().toISOString().split('T')[0]),
        receivedActionRemarks: isObj && dataOrNotes.receivedActionRemarks ? dataOrNotes.receivedActionRemarks : rec.receivedActionRemarks,
        guidanceActionTakenRemarks: isObj && dataOrNotes.guidanceActionTakenRemarks ? dataOrNotes.guidanceActionTakenRemarks : rec.guidanceActionTakenRemarks,
      };
    }
    return rec;
  });

  // If already linked to an existing DisciplinaryRecord, update its referral metadata without creating duplicates
  const targetIntv = updatedIntv.find((r) => r.id === id);
  if (targetIntv && linkedDiscId) {
    const existingDiscIndex = allDisc.findIndex((d) => d.id === linkedDiscId || d.linkedInterventionId === id);
    if (existingDiscIndex >= 0) {
      allDisc[existingDiscIndex] = {
        ...allDisc[existingDiscIndex],
        guidanceReferralNotes: notes,
        guidanceReferralBy: referredBy,
        referredToGuidance: true,
        linkedInterventionId: id,
      };
      setStoredData(STORAGE_KEYS.DISCIPLINARY, allDisc);
    }
  }

  setStoredData(STORAGE_KEYS.INTERVENTIONS, updatedIntv);

  triggerSuccessTransaction(
    'Referred to Guidance Office',
    `Ang intervention referral para kay ${targetStudentName} ay opisyal nang naipasa sa Guidance Admin.`
  );
  logActivity(
    'Refer Intervention to Guidance',
    'Intervention',
    referredBy,
    `Referred intervention record #${id} (${targetStudentName}) to Guidance Office. Urgency: ${urgencyOfReferral}. Notes: ${notes}`
  );
  sendNotification(
    'GUIDANCE_ADMIN',
    `New Referred Intervention Case: ${targetStudentName}`,
    `OSAS Admin referred ${targetStudentName} for counseling intervention. Priority: ${urgency}.`,
    'SYSTEM',
    'student_grievances'
  );

  if (targetIntv && targetIntv.studentId) {
    sendNotification(
      targetIntv.studentId,
      `Guidance Counseling Referral`,
      `Your student record/intervention case has been referred to Guidance Counseling Office for support.`,
      'SYSTEM',
      'intervention'
    );
  }
}

export function createDisciplinaryRecordFromIntervention(
  interventionId: string,
  recordData: {
    studentId: string;
    studentName: string;
    course?: string;
    yearLevel?: string;
    offenseType: string;
    description: string;
    sanction: string;
    reportedBy?: string;
    actionTaken?: string;
    actionTakenOther?: string;
    startDate?: string;
    completionDate?: string;
    status?: 'SANCTIONED' | 'COMPLETED';
    remarks?: string;
    location?: string;
    evidenceFileName?: string;
    evidenceUrl?: string;
  },
  actorName: string = 'Guidance Advocate'
): DisciplinaryRecord {
  const allIntv = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
  const allDisc = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
  const allUsers = getUsers();

  const cleanIntvId = interventionId.replace(/^INTV-REF-/, '');
  const targetIntv = allIntv.find(
    (inv) => inv.id === interventionId || inv.id === cleanIntvId || inv.linkedDisciplinaryId === interventionId
  );
  const resolvedIntvId = targetIntv ? targetIntv.id : cleanIntvId;

  const matchedUser = allUsers.find(
    (u) =>
      (recordData.studentId && u.studentId && u.studentId.trim().toLowerCase() === recordData.studentId.trim().toLowerCase()) ||
      (u.fullName && recordData.studentName && u.fullName.trim().toLowerCase() === recordData.studentName.trim().toLowerCase()) ||
      u.id === recordData.studentId
  );

  const resolvedStudentId = (matchedUser?.studentId || targetIntv?.studentId || recordData.studentId || '').trim();
  const resolvedStudentName = (matchedUser?.fullName || targetIntv?.studentName || recordData.studentName || '').trim();
  const resolvedCourse = recordData.course?.trim() || targetIntv?.course || matchedUser?.course || '';
  const resolvedYearLevel = recordData.yearLevel?.trim() || targetIntv?.yearLevel || matchedUser?.yearLevel || '';

  // Check if a disciplinary record is already linked to this intervention or matches to prevent duplicates
  const existingIndex = allDisc.findIndex(
    (d) =>
      (resolvedIntvId && d.linkedInterventionId === resolvedIntvId) ||
      (targetIntv?.linkedDisciplinaryId && d.id === targetIntv.linkedDisciplinaryId) ||
      d.id === interventionId ||
      (d.studentId === resolvedStudentId &&
        d.offenseType === recordData.offenseType &&
        d.sanction === recordData.sanction &&
        d.dateLogged === new Date().toISOString().split('T')[0])
  );

  let finalRecord: DisciplinaryRecord;

  if (existingIndex >= 0) {
    finalRecord = {
      ...allDisc[existingIndex],
      studentId: resolvedStudentId,
      studentName: resolvedStudentName,
      course: resolvedCourse,
      yearLevel: resolvedYearLevel,
      offenseType: recordData.offenseType || allDisc[existingIndex].offenseType,
      description: recordData.description || allDisc[existingIndex].description,
      sanction: recordData.sanction !== undefined ? recordData.sanction.trim() : allDisc[existingIndex].sanction,
      reportedBy: recordData.reportedBy || allDisc[existingIndex].reportedBy || actorName,
      actionTaken: recordData.actionTaken || allDisc[existingIndex].actionTaken || 'Written Warning Issued',
      actionTakenOther: recordData.actionTakenOther ?? allDisc[existingIndex].actionTakenOther,
      startDate: recordData.startDate || allDisc[existingIndex].startDate,
      completionDate: recordData.completionDate || allDisc[existingIndex].completionDate,
      remarks: recordData.remarks || allDisc[existingIndex].remarks,
      location: recordData.location || allDisc[existingIndex].location,
      evidenceFileName: recordData.evidenceFileName || allDisc[existingIndex].evidenceFileName,
      evidenceUrl: recordData.evidenceUrl || allDisc[existingIndex].evidenceUrl,
      status: recordData.sanction && recordData.sanction.trim() ? (recordData.status || 'SANCTIONED') : allDisc[existingIndex].status,
      referredToGuidance: true,
      linkedInterventionId: resolvedIntvId,
      guidanceStatus: (targetIntv?.status as any) || allDisc[existingIndex].guidanceStatus || 'COMPLETED',
      guidanceCounselorAssigned: targetIntv?.guidanceCounselorAssigned || allDisc[existingIndex].guidanceCounselorAssigned || actorName,
      guidanceOutcomeSummary: recordData.remarks || targetIntv?.guidanceOutcomeSummary || allDisc[existingIndex].guidanceOutcomeSummary,
      guidanceActionTaken: recordData.actionTaken || targetIntv?.guidanceActionTaken || allDisc[existingIndex].guidanceActionTaken,
    };
    allDisc[existingIndex] = finalRecord;
    setStoredData(STORAGE_KEYS.DISCIPLINARY, allDisc);
  } else {
    const hasSanctionVal = Boolean(recordData.sanction && recordData.sanction.trim());
    finalRecord = addDisciplinaryRecord(
      {
        studentId: resolvedStudentId,
        studentName: resolvedStudentName,
        course: resolvedCourse,
        yearLevel: resolvedYearLevel,
        offenseType: recordData.offenseType,
        description: recordData.description,
        sanction: hasSanctionVal ? recordData.sanction.trim() : '',
        reportedBy: recordData.reportedBy || targetIntv?.nameOfReferrer || targetIntv?.referredBy || actorName,
        actionTaken: recordData.actionTaken || 'Written Warning Issued',
        actionTakenOther: recordData.actionTakenOther,
        startDate: hasSanctionVal ? recordData.startDate : undefined,
        completionDate: hasSanctionVal ? recordData.completionDate : undefined,
        remarks: recordData.remarks,
        location: recordData.location,
        evidenceFileName: recordData.evidenceFileName,
        evidenceUrl: recordData.evidenceUrl,
        status: hasSanctionVal ? (recordData.status || 'SANCTIONED') : undefined,
      },
      actorName
    );

    const updatedDiscList = getDisciplinaryRecords().map((r) => {
      if (r.id === finalRecord.id) {
        finalRecord = {
          ...r,
          referredToGuidance: true,
          linkedInterventionId: resolvedIntvId,
          guidanceReferralDate: targetIntv?.guidanceReferralDate || targetIntv?.createdAt || new Date().toISOString(),
          guidanceReferralBy: targetIntv?.guidanceReferralBy || targetIntv?.referredBy || actorName,
          guidanceReferralNotes: targetIntv?.guidanceReferralNotes || targetIntv?.descriptionOfConcerns,
          guidanceStatus: (targetIntv?.status as any) || 'COMPLETED',
          guidanceCounselorAssigned: targetIntv?.guidanceCounselorAssigned || actorName,
          guidanceOutcomeSummary: recordData.remarks || targetIntv?.guidanceOutcomeSummary,
          guidanceActionTaken: recordData.actionTaken || targetIntv?.guidanceActionTaken,
        };
        return finalRecord;
      }
      return r;
    });
    setStoredData(STORAGE_KEYS.DISCIPLINARY, updatedDiscList);
  }

  // Link back to the original InterventionRecord without duplicating it
  if (targetIntv) {
    const updatedIntv = allIntv.map((inv) => {
      if (inv.id === targetIntv.id) {
        return {
          ...inv,
          referredToGuidance: true,
          linkedDisciplinaryId: finalRecord.id,
          linkedDisciplinaryOffense: finalRecord.offenseType,
          linkedDisciplinarySanction: finalRecord.sanction,
        };
      }
      return inv;
    });
    setStoredData(STORAGE_KEYS.INTERVENTIONS, updatedIntv);
  }

  triggerSuccessTransaction(
    'Official Disciplinary Record Saved',
    `Opisyal nang naitala sa Official Records ang disciplinary action para kay ${resolvedStudentName} na naka-link sa Guidance referral.`
  );

  return finalRecord;
}

export function getInterventionRecords(role?: 'ADMIN' | 'GUIDANCE_ADMIN' | 'STUDENT'): InterventionRecord[] {
  checkAndAutoArchiveResolutions();
  const all = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
  const active = all.filter((rec) => !rec.isArchived);

  // Strictly enforce role-based access control and ensure array fields are always defined:
  // Detailed clinical/confidential guidance session notes are ONLY visible to GUIDANCE_ADMIN.
  // OSAS Admin and Student receive sanitized records where confidential notes are masked.
  return active.map((rec) => ({
    ...rec,
    reasons: Array.isArray(rec.reasons) ? rec.reasons : [],
    strategies: Array.isArray(rec.strategies) ? rec.strategies : [],
    ...(role === 'ADMIN' || role === 'STUDENT'
      ? { guidanceConfidentialNotes: undefined, guidanceNotes: undefined }
      : {}),
  }));
}

export function addInterventionRecord(
  data: Omit<InterventionRecord, 'id' | 'createdAt' | 'createdBy' | 'isArchived'>,
  createdBy: string
): InterventionRecord {
  const list = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
  const newRec: InterventionRecord = {
    ...data,
    id: `intv-${Date.now()}`,
    status: data.status || 'REFERRED',
    createdAt: new Date().toISOString(),
    createdBy,
    isArchived: false,
    updatedAt: Date.now(),
  };

  setStoredData(STORAGE_KEYS.INTERVENTIONS, [newRec, ...list], true);

  sendNotification(
    'GUIDANCE_ADMIN',
    `New Student Intervention Referral`,
    `An intervention referral for ${data.studentName} (${data.reasons.join(', ')}) was submitted by OSAS.`,
    'SYSTEM',
    'student_grievances'
  );

  if (data.studentId) {
    sendNotification(
      data.studentId,
      `Guidance Counseling Referral Notice`,
      `An intervention referral has been submitted to the Guidance Office for counseling support regarding ${data.reasons.join(', ')}.`,
      'SYSTEM',
      'intervention'
    );
  }

  triggerSuccessTransaction(
    'Intervention Referral Submitted',
    `Matagumpay na naitala at nai-endorse ang Intervention Referral para kay ${data.studentName} (${data.studentId}) sa Guidance Admin.`
  );

  logActivity(
    'Create Intervention Referral',
    'Intervention',
    createdBy,
    `Created intervention referral for student ${data.studentName} (${data.studentId}) referred by ${data.referredBy}. Status: ${newRec.status}`
  );

  return newRec;
}

export function updateInterventionRecord(
  id: string,
  updates: Partial<InterventionRecord>,
  updatedBy: string
): void {
  const list = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
  const allDisc = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
  let targetName = '';
  let linkedDiscId: string | undefined;

  const updated = list.map((rec) => {
    if (rec.id === id) {
      targetName = rec.studentName;
      linkedDiscId = rec.linkedDisciplinaryId;
      return { ...rec, ...updates, updatedAt: Date.now() };
    }
    return rec;
  });
  setStoredData(STORAGE_KEYS.INTERVENTIONS, updated, true);

  // If linked to a disciplinary record, synchronize high-level status and outcome
  if (linkedDiscId && (updates.status || updates.guidanceOutcomeSummary || updates.guidanceActionTaken)) {
    const updatedDisc = allDisc.map((d) => {
      if (d.id === linkedDiscId || d.linkedInterventionId === id) {
        return {
          ...d,
          guidanceStatus: (updates.status as any) || d.guidanceStatus,
          guidanceOutcomeSummary: updates.guidanceOutcomeSummary || d.guidanceOutcomeSummary,
          guidanceActionTaken: updates.guidanceActionTaken || d.guidanceActionTaken,
          updatedAt: Date.now(),
        };
      }
      return d;
    });
    setStoredData(STORAGE_KEYS.DISCIPLINARY, updatedDisc);
  }

  triggerSuccessTransaction('Intervention Record Updated', `Intervention details for ${targetName || 'student'} updated successfully.`);
  logActivity('Update Intervention Record', 'Intervention', updatedBy, `Updated intervention record ${id} for ${targetName}.`);
}

export function updateGuidanceInterventionStatus(
  id: string,
  data: {
    status: InterventionStatus;
    guidanceCounselorAssigned?: string;
    guidanceSessionCount?: number;
    guidanceLastSessionDate?: string;
    guidanceFollowUpPlan?: string;
    guidanceConfidentialNotes?: string;
    guidanceOutcomeSummary?: string;
    guidanceActionTaken?: string;
    updatedBy: string;
  }
): void {
  const list = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
  const allDisc = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
  let targetName = '';
  let targetStudentId = '';
  let linkedDiscId: string | undefined;

  const updated = list.map((rec) => {
    if (rec.id === id) {
      targetName = rec.studentName;
      targetStudentId = rec.studentId;
      linkedDiscId = rec.linkedDisciplinaryId;
      return {
        ...rec,
        status: data.status,
        guidanceStatus: data.status as any,
        guidanceCounselorAssigned: data.guidanceCounselorAssigned || rec.guidanceCounselorAssigned,
        guidanceSessionCount: data.guidanceSessionCount !== undefined ? data.guidanceSessionCount : rec.guidanceSessionCount,
        guidanceSessionsCount: data.guidanceSessionCount !== undefined ? data.guidanceSessionCount : rec.guidanceSessionsCount,
        guidanceLastSessionDate: data.guidanceLastSessionDate || rec.guidanceLastSessionDate || new Date().toISOString().split('T')[0],
        guidanceFollowUpPlan: data.guidanceFollowUpPlan !== undefined ? data.guidanceFollowUpPlan : rec.guidanceFollowUpPlan,
        guidanceConfidentialNotes: data.guidanceConfidentialNotes !== undefined ? data.guidanceConfidentialNotes : rec.guidanceConfidentialNotes,
        guidanceNotes: data.guidanceConfidentialNotes !== undefined ? data.guidanceConfidentialNotes : rec.guidanceNotes,
        guidanceOutcomeSummary: data.guidanceOutcomeSummary !== undefined ? data.guidanceOutcomeSummary : rec.guidanceOutcomeSummary,
        guidanceActionTaken: data.guidanceActionTaken !== undefined ? data.guidanceActionTaken : rec.guidanceActionTaken,
        guidanceActionTakenRemarks: data.guidanceActionTaken !== undefined ? data.guidanceActionTaken : rec.guidanceActionTakenRemarks,
        receivedActionRemarks: data.guidanceActionTaken !== undefined ? data.guidanceActionTaken : rec.receivedActionRemarks,
        guidanceReceivedDate: rec.guidanceReceivedDate || (data.status !== 'REFERRED' ? new Date().toISOString() : undefined),
        guidanceCompletionDate: data.status === 'COMPLETED' ? new Date().toISOString() : rec.guidanceCompletionDate,
        updatedAt: Date.now(),
      };
    }
    return rec;
  });
  setStoredData(STORAGE_KEYS.INTERVENTIONS, updated);

  // Sync high-level status to linked disciplinary case if applicable
  if (linkedDiscId) {
    const updatedDisc = allDisc.map((d) => {
      if (d.id === linkedDiscId || d.linkedInterventionId === id) {
        return {
          ...d,
          guidanceStatus: data.status as any,
          guidanceOutcomeSummary: data.guidanceOutcomeSummary || d.guidanceOutcomeSummary,
          guidanceActionTaken: data.guidanceActionTaken || d.guidanceActionTaken,
          guidanceCounselorAssigned: data.guidanceCounselorAssigned || d.guidanceCounselorAssigned,
          guidanceSessionCount: data.guidanceSessionCount !== undefined ? data.guidanceSessionCount : d.guidanceSessionCount,
          guidanceFollowUpPlan: data.guidanceFollowUpPlan !== undefined ? data.guidanceFollowUpPlan : d.guidanceFollowUpPlan,
          updatedAt: Date.now(),
        };
      }
      return d;
    });
    setStoredData(STORAGE_KEYS.DISCIPLINARY, updatedDisc);
  }

  triggerSuccessTransaction(
    'Guidance Intervention Updated',
    `Status updated to "${data.status}" para sa intervention case ni ${targetName}.`
  );
  logActivity(
    'Guidance Intervention Status Update',
    'Guidance Office',
    data.updatedBy,
    `Updated intervention status for ${targetName} (Case #${id}) to ${data.status}. Counselor: ${data.guidanceCounselorAssigned || 'Guidance'}`
  );

  // Notify OSAS Admin on all updates
  sendNotification(
    'ADMIN',
    `Intervention Status Update: ${targetName}`,
    `Guidance Counselor (${data.updatedBy}) updated intervention status for ${targetName} to "${data.status}".`,
    'SYSTEM',
    'intervention'
  );

  // Notify Student
  if (targetStudentId) {
    sendNotification(
      targetStudentId,
      `Guidance Intervention Status Update`,
      `Your guidance counseling session status is now "${data.status}". Counselor: ${data.guidanceCounselorAssigned || 'Guidance Counselor'}.`,
      'SYSTEM',
      'intervention'
    );
  }
}

export function addDisciplinaryRecord(
  data: {
    studentId: string;
    studentName: string;
    course?: string;
    yearLevel?: string;
    offenseType: string;
    description: string;
    sanction: string;
    reportedBy?: string;
    actionTaken?: string;
    actionTakenOther?: string;
    startDate?: string;
    completionDate?: string;
    remarks?: string;
    location?: string;
    evidenceFileName?: string;
    evidenceUrl?: string;
    status?: 'SANCTIONED' | 'COMPLETED';
    reportDate?: string;
    reportTime?: string;
    incidentTypes?: string[];
    incidentTypeOther?: string;
    guidanceAssessment?: string;
    caseClassification?: string;
  },
  issuedBy: string
): DisciplinaryRecord {
  const list = getDisciplinaryRecords();
  const hasSanction = Boolean(data.sanction && data.sanction.trim());
  const newRec: DisciplinaryRecord = {
    id: `disc-${Date.now()}`,
    studentId: data.studentId,
    studentName: data.studentName,
    course: data.course || '',
    yearLevel: data.yearLevel || '',
    offenseType: data.offenseType,
    description: data.description,
    sanction: hasSanction ? data.sanction.trim() : '',
    reportedBy: data.reportedBy || 'OSAS Officer',
    actionTaken: data.actionTaken || 'Verbal Warning Issued',
    actionTakenOther: data.actionTakenOther,
    startDate: hasSanction ? data.startDate : undefined,
    completionDate: hasSanction ? data.completionDate : undefined,
    remarks: data.remarks,
    location: data.location,
    evidenceFileName: data.evidenceFileName,
    evidenceUrl: data.evidenceUrl,
    dateLogged: new Date().toISOString().split('T')[0],
    issuedBy,
    status: hasSanction ? (data.status || 'SANCTIONED') : undefined,
    reportDate: data.reportDate,
    reportTime: data.reportTime,
    incidentTypes: data.incidentTypes,
    incidentTypeOther: data.incidentTypeOther,
    guidanceAssessment: data.guidanceAssessment,
    caseClassification: data.caseClassification,
    updatedAt: Date.now(),
  };

  setStoredData(STORAGE_KEYS.DISCIPLINARY, [newRec, ...list], true);

  sendNotification(
    data.studentId,
    `New Disciplinary Record Notice`,
    hasSanction
      ? `Offense logged: ${data.offenseType}. Sanction: ${data.sanction.trim()}`
      : `Offense logged: ${data.offenseType}.`,
    'SYSTEM'
  );

  // Dispatch official notice email to Student
  const studentEmail = getUsers().find((u) => u.studentId === data.studentId || u.id === data.studentId)?.email;
  sendDisciplinaryRecordNoticeEmail(newRec, studentEmail).catch((err) =>
    console.warn('[Disciplinary Record Notice Email] Error:', err)
  );

  logActivity('Log Disciplinary Record', 'Disciplinary Records', issuedBy, `Logged violation against Student ID ${data.studentId}.`);
  return newRec;
}

export function updateDisciplinaryStatus(
  id: string,
  status: 'SANCTIONED' | 'COMPLETED',
  updatedBy: string,
  options?: {
    completionDate?: string;
    startDate?: string;
    sanction?: string;
  }
): void {
  const list = getDisciplinaryRecords();
  let targetRec: DisciplinaryRecord | null = null;
  const updated = list.map((rec) => {
    if (rec.id === id) {
      targetRec = {
        ...rec,
        status,
        ...(options?.completionDate !== undefined ? { completionDate: options.completionDate } : {}),
        ...(options?.startDate !== undefined ? { startDate: options.startDate } : {}),
        ...(options?.sanction !== undefined ? { sanction: options.sanction } : {}),
        updatedAt: Date.now(),
      };
      return targetRec;
    }
    return rec;
  });
  setStoredData(STORAGE_KEYS.DISCIPLINARY, updated, true);

  if (targetRec) {
    const rec = targetRec as DisciplinaryRecord;
    if (rec.studentId) {
      sendNotification(
        rec.studentId,
        'Disciplinary Status Updated',
        `Your disciplinary record regarding "${rec.offenseType}" status has been updated to "${status}".`,
        'SYSTEM',
        'disciplinary'
      );
    }
    if (rec.referredToGuidance) {
      sendNotification(
        'GUIDANCE_ADMIN',
        'Disciplinary Case Status Update',
        `OSAS updated disciplinary status for ${rec.studentName} to "${status}".`,
        'SYSTEM',
        'disciplinary'
      );
    }
  }

  triggerSuccessTransaction('Disciplinary Record Updated', `Status updated to ${status}.`);
  logActivity('Update Disciplinary Status', 'Disciplinary Records', updatedBy, `Updated status of record ${id} to ${status}.`);
}

export const updateDisciplinaryRecordStatus = updateDisciplinaryStatus;

export function deleteDisciplinaryRecord(id: string, deletedBy: string): void {
  const list = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
  const target = list.find((rec) => rec.id === id);
  if (target) {
    archiveItem('DISCIPLINARY', target.id, `Disciplinary Record - ${target.studentName} (${target.offenseType})`, target, deletedBy);
    const updated = list.map((rec) => {
      if (rec.id === id) {
        return { ...rec, isArchivedByAdmin: true };
      }
      return rec;
    });
    setStoredData(STORAGE_KEYS.DISCIPLINARY, updated);
    triggerSuccessTransaction('Disciplinary Record Archived', `Record for ${target.studentName} has been archived in System Settings.`);
    logActivity('Delete Disciplinary Record', 'Disciplinary Records', deletedBy, `Archived record of ${target.studentName}.`);
  }
}

export function archiveInterventionRecord(id: string, archivedBy: string): void {
  const list = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
  const target = list.find((rec) => rec.id === id);
  if (target) {
    const archivedRec: InterventionRecord = { ...target, isArchived: true };
    archiveItem(
      'INTERVENTION',
      target.id,
      `Intervention Record - ${target.studentName} (${target.studentId})`,
      archivedRec,
      archivedBy
    );
    // Mark isArchived: true without deleting the record from Firestore/storage
    const updated = list.map((rec) => (rec.id === id ? archivedRec : rec));
    setStoredData(STORAGE_KEYS.INTERVENTIONS, updated, true);
    triggerSuccessTransaction('Intervention Record Archived', `Ang Intervention Record ni ${target.studentName} ay inilipat na sa System Settings Archive Vault.`);
    logActivity('Archive Intervention Record', 'Intervention', archivedBy, `Archived intervention record for ${target.studentName} (${target.studentId}).`);
  }
}

// --- DORMITORY API ---
export function getDormRooms(): DormRoom[] {
  return getStoredData<DormRoom[]>(STORAGE_KEYS.DORM_ROOMS, []).filter((r) => !r.isArchived);
}

export function addDormRoom(
  data: {
    roomNumber: string;
    floor: string;
    capacity: number;
    gender: 'MALE' | 'FEMALE' | 'COED';
    wingType?: string;
  },
  createdBy: string
): DormRoom {
  const rooms = getDormRooms();
  const selectedWing = data.wingType && data.wingType.trim()
    ? data.wingType.trim()
    : (data.gender === 'MALE' ? 'Male Wing' : data.gender === 'FEMALE' ? 'Female Wing' : 'Co-Ed Wing');

  const newRoom: DormRoom = {
    id: `dorm-${Date.now()}`,
    roomNumber: data.roomNumber,
    floor: data.floor,
    capacity: data.capacity,
    gender: data.gender,
    wingType: selectedWing,
    occupiedCount: 0,
    status: 'AVAILABLE',
    residents: [],
  };

  setStoredData(STORAGE_KEYS.DORM_ROOMS, [...rooms, newRoom]);
  logActivity('Add Dorm Room', 'Dormitory', createdBy, `Added dorm room ${data.roomNumber} (${selectedWing}).`);
  return newRoom;
}

export function updateDormRoom(id: string, updates: Partial<DormRoom>, updatedBy: string): void {
  const rooms = getDormRooms();
  const updated = rooms.map((r) => (r.id === id ? { ...r, ...updates } : r));
  setStoredData(STORAGE_KEYS.DORM_ROOMS, updated);
  logActivity('Update Dorm Room', 'Dormitory', updatedBy, `Updated dorm room ${id}.`);
}

export function addResidentToRoom(
  roomId: string,
  studentId: string,
  studentName: string,
  contactNumber: string,
  addedBy: string
): void {
  const rooms = getDormRooms();
  const allUsers = getUsers();

  // Find linked registered student account if exists
  const studentUser = allUsers.find(
    (u) =>
      (u.studentId && u.studentId.trim().toLowerCase() === studentId.trim().toLowerCase()) ||
      u.id === studentId ||
      (studentName && u.fullName.trim().toLowerCase() === studentName.trim().toLowerCase())
  );

  const resolvedStudentId = studentUser?.studentId || studentId;
  const resolvedStudentName = studentUser?.fullName || studentName;
  const resolvedEmail = studentUser?.email || '';
  const resolvedContact = contactNumber || studentUser?.studentId || 'N/A';

  let assignedRoomNumber = '';
  const updated = rooms.map((room) => {
    if (room.id === roomId) {
      assignedRoomNumber = room.roomNumber;
      const residents = room.residents || [];
      const filtered = residents.filter(
        (r) =>
          r.id !== studentId &&
          r.studentId !== resolvedStudentId &&
          (!r.studentName || r.studentName.toLowerCase() !== resolvedStudentName.toLowerCase())
      );
      const newRes: DormResident = {
        id: `res-${Date.now()}`,
        studentId: resolvedStudentId,
        studentName: resolvedStudentName,
        assignedDate: new Date().toISOString().split('T')[0],
        contactNumber: resolvedContact,
        email: resolvedEmail,
      };
      const newCount = filtered.length + 1;
      return {
        ...room,
        residents: [...filtered, newRes],
        occupiedCount: newCount,
        status: (newCount >= room.capacity ? 'FULL' : 'AVAILABLE') as 'FULL' | 'AVAILABLE',
        updatedAt: Date.now(),
      };
    }
    return room;
  });

  setStoredData(STORAGE_KEYS.DORM_ROOMS, updated);

  // Link or create DormApplicant record so student portal immediately displays dorm info
  const apps = getDormApplicants();
  let found = false;
  const updatedApps = apps.map((a) => {
    const isMatch =
      a.studentId === resolvedStudentId ||
      (resolvedEmail && a.studentEmail === resolvedEmail) ||
      (resolvedStudentName && a.studentName.toLowerCase() === resolvedStudentName.toLowerCase());
    if (isMatch) {
      found = true;
      return {
        ...a,
        studentId: resolvedStudentId,
        studentName: resolvedStudentName,
        studentEmail: resolvedEmail || a.studentEmail,
        status: 'ACCEPTED' as ApplicationStatus,
        assignedRoomNumber,
      };
    }
    return a;
  });

  if (!found) {
    const newApp: DormApplicant = {
      id: `dapp-${Date.now()}`,
      studentId: resolvedStudentId,
      studentName: resolvedStudentName,
      studentEmail: resolvedEmail,
      address: 'On-Campus Student Dormitory',
      reason: 'Assigned as official dormitory resident by OSAS Administration.',
      appliedAt: new Date().toISOString(),
      status: 'ACCEPTED',
      assignedRoomNumber,
    };
    updatedApps.unshift(newApp);
  }
  setStoredData(STORAGE_KEYS.DORM_APPLICANTS, updatedApps);

  if (resolvedStudentId) {
    sendNotification(
      resolvedStudentId,
      'Dormitory Room Assignment',
      `You have been assigned to ${assignedRoomNumber || 'a dormitory room'} by OSAS Administration.`,
      'DORM'
    );
  }

  logActivity('Add Dorm Resident', 'Dormitory', addedBy, `Assigned ${resolvedStudentName} (${resolvedStudentId}) to ${assignedRoomNumber || 'room'}.`);
  triggerSuccessTransaction('Dorm Resident Added', `Matagumpay na nai-assign si ${resolvedStudentName} sa ${assignedRoomNumber || 'room'}.`);
}

export function removeResidentFromRoom(roomId: string, residentId: string, removedBy: string): void {
  const rooms = getDormRooms();
  let targetRes: any = null;
  let targetRoomNumber = '';

  const updated = rooms.map((room) => {
    if (room.id === roomId) {
      targetRoomNumber = room.roomNumber;
      targetRes = (room.residents || []).find(
        (r) =>
          r.id === residentId ||
          r.studentId === residentId ||
          (r.studentName && r.studentName.toLowerCase() === residentId.toLowerCase())
      );
      const residents = (room.residents || []).filter(
        (r) =>
          r.id !== residentId &&
          r.studentId !== residentId &&
          (!r.studentName || r.studentName.toLowerCase() !== residentId.toLowerCase())
      );
      return {
        ...room,
        residents,
        occupiedCount: residents.length,
        status: (residents.length >= room.capacity ? 'FULL' : 'AVAILABLE') as 'FULL' | 'AVAILABLE',
        updatedAt: Date.now(),
      };
    }
    return room;
  });

  if (targetRes) {
    archiveItem(
      'DORM_RESIDENT',
      targetRes.id || targetRes.studentId,
      `${targetRes.studentName} (${targetRes.studentId})`,
      { ...targetRes, roomId, roomNumber: targetRoomNumber },
      removedBy
    );

    const targetStudentId = targetRes.studentId || residentId;
    const allUsers = getUsers();
    const studentUser = allUsers.find(
      (u) =>
        u.studentId === targetStudentId ||
        u.id === targetStudentId ||
        (targetRes.studentName && u.fullName.trim().toLowerCase() === targetRes.studentName.trim().toLowerCase())
    );
    const targetEmail = targetRes.email || studentUser?.email || '';
    const targetName = (targetRes.studentName || studentUser?.fullName || '').trim().toLowerCase();

    // 1. Clean up & archive DormApplicant records for this student so dorm info completely clears
    const apps = getDormApplicants();
    const appsToArchive: DormApplicant[] = [];
    const remainingApps = apps.filter((a) => {
      const matches =
        a.studentId === targetStudentId ||
        (targetEmail && a.studentEmail === targetEmail) ||
        (targetName && a.studentName.trim().toLowerCase() === targetName);
      if (matches) {
        appsToArchive.push(a);
        return false;
      }
      return true;
    });

    appsToArchive.forEach((app) => {
      archiveItem('DORM_APPLICANT', app.id, `Application of ${app.studentName} (${app.studentId})`, app, removedBy);
    });
    setStoredData(STORAGE_KEYS.DORM_APPLICANTS, remainingApps);

    // 2. Clean up & archive DormReports filed by this student
    const reports = getDormReports();
    const reportsToArchive: DormReport[] = [];
    const remainingReports = reports.filter((r) => {
      const matches =
        r.studentId === targetStudentId ||
        (targetName && r.studentName.trim().toLowerCase() === targetName);
      if (matches) {
        reportsToArchive.push(r);
        return false;
      }
      return true;
    });

    reportsToArchive.forEach((rep) => {
      archiveItem('DORM_REPORT', rep.id, `Dorm Report: ${rep.roomNumber} - ${rep.issueType}`, rep, removedBy);
    });
    setStoredData(STORAGE_KEYS.DORM_REPORTS, remainingReports);

    // 3. Notify student that their resident status and dorm info have been removed
    if (targetStudentId) {
      sendNotification(
        targetStudentId,
        'Dormitory Resident Status Removed',
        `You have been removed as a resident from ${targetRoomNumber || 'your dormitory room'}. Your dorm records have been cleared.`,
        'DORM'
      );
    }
  }

  setStoredData(STORAGE_KEYS.DORM_ROOMS, updated);
  triggerSuccessTransaction('Dorm Resident Removed', `Naitanggal ang resident at na-clear ang dorm records sa student account.`);
  logActivity('Remove Dorm Resident', 'Dormitory', removedBy, `Removed resident ${residentId} from room.`);
}

export function deleteDormRoom(roomId: string, deletedBy: string): void {
  const rooms = getDormRooms();
  const target = rooms.find((r) => r.id === roomId);
  if (target) {
    archiveItem('DORM_ROOM', target.id, target.roomNumber, target, deletedBy);

    // Archive linked announcements for this room
    const announcements = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
    const linkedAncs = announcements.filter((a) => a.dormRoomId === roomId);
    linkedAncs.forEach((anc) => {
      archiveItem('ANNOUNCEMENT', anc.id, anc.title, anc, deletedBy);
    });
    const remainingAncs = announcements.filter((a) => a.dormRoomId !== roomId);
    setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, remainingAncs);

    // Notify all residents in this deleted room & clear reports & applicant status
    if (target.residents && target.residents.length > 0) {
      target.residents.forEach((res) => {
        if (res.studentId) {
          sendNotification(
            res.studentId,
            'Dorm Room Deleted',
            `The dormitory room (${target.roomNumber}) you resided in has been deleted by OSAS Administration.`,
            'DORM'
          );
        }
      });

      const resStudentIds = new Set(target.residents.map((r) => r.studentId));
      const apps = getDormApplicants();
      const updatedApps = apps.map((a) => {
        if (resStudentIds.has(a.studentId)) {
          return { ...a, status: 'REJECTED' as const, assignedRoomNumber: undefined };
        }
        return a;
      });
      setStoredData(STORAGE_KEYS.DORM_APPLICANTS, updatedApps);

      const reports = getDormReports();
      const updatedReports = reports.filter((r) => !resStudentIds.has(r.studentId) && r.roomNumber !== target.roomNumber);
      setStoredData(STORAGE_KEYS.DORM_REPORTS, updatedReports);
    }

    const updated = rooms.filter((r) => r.id !== roomId);
    setStoredData(STORAGE_KEYS.DORM_ROOMS, updated);
    triggerSuccessTransaction('Dorm Room Archived', `Nailipat sa System Archive Vault ang kwartong ${target.roomNumber}.`);
    logActivity('Delete Dorm Room', 'Dormitory', deletedBy, `Deleted dorm room "${target.roomNumber}".`);
  }
}

export function announceDormAvailability(roomId: string, adminName: string): void {
  const rooms = getDormRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  const title = `Dorm Slot Open: ${room.roomNumber}`;
  const content = `A slot is available in ${room.roomNumber} (${room.floor}, ${room.gender} Wing). Available capacity: ${room.capacity - room.occupiedCount} slots remaining. Submit your application now via your student portal!`;

  addAnnouncement(
    {
      title,
      content,
      category: 'DORMITORY',
      expirationDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      dormRoomId: room.id,
    },
    adminName
  );

  logActivity('Announce Dorm Slot', 'Dormitory', adminName, `Broadcasted dorm availability announcement for ${room.roomNumber}.`);
}

export function getDormApplicants(): DormApplicant[] {
  const list = getStoredData<DormApplicant[]>(STORAGE_KEYS.DORM_APPLICANTS, []);
  const purged = getPurgedIds();
  const archive = getArchiveItems();
  const archivedAppIds = new Set(
    archive
      .filter((a) => a.type === 'DORM_APPLICANT' || (a.type as string) === 'REJECTED_DORM_APPLICANT')
      .flatMap((a) => [a.originalId, a.data?.id].filter(Boolean) as string[])
  );
  return list.filter((a) => !purged.has(a.id) && !archivedAppIds.has(a.id));
}

export function applyDorm(
  student: User,
  address: string,
  reason: string,
  attachmentName?: string,
  attachmentUrl?: string
): DormApplicant {
  const apps = getDormApplicants();
  const newApp: DormApplicant = {
    id: `dapp-${Date.now()}`,
    studentId: student.studentId || student.id,
    studentName: student.fullName,
    studentEmail: student.email,
    address,
    reason,
    attachmentName: attachmentName || 'Dorm_Application_Form.pdf',
    attachmentUrl,
    appliedAt: new Date().toISOString(),
    status: 'PENDING',
    updatedAt: Date.now(),
  };

  setStoredData(STORAGE_KEYS.DORM_APPLICANTS, [newApp, ...apps], true);
  try {
    setDoc(doc(db, 'dorm_applicants', newApp.id), cleanForFirestore(newApp), { merge: true }).catch(() => {});
  } catch (_) {}

  sendNotification('ADMIN', `New Dormitory Application`, `${student.fullName} submitted a dormitory residence application.`, 'DORM');

  // Dispatch email notification to Admin & confirmation to Student
  sendDormApplicationAlertEmail(newApp).catch((err) =>
    console.warn('[Dorm Application Email] Error:', err)
  );

  logActivity('Dorm Application', 'Dormitory', student.fullName, `Submitted dormitory application.`);
  return newApp;
}

export function acceptDormApplicantAndAssignRoom(applicantId: string, targetRoomId: string, adminName: string): void {
  const apps = getDormApplicants();
  const rooms = getDormRooms();
  const targetRoom = rooms.find((r) => r.id === targetRoomId);

  if (!targetRoom) return;

  let applicantName = '';
  let studentId = '';
  let updatedAppObj: DormApplicant | null = null;

  const updatedApps = apps.map((a) => {
    if (a.id === applicantId) {
      applicantName = a.studentName;
      studentId = a.studentId;
      updatedAppObj = {
        ...a,
        status: 'ACCEPTED' as ApplicationStatus,
        assignedRoomNumber: targetRoom.roomNumber,
        updatedAt: Date.now(),
      };
      return updatedAppObj;
    }
    return a;
  });

  setStoredData(STORAGE_KEYS.DORM_APPLICANTS, updatedApps, true);
  if (updatedAppObj) {
    try {
      setDoc(doc(db, 'dorm_applicants', applicantId), cleanForFirestore(updatedAppObj), { merge: true }).catch(() => {});
    } catch (_) {}
  }

  // Add resident to target room
  addResidentToRoom(targetRoomId, studentId, applicantName, 'N/A', adminName);

  sendNotification(
    studentId,
    `Dormitory Application Approved!`,
    `Congratulations! Your dorm application was accepted and assigned to ${targetRoom.roomNumber}.`,
    'DORM'
  );

  if (updatedAppObj) {
    sendDormApplicationStatusEmail(updatedAppObj, 'ACCEPTED', targetRoom.roomNumber).catch((err) =>
      console.warn('[Dorm Application Approved Email] Error:', err)
    );
  }

  logActivity('Accept Dorm Applicant', 'Dormitory', adminName, `Accepted ${applicantName} into ${targetRoom.roomNumber}.`);
}

export function rejectDormApplicant(applicantId: string, adminName: string): void {
  const apps = getDormApplicants();
  let studentId = '';
  let updatedAppObj: DormApplicant | null = null;

  const updatedApps = apps.map((a) => {
    if (a.id === applicantId) {
      studentId = a.studentId;
      updatedAppObj = { ...a, status: 'REJECTED' as ApplicationStatus, updatedAt: Date.now() };
      return updatedAppObj;
    }
    return a;
  });

  setStoredData(STORAGE_KEYS.DORM_APPLICANTS, updatedApps, true);
  if (updatedAppObj) {
    try {
      setDoc(doc(db, 'dorm_applicants', applicantId), cleanForFirestore(updatedAppObj), { merge: true }).catch(() => {});
    } catch (_) {}
  }

  sendNotification(studentId, `Dormitory Application Status`, `Regrettably, your dormitory application was not approved at this time.`, 'DORM');

  if (updatedAppObj) {
    sendDormApplicationStatusEmail(updatedAppObj, 'REJECTED').catch((err) =>
      console.warn('[Dorm Application Rejected Email] Error:', err)
    );
  }

  logActivity('Reject Dorm Applicant', 'Dormitory', adminName, `Rejected dorm applicant ID ${applicantId}.`);
}

export function reApproveDormApplicant(applicantId: string, adminName: string): void {
  const apps = getStoredData<DormApplicant[]>(STORAGE_KEYS.DORM_APPLICANTS, []);
  let updatedAppObj: DormApplicant | null = null;
  const updated = apps.map((a) => {
    if (a.id === applicantId) {
      updatedAppObj = { ...a, status: 'PENDING' as ApplicationStatus, updatedAt: Date.now() };
      return updatedAppObj;
    }
    return a;
  });
  setStoredData(STORAGE_KEYS.DORM_APPLICANTS, updated, true);
  if (updatedAppObj) {
    try {
      setDoc(doc(db, 'dorm_applicants', applicantId), cleanForFirestore(updatedAppObj), { merge: true }).catch(() => {});
    } catch (_) {}
  }
  triggerSuccessTransaction('Applicant Status Updated', 'Ibinalik sa Pending status ang dormitory residency application.');
  logActivity('Re-approve Dorm Applicant', 'Dormitory', adminName, `Re-approved dorm applicant ${applicantId} back to pending.`);
}

// --- STUDENT FEEDBACK API ---
export function getStudentFeedbacks(): StudentFeedback[] {
  autoArchiveExpiredRatingsAndEvaluations();
  return getStoredData<StudentFeedback[]>(STORAGE_KEYS.FEEDBACKS, []);
}

export const getFeedbacks = getStudentFeedbacks;

export function canStudentSubmitFeedback(studentId: string): { allowed: boolean; nextAllowedDate?: string } {
  const feedbacks = getStudentFeedbacks();
  const studentFeedbacks = feedbacks.filter((f) => f.studentId === studentId);
  if (studentFeedbacks.length === 0) return { allowed: true };

  // Sort latest
  studentFeedbacks.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const latest = studentFeedbacks[0];
  const lastTime = new Date(latest.submittedAt).getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (now - lastTime < oneWeekMs) {
    const nextAllowed = new Date(lastTime + oneWeekMs).toLocaleDateString();
    return { allowed: false, nextAllowedDate: nextAllowed };
  }

  return { allowed: true };
}

export function submitStudentFeedback(student: User, title: string, content: string): { success: boolean; message: string } {
  const check = canStudentSubmitFeedback(student.studentId || student.id);
  if (!check.allowed) {
    return {
      success: false,
      message: `You have already submitted feedback this week. You can submit another feedback on or after ${check.nextAllowedDate}.`,
    };
  }

  const list = getStudentFeedbacks();
  const newFb: StudentFeedback = {
    id: `fb-${Date.now()}`,
    studentId: student.studentId || student.id,
    studentName: student.fullName,
    title,
    content,
    submittedAt: new Date().toISOString(),
  };

  setStoredData(STORAGE_KEYS.FEEDBACKS, [newFb, ...list], true);
  try {
    setDoc(doc(db, 'feedbacks', newFb.id), cleanForFirestore(newFb), { merge: true }).catch(() => {});
  } catch (_) {}

  sendNotification('ADMIN', `New Student Feedback Received`, `${student.fullName}: "${title}"`, 'SYSTEM', 'student_feedbacks');

  // Dispatch real-time email notification to OSAS Admin
  sendStudentFeedbackAlertEmail({
    studentName: student.fullName,
    studentId: student.studentId || student.id,
    studentEmail: student.email,
    title,
    content,
  }).catch((err) => console.warn('[Email] Student feedback notification warning:', err));

  logActivity('Submit Feedback', 'Student Feedback', student.fullName, `Submitted feedback: "${title}".`);
  return { success: true, message: 'Thank you! Your feedback has been sent to the OSAS Admin.' };
}

export function submitFeedback(student: User, title: string, content: string): { success: boolean; error?: string } {
  const res = submitStudentFeedback(student, title, content);
  return { success: res.success, error: res.message };
}

// --- ARCHIVE API ---
export function getArchiveItems(): ArchiveItem[] {
  checkAndAutoArchiveResolutions();
  const rawList = getStoredData<ArchiveItem[]>(STORAGE_KEYS.ARCHIVE, []);
  const purgedIds = getPurgedIds();
  const restoredIds = getRestoredIds();
  const seenOrigKeys = new Set<string>();
  const deduped: ArchiveItem[] = [];

  for (const item of rawList) {
    if (!item || !item.id) continue;
    const itemId = String(item.id);
    const origId = item.originalId ? String(item.originalId) : '';
    const dataId = item.data?.id ? String(item.data.id) : '';

    if (
      purgedIds.has(itemId) ||
      (origId && purgedIds.has(origId)) ||
      (dataId && purgedIds.has(dataId)) ||
      restoredIds.has(itemId) ||
      (origId && restoredIds.has(origId)) ||
      (dataId && restoredIds.has(dataId))
    ) {
      continue;
    }

    const origKey = origId ? `${item.type}-${origId}` : itemId;
    if (seenOrigKeys.has(origKey)) {
      continue;
    }
    seenOrigKeys.add(origKey);

    if (
      (item.type === 'APPOINTMENT' || item.type === 'EXPIRED_APPOINTMENT') &&
      !item.data?.archiveReason
    ) {
      const storedApps = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
      const matchedApp = storedApps.find(
        (a) => a.id === origId || a.id === dataId
      );
      if (matchedApp?.archiveReason) {
        deduped.push({
          ...item,
          data: {
            ...item.data,
            archiveReason: matchedApp.archiveReason,
          },
        });
        continue;
      }
    }

    deduped.push(item);
  }

  return deduped;
}

export function archiveItemsBatch(newEntries: Array<{
  type: ArchiveItem['type'];
  originalId: string;
  title: string;
  data: any;
  archivedBy: string;
}>): void {
  if (!newEntries || newEntries.length === 0) return;
  const items = getArchiveItems();
  const existingSet = new Set(items.map((i) => `${i.type}-${i.originalId}`));
  const toAdd: ArchiveItem[] = [];
  const restored = getRestoredIds();
  let restoredChanged = false;

  for (const entry of newEntries) {
    const key = `${entry.type}-${entry.originalId}`;
    if (!existingSet.has(key)) {
      existingSet.add(key);
      toAdd.push({
        id: `arch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        originalId: entry.originalId,
        type: entry.type,
        title: entry.title,
        deletedAt: new Date().toISOString(),
        data: entry.data,
      });

      // Clear from restoredIds if it is re-archived
      [entry.originalId, entry.data?.id, entry.data?.studentId].filter(Boolean).forEach((val) => {
        const s = String(val);
        if (restored.has(s)) {
          restored.delete(s);
          restoredChanged = true;
        }
      });
    }
  }

  if (restoredChanged) {
    saveRestoredIds(restored);
  }

  if (toAdd.length > 0) {
    const updated = [...toAdd, ...items];
    setStoredData(STORAGE_KEYS.ARCHIVE, updated);
  }
}

export function archiveItem(
  type: ArchiveItem['type'],
  originalId: string,
  title: string,
  data: any,
  archivedBy: string
): void {
  const items = getArchiveItems();
  // Filter out any existing archive entry for the same originalId and type to prevent duplicates
  const filtered = items.filter((i) => !(i.originalId === originalId && i.type === type));
  const newItem: ArchiveItem = {
    id: `arch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    originalId,
    type,
    title,
    deletedAt: new Date().toISOString(),
    data,
  };

  // Clear from restoredIds if it is re-archived
  const restored = getRestoredIds();
  let restoredChanged = false;
  [originalId, data?.id, data?.studentId, data?.email].filter(Boolean).forEach((val) => {
    const s = String(val);
    if (restored.has(s)) {
      restored.delete(s);
      restoredChanged = true;
    }
  });
  if (restoredChanged) {
    saveRestoredIds(restored);
  }

  setStoredData(STORAGE_KEYS.ARCHIVE, [newItem, ...filtered]);
  logActivity('Archive Item', 'System Archive', archivedBy, `Archived ${type} item: "${title}".`);
}

export function restoreArchiveItem(archiveId: string, restoredBy: string): void {
  const rawArchiveList = getStoredData<ArchiveItem[]>(STORAGE_KEYS.ARCHIVE, []);
  const target = rawArchiveList.find(
    (i) => i.id === archiveId || i.originalId === archiveId || (i.data && i.data.id === archiveId)
  );
  if (!target) return;

  const data = target.data || {};
  const origId = target.originalId || data.id || archiveId;

  // Un-blacklist from purgedIds
  const purgedIds = getPurgedIds();
  let purgedChanged = false;
  [archiveId, target.id, target.originalId, origId, data?.id, data?.studentId, data?.email].filter(Boolean).forEach((val) => {
    const s = String(val);
    if (purgedIds.has(s)) {
      purgedIds.delete(s);
      purgedChanged = true;
    }
  });
  if (purgedChanged) {
    savePurgedIds(purgedIds);
  }

  // Register in restoredIds so server polling / Firestore sync never puts this item back into Archive
  const restoredIds = getRestoredIds();
  [archiveId, target.id, target.originalId, origId, data?.id, data?.studentId].filter(Boolean).forEach((val) => {
    restoredIds.add(String(val));
  });
  saveRestoredIds(restoredIds);

  if (target.type === 'STUDENT_RECORD' || (target.type as string) === 'USER') {
    const list = getStoredData<User[]>(STORAGE_KEYS.USERS, initialUsers);
    const cleanUser: User = { ...data, id: origId, isArchived: false, updatedAt: Date.now() };
    const filtered = list.filter((u) => u.id !== cleanUser.id && (!cleanUser.studentId || u.studentId !== cleanUser.studentId));
    setStoredData(STORAGE_KEYS.USERS, [cleanUser, ...filtered], true);
    try {
      if (cleanUser.id) setDoc(doc(db, 'users', cleanUser.id), { ...cleanUser, updatedAt: Date.now() }, { merge: true }).catch(() => {});
      if (cleanUser.studentId) setDoc(doc(db, 'users', cleanUser.studentId.trim().toLowerCase()), { ...cleanUser, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    } catch (_) {}
    triggerSuccessTransaction('Restored!', `Nai-restore ang student record ni "${target.title}" pabalik sa Student Records Module.`);
  } else if (target.type === 'DISCIPLINARY_REPORT') {
    const list = getStoredData<DisciplinaryReport[]>(STORAGE_KEYS.DISCIPLINARY_REPORTS, []);
    const cleanReport: DisciplinaryReport = { ...data, id: origId, isArchived: false };
    const filtered = list.filter((r) => r.id !== cleanReport.id);
    setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, [cleanReport, ...filtered], true);
    triggerSuccessTransaction(
      'Restored!',
      `Nai-restore ang student incident report para kay "${data.reportedStudentName || target.title}" pabalik sa Disciplinary Module (Student Incident Reports tab).`
    );
  } else if (target.type === 'RESOLUTION') {
    const list = getStoredData<DisciplinaryReport[]>(STORAGE_KEYS.DISCIPLINARY_REPORTS, []);
    const restoredIso = new Date().toISOString();
    const cleanReport: DisciplinaryReport = {
      ...data,
      id: origId,
      isResolutionArchived: false,
      isArchived: false,
      resolvedAt: restoredIso,
      ...(data.osasRemarksSavedAt ? { osasRemarksSavedAt: restoredIso } : {}),
      updatedAt: Date.now(),
    };
    const filtered = list.filter((r) => r.id !== cleanReport.id);
    setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, [cleanReport, ...filtered], true);
    try {
      setDoc(doc(db, 'disciplinary_reports', cleanReport.id), { ...cleanReport, isResolutionArchived: false, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    } catch (_) {}
    triggerSuccessTransaction(
      'Restored!',
      `Restored resolution for "${data.reportedStudentName || target.title}" back to Resolutions.`
    );
  } else if (target.type === 'DISCIPLINARY') {
    const list = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
    const cleanRecord: DisciplinaryRecord = { ...data, id: origId, isArchivedByAdmin: false, isArchived: false };
    const filtered = list.filter((d) => d.id !== cleanRecord.id);
    setStoredData(STORAGE_KEYS.DISCIPLINARY, [cleanRecord, ...filtered], true);
    triggerSuccessTransaction(
      'Restored!',
      `Nai-restore ang opisyal na disciplinary record para kay "${data.studentName || target.title}" pabalik sa Disciplinary Module (Official Records tab).`
    );
  } else if (target.type === 'INTERVENTION') {
    const list = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
    const restoredIso = new Date().toISOString();
    const cleanRecord: InterventionRecord = {
      ...data,
      id: origId,
      isArchived: false,
      resolvedAt: restoredIso,
      updatedAt: Date.now(),
    };
    const filtered = list.filter((d) => d.id !== cleanRecord.id);
    setStoredData(STORAGE_KEYS.INTERVENTIONS, [cleanRecord, ...filtered], true);
    triggerSuccessTransaction(
      'Restored!',
      `Nai-restore ang intervention record para kay "${data.studentName || target.title}" pabalik sa Intervention Module.`
    );
  } else if (target.type === 'ANNOUNCEMENT') {
    const list = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, initialAnnouncements);
    const cleanAnc: Announcement = {
      ...data,
      id: origId,
      isArchived: false,
      expirationDate:
        data?.expirationDate && !isAnnouncementExpired(data.expirationDate)
          ? data.expirationDate
          : new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
      updatedAt: Date.now(),
    };
    const filtered = list.filter((a) => a.id !== cleanAnc.id);
    setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, [cleanAnc, ...filtered], true);
    triggerSuccessTransaction('Restored!', `Nai-restore ang announcement "${target.title}" pabalik sa Announcements Module.`);
  } else if (target.type === 'SCHOLARSHIP') {
    const list = getStoredData<Scholarship[]>(STORAGE_KEYS.SCHOLARSHIPS, initialScholarships);
    const cleanSch: Scholarship = { ...data, id: origId, isArchived: false, updatedAt: Date.now() };
    const filtered = list.filter((s) => s.id !== cleanSch.id);
    setStoredData(STORAGE_KEYS.SCHOLARSHIPS, [cleanSch, ...filtered], true);

    // Also restore any linked announcements
    const linkedArchivedAncs = rawArchiveList.filter(
      (a) => a.type === 'ANNOUNCEMENT' && (a.data?.scholarshipId === origId || a.data?.scholarshipId === data.id)
    );
    if (linkedArchivedAncs.length > 0) {
      const ancs = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, initialAnnouncements);
      const restoredAncs: Announcement[] = linkedArchivedAncs.map((item) => ({
        ...item.data,
        id: item.originalId || item.data?.id || item.id,
        isArchived: false,
        expirationDate: cleanSch.deadline || new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
        updatedAt: Date.now(),
      }));
      const existingAncIds = new Set(restoredAncs.map((a) => a.id));
      const remainingAncs = ancs.filter((a) => !existingAncIds.has(a.id));
      setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, [...restoredAncs, ...remainingAncs], true);
    }

    triggerSuccessTransaction('Restored!', `Nai-restore ang scholarship "${target.title}" pabalik sa Scholarship Module.`);
  } else if ((target.type as string) === 'DORM_APPLICANT') {
    const list = getStoredData<DormApplicant[]>(STORAGE_KEYS.DORM_APPLICANTS, []);
    const cleanApp: DormApplicant = { ...data, id: origId, status: data.status === 'REJECTED' ? 'PENDING' : (data.status || 'PENDING') };
    const filtered = list.filter((a) => a.id !== cleanApp.id);
    setStoredData(STORAGE_KEYS.DORM_APPLICANTS, [cleanApp, ...filtered], true);
    triggerSuccessTransaction('Restored!', `Nai-restore ang dormitory applicant record pabalik sa Dormitory Module (Applications tab).`);
  } else if (target.type === 'DORM_ROOM') {
    const list = getStoredData<DormRoom[]>(STORAGE_KEYS.DORM_ROOMS, initialDormRooms);
    const cleanRoom: DormRoom = { ...data, id: origId, isArchived: false, updatedAt: Date.now() };
    const filtered = list.filter((r) => r.id !== cleanRoom.id);
    setStoredData(STORAGE_KEYS.DORM_ROOMS, [cleanRoom, ...filtered], true);
    triggerSuccessTransaction('Restored!', `Nai-restore ang kwartong ${target.title} pabalik sa Dormitory Module.`);
  } else if (target.type === 'DORM_RESIDENT') {
    const rooms = getStoredData<DormRoom[]>(STORAGE_KEYS.DORM_ROOMS, initialDormRooms);
    let matchedRoom = rooms.find((r) => r.id === data.roomId || r.roomNumber === data.roomNumber);
    if (!matchedRoom && rooms.length > 0) {
      matchedRoom = rooms[0];
    }
    if (matchedRoom) {
      const targetRoomId = matchedRoom.id;
      const updatedRooms = rooms.map((r) => {
        if (r.id === targetRoomId) {
          const res = r.residents || [];
          if (!res.some((resident) => resident.id === data.id || resident.studentId === data.studentId)) {
            const cleanedRes = {
              id: data.id || `res-${Date.now()}`,
              studentId: data.studentId,
              studentName: data.studentName,
              assignedDate: data.assignedDate || new Date().toISOString().split('T')[0],
              contactNumber: data.contactNumber || 'N/A',
            };
            const newRes = [...res, cleanedRes];
            return {
              ...r,
              residents: newRes,
              occupiedCount: newRes.length,
              status: (newRes.length >= r.capacity ? 'FULL' : 'AVAILABLE') as 'FULL' | 'AVAILABLE',
            };
          }
        }
        return r;
      });
      setStoredData(STORAGE_KEYS.DORM_ROOMS, updatedRooms, true);

      // Restore applicant status if applicable
      if (data.studentId) {
        const apps = getStoredData<DormApplicant[]>(STORAGE_KEYS.DORM_APPLICANTS, []);
        const updatedApps = apps.map((a) => {
          if (a.studentId === data.studentId) {
            return { ...a, status: 'ACCEPTED' as const, assignedRoomNumber: matchedRoom?.roomNumber };
          }
          return a;
        });
        setStoredData(STORAGE_KEYS.DORM_APPLICANTS, updatedApps, true);
      }
    }
    triggerSuccessTransaction('Restored!', `Nai-restore ang resident pabalik sa Dormitory Room.`);
  } else if (target.type === 'SAFETY_REPORT') {
    const list = getStoredData<SafetyReport[]>(STORAGE_KEYS.SAFETY_REPORTS, initialSafetyReports);
    const cleanRep: SafetyReport = { ...data, id: origId, isArchived: false };
    const filtered = list.filter((r) => r.id !== cleanRep.id);
    setStoredData(STORAGE_KEYS.SAFETY_REPORTS, [cleanRep, ...filtered], true);
    triggerSuccessTransaction('Restored!', `Nai-restore ang safety report pabalik sa Reports/Concerns Module.`);
  } else if (target.type === 'REJECTED_SCHOLARSHIP_APPLICATION') {
    const list = getStoredData<ScholarshipApplication[]>(STORAGE_KEYS.SCHOLARSHIP_APPS, []);
    const cleanApp: ScholarshipApplication = { ...data, id: origId, status: data.status === 'REJECTED' ? 'PENDING' : (data.status || 'PENDING') };
    const filtered = list.filter((a) => a.id !== cleanApp.id);
    setStoredData(STORAGE_KEYS.SCHOLARSHIP_APPS, [cleanApp, ...filtered], true);
    triggerSuccessTransaction('Restored!', `Nai-restore ang scholarship application record pabalik sa Scholarship Module (Applications tab).`);
  } else if (target.type === 'APPOINTMENT' || target.type === 'EXPIRED_APPOINTMENT') {
    const list = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
    const cleanAppointment: Appointment = {
      ...data,
      id: origId,
      isArchived: false,
      completedAt: data.status === 'COMPLETED' ? new Date().toISOString() : data.completedAt,
      updatedAt: Date.now(),
    };
    const filtered = list.filter((a) => a.id !== cleanAppointment.id);
    setStoredData(STORAGE_KEYS.APPOINTMENTS, [cleanAppointment, ...filtered], true);
    triggerSuccessTransaction('Restored!', `Nai-restore ang appointment "${target.title}" pabalik sa Appointments Module.`);
  } else if (target.type === 'DORM_REPORT') {
    const list = getStoredData<DormReport[]>(STORAGE_KEYS.DORM_REPORTS, []);
    const cleanRep: DormReport = { ...data, id: origId, isArchived: false, completedAt: data.status === 'COMPLETED' ? new Date().toISOString() : data.completedAt };
    const filtered = list.filter((r) => r.id !== cleanRep.id);
    setStoredData(STORAGE_KEYS.DORM_REPORTS, [cleanRep, ...filtered], true);
    triggerSuccessTransaction('Restored!', `Nai-restore ang dorm maintenance report "${target.title}" pabalik sa Dormitory Module.`);
  } else if (target.type === 'TRANSACTION_RATING') {
    const list = getStoredData<TransactionRating[]>(STORAGE_KEYS.TRANSACTION_RATINGS, []);
    const cleanRating: TransactionRating = {
      ...data,
      id: origId,
      createdAt: new Date().toISOString(),
    };
    const filtered = list.filter((r) => r.id !== cleanRating.id);
    setStoredData(STORAGE_KEYS.TRANSACTION_RATINGS, [cleanRating, ...filtered], true);
    triggerSuccessTransaction('Restored!', `Nai-restore ang transaction rating para kay "${data.studentName || target.title}" pabalik sa Ratings Module.`);
  } else if (target.type === 'EVALUATION_FEEDBACK') {
    if (data.answers || data.overallAverage !== undefined) {
      const list = getStoredData<OsasServiceEvaluation[]>(STORAGE_KEYS.OSAS_EVALUATIONS, []);
      const cleanEval: OsasServiceEvaluation = {
        ...data,
        id: origId,
        submittedAt: new Date().toISOString(),
      };
      const filtered = list.filter((e) => e.id !== cleanEval.id);
      setStoredData(STORAGE_KEYS.OSAS_EVALUATIONS, [cleanEval, ...filtered], true);
      triggerSuccessTransaction('Restored!', `Nai-restore ang evaluation para kay "${data.studentName || target.title}" pabalik sa Ratings Module.`);
    } else {
      const list = getStoredData<StudentFeedback[]>(STORAGE_KEYS.FEEDBACKS, []);
      const cleanFb: StudentFeedback = {
        ...data,
        id: origId,
        submittedAt: new Date().toISOString(),
      };
      const filtered = list.filter((f) => f.id !== cleanFb.id);
      setStoredData(STORAGE_KEYS.FEEDBACKS, [cleanFb, ...filtered], true);
      triggerSuccessTransaction('Restored!', `Nai-restore ang feedback para kay "${data.studentName || target.title}" pabalik sa Feedback List.`);
    }
  } else {
    triggerSuccessTransaction('Restored!', `Nai-restore ang item "${target.title}" pabalik sa system module.`);
  }

  // Remove completely from archive
  const isMatch = (item: ArchiveItem) => {
    if (!item) return false;
    if (item.id === target.id || item.id === archiveId) return true;
    if (origId && (item.originalId === origId || (item.data && item.data.id === origId))) return true;
    if (target.originalId && (item.originalId === target.originalId || (item.data && item.data.id === target.originalId))) return true;
    if (data.id && (item.originalId === data.id || (item.data && item.data.id === data.id))) return true;
    return false;
  };
  const updatedArchive = rawArchiveList.filter((i) => !isMatch(i));
  setStoredData(STORAGE_KEYS.ARCHIVE, updatedArchive, true);
  safeDispatchEvent('osas_storage_updated');
  logActivity('Restore Archive Item', 'System Archive', restoredBy, `Restored ${target.type}: "${target.title}".`);
}

export function purgeArchiveItem(archiveId: string, purgedBy: string): void {
  const items = getArchiveItems();
  const target = items.find((i) => i.id === archiveId);
  const updatedArchive = items.filter((i) => i.id !== archiveId);
  setStoredData(STORAGE_KEYS.ARCHIVE, updatedArchive);

  // Blacklist purged ID in local and cloud to permanently prevent re-hydration
  const purgedIds = getPurgedIds();
  const restoredIds = getRestoredIds();
  let restoredChanged = false;

  [archiveId, target?.id, target?.originalId, target?.data?.id, target?.data?.studentId, target?.data?.email].filter(Boolean).forEach((val) => {
    const s = String(val);
    purgedIds.add(s);
    if (restoredIds.has(s)) {
      restoredIds.delete(s);
      restoredChanged = true;
    }
  });
  savePurgedIds(purgedIds);
  if (restoredChanged) {
    saveRestoredIds(restoredIds);
  }

  const rawId = target?.data?.id || target?.originalId;
  const rawStudentId = target?.data?.studentId;
  const rawEmail = target?.data?.email?.toLowerCase();

  // If user, also delete directly from Firestore
  if (target?.type === 'STUDENT_RECORD' || (target?.type as string) === 'USER') {
    try {
      if (rawId) deleteDoc(doc(db, 'users', rawId)).catch(() => {});
      if (rawStudentId) deleteDoc(doc(db, 'users', rawStudentId.toLowerCase())).catch(() => {});
      if (rawEmail) deleteDoc(doc(db, 'users', rawEmail)).catch(() => {});
    } catch (_) {}
  }

  if (rawId || rawStudentId || rawEmail) {
    // 1. Interventions
    const interventions = getStoredData<InterventionRecord[]>(STORAGE_KEYS.INTERVENTIONS, []);
    setStoredData(STORAGE_KEYS.INTERVENTIONS, interventions.filter((r) => r.id !== rawId));

    // 2. Appointments
    const appointments = getStoredData<Appointment[]>(STORAGE_KEYS.APPOINTMENTS, []);
    setStoredData(STORAGE_KEYS.APPOINTMENTS, appointments.filter((a) => a.id !== rawId));

    // 3. Users / Students
    const users = getStoredData<User[]>(STORAGE_KEYS.USERS, []);
    setStoredData(STORAGE_KEYS.USERS, users.filter((u) => u.id !== rawId && (!rawStudentId || u.studentId !== rawStudentId) && (!rawEmail || u.email.toLowerCase() !== rawEmail)));

    // 4. Announcements
    const announcements = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, []);
    setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, announcements.filter((a) => a.id !== rawId));

    // 5. Scholarships
    const scholarships = getStoredData<Scholarship[]>(STORAGE_KEYS.SCHOLARSHIPS, []);
    setStoredData(STORAGE_KEYS.SCHOLARSHIPS, scholarships.filter((s) => s.id !== rawId));

    // 6. Scholarship Apps
    const scholarshipApps = getStoredData<ScholarshipApplication[]>(STORAGE_KEYS.SCHOLARSHIP_APPS, []);
    setStoredData(STORAGE_KEYS.SCHOLARSHIP_APPS, scholarshipApps.filter((a) => a.id !== rawId));

    // 7. Disciplinary Reports
    const disciplinaryReports = getStoredData<DisciplinaryReport[]>(STORAGE_KEYS.DISCIPLINARY_REPORTS, []);
    setStoredData(STORAGE_KEYS.DISCIPLINARY_REPORTS, disciplinaryReports.filter((d) => d.id !== rawId));

    // 8. Disciplinary Records
    const disciplinary = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
    setStoredData(STORAGE_KEYS.DISCIPLINARY, disciplinary.filter((d) => d.id !== rawId));

    // 9. Dorm Rooms
    const dormRooms = getStoredData<DormRoom[]>(STORAGE_KEYS.DORM_ROOMS, []);
    setStoredData(STORAGE_KEYS.DORM_ROOMS, dormRooms.filter((d) => d.id !== rawId));

    // 10. Dorm Applicants
    const dormApps = getStoredData<DormApplicant[]>(STORAGE_KEYS.DORM_APPLICANTS, []);
    setStoredData(STORAGE_KEYS.DORM_APPLICANTS, dormApps.filter((d) => d.id !== rawId));

    // 11. Dorm Reports
    const dormReports = getStoredData<DormReport[]>(STORAGE_KEYS.DORM_REPORTS, []);
    setStoredData(STORAGE_KEYS.DORM_REPORTS, dormReports.filter((d) => d.id !== rawId));

    // 12. Safety Reports
    const safetyReports = getStoredData<SafetyReport[]>(STORAGE_KEYS.SAFETY_REPORTS, []);
    setStoredData(STORAGE_KEYS.SAFETY_REPORTS, safetyReports.filter((s) => s.id !== rawId));

    // 13. Feedbacks
    const feedbacks = getStoredData<StudentFeedback[]>(STORAGE_KEYS.FEEDBACKS, []);
    setStoredData(STORAGE_KEYS.FEEDBACKS, feedbacks.filter((f) => f.id !== rawId));
  }

  triggerSuccessTransaction('Purged!', `Permanently deleted "${target?.title || 'Archive Item'}" from system storage.`);
  safeDispatchEvent('osas_storage_updated');
  logActivity('Purge Archive Item', 'System Archive', purgedBy, `Permanently purged ${target?.type || 'item'}: "${target?.title || archiveId}".`);
}

export function getActivityLogs(): ActivityLog[] {
  const logs = getStoredData<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return logs.filter((log) => {
    if (log.timestamp) {
      const logTime = new Date(log.timestamp).getTime();
      return now - logTime <= THIRTY_DAYS_MS;
    }
    return true;
  });
}

// --- NEW STU-SERVE UTILITY FUNCTIONS ---

export function toggleAnnouncementHeart(announcementId: string, studentName: string): Announcement[] {
  const announcements = getStoredData<Announcement[]>(STORAGE_KEYS.ANNOUNCEMENTS, initialAnnouncements);
  let found = false;
  const updated = announcements.map((a) => {
    const isTarget =
      a.id === announcementId ||
      (announcementId.startsWith('anc-sch-') && a.scholarshipId === announcementId.replace('anc-sch-', '')) ||
      (a.scholarshipId && announcementId === a.scholarshipId);

    if (isTarget) {
      found = true;
      const reacts = a.heartReacts || [];
      const hasHeart = reacts.includes(studentName);
      const newReacts = hasHeart ? reacts.filter((n) => n !== studentName) : [...reacts, studentName];
      return { ...a, heartReacts: newReacts, updatedAt: Date.now() };
    }
    return a;
  });

  if (!found && announcementId.startsWith('anc-sch-')) {
    const schId = announcementId.replace('anc-sch-', '');
    const scholarships = getScholarships();
    const sch = scholarships.find((s) => s.id === schId);
    if (sch) {
      const newAnc: Announcement = {
        id: announcementId,
        title: sch.title,
        content: sch.description || sch.requirements || 'Open scholarship program.',
        category: 'SCHOLARSHIP',
        createdAt: sch.createdAt || new Date().toISOString(),
        expirationDate: sch.deadline || 'Ongoing',
        imageUrl: sch.imageUrl,
        scholarshipId: sch.id,
        postedBy: 'Princess Ann T. Ruzol',
        heartReacts: [studentName],
        updatedAt: Date.now(),
      };
      updated.push(newAnc);
    }
  }

  setStoredData(STORAGE_KEYS.ANNOUNCEMENTS, updated, true);
  return updated;
}

export function updateUserAvatar(userId: string, avatarUrl: string): User | null {
  const users = getUsers();
  let updatedUser: User | null = null;
  const updatedUsers = users.map((u) => {
    if (u.id === userId || u.studentId === userId) {
      updatedUser = { ...u, avatarUrl };
      return updatedUser;
    }
    return u;
  });
  setStoredData(STORAGE_KEYS.USERS, updatedUsers);

  // Update current user in storage if matching
  const currentUser = getCurrentUser();
  if (currentUser && (currentUser.id === userId || currentUser.studentId === userId)) {
    const updated = { ...currentUser, avatarUrl };
    setCurrentUser(updated);
    return updated;
  }
  return updatedUser;
}

export function toggleDisciplinaryMark(recordId: string, role: 'ADMIN' | 'STUDENT'): DisciplinaryRecord[] {
  const records = getStoredData<DisciplinaryRecord[]>(STORAGE_KEYS.DISCIPLINARY, []);
  const updated = records.map((r) => {
    if (r.id === recordId) {
      const adminDone = role === 'ADMIN' ? !r.adminMarkedDone : !!r.adminMarkedDone;
      const studentDone = role === 'STUDENT' ? !r.studentMarkedDone : !!r.studentMarkedDone;

      // When both marked done, status becomes COMPLETED, otherwise SANCTIONED
      let status: 'SANCTIONED' | 'COMPLETED' = 'SANCTIONED';
      if (adminDone && studentDone) {
        status = 'COMPLETED';
      } else {
        status = 'SANCTIONED';
      }

      return {
        ...r,
        adminMarkedDone: adminDone,
        studentMarkedDone: studentDone,
        status,
      };
    }
    return r;
  });
  setStoredData(STORAGE_KEYS.DISCIPLINARY, updated);
  return updated;
}

export interface EmailLog {
  id: string;
  email: string;
  subject: string;
  body: string;
  sentAt: string;
}

export function logEmailDispatch(email: string, subject: string, body: string): void {
  const logs = getStoredData<EmailLog[]>(STORAGE_KEYS.EMAIL_LOGS, []);
  const newLog: EmailLog = {
    id: `email-${Date.now()}`,
    email,
    subject,
    body,
    sentAt: new Date().toISOString(),
  };
  setStoredData(STORAGE_KEYS.EMAIL_LOGS, [newLog, ...logs]);
}

export function getEmailLogs(): EmailLog[] {
  return getStoredData<EmailLog[]>(STORAGE_KEYS.EMAIL_LOGS, []);
}

export function archiveSafetyReport(reportId: string, archivedBy: string): void {
  const reports = getStoredData<SafetyReport[]>(STORAGE_KEYS.SAFETY_REPORTS, []);
  const target = reports.find((r) => r.id === reportId);
  if (target) {
    archiveItem(
      'SAFETY_REPORT',
      target.id,
      `Safety Incident: ${target.location} (${target.studentName})`,
      target,
      archivedBy
    );
    const updated = reports.filter((r) => r.id !== reportId);
    setStoredData(STORAGE_KEYS.SAFETY_REPORTS, updated);
    triggerSuccessTransaction(
      'Report Archived',
      'Ang Safety Incident Report ay matagumpay na na-archive at nailipat sa System Settings Archive Vault.'
    );
  }
}

export function archiveRejectedScholarshipApp(appId: string, archivedBy: string): void {
  const apps = getStoredData<ScholarshipApplication[]>(STORAGE_KEYS.SCHOLARSHIP_APPS, []);
  const target = apps.find((a) => a.id === appId);
  if (target) {
    archiveItem(
      'REJECTED_SCHOLARSHIP_APPLICATION',
      target.id,
      `Rejected Scholarship: ${target.studentName} (${target.scholarshipTitle})`,
      target,
      archivedBy
    );
    const updated = apps.filter((a) => a.id !== appId);
    setStoredData(STORAGE_KEYS.SCHOLARSHIP_APPS, updated);
    try {
      deleteDoc(doc(db, 'scholarship_applications', appId)).catch(() => {});
    } catch (_) {}
    triggerSuccessTransaction(
      'Applicant Archived',
      'Ang rejected scholarship applicant ay matagumpay na na-archive at nailipat sa System Settings Archive Vault.'
    );
  }
}

export function archiveRejectedDormApplicant(applicantId: string, archivedBy: string): void {
  const apps = getStoredData<DormApplicant[]>(STORAGE_KEYS.DORM_APPLICANTS, []);
  const target = apps.find((a) => a.id === applicantId);
  if (target) {
    archiveItem(
      'DORM_APPLICANT',
      target.id,
      `Rejected Dorm Applicant: ${target.studentName} (${target.studentId})`,
      target,
      archivedBy
    );
    const updated = apps.filter((a) => a.id !== applicantId);
    setStoredData(STORAGE_KEYS.DORM_APPLICANTS, updated);
    try {
      deleteDoc(doc(db, 'dorm_applicants', applicantId)).catch(() => {});
    } catch (_) {}
    triggerSuccessTransaction(
      'Applicant Archived',
      'Ang rejected dormitory applicant ay matagumpay na na-archive at nailipat sa System Settings Archive Vault.'
    );
  }
}

// --- RATINGS & OSAS EVALUATION API ---

export function autoArchiveExpiredRatingsAndEvaluations(): void {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const batchToArchive: Array<{
    type: ArchiveItem['type'];
    originalId: string;
    title: string;
    data: any;
    archivedBy: string;
  }> = [];

  // 1. Transaction Ratings (expire after 7 days)
  const txRatings = getStoredData<TransactionRating[]>(STORAGE_KEYS.TRANSACTION_RATINGS, []);
  const activeTx: TransactionRating[] = [];
  txRatings.forEach((r) => {
    const age = now - new Date(r.createdAt).getTime();
    if (age > SEVEN_DAYS_MS) {
      batchToArchive.push({
        type: 'TRANSACTION_RATING',
        originalId: r.id,
        title: `Rating: ${r.studentName} (${r.rating}★ ${r.category === 'APPOINTMENT' ? 'Appointment' : 'Dorm Maintenance'})`,
        data: r,
        archivedBy: 'System (7-Day Expiration Auto Archive)',
      });
    } else {
      activeTx.push(r);
    }
  });
  if (activeTx.length !== txRatings.length) {
    setStoredData(STORAGE_KEYS.TRANSACTION_RATINGS, activeTx);
  }

  // 2. OSAS Evaluations (expire after 7 days)
  const evaluations = getStoredData<OsasServiceEvaluation[]>(STORAGE_KEYS.OSAS_EVALUATIONS, []);
  const activeEvals: OsasServiceEvaluation[] = [];
  evaluations.forEach((e) => {
    const age = now - new Date(e.submittedAt).getTime();
    if (age > SEVEN_DAYS_MS) {
      batchToArchive.push({
        type: 'EVALUATION_FEEDBACK',
        originalId: e.id,
        title: `Evaluation: ${e.studentName} (${e.overallAverage}★ - ${e.overallLabel})`,
        data: e,
        archivedBy: 'System (7-Day Expiration Auto Archive)',
      });
    } else {
      activeEvals.push(e);
    }
  });
  if (activeEvals.length !== evaluations.length) {
    setStoredData(STORAGE_KEYS.OSAS_EVALUATIONS, activeEvals);
  }

  // 3. Student Feedbacks (expire after 7 days)
  const feedbacks = getStoredData<StudentFeedback[]>(STORAGE_KEYS.FEEDBACKS, []);
  const activeFeedbacks: StudentFeedback[] = [];
  feedbacks.forEach((f) => {
    const age = now - new Date(f.submittedAt).getTime();
    if (age > SEVEN_DAYS_MS) {
      batchToArchive.push({
        type: 'EVALUATION_FEEDBACK',
        originalId: f.id,
        title: `Feedback: ${f.studentName || 'Student'} (${f.title})`,
        data: f,
        archivedBy: 'System (7-Day Expiration Auto Archive)',
      });
    } else {
      activeFeedbacks.push(f);
    }
  });
  if (activeFeedbacks.length !== feedbacks.length) {
    setStoredData(STORAGE_KEYS.FEEDBACKS, activeFeedbacks);
  }

  if (batchToArchive.length > 0) {
    archiveItemsBatch(batchToArchive);
  }
}

export function getRatingLabel(rating: number): string {
  if (rating >= 5) return '5 Stars - Napakahusay (Excellent)';
  if (rating === 4) return '4 Stars - Napakamabuti (Very Good)';
  if (rating === 3) return '3 Stars - Mabuti (Good)';
  if (rating === 2) return '2 Stars - Katamtaman (Fair)';
  return '1 Star - Masama (Poor)';
}

export function getTransactionRatings(): TransactionRating[] {
  autoArchiveExpiredRatingsAndEvaluations();
  return getStoredData<TransactionRating[]>(STORAGE_KEYS.TRANSACTION_RATINGS, []);
}

export function addTransactionRating(
  data: Omit<TransactionRating, 'id' | 'createdAt' | 'ratingLabel'> & { ratingLabel?: string }
): TransactionRating {
  const list = getTransactionRatings();
  const existing = list.find((r) => r.transactionId === data.transactionId);
  if (existing) {
    return existing;
  }

  const label = data.ratingLabel || getRatingLabel(data.rating);
  const newRating: TransactionRating = {
    id: `trat-${Date.now()}`,
    ...data,
    ratingLabel: label,
    createdAt: new Date().toISOString(),
  };

  setStoredData(STORAGE_KEYS.TRANSACTION_RATINGS, [newRating, ...list]);

  sendNotification(
    'ADMIN',
    `New Star Rating Received (${data.category === 'APPOINTMENT' ? 'Appointment' : 'Dorm Report'})`,
    `${data.studentName} rated ${data.rating}/5 stars (${label}) for ${data.category === 'APPOINTMENT' ? 'Counseling Appointment' : 'Dorm Maintenance'}.`,
    'SYSTEM',
    'ratings'
  );

  triggerSuccessTransaction(
    'Rating Submitted!',
    `Salamat! Naisumite ang iyong ${data.rating}-Star rating para sa ${data.category === 'APPOINTMENT' ? 'Student Grievance' : 'Dorm Report'}.`
  );

  logActivity('Submit Star Rating', 'Ratings', data.studentName, `Rated ${data.category} transaction ID ${data.transactionId}: ${data.rating}/5 stars.`);

  return newRating;
}

export function getOsasEvaluations(): OsasServiceEvaluation[] {
  autoArchiveExpiredRatingsAndEvaluations();
  return getStoredData<OsasServiceEvaluation[]>(STORAGE_KEYS.OSAS_EVALUATIONS, []);
}

export function canStudentSubmitWeeklyEvaluation(studentId: string): { allowed: boolean; nextAllowedDate?: string } {
  const list = getOsasEvaluations();
  const studentEvals = list.filter((e) => e.studentId === studentId);
  if (studentEvals.length === 0) return { allowed: true };

  studentEvals.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const latest = studentEvals[0];
  const lastTime = new Date(latest.submittedAt).getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (now - lastTime < oneWeekMs) {
    const nextAllowed = new Date(lastTime + oneWeekMs).toLocaleDateString();
    return { allowed: false, nextAllowedDate: nextAllowed };
  }

  return { allowed: true };
}

export function submitOsasEvaluation(
  student: User,
  answers: OsasEvaluationQuestionAnswer[],
  feedbackContent: string
): { success: boolean; message: string } {
  const studentId = student.studentId || student.id;
  const check = canStudentSubmitWeeklyEvaluation(studentId);
  if (!check.allowed) {
    return {
      success: false,
      message: `Maaari ka lamang magsumite ng OSAS Service Evaluation minsan sa isang linggo. Makakapag-sumite ka ulit sa o pagkatapos ng ${check.nextAllowedDate}.`,
    };
  }

  const total = answers.reduce((sum, a) => sum + a.score, 0);
  const avg = Number((total / (answers.length || 1)).toFixed(2));
  const roundedAvg = Math.round(avg);
  const overallLabel = getRatingLabel(roundedAvg);

  const list = getOsasEvaluations();
  const newEval: OsasServiceEvaluation = {
    id: `oseval-${Date.now()}`,
    studentId,
    studentName: student.fullName,
    answers,
    overallAverage: avg,
    overallLabel,
    feedbackContent,
    submittedAt: new Date().toISOString(),
  };

  setStoredData(STORAGE_KEYS.OSAS_EVALUATIONS, [newEval, ...list]);

  // Submit as student feedback as well
  const fbTitle = `OSAS Service Evaluation (${avg}/5.0 - ${overallLabel})`;
  submitStudentFeedback(student, fbTitle, feedbackContent || 'Submitted 8-Question OSAS Service Evaluation.');

  sendNotification(
    'ADMIN',
    `New OSAS Service Evaluation Received`,
    `${student.fullName} submitted an OSAS evaluation with overall rating: ${avg}/5.0 stars.`,
    'SYSTEM',
    'ratings'
  );

  triggerSuccessTransaction(
    'Evaluation Submitted!',
    `Maraming salamat! Naisumite ang iyong evaluation sa serbisyo ng OSAS sa Admin Ratings Module.`
  );

  logActivity('Submit OSAS Evaluation', 'Ratings', student.fullName, `Submitted OSAS service evaluation with average rating ${avg}/5.0.`);

  return { success: true, message: 'Maraming salamat! Naisumite ang iyong evaluation sa serbisyo ng OSAS.' };
}


