import React, { useState } from 'react';
import {
  getAnnouncements,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  archiveExpiredAnnouncements,
} from '../../services/storage';
import { Announcement, AnnouncementCategory } from '../../types';
import { compressImage } from '../../utils/imageCompressor';
import { ConfirmModal } from '../common/ConfirmModal';
import { Megaphone, Calendar, Trash2, Edit3, ExternalLink, Heart, Search, Mail, Send } from 'lucide-react';

interface AnnouncementsModuleProps {
  defaultCategory?: AnnouncementCategory;
  role?: 'ADMIN' | 'GUIDANCE_ADMIN';
}

export const AnnouncementsModule: React.FC<AnnouncementsModuleProps> = ({ defaultCategory, role }) => {
  const [announcements, setAnnouncements] = useState(() => {
    archiveExpiredAnnouncements();
    return getAnnouncements();
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>(
    defaultCategory || (role === 'GUIDANCE_ADMIN' ? 'GUIDANCE' : 'SCHOOL')
  );
  const [expirationDate, setExpirationDate] = useState(
    new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0]
  );
  const [imageUrl, setImageUrl] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [sendEmailNotification, setSendEmailNotification] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(
    role === 'GUIDANCE_ADMIN' ? 'GUIDANCE' : 'ALL'
  );

  // Confirm Modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const refreshList = () => {
    archiveExpiredAnnouncements();
    setAnnouncements(getAnnouncements());
  };

  React.useEffect(() => {
    window.addEventListener('osas_storage_updated', refreshList);
    return () => {
      window.removeEventListener('osas_storage_updated', refreshList);
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await compressImage(reader.result, 600, 400, 0.7);
          setImageUrl(compressed);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const posterName = role === 'GUIDANCE_ADMIN' || category === 'GUIDANCE' ? 'Maria Mel B. Glamau' : 'Princess Ann T. Ruzol (Admin)';
    if (editingId) {
      updateAnnouncement(
        editingId,
        { title, content, category, expirationDate, imageUrl, externalLink },
        posterName
      );
      setEditingId(null);
    } else {
      addAnnouncement(
        { title, content, category, expirationDate, imageUrl, externalLink, sendEmailNotification },
        posterName
      );
    }

    // Reset
    setTitle('');
    setContent('');
    setImageUrl('');
    setExternalLink('');
    refreshList();
  };

  const handleStartEdit = (anc: Announcement) => {
    setEditingId(anc.id);
    setTitle(anc.title);
    setContent(anc.content);
    setCategory(anc.category);
    setExpirationDate(anc.expirationDate);
    setImageUrl(anc.imageUrl || '');
    setExternalLink(anc.externalLink || '');
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteAnnouncement(deleteTargetId, 'Princess Ann T. Ruzol (Admin)');
      setDeleteTargetId(null);
      refreshList();
    }
  };

  const filteredAnnouncements = announcements.filter((anc) => {
    const matchesSearch =
      anc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      anc.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || anc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Create / Edit Form (Col 5) */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                {editingId ? 'Edit Announcement' : 'Post New Announcement'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Displays on student portal & login feed</p>
            </div>
          </div>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setTitle('');
                setContent('');
                setImageUrl('');
                setExternalLink('');
              }}
              className="text-xs text-red-600 hover:underline font-bold"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title..."
              className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white cursor-pointer"
              >
                <option value="SCHOOL">School Announcement</option>
                <option value="GUIDANCE">Guidance & Counseling</option>
                <option value="SCHOLARSHIP">Scholarship Announcement</option>
                <option value="DORMITORY">Dormitory Announcement</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Expiration Date *</label>
              <input
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Announcement Body Content *</label>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write detailed announcement information..."
              className="w-full p-3 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Upload Picture or URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Banner Image (File Upload or URL)</label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 dark:file:bg-purple-900/50 file:text-purple-700 dark:file:text-purple-300 hover:file:bg-purple-100 cursor-pointer"
              />
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Or paste image URL (https://...)"
                className="w-full px-3.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Optional External Link */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">External Web Link (Optional)</label>
            <input
              type="url"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://osas.edu/event-details"
              className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Send Email Notification Checkbox */}
          <div className="p-3 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/80 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <label htmlFor="sendEmailCheck" className="font-bold text-slate-800 dark:text-purple-100 cursor-pointer select-none">
                Dispatch Email Notification to Registered Students
              </label>
            </div>
            <input
              type="checkbox"
              id="sendEmailCheck"
              checked={sendEmailNotification}
              onChange={(e) => setSendEmailNotification(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors uppercase tracking-wider cursor-pointer"
          >
            {editingId ? 'Update Announcement' : 'Post Announcement'}
          </button>
        </form>
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Are you sure you want to delete this?"
        message="Are you sure you want to delete this? Deleting this announcement will move it to System Settings > System Archive."
        confirmText="Yes"
        cancelText="No"
        type="danger"
      />

      {/* Announcements List (Col 7) */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Posted Announcements Log</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{filteredAnnouncements.length} matching posts</p>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="GUIDANCE">Guidance</option>
              <option value="SCHOOL">School</option>
              <option value="SCHOLARSHIP">Scholarship</option>
              <option value="DORMITORY">Dormitory</option>
            </select>
          </div>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredAnnouncements.length === 0 ? (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-8">No announcements found matching search.</p>
          ) : (
            filteredAnnouncements.map((anc) => (
              <div key={anc.id} className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider ${
                        anc.category === 'GUIDANCE'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300'
                          : anc.category === 'SCHOLARSHIP'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                          : anc.category === 'DORMITORY'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                      }`}
                    >
                      {anc.category}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Expires: {anc.expirationDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(anc)}
                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(anc.id)}
                      className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{anc.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {anc.content}
                </p>

                {anc.imageUrl && (
                  <img
                    src={anc.imageUrl}
                    alt={anc.title}
                    className="w-full h-32 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                )}

                <div className="flex items-center justify-between pt-1 text-xs">
                  {anc.externalLink ? (
                    <a
                      href={anc.externalLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      View Link Attachment <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : <span />}

                  {/* Student "I am looking forward" Heart React Counter */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800 text-[11px] font-bold">
                    <Heart className="w-3.5 h-3.5 fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400" />
                    <span>{(anc.heartReacts || []).length} Students Looking Forward</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

