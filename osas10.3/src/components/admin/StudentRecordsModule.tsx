import React, { useState } from 'react';
import {
  getUsers,
  getScholarshipApplications,
  getDormRooms,
  getDormApplicants,
  getDisciplinaryRecords,
  getDisciplinaryReports,
  getAppointments,
  deleteStudentRecord,
} from '../../services/storage';
import { User, UserRole } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { CollegeLogo } from '../common/CollegeLogo';
import { hasGuidanceSanction } from '../../utils/sanctionUtils';
import { Users, Eye, Search, Award, Home, AlertOctagon, Calendar, Printer, Trash2, MapPin, Phone, FileText } from 'lucide-react';

interface StudentRecordsModuleProps {
  role?: UserRole;
  currentUser?: User;
}

export const StudentRecordsModule: React.FC<StudentRecordsModuleProps> = ({
  role = 'ADMIN',
  currentUser,
}) => {
  const sortStudents = (list: User[]) => {
    return [...list].sort((a, b) =>
      (a.studentId || '').localeCompare(b.studentId || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );
  };

  const [students, setStudents] = useState(() => sortStudents(getUsers().filter((u) => u.role === 'STUDENT')));
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [printStudent, setPrintStudent] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showRosterPrintModal, setShowRosterPrintModal] = useState(false);

  const refreshStudents = () => {
    setStudents(sortStudents(getUsers().filter((u) => u.role === 'STUDENT')));
  };

  const handleDirectPrintStudent = (student: User) => {
    setPrintStudent(student);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintStudent(null), 500);
    }, 50);
  };

  const handleDirectPrintRoster = () => {
    setShowRosterPrintModal(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setShowRosterPrintModal(false), 500);
    }, 50);
  };

  React.useEffect(() => {
    window.addEventListener('osas_storage_updated', refreshStudents);
    return () => {
      window.removeEventListener('osas_storage_updated', refreshStudents);
    };
  }, []);

  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(search.toLowerCase()) ||
      s.course?.toLowerCase().includes(search.toLowerCase())
  );

  const getStudentHistory = (studentOrId: User | string) => {
    const rawStudentId =
      typeof studentOrId === 'string'
        ? studentOrId
        : studentOrId.studentId || studentOrId.id || '';
    const rawInternalId = typeof studentOrId === 'string' ? '' : studentOrId.id || '';

    const normStudentId = String(rawStudentId).trim().toLowerCase();
    const normInternalId = String(rawInternalId).trim().toLowerCase();

    const matchesStudentId = (candidate?: string | null) => {
      const c = String(candidate || '').trim().toLowerCase();
      if (!c) return false;
      return c === normStudentId || (Boolean(normInternalId) && c === normInternalId);
    };

    const matchesEmbeddedStudentId = (nameWithId?: string | null) => {
      if (!nameWithId || !normStudentId) return false;
      const m = String(nameWithId).match(/\(([^)]+)\)\s*$/);
      return m ? matchesStudentId(m[1]) : false;
    };

    const scholarships = getScholarshipApplications().filter((a) => matchesStudentId(a.studentId));
    const dormApplicants = getDormApplicants().filter((a) => matchesStudentId(a.studentId));
    const dormRooms = getDormRooms().filter(
      (r) =>
        !r.isArchived &&
        Array.isArray(r.residents) &&
        r.residents.some((res) => matchesStudentId(res.studentId))
    );
    const offenses = getDisciplinaryRecords().filter(
      (d) => !d.isArchived && matchesStudentId(d.studentId)
    );
    const appointments = getAppointments().filter(
      (a) => !a.isArchived && matchesStudentId(a.studentId)
    );
    const studentReports = getDisciplinaryReports().filter(
      (r) =>
        !r.isArchived &&
        (matchesStudentId(r.reportedStudentId) ||
          matchesEmbeddedStudentId(r.reportedStudentName) ||
          (!r.isAnonymousReporter && matchesStudentId(r.reporterStudentId)) ||
          matchesStudentId((r as any).studentId) ||
          (Array.isArray(r.slipNotices) &&
            r.slipNotices.some((s) => matchesStudentId(s.studentId))))
    );

    return { scholarships, dormApplicants, dormRooms, offenses, appointments, studentReports };
  };

  return (
    <div className="space-y-6">
      {/* Background content (hidden during print when print preview modal is open) */}
      <div className={`space-y-6 ${printStudent || showRosterPrintModal ? 'print:hidden' : ''}`}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Comprehensive Student Directory</h3>
              <p className="text-[11px] text-slate-500">Master roster of enrolled students & OSAS history</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Mobile Row: Total Students badge and Print Records button side-by-side */}
            <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto order-1">
              <span className="px-3 py-1 bg-blue-50 text-blue-800 rounded-xl border border-blue-200 font-bold text-xs flex items-center gap-1.5 shadow-2xs shrink-0">
                <span className="text-slate-500 font-medium">Total Students:</span>
                <span className="font-black text-blue-900">{students.length}</span>
              </span>
              <button
                type="button"
                onClick={handleDirectPrintRoster}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer sm:hidden"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>

            {/* Search Bar: displayed below them on mobile, positioned between badge and print on desktop */}
            <div className="relative w-full sm:w-64 order-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student ID, name, course..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Desktop Print Records button: order-3 on desktop, hidden on mobile */}
            <button
              type="button"
              onClick={handleDirectPrintRoster}
              className="hidden sm:inline-flex px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors items-center gap-1.5 shrink-0 cursor-pointer order-3"
            >
              <Printer className="w-4 h-4" /> Print Records
            </button>
          </div>
        </div>

        {/* Student List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="p-3">Student Name</th>
                <th className="p-3">Student ID</th>
                <th className="p-3">Course / Program</th>
                <th className="p-3">Year Level</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Email</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 flex items-center gap-2.5">
                    <img src={s.avatarUrl} alt={s.fullName} className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200" />
                    <span className="font-bold text-slate-900">{s.fullName}</span>
                  </td>
                  <td className="p-3 font-mono text-[11px] font-bold text-slate-500">{s.studentId}</td>
                  <td className="p-3 text-slate-800 font-medium">{s.course}</td>
                  <td className="p-3 text-slate-600">{s.yearLevel}</td>
                  <td className="p-3 text-slate-700 font-mono text-[11px]">{s.contactNumber || 'N/A'}</td>
                  <td className="p-3 text-slate-500 font-mono text-[11px]">{s.email}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(s)}
                        className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Profile
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Student Profile Detailed Modal */}
      {selectedStudent && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedStudent(null)}
          title=""
          hideHeader={true}
          maxWidth="2xl"
        >
          {(() => {
            const history = getStudentHistory(selectedStudent);
            const renderConcernsSection = () => (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" /> Concerns and Counseling History
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({history.appointments.length} records)
                  </span>
                </div>
                {history.appointments.length === 0 ? (
                  <p className="text-slate-400 text-[11px] italic">No concerns or counseling history recorded.</p>
                ) : (
                  history.appointments.map((app) => (
                    <div
                      key={app.id}
                      className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                    >
                      <span className="font-medium text-slate-800 break-words">
                        {app.description} ({app.preferredDate})
                      </span>
                      <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-800 border border-blue-200 w-fit shrink-0">
                        {app.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            );

            const renderStudentReportsSection = () => (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" /> Student Reports
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({history.studentReports.length} records)
                  </span>
                </div>
                {history.studentReports.length === 0 ? (
                  <p className="text-slate-400 text-[11px] italic">No student reports recorded.</p>
                ) : (
                  history.studentReports.map((rep) => {
                    const isReferred = Boolean(
                      rep.referredToOsas || rep.referredFromOsas || rep.isReferredFromOsas
                    );
                    const reportDateDisplay =
                      rep.reportDate ||
                      rep.osasReferralDate ||
                      (rep.submittedAt ? new Date(rep.submittedAt).toLocaleDateString() : 'N/A');
                    return (
                      <div
                        key={rep.id}
                        className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-900">
                            {rep.incidentType || 'Student Report'} • #{rep.id}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isReferred && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                OSAS Referral
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {rep.status}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600 break-words">{rep.description}</p>
                        <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-2">
                          <span>
                            <strong>Date:</strong> {reportDateDisplay}
                          </span>
                          {rep.location && (
                            <>
                              <span>•</span>
                              <span>
                                <strong>Location:</strong> {rep.location}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );

            const renderDisciplinarySection = (title: string) => (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-red-600" /> {title}
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({history.offenses.length} records)
                  </span>
                </div>
                {history.offenses.length === 0 ? (
                  <p className="text-slate-500 font-medium text-[11px] flex items-center gap-1">
                    <span className="text-emerald-600 font-bold">✓</span> Clean record. No disciplinary violations.
                  </p>
                ) : (
                  history.offenses.map((off) => {
                    const sanctionText =
                      off.sanction && String(off.sanction).trim()
                        ? String(off.sanction).trim()
                        : hasGuidanceSanction(off)
                        ? off.sanction
                        : '';
                    return (
                      <div
                        key={off.id}
                        className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-900">{off.offenseType}</span>
                          {sanctionText && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-700 rounded border border-red-200">
                              Sanction: {sanctionText}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 break-words">{off.description}</p>
                      </div>
                    );
                  })
                )}
              </div>
            );

            return (
              <div className="space-y-4 text-xs">
                {/* Print Action & Official Letterhead Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <CollegeLogo size="lg" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Dingalan Community College</h4>
                      <p className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">Office of Student Affairs & Services</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:pr-8">
                    <button
                      type="button"
                      onClick={() => handleDirectPrintStudent(selectedStudent)}
                      className="px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print Record
                    </button>
                    {role === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => setShowConfirmDelete(true)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Record
                      </button>
                    )}
                  </div>
                </div>

                {/* Header info with Address displayed beside Email */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <img
                    src={selectedStudent.avatarUrl}
                    alt={selectedStudent.fullName}
                    className="w-16 h-16 rounded-full object-cover ring-4 ring-indigo-500/30 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-extrabold text-slate-900 break-words">{selectedStudent.fullName}</h3>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-600 mt-1">
                      <span className="font-mono text-slate-500">ID: {selectedStudent.studentId}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-700 break-all">{selectedStudent.email}</span>
                      <span>•</span>
                      <span className="text-slate-800 font-medium flex items-center gap-1 break-words">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="font-bold text-slate-500 uppercase text-[10px]">Address:</span> {selectedStudent.address || selectedStudent.permanentAddress || 'Dingalan, Aurora'}
                      </span>
                    </div>
                    {/* Course, Year Level, and Contact Number */}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-xs text-indigo-700 font-bold">
                        {selectedStudent.course} ({selectedStudent.yearLevel})
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-800 font-medium flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                        <Phone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="font-bold text-slate-500 uppercase text-[10px]">Contact:</span>
                        <span className="font-mono text-slate-900 font-semibold">{selectedStudent.contactNumber || 'N/A'}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {role === 'GUIDANCE_ADMIN' ? (
                  <>
                    {/* 1. Concerns and Counseling History */}
                    {renderConcernsSection()}
                    {/* 2. Student Reports */}
                    {renderStudentReportsSection()}
                    {/* 3. Disciplinary Records */}
                    {renderDisciplinarySection('Disciplinary Records')}
                  </>
                ) : (
                  <>
                    {/* 1. Scholarships and Applications */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-amber-600" /> Scholarships and Applications
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({history.scholarships.length} records)
                        </span>
                      </div>
                      {history.scholarships.length === 0 ? (
                        <p className="text-slate-400 text-[11px] italic">No scholarship applications recorded.</p>
                      ) : (
                        history.scholarships.map((sch) => (
                          <div key={sch.id} className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-800">{sch.scholarshipTitle}</span>
                            <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200">
                              {sch.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 2. Dormitory Applications and Residence Assignments */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Home className="w-4 h-4 text-emerald-600" /> Dormitory Applications and Residence Assignments
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({history.dormRooms.length + history.dormApplicants.length} records)
                        </span>
                      </div>
                      {history.dormRooms.length === 0 && history.dormApplicants.length === 0 ? (
                        <p className="text-slate-400 text-[11px] italic">No dormitory applications or residence assignments recorded.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {history.dormRooms.map((room) => (
                            <div key={`room-${room.id}`} className="p-2.5 bg-white rounded-lg border border-slate-200 font-medium text-xs text-slate-800 flex items-center justify-between">
                              <span>
                                Assigned to: <span className="font-bold text-emerald-700">{room.roomNumber}</span> ({room.floor})
                              </span>
                              <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                                RESIDENT
                              </span>
                            </div>
                          ))}
                          {history.dormApplicants.map((app) => (
                            <div key={`app-${app.id}`} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 flex items-center justify-between">
                              <span>
                                Dormitory Application {app.assignedRoomNumber ? `• Room ${app.assignedRoomNumber}` : ''} ({new Date(app.appliedAt).toLocaleDateString()})
                              </span>
                              <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-teal-50 text-teal-800 border border-teal-200">
                                {app.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 3. Disciplinary Records and Sanctions */}
                    {renderDisciplinarySection('Disciplinary Records and Sanctions')}

                    {/* 4. Concerns and Counseling History */}
                    {renderConcernsSection()}

                    {/* 5. Student Reports */}
                    {renderStudentReportsSection()}
                  </>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Confirm Student Record Deletion Modal */}
      {selectedStudent && (
        <ConfirmModal
          isOpen={showConfirmDelete}
          onClose={() => setShowConfirmDelete(false)}
          onConfirm={() => {
            deleteStudentRecord(selectedStudent.id, 'Princess Ann T. Ruzol (Admin)');
            setShowConfirmDelete(false);
            setSelectedStudent(null);
            refreshStudents();
          }}
          title="Are you sure you want to delete this?"
          message={`Are you sure you want to delete this student record for ${selectedStudent.fullName} (${selectedStudent.studentId})? Deleting this record will move it to System Settings > System Archive.`}
          confirmText="Yes"
          cancelText="No"
          type="danger"
        />
      )}
      </div>

      {/* Direct Final Printable Student Record Preview */}
      {printStudent && (
        <div className="direct-print-container">
          {(() => {
            const history = getStudentHistory(printStudent);
            return (
              <div id="printable-student-slip" className="printable-document flex flex-col justify-between min-h-0 bg-white text-slate-900 p-2 sm:p-4 rounded-xl border border-slate-200 print:border-none print:p-0">
                  <div className="printable-body flex-1 space-y-4">
                    {/* Institutional Header */}
                    <div className="text-center pb-3 border-b-2 border-slate-900 space-y-1">
                      <div className="flex items-center justify-center gap-3 mb-1.5">
                        <CollegeLogo className="w-12 h-12" />
                        <div>
                          <h2 className="text-base font-black tracking-wide uppercase text-slate-900 leading-tight">
                            Dingalan Community College
                          </h2>
                          <p className="text-xs font-bold text-slate-700">Office of Student Affairs and Services (OSAS)</p>
                          <p className="text-[11px] text-slate-500 font-medium">Student Records, Welfare &amp; Development Center</p>
                        </div>
                      </div>
                      <div className="inline-block bg-slate-100 border border-slate-300 px-3 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider text-slate-800">
                        Official Student Profile &amp; Services Record
                      </div>
                    </div>

                    {/* Summary Metadata Card */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Student Name</span>
                        <span className="font-bold text-slate-900 truncate block">{printStudent.fullName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Student ID Number</span>
                        <span className="font-mono font-bold text-slate-900">{printStudent.studentId}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Course &amp; Year</span>
                        <span className="font-bold text-indigo-700 truncate block">{printStudent.course} ({printStudent.yearLevel})</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year</span>
                        <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
                      </div>
                    </div>

                    {/* Student Personal & Academic Details */}
                    <div className="border border-slate-300 rounded-lg p-3 space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                        1. Student Identification &amp; Academic Profile
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Full Name</span>
                          <span className="font-bold text-slate-900 text-sm">{printStudent.fullName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Student ID Number</span>
                          <span className="font-mono font-bold text-slate-900">{printStudent.studentId}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Course &amp; Year</span>
                          <span className="font-bold text-slate-800">{printStudent.course} ({printStudent.yearLevel})</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Contact Number</span>
                          <span className="font-mono text-slate-800">{printStudent.contactNumber || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Email Address</span>
                          <span className="font-mono text-slate-800">{printStudent.email}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Residential Address</span>
                          <span className="font-medium text-slate-900">
                            {printStudent.address || printStudent.permanentAddress || 'Dingalan, Aurora'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {role === 'GUIDANCE_ADMIN' ? (
                      <>
                        {/* Concerns and Counseling History */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                            <span>2. Concerns and Counseling History</span>
                            <span className="text-[10px] text-slate-500 font-normal">({history.appointments.length} records)</span>
                          </h4>
                          {history.appointments.length === 0 ? (
                            <p className="text-slate-500 text-xs italic">No concerns or counseling history recorded.</p>
                          ) : (
                            <div className="space-y-1">
                              {history.appointments.map((app) => (
                                <div key={app.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                                  <span className="text-slate-800">{app.description} ({app.preferredDate})</span>
                                  <span className="font-bold text-[10px] uppercase text-slate-700">{app.status}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Student Reports */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                            <span>3. Student Reports</span>
                            <span className="text-[10px] text-slate-500 font-normal">({history.studentReports.length} records)</span>
                          </h4>
                          {history.studentReports.length === 0 ? (
                            <p className="text-slate-500 text-xs italic">No student reports recorded.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {history.studentReports.map((rep) => (
                                <div key={rep.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-200 space-y-1">
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="text-slate-900">{rep.incidentType || 'Student Report'} • #{rep.id}</span>
                                    <span className="text-[10px] uppercase font-bold text-slate-700">Status: {rep.status}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-600">{rep.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Disciplinary Records */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                            <span>4. Disciplinary Records</span>
                            <span className="text-[10px] text-slate-500 font-normal">({history.offenses.length} records)</span>
                          </h4>
                          {history.offenses.length === 0 ? (
                            <p className="text-emerald-700 text-xs font-bold">
                              ✓ Clean record. No disciplinary violations or sanctions recorded.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {history.offenses.map((off) => (
                                <div key={off.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-200">
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="text-slate-900">{off.offenseType}</span>
                                    {off.sanction && (
                                      <span className="text-red-700">Sanction: {off.sanction}</span>
                                    )}
                                  </div>
                                  <p className="text-slate-600 text-[11px] mt-0.5">{off.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Scholarships and Applications */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                            <span>2. Scholarships and Applications</span>
                            <span className="text-[10px] text-slate-500 font-normal">({history.scholarships.length} recorded)</span>
                          </h4>
                          {history.scholarships.length === 0 ? (
                            <p className="text-slate-500 text-xs italic">No scholarship records on file.</p>
                          ) : (
                            <div className="space-y-1">
                              {history.scholarships.map((sch) => (
                                <div key={sch.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                                  <span className="font-bold text-slate-800">{sch.scholarshipTitle}</span>
                                  <span className="font-mono font-bold uppercase text-[10px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                                    Status: {sch.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Dormitory Applications and Residence Assignments */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                            3. Dormitory Applications and Residence Assignments
                          </h4>
                          {history.dormRooms.length === 0 && history.dormApplicants.length === 0 ? (
                            <p className="text-slate-500 text-xs italic">No dormitory applications or residence assignments recorded.</p>
                          ) : (
                            <div className="space-y-1">
                              {history.dormRooms.map((room) => (
                                <p key={`print-room-${room.id}`} className="text-xs text-slate-800">
                                  Assigned to <strong>Room {room.roomNumber}</strong> ({room.floor} Floor) - Capacity: {room.capacity}
                                </p>
                              ))}
                              {history.dormApplicants.map((app) => (
                                <p key={`print-app-${app.id}`} className="text-xs text-slate-800">
                                  Dormitory Application ({new Date(app.appliedAt).toLocaleDateString()}) - Status: <strong>{app.status}</strong>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Disciplinary Records and Sanctions */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                            <span>4. Disciplinary Records and Sanctions</span>
                            <span className="text-[10px] text-slate-500 font-normal">({history.offenses.length} incidents)</span>
                          </h4>
                          {history.offenses.length === 0 ? (
                            <p className="text-emerald-700 text-xs font-bold">
                              ✓ In Good Moral Standing. No disciplinary violations or sanctions recorded.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {history.offenses.map((off) => (
                                <div key={off.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-200">
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="text-slate-900">{off.offenseType}</span>
                                    {off.sanction && (
                                      <span className="text-red-700">Sanction: {off.sanction}</span>
                                    )}
                                  </div>
                                  <p className="text-slate-600 text-[11px] mt-0.5">{off.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Concerns and Counseling History */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                            <span>5. Concerns and Counseling History</span>
                            <span className="text-[10px] text-slate-500 font-normal">({history.appointments.length} records)</span>
                          </h4>
                          {history.appointments.length === 0 ? (
                            <p className="text-slate-500 text-xs italic">No concerns or counseling history recorded.</p>
                          ) : (
                            <div className="space-y-1">
                              {history.appointments.map((app) => (
                                <div key={app.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                                  <span className="text-slate-800">{app.description} ({app.preferredDate})</span>
                                  <span className="font-bold text-[10px] uppercase text-slate-700">{app.status}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Student Reports */}
                        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 flex items-center justify-between">
                            <span>6. Student Reports</span>
                            <span className="text-[10px] text-slate-500 font-normal">({history.studentReports.length} records)</span>
                          </h4>
                          {history.studentReports.length === 0 ? (
                            <p className="text-slate-500 text-xs italic">No student reports recorded.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {history.studentReports.map((rep) => (
                                <div key={rep.id} className="text-xs bg-slate-50 p-2 rounded border border-slate-200 space-y-1">
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="text-slate-900">{rep.incidentType || 'Student Report'} • #{rep.id}</span>
                                    <span className="text-[10px] uppercase font-bold text-slate-700">Status: {rep.status}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-600">{rep.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Signatures & Footer in printable-footer-block */}
                  <div className="printable-footer-block mt-auto shrink-0 space-y-4 pt-8 border-t border-slate-300">
                    <div className="grid grid-cols-2 gap-8 text-center text-xs items-end max-w-md mx-auto">
                      <div className="flex flex-col items-center justify-end text-center">
                        <div className="w-full border-b border-slate-900 pb-8 mb-1" />
                        <p className="font-bold text-slate-900 leading-tight">Student Records Officer</p>
                        <p className="text-[10px] text-slate-500 leading-tight">Prepared &amp; Verified Official Record</p>
                      </div>
                      <div className="flex flex-col items-center justify-end text-center">
                        <div className="w-full border-b border-slate-900 pb-8 mb-1" />
                        <p className="font-bold text-slate-900 leading-tight">Princess Ann T. Ruzol</p>
                        <p className="text-[10px] text-slate-500 leading-tight">OSAS Administrator / Director</p>
                      </div>
                    </div>

                    {/* Footer Notice */}
                    <div className="text-center pt-2 text-[10px] text-slate-400 font-mono border-t border-slate-200">
                      Dingalan Community College • OSAS Student Records Module • Official Certified Student Profile Slip
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      {/* Direct Final Printable Student Records Roster Preview */}
      {showRosterPrintModal && (
        <div className="direct-print-container">
          {/* Printable Document Body */}
          <div id="printable-master-roster" className="printable-document space-y-4 bg-white text-slate-900 p-2 sm:p-4 rounded-xl border border-slate-200 print:border-none print:p-0">
            {/* Institutional Header */}
            <div className="text-center pb-3 border-b-2 border-slate-900 space-y-1">
              <div className="flex items-center justify-center gap-3 mb-1.5">
                <CollegeLogo className="w-12 h-12" />
                <div>
                  <h2 className="text-base font-black tracking-wide uppercase text-slate-900 leading-tight">
                    Dingalan Community College
                  </h2>
                  <p className="text-xs font-bold text-slate-700">Office of Student Affairs and Services (OSAS)</p>
                  <p className="text-[11px] text-slate-500 font-medium">Student Records, Welfare &amp; Development Center</p>
                </div>
              </div>
              <div className="inline-block bg-slate-100 border border-slate-300 px-3 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Official Enrolled Student Records Roster
              </div>
            </div>

            {/* Roster Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Students Listed</span>
                <span className="font-bold text-slate-900">{filteredStudents.length} Students</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Date Generated</span>
                <span className="font-semibold text-slate-800">{new Date().toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Scope / Query</span>
                <span className="font-bold text-indigo-700">{search ? `Search: "${search}"` : 'All Enrolled'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year</span>
                <span className="font-bold text-slate-900">A.Y. 2025-2026</span>
              </div>
            </div>

            {/* Master Roster Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300">#</th>
                    <th className="p-2 border-r border-slate-300">Student Name</th>
                    <th className="p-2 border-r border-slate-300">Student ID</th>
                    <th className="p-2 border-r border-slate-300">Course &amp; Year</th>
                    <th className="p-2 border-r border-slate-300">Institutional Email</th>
                    <th className="p-2">Address / Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 text-slate-800">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-slate-400">
                        No student records match the search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-slate-500 border-r border-slate-300">{idx + 1}</td>
                        <td className="p-2 font-bold text-slate-900 border-r border-slate-300">{s.fullName}</td>
                        <td className="p-2 font-mono font-bold text-slate-700 border-r border-slate-300">{s.studentId}</td>
                        <td className="p-2 border-r border-slate-300">{s.course} ({s.yearLevel})</td>
                        <td className="p-2 font-mono text-[11px] border-r border-slate-300">{s.email}</td>
                        <td className="p-2 text-slate-700">{s.address || s.permanentAddress || 'Dingalan, Aurora'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Signatures Section */}
            <div className="printable-footer-block mt-auto pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs items-end max-w-md mx-auto">
              <div className="flex flex-col items-center justify-end text-center">
                <div className="w-full border-b border-slate-900 pb-8 mb-1" />
                <p className="font-bold text-slate-900 leading-tight">College Registrar</p>
                <p className="text-[10px] text-slate-500 leading-tight">Verified &amp; Certified</p>
              </div>
              <div className="flex flex-col items-center justify-end text-center">
                <div className="w-full border-b border-slate-900 pb-8 mb-1" />
                <p className="font-bold text-slate-900 leading-tight">Princess Ann T. Ruzol</p>
                <p className="text-[10px] text-slate-500 leading-tight">OSAS Administrator</p>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center pt-2 text-[10px] text-slate-400 font-mono border-t border-slate-200">
              Dingalan Community College • OSAS Student Records Module • Official Student Records Document
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

