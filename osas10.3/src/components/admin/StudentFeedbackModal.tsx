import React, { useState } from 'react';
import { StudentFeedback } from '../../types';
import { getStudentFeedbacks } from '../../services/storage';
import { X, Search, MessageSquare, Eye } from 'lucide-react';

interface StudentFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudentFeedbackModal: React.FC<StudentFeedbackModalProps> = ({ isOpen, onClose }) => {
  const [feedbacks, setFeedbacks] = useState<StudentFeedback[]>(() => getStudentFeedbacks());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<StudentFeedback | null>(null);

  React.useEffect(() => {
    const handleUpdate = () => {
      setFeedbacks(getStudentFeedbacks());
    };
    if (isOpen) {
      handleUpdate();
    }
    window.addEventListener('osas_storage_updated', handleUpdate);
    return () => {
      window.removeEventListener('osas_storage_updated', handleUpdate);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredFeedbacks = feedbacks.filter(
    (f) =>
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Student Feedback List</h3>
            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] rounded-full border border-indigo-200 dark:border-indigo-800">
              {feedbacks.length} Submissions
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feedback title, student name, or message..."
            className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Feedback Table / List */}
        <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 sticky top-0 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Student</th>
                <th className="px-4 py-2.5">Subject / Title</th>
                <th className="px-4 py-2.5">Submitted Date</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-slate-400 dark:text-slate-500">
                    No student feedbacks found matching search.
                  </td>
                </tr>
              ) : (
                filteredFeedbacks.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-200">{f.studentName}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 max-w-xs truncate">{f.title}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                      {new Date(f.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setSelectedFeedback(f)}
                        className="px-3 py-1 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/90 font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer border border-blue-200 dark:border-blue-800"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-right pt-2">
          <button
            onClick={onClose}
            className="py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Selected Feedback Details Modal */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">{selectedFeedback.title}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  From: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedFeedback.studentName}</span> ({new Date(selectedFeedback.submittedAt).toLocaleDateString()})
                </p>
              </div>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
              {selectedFeedback.content}
            </div>

            <div className="text-right pt-2">
              <button
                onClick={() => setSelectedFeedback(null)}
                className="py-2 px-4 bg-blue-700 dark:bg-blue-600 hover:bg-blue-800 dark:hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Done Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
