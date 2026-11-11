import React from 'react';
import { Modal } from './Modal';
import { getStudentFeedbacks } from '../../services/storage';
import { MessageSquareQuote, Calendar, User } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const feedbacks = getStudentFeedbacks();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Student Feedback Inbox" subtitle="Feedback submitted by students" maxWidth="lg">
      <div className="space-y-3">
        {feedbacks.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <MessageSquareQuote className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">No feedback submitted yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            {feedbacks.map((fb) => (
              <div key={fb.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 pb-2.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{fb.studentName}</h4>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {fb.studentId}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                    <Calendar className="w-3 h-3" />
                    {new Date(fb.submittedAt).toLocaleDateString()}
                  </span>
                </div>
                <h5 className="text-xs font-bold text-slate-800 mb-1">{fb.title}</h5>
                <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                  {fb.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
