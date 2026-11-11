import React from 'react';
import { User, SystemModule, AnnouncementCategory, SlipNotice, SystemNotification } from '../../types';
import { Modal } from './Modal';
import { getNotifications, markNotificationsRead, getAnnouncements } from '../../services/storage';
import { Bell, CheckCheck, ShieldAlert, Calendar, Award, Home, Megaphone, Info, MessageSquareQuote, HeartHandshake } from 'lucide-react';
import { SlipNoticeModal } from './SlipNoticeModal';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onNavigateModule?: (module: SystemModule) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose, user, onNavigateModule }) => {
  const [notifications, setNotifications] = React.useState(() =>
    getNotifications(user.studentId || user.id, user.role)
  );
  const [viewingSlipNotice, setViewingSlipNotice] = React.useState<SlipNotice | null>(null);

  React.useEffect(() => {
    const handleUpdate = () => {
      setNotifications(getNotifications(user.studentId || user.id, user.role));
    };
    handleUpdate();
    window.addEventListener('osas_storage_updated', handleUpdate);
    window.addEventListener('osas_notifications_updated', handleUpdate);
    return () => {
      window.removeEventListener('osas_storage_updated', handleUpdate);
      window.removeEventListener('osas_notifications_updated', handleUpdate);
    };
  }, [user.studentId, user.id, user.role, isOpen]);

  const handleMarkAllRead = () => {
    markNotificationsRead(user.studentId || user.id, user.role);
    setNotifications(getNotifications(user.studentId || user.id, user.role));
  };

  const handleNotificationClick = (notif: any) => {
    markNotificationsRead(user.studentId || user.id, user.role);
    setNotifications(getNotifications(user.studentId || user.id, user.role));

    const isInterventionNotif =
      notif.linkModule === 'intervention' ||
      (notif.title && notif.title.toLowerCase().includes('intervention')) ||
      (notif.message && notif.message.toLowerCase().includes('intervention'));

    if (user.role === 'STUDENT' && isInterventionNotif) {
      // For student accounts, intervention notifications are strictly non-clickable (read-only)
      return;
    }

    if (notif.type === 'SLIP_NOTICE' || notif.slipNotice) {
      if (notif.slipNotice) {
        setViewingSlipNotice(notif.slipNotice);
      } else {
        setViewingSlipNotice({
          id: notif.id,
          dateSent: new Date(notif.timestamp || notif.createdAt).toISOString().split('T')[0],
          studentName: user.fullName,
          studentId: user.studentId,
          course: user.course,
          yearLevel: user.yearLevel,
          visitDate: new Date().toISOString().split('T')[0],
          visitTime: '10:00 AM',
          purposes: ['Counseling'],
          counselorName: 'Maria Mel B. Glamau',
          notes: notif.message,
        });
      }
      return;
    }

    onClose();
    if (onNavigateModule) {
      if (user.role === 'STUDENT') {
        const titleLower = (notif.title || '').toLowerCase();
        const msgLower = (notif.message || '').toLowerCase();
        const fullText = `${titleLower} ${msgLower}`;

        // 1. Dormitory application, residency status, room assignment, maintenance updates -> Directly go to Dormitory module
        const isDormitoryStatusUpdate =
          notif.linkModule === 'dormitory' ||
          notif.type === 'DORM' ||
          fullText.includes('resident') ||
          fullText.includes('dormitory application') ||
          fullText.includes('dorm application') ||
          fullText.includes('room assignment') ||
          fullText.includes('dorm room') ||
          fullText.includes('residency') ||
          (fullText.includes('dorm') && !fullText.includes('announcement'));

        if (isDormitoryStatusUpdate) {
          onNavigateModule('dormitory');
          return;
        }

        // 2. Is this an announcement notification?
        const isAnnouncementType =
          notif.type === 'ANNOUNCEMENT' ||
          notif.linkModule === 'announcements' ||
          notif.linkModule === 'dashboard' ||
          notif.category ||
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
          let cat: AnnouncementCategory = notif.category || 'SCHOOL';
          if (!notif.category) {
            const allAncs = getAnnouncements();
            const matchedAnc = allAncs.find(
              (a) =>
                (notif.announcementId && a.id === notif.announcementId) ||
                a.title.toLowerCase() === notif.title.replace(/^New Announcement:\s*/i, '').toLowerCase() ||
                notif.message.includes(a.title)
            );
            if (matchedAnc) {
              cat = matchedAnc.category;
            } else if (fullText.includes('scholarship') || notif.type === 'SCHOLARSHIP') {
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
        switch (notif.type) {
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
          default:
            if (notif.linkModule && notif.linkModule !== 'announcements') {
              onNavigateModule(notif.linkModule as SystemModule);
            } else {
              onNavigateModule('dashboard');
            }
        }
        return;
      }

      if (user.role === 'ADMIN') {
        const titleLower = (notif.title || '').toLowerCase();
        const msgLower = (notif.message || '').toLowerCase();
        const fullText = `${titleLower} ${msgLower}`;

        // Ensure Student Report/Concern submissions navigate directly to OSAS Admin > Reports/Concerns (safety_reports)
        const isReportConcernNotif =
          notif.linkModule === 'safety_reports' ||
          notif.type === 'SAFETY' ||
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

      if (notif.linkModule) {
        onNavigateModule(notif.linkModule as SystemModule);
      } else {
        switch (notif.type) {
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
          case 'ANNOUNCEMENT':
            onNavigateModule('announcements');
            break;
          default:
            onNavigateModule('dashboard');
        }
      }
    }
  };

  const getIcon = (notif: any) => {
    const isInterventionNotif =
      notif.linkModule === 'intervention' ||
      notif.type === 'INTERVENTION' ||
      (notif.title && notif.title.toLowerCase().includes('intervention')) ||
      (notif.message && notif.message.toLowerCase().includes('intervention')) ||
      (notif.title && notif.title.toLowerCase().includes('guidance')) ||
      (notif.message && notif.message.toLowerCase().includes('guidance'));

    if (isInterventionNotif) {
      return <HeartHandshake className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
    }

    const isFeedbackNotif =
      notif.linkModule === 'student_feedbacks' ||
      notif.linkModule === 'submit_feedback' ||
      (notif.title && notif.title.toLowerCase().includes('feedback')) ||
      (notif.message && notif.message.toLowerCase().includes('feedback'));

    if (isFeedbackNotif) {
      return <MessageSquareQuote className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    }

    switch (notif.type) {
      case 'SAFETY':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      case 'APPOINTMENT':
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'SCHOLARSHIP':
        return <Award className="w-4 h-4 text-amber-600" />;
      case 'DORM':
        return <Home className="w-4 h-4 text-emerald-600" />;
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-4 h-4 text-purple-600" />;
      default:
        return <Info className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="System Notifications" subtitle="Incoming activity alerts & transactions" maxWidth="md">
      <div className="space-y-4">
        {notifications.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" /> Mark all as read
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:border-blue-300 ${
                  notif.isRead
                    ? 'bg-slate-50/80 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                    : 'bg-blue-50/50 border-blue-200 text-slate-900 font-medium hover:bg-blue-100/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-2xs border border-slate-200 shrink-0">
                    {getIcon(notif)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{notif.title}</h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
    <SlipNoticeModal
      isOpen={Boolean(viewingSlipNotice)}
      onClose={() => setViewingSlipNotice(null)}
      slipNotice={viewingSlipNotice}
    />
  </>
  );
};
