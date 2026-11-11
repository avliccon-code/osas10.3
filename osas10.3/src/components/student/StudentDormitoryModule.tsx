import React, { useState, useEffect } from 'react';
import { User, DormApplicant, DormReport } from '../../types';
import {
  getDormApplicants,
  applyDorm,
  getDormReports,
  submitDormReport,
  getDormRooms,
} from '../../services/storage';
import { Modal } from '../common/Modal';
import {
  Home,
  CheckCircle2,
  AlertCircle,
  Clock,
  Upload,
  FileText,
  AlertTriangle,
  Plus,
  Wrench,
  ExternalLink,
  Star,
  BookOpen,
  ShieldCheck,
  X,
} from 'lucide-react';

const GOOGLE_FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScNdiXXAePbStheorox7q1WM1onz4TG7WY6UwMShfJ8OWzVRg/viewform?usp=header';

interface StudentDormitoryModuleProps {
  user: User;
}

export const StudentDormitoryModule: React.FC<StudentDormitoryModuleProps> = ({ user }) => {
  const [applicants, setApplicants] = useState(getDormApplicants());
  const [dormReports, setDormReports] = useState(getDormReports());
  const [rooms, setRooms] = useState(getDormRooms());

  // Dormitory Rules Modal State
  const [showRulesModal, setShowRulesModal] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setApplicants(getDormApplicants());
      setDormReports(getDormReports());
      setRooms(getDormRooms());
    };
    window.addEventListener('osas_storage_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // If navigated from a Dormitory Report notification, scroll directly to reports history section
    if (typeof window !== 'undefined' && sessionStorage.getItem('osas_dorm_scroll_reports') === 'true') {
      sessionStorage.removeItem('osas_dorm_scroll_reports');
      setTimeout(() => {
        const el = document.getElementById('student-dorm-reports-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    }

    return () => {
      window.removeEventListener('osas_storage_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Application Form State
  const [showAppModal, setShowAppModal] = useState(false);
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentName, setAttachmentName] = useState('Dormitory_Form_Signed.pdf');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // File Dorm Report Form State
  const [issueType, setIssueType] = useState<'WATER_SHORTAGE' | 'BROKEN_FAUCET' | 'STALKER' | 'ROOMMATE_CONFLICT' | 'MAINTENANCE' | 'OTHER'>('BROKEN_FAUCET');
  const [reportDescription, setReportDescription] = useState('');

  const studentIdVal = user.studentId || user.id;

  const myApplicantRecord = applicants.find(
    (a) =>
      a.studentId === studentIdVal ||
      (user.studentId && a.studentId === user.studentId) ||
      (user.email && a.studentEmail === user.email) ||
      (user.fullName && a.studentName?.toLowerCase() === user.fullName?.toLowerCase())
  );

  // Find assigned room if accepted
  const assignedRoom = rooms.find((r) =>
    (r.residents || []).some(
      (res) =>
        res.studentId === studentIdVal ||
        (user.studentId && res.studentId === user.studentId) ||
        (res.email && user.email && res.email === user.email) ||
        (res.studentName && user.fullName && res.studentName.toLowerCase() === user.fullName.toLowerCase())
    )
  );

  const myDormReports = dormReports.filter(
    (r) =>
      r.studentId === studentIdVal ||
      (user.studentId && r.studentId === user.studentId) ||
      (user.email && r.studentEmail === user.email) ||
      (user.fullName && r.studentName?.toLowerCase() === user.fullName?.toLowerCase())
  );

  const refreshData = () => {
    setApplicants(getDormApplicants());
    setDormReports(getDormReports());
    setRooms(getDormRooms());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachmentUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const totalOccupied = rooms.reduce((acc, r) => acc + r.residents.length, 0);
  const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
  const isDormFull = totalCapacity > 0 && totalOccupied >= totalCapacity;

  const handleOpenAppModal = () => {
    if (isDormFull) {
      alert('⛔ Dormitory capacity is currently FULL. All dormitory rooms have reached maximum capacity. You cannot apply at this time.');
      return;
    }
    setShowAppModal(true);
  };

  const handleDormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDormFull) {
      alert('⛔ Dormitory capacity is currently FULL. Cannot submit application.');
      return;
    }
    if (!privacyConsent) {
      alert('Mangyaring basahin at lagyan ng tsek ang Data Privacy Consent bago i-submit ang iyong aplikasyon sa dormitoryo.');
      return;
    }
    applyDorm(user, address, reason, attachmentName, attachmentUrl || undefined);
    alert('Dormitory residency application successfully submitted to OSAS Admin!');
    setShowAppModal(false);
    setAddress('');
    setReason('');
    setAttachmentUrl('');
    setAttachmentName('Dormitory_Form_Signed.pdf');
    setPrivacyConsent(false);
    refreshData();
  };

  const handleAddReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const roomNum = assignedRoom ? assignedRoom.roomNumber : myApplicantRecord?.assignedRoomNumber || 'Room 101';
    submitDormReport(user, roomNum, issueType, reportDescription);
    setReportDescription('');
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 rounded-xl">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Student Dormitory Resident and Application Tracking
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track university dorm application status and access incident/maintenance reporting for accepted residents
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="self-center sm:self-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          <span>Dormitory Rules</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dormitory Application & Room Status Box (Col 5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
              My Dormitory Application & Room Assignment Status
            </h3>

            {assignedRoom ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Residency Status</span>
                  <span className="px-3 py-1 text-xs font-extrabold rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 uppercase">
                    Assigned Resident
                  </span>
                </div>
                <div className="p-3.5 bg-emerald-100/90 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 rounded-xl space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-900 dark:text-emerald-200 tracking-wider block">
                    Assigned University Dorm Room:
                  </span>
                  <p className="text-sm font-extrabold text-emerald-950 dark:text-emerald-100">
                    {assignedRoom.roomNumber} ({assignedRoom.floor}, {assignedRoom.gender} Wing)
                  </p>
                </div>
                {myApplicantRecord && (
                  <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300 pt-1 border-t border-emerald-200/60 dark:border-emerald-800">
                    <p><strong className="text-slate-900 dark:text-white font-bold">Home Address:</strong> {myApplicantRecord.address}</p>
                    <p><strong className="text-slate-900 dark:text-white font-bold">Reason:</strong> {myApplicantRecord.reason}</p>
                  </div>
                )}
              </div>
            ) : !myApplicantRecord ? (
              <div className="p-6 text-center text-slate-400 dark:text-slate-500 space-y-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <Home className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-500" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">You currently have no active dormitory application record or room assignment on file.</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-400">Please visit or contact OSAS Admin for dormitory residency inquiries.</p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Application Status</span>
                  <span
                    className={`px-3 py-1 text-xs font-extrabold rounded-full uppercase ${
                      myApplicantRecord.status === 'ACCEPTED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200'
                        : myApplicantRecord.status === 'REJECTED'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/80 dark:text-red-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200 animate-pulse'
                    }`}
                  >
                    {myApplicantRecord.status === 'ACCEPTED' ? 'APPROVED' : myApplicantRecord.status}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                  <p><strong className="text-slate-900 dark:text-white font-bold">Home Address:</strong> {myApplicantRecord.address}</p>
                  <p><strong className="text-slate-900 dark:text-white font-bold">Reason:</strong> {myApplicantRecord.reason}</p>
                  <p><strong className="text-slate-900 dark:text-white font-bold">Application Date:</strong> {myApplicantRecord.applicationDate}</p>
                </div>

                {/* Assigned Room Card */}
                {myApplicantRecord.status === 'ACCEPTED' && (
                  <div className="p-3 bg-emerald-100/70 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 rounded-xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-emerald-900 dark:text-emerald-200 tracking-wider block">
                      Assigned University Dorm Room:
                    </span>
                    <p className="text-sm font-extrabold text-emerald-950 dark:text-emerald-100">
                      {assignedRoom ? `${assignedRoom.roomNumber} (${assignedRoom.floor}, ${assignedRoom.wingType || `${assignedRoom.gender} Wing`})` : myApplicantRecord.assignedRoomNumber || 'Room 101'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dorm Reports Section (Col 7) */}
        <div id="student-dorm-reports-section" className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Dormitory Incident & Maintenance Reports
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">File complaints, track repair status, and mark resolution "Done"</p>
                </div>
              </div>
            </div>

            {/* Submit Report Form - Only for ACCEPTED dorm residents */}
            {myApplicantRecord?.status === 'ACCEPTED' || assignedRoom ? (
              <form onSubmit={handleAddReportSubmit} className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">File New Dorm Report</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Category *</label>
                    <select
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-800 dark:text-white font-bold cursor-pointer"
                    >
                      <option value="WATER_SHORTAGE">Water Shortage</option>
                      <option value="BROKEN_FAUCET">Broken Faucet / Plumbing</option>
                      <option value="STALKER">Safety / Stalker Concern</option>
                      <option value="ROOMMATE_CONFLICT">Roommate Dispute</option>
                      <option value="MAINTENANCE">Electrical / Maintenance</option>
                      <option value="OTHER">Other Issue</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Room Number</label>
                    <input
                      type="text"
                      disabled
                      value={assignedRoom ? assignedRoom.roomNumber : myApplicantRecord?.assignedRoomNumber || 'Room 101'}
                      className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800/50 font-bold text-slate-700 dark:text-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Detailed Description of Complaint *</label>
                  <textarea
                    rows={2}
                    required
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Explain issue details..."
                    className="w-full p-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors uppercase tracking-wider cursor-pointer"
                >
                  Submit Dorm Report
                </button>
              </form>
            ) : (
              <div className="p-6 text-center space-y-2 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl">
                <AlertCircle className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Maintenance & Incident Reporting Locked</h4>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed max-w-md mx-auto">
                  Dormitory Incident & Maintenance Report submission is strictly reserved for active dormitory residents. Once your application is approved by OSAS Admin and a room is assigned, you will be able to submit maintenance complaints and report issues here.
                </p>
              </div>
            )}

            {/* List of Filed Reports */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                My Filed Dorm Reports History ({myDormReports.length})
              </h4>

              {myDormReports.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">No dorm reports submitted yet.</p>
              ) : (
                myDormReports.map((rep) => (
                  <div key={rep.id} className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded uppercase">
                          {rep.issueType.replace('_', ' ')}
                        </span>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">{rep.description}</h5>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400 font-mono mt-0.5">
                          Room: {rep.roomNumber} • Date Logged: {rep.dateLogged}
                        </p>
                      </div>

                      <span
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                          rep.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200'
                            : rep.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200'
                        }`}
                      >
                        {rep.status}
                      </span>
                    </div>

                    {/* Completion Status Bar */}
                    <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        {rep.status === 'COMPLETED' ? (
                          <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Maintenance Completed
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Maintenance In Progress
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Prominent Yellow Feedback Section for COMPLETED Dorm Reports (Matching Appointments UI) */}
                    {rep.status === 'COMPLETED' && (
                      <div className="pt-3 border-t border-amber-200/60 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-xl space-y-2">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          <span className="text-xs text-amber-900 dark:text-amber-200 font-semibold">
                            How was your dormitory maintenance service?
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                GOOGLE_FEEDBACK_FORM_URL,
                                '_blank',
                                'noopener,noreferrer'
                              )
                            }
                            className="w-full sm:w-auto justify-center px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                            title="Open Google Form Feedback"
                          >
                            <Star className="w-3.5 h-3.5 fill-white" />
                            <span>Leave Feedback</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dorm Application Modal */}
      {showAppModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowAppModal(false)}
          title="Dormitory Residency Application Form"
          subtitle="Submit your requirements to DCC OSAS Admin"
          maxWidth="md"
        >
          <form onSubmit={handleDormSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Permanent Home Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Complete home province address..."
                className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reason for Application *</label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you need campus dormitory accommodation..."
                className="w-full p-3 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dormitory Form Requirement Attachment *</label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-3 rounded-xl text-center cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-colors relative">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{attachmentName || 'Select signed Dormitory Form file'}</span>
                </div>
              </div>
            </div>

            {/* Data Privacy Notice (RA 10173) & Consent */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Data Privacy Notice (RA 10173)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Personal details, permanent home address, and residency application documents provided herein are collected and processed by DCC OSAS strictly for assessing dormitory residency qualification, room allocation, and resident welfare in compliance with Republic Act No. 10173.
              </p>
              <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
                <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                  I understand and give consent to DCC OSAS to collect and process my personal data and dormitory requirements pursuant to RA 10173. *
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!privacyConsent}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-colors uppercase tracking-wider cursor-pointer"
            >
              Submit Dorm Application
            </button>
          </form>
        </Modal>
      )}

      {/* Dormitory Rules & Guidelines Modal */}
      {showRulesModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowRulesModal(false)}
          title="Dingalan Community College - Dormitory Rules & Regulations"
          subtitle="Institutional guidelines for safe and orderly dormitory residency"
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-[11px] text-emerald-950 dark:text-emerald-200 font-medium">
                All residents and applicants of the DCC Student Dormitory must strictly adhere to campus policies to ensure a safe, clean, and conducive living environment.
              </p>
            </div>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                  Curfew & Gate Access
                </h4>
                <p className="leading-relaxed pl-6.5 text-[11px]">
                  Dormitory gates close strictly at <strong>10:00 PM</strong> daily. Residents returning after 7:00 PM must present their DCC Student ID and sign the official logbook with the Dorm Manager or campus security.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                  Cleanliness & Sanitation (CLAYGO)
                </h4>
                <p className="leading-relaxed pl-6.5 text-[11px]">
                  Residents are required to keep their assigned rooms, bunk spaces, common hallways, and restrooms clean and organized. Regular and unannounced room cleanliness checks are conducted by OSAS administration.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                  Strictly Prohibited Items & Substances
                </h4>
                <p className="leading-relaxed pl-6.5 text-[11px]">
                  Alcoholic beverages, cigarettes, electronic cigarettes/vaping devices, illegal substances, dangerous weapons, gambling paraphernalia, and unauthorized high-wattage cooking appliances (e.g. electric burners, hot plates) are strictly banned.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full flex items-center justify-center text-[10px] font-bold">4</span>
                  Quiet Hours & Conduct
                </h4>
                <p className="leading-relaxed pl-6.5 text-[11px]">
                  Study & quiet hours begin at <strong>8:00 PM</strong>. Loud music, shouting, rowdy behavior, or disturbances that disrupt fellow students studying or resting are prohibited.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full flex items-center justify-center text-[10px] font-bold">5</span>
                  Visitor Regulations
                </h4>
                <p className="leading-relaxed pl-6.5 text-[11px]">
                  Guests and visitors are permitted only in the designated dormitory ground lobby during visiting hours (8:00 AM – 5:00 PM). Non-resident guests are never allowed inside resident rooms, and overnight stays are strictly prohibited.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full flex items-center justify-center text-[10px] font-bold">6</span>
                  Room Security & Key Policy
                </h4>
                <p className="leading-relaxed pl-6.5 text-[11px]">
                  Keep dorm rooms locked when leaving. Duplicating room keys or lending them to non-residents is a major offense. DCC and OSAS are not liable for lost unattended valuables.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full flex items-center justify-center text-[10px] font-bold">7</span>
                  Maintenance & Issue Reporting
                </h4>
                <p className="leading-relaxed pl-6.5 text-[11px]">
                  Report broken plumbing, water shortages, electrical issues, or facility damage immediately through the Student Portal Dormitory Incident/Maintenance report section.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-full flex items-center justify-center text-[10px] font-bold">8</span>
                  Compliance & Disciplinary Sanctions
                </h4>
                <p className="leading-relaxed pl-6.5 text-[11px]">
                  Failure to comply with DCC dormitory guidelines will result in revocation of residency privileges and disciplinary referral to the OSAS Office for formal sanctions.
                </p>
              </div>
            </div>

            {/* Close Button Only */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
