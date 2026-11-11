import React, { useState, useEffect, useRef } from 'react';
import { User, SystemModule, DisciplinaryReport } from './types';
import { fetchServerState } from './services/storage';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { LoginForm } from './components/auth/LoginForm';
import { Toast, ToastMessage } from './components/common/Toast';
import { NotificationModal } from './components/common/NotificationModal';
import { ChangeProfileModal } from './components/common/ChangeProfileModal';
import { StudentFeedbackModal } from './components/admin/StudentFeedbackModal';
import { SuccessModal } from './components/common/SuccessModal';
import { UpdatePasswordModal } from './components/auth/UpdatePasswordModal';
import { BackToTopButton } from './components/common/BackToTopButton';

// Admin Modules
import { AdminDashboard } from './components/admin/AdminDashboard';
import { SafetyReportsModule } from './components/admin/SafetyReportsModule';
import { RegisterStudentModule } from './components/admin/RegisterStudentModule';
import { AnnouncementsModule } from './components/admin/AnnouncementsModule';
import { ScholarshipModule } from './components/admin/ScholarshipModule';
import { StudentGrievancesModule } from './components/admin/StudentGrievancesModule';
import { DisciplinaryModule } from './components/admin/DisciplinaryModule';
import { InterventionModule } from './components/admin/InterventionModule';
import { DormitoryModule } from './components/admin/DormitoryModule';
import { StudentRecordsModule } from './components/admin/StudentRecordsModule';
import { ActivityLogsModule } from './components/admin/ActivityLogsModule';
import { SettingsModule } from './components/admin/SettingsModule';

// Student Modules
import { StudentDashboard } from './components/student/StudentDashboard';
import { EmergencyReportModule } from './components/student/EmergencyReportModule';
import { StudentAppointmentsModule } from './components/student/StudentAppointmentsModule';
import { StudentDisciplinaryModule } from './components/student/StudentDisciplinaryModule';
import { StudentScholarshipModule } from './components/student/StudentScholarshipModule';
import { StudentDormitoryModule } from './components/student/StudentDormitoryModule';

// Guidance Modules
import { GuidanceDashboard } from './components/guidance/GuidanceDashboard';
import { ReferredDisciplinaryModule } from './components/guidance/ReferredDisciplinaryModule';

export function App() {
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity limit

  // Active Session State (sessionStorage retains state on refresh, clears on browser close / system restart)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const lastActive = sessionStorage.getItem('osas_last_active_time');
      if (lastActive && Date.now() - parseInt(lastActive, 10) > INACTIVITY_TIMEOUT_MS) {
        sessionStorage.removeItem('osas_current_user');
        sessionStorage.removeItem('osas_active_module');
        sessionStorage.removeItem('osas_last_active_time');
        return null;
      }
      const saved = sessionStorage.getItem('osas_current_user');
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch {
      return null;
    }
  });

  // Active Module State (sessionStorage ensures exact module is retained on refresh)
  const [activeModule, setActiveModule] = useState<SystemModule>(() => {
    const saved = sessionStorage.getItem('osas_active_module') as SystemModule;
    return saved || 'dashboard';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const mainScrollRef = useRef<HTMLElement | null>(null);

  // Modals state
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    subMessage?: string;
  }>({
    isOpen: false,
    message: '',
  });

  const addToast = (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => {
    const newToast: ToastMessage = {
      id: Date.now().toString() + Math.random().toString(),
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const [pendingDisciplinaryReport, setPendingDisciplinaryReport] = useState<DisciplinaryReport | null>(null);

  const handleSelectModule = (mod: SystemModule) => {
    setPendingDisciplinaryReport(null);
    setActiveModule(mod);
    sessionStorage.setItem('osas_active_module', mod);
  };

  // Monitor user activity for inactivity timeout
  useEffect(() => {
    if (!currentUser) return;

    const updateLastActive = () => {
      sessionStorage.setItem('osas_last_active_time', Date.now().toString());
    };

    updateLastActive();

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach((event) => window.addEventListener(event, updateLastActive));

    const checkInactivityInterval = setInterval(() => {
      const lastActive = sessionStorage.getItem('osas_last_active_time');
      if (lastActive && Date.now() - parseInt(lastActive, 10) > INACTIVITY_TIMEOUT_MS) {
        handleLogout();
        addToast('warning', 'Session Timed Out', 'Na-logout ka dahil matagal na walang galaw o aktibidad sa system. Mangyaring mag-login muli.');
      }
    }, 60000);

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, updateLastActive));
      clearInterval(checkInactivityInterval);
    };
  }, [currentUser]);

  // Listen to simulated email events, notifications, and transaction success popups!
  useEffect(() => {
    const handleEmailSent = (e: CustomEvent) => {
      const log = e.detail;
      addToast(
        'info',
        `📧 Email Dispatched: ${log.subject}`,
        `Sender: ${log.sender || 'arnoldviena@gmail.com'} | To: ${log.toEmail}`
      );
    };

    const handleNotification = (e: CustomEvent) => {
      const notif = e.detail;
      addToast(
        'success',
        `🔔 Notification: ${notif.title}`,
        notif.message
      );
    };

    const handleSuccessTransaction = (e: CustomEvent) => {
      const detail = e.detail;
      addToast(
        'success',
        detail.title || detail.message || 'Transaction Successful!',
        detail.subMessage || detail.message || 'The operation was executed successfully.'
      );
    };

    window.addEventListener('osas_email_sent', handleEmailSent as EventListener);
    window.addEventListener('osas_notification_sent', handleNotification as EventListener);
    window.addEventListener('osas_success_transaction', handleSuccessTransaction as EventListener);

    return () => {
      window.removeEventListener('osas_email_sent', handleEmailSent as EventListener);
      window.removeEventListener('osas_notification_sent', handleNotification as EventListener);
      window.removeEventListener('osas_success_transaction', handleSuccessTransaction as EventListener);
    };
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('osas_current_user', JSON.stringify(user));
    sessionStorage.setItem('osas_last_active_time', Date.now().toString());
    fetchServerState().catch(() => {});

    let targetMod: SystemModule = 'dashboard';
    const savedMod = sessionStorage.getItem('osas_active_module') as SystemModule;
    if (savedMod) {
      if (user.role === 'GUIDANCE_ADMIN') {
        const guidanceAllowed: SystemModule[] = [
          'dashboard',
          'safety_reports',
          'student_grievances',
          'appointments',
          'intervention',
          'referred_disciplinary',
          'disciplinary',
          'student_records',
          'announcements',
          'settings',
        ];
        targetMod = guidanceAllowed.includes(savedMod) ? savedMod : 'dashboard';
      } else if (user.role === 'STUDENT') {
        const studentAllowed: SystemModule[] = [
          'dashboard',
          'scholarship',
          'dormitory',
          'safety_reports',
          'student_grievances',
          'appointments',
          'disciplinary',
        ];
        targetMod = studentAllowed.includes(savedMod) ? savedMod : 'dashboard';
      } else {
        const adminAllowed: SystemModule[] = [
          'dashboard',
          'register_student',
          'intervention',
          'refer_student_reports',
          'safety_reports',
          'scholarship',
          'dormitory',
          'student_records',
          'announcements',
          'activity_logs',
          'settings',
        ];
        targetMod = adminAllowed.includes(savedMod) ? savedMod : 'dashboard';
      }
    }
    setActiveModule(targetMod);
    sessionStorage.setItem('osas_active_module', targetMod);
    addToast('success', 'Welcome!', `Welcome back to STU-SERVE Portal, ${user.fullName}! Logged in as ${user.role}.`);
  };

  const handleLogout = () => {
    setPendingDisciplinaryReport(null);
    setCurrentUser(null);
    sessionStorage.removeItem('osas_current_user');
    sessionStorage.removeItem('osas_active_module');
    sessionStorage.removeItem('osas_last_active_time');
    setActiveModule('dashboard');
  };

  const handleProfileUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    sessionStorage.setItem('osas_current_user', JSON.stringify(updatedUser));
    addToast('success', 'Profile Updated', 'Your profile picture was updated successfully.');
  };

  // If user is not logged in, show Login Screen
  if (!currentUser) {
    return (
      <>
        <Toast toasts={toasts} onClose={removeToast} />
        <SuccessModal
          isOpen={successModalData.isOpen}
          title={successModalData.title}
          message={successModalData.message}
          subMessage={successModalData.subMessage}
          onClose={() => setSuccessModalData((prev) => ({ ...prev, isOpen: false }))}
        />
        <LoginForm onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex text-slate-800 dark:text-slate-100 font-sans antialiased overflow-x-hidden transition-colors duration-200">
      <Toast toasts={toasts} onClose={removeToast} />

      {/* Global Transaction Success Modal */}
      <SuccessModal
        isOpen={successModalData.isOpen}
        title={successModalData.title}
        message={successModalData.message}
        subMessage={successModalData.subMessage}
        onClose={() => setSuccessModalData((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Global Modals */}
      <NotificationModal
        user={currentUser}
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        onNavigateModule={(mod) => {
          handleSelectModule(mod);
          setIsNotifModalOpen(false);
        }}
        onOpenFeedbackModal={() => {
          setIsFeedbackModalOpen(true);
          setIsNotifModalOpen(false);
        }}
      />

      <ChangeProfileModal
        user={currentUser}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdateUser={handleProfileUpdate}
      />

      <StudentFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />

      {/* Strict First-Time Login Password Update Lockout Modal */}
      {currentUser?.mustChangePassword && (
        <UpdatePasswordModal
          user={currentUser}
          isOpen={Boolean(currentUser?.mustChangePassword)}
          onSuccess={(updatedUser) => {
            setCurrentUser(updatedUser);
            sessionStorage.setItem('osas_current_user', JSON.stringify(updatedUser));
            addToast('success', 'Security Setup Completed', 'Your password has been successfully updated.');
          }}
          onCancel={handleLogout}
        />
      )}

      {/* Responsive Collapsible Sidebar */}
      <Sidebar
        user={currentUser}
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        isOpen={isSidebarOpen}
        mobileOpen={mobileSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          user={currentUser}
          activeModule={activeModule}
          onLogout={handleLogout}
          onSelectModule={handleSelectModule}
          onOpenNotifications={() => setIsNotifModalOpen(true)}
          onOpenChangeProfile={() => setIsProfileModalOpen(true)}
          onOpenFeedbackModal={() => setIsFeedbackModalOpen(true)}
          onUpdateUser={handleProfileUpdate}
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        {/* Content View */}
        <main ref={mainScrollRef} className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-slate-100 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-6 pb-8">
            {currentUser.role === 'ADMIN' && (
              <>
                {activeModule === 'dashboard' && <AdminDashboard onNavigate={handleSelectModule} currentUser={currentUser} />}
                {activeModule === 'register_student' && <RegisterStudentModule />}
                {activeModule === 'announcements' && <AnnouncementsModule />}
                {activeModule === 'scholarship' && <ScholarshipModule />}
                {(activeModule === 'intervention' || activeModule === 'student_grievances' || activeModule === 'appointments') && (
                  <InterventionModule
                    currentUser={currentUser}
                    initialTab="resolutions"
                  />
                )}
                {(activeModule === 'refer_student_reports' || activeModule === 'safety_reports') && (
                  <SafetyReportsModule role="ADMIN" currentUser={currentUser} />
                )}
                {activeModule === 'dormitory' && <DormitoryModule />}
                {activeModule === 'student_records' && <StudentRecordsModule role="ADMIN" currentUser={currentUser} />}
                {activeModule === 'activity_logs' && <ActivityLogsModule />}
                {activeModule === 'settings' && (
                  <SettingsModule
                    role="ADMIN"
                    currentUser={currentUser}
                    onSwitchUser={(user) => setCurrentUser(user)}
                  />
                )}
              </>
            )}

            {currentUser.role === 'STUDENT' && (
              <>
                {activeModule === 'dashboard' && <StudentDashboard user={currentUser} />}
                {activeModule === 'scholarship' && <StudentScholarshipModule user={currentUser} />}
                {activeModule === 'dormitory' && <StudentDormitoryModule user={currentUser} />}
                {activeModule === 'safety_reports' && <EmergencyReportModule user={currentUser} />}
                {(activeModule === 'student_grievances' || activeModule === 'appointments') && <StudentAppointmentsModule user={currentUser} />}
                {activeModule === 'disciplinary' && <StudentDisciplinaryModule user={currentUser} />}
              </>
            )}

            {currentUser.role === 'GUIDANCE_ADMIN' && (
              <>
                {activeModule === 'dashboard' && (
                  <GuidanceDashboard onNavigate={handleSelectModule} currentUser={currentUser} />
                )}
                {activeModule === 'safety_reports' && (
                  <SafetyReportsModule
                    role="GUIDANCE_ADMIN"
                    currentUser={currentUser}
                    onCreateDisciplinaryAction={(report) => {
                      setPendingDisciplinaryReport(report);
                      setActiveModule('disciplinary');
                      sessionStorage.setItem('osas_active_module', 'disciplinary');
                    }}
                  />
                )}
                {(activeModule === 'student_grievances' || activeModule === 'appointments' || activeModule === 'intervention') && (
                  <InterventionModule
                    currentUser={currentUser}
                    initialTab={activeModule === 'intervention' ? 'intervention-records' : 'grievances'}
                  />
                )}
                {activeModule === 'disciplinary' && (
                  <DisciplinaryModule
                    sourceReport={pendingDisciplinaryReport}
                    onClearSourceReport={() => setPendingDisciplinaryReport(null)}
                  />
                )}
                {activeModule === 'student_records' && <StudentRecordsModule role="GUIDANCE_ADMIN" currentUser={currentUser} />}
                {activeModule === 'announcements' && (
                  <AnnouncementsModule defaultCategory="GUIDANCE" role="GUIDANCE_ADMIN" />
                )}
                {activeModule === 'settings' && (
                  <SettingsModule
                    role="GUIDANCE_ADMIN"
                    currentUser={currentUser}
                    onSwitchUser={(user) => setCurrentUser(user)}
                  />
                )}
              </>
            )}
          </div>
        </main>
        <BackToTopButton scrollContainerRef={mainScrollRef} />
      </div>
    </div>
  );
}

export default App;
