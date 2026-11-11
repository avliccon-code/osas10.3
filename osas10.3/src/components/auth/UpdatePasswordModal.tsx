import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { updateUserPassword } from '../../services/storage';
import { analyzePasswordStrength } from '../../utils/security';
import { CollegeLogo } from '../common/CollegeLogo';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ArrowRight,
  LogOut,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface UpdatePasswordModalProps {
  user: User;
  isOpen: boolean;
  onSuccess: (updatedUser: User) => void;
  onCancel: () => void;
  titleBadge?: string;
  titleText?: string;
  descriptionText?: string;
}

export const UpdatePasswordModal: React.FC<UpdatePasswordModalProps> = ({
  user,
  isOpen,
  onSuccess,
  onCancel,
  titleBadge = 'First-Time Login',
  titleText = 'Security Setup',
  descriptionText,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const strength = analyzePasswordStrength(newPassword);

  const isMatching =
    confirmPassword.length > 0 && newPassword.length > 0 && newPassword === confirmPassword;
  const isMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = strength.isStrong && isMatching && !isSubmitting;

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!strength.isStrong) {
      setErrorMessage('Password does not meet the Strong security requirements yet.');
      triggerShake();
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your new password.');
      triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await updateUserPassword(user, newPassword);
      if (updated) {
        onSuccess(updated);
      } else {
        setErrorMessage('Failed to update password. Please try again.');
        triggerShake();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An error occurred while updating your password.');
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className={`relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-blue-200/80 dark:border-blue-900/60 flex flex-col max-h-[92vh] overflow-hidden ${
          isShaking ? 'animate-shake' : 'animate-in zoom-in-95 duration-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Institutional Top Header Banner */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shrink-0 overflow-hidden">
          {/* Subtle Ambient Decorative Glows */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-20 -bottom-10 w-32 h-32 bg-sky-300/15 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20 shadow-inner backdrop-blur-xs">
                <CollegeLogo className="w-10 h-10" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="px-2 py-0.5 bg-amber-400/20 border border-amber-300/40 text-amber-300 text-[10px] font-black uppercase tracking-wider rounded-md">
                    {titleBadge}
                  </span>
                  <span className="text-[10px] text-blue-200 font-medium">{titleText}</span>
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">
                  Update Your Password
                </h3>
                <p className="text-xs text-blue-100/90 font-medium">
                  Dingalan Community College • OSAS Student Portal
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="p-2 text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-all cursor-pointer border border-red-400/50 shadow-md flex items-center justify-center shrink-0"
              title="Exit and Back to Login"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Student Account Target Identity Chip */}
          <div className="mt-3.5 pt-3 border-t border-blue-700/60 flex items-center justify-between text-xs text-blue-100">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-white truncate">{user.fullName}</span>
              <span className="text-blue-300 font-mono text-[11px]">({user.studentId || user.email})</span>
            </div>
            <span className="text-[10px] bg-blue-950/70 border border-blue-700/60 px-2 py-0.5 rounded-md font-semibold text-blue-200 shrink-0">
              Student Account
            </span>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar text-slate-800 dark:text-slate-200 space-y-5">
          {/* Security Notice Box */}
          <div className="p-3.5 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-start gap-3 text-xs leading-relaxed text-blue-950 dark:text-blue-200">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-900 dark:text-blue-100 mb-0.5">
                Protect Your Student Account
              </p>
              <p className="text-[11px] text-blue-800/90 dark:text-blue-300">
                {descriptionText ||
                  'You are logging in with a temporary One-Time Password (OTP). For your safety and data privacy, please create a new strong password before accessing your OSAS student records.'}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter your new secure password"
                  className="w-full pl-10 pr-10 py-2.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-slate-50/60 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Real-time 4-Bar Password Strength Meter */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                  Password Strength:
                </span>
                <span className={`font-black uppercase tracking-wider text-xs ${strength.textColorClass}`}>
                  {strength.label}
                </span>
              </div>

              {/* 4 Strength Progress Bars */}
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((barIndex) => {
                  const isFilled = strength.score >= barIndex;
                  return (
                    <div
                      key={barIndex}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isFilled ? strength.colorClass : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Real-Time Requirements Checklist */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Security Requirements Checklist
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {strength.requirements.map((req) => (
                  <div
                    key={req.id}
                    className={`flex items-center gap-2 transition-colors ${
                      req.met
                        ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                        : 'text-slate-500 dark:text-slate-400 font-normal'
                    }`}
                  >
                    {req.met ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      </div>
                    )}
                    <span className="text-[11px] leading-tight">{req.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Re-type your new password to confirm"
                  className={`w-full pl-10 pr-10 py-2.5 text-xs font-medium border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/60 dark:bg-slate-800 dark:text-white transition-colors ${
                    isMismatch
                      ? 'border-red-400 dark:border-red-700 focus:ring-red-500'
                      : isMatching
                      ? 'border-emerald-400 dark:border-emerald-700'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Match Status Feedback */}
              {isMismatch && (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 shrink-0" /> Passwords do not match
                </p>
              )}
              {isMatching && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Passwords match perfectly
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full py-3 px-4 rounded-xl text-white font-bold text-xs shadow-md uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  canSubmit
                    ? 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 shadow-blue-500/25 transform hover:-translate-y-0.5'
                    : 'bg-slate-400 dark:bg-slate-700 opacity-60 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Secure Password...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Update Password & Enter Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
