import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { requestPasswordResetOtp, verifyPasswordResetOtp } from '../../services/storage';
import { CollegeLogo } from '../common/CollegeLogo';
import {
  Mail,
  Key,
  ShieldCheck,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOtpVerified: (user: User) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onOtpVerified,
}) => {
  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(900); // 15 minutes = 900 seconds
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Expiration countdown timer during OTP step
  useEffect(() => {
    if (!isOpen || step !== 'OTP') return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const cdTimer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(cdTimer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your registered email address.');
      triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await requestPasswordResetOtp(cleanEmail);
      if (res.success && res.email) {
        setEmail(res.email);
        setStep('OTP');
        setOtp('');
        setSecondsLeft(15 * 60);
        setResendCooldown(45);
        setSuccessMessage(res.message);
      } else {
        setErrorMessage(res.message);
        triggerShake();
      }
    } catch {
      setErrorMessage('Unable to send verification OTP. Please try again later.');
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (secondsLeft <= 0) {
      setErrorMessage('The 6-digit verification code has expired. Please request a new OTP.');
      triggerShake();
      return;
    }

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      triggerShake();
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await verifyPasswordResetOtp(email, cleanOtp);

      if (result.valid && result.user) {
        // Successful verification! Pass the student user to open the existing UpdatePasswordModal
        onOtpVerified(result.user);
      } else {
        setErrorMessage(result.message);
        triggerShake();
      }
    } catch {
      setErrorMessage('Failed to verify OTP. Please try again.');
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setErrorMessage('');
    setSuccessMessage('');

    try {
      setIsSubmitting(true);
      const res = await requestPasswordResetOtp(email);
      if (res.success) {
        setOtp('');
        setSecondsLeft(15 * 60);
        setResendCooldown(45);
        setSuccessMessage('A fresh 6-digit verification OTP has been dispatched to your email.');
      } else {
        setErrorMessage(res.message);
        triggerShake();
      }
    } catch {
      setErrorMessage('Could not resend code. Please try again.');
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className={`relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-blue-200/80 dark:border-blue-900/60 flex flex-col overflow-hidden ${
          isShaking ? 'animate-shake' : 'animate-in zoom-in-95 duration-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Institutional Header Banner */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shrink-0 overflow-hidden">
          {/* Decorative Glows */}
          <div className="absolute -right-10 -top-10 w-36 h-36 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-16 -bottom-8 w-28 h-28 bg-sky-300/15 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-2xl border border-white/20 shadow-inner backdrop-blur-xs">
                <CollegeLogo className="w-9 h-9" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="px-2 py-0.5 bg-amber-400/20 border border-amber-300/40 text-amber-300 text-[10px] font-black uppercase tracking-wider rounded-md">
                    Password Recovery
                  </span>
                  <span className="text-[10px] text-blue-200 font-medium">OTP Verification</span>
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wide">
                  Forgot Password?
                </h3>
                <p className="text-xs text-blue-100/90 font-medium">
                  Dingalan Community College • OSAS Portal
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-rose-100 hover:text-white bg-red-600/85 hover:bg-red-600 active:bg-red-700 rounded-xl transition-all cursor-pointer border border-red-400/40 shadow-sm"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh] custom-scrollbar text-slate-800 dark:text-slate-200 space-y-4">
          {/* Security Notice */}
          <div className="p-3 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-start gap-2.5 text-xs text-blue-950 dark:text-blue-200 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-900 dark:text-blue-100">
                Identity Verification Required
              </p>
              <p className="text-[11px] text-blue-800/90 dark:text-blue-300">
                {step === 'EMAIL'
                  ? 'Enter your registered student email address. We will verify your account and dispatch a 6-digit One-Time Password (OTP).'
                  : 'Check your email inbox for the 6-digit OTP code. Enter the code below to verify your student account.'}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* STEP 1: Enter Registered Email */}
          {step === 'EMAIL' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Registered Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="student@gmail.com or official student email"
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-slate-50/60 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className={`w-full py-3 px-4 rounded-xl text-white font-bold text-xs shadow-md uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    !isSubmitting && email.trim()
                      ? 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900 shadow-blue-500/25'
                      : 'bg-slate-400 dark:bg-slate-700 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending Verification OTP...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send Verification OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit OTP */}
          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Enter 6-Digit Verification OTP <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTime(secondsLeft)}</span>
                  </div>
                </div>

                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(digits);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-2.5 text-base font-bold text-center tracking-widest font-mono border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-slate-50/60 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 text-center">
                  Enter the 6 digits sent to <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>. One-time use only.
                </p>
              </div>

              {/* Verify OTP Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || otp.length !== 6 || secondsLeft <= 0}
                  className={`w-full py-3 px-4 rounded-xl text-white font-bold text-xs shadow-md uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    !isSubmitting && otp.length === 6 && secondsLeft > 0
                      ? 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900 shadow-blue-500/25'
                      : 'bg-slate-400 dark:bg-slate-700 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify Code & Proceed</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Resend and Back Options */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('EMAIL');
                    setOtp('');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1 font-medium"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Change Email
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isSubmitting}
                  className={`flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                    resendCooldown > 0
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-blue-600 dark:text-blue-400 hover:underline'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
