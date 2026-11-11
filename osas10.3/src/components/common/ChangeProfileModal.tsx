import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { updateUserProfile } from '../../services/storage';
import { compressImage } from '../../utils/imageCompressor';
import { X, Upload, Check, UserCircle, Lock, Phone, GraduationCap, Building } from 'lucide-react';

interface ChangeProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (updatedUser: User) => void;
}

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Adrian',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Chloe',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Noah',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Isabella',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Ethan',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Amara',
];

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduated'];
const SECTIONS = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'];

export const ChangeProfileModal: React.FC<ChangeProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdateUser,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatarUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [contactNumber, setContactNumber] = useState(user.contactNumber || '');
  const [yearLevel, setYearLevel] = useState(user.yearLevel || '1st Year');
  const [section, setSection] = useState(user.section || '1A');

  useEffect(() => {
    if (isOpen) {
      setSelectedAvatar(user.avatarUrl);
      setContactNumber(user.contactNumber || '');
      setYearLevel(user.yearLevel || '1st Year');
      setSection(user.section || '1A');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await compressImage(reader.result, 250, 250, 0.7);
          setSelectedAvatar(compressed);
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const updates: Partial<User> = {
      avatarUrl: selectedAvatar,
      contactNumber: contactNumber.trim(),
    };

    if (user.role === 'STUDENT') {
      updates.yearLevel = yearLevel;
      updates.section = section;
    }

    const updated = updateUserProfile(user.id, updates);
    if (updated) {
      onUpdateUser(updated);
    } else {
      onUpdateUser({ ...user, ...updates });
    }
    onClose();
  };

  const isStudent = user.role === 'STUDENT';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {isStudent ? 'Student Profile & Settings' : 'Change Profile'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Preview */}
        <div className="flex flex-col items-center justify-center space-y-1.5 py-1">
          <div className="relative w-20 h-20 rounded-full ring-4 ring-blue-600/20 overflow-hidden shadow-md bg-slate-100 dark:bg-slate-800">
            <img src={selectedAvatar} alt="Profile Preview" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{user.fullName}</span>
          {isStudent && (
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              Student ID: {user.studentId || user.id}
            </span>
          )}
        </div>

        {/* If Student: Official Read-Only Information Notice & Fields */}
        {isStudent && (
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Official Student Record (Read-Only)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Full Legal Name</label>
                <input
                  type="text"
                  value={user.fullName}
                  disabled
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 cursor-not-allowed font-medium text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Student ID Number</label>
                <input
                  type="text"
                  value={user.studentId || user.id}
                  disabled
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 cursor-not-allowed font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Course / Degree Program</label>
                <input
                  type="text"
                  value={user.course || 'BS Information Technology'}
                  disabled
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 cursor-not-allowed text-xs font-medium truncate"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Email Address</label>
                <input
                  type="text"
                  value={user.email}
                  disabled
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 cursor-not-allowed text-xs font-medium truncate"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Permanent Address</label>
                <input
                  type="text"
                  value={user.address || user.permanentAddress || 'Dingalan, Aurora'}
                  disabled
                  className="w-full mt-0.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 cursor-not-allowed text-xs font-medium truncate"
                />
              </div>
            </div>
          </div>
        )}

        {/* Editable Student Information: Contact Number & Year & Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
              {isStudent ? 'Editable Student Details' : 'Contact Information'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Contact Number */}
            <div className={isStudent ? 'sm:col-span-2' : 'sm:col-span-2'}>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-600" /> Contact Number (Editable)
              </label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. 09171234567"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs font-medium"
              />
              <p className="text-[10px] text-slate-500 mt-1">Used for emergency broadcasts and counselor communications.</p>
            </div>

            {/* Year Level & Section (Editable for Student) */}
            {isStudent && (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-600" /> Year Level (Editable)
                  </label>
                  <select
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs font-medium"
                  >
                    {YEAR_LEVELS.map((yl) => (
                      <option key={yl} value={yl}>
                        {yl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-600" /> Section (Editable)
                  </label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs font-medium"
                  >
                    {SECTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Device File Upload Option */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Profile Avatar Image
          </label>
          <label className="flex items-center justify-center gap-2 w-full p-2.5 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-600 dark:hover:border-blue-500 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors">
            <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isUploading ? 'Processing File...' : 'Choose Custom Photo from Device'}
            </span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Preset Avatars Selection */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
              Or Choose Preset Cartoon Avatar
            </label>
            <span className="text-[10px] font-medium text-slate-400">18 options</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 max-h-32 overflow-y-auto p-1.5 custom-scrollbar bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60">
            {PRESET_AVATARS.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedAvatar(url)}
                className={`relative rounded-lg overflow-hidden aspect-square border-2 transition-all cursor-pointer bg-slate-100 dark:bg-slate-800 ${
                  selectedAvatar === url
                    ? 'border-blue-600 ring-2 ring-blue-600/30 scale-95 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                {selectedAvatar === url && (
                  <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5 drop-shadow-md" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
};
