import React from 'react';
import { SlipNotice } from '../../types';
import { Modal } from './Modal';
import { CollegeLogo } from './CollegeLogo';
import { Calendar, Clock, HeartHandshake, User, CheckCircle2, FileText, Check } from 'lucide-react';

interface SlipNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  slipNotice: SlipNotice | null;
}

export const SlipNoticeModal: React.FC<SlipNoticeModalProps> = ({
  isOpen,
  onClose,
  slipNotice,
}) => {
  if (!isOpen || !slipNotice) return null;

  const isOsasSender =
    slipNotice.counselorTitle?.toLowerCase().includes('osas') ||
    slipNotice.counselorName?.toLowerCase().includes('ruzol');

  const formatGuidanceSlipCourseLevel = (course?: string, yearLevel?: string): string => {
    const deduplicateTokens = (input: string): string => {
      let cleaned = input.replace(/\s+/g, ' ').trim();
      if (!cleaned) return '';

      // Deduplicate hyphen-separated segments where a trailing segment repeats an earlier token/suffix
      const parts = cleaned
        .split(/\s*-\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
      const uniqueParts: string[] = [];
      for (const part of parts) {
        const prev = uniqueParts[uniqueParts.length - 1];
        if (
          prev &&
          (prev.toLowerCase() === part.toLowerCase() ||
            prev.toLowerCase().endsWith(` ${part.toLowerCase()}`))
        ) {
          continue;
        }
        uniqueParts.push(part);
      }
      cleaned = uniqueParts.join(' - ');

      // Collapse consecutive duplicate words/phrases (e.g. "BS Entrepreneurship 4B 4B" -> "BS Entrepreneurship 4B")
      let prevStr = '';
      while (prevStr !== cleaned) {
        prevStr = cleaned;
        cleaned = cleaned.replace(/\b(\S+(?:\s+\S+){0,2})\s+\1\b/gi, '$1').trim();
      }
      return cleaned;
    };

    const baseCourse = deduplicateTokens(course || '');
    const baseYear = deduplicateTokens(yearLevel || '');

    if (!baseCourse && !baseYear) return 'N/A';
    if (!baseCourse) return baseYear;
    if (!baseYear) return baseCourse;

    const lowerCourse = baseCourse.toLowerCase();
    const lowerYear = baseYear.toLowerCase();
    if (
      lowerCourse === lowerYear ||
      lowerCourse.endsWith(` ${lowerYear}`) ||
      lowerCourse.endsWith(`-${lowerYear}`) ||
      lowerCourse.includes(` ${lowerYear} `)
    ) {
      return baseCourse;
    }

    return deduplicateTokens(`${baseCourse} - ${baseYear}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isOsasSender
          ? 'Official Office of Student Affairs & Services (OSAS) Slip Notice'
          : 'Official Guidance & Counseling Slip Notice'
      }
      subtitle={`Reference #${slipNotice.id} • Issued on ${slipNotice.dateSent}`}
      maxWidth="md"
    >
      <div className="space-y-5 text-slate-800 dark:text-slate-100">
        {/* DCC Official Institutional Header */}
        <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
          <div className="w-16 h-16 flex items-center justify-center mb-1">
            <CollegeLogo className="w-14 h-14 object-contain" />
          </div>
          <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase">
            Dingalan Community College
          </h2>
          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
            {isOsasSender
              ? 'Office of Student Affairs and Services (OSAS)'
              : 'Guidance and Counseling Office'}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Dingalan, Aurora • Student Welfare and Development
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-700/60 text-[10px] font-black uppercase tracking-wider">
            <HeartHandshake className="w-3.5 h-3.5" /> Call Slip Notice
          </div>
        </div>

        {/* Date Sent */}
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-slate-500 dark:text-slate-400">Date Sent:</span>
          <span className="font-mono font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200">
            {slipNotice.dateSent}
          </span>
        </div>

        {/* Dear: Student Information Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Dear:</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              {slipNotice.studentName}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
            {slipNotice.studentId && (
              <div>
                <span className="text-slate-400 text-[10px] block">Student ID:</span>
                <span className="font-mono font-bold">{slipNotice.studentId}</span>
              </div>
            )}
            {(slipNotice.course || slipNotice.yearLevel) && (
              <div>
                <span className="text-slate-400 text-[10px] block">Course &amp; Level:</span>
                <span className="font-semibold">
                  {isOsasSender
                    ? `${slipNotice.course || 'N/A'}${slipNotice.yearLevel ? ` - ${slipNotice.yearLevel}` : ''}`
                    : formatGuidanceSlipCourseLevel(slipNotice.course, slipNotice.yearLevel)}
                </span>
              </div>
            )}
            {slipNotice.contactNumber && (
              <div>
                <span className="text-slate-400 text-[10px] block">Contact Number:</span>
                <span className="font-mono font-semibold">{slipNotice.contactNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Call to Visit Text with Editable Date and Time */}
        <div className="p-4 bg-blue-50/60 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60 space-y-3">
          <p className="text-xs font-bold text-blue-950 dark:text-blue-200 leading-relaxed">
            {isOsasSender
              ? 'Kindly visit me at the Office of Student Affairs and Services (OSAS) on:'
              : 'Kindly visit me at the Guidance and Counseling Office on:'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Date</span>
                <span className="font-black text-slate-900 dark:text-white">{slipNotice.visitDate}</span>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Time</span>
                <span className="font-black text-slate-900 dark:text-white">{slipNotice.visitTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* For: Purpose Checkboxes / Tags */}
        <div className="space-y-2">
          <label className="block text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            For:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              'Counseling',
              'Assessment',
              'Meeting/Conference',
              'Other Services',
            ].map((purpose) => {
              const isSelected =
                (slipNotice.purposes || []).includes(purpose) ||
                (purpose === 'Other Services' &&
                  (slipNotice.purposes || []).some((p) => p.startsWith('Other Services')));
              return (
                <div
                  key={purpose}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-colors ${
                    isSelected
                      ? 'bg-amber-100/80 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-60'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-amber-600 text-white'
                        : 'border border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="truncate">{purpose}</span>
                </div>
              );
            })}
          </div>
          {(() => {
            const customOther = (slipNotice.purposes || []).find((p) =>
              p.startsWith('Other Services:')
            );
            if (!customOther) return null;
            return (
              <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-950 dark:text-amber-100">
                {customOther}
              </div>
            );
          })()}
        </div>

        {slipNotice.notes && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Additional Notes</span>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{slipNotice.notes}</p>
          </div>
        )}

        {/* Closing & Sender Signature Line */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 italic">
            Thank you very much.
          </p>

          <div className="text-right">
            <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {slipNotice.counselorName || (isOsasSender ? 'Princess Ann T. Ruzol' : 'Maria Mel B. Glemao')}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              {isOsasSender
                ? 'OSAS Administrator'
                : slipNotice.counselorTitle
                ? slipNotice.counselorTitle
                    .replace('Guidance Counselor / Advocate', 'Guidance Advocate')
                    .replace('Guidance Counselor', 'Guidance Advocate')
                : 'Guidance Advocate'}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Dingalan Community College
            </p>
          </div>
        </div>

        {/* Modal Close Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
