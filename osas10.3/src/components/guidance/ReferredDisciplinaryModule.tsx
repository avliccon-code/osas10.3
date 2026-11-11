import React, { useState, useEffect } from 'react';
import {
  getReferredDisciplinaryRecords,
  updateGuidanceDisciplinaryAction,
} from '../../services/storage';
import { DisciplinaryRecord, GuidanceCaseStatus, User } from '../../types';
import { Modal } from '../common/Modal';
import { CollegeLogo } from '../common/CollegeLogo';
import {
  AlertOctagon,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  Printer,
  HeartHandshake,
  Tag,
  User as UserIcon,
  Shield,
  FileText,
  Calendar,
  Check,
  RotateCcw,
  Sparkles,
  Lock,
  MessageSquare,
  Award,
} from 'lucide-react';

interface ReferredDisciplinaryModuleProps {
  currentUser?: User;
}

export const ReferredDisciplinaryModule: React.FC<ReferredDisciplinaryModuleProps> = ({ currentUser }) => {
  const [records, setRecords] = useState<DisciplinaryRecord[]>(() => getReferredDisciplinaryRecords());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [selectedRecord, setSelectedRecord] = useState<DisciplinaryRecord | null>(null);
  const [printRecord, setPrintRecord] = useState<DisciplinaryRecord | null>(null);

  const handleDirectPrintRecord = (rec: DisciplinaryRecord) => {
    setPrintRecord(rec);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintRecord(null), 500);
    }, 50);
  };

  // Edit action form
  const [guidanceNotes, setGuidanceNotes] = useState('');
  const [guidanceConfidentialNotes, setGuidanceConfidentialNotes] = useState('');
  const [guidanceActionTaken, setGuidanceActionTaken] = useState('');
  const [guidanceOutcomeSummary, setGuidanceOutcomeSummary] = useState('');
  const [guidanceStatus, setGuidanceStatus] = useState<GuidanceCaseStatus>('REFERRED');
  const [guidanceCounselorAssigned, setGuidanceCounselorAssigned] = useState('');
  const [guidanceSessionsCount, setGuidanceSessionsCount] = useState<number>(0);

  const refreshRecords = () => {
    setRecords(getReferredDisciplinaryRecords());
  };

  useEffect(() => {
    window.addEventListener('osas_storage_updated', refreshRecords);
    window.addEventListener('storage', refreshRecords);
    return () => {
      window.removeEventListener('osas_storage_updated', refreshRecords);
      window.removeEventListener('storage', refreshRecords);
    };
  }, []);

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.offenseType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.sanction && r.sanction.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.guidanceCounselorAssigned && r.guidanceCounselorAssigned.toLowerCase().includes(searchQuery.toLowerCase()));

    const currentStatus = r.guidanceStatus || 'REFERRED';
    const matchesStatus =
      statusFilter === 'ALL' ||
      currentStatus === statusFilter ||
      (statusFilter === 'REFERRED' && currentStatus === 'PENDING_COUNSELING');

    return matchesSearch && matchesStatus;
  });

  const handleOpenDetails = (rec: DisciplinaryRecord) => {
    setSelectedRecord(rec);
    setGuidanceNotes(rec.guidanceNotes || '');
    setGuidanceConfidentialNotes(rec.guidanceConfidentialNotes || '');
    setGuidanceActionTaken(rec.guidanceActionTaken || '');
    setGuidanceOutcomeSummary(rec.guidanceOutcomeSummary || '');
    setGuidanceStatus(
      rec.guidanceStatus === 'PENDING_COUNSELING' ? 'REFERRED' : rec.guidanceStatus || 'REFERRED'
    );
    setGuidanceCounselorAssigned(
      rec.guidanceCounselorAssigned || currentUser?.name || 'Guidance Counselor'
    );
    setGuidanceSessionsCount(rec.guidanceSessionCount || rec.guidanceSessionsCount || 0);
  };

  const handleSaveGuidanceAction = (customStatus?: GuidanceCaseStatus) => {
    if (!selectedRecord) return;
    const finalStatus = customStatus || guidanceStatus;
    updateGuidanceDisciplinaryAction(selectedRecord.id, {
      guidanceNotes,
      guidanceConfidentialNotes,
      guidanceActionTaken,
      guidanceOutcomeSummary,
      guidanceStatus: finalStatus,
      guidanceCounselorAssigned,
      guidanceSessionCount: guidanceSessionsCount,
      guidanceCompletionDate: finalStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
    });
    refreshRecords();
    setSelectedRecord(null);
  };

  const getStatusBadge = (status?: GuidanceCaseStatus) => {
    const s = status || 'REFERRED';
    switch (s) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
          </span>
        );
      case 'FOLLOW_UP':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
            <Clock className="w-3 h-3 text-purple-600" /> Follow-up Required
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" /> In Progress
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> Intake Received
          </span>
        );
      case 'REFERRED':
      case 'PENDING_COUNSELING':
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" /> Referred / Pending Intake
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 rounded-xl">
              <HeartHandshake className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Referred Intervention Cases
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Student intervention and behavioral referrals received from OSAS Admin for guidance counseling, rehabilitation, and psychosocial support.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>{records.length} Total Referred Cases</span>
          </span>
        </div>
      </div>



      {/* Main List Box */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Referral Management Registry
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Showing {filteredRecords.length} referred cases
            </p>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, offense, sanction, counselor..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 cursor-pointer"
            >
              <option value="ALL">All Guidance Statuses</option>
              <option value="REFERRED">Referred / Pending Intake</option>
              <option value="RECEIVED">Intake Received</option>
              <option value="IN_PROGRESS">In Progress (Active Sessions)</option>
              <option value="FOLLOW_UP">Follow-up Required</option>
              <option value="COMPLETED">Completed / Concluded</option>
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <HeartHandshake className="w-10 h-10 mx-auto mb-2 opacity-60 text-amber-500" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No referred intervention cases found.</p>
            <p className="text-[11px] text-slate-400">
              When OSAS Admin forwards student intervention cases, they will appear here for guidance counseling and rehabilitation follow-up.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRecords.map((rec) => {
              const gStatus = rec.guidanceStatus || 'REFERRED';
              return (
                <div
                  key={rec.id}
                  className="p-5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-600 transition-all flex flex-col justify-between gap-4 shadow-2xs"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column: Student & Description */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{rec.studentName}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">({rec.studentId})</span>
                        {getStatusBadge(rec.guidanceStatus)}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <strong className="text-slate-700 dark:text-slate-200 block text-[10px] uppercase">Description:</strong>
                        {rec.description}
                      </p>
                    </div>

                    {/* Right Column: Referred By & Directives */}
                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-3 md:pt-0 md:pl-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Referred By</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{rec.issuedBy || 'OSAS Admin'}</span>
                      </div>
                      {rec.guidanceReferralNotes && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">OSAS Referral Directives & Background</span>
                          <p className="text-slate-700 dark:text-slate-300 line-clamp-2 mt-0.5">{rec.guidanceReferralNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                    <button
                      onClick={() => handleOpenDetails(rec)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" /> Review and Manage Counseling
                    </button>
                    <button
                      onClick={() => handleDirectPrintRecord(rec)}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 font-bold text-xs"
                      title="Print Case Slip"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review & Guidance Action Modal */}
      {selectedRecord && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          title={`Guidance Counseling: ${selectedRecord.studentName} (${selectedRecord.studentId})`}
          subtitle={`Intervention Case #${selectedRecord.id} • Referred by OSAS Admin`}
          maxWidth="2xl"
        >
          <div className="space-y-4 p-1 text-xs max-h-[75vh] overflow-y-auto">
            {/* Case overview (OSAS Referral Information) */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="font-black text-slate-800 dark:text-slate-200 uppercase text-[11px] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-600" /> OSAS Referral Information
                </span>
                <span className="text-[11px] text-slate-500">Case ID: #{selectedRecord.id}</span>
              </div>

              <div className="space-y-3">
                {/* 1. Complete Student Information */}
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Complete Student Information:</span>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedRecord.studentName} ({selectedRecord.studentId || 'No ID'})</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Program / Course: <strong>{selectedRecord.course || 'N/A'}</strong> • Year Level: <strong>{selectedRecord.yearLevel || 'N/A'}</strong></p>
                  {selectedRecord.studentEmail && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">Email: <strong>{selectedRecord.studentEmail}</strong></p>
                  )}
                </div>

                {/* 2. Description Box */}
                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Description:</span>
                  <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                    {selectedRecord.descriptionOfConcerns || selectedRecord.description || 'N/A'}
                  </p>
                </div>

                {/* 2. Summary of Action Taken by OSAS Box */}
                <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900 text-amber-950 dark:text-amber-200 space-y-1.5 shadow-2xs">
                  <span className="text-[11px] font-black uppercase text-amber-900 dark:text-amber-300 block tracking-wider">
                    Summary of Action Taken by OSAS:
                  </span>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/60 text-slate-800 dark:text-slate-200">
                    {selectedRecord.summaryOfActionTaken || selectedRecord.actionTakenSummary || selectedRecord.guidanceReferralNotes || selectedRecord.notes || 'No prior OSAS action summary recorded.'}
                  </p>
                </div>

                {/* 3. Strategies Applied Box */}
                <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 space-y-2 shadow-2xs">
                  <span className="text-[11px] font-black uppercase text-indigo-900 dark:text-indigo-300 block tracking-wider">
                    Strategies Applied:
                  </span>
                  {(selectedRecord.strategies || selectedRecord.actionStrategies || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {(selectedRecord.strategies || selectedRecord.actionStrategies || []).map((s: string) => (
                        <span key={s} className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/70 text-indigo-900 dark:text-indigo-200 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                          {s === 'Others' && selectedRecord.strategiesOther ? `Other: ${selectedRecord.strategiesOther}` : s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400 text-xs italic bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60">
                      None specified
                    </p>
                  )}
                </div>

                {/* 4. Next Steps Box */}
                <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/60 space-y-1.5 shadow-2xs">
                  <span className="text-[11px] font-black uppercase text-blue-900 dark:text-blue-300 block tracking-wider">
                    Next Steps:
                  </span>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl border border-blue-200/60 dark:border-blue-900/60 text-slate-800 dark:text-slate-200 font-medium">
                    {selectedRecord.nextSteps || selectedRecord.guidanceFollowUpPlan || selectedRecord.actionPlan || 'No immediate next steps specified.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Referred By:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedRecord.issuedBy || selectedRecord.referredBy || 'OSAS Admin'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Guidance Action Form */}
            <div className="p-4 bg-amber-50/50 dark:bg-slate-800/80 rounded-2xl border border-amber-200 dark:border-slate-700 space-y-3.5">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4 text-amber-600" /> Guidance Counseling & Intervention Workflow
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Guidance Case Stage *
                  </label>
                  <select
                    value={guidanceStatus}
                    onChange={(e) => setGuidanceStatus(e.target.value as GuidanceCaseStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="REFERRED">REFERRED (Pending Counselor Intake)</option>
                    <option value="RECEIVED">RECEIVED (Intake Acknowledged & Scheduled)</option>
                    <option value="IN_PROGRESS">IN PROGRESS (Ongoing Counseling Sessions)</option>
                    <option value="FOLLOW_UP">FOLLOW UP (Monitoring & Post-Session Check-in)</option>
                    <option value="COMPLETED">COMPLETED (Rehabilitation Concluded)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sessions Conducted
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGuidanceSessionsCount(Math.max(0, guidanceSessionsCount - 1))}
                      className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-3 py-1.5 font-bold text-xs text-center flex-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-600">
                      {guidanceSessionsCount} Session(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => setGuidanceSessionsCount(guidanceSessionsCount + 1)}
                      className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Attending Guidance Counselor
                </label>
                <input
                  type="text"
                  value={guidanceCounselorAssigned}
                  onChange={(e) => setGuidanceCounselorAssigned(e.target.value)}
                  placeholder="e.g. Guidance Counselor Name, RGC"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Guidance Action Taken / Rehabilitation Program Rendered
                </label>
                <input
                  type="text"
                  value={guidanceActionTaken}
                  onChange={(e) => setGuidanceActionTaken(e.target.value)}
                  placeholder="e.g. Conducted 3 one-on-one sessions, signed behavioral agreement, stress management exercises"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              {/* Confidential Clinical Notes (GUIDANCE ONLY) */}
              <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                    <span>Confidential Clinical & Counseling Notes (Guidance Admin Only)</span>
                  </label>
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">
                    🔒 Not shared with OSAS
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={guidanceConfidentialNotes || guidanceNotes}
                  onChange={(e) => {
                    setGuidanceConfidentialNotes(e.target.value);
                    setGuidanceNotes(e.target.value);
                  }}
                  placeholder="Document student mental state, therapeutic insights, psychological observations, and internal reflection notes..."
                  className="w-full p-2.5 text-xs border border-rose-200 dark:border-rose-800 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {/* Official Outcome Summary (SHARED WITH OSAS ADMIN) */}
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/60 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Official Outcome Summary & Recommendation (Shared with OSAS Admin)</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    📢 Visible to OSAS Admin
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={guidanceOutcomeSummary}
                  onChange={(e) => setGuidanceOutcomeSummary(e.target.value)}
                  placeholder="Provide non-confidential administrative outcome (e.g., 'Student successfully attended 3 counseling sessions and exhibited remorse. Recommended for sanction clearance.')..."
                  className="w-full p-2.5 text-xs border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveGuidanceAction()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save Guidance Action & Notes
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Direct Final Printable Slip */}
      {printRecord && (
        <div className="direct-print-container">
          <div id="printable-referred-disciplinary-slip" className="printable-document flex flex-col justify-between min-h-0 sm:min-h-[1020px] print:min-h-screen print:h-full p-4 sm:p-6 bg-white text-slate-900 border border-slate-200 rounded-2xl space-y-4 print:border-none print:shadow-none print:p-0">
            <div className="printable-body flex-1 space-y-4">
                <div className="text-center border-b border-slate-200 pb-3">
                  <CollegeLogo className="w-12 h-12 mx-auto mb-1" />
                  <h3 className="text-sm font-black text-slate-900 uppercase">Dingalan Community College</h3>
                  <p className="text-[10px] text-slate-500">Office of Guidance &amp; Counseling Services</p>
                  <p className="text-xs font-bold text-amber-700 uppercase mt-2">
                    Disciplinary Case Guidance Rehabilitation Slip
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-bold text-slate-400 block text-[10px] uppercase">Student Name</span>
                    <span className="font-bold text-slate-800">{printRecord.studentName}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block text-[10px] uppercase">Student ID</span>
                    <span className="font-mono text-slate-800">{printRecord.studentId}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block text-[10px] uppercase">Offense Classification</span>
                    <span className="font-bold text-red-700">{printRecord.offenseType}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block text-[10px] uppercase">Guidance Stage</span>
                    <span className="font-bold text-slate-800">
                      {(printRecord.guidanceStatus || 'REFERRED').replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2 space-y-2">
                  <div>
                    <span className="font-bold text-slate-400 block text-[10px] uppercase">Imposed Sanction (OSAS)</span>
                    <p className="text-slate-700">{printRecord.sanction}</p>
                  </div>
                  {printRecord.guidanceActionTaken && (
                    <div>
                      <span className="font-bold text-slate-400 block text-[10px] uppercase">Guidance Action Taken</span>
                      <p className="text-slate-700">{printRecord.guidanceActionTaken}</p>
                    </div>
                  )}
                  {printRecord.guidanceOutcomeSummary && (
                    <div>
                      <span className="font-bold text-slate-400 block text-[10px] uppercase">Official Outcome Summary</span>
                      <p className="text-slate-700">{printRecord.guidanceOutcomeSummary}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="printable-footer-block mt-auto shrink-0 pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs items-end">
                <div>
                  <div className="border-b border-slate-900 pb-1 font-bold">
                    {printRecord.studentName}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">Student Signature / Conforme</p>
                </div>
                <div>
                  <div className="border-b border-slate-900 pb-1 font-bold">
                    Guidance Advocate
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold">Guidance Advocate</p>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

