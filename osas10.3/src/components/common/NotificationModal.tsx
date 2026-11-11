import React, { useState } from 'react';
import { User, SystemNotification, SystemModule, AnnouncementCategory, SlipNotice } from '../../types';
import { getNotifications, markNotificationsRead, markNotificationAsRead, getAnnouncements, getDisciplinaryReports } from '../../services/storage';
import { X, CheckCheck, ExternalLink, ShieldAlert, Calendar, Award, Home, Megaphone, Info, MessageSquareQuote, HeartHandshake } from 'lucide-react';
import { SlipNoticeModal } from './SlipNoticeModal';

interface NotificationModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onNavigateModule: (module: SystemModule) => void;
  onOpenFeedbackModal?: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  user,
  isOpen,
  onClose,
  onNavigateModule,
  onOpenFeedbackModal,
}) => {
  const [notifications, setNotifications] = useState<SystemNotification[]>(() =>
    getNotifications(user.studentId || user.id, user.role, user.fullName, user.id)
  );
  const [viewingSlipNotice, setViewingSlipNotice] = useState<SlipNotice | null>(null);

  React.useEffect(() => {
    const handleUpdate = () => {
      setNotifications(getNotifications(user.studentId || user.id, user.role, user.fullName, user.id));
    };
    if (isOpen) {
      handleUpdate();
    }
    window.addEventListener('osas_storage_updated', handleUpdate);
    window.addEventListener('osas_notifications_updated', handleUpdate);
    return () => {
      window.removeEventListener('osas_storage_updated', handleUpdate);
      window.removeEventListener('osas_notifications_updated', handleUpdate);
    };
  }, [user.studentId, user.id, user.role, user.fullName, isOpen]);

  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    markNotificationsRead(user.studentId || user.id, user.role, user.fullName, user.id);
    setNotifications(getNotifications(user.studentId || user.id, user.role, user.fullName, user.id));
  };

  const handleNotificationClick = (n: SystemNotification) => {
    markNotificationAsRead(n.id);
    setNotifications(getNotifications(user.studentId || user.id, user.role, user.fullName, user.id));

    const isInterventionNotif =
      n.linkModule === 'intervention' ||
      n.title.toLowerCase().includes('intervention') ||
      n.message.toLowerCase().includes('intervention');

    if (user.role === 'STUDENT' && isInterventionNotif) {
      // For student accounts, intervention notifications are strictly non-clickable (read-only)
      return;
    }

    // Slip Notice Notification: Clicking opens the exact sent Slip Notice in popup only, NO module redirect
    if (n.type === 'SLIP_NOTICE' || n.slipNotice) {
      if (n.slipNotice) {
        setViewingSlipNotice(n.slipNotice);
      } else {
        // Look up the exact slip notice from saved disciplinary reports if not embedded on the notification object
        const allSlips = getDisciplinaryReports().flatMap((r) => r.slipNotices || []);
        const normSid = (user.studentId || user.id || '').trim().toLowerCase();
        const normName = (user.fullName || '').trim().toLowerCase();
        const matchedSlip = allSlips.find(
          (s) =>
            (s.studentId && normSid && s.studentId.trim().toLowerCase() === normSid) ||
            (s.studentName && normName && s.studentName.trim().toLowerCase() === normName)
        );
        if (matchedSlip) {
          setViewingSlipNotice(matchedSlip);
        }
      }
      return;
    }

    onClose();

    // 1. Dormitory application, residency status, room assignment, maintenance updates -> Directly go to Dormitory module
    const titleLower = (n.title || '').toLowerCase();
    const msgLower = (n.message || '').toLowerCase();
    const fullText = `${titleLower} ${msgLower}`;

    const isDormitoryStatusUpdate =
      n.linkModule === 'dormitory' ||
      n.type === 'DORM' ||
      fullText.includes('dorm maintenance') ||
      fullText.includes('dorm report') ||
      fullText.includes('resident') ||
      fullText.includes('dormitory application') ||
      fullText.includes('dorm application') ||
      fullText.includes('room assignment') ||
      fullText.includes('dorm room') ||
      fullText.includes('residency') ||
      (fullText.includes('dorm') && !fullText.includes('announcement'));

    if (isDormitoryStatusUpdate) {
      sessionStorage.setItem('osas_dorm_scroll_reports', 'true');
      onNavigateModule('dormitory');
      return;
    }

    // 2. Feedback notifications
    const isFeedbackNotif =
      n.linkModule === 'student_feedbacks' ||
      n.linkModule === 'submit_feedback' ||
      (n.type as string) === 'FEEDBACK';

    if (isFeedbackNotif) {
      if (user.role === 'ADMIN') {
        if (onOpenFeedbackModal) {
          onOpenFeedbackModal();
        } else if (n.linkModule) {
          onNavigateModule(n.linkModule as SystemModule);
        }
      } else {
        onNavigateModule('submit_feedback');
      }
      return;
    }

    if (user.role === 'STUDENT') {

      // 2. Is this an announcement notification?
      const isAnnouncementType =
        n.type === 'ANNOUNCEMENT' ||
        n.linkModule === 'announcements' ||
        n.linkModule === 'dashboard' ||
        n.category ||
        fullText.includes('announcement') ||
        fullText.includes('paalala') ||
        fullText.includes('bulletin') ||
        fullText.includes('new scholarship') ||
        fullText.includes('bagong scholarship') ||
        fullText.includes('scholarship program') ||
        fullText.includes('dormitory announcement') ||
        fullText.includes('dorm announcement') ||
        fullText.includes('guidance') ||
        fullText.includes('counseling');

      if (isAnnouncementType) {
        let cat: AnnouncementCategory = n.category || 'SCHOOL';
        if (!n.category) {
          const allAncs = getAnnouncements();
          const matchedAnc = allAncs.find(
            (a) =>
              (n.announcementId && a.id === n.announcementId) ||
              a.title.toLowerCase() === n.title.replace(/^New Announcement:\s*/i, '').toLowerCase() ||
              n.message.includes(a.title)
          );
          if (matchedAnc) {
            cat = matchedAnc.category;
          } else if (fullText.includes('scholarship') || n.type === 'SCHOLARSHIP') {
            cat = 'SCHOLARSHIP';
          } else if (fullText.includes('dorm') || fullText.includes('dormitory')) {
            cat = 'DORMITORY';
          } else if (fullText.includes('guidance') || fullText.includes('counseling')) {
            cat = 'GUIDANCE';
          } else {
            cat = 'SCHOOL';
          }
        }

        sessionStorage.setItem('osas_student_announcement_tab', cat);
        window.dispatchEvent(new CustomEvent('osas_select_announcement_tab', { detail: cat }));
        onNavigateModule('dashboard');
        return;
      }

      // 3. Other modules
      switch (n.type) {
        case 'SAFETY':
          onNavigateModule('safety_reports');
          break;
        case 'APPOINTMENT':
          onNavigateModule('appointments');
          break;
        case 'SCHOLARSHIP':
          onNavigateModule('scholarship');
          break;
        case 'DORM':
          onNavigateModule('dormitory');
          break;
        default:
          if (n.linkModule && n.linkModule !== 'announcements') {
            onNavigateModule(n.linkModule as SystemModule);
          } else {
            onNavigateModule('dashboard');
          }
      }
      return;
    }

    if (user.role === 'ADMIN') {
      const titleLower = (n.title || '').toLowerCase();
      const msgLower = (n.message || '').toLowerCase();
      const fullText = `${titleLower} ${msgLower}`;

      // Ensure Student Report/Concern submissions navigate directly to OSAS Admin > Reports/Concerns (safety_reports)
      const isReportConcernNotif =
        n.linkModule === 'safety_reports' ||
        n.type === 'SAFETY' ||
        titleLower.includes('report/concern') ||
        titleLower.includes('new report') ||
        titleLower.includes('incident report') ||
        titleLower.includes('safety report') ||
        titleLower.includes('grievance') ||
        fullText.includes('report/concern') ||
        fullText.includes('reported ') ||
        fullText.includes('incident report');

      const isWalkInOfficialDisciplinary =
        titleLower.includes('walk-in') ||
        titleLower.includes('official disciplinary record');

      if (isReportConcernNotif && !isWalkInOfficialDisciplinary) {
        onNavigateModule('safety_reports');
        return;
      }
    }

    if (n.linkModule) {
      onNavigateModule(n.linkModule as SystemModule);
    } else {
      switch (n.type) {
        case 'SAFETY':
          onNavigateModule('safety_reports');
          break;
        case 'APPOINTMENT':
          onNavigateModule('student_grievances');
          break;
        case 'SCHOLARSHIP':
          onNavigateModule('scholarship');
          break;
        case 'DORM':
          onNavigateModule('dormitory');
          break;
        case 'ANNOUNCEMENT':
          onNavigateModule('announcements');
          break;
        default:
          onNavigateModule('dashboard');
      }
    }
  };

  const getIcon = (n: SystemNotification) => {
    const isInterventionNotif =
      n.linkModule === 'intervention' ||
      (n as any).type === 'INTERVENTION' ||
      n.title.toLowerCase().includes('intervention') ||
      n.message.toLowerCase().includes('intervention') ||
      n.title.toLowerCase().includes('guidance') ||
      n.message.toLowerCase().includes('guidance');

    if (isInterventionNotif) {
      return <HeartHandshake className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
    }

    const isFeedbackNotif =
      n.linkModule === 'student_feedbacks' ||
      n.linkModule === 'submit_feedback' ||
      n.title.toLowerCase().includes('feedback') ||
      n.message.toLowerCase().includes('feedback');

    if (isFeedbackNotif) {
      return <MessageSquareQuote className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }

    switch (n.type) {
      case 'SAFETY':
        return <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'APPOINTMENT':
        return <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'SCHOLARSHIP':
        return <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'DORM':
        return <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const isAppointmentRelated = (n: SystemNotification) => {
    return (
      n.type === 'APPOINTMENT' ||
      n.linkModule === 'appointments' ||
      (n.title && n.title.toLowerCase().includes('appointment')) ||
      (n.message && n.message.toLowerCase().includes('appointment')) ||
      (n.title && n.title.toLowerCase().includes('grievance')) ||
      (n.message && n.message.toLowerCase().includes('grievance'))
    );
  };

  const formatStudentNotifText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/Appointments/g, 'Student Grievances')
      .replace(/appointments/g, 'student grievances')
      .replace(/Appointment/g, 'Student Grievance')
      .replace(/appointment/g, 'student grievance');
  };

  const getDestinationLabel = (n: SystemNotification) => {
    if (user.role === 'STUDENT') {
      if (isAppointmentRelated(n)) {
        return 'Student Grievances';
      }
      if (n.linkModule === 'safety_reports' || n.type === 'SAFETY') {
        return 'Report/Concerns';
      }
      if (n.linkModule === 'scholarship' || n.type === 'SCHOLARSHIP') {
        return 'Scholarships';
      }
      if (n.linkModule === 'dormitory' || n.type === 'DORM') {
        return 'Dormitory';
      }
      if (n.linkModule === 'disciplinary') {
        return 'Disciplinary Records';
      }
    }
    if (
      n.linkModule === 'student_feedbacks' ||
      n.title.toLowerCase().includes('feedback') ||
      n.message.toLowerCase().includes('feedback')
    ) {
      return 'Open Student Feedbacks List';
    }
    return 'Open Module';
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">System Notifications</h3>
            <span
              className={`px-2.5 py-0.5 font-bold text-[10px] rounded-full transition-colors ${
                unreadCount > 0
                  ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {unreadCount > 0 ? `${unreadCount} Unread` : 'All Read'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
              </button>
            )}
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto space-y-2.5 custom-scrollbar p-1">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs font-medium">
              No notifications at this time.
            </div>
          ) : (
            notifications.map((n) => {
              const isAppRel = isAppointmentRelated(n);
              const displayTitle = user.role === 'STUDENT' && isAppRel ? formatStudentNotifText(n.title) : n.title;
              const displayMessage = user.role === 'STUDENT' && isAppRel ? formatStudentNotifText(n.message) : n.message;

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group relative overflow-hidden ${
                    n.isRead
                      ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      : 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-slate-900 dark:text-white hover:bg-blue-100/70 dark:hover:bg-blue-950/70 shadow-2xs'
                  }`}
                >
                  {/* Unread Pill Ribbon Bar */}
                  {!n.isRead && (
                    <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 dark:bg-blue-400" />
                  )}

                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-2xs shrink-0 mt-0.5 ml-1">
                    {getIcon(n)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-bold ${!n.isRead ? 'text-blue-950 dark:text-blue-200 font-extrabold' : 'text-slate-700 dark:text-slate-300'}`}>
                        {displayTitle}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{displayMessage}</p>
                    {user.role === 'STUDENT' &&
                    (n.linkModule === 'intervention' ||
                      n.title.toLowerCase().includes('intervention') ||
                      n.message.toLowerCase().includes('intervention')) ? (
                      <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 pt-1">
                        <Info className="w-3 h-3 text-slate-400" /> OSAS Guidance Advisory (Informational Notice)
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 group-hover:underline flex items-center gap-1 pt-1">
                        <span>{getDestinationLabel(n)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      <SlipNoticeModal
        isOpen={Boolean(viewingSlipNotice)}
        onClose={() => setViewingSlipNotice(null)}
        slipNotice={viewingSlipNotice}
      />
    </div>
  );
};
