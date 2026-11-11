import React, { useState, useRef, useEffect } from 'react';
import { User } from '../../types';
import { Bell, MessageSquareQuote, UserCircle, LogOut, ChevronDown, ShieldCheck, GraduationCap, Menu, Sun, Moon, HeartHandshake, Shield } from 'lucide-react';
import { getNotifications, getSystemLogo } from '../../services/storage';
import { ConfirmModal } from './ConfirmModal';
import { DataPrivacyAndCookieModal } from './DataPrivacyAndCookieModal';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenNotifications?: () => void;
  onOpenFeedbackModal?: () => void;
  onOpenChangeProfile?: () => void;
  activeModuleTitle?: string;
  activeModule?: string;
  onSelectModule?: (module: any) => void;
  onUpdateUser?: (user: User) => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenNotifications,
  onOpenFeedbackModal,
  onOpenChangeProfile,
  activeModuleTitle = 'Dashboard',
  activeModule,
  onSelectModule,
  onUpdateUser,
  onToggleSidebar,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('osas_theme') === 'dark';
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [systemLogo, setSystemLogoState] = useState<string>(() => getSystemLogo());
  const [notifications, setNotifications] = useState(() =>
    getNotifications(user.studentId || user.id, user.role, user.fullName, user.id)
  );

  useEffect(() => {
    const handleUpdate = () => {
      setSystemLogoState(getSystemLogo());
      setNotifications(getNotifications(user.studentId || user.id, user.role, user.fullName, user.id));
    };
    window.addEventListener('osas_storage_updated', handleUpdate);
    window.addEventListener('osas_notifications_updated', handleUpdate);
    window.addEventListener('osas_logo_updated', handleUpdate);
    return () => {
      window.removeEventListener('osas_storage_updated', handleUpdate);
      window.removeEventListener('osas_notifications_updated', handleUpdate);
      window.removeEventListener('osas_logo_updated', handleUpdate);
    };
  }, [user.studentId, user.id, user.role, user.fullName]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('osas_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('osas_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleNotificationsClick = () => {
    if (onOpenNotifications) {
      onOpenNotifications();
    } else if (onSelectModule) {
      onSelectModule('activity_logs');
    }
  };

  const handleChangeProfileClick = () => {
    if (onOpenChangeProfile) {
      onOpenChangeProfile();
    } else if (onSelectModule) {
      onSelectModule('settings');
    }
  };

  const handleFeedbackClick = () => {
    if (onOpenFeedbackModal) {
      onOpenFeedbackModal();
    } else if (onSelectModule) {
      onSelectModule('submit_feedback');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayModuleTitle = () => {
    if (activeModuleTitle && activeModuleTitle !== 'Dashboard') return activeModuleTitle;
    switch (activeModule) {
      case 'dashboard':
        return 'Dashboard';
      case 'safety_reports':
        return user.role === 'STUDENT' ? 'Submit Reports' : 'Student Reports';
      case 'register_student':
        return 'Register Student';
      case 'announcements':
        return 'Announcements';
      case 'scholarship':
        return user.role === 'STUDENT' ? 'Scholarships' : 'Scholarship';
      case 'appointments':
      case 'student_grievances':
        return user.role === 'STUDENT'
          ? 'Submit Concerns'
          : user.role === 'GUIDANCE_ADMIN'
          ? 'Student Concerns'
          : 'Student Concerns';
      case 'disciplinary':
        return 'Disciplinary Records';
      case 'referred_disciplinary':
        return 'Intervention Resolution';
      case 'refer_student_reports':
        return 'Referred Student Reports';
      case 'intervention':
        return user.role === 'ADMIN' ? 'Intervention Resolution' : 'Intervention';
      case 'dormitory':
        return 'Dormitory';
      case 'student_records':
        return 'Student Records';
      case 'activity_logs':
        return 'Activity Logs';
      case 'settings':
        return 'System Settings';
      default:
        return activeModuleTitle || 'Dashboard';
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Logout Confirmation"
        message="Are you sure you want to log out of your OSAS Account?"
        confirmText="Yes, Log Out"
        cancelText="Cancel"
        type="danger"
        icon="logout"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
        onClose={() => setShowLogoutConfirm(false)}
      />

      {/* Mobile Menu Toggle & Title & Role Badge */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg sm:hidden focus:outline-none cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img
            src={systemLogo}
            alt="DCC Logo"
            className="w-8 h-8 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/dcc_logo.svg';
            }}
          />
          <h1 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white tracking-tight hidden sm:block">
            {getDisplayModuleTitle()} Overview
          </h1>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide truncate max-w-[160px] sm:max-w-none ${
            user.role === 'ADMIN'
              ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
              : user.role === 'GUIDANCE_ADMIN'
              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
          }`}
        >
          {user.role === 'ADMIN' ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5" /> OSAS Administrator
            </>
          ) : user.role === 'GUIDANCE_ADMIN' ? (
            <>
              <HeartHandshake className="w-3.5 h-3.5" /> Guidance Advocate
            </>
          ) : (
            <>
              <GraduationCap className="w-3.5 h-3.5" /> Student Portal
            </>
          )}
        </span>
      </div>

      {/* Right Controls: Notification Button + User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notification Bell Button */}
        <button
          onClick={handleNotificationsClick}
          className="relative flex items-center p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors focus:outline-none cursor-pointer border border-slate-200 dark:border-slate-700"
          title="Notifications"
          aria-label="Open Notifications"
        >
          <Bell className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-md animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </button>

        {/* Profile Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer relative"
          >
            <div className="relative w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-blue-600 dark:border-blue-400 flex items-center justify-center overflow-hidden shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-blue-600 dark:text-blue-300 font-bold text-xs">
                  {user.fullName ? user.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'JD'}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 hidden md:inline flex items-center gap-1.5">
                {user.role === 'ADMIN' ? 'Admin ' : user.role === 'GUIDANCE_ADMIN' ? 'Guidance ' : ''}{user.fullName}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 md:hidden">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{user.fullName}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>

              {/* Change Profile Option */}
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  handleChangeProfileClick();
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <UserCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Change Profile
              </button>

              {/* Dark Mode Option embedded below Change Profile */}
              <button
                onClick={toggleDarkMode}
                className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  )}
                  <span>Dark Mode</span>
                </div>
                <div
                  className={`w-8 h-4 rounded-full p-0.5 transition-colors ${
                    isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      isDarkMode ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />

              {/* Logout Option */}
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  setShowLogoutConfirm(true);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-500" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Data Privacy & Cookie Policy Modal */}
      {showPrivacyPolicyModal && (
        <DataPrivacyAndCookieModal
          isOpen={showPrivacyPolicyModal}
          onClose={() => setShowPrivacyPolicyModal(false)}
        />
      )}
    </header>
  );
};
