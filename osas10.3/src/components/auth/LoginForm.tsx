import React, { useState, useEffect, useMemo } from 'react';
import { User, Announcement } from '../../types';
import { getUsers, getAnnouncements, getScholarships, getSystemLogo, findUserAsync, fetchServerState } from '../../services/storage';
import { verifyUserCredentials } from '../../utils/security';
import { UpdatePasswordModal } from './UpdatePasswordModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { DataPrivacyAndCookieModal } from '../common/DataPrivacyAndCookieModal';
import { Lock, Mail, ExternalLink, Calendar, Eye, EyeOff, ChevronLeft, ChevronRight, Megaphone, CheckCircle2, ShieldCheck, Cookie, Info, X, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess?: (user: User) => void;
  onLogin?: (user: User) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [passwordResetSuccessMsg, setPasswordResetSuccessMsg] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [systemLogo, setSystemLogoState] = useState<string>(() => getSystemLogo());
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => getAnnouncements());
  const [firstLoginUser, setFirstLoginUser] = useState<User | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyTab, setPrivacyTab] = useState<'privacy' | 'cookies'>('privacy');
  const [cookieConsentAcknowledged, setCookieConsentAcknowledged] = useState(() => {
    try {
      return localStorage.getItem('osas_cookie_consent') === 'acknowledged';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    fetchServerState().catch(() => {});

    const handleStorageUpdate = () => {
      setSystemLogoState(getSystemLogo());
      setAnnouncements(getAnnouncements());
    };

    window.addEventListener('osas_storage_updated', handleStorageUpdate);
    window.addEventListener('osas_logo_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('osas_storage_updated', handleStorageUpdate);
      window.removeEventListener('osas_logo_updated', handleStorageUpdate);
    };
  }, []);

  // Automatically display all available announcements, including active scholarship grants
  const activeAnnouncements = useMemo(() => {
    const raw = announcements;
    const schs = getScholarships().filter((s) => s.status === 'ACTIVE');
    const schAncs: Announcement[] = schs
      .filter((s) => !raw.some((a) => a.scholarshipId === s.id || a.title.toLowerCase().trim() === s.title.toLowerCase().trim()))
      .map((s) => ({
        id: `anc-sch-${s.id}`,
        title: s.title,
        content: s.description
          ? `${s.description}\n\nGrant: ${s.amount || 'Tuition Subsidy'}\nDeadline: ${s.deadline}`
          : (s.requirements || 'Open scholarship program.'),
        category: 'SCHOLARSHIP' as const,
        createdAt: s.createdAt || new Date().toISOString(),
        expirationDate: s.deadline || 'Ongoing',
        imageUrl: s.imageUrl,
        scholarshipId: s.id,
        postedBy: 'Princess Ann T. Ruzol',
      }));
    const combined = [...raw, ...schAncs];
    return combined.length > 0 ? combined : raw;
  }, [announcements]);

  const activeSlideIndex = activeAnnouncements.length > 0 ? Math.min(currentSlide, activeAnnouncements.length - 1) : 0;

  // Auto-advance announcement carousel
  useEffect(() => {
    if (activeAnnouncements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeAnnouncements.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [activeAnnouncements.length]);

  const handleAuthSuccess = (user: User) => {
    if (onLoginSuccess) onLoginSuccess(user);
    if (onLogin) onLogin(user);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsVerifying(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();

    try {
      // Find user locally or fetch directly from Firestore centralized store (passing password/OTP for exact candidate resolution)
      const found = await findUserAsync(cleanEmail, cleanPassword);

      if (!found) {
        setErrorMsg('User account not found. Please check your Email or Student ID.');
        return;
      }

      if (found.isSuspended) {
        setErrorMsg('⛔ This account has been SUSPENDED by OSAS Admin. Access is blocked.');
        return;
      }

      const isPasswordValid = await verifyUserCredentials(cleanPassword, found);

      if (isPasswordValid) {
        // If the student is logging in for the first time with a temporary password/OTP
        if (found.mustChangePassword) {
          setFirstLoginUser(found);
        } else {
          handleAuthSuccess(found);
        }
      } else {
        setErrorMsg('Invalid password or OTP code. Access denied.');
      }
    } catch {
      setErrorMsg('Authentication error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const hasAnnouncements = activeAnnouncements.length > 0;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden custom-scrollbar">
      {/* Soft Non-Textured Ambient Radial Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/10 rounded-full blur-3xl pointer-events-none" />

      <div
        className={`relative w-full ${
          hasAnnouncements ? 'max-w-5xl' : 'max-w-md'
        } z-10 flex flex-col ${
          hasAnnouncements ? 'lg:flex-row' : ''
        } items-stretch justify-center gap-6 my-auto transition-all duration-300`}
      >
        {/* Left Side (or Center if no announcements): Main Login Card */}
        <div className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/40 dark:border-slate-800 p-6 sm:p-8 space-y-6 flex-1 flex flex-col justify-between ${hasAnnouncements ? 'lg:w-1/2' : 'w-full'}`}>
          <div className="space-y-6">
            {/* Header Branding with Official App Icon Frame */}
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center mb-1">
                <div className="relative group p-3 bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 rounded-3xl shadow-xl border-2 border-blue-400/40 transform transition-all hover:scale-105">
                  <img
                    src={systemLogo}
                    alt="DCC OSAS System App Icon"
                    className="w-16 h-16 object-contain filter drop-shadow-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/dcc_logo.svg';
                    }}
                  />
                </div>
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-black text-blue-700 dark:text-blue-400 tracking-wider uppercase drop-shadow-xs mb-1 font-sans">
                  STU-SERVE
                </h1>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-wider uppercase">
                  DINGALAN COMMUNITY COLLEGE
                </h2>
                <p className="text-[11px] sm:text-xs text-blue-800 dark:text-blue-400 font-extrabold uppercase tracking-widest max-w-md mx-auto">
                  Office of Student Affairs & Services (OSAS)
                </p>
              </div>
            </div>

            {/* System Online & Network Sync Status Indicator */}
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>System Status:</span>
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized Across Devices
              </span>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl border border-red-200 dark:border-red-800 text-center animate-shake">
                  {errorMsg}
                </div>
              )}

              {passwordResetSuccessMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-800 text-center animate-in fade-in">
                  {passwordResetSuccessMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Email Address or Student ID
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (passwordResetSuccessMsg) setPasswordResetSuccessMsg('');
                    }}
                    placeholder="osasadmin@gmail.com or 2026-000001"
                    className="w-full pl-10 pr-4 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-slate-50/60 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                  Password / OTP
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordResetSuccessMsg) setPasswordResetSuccessMsg('');
                    }}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-slate-50/60 dark:bg-slate-800 dark:text-white"
                  />
                  {/* Password Eye Toggle Icon */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link centered above the Login button */}
              <div className="flex justify-center pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setPasswordResetSuccessMsg('');
                    setIsForgotPasswordOpen(true);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 px-4 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-600 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all uppercase tracking-wider mt-2 cursor-pointer flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Signing in to Portal...</span>
                  </>
                ) : (
                  <span>Sign In to Portal</span>
                )}
              </button>

        
            </form>
          </div>
        </div>

        {/* Right Side: Announcement Carousel (Rendered only when announcements exist) */}
        {hasAnnouncements && (
          <div className="w-full lg:w-1/2 bg-slate-800/85 dark:bg-slate-900/90 backdrop-blur-md text-white rounded-3xl shadow-2xl border border-blue-400/40 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Carousel Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400 animate-bounce" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100">
                  Campus Bulletins & Announcements
                </h3>
              </div>
              <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full font-bold">
                {activeSlideIndex + 1} / {activeAnnouncements.length}
              </span>
            </div>

            {/* Carousel Active Slide */}
            <div className="flex-1 flex flex-col justify-center space-y-4 my-auto relative z-10">
              {activeAnnouncements[activeSlideIndex]?.imageUrl && (
                <img
                  src={activeAnnouncements[activeSlideIndex].imageUrl}
                  alt={activeAnnouncements[activeSlideIndex].title}
                  className="w-full h-44 sm:h-48 object-cover rounded-2xl border border-slate-700 shadow-md"
                />
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                      activeAnnouncements[activeSlideIndex]?.category === 'SCHOLARSHIP'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : activeAnnouncements[activeSlideIndex]?.category === 'DORMITORY'
                        ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                        : activeAnnouncements[activeSlideIndex]?.category === 'GUIDANCE'
                        ? 'bg-purple-400/20 text-purple-300 border border-purple-400/30'
                        : 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                    }`}
                  >
                    {activeAnnouncements[activeSlideIndex]?.category}
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {new Date(activeAnnouncements[activeSlideIndex]?.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>

                <h4 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {activeAnnouncements[activeSlideIndex]?.title}
                </h4>

                <p className="text-xs text-slate-300 line-clamp-4 leading-relaxed whitespace-pre-line">
                  {activeAnnouncements[activeSlideIndex]?.content}
                </p>

                {activeAnnouncements[activeSlideIndex]?.externalLink && (
                  <a
                    href={activeAnnouncements[activeSlideIndex].externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline pt-1"
                  >
                    Open Link Details <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Carousel Navigation Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 mt-4 relative z-10">
              <div className="flex items-center gap-1.5">
                {activeAnnouncements.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === activeSlideIndex ? 'w-6 bg-blue-500' : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                    title={`Slide ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentSlide((prev) => (prev === 0 ? activeAnnouncements.length - 1 : prev - 1))
                  }
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer border border-slate-700"
                  title="Previous Bulletin"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentSlide((prev) => (prev + 1) % activeAnnouncements.length)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer border border-slate-700"
                  title="Next Bulletin"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Data Privacy Compliance Links */}
      <div className="relative z-10 mt-6 text-center text-xs text-white/80 space-y-1.5 max-w-lg">
        <p className="text-[11px] font-medium text-white/90">
          Protected by Dingalan Community College Data Privacy Policy (Republic Act No. 10173).
        </p>
        <div className="flex items-center justify-center gap-3 text-[11px]">
          <button
            type="button"
            onClick={() => {
              setPrivacyTab('privacy');
              setShowPrivacyModal(true);
            }}
            className="hover:text-white underline font-semibold transition-colors cursor-pointer flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Data Privacy Notice (RA 10173)</span>
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => {
              setPrivacyTab('cookies');
              setShowPrivacyModal(true);
            }}
            className="hover:text-white underline font-semibold transition-colors cursor-pointer flex items-center gap-1"
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>Cookie & Storage Policy</span>
          </button>
        </div>
      </div>

      {/* Non-intrusive Cookie & Storage Notice Floating Banner */}
      {!cookieConsentAcknowledged && (
        <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto z-50 bg-slate-900/95 backdrop-blur-md text-white border border-blue-400/40 p-3.5 sm:p-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-start gap-2.5">
            <Cookie className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-200 leading-relaxed">
              This portal uses <strong>strictly necessary session storage</strong> for authentication security and offline synchronization pursuant to the <strong>Data Privacy Act of 2012 (RA 10173)</strong>. We do not use third-party tracking or advertising cookies.
            </p>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-2 self-center sm:self-center shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setPrivacyTab('cookies');
                setShowPrivacyModal(true);
              }}
              className="px-3 py-1.5 text-[11px] font-bold text-blue-300 hover:text-blue-200 underline cursor-pointer"
            >
              Learn More
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('osas_cookie_consent', 'acknowledged');
                setCookieConsentAcknowledged(true);
              }}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Data Privacy & Cookie Policy Modal */}
      {showPrivacyModal && (
        <DataPrivacyAndCookieModal
          isOpen={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          defaultTab={privacyTab}
        />
      )}

      {/* First-Time Login Password Update Modal with subtle blurred backdrop */}
      {firstLoginUser && (
        <UpdatePasswordModal
          user={firstLoginUser}
          isOpen={Boolean(firstLoginUser)}
          onSuccess={(updatedUser) => {
            setFirstLoginUser(null);
            handleAuthSuccess(updatedUser);
          }}
          onCancel={() => {
            setFirstLoginUser(null);
            setPassword('');
          }}
        />
      )}

      {/* Forgot Password OTP Verification Modal */}
      {isForgotPasswordOpen && (
        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
          onOtpVerified={(verifiedUser) => {
            setIsForgotPasswordOpen(false);
            setResetPasswordUser(verifiedUser);
          }}
        />
      )}

      {/* Reset Password Modal using the exact existing UpdatePasswordModal */}
      {resetPasswordUser && (
        <UpdatePasswordModal
          user={resetPasswordUser}
          isOpen={Boolean(resetPasswordUser)}
          titleBadge="Password Recovery"
          titleText="OTP Verified"
          descriptionText={
            resetPasswordUser.role === 'ADMIN'
              ? 'Your identity has been verified with your 6-digit OTP code. Please create a new strong password for your administrator account.'
              : 'Your identity has been verified with your 6-digit OTP code. Please create a new strong password for your student account.'
          }
          onSuccess={(updatedUser) => {
            setResetPasswordUser(null);
            setPassword('');
            setEmail(updatedUser.email);
            setPasswordResetSuccessMsg(
              '✅ Matagumpay na na-update ang iyong password! Tanging ang bagong password na lamang ang tatanggapin ng system. Pakipasok ang iyong bagong password upang mag-login.'
            );
          }}
          onCancel={() => {
            setResetPasswordUser(null);
          }}
        />
      )}
    </div>
  );
};
