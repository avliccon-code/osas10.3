import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getScholarships,
  addScholarship,
  updateScholarship,
  getScholarshipApplications,
  updateScholarshipAppStatus,
  updateScholarshipStatus,
  deleteScholarship,
  archiveRejectedScholarshipApp,
} from '../../services/storage';
import { Scholarship, ScholarshipStatus, ApplicationStatus, ScholarshipApplication } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { CollegeLogo } from '../common/CollegeLogo';
import {
  Award,
  Plus,
  Check,
  X,
  Clock,
  Search,
  Printer,
  BarChart2,
  Power,
  Archive,
  Eye,
  FileText,
  Image as ImageIcon,
  Download,
  Upload,
  Edit3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Users,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const ScholarshipModule: React.FC = () => {
  const [scholarships, setScholarships] = useState(getScholarships());
  const [applications, setApplications] = useState(getScholarshipApplications());

  const refreshData = () => {
    setScholarships(getScholarships());
    setApplications(getScholarshipApplications());
  };

  useEffect(() => {
    const handleUpdate = () => {
      refreshData();
    };
    window.addEventListener('osas_storage_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('osas_storage_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Main active tab: Student Applications or Available Scholarship Programs
  const [activeTab, setActiveTab] = useState<'APPLICATIONS' | 'PROGRAMS'>('APPLICATIONS');

  // Add Program Modal State
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0]
  );
  const [amount, setAmount] = useState('');
  const [maxSlots, setMaxSlots] = useState<string | number>('');
  const [status, setStatus] = useState<ScholarshipStatus>('ACTIVE');

  // Edit Program Modal State
  const [editingScholarship, setEditingScholarship] = useState<Scholarship | null>(null);

  // Selected Scholarship for View Details Modal
  const [selectedScholarship, setSelectedScholarship] = useState<Scholarship | null>(null);

  // Printable Scholarship Slip Modal
  const [printScholarship, setPrintScholarship] = useState<Scholarship | null>(null);

  const handleDirectPrintScholarship = (sch: Scholarship) => {
    setPrintScholarship(sch);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintScholarship(null), 500);
    }, 50);
  };

  // Student Applications Filter & Search
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState<'ALL' | 'PENDING' | 'REJECTED' | 'ACCEPTED'>('ALL');

  // Programs Filter & Search
  const [progSearchQuery, setProgSearchQuery] = useState('');
  const [progStatusFilter, setProgStatusFilter] = useState<string>('ALL');

  // File Viewer / Review Modal State
  const [viewingFileModal, setViewingFileModal] = useState<{
    fileName: string;
    studentName: string;
    studentId: string;
    studentEmail?: string;
    scholarshipTitle: string;
    attachmentUrl?: string;
    attachmentName?: string;
    applicationId?: string;
    applicationStatus?: ApplicationStatus;
    attachmentsList?: Array<{ name: string; url: string; size?: number; type?: string }>;
    activeAttachmentIndex?: number;
  } | null>(null);

  const [imageZoom, setImageZoom] = useState<number>(1);

  // Confirmation Modal
  const [confirmModalData, setConfirmModalData] = useState<{
    isOpen: boolean;
    type: 'REJECT' | 'DELETE_GRANT' | 'ARCHIVE_REJECTED_APP';
    id: string;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'REJECT',
    id: '',
    title: '',
    message: '',
  });

  const isImageFile = (url?: string, name?: string) => {
    if (!url && !name) return false;
    if (url?.startsWith('data:image/')) return true;
    if (url && /\.(jpe?g|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url)) return true;
    if (name && /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(name)) return true;
    return false;
  };

  const openApplicantFileViewer = (
    app: ScholarshipApplication,
    targetAttachmentIndex: number = 0
  ) => {
    setImageZoom(1);

    const attachments =
      app.attachments && app.attachments.length > 0
        ? app.attachments
        : app.attachmentUrl
        ? [{ name: app.attachmentName || `Scholarship_Application_${app.studentId}.pdf`, url: app.attachmentUrl }]
        : [{ name: `Scholarship_Application_${app.studentId}.pdf`, url: '' }];

    const safeIndex = Math.min(Math.max(0, targetAttachmentIndex), attachments.length - 1);
    const currentAtt = attachments[safeIndex];

    setViewingFileModal({
      fileName: currentAtt?.name || app.attachmentName || `Scholarship_Application_${app.studentId}.pdf`,
      studentName: app.studentName,
      studentId: app.studentId,
      studentEmail: app.studentEmail,
      scholarshipTitle: app.scholarshipTitle,
      attachmentUrl: currentAtt?.url || app.attachmentUrl,
      attachmentName: currentAtt?.name || app.attachmentName,
      applicationId: app.id,
      applicationStatus: app.status,
      attachmentsList: attachments,
      activeAttachmentIndex: safeIndex,
    });
  };

  const handleCreateProgram = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSlots = maxSlots ? Number(maxSlots) : 0;
    addScholarship(
      {
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
        deadline,
        amount: amount.trim(),
        imageUrl: imageUrl.trim() || undefined,
        status,
        maxSlots: parsedSlots > 0 ? parsedSlots : 0,
      },
      'Princess Ann T. Ruzol (Admin)'
    );

    setTitle('');
    setDescription('');
    setRequirements('');
    setImageUrl('');
    setAmount('');
    setMaxSlots('');
    setStatus('ACTIVE');
    setIsAddProgramOpen(false);
    refreshData();
  };

  const handleStartEdit = (sch: Scholarship) => {
    setEditingScholarship({
      ...sch,
      amount: sch.amount || (sch.grantAmount ? `₱${sch.grantAmount.toLocaleString()}` : ''),
      maxSlots: sch.maxSlots && sch.maxSlots > 0 ? sch.maxSlots : '',
      imageUrl: sch.imageUrl || '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScholarship) return;

    const trimmedTitle = editingScholarship.title.trim();
    if (!trimmedTitle) {
      alert('Pakilagay ang Scholarship Title.');
      return;
    }

    const trimmedDesc = editingScholarship.description.trim();
    if (!trimmedDesc) {
      alert('Pakilagay ang Description.');
      return;
    }

    const trimmedReqs = editingScholarship.requirements.trim();
    if (!trimmedReqs) {
      alert('Pakilagay ang Requirements Checklist.');
      return;
    }

    if (!editingScholarship.deadline) {
      alert('Pakilagay ang Application Deadline.');
      return;
    }

    const parsedSlots = editingScholarship.maxSlots ? Number(editingScholarship.maxSlots) : 0;
    const cleanAmount = (editingScholarship.amount || '').trim();

    const updatedData: Scholarship = {
      ...editingScholarship,
      title: trimmedTitle,
      description: trimmedDesc,
      requirements: trimmedReqs,
      deadline: editingScholarship.deadline,
      amount: cleanAmount || undefined,
      maxSlots: parsedSlots > 0 ? parsedSlots : 0,
      status: editingScholarship.status,
      imageUrl: editingScholarship.imageUrl?.trim() || undefined,
    };

    updateScholarship(updatedData, 'Princess Ann T. Ruzol (Admin)');
    setEditingScholarship(null);
    if (selectedScholarship && selectedScholarship.id === updatedData.id) {
      setSelectedScholarship(updatedData);
    }
    refreshData();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingScholarship((prev) => (prev ? { ...prev, imageUrl: reader.result as string } : null));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAppReview = (appId: string, newStatus: ApplicationStatus) => {
    if (newStatus === 'REJECTED') {
      const app = applications.find((a) => a.id === appId);
      setConfirmModalData({
        isOpen: true,
        type: 'REJECT',
        id: appId,
        title: 'Confirm Applicant Rejection',
        message: `Sigurado ka ba na gusto mong i-reject ang scholarship application ni ${app?.studentName || 'estudyante'}?`,
      });
      return;
    }

    if (newStatus === 'ACCEPTED') {
      const targetApp = applications.find((a) => a.id === appId);
      if (targetApp) {
        const sch = scholarships.find((s) => s.id === targetApp.scholarshipId);
        if (sch && sch.maxSlots && Number(sch.maxSlots) > 0) {
          const approvedCount = applications.filter(
            (a) => a.scholarshipId === sch.id && a.status === 'ACCEPTED'
          ).length;
          if (approvedCount >= Number(sch.maxSlots)) {
            alert(`Nakaabot na sa maximum slots capacity ang "${sch.title}" (${approvedCount}/${sch.maxSlots} Slots). Hindi na maaaring mag-approve ng karagdagang scholars.`);
            return;
          }
        }
      }
    }

    updateScholarshipAppStatus(appId, newStatus, 'Reviewed by OSAS Admin', 'Princess Ann T. Ruzol (Admin)');
    refreshData();
  };

  const executeConfirmAction = () => {
    if (confirmModalData.type === 'REJECT') {
      updateScholarshipAppStatus(confirmModalData.id, 'REJECTED', 'Rejected by OSAS Admin', 'Princess Ann T. Ruzol (Admin)');
    } else if (confirmModalData.type === 'DELETE_GRANT') {
      deleteScholarship(confirmModalData.id, 'Princess Ann T. Ruzol (Admin)');
    } else if (confirmModalData.type === 'ARCHIVE_REJECTED_APP') {
      archiveRejectedScholarshipApp(confirmModalData.id, 'Princess Ann T. Ruzol (Admin)');
    }
    setConfirmModalData({ ...confirmModalData, isOpen: false });
    refreshData();
  };

  const handleToggleProgramStatus = (id: string, currentStatus: ScholarshipStatus) => {
    const nextStatus: ScholarshipStatus = currentStatus === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
    updateScholarshipStatus(id, nextStatus, 'Princess Ann T. Ruzol (Admin)');
    refreshData();
  };

  // Filtered Applications
  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.studentName.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
      app.studentId.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
      app.studentEmail.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
      app.scholarshipTitle.toLowerCase().includes(appSearchQuery.toLowerCase());

    const matchesStatus =
      appStatusFilter === 'ALL'
        ? true
        : appStatusFilter === 'PENDING'
        ? app.status === 'PENDING'
        : appStatusFilter === 'REJECTED'
        ? app.status === 'REJECTED'
        : app.status === 'ACCEPTED';

    return matchesSearch && matchesStatus;
  });

  // Filtered Programs
  const filteredScholarships = scholarships.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(progSearchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(progSearchQuery.toLowerCase()) ||
      (s.amount && s.amount.toLowerCase().includes(progSearchQuery.toLowerCase()));
    const matchesStatus = progStatusFilter === 'ALL' || s.status === progStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingAppsCount = applications.filter((a) => a.status === 'PENDING').length;
  const rejectedAppsCount = applications.filter((a) => a.status === 'REJECTED').length;
  const acceptedAppsCount = applications.filter((a) => a.status === 'ACCEPTED').length;

  return (
    <div className="space-y-6">
      {/* Top Banner Section */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 dark:from-amber-700 dark:via-amber-800 dark:to-yellow-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-amber-400/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="p-3.5 sm:p-4 bg-white/20 dark:bg-white/10 backdrop-blur-md rounded-2xl ring-2 ring-white/30 shadow-md shrink-0">
            <Award className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-xs">
              Scholarship and Financial Aid Management
            </h1>
            <p className="text-xs sm:text-sm text-amber-100 dark:text-amber-200 mt-1 max-w-2xl font-medium leading-relaxed">
              Manage academic scholarship grants, student applications, requirements verification, slot capacities, and beneficiary rosters.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddProgramOpen(true)}
          className="w-full md:w-auto px-5 py-3 bg-white hover:bg-amber-50 dark:bg-slate-900/90 dark:hover:bg-slate-900 text-amber-900 dark:text-white font-black text-xs sm:text-sm rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 border border-white/60 dark:border-slate-700 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 text-amber-700 dark:text-white font-extrabold" />
          <span className="dark:text-white">Add Program</span>
        </button>
      </div>

      {/* Navigation Tabs Bar (Matched to Dormitory & Settings layout) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs">
        <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('APPLICATIONS')}
            className={`w-full sm:w-auto px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer text-center ${
              activeTab === 'APPLICATIONS'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="sm:hidden whitespace-nowrap">Applications</span>
            <span className="hidden sm:inline whitespace-nowrap">Student Applications</span>
            {pendingAppsCount > 0 && (
              <span className={`px-1.5 sm:px-2 py-0.5 text-[10px] font-black rounded-full ${
                activeTab === 'APPLICATIONS' ? 'bg-white text-amber-800' : 'bg-amber-100 dark:bg-yellow-400/30 text-amber-800 dark:text-yellow-200'
              }`}>
                {pendingAppsCount} Pending
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROGRAMS')}
            className={`w-full sm:w-auto px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer text-center ${
              activeTab === 'PROGRAMS'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="sm:hidden whitespace-nowrap">Programs</span>
            <span className="hidden sm:inline whitespace-nowrap">Available Scholarship Programs</span>
            <span className={`px-1.5 sm:px-2 py-0.5 text-[10px] font-black rounded-full ${
              activeTab === 'PROGRAMS' ? 'bg-white text-amber-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}>
              {scholarships.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: Student Applications */}
      {activeTab === 'APPLICATIONS' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 sm:p-6 space-y-4">
          {/* Section Header & Search/Status Filter (Matched to Available Scholarship Programs layout) */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Student Applications Roster</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Review submitted requirements, inspect uploaded documents, and approve or reject grant applicants.
              </p>
            </div>

            {/* Search & Status Filter side by side on the right */}
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={appSearchQuery}
                  onChange={(e) => setAppSearchQuery(e.target.value)}
                  placeholder="Search student, ID, email..."
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {appSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAppSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full cursor-pointer transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED')}
                aria-label="Filter scholarship applications by status"
                className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All ({applications.length})</option>
                <option value="PENDING">Pending ({pendingAppsCount})</option>
                <option value="ACCEPTED">Approved Scholar ({acceptedAppsCount})</option>
                <option value="REJECTED">Rejected ({rejectedAppsCount})</option>
              </select>
            </div>
          </div>

          {/* Applications Table */}
          {filteredApplications.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Walang nahanap na scholarship applications.</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Subukang i-adjust ang search query o filter tab.</p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase text-[10px] font-black tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Pangalan (Student Name)</th>
                      <th className="p-3.5">Student ID</th>
                      <th className="p-3.5">Email</th>
                      <th className="p-3.5">Scholarship Program</th>
                      <th className="p-3.5">Attached Files</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {filteredApplications.map((app) => {
                      const isPending = app.status === 'PENDING';
                      const isAccepted = app.status === 'ACCEPTED';
                      const isRejected = app.status === 'REJECTED';

                      const attachmentsCount = app.attachments?.length || (app.attachmentUrl ? 1 : 0);

                      return (
                        <tr key={app.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Student Name */}
                          <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 flex items-center justify-center font-black text-xs shrink-0">
                                {app.studentName.charAt(0)}
                              </div>
                              <span className="truncate max-w-[150px]">{app.studentName}</span>
                            </div>
                          </td>

                          {/* Student ID */}
                          <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300 font-semibold">
                            {app.studentId}
                          </td>

                          {/* Email */}
                          <td className="p-3.5 text-slate-600 dark:text-slate-400 font-mono text-[11px] truncate max-w-[160px]">
                            {app.studentEmail}
                          </td>

                          {/* Scholarship Program */}
                          <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                            {app.scholarshipTitle}
                          </td>

                          {/* Attached Files */}
                          <td className="p-3.5">
                            {attachmentsCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => openApplicantFileViewer(app, 0)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                                title="Click to inspect attached files"
                              >
                                <FileText className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>{attachmentsCount} File{attachmentsCount > 1 ? 's' : ''} Attached</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No files</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-1 text-[10px] font-black rounded-md uppercase tracking-wider inline-flex items-center gap-1 ${
                                isAccepted
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : isPending
                                  ? 'bg-amber-100 text-amber-900 dark:bg-yellow-400/20 dark:text-yellow-200 border border-amber-300 dark:border-yellow-400/40'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                              }`}
                            >
                              {isAccepted && <Check className="w-3 h-3 text-emerald-600" />}
                              {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                              {isRejected && <X className="w-3 h-3 text-rose-600" />}
                              {isAccepted ? 'APPROVED SCHOLAR' : isPending ? 'PENDING REVIEW' : 'REJECTED'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openApplicantFileViewer(app, 0)}
                                className={`px-3 py-1.5 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer border ${
                                  isPending
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500 dark:border-yellow-400'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isPending ? 'View File & Review' : 'View File'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Available Scholarship Programs */}
      {activeTab === 'PROGRAMS' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" /> Available Scholarship Grants Directory
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {filteredScholarships.length} programs listed • View details, edit criteria, manage slot capacities, or re-open/close programs.
              </p>
            </div>

            {/* Search & Status Filter */}
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={progSearchQuery}
                  onChange={(e) => setProgSearchQuery(e.target.value)}
                  placeholder="Search program..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <select
                value={progStatusFilter}
                onChange={(e) => setProgStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>

          {/* Programs List */}
          {filteredScholarships.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <Award className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Walang nahanap na scholarship programs.</p>
              <button
                type="button"
                onClick={() => setIsAddProgramOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer hover:bg-amber-700 transition-colors mt-2"
              >
                <Plus className="w-3.5 h-3.5" /> Mag-create ng Bagong Program
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredScholarships.map((s) => {
                const approvedCount = applications.filter(
                  (a) => a.scholarshipId === s.id && a.status === 'ACCEPTED'
                ).length;
                const pendingCount = applications.filter(
                  (a) => a.scholarshipId === s.id && a.status === 'PENDING'
                ).length;
                const totalApplicantsCount = applications.filter(
                  (a) => a.scholarshipId === s.id
                ).length;

                const hasSlots = s.maxSlots && Number(s.maxSlots) > 0;
                const isFull = hasSlots && approvedCount >= Number(s.maxSlots);

                return (
                  <div
                    key={s.id}
                    className="p-5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between gap-4 shadow-2xs hover:shadow-md transition-all"
                  >
                    <div className="space-y-3">
                      {/* Header with status badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase ${
                                s.status === 'ACTIVE'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : s.status === 'CLOSED'
                                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {s.status}
                            </span>

                            <span className="px-2 py-0.5 text-[9px] font-black bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-900">
                              {hasSlots
                                ? `${approvedCount} / ${s.maxSlots} Slots Filled`
                                : `${approvedCount} Scholars • Unlimited Slots`}
                            </span>

                            {isFull && (
                              <span className="px-2 py-0.5 text-[9px] font-black bg-rose-100 text-rose-800 rounded-md border border-rose-300">
                                FULL CAPACITY
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1.5 leading-snug">
                            {s.title}
                          </h3>
                        </div>

                        {s.imageUrl && (
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0">
                            <img
                              src={s.imageUrl}
                              alt={s.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {s.description}
                      </p>

                      {/* Metadata: Amount & Deadline */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-700/60 font-medium">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Grant Value</span>
                          <span className="font-bold text-amber-700 dark:text-yellow-400">
                            {s.amount && s.amount.trim() ? s.amount : 'Tuition Grant'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Deadline</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                            {s.deadline}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex-wrap">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span>{totalApplicantsCount} Total Applicants</span>
                        {pendingCount > 0 && (
                          <span className="text-amber-600 dark:text-yellow-400">({pendingCount} Pending)</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {/* Toggle Re-open / Close */}
                        <button
                          type="button"
                          onClick={() => handleToggleProgramStatus(s.id, s.status)}
                          className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 border ${
                            s.status === 'ACTIVE'
                              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                          }`}
                          title={s.status === 'ACTIVE' ? 'Close scholarship program to new applicants' : 'Re-open scholarship program for applications'}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{s.status === 'ACTIVE' ? 'Close' : 'Re-Open'}</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(s)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-300 dark:border-slate-600 flex items-center gap-1"
                          title="Edit scholarship program"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* View Details Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedScholarship(s)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer border border-amber-500"
                        >
                          View Details
                        </button>

                        {/* Archive Button if closed */}
                        {s.status === 'CLOSED' && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmModalData({
                                isOpen: true,
                                type: 'DELETE_GRANT',
                                id: s.id,
                                title: 'Are you sure you want to delete this?',
                                message: `Are you sure you want to delete this? Deleting the scholarship "${s.title}" will move it to System Settings > System Archive.`,
                              })
                            }
                            className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                            title="Archive this closed scholarship"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE SCHOLARSHIP GRANT MODAL (Opens only upon clicking Add Program) */}
      {isAddProgramOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddProgramOpen(false)}
          title="Create Scholarship Grant"
          subtitle="Publish a new academic grant or financial aid program for DCC students"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateProgram} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Scholarship Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., DCC Academic Excellence Grant"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Grant / Value Amount (Optional)
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., ₱15,000 / semester (Leave blank if not applicable)"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Application Deadline *
                </label>
                <input
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Max Slots (Optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={maxSlots}
                  onChange={(e) => setMaxSlots(e.target.value)}
                  placeholder="Unlimited if empty or 0"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ScholarshipStatus)}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="ACTIVE">ACTIVE (Accepting Applications)</option>
                  <option value="CLOSED">CLOSED (Program Inactive)</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Description & Scope *
              </label>
              <textarea
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of grant coverage, eligibility target, and college benefits..."
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Requirements Checklist (One per line) *
              </label>
              <textarea
                required
                rows={3}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="- 2x2 ID Picture&#10;- Certificate of Registration&#10;- General Weighted Average (GWA) Certificate (>= 88%)&#10;- Barangay Certificate of Indigency"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            {/* Optional Image Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Program Banner / Poster Image (Optional)
                </label>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                  >
                    Remove Banner
                  </button>
                )}
              </div>

              {imageUrl && (
                <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  <img
                    src={imageUrl}
                    alt="Scholarship Banner Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste Image URL (https://...)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
                <label className="w-full px-3 py-2 text-xs border border-dashed border-amber-400 dark:border-amber-600 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-amber-600" />
                  <span>Upload Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsAddProgramOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer border border-amber-500"
              >
                <Check className="w-4 h-4" /> Publish Scholarship Grant
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT SCHOLARSHIP GRANT MODAL */}
      {editingScholarship && (
        <Modal
          isOpen={true}
          onClose={() => setEditingScholarship(null)}
          title={`Edit Scholarship: ${editingScholarship.title}`}
          subtitle="Update scholarship details, grant amount, deadline, requirements, and slot capacity"
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Scholarship Title *
                </label>
                <input
                  type="text"
                  required
                  value={editingScholarship.title}
                  onChange={(e) => setEditingScholarship({ ...editingScholarship, title: e.target.value })}
                  placeholder="e.g., DCC Academic Excellence Grant"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Grant / Value Amount (Optional)
                </label>
                <input
                  type="text"
                  value={editingScholarship.amount || ''}
                  onChange={(e) => setEditingScholarship({ ...editingScholarship, amount: e.target.value })}
                  placeholder="e.g., ₱15,000 / semester"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Application Deadline *
                </label>
                <input
                  type="date"
                  required
                  value={editingScholarship.deadline}
                  onChange={(e) => setEditingScholarship({ ...editingScholarship, deadline: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Max Slots (Optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={editingScholarship.maxSlots || ''}
                  onChange={(e) =>
                    setEditingScholarship({
                      ...editingScholarship,
                      maxSlots: e.target.value ? Number(e.target.value) : 0,
                    })
                  }
                  placeholder="Unlimited if empty or 0"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Status *
                </label>
                <select
                  value={editingScholarship.status}
                  onChange={(e) =>
                    setEditingScholarship({
                      ...editingScholarship,
                      status: e.target.value as ScholarshipStatus,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="ACTIVE">ACTIVE (Accepting Applications)</option>
                  <option value="CLOSED">CLOSED (Program Inactive)</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Description & Scope *
              </label>
              <textarea
                required
                rows={2}
                value={editingScholarship.description}
                onChange={(e) => setEditingScholarship({ ...editingScholarship, description: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Requirements Checklist (One per line) *
              </label>
              <textarea
                required
                rows={3}
                value={editingScholarship.requirements}
                onChange={(e) => setEditingScholarship({ ...editingScholarship, requirements: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            {/* Banner Image upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Program Banner / Poster Image (Optional)
                </label>
                {editingScholarship.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setEditingScholarship({ ...editingScholarship, imageUrl: '' })}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                  >
                    Remove Banner
                  </button>
                )}
              </div>

              {editingScholarship.imageUrl && (
                <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  <img
                    src={editingScholarship.imageUrl}
                    alt="Scholarship Banner Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={editingScholarship.imageUrl || ''}
                  onChange={(e) => setEditingScholarship({ ...editingScholarship, imageUrl: e.target.value })}
                  placeholder="Paste Image URL (https://...)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
                <label className="w-full px-3 py-2 text-xs border border-dashed border-amber-400 dark:border-amber-600 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-amber-600" />
                  <span>Upload Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEditingScholarship(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* POP-UP MODAL FOR SCHOLARSHIP VIEW DETAILS (With Slot Capacity Summary & Dynamic Totals) */}
      {selectedScholarship && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedScholarship(null)}
          title={`Scholarship Grant File: ${selectedScholarship.title}`}
          subtitle="Official program record, slot capacity analytics, & printable summary"
          maxWidth="2xl"
        >
          <div className="space-y-4 print:p-0">
            {/* Header & Print / Edit Options */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  DCC OSAS Scholarship Grant Record
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedScholarship;
                    setSelectedScholarship(null);
                    handleStartEdit(target);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs border border-amber-500"
                  title="Edit scholarship details"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Program
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectPrintScholarship(selectedScholarship)}
                  className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Program Slip
                </button>
              </div>
            </div>

            {/* SLOT CAPACITY SUMMARY GRAPH & DYNAMIC TOTALS */}
            {(() => {
              const progApps = applications.filter((a) => a.scholarshipId === selectedScholarship.id);
              const progAccepted = progApps.filter((a) => a.status === 'ACCEPTED').length;
              const progPending = progApps.filter((a) => a.status === 'PENDING').length;
              const progTotal = progApps.length;

              const maxSlotsNum = selectedScholarship.maxSlots ? Number(selectedScholarship.maxSlots) : 0;
              const hasSlotLimit = maxSlotsNum > 0;
              const percentFilled = hasSlotLimit ? Math.min(100, Math.round((progAccepted / maxSlotsNum) * 100)) : 100;

              return (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-amber-600" /> Slot Capacity Summary
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        {selectedScholarship.status}
                      </span>
                      <span className="text-[11px] font-black font-mono text-amber-800 dark:text-yellow-300 bg-amber-100 dark:bg-yellow-400/20 px-2 py-0.5 rounded-lg border border-amber-300 dark:border-yellow-400/40">
                        {hasSlotLimit ? `${progAccepted}/${maxSlotsNum} Slots` : 'Unlimited Slots'}
                      </span>
                    </div>
                  </div>

                  {/* Slot Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
                      {hasSlotLimit ? (
                        <>
                          <div
                            className="bg-emerald-500 h-full transition-all duration-500"
                            style={{ width: `${percentFilled}%` }}
                            title={`Filled Slots: ${progAccepted}/${maxSlotsNum}`}
                          />
                          <div
                            className="bg-slate-300 dark:bg-slate-600 h-full flex-1"
                            title={`Available Slots: ${Math.max(0, maxSlotsNum - progAccepted)}`}
                          />
                        </>
                      ) : (
                        <div
                          className="bg-emerald-500 h-full w-full"
                          title="Unlimited Slots Capacity"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                      <span>{hasSlotLimit ? `${progAccepted} filled of ${maxSlotsNum} max slots (${percentFilled}%)` : `${progAccepted} enrolled (Open / Unlimited capacity)`}</span>
                      {hasSlotLimit && (
                        <span>{Math.max(0, maxSlotsNum - progAccepted)} slots remaining</span>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Totals: Total, Pending, Scholars */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/80 text-center">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">{progTotal}</span>
                      <span className="text-[9px] text-slate-500 block">Applications</span>
                    </div>

                    <div className="p-2 bg-amber-50 dark:bg-yellow-400/10 rounded-xl border border-amber-200 dark:border-yellow-400/30 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-yellow-300 block">Pending</span>
                      <span className="text-sm font-black text-amber-900 dark:text-yellow-200">{progPending}</span>
                      <span className="text-[9px] text-amber-700 dark:text-yellow-400 block">Under Review</span>
                    </div>

                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">Scholars</span>
                      <span className="text-sm font-black text-emerald-900 dark:text-emerald-200">{progAccepted}</span>
                      <span className="text-[9px] text-emerald-700 dark:text-emerald-400 block">Approved</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Program Metadata Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
              {selectedScholarship.imageUrl && (
                <div className="col-span-2">
                  <span className="font-bold text-slate-400 text-[10px] uppercase block mb-1">Scholarship Poster / Banner</span>
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-56 bg-slate-50 dark:bg-slate-800 flex items-center justify-center p-1">
                    <img
                      src={selectedScholarship.imageUrl}
                      alt={selectedScholarship.title}
                      className="max-h-52 w-full object-contain rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <span className="font-bold text-slate-400 text-[10px] uppercase">Scholarship Program Title</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedScholarship.title}</p>
              </div>
              <div>
                <span className="font-bold text-slate-400 text-[10px] uppercase">Grant Value</span>
                <p className="font-bold text-amber-700 dark:text-yellow-400">
                  {selectedScholarship.amount && selectedScholarship.amount.trim() ? selectedScholarship.amount : 'Tuition Grant'}
                </p>
              </div>
              <div>
                <span className="font-bold text-slate-400 text-[10px] uppercase">Application Deadline</span>
                <p className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{selectedScholarship.deadline}</p>
              </div>
              <div className="col-span-2">
                <span className="font-bold text-slate-400 text-[10px] uppercase">Description & Scope</span>
                <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 leading-relaxed">
                  {selectedScholarship.description}
                </p>
              </div>
              <div className="col-span-2">
                <span className="font-bold text-slate-400 text-[10px] uppercase">Requirements Checklist</span>
                <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 leading-relaxed whitespace-pre-line font-mono text-[11px]">
                  {selectedScholarship.requirements}
                </p>
              </div>

              {/* Registered Applicants Roster */}
              <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider block">
                  Registered Applicants Roster ({applications.filter((a) => a.scholarshipId === selectedScholarship.id).length})
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {applications
                    .filter((a) => a.scholarshipId === selectedScholarship.id)
                    .map((a) => (
                      <div key={a.id} className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{a.studentName}</span>
                          <span className="text-[10px] text-slate-500 ml-2 font-mono">({a.studentEmail})</span>
                          {a.status === 'ACCEPTED' && (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block sm:inline sm:ml-2">
                              • Approved: {a.approvedAt ? new Date(a.approvedAt).toLocaleDateString() : 'N/A'}
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                            a.status === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : a.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-yellow-400/20 dark:text-yellow-200'
                          }`}
                        >
                          {a.status === 'ACCEPTED' ? 'APPROVED' : a.status}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* VIEW FILE & REVIEW MODAL (With Close & Accept/Reject Buttons) */}
      {viewingFileModal && (
        <Modal
          isOpen={true}
          onClose={() => {
            setViewingFileModal(null);
            setImageZoom(1);
          }}
          title={
            viewingFileModal.attachmentUrl && isImageFile(viewingFileModal.attachmentUrl, viewingFileModal.fileName)
              ? `Attached Image: ${viewingFileModal.fileName}`
              : `Application Document: ${viewingFileModal.fileName}`
          }
          subtitle={`Applicant: ${viewingFileModal.studentName} (ID: ${viewingFileModal.studentId}) • ${viewingFileModal.scholarshipTitle}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Multi-attachment switcher tabs if applicant submitted multiple documents */}
            {viewingFileModal.attachmentsList && viewingFileModal.attachmentsList.length > 1 && (
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 px-1">
                  <span>Applicant Submitted Files ({viewingFileModal.attachmentsList.length}):</span>
                  <span className="text-[10px] text-slate-400">Click to switch viewing file</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {viewingFileModal.attachmentsList.map((att, idx) => {
                    const isSelected = idx === (viewingFileModal.activeAttachmentIndex ?? 0);
                    const isImg = isImageFile(att.url, att.name);

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setImageZoom(1);
                          setViewingFileModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  fileName: att.name,
                                  attachmentUrl: att.url,
                                  attachmentName: att.name,
                                  activeAttachmentIndex: idx,
                                }
                              : null
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs scale-[1.02]'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {isImg ? (
                          <ImageIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-amber-500'}`} />
                        ) : (
                          <FileText className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-500'}`} />
                        )}
                        <span className="truncate max-w-[150px]">{att.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preview Box */}
            {viewingFileModal.attachmentUrl ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {isImageFile(viewingFileModal.attachmentUrl, viewingFileModal.fileName) ? (
                      <ImageIcon className="w-5 h-5 text-amber-600 dark:text-yellow-400" />
                    ) : (
                      <FileText className="w-5 h-5 text-amber-600 dark:text-yellow-400" />
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[280px]">
                        {viewingFileModal.fileName}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {viewingFileModal.scholarshipTitle} • {viewingFileModal.studentName}
                      </p>
                    </div>
                  </div>

                  {/* Top toolbar: Zoom controls for images + Download button */}
                  <div className="flex items-center gap-2">
                    {isImageFile(viewingFileModal.attachmentUrl, viewingFileModal.fileName) && (
                      <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setImageZoom((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                          title="Zoom out"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 min-w-[38px] text-center">
                          {Math.round(imageZoom * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setImageZoom((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                          title="Zoom in"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                        {imageZoom !== 1 && (
                          <button
                            type="button"
                            onClick={() => setImageZoom(1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-amber-600 transition-colors cursor-pointer ml-0.5"
                            title="Reset zoom to 100%"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    <a
                      href={viewingFileModal.attachmentUrl}
                      download={viewingFileModal.fileName}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-yellow-400/20 dark:hover:bg-yellow-400/30 dark:text-yellow-200 rounded-lg transition-colors inline-flex items-center gap-1 border border-amber-300 dark:border-yellow-400/40"
                    >
                      <Download className="w-3 h-3" /> Download / Open Tab
                    </a>
                  </div>
                </div>

                {/* Viewport container */}
                <div className="bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center min-h-[300px] max-h-[540px] overflow-auto select-none">
                  {isImageFile(viewingFileModal.attachmentUrl, viewingFileModal.fileName) ? (
                    <div className="relative overflow-auto flex items-center justify-center w-full h-full">
                      <img
                        src={viewingFileModal.attachmentUrl}
                        alt={viewingFileModal.fileName}
                        onClick={() => setImageZoom((prev) => (prev === 1 ? 1.5 : 1))}
                        style={{
                          transform: `scale(${imageZoom})`,
                          transformOrigin: 'center center',
                          transition: 'transform 0.15s ease-out',
                        }}
                        className="max-h-[480px] w-auto max-w-full object-contain rounded-lg shadow-2xl cursor-zoom-in"
                        title="Click to toggle 150% zoom"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={viewingFileModal.attachmentUrl}
                      title={viewingFileModal.fileName}
                      className="w-full h-[480px] rounded-lg border-0 bg-white"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-xs">{viewingFileModal.fileName}</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 rounded">
                    VERIFIED DOCUMENT
                  </span>
                </div>

                {/* Official Document Preview Container */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-slate-200 text-xs font-mono space-y-3 max-h-80 overflow-y-auto">
                  <div className="text-center border-b border-slate-700 pb-3">
                    <h3 className="font-black text-sm text-amber-400 uppercase tracking-widest">DINGALAN COMMUNITY COLLEGE</h3>
                    <p className="text-[10px] text-slate-400">Office of Student Affairs and Services (OSAS)</p>
                    <p className="text-xs font-bold text-white mt-1">SCHOLARSHIP GRANT APPLICATION & VERIFICATION FORM</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
                    <p><strong className="text-slate-400">Applicant:</strong> {viewingFileModal.studentName}</p>
                    <p><strong className="text-slate-400">Student ID:</strong> {viewingFileModal.studentId}</p>
                    <p><strong className="text-slate-400">Grant Applied:</strong> {viewingFileModal.scholarshipTitle}</p>
                    <p><strong className="text-slate-400">Verification:</strong> OSAS Registrar Validated</p>
                  </div>

                  <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] font-sans text-slate-300">
                    <p className="font-bold text-emerald-400 mb-1">Attached Verified Requirements:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                      <li>Official Transcript of Records / Grade Slip (GPA &gt;= 88%)</li>
                      <li>Barangay Certificate of Indigency / Parents' ITR</li>
                      <li>Certificate of Good Moral Character</li>
                      <li>Certificate of Matriculation & Study Load Form</li>
                    </ul>
                  </div>

                  <p className="text-[10px] text-slate-500 text-center italic">--- End of Official Document Preview ---</p>
                </div>
              </div>
            )}

            {/* Bottom Modal Actions: Close + Accept/Reject */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Admin Inspected
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* For REJECTED applicant: Order is strictly Archive, Re-Approve, Close */}
                {viewingFileModal.applicationId && viewingFileModal.applicationStatus === 'REJECTED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const appId = viewingFileModal.applicationId!;
                        const studentName = viewingFileModal.studentName || 'Student';
                        setViewingFileModal(null);
                        setImageZoom(1);
                        setConfirmModalData({
                          isOpen: true,
                          type: 'ARCHIVE_REJECTED_APP',
                          id: appId,
                          title: 'Confirm Archive Rejected Applicant',
                          message: `Sigurado ka ba na gusto mong i-archive ang rejected scholarship application ni ${studentName}? Mapupunta ito sa System Settings Archive Vault.`,
                        });
                      }}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs border border-orange-500 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Archive to System Settings Vault"
                    >
                      <Archive className="w-4 h-4" /> Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const appId = viewingFileModal.applicationId!;
                        setViewingFileModal(null);
                        setImageZoom(1);
                        handleAppReview(appId, 'ACCEPTED');
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs border border-emerald-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Re-approve this rejected application"
                    >
                      <Check className="w-4 h-4" /> Re-Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewingFileModal(null);
                        setImageZoom(1);
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer shadow-xs"
                    >
                      Close
                    </button>
                  </>
                )}

                {/* Accept and Reject buttons shown for pending applicant */}
                {viewingFileModal.applicationId && viewingFileModal.applicationStatus === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const appId = viewingFileModal.applicationId!;
                        setViewingFileModal(null);
                        setImageZoom(1);
                        handleAppReview(appId, 'REJECTED');
                      }}
                      className="px-4 py-2 bg-red-100 dark:bg-red-950/80 hover:bg-red-200 dark:hover:bg-red-900/90 text-red-800 dark:text-red-200 font-bold text-xs rounded-xl border border-red-300 dark:border-red-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const appId = viewingFileModal.applicationId!;
                        setViewingFileModal(null);
                        setImageZoom(1);
                        handleAppReview(appId, 'ACCEPTED');
                      }}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs border border-emerald-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Accept Scholar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewingFileModal(null);
                        setImageZoom(1);
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer shadow-xs"
                    >
                      Close
                    </button>
                  </>
                )}

                {/* For APPROVED or other status without pending/rejected actions */}
                {viewingFileModal.applicationStatus !== 'PENDING' && viewingFileModal.applicationStatus !== 'REJECTED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingFileModal(null);
                      setImageZoom(1);
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer shadow-xs"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* PRINTABLE SCHOLARSHIP GRANT SLIP */}
      {printScholarship && (
        <div className="direct-print-container">
          {(() => {
            const progApps = applications.filter((a) => a.scholarshipId === printScholarship.id);
            const acceptedApps = progApps.filter((a) => a.status === 'ACCEPTED');

            return (
              <div id="printable-scholarship-slip" className="printable-document flex flex-col justify-between min-h-[95vh] sm:min-h-[1020px] print:min-h-screen print:h-full p-4 sm:p-6 bg-white text-slate-900 rounded-xl border border-slate-200 print:border-none print:p-0">
                  {/* Institutional Header & Program Metadata */}
                  <div className="space-y-3 shrink-0">
                    <div className="text-center pb-3 border-b-2 border-slate-900 space-y-1">
                      <div className="flex items-center justify-center gap-3 mb-1.5">
                        <CollegeLogo className="w-12 h-12" />
                        <div>
                          <h2 className="text-base font-black tracking-wide uppercase text-slate-900 leading-tight">
                            Dingalan Community College
                          </h2>
                          <p className="text-xs font-bold text-slate-700 tracking-wider uppercase">
                            Office of Student Affairs &amp; Services (OSAS)
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Poblacion, Dingalan, Aurora • osas@dcc.edu.ph
                          </p>
                        </div>
                      </div>
                      <div className="inline-block px-4 py-1 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-md mt-1">
                        Official Scholarship Program &amp; Beneficiary Roster
                      </div>
                    </div>

                    {/* Program Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Scholarship Program
                        </span>
                        <span className="font-bold text-slate-900 truncate block">{printScholarship.title}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Grant Value
                        </span>
                        <span className="font-bold text-amber-700">{printScholarship.amount || 'Tuition Grant'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Status / Enrolled
                        </span>
                        <span className="font-bold text-slate-800">
                          {printScholarship.status} • {acceptedApps.length} Scholar(s)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Academic Year
                        </span>
                        <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Content Body */}
                  <div className="printable-body flex-1 space-y-3 my-3">
                    {/* Program Description & Requirements */}
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Program Scope &amp; Description
                        </span>
                        <p className="text-slate-800 leading-relaxed text-[11px]">{printScholarship.description}</p>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Eligibility &amp; Application Requirements
                        </span>
                        <p className="text-slate-800 whitespace-pre-line font-mono text-[10px] leading-relaxed">
                          {printScholarship.requirements}
                        </p>
                      </div>
                    </div>

                    {/* Official Accepted Scholars Roster Table */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wide text-slate-900">
                          Official Beneficiaries &amp; Accepted Scholars ({acceptedApps.length})
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Total Applicants: {progApps.length}
                        </span>
                      </div>

                      {acceptedApps.length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-300 text-center rounded-xl text-xs text-slate-500 italic">
                          No approved scholars enrolled yet for this program.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 text-slate-800 uppercase text-[10px] font-black tracking-wider border-b border-slate-200">
                              <tr>
                                <th className="p-2">#</th>
                                <th className="p-2">Student Name</th>
                                <th className="p-2">Student ID</th>
                                <th className="p-2">Email</th>
                                <th className="p-2">Applied Date</th>
                                <th className="p-2">Date Approved</th>
                                <th className="p-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {acceptedApps.map((a, idx) => (
                                <tr key={a.id} className="hover:bg-slate-50">
                                  <td className="p-2 font-mono text-[10px] text-slate-500">{idx + 1}</td>
                                  <td className="p-2 font-bold text-slate-900">{a.studentName}</td>
                                  <td className="p-2 font-mono text-slate-700">{a.studentId}</td>
                                  <td className="p-2 font-mono text-slate-600 text-[10px]">{a.studentEmail}</td>
                                  <td className="p-2 text-[10px] text-slate-600">{new Date(a.appliedAt).toLocaleDateString()}</td>
                                  <td className="p-2 text-[10px] font-semibold text-emerald-800">
                                    {a.approvedAt ? new Date(a.approvedAt).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="p-2 text-right">
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md uppercase">
                                      APPROVED SCHOLAR
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Signatures & Footer Section */}
                  <div className="printable-footer-block mt-auto shrink-0 pt-8 space-y-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <div className="grid grid-cols-2 gap-8 text-center text-xs items-end max-w-md mx-auto">
                      <div className="flex flex-col items-center justify-end text-center">
                        <div className="w-full border-b border-slate-900 pb-8 mb-1" />
                        <p className="font-bold text-slate-900 leading-tight">College Registrar</p>
                        <p className="text-[10px] text-slate-500 leading-tight">Verified &amp; Certified</p>
                      </div>
                      <div className="flex flex-col items-center justify-end text-center">
                        <div className="w-full border-b border-slate-900 pb-8 mb-1" />
                        <p className="font-bold text-slate-900 leading-tight">Princess Ann T. Ruzol</p>
                        <p className="text-[10px] text-slate-500 leading-tight">OSAS Director / Administrator</p>
                      </div>
                    </div>

                    <div className="text-center pt-2 text-[10px] text-slate-400 font-mono border-t border-slate-200">
                      Dingalan Community College • OSAS Scholarship &amp; Aid Office • System-Generated Official Document
                    </div>
                  </div>
                </div>
            );
          })()}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalData.isOpen}
        onClose={() => setConfirmModalData({ ...confirmModalData, isOpen: false })}
        onConfirm={executeConfirmAction}
        title={confirmModalData.title}
        message={confirmModalData.message}
        confirmText="Yes"
        cancelText="No"
        type="danger"
      />
    </div>
  );
};
