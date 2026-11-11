import React, { useState } from 'react';
import { User, Scholarship, ScholarshipApplication } from '../../types';
import {
  getScholarships,
  getScholarshipApplications,
  applyScholarship,
} from '../../services/storage';
import { Modal } from '../common/Modal';
import { Award, CheckCircle2, AlertCircle, Clock, CheckSquare, Upload, Image as ImageIcon, FileText, X, ShieldCheck } from 'lucide-react';
import { compressImage } from '../../utils/imageCompressor';

interface StudentScholarshipModuleProps {
  user: User;
}

export const StudentScholarshipModule: React.FC<StudentScholarshipModuleProps> = ({ user }) => {
  const [scholarships, setScholarships] = useState(getScholarships());
  const [applications, setApplications] = useState(getScholarshipApplications());

  const [applyingScholarship, setApplyingScholarship] = useState<Scholarship | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string; size?: number; type?: string }>>([]);

  const studentIdVal = (user.studentId || user.id || '').trim().toLowerCase();
  const userIdVal = (user.id || '').trim().toLowerCase();
  const userEmailVal = (user.email || '').trim().toLowerCase();

  const studentApplications = applications.filter((a) => {
    const aStudId = (a.studentId || '').trim().toLowerCase();
    const aEmail = (a.studentEmail || '').trim().toLowerCase();
    return (
      (studentIdVal && aStudId === studentIdVal) ||
      (userIdVal && aStudId === userIdVal) ||
      (userEmailVal && aEmail === userEmailVal)
    );
  });

  const refreshData = () => {
    setScholarships(getScholarships());
    setApplications(getScholarshipApplications());
  };

  React.useEffect(() => {
    refreshData();
    window.addEventListener('osas_storage_updated', refreshData);
    window.addEventListener('storage', refreshData);
    return () => {
      window.removeEventListener('osas_storage_updated', refreshData);
      window.removeEventListener('storage', refreshData);
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    (Array.from(files) as File[]).forEach((file: File) => {
      if (file.size > 15 * 1024 * 1024) {
        alert(`Ang file na "${file.name}" ay higit sa 15MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        let fileUrl = event.target?.result as string;
        if (fileUrl && fileUrl.startsWith('data:image')) {
          try {
            fileUrl = await compressImage(fileUrl, 1200, 1200, 0.75);
          } catch {
            // retain original data url if compress fails
          }
        }
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: fileUrl,
            size: file.size,
            type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    // Reset file input value so re-selecting same file works
    e.target.value = '';
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingScholarship) return;

    if (!privacyConsent) {
      alert('Mangyaring basahin at lagyan ng tsek ang Data Privacy Consent bago i-submit ang iyong aplikasyon.');
      return;
    }

    const primaryUrl = attachments.length > 0 ? attachments[0].url : undefined;
    const primaryName = attachments.length > 0 ? attachments[0].name : undefined;

    applyScholarship(
      applyingScholarship.id,
      applyingScholarship.title,
      user,
      primaryUrl,
      primaryName,
      attachments.length > 0 ? attachments : undefined
    );
    alert(`Application for "${applyingScholarship.title}" successfully submitted to OSAS Admin!`);
    setApplyingScholarship(null);
    setAttachments([]);
    setPrivacyConsent(false);
    refreshData();
  };

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Student Scholarship Grants & Application Tracker
            </h2>
            <p className="text-xs text-slate-500">
              Explore available university scholarship grants, check remaining slots, and track application progress
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Available Scholarships & Student Applications Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Available Scholarships List (Col 7) */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600" /> Active Scholarship Openings ({scholarships.length})
          </h3>

          <div className="space-y-4">
            {scholarships.map((sch) => {
              const applied = studentApplications.find((a) => a.scholarshipId === sch.id);
              const approvedAppsCount = applications.filter(
                (a) => a.scholarshipId === sch.id && a.status === 'ACCEPTED'
              ).length;
              const isSlotFull = sch.maxSlots ? approvedAppsCount >= sch.maxSlots : false;
              const isClosed = sch.status === 'CLOSED';

              return (
                <div
                  key={sch.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3 hover:border-amber-300 transition-all overflow-hidden"
                >
                  {sch.imageUrl && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-slate-50 flex items-center justify-center">
                      <img
                        src={sch.imageUrl}
                        alt={sch.title}
                        className="w-full h-44 object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{sch.title}</h4>
                      {((sch.amount && sch.amount.trim() !== '') || sch.grantAmount) && (
                        <p className="text-xs font-bold text-amber-700 mt-0.5">
                          Grant Amount: {sch.amount || `₱${sch.grantAmount?.toLocaleString()} / Semester`}
                        </p>
                      )}
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 shrink-0">
                      Deadline: {sch.deadline}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{sch.description}</p>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                    <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">
                      Requirements & Qualifications:
                    </span>
                    <p className="text-slate-600 text-[11px] font-medium">{sch.requirements}</p>
                  </div>

                  {/* Slot limit indicator & Apply button */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="text-xs font-semibold text-slate-600">
                      Slots:{' '}
                      <span className={`font-bold ${isSlotFull ? 'text-red-600' : 'text-emerald-700'}`}>
                        {sch.maxSlots ? `${approvedAppsCount} / ${sch.maxSlots} Filled` : 'Unlimited (All students can apply)'}
                      </span>
                    </div>

                    {applied ? (
                      <span
                        className={`px-3 py-1.5 text-xs font-extrabold rounded-xl inline-flex items-center gap-1 ${
                          applied.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : applied.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Application Status: {applied.status === 'ACCEPTED' ? 'APPROVED' : applied.status}
                      </span>
                    ) : isClosed ? (
                      <span className="px-3 py-1.5 bg-red-100 text-red-800 font-extrabold text-xs rounded-xl border border-red-200">
                        Scholarships are now closed
                      </span>
                    ) : isSlotFull ? (
                      <button
                        disabled
                        className="px-4 py-2 bg-slate-200 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed uppercase"
                      >
                        Slots Full
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setApplyingScholarship(sch);
                          setIsConfirmed(false);
                        }}
                        className="w-full sm:w-auto justify-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <Award className="w-4 h-4" /> Apply Now!
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* My Scholarship Applications Status Tracker (Col 5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              My Scholarship Applications ({studentApplications.length})
            </h3>
            <span className="text-[10px] text-slate-400">Live Status Sync</span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {studentApplications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Award className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">You have not submitted any scholarship applications yet.</p>
              </div>
            ) : (
              studentApplications.map((app) => (
                <div key={app.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{app.scholarshipTitle}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Applied Date: {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : (app.applicationDate || 'Recently')}
                      </p>
                      {app.attachmentName && (
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[180px]">{app.attachmentName}</span>
                          {app.attachments && app.attachments.length > 1 && (
                            <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded font-bold">
                              +{app.attachments.length - 1} more
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full uppercase ${
                        app.status === 'ACCEPTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : app.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}
                    >
                      {app.status === 'ACCEPTED' ? 'APPROVED' : app.status}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                    {app.status === 'PENDING' && (
                      <p className="flex items-center gap-1 text-amber-800">
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Your application is currently under review by OSAS Admin.
                      </p>
                    )}
                    {app.status === 'ACCEPTED' && (
                      <p className="flex items-center gap-1 text-emerald-800 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Congratulations! Your scholarship grant has been APPROVED.
                      </p>
                    )}
                    {app.status === 'REJECTED' && (
                      <p className="flex items-center gap-1 text-red-800">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Application was rejected or slots filled.
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Apply Confirmation Modal */}
      {applyingScholarship && (
        <Modal
          isOpen={true}
          onClose={() => setApplyingScholarship(null)}
          title="Scholarship Application Confirmation"
          subtitle={applyingScholarship.title}
          maxWidth="md"
        >
          <form onSubmit={handleApplySubmit} className="space-y-4">
            {applyingScholarship.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-amber-200 max-h-40 bg-slate-50 flex items-center justify-center">
                <img
                  src={applyingScholarship.imageUrl}
                  alt={applyingScholarship.title}
                  className="max-h-36 w-full object-contain"
                />
              </div>
            )}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-800/80 text-xs space-y-2">
              <h4 className="font-bold text-amber-900 dark:text-amber-200">{applyingScholarship.title}</h4>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed whitespace-pre-line">{applyingScholarship.description}</p>
              
              {applyingScholarship.requirements && (
                <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-1">
                  <span className="font-black uppercase text-[10px] tracking-wider text-amber-900 dark:text-amber-200 block">
                    Requirements & Qualifications (Set by OSAS Admin):
                  </span>
                  <p className="text-amber-800 dark:text-amber-300 font-medium text-xs whitespace-pre-line">
                    {applyingScholarship.requirements}
                  </p>
                </div>
              )}

              <div className="pt-1 text-amber-900 dark:text-amber-200 font-bold">
                Grant Value: {applyingScholarship.amount || (applyingScholarship.grantAmount ? `₱${applyingScholarship.grantAmount.toLocaleString()}` : '₱15,000 / Semester')}
              </div>
            </div>

            {/* Supporting Documents & Files Upload Section (Multiple Files Supported) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Attach Supporting Documents / Files (Multiple Allowed)
                </label>
                {attachments.length > 0 && (
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    {attachments.length} file(s) attached
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                You can attach multiple files (e.g. Certificate of Registration, Grade Slip, ID, Proof of Indigency, Good Moral, etc.).
              </p>

              {/* Upload Dropzone / Button */}
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 p-3 rounded-xl text-center cursor-pointer transition-colors relative bg-slate-50/60 dark:bg-slate-800/60 hover:bg-amber-50/40">
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300 py-1">
                  <Upload className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">Click or drag files here to attach</span>
                  <span className="text-[10px] text-slate-400 font-normal">(PNG, JPG, PDF)</span>
                </div>
              </div>

              {/* Attached Files List */}
              {attachments.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {att.url.startsWith('data:image/') ? (
                          <img
                            src={att.url}
                            alt={att.name}
                            className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-amber-100 dark:bg-amber-950 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{att.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Document file'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Data Privacy Act of 2012 (RA 10173) Notice & Mandatory Consent */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-bold text-xs uppercase tracking-wider">
                  Data Privacy Notice (RA 10173)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Personal information, academic records, and attached supporting documents provided in this application are collected and processed by Dingalan Community College OSAS solely for verifying scholarship qualifications and processing financial assistance grants in accordance with Republic Act No. 10173.
              </p>
              <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 dark:border-slate-600 focus:ring-amber-500 cursor-pointer shrink-0"
                />
                <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                  I understand and give consent to DCC OSAS to collect and process my personal data and documents for this scholarship application pursuant to RA 10173. *
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!privacyConsent}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-colors uppercase tracking-wider cursor-pointer"
            >
              Submit Scholarship Application
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};
