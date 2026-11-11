import React, { useState, useEffect } from 'react';
import {
  getArchiveItems,
  restoreArchiveItem,
  purgeArchiveItem,
  getSystemLogo,
  setSystemLogo,
} from '../../services/storage';
import { User } from '../../types';
import {
  ArchiveTimeFilter,
  OSAS_ARCHIVE_CATEGORIES,
  filterArchiveItemsByCategoryAndTime,
} from '../../utils/archiveUtils';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { CollegeLogo } from '../common/CollegeLogo';
import {
  Archive,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';

interface SettingsModuleProps {
  role?: 'ADMIN' | 'GUIDANCE_ADMIN';
  currentUser?: User;
  onSwitchUser?: (user: User) => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ role, currentUser }) => {
  const isGuidance = role === 'GUIDANCE_ADMIN' || currentUser?.role === 'GUIDANCE_ADMIN';
  const [activeTab, setActiveTab] = useState<'LOGO' | 'ARCHIVE'>(isGuidance ? 'ARCHIVE' : 'LOGO');

  // Change Logo State
  const [logoPreview, setLogoPreview] = useState<string>(() => getSystemLogo());
  const [logoSuccessMsg, setLogoSuccessMsg] = useState('');

  // Archive State
  const [archiveItems, setArchiveItems] = useState(getArchiveItems());
  const [archiveFilter, setArchiveFilter] = useState<string>('ALL');
  const [archiveTimeFilter, setArchiveTimeFilter] = useState<ArchiveTimeFilter>('ALL');
  const [purgingItemId, setPurgingItemId] = useState<string | null>(null);
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);

  useEffect(() => {
    if (isGuidance) {
      setActiveTab('ARCHIVE');
    }
  }, [isGuidance]);

  useEffect(() => {
    const handleUpdate = () => {
      setArchiveItems(getArchiveItems());
      setLogoPreview(getSystemLogo());
    };
    window.addEventListener('osas_storage_updated', handleUpdate);
    return () => window.removeEventListener('osas_storage_updated', handleUpdate);
  }, []);

  const getArchiveMetadata = (type: string) => {
    switch (type) {
      case 'DISCIPLINARY_REPORT':
        return {
          label: 'Student Incident Report',
          targetModule: 'Disciplinary Module ➔ Student Incident Reports',
          badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-900',
        };
      case 'DISCIPLINARY':
        return {
          label: isGuidance ? 'Official Disciplinary Records' : 'Official Disciplinary Record',
          targetModule: 'Disciplinary Module ➔ Official Records',
          badgeColor: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900',
        };
      case 'INTERVENTION':
        return {
          label: isGuidance ? 'Student Concerns Resolutions' : 'Intervention Resolutions',
          targetModule: isGuidance ? 'Student Concerns ➔ Resolutions' : 'Intervention Module',
          badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
        };
      case 'RESOLUTION':
        return {
          label: isGuidance ? 'Resolution Report' : 'Guidance Resolutions',
          targetModule: 'Student Reports ➔ Resolutions',
          badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900',
        };
      case 'SAFETY_REPORT':
        return {
          label: 'Safety Incident Report',
          targetModule: 'Reports/Concerns Module',
          badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900',
        };
      case 'STUDENT_RECORD':
      case 'USER':
        return {
          label: isGuidance ? 'Student Records Archive' : 'Student Records',
          targetModule: 'Student Records Module',
          badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900',
        };
      case 'REJECTED_SCHOLARSHIP_APPLICATION':
      case 'SCHOLARSHIP_APPLICATION':
        return {
          label: 'Rejected Scholarship Applications',
          targetModule: 'Scholarship Module ➔ Applications',
          badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-900',
        };
      case 'SCHOLARSHIP':
        return {
          label: 'Scholarship Grants',
          targetModule: 'Scholarship Module ➔ Programs',
          badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
        };
      case 'DORM_APPLICANT':
      case 'REJECTED_DORM_APPLICANT':
        return {
          label: 'Rejected Dormitory Applicants',
          targetModule: 'Dormitory Module ➔ Applications',
          badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-900',
        };
      case 'DORM_RESIDENT':
        return {
          label: 'Rejected Dormitory Applicants',
          targetModule: 'Dormitory Module ➔ Rooms & Residents',
          badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900',
        };
      case 'DORM_ROOM':
        return {
          label: 'Dormitory Rooms',
          targetModule: 'Dormitory Module ➔ Room Management',
          badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
        };
      case 'ANNOUNCEMENT':
        return {
          label: isGuidance ? 'Archived Announcements' : 'Announcements',
          targetModule: 'Announcements Module',
          badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-900',
        };
      case 'APPOINTMENT':
      case 'STUDENT_CONCERN':
      case 'STUDENT_CONCERNS':
        return {
          label: isGuidance ? 'Student Concerns' : 'Appointment',
          targetModule: isGuidance ? 'Student Concerns ➔ Student Concerns' : 'Appointments Module',
          badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-200 dark:border-orange-900',
        };
      case 'EXPIRED_APPOINTMENT':
        return {
          label: isGuidance ? 'Student Concerns' : 'Expired Completed Appointment',
          targetModule: isGuidance ? 'Student Concerns ➔ Student Concerns' : 'Appointments Module',
          badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-900',
        };
      case 'TRANSACTION_RATING':
        return {
          label: 'Transaction Rating',
          targetModule: 'Transaction Ratings & Analytics',
          badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900',
        };
      case 'EVALUATION_FEEDBACK':
        return {
          label: 'Evaluation / Feedback',
          targetModule: 'Evaluation & Feedback Analytics',
          badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
        };
      case 'DORM_REPORT':
        return {
          label: 'Dormitory Reports',
          targetModule: 'Dormitory Module ➔ Maintenance Reports',
          badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900',
        };
      default:
        return {
          label: type.replace(/_/g, ' '),
          targetModule: 'Designated System Module',
          badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  const guidanceAllowedTypes = new Set([
    'RESOLUTION',
    'APPOINTMENT',
    'EXPIRED_APPOINTMENT',
    'STUDENT_CONCERN',
    'STUDENT_CONCERNS',
    'INTERVENTION',
    'DISCIPLINARY',
    'STUDENT_RECORD',
    'USER',
    'ANNOUNCEMENT',
  ]);

  const osasAllowedTypes = new Set<string>(
    OSAS_ARCHIVE_CATEGORIES.flatMap((c) => [...c.types])
  );

  const roleScopedArchiveItems = isGuidance
    ? archiveItems.filter((item) => guidanceAllowedTypes.has(String(item.type || '')))
    : archiveItems.filter((item) => osasAllowedTypes.has(String(item.type || '')));

  const filteredArchiveItems = filterArchiveItemsByCategoryAndTime(
    roleScopedArchiveItems,
    archiveFilter,
    archiveTimeFilter
  );

  const itemToRestore = archiveItems.find((i) => i.id === restoringItemId);
  const restoreMeta = itemToRestore ? getArchiveMetadata(itemToRestore.type) : null;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 250;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const compressedBase64 = canvas.toDataURL('image/png', 0.9);

        setLogoPreview(compressedBase64);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = () => {
    try {
      setSystemLogo(logoPreview);
      setLogoSuccessMsg('✅ System logo updated successfully! Changes applied across Login Form, Header, and Side Menu.');
    } catch (err) {
      alert('Error saving logo to storage. Please try a smaller image.');
    }
  };

  const handleRestore = (id: string) => {
    setRestoringItemId(id);
  };

  const handlePurge = (id: string) => {
    setPurgingItemId(id);
  };

  return (
    <div className="space-y-6">
      {/* Settings Navigation Bar */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 shadow-2xs overflow-x-auto max-w-full whitespace-nowrap scrollbar-none">
        {!isGuidance && (
          <button
            onClick={() => setActiveTab('LOGO')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'LOGO'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" /> Change System Logo
          </button>
        )}
        <button
          onClick={() => setActiveTab('ARCHIVE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'ARCHIVE' || isGuidance
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Archive className="w-4 h-4" /> System Archive Vault ({roleScopedArchiveItems.length})
        </button>
      </div>

      {!isGuidance && activeTab === 'LOGO' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" /> Change System Logo
              </h3>
              <p className="text-[11px] text-slate-500">Upload a custom logo image to update the login screen branding and side menu header.</p>
            </div>
          </div>

          {logoSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p>{logoSuccessMsg}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Live Logo Preview Box */}
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center text-center space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-950 px-2.5 py-1 rounded-full border border-blue-800">
                Live Sidebar / Login Preview
              </span>
              <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/60 shadow-inner flex flex-col items-center">
                <img
                  src={logoPreview}
                  alt="System Logo Preview"
                  className="w-24 h-24 object-contain rounded-lg drop-shadow-md transition-transform hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/dcc_logo.svg';
                  }}
                />
                <h4 className="text-xs font-black text-white mt-3 uppercase tracking-wider">Dingalan Community College</h4>
                <p className="text-[10px] text-blue-300 font-semibold">Office of Student Affairs & Services</p>
              </div>
            </div>

            {/* Upload Controls */}
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-800 mb-1">Upload New Logo Image *</label>
              <p className="text-[11px] text-slate-500 mb-2">Recommended: PNG or SVG with transparent background (Max 2MB).</p>

              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                  id="system-logo-upload"
                />
                <label
                  htmlFor="system-logo-upload"
                  className="w-full py-3 px-4 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-xs font-bold text-blue-700"
                >
                  <Upload className="w-4 h-4" /> Select & Upload Image File
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleSaveLogo}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Apply System Logo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'ARCHIVE' || isGuidance) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">System Archive Vault</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Deleted records, reports, announcements, and applications retained for accurate recovery</p>
            </div>

            {/* Time Period & Category Filter Dropdowns */}
            <div className="grid grid-cols-2 sm:flex sm:flex-row items-end sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                <label className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">Period:</label>
                <select
                  value={archiveTimeFilter}
                  onChange={(e) => setArchiveTimeFilter(e.target.value as ArchiveTimeFilter)}
                  className="w-full sm:w-36 h-9 sm:h-10 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="ALL">All Time</option>
                  <option value="WEEK">Week</option>
                  <option value="MONTH">Month</option>
                  <option value="YEAR">Year</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                <label className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">Filter Category:</label>
                <select
                  value={archiveFilter}
                  onChange={(e) => setArchiveFilter(e.target.value)}
                  className="w-full sm:w-64 h-9 sm:h-10 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none truncate"
                >
                  <option value="ALL">All Archived Categories ({roleScopedArchiveItems.length})</option>
                  {isGuidance ? (
                    <>
                      <option value="RESOLUTION">Resolution Report</option>
                      <option value="STUDENT_CONCERNS">Student Concerns</option>
                      <option value="INTERVENTION">Student Concerns Resolutions</option>
                      <option value="DISCIPLINARY">Official Disciplinary Records</option>
                      <option value="STUDENT_RECORD">Student Records Archive</option>
                      <option value="ANNOUNCEMENT">Archived Announcements</option>
                    </>
                  ) : (
                    OSAS_ARCHIVE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {filteredArchiveItems.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-10">Archive vault is empty or no items match category filter.</p>
          ) : (
            <div className="space-y-3">
              {filteredArchiveItems.map((item, idx) => {
                const meta = getArchiveMetadata(item.type);
                const itemKey = item.id ? `${item.id}-${idx}` : `arch-item-${idx}`;
                const isStudentConcernItem =
                  item.type === 'APPOINTMENT' ||
                  item.type === 'EXPIRED_APPOINTMENT' ||
                  (item.type as string) === 'STUDENT_CONCERN' ||
                  (item.type as string) === 'STUDENT_CONCERNS';
                const concernArchiveReason =
                  isStudentConcernItem && item.data?.archiveReason
                    ? String(item.data.archiveReason).trim()
                    : '';

                return (
                  <div key={itemKey} className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 overflow-hidden">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase shrink-0 ${meta.badgeColor}`}>
                          {meta.label}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{item.title}</h4>
                      </div>
                      {concernArchiveReason && (
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-orange-200 dark:border-orange-800/60 text-xs">
                          <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider block">
                            Reason for Archive
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 font-medium mt-0.5 whitespace-pre-line">
                            {concernArchiveReason}
                          </p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>Archived: {new Date(item.deletedAt).toLocaleString()}</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Restores to: {meta.targetModule}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => handleRestore(item.id)}
                        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Restore Item
                      </button>
                      <button
                        onClick={() => handlePurge(item.id)}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900 text-red-700 dark:text-red-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Purge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Permanent Delete / Purge */}
      <ConfirmModal
        isOpen={!!purgingItemId}
        title="Permanent Delete Confirmation"
        message="Are you sure you want to delete this? Kapag pinili ang Yes, permanenteng mawawala ang item sa buong system at hindi na maibabalik."
        confirmText="Yes"
        cancelText="No"
        type="danger"
        onConfirm={() => {
          if (purgingItemId) {
            purgeArchiveItem(purgingItemId, 'Princess Ann T. Ruzol (Admin)');
            setArchiveItems(getArchiveItems());
            setPurgingItemId(null);
          }
        }}
        onClose={() => setPurgingItemId(null)}
      />

      {/* Confirmation Modal for Restore Item */}
      <ConfirmModal
        isOpen={!!restoringItemId}
        title="Restore Item Confirmation"
        message={
          itemToRestore && restoreMeta
            ? `Are you sure you want to restore "${itemToRestore.title}"? Ibabalik ito sa: ${restoreMeta.targetModule}.`
            : 'Are you sure you want to restore this item? Ibabalik ito sa designated module nito.'
        }
        confirmText="Yes"
        cancelText="No"
        type="info"
        onConfirm={() => {
          if (restoringItemId) {
            restoreArchiveItem(restoringItemId, 'Princess Ann T. Ruzol (Admin)');
            setArchiveItems(getArchiveItems());
            setRestoringItemId(null);
          }
        }}
        onClose={() => setRestoringItemId(null)}
      />
    </div>
  );
};

