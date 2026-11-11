import React, { useState, useEffect } from 'react';
import { UserRole, User, SystemModule } from '../../types';
import { CollegeLogo } from './CollegeLogo';
import {
  getAllStudentReports,
  getDisciplinaryReports,
  getInterventionRecords,
  getAppointments,
} from '../../services/storage';
import {
  LayoutDashboard,
  ShieldAlert,
  UserPlus,
  Megaphone,
  Award,
  Calendar,
  AlertOctagon,
  HeartHandshake,
  Home,
  Users,
  Star,
  Activity,
  Settings,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

interface SidebarProps {
  role?: UserRole;
  user?: User;
  activeTab?: string;
  activeModule?: SystemModule | string;
  onSelectTab?: (tabId: string) => void;
  onSelectModule?: (module: any) => void;
  isCollapsed?: boolean;
  isOpen?: boolean;
  mobileOpen?: boolean;
  onToggleCollapse?: () => void;
  onToggle?: () => void;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  user,
  activeTab,
  activeModule,
  onSelectTab,
  onSelectModule,
  isCollapsed,
  isOpen,
  mobileOpen = false,
  onToggleCollapse,
  onToggle,
  onCloseMobile,
}) => {
  const currentRole = role || user?.role || 'STUDENT';
  const currentActive = activeModule || activeTab || 'dashboard';
  const collapsed = isCollapsed !== undefined ? isCollapsed : isOpen !== undefined ? !isOpen : false;

  const [pendingSafetyReportsCount, setPendingSafetyReportsCount] = useState<number>(0);
  const [referredStudentReportsCount, setReferredStudentReportsCount] = useState<number>(0);
  const [referredInterventionCount, setReferredInterventionCount] = useState<number>(0);
  const [pendingStudentConcernsCount, setPendingStudentConcernsCount] = useState<number>(0);

  useEffect(() => {
    const checkSidebarCounts = () => {
      try {
        // Guidance Student Reports: Count only active/unresolved student reports and unresolved resolutions
        const discReports = getDisciplinaryReports();
        const activeReportsAndUnresolvedResolutions = discReports.filter((r) => {
          if (!r || r.isArchived) return false;
          const statusStr = String(r.status || '').trim().toUpperCase();
          if (
            ['COMPLETED', 'RESOLVED', 'RESOLVED INCIDENT', 'SANCTION', 'SANCTIONED', 'DISMISSED', 'DISMISS INCIDENT', 'REJECTED'].includes(
              statusStr
            )
          ) {
            return false;
          }

          const hasSavedResolution = Boolean(
            r.resolvedAt && r.resolutionDetails && r.resolutionDetails.trim()
          );
          const hasOsasRemarks = Boolean(r.osasRemarks && r.osasRemarks.trim());

          if (hasSavedResolution) {
            if (r.isResolutionArchived) return false;
            // Once OSAS Administrator Remarks are saved, it automatically becomes Case Resolved
            if (hasOsasRemarks) return false;
            if (r.resolutionOutcome === 'RESOLVED') return false;
            return r.resolutionOutcome === 'UNRESOLVED' || statusStr === 'UNRESOLVED';
          }

          // Active/unresolved incoming or ongoing student report
          return true;
        }).length;
        setPendingSafetyReportsCount(activeReportsAndUnresolvedResolutions);

        const referredReports = discReports.filter(
          (r) => r && !r.isArchived && r.referredToOsas && !r.osasRemarks && r.status !== 'RESOLVED'
        ).length;
        setReferredStudentReportsCount(referredReports);

        const interventions = getInterventionRecords('ADMIN');
        const unreadReferredInterventions = interventions.filter(
          (rec) =>
            rec &&
            !rec.isArchived &&
            Boolean(
              rec.referredToOsas ||
                rec.osasReferralDate ||
                rec.osasReferralReason ||
                (rec.referredBy === 'Guidance Advocate' && rec.status === 'REFERRED')
            ) &&
            !rec.osasRemarks &&
            rec.status !== 'COMPLETED' &&
            rec.status !== 'RESOLVED'
        ).length;
        setReferredInterventionCount(unreadReferredInterventions);

        // Guidance Student Concerns: Count only pending/active concerns; do not count completed, resolved, rejected, or archived
        const guidanceConcerns = getAppointments('GUIDANCE_ADMIN');
        const activeStudentConcerns = guidanceConcerns.filter((a) => {
          if (!a || a.isArchived) return false;
          const st = String(a.status || 'PENDING').trim().toUpperCase();
          if (['COMPLETED', 'RESOLVED', 'REJECTED', 'CANCELLED', 'DONE_ADMIN', 'DONE_STUDENT'].includes(st)) {
            return false;
          }
          return (
            st === 'PENDING' ||
            st === 'REFERRED' ||
            st === 'REFERRED_TO_GUIDANCE' ||
            st === 'RESCHEDULED' ||
            st === 'UNDER_REVIEW'
          );
        }).length;
        setPendingStudentConcernsCount(activeStudentConcerns);
      } catch {
        setPendingSafetyReportsCount(0);
        setReferredStudentReportsCount(0);
        setReferredInterventionCount(0);
        setPendingStudentConcernsCount(0);
      }
    };
    checkSidebarCounts();

    window.addEventListener('osas_storage_updated', checkSidebarCounts);
    window.addEventListener('osas_notifications_updated', checkSidebarCounts);
    window.addEventListener('osas_appointments_updated', checkSidebarCounts);
    window.addEventListener('osas_reports_updated', checkSidebarCounts);
    window.addEventListener('storage', checkSidebarCounts);

    const intervalId = setInterval(checkSidebarCounts, 3000);

    return () => {
      window.removeEventListener('osas_storage_updated', checkSidebarCounts);
      window.removeEventListener('osas_notifications_updated', checkSidebarCounts);
      window.removeEventListener('osas_appointments_updated', checkSidebarCounts);
      window.removeEventListener('osas_reports_updated', checkSidebarCounts);
      window.removeEventListener('storage', checkSidebarCounts);
      clearInterval(intervalId);
    };
  }, []);

  const handleToggle = () => {
    if (onToggleCollapse) onToggleCollapse();
    if (onToggle) onToggle();
  };

  const handleSelect = (id: string) => {
    const normalized = id.replace(/-/g, '_');
    if (onSelectModule) onSelectModule(normalized);
    if (onSelectTab) onSelectTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: 'red' | 'blue';
    highlight?: boolean;
  }

  const adminNav: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'register_student', label: 'Register Student', icon: UserPlus },
    {
      id: 'refer_student_reports',
      label: 'Referred Student Reports',
      icon: ShieldAlert,
      badge: referredStudentReportsCount > 0 ? String(referredStudentReportsCount) : undefined,
      badgeColor: 'red',
    },
    {
      id: 'intervention',
      label: 'Intervention Resolution',
      icon: HeartHandshake,
      badge: referredInterventionCount > 0 ? String(referredInterventionCount) : undefined,
      badgeColor: 'blue',
    },
    { id: 'scholarship', label: 'Scholarships', icon: Award },
    { id: 'dormitory', label: 'Dormitory', icon: Home },
    { id: 'student_records', label: 'Student Records', icon: Users },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'activity_logs', label: 'Activity Log', icon: Activity },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  const studentNav: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scholarship', label: 'Scholarships', icon: Award },
    { id: 'dormitory', label: 'Dormitory', icon: Home },
    { id: 'safety_reports', label: 'Submit Reports', icon: ShieldAlert },
    { id: 'student_grievances', label: 'Submit Concerns', icon: Calendar },
    { id: 'disciplinary', label: 'Disciplinary Records', icon: AlertOctagon },
  ];

  const guidanceNav: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'safety_reports',
      label: 'Student Reports',
      icon: ShieldAlert,
      badge: pendingSafetyReportsCount > 0 ? String(pendingSafetyReportsCount) : undefined,
      badgeColor: 'red',
    },
    {
      id: 'student_grievances',
      label: 'Student Concerns',
      icon: Calendar,
      badge: pendingStudentConcernsCount > 0 ? String(pendingStudentConcernsCount) : undefined,
      badgeColor: 'blue',
    },
    { id: 'disciplinary', label: 'Disciplinary Records', icon: AlertOctagon },
    { id: 'student_records', label: 'Student Records', icon: Users },
    { id: 'announcements', label: 'Guidance Announcements', icon: Megaphone },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  const navItems: NavItem[] =
    currentRole === 'ADMIN'
      ? adminNav
      : currentRole === 'GUIDANCE_ADMIN'
      ? guidanceNav
      : studentNav;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-45 sm:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Main Sidebar (Desktop Sticky + Mobile Fixed Slide-Over) */}
      <aside
        className={`bg-slate-900 text-slate-300 h-screen flex flex-col transition-all duration-300 shrink-0 z-50 border-r border-slate-800 ${
          /* Desktop layout */
          'sm:sticky sm:top-0 ' + (collapsed ? 'sm:w-16' : 'sm:w-64') + ' ' +
          /* Mobile layout */
          'fixed inset-y-0 left-0 w-64 ' + (mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full sm:translate-x-0')
        }`}
      >
        {/* College Logo & Portal Header */}
        <div className="h-16 px-3.5 bg-gradient-to-r from-blue-800 to-indigo-900 text-white font-bold flex items-center justify-between border-b border-blue-900/80 shrink-0">
          {(!collapsed || mobileOpen) && (
            <div className="flex items-center gap-2.5 truncate">
              <CollegeLogo size="md" />
              <div className="truncate">
                <h2 className="text-xs font-black text-white tracking-wider uppercase flex items-center gap-1">
                  STU-SERVE PORTAL
                </h2>
                <p className="text-[10px] text-blue-200 font-semibold truncate">
                  Dingalan Community College
                </p>
              </div>
            </div>
          )}
          {collapsed && !mobileOpen && (
            <div className="mx-auto flex items-center justify-center">
              <CollegeLogo size="md" />
            </div>
          )}

          {/* Desktop Toggle Button */}
          <button
            onClick={handleToggle}
            className="p-1.5 rounded-lg bg-blue-800/60 hover:bg-blue-800 text-blue-100 hover:text-white transition-colors hidden sm:flex items-center justify-center cursor-pointer"
            title={collapsed ? 'Expand Menu' : 'Collapse Menu'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg bg-blue-800/60 hover:bg-blue-800 text-white sm:hidden flex items-center justify-center cursor-pointer"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto custom-scrollbar space-y-1 text-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentActive === item.id ||
              currentActive === item.id.replace(/-/g, '_') ||
              currentActive === item.id.replace(/_/g, '-') ||
              (currentRole === 'ADMIN' && item.id === 'intervention' && (currentActive === 'student_grievances' || currentActive === 'appointments'));
            const showLabel = !collapsed || mobileOpen;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-white/10 text-white border-l-4 border-white font-bold'
                    : item.highlight
                    ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
                title={!showLabel ? item.label : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-white' : item.highlight ? 'text-red-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {showLabel && (
                  <span className="truncate text-left flex-1">{item.label}</span>
                )}
                {showLabel && item.badge && (
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-bold ${
                      item.badgeColor === 'blue' ? 'bg-blue-600' : 'bg-red-600'
                    } text-white rounded-md uppercase tracking-wider`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Branding */}
        {(!collapsed || mobileOpen) && (
          <div className="p-4 border-t border-slate-800/80 text-[10px] uppercase tracking-widest text-slate-400/70 text-center">
            Office of Student Affairs v1.0
          </div>
        )}
      </aside>
    </>
  );
};

