import React, { useState } from 'react';
import {
  getDormRooms,
  addDormRoom,
  addResidentToRoom,
  removeResidentFromRoom,
  deleteDormRoom,
  announceDormAvailability,
  addAnnouncement,
  getDormApplicants,
  acceptDormApplicantAndAssignRoom,
  rejectDormApplicant,
  archiveRejectedDormApplicant,
  reApproveDormApplicant,
  getUsers,
  getDormReports,
  toggleDormReportMarkDone,
  getWingTypes,
  addWingType,
} from '../../services/storage';
import { DormRoom, DormApplicant, DormResident, DormReport } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { Home, Plus, Users, Megaphone, Check, X, Eye, Trash2, FileText, Search, ShieldCheck, Wrench, CheckCircle2, AlertTriangle, Archive, Clock } from 'lucide-react';

export const DormitoryModule: React.FC = () => {
  const [rooms, setRooms] = useState(getDormRooms());
  const [applicants, setApplicants] = useState(getDormApplicants());
  const [dormReports, setDormReports] = useState(getDormReports());

  const refreshData = () => {
    setRooms(getDormRooms());
    setApplicants(getDormApplicants());
    setDormReports(getDormReports());
  };

  React.useEffect(() => {
    window.addEventListener('osas_storage_updated', refreshData);
    window.addEventListener('storage', refreshData);
    return () => {
      window.removeEventListener('osas_storage_updated', refreshData);
      window.removeEventListener('storage', refreshData);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<'ROOMS' | 'APPLICANTS' | 'REPORTS'>('ROOMS');

  // Search queries
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [applicantSearchQuery, setApplicantSearchQuery] = useState('');

  // Room Creation State
  const [roomNumber, setRoomNumber] = useState('');
  const [floor, setFloor] = useState('1st Floor');
  const [capacity, setCapacity] = useState(5);
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [wingType, setWingType] = useState('Male Wing');

  // Wing types state
  const wingTypesList = getWingTypes();

  // Announce Slot Pop-up Modal State
  const [announcingRoom, setAnnouncingRoom] = useState<DormRoom | null>(null);
  const [ancTitle, setAncTitle] = useState('');
  const [ancContent, setAncContent] = useState('');
  const [ancSlots, setAncSlots] = useState(1);

  // Resident Addition Modal State
  const [addingResidentRoomId, setAddingResidentRoomId] = useState<string | null>(null);
  const [resStudentSearch, setResStudentSearch] = useState('');
  const [resStudentId, setResStudentId] = useState('');
  const [resStudentName, setResStudentName] = useState('');
  const [resContact, setResContact] = useState('0917-000-0000');

  // View Detailed Resident Modal State
  const [viewingResident, setViewingResident] = useState<{ resident: DormResident; roomName: string } | null>(null);

  // View File Modal State
  const [viewingFileModal, setViewingFileModal] = useState<{
    fileName: string;
    studentName: string;
    studentId: string;
    attachmentUrl?: string;
  } | null>(null);

  // Applicant File Review & Accept Modal State
  const [acceptingApplicant, setAcceptingApplicant] = useState<DormApplicant | null>(null);
  const [selectedTargetRoomId, setSelectedTargetRoomId] = useState<string>('');

  // Confirm Modal state for deletion
  const [confirmDeleteData, setConfirmDeleteData] = useState<{
    type: 'ROOM' | 'RESIDENT' | 'APPLICANT' | 'ARCHIVE_REJECTED_APPLICANT';
    id: string;
    secondaryId?: string;
    title: string;
    message: string;
  } | null>(null);

  const registeredStudents = getUsers().filter((u) => u.role === 'STUDENT');

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    addDormRoom({ roomNumber, floor, capacity, gender, wingType }, 'Princess Ann T. Ruzol (Admin)');
    setRoomNumber('');
    refreshData();
  };

  const handleAddResident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingResidentRoomId) return;

    // Check if student is already assigned to a room
    const alreadyAssigned = rooms.some((r) =>
      r.residents.some((res) => res.studentId === resStudentId)
    );
    if (alreadyAssigned) {
      alert(`⛔ Student (${resStudentName}) is already assigned to a dormitory room! A student can only be assigned to one room.`);
      return;
    }

    const targetRoom = rooms.find((r) => r.id === addingResidentRoomId);
    if (targetRoom && targetRoom.residents.length >= targetRoom.capacity) {
      alert(`⛔ Room "${targetRoom.roomNumber}" is at maximum capacity (${targetRoom.residents.length}/${targetRoom.capacity}). You cannot add more occupants.`);
      return;
    }

    addResidentToRoom(
      addingResidentRoomId,
      resStudentId,
      resStudentName,
      resContact,
      'Princess Ann T. Ruzol (Admin)'
    );

    setAddingResidentRoomId(null);
    setResStudentId('');
    setResStudentName('');
    refreshData();
  };

  const handleAdminMarkDoneReport = (reportId: string) => {
    toggleDormReportMarkDone(reportId, 'ADMIN', 'Princess Ann T. Ruzol (Admin)');
    refreshData();
  };

  const handleRemoveResident = (roomId: string, residentId: string, residentName: string) => {
    setConfirmDeleteData({
      type: 'RESIDENT',
      id: roomId,
      secondaryId: residentId,
      title: 'Remove Dorm Occupant',
      message: `Are you sure you want to remove "${residentName}" from this room?`,
    });
  };

  const openAnnounceSlotModal = (room: DormRoom) => {
    setAnnouncingRoom(room);
    setAncTitle(`Dorm Slot Open: ${room.roomNumber}`);
    const remaining = Math.max(0, room.capacity - room.residents.length);
    setAncSlots(remaining || 1);
    const wingText = room.wingType || `${room.gender} Wing`;
    setAncContent(`DCC OSAS announces ${remaining || 1} slot(s) available in ${room.roomNumber} (${room.floor}, ${wingText}). Interested students may submit their dormitory residency application through the OSAS portal.`);
  };

  const handlePublishAnnounceSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcingRoom) return;

    const wingText = announcingRoom.wingType || `${announcingRoom.gender} Wing`;
    addAnnouncement(
      {
        title: ancTitle,
        content: `${ancContent}\n\nAvailable Slots: ${ancSlots}\nWing: ${wingText}`,
        category: 'DORMITORY',
        expirationDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
        dormRoomId: announcingRoom.id,
      },
      'Princess Ann T. Ruzol (Admin)'
    );

    alert(`📢 Dormitory Slot Announcement posted successfully! It is now live in the Student Dormitory Announcements.`);
    setAnnouncingRoom(null);
    refreshData();
  };

  const handleAcceptApplicantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptingApplicant || !selectedTargetRoomId) {
      alert('Please select a room to assign the applicant.');
      return;
    }

    acceptDormApplicantAndAssignRoom(
      acceptingApplicant.id,
      selectedTargetRoomId,
      'Princess Ann T. Ruzol (Admin)'
    );

    setAcceptingApplicant(null);
    setSelectedTargetRoomId('');
    refreshData();
  };

  const handleRejectApplicant = (applicantId: string) => {
    setConfirmDeleteData({
      type: 'APPLICANT',
      id: applicantId,
      title: 'Reject & Archive Application',
      message: 'Are you sure you want to reject this dormitory residency application? It will be moved to system archives.',
    });
  };

  const executeConfirmDelete = () => {
    if (!confirmDeleteData) return;
    if (confirmDeleteData.type === 'ROOM') {
      deleteDormRoom(confirmDeleteData.id, 'Princess Ann T. Ruzol (Admin)');
    } else if (confirmDeleteData.type === 'RESIDENT' && confirmDeleteData.secondaryId) {
      removeResidentFromRoom(confirmDeleteData.id, confirmDeleteData.secondaryId, 'Princess Ann T. Ruzol (Admin)');
    } else if (confirmDeleteData.type === 'APPLICANT') {
      rejectDormApplicant(confirmDeleteData.id, 'Princess Ann T. Ruzol (Admin)');
    } else if (confirmDeleteData.type === 'ARCHIVE_REJECTED_APPLICANT') {
      archiveRejectedDormApplicant(confirmDeleteData.id, 'Princess Ann T. Ruzol (Admin)');
    }
    setConfirmDeleteData(null);
    refreshData();
  };

  const filteredRooms = rooms.filter((r) =>
    r.roomNumber.toLowerCase().includes(roomSearchQuery.toLowerCase()) ||
    r.floor.toLowerCase().includes(roomSearchQuery.toLowerCase()) ||
    r.gender.toLowerCase().includes(roomSearchQuery.toLowerCase())
  );

  const filteredApplicants = applicants.filter((a) =>
    a.studentName.toLowerCase().includes(applicantSearchQuery.toLowerCase()) ||
    a.studentId.toLowerCase().includes(applicantSearchQuery.toLowerCase()) ||
    a.address.toLowerCase().includes(applicantSearchQuery.toLowerCase()) ||
    a.status.toLowerCase().includes(applicantSearchQuery.toLowerCase())
  );

  const totalRooms = rooms.length;
  const totalCapacity = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
  const totalOccupants = rooms.reduce((acc, r) => acc + (r.residents ? r.residents.length : 0), 0);
  const pendingApplicantsCount = applicants.filter((a) => a.status === 'PENDING').length;
  const activeReportsCount = dormReports.filter((r) => r.status !== 'COMPLETED').length;
  const occupancyPercentage = totalCapacity > 0 ? Math.round((totalOccupants / totalCapacity) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Confirm Deletion Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteData}
        onClose={() => setConfirmDeleteData(null)}
        onConfirm={executeConfirmDelete}
        title={confirmDeleteData?.title || 'Confirm Action'}
        message={confirmDeleteData?.message || 'Are you sure you want to proceed?'}
        confirmText="Confirm & Archive"
        type="danger"
      />

      {/* Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5 shadow-2xs">
        <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('ROOMS')}
            className={`w-full sm:w-auto px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer text-center ${
              activeTab === 'ROOMS'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="sm:hidden whitespace-nowrap">Rooms ({rooms.length})</span>
            <span className="hidden sm:inline whitespace-nowrap">Dorm Rooms ({rooms.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('APPLICANTS')}
            className={`w-full sm:w-auto px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer text-center ${
              activeTab === 'APPLICANTS'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="sm:hidden whitespace-nowrap">Applicants ({applicants.filter((a) => a.status === 'PENDING').length})</span>
            <span className="hidden sm:inline whitespace-nowrap">Applicants ({applicants.filter((a) => a.status === 'PENDING').length} Pending)</span>
          </button>
          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`w-full sm:w-auto px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer text-center ${
              activeTab === 'REPORTS'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
            <span className="sm:hidden whitespace-nowrap">Reports ({dormReports.filter((r) => r.status !== 'COMPLETED').length})</span>
            <span className="hidden sm:inline whitespace-nowrap">Dorm Reports ({dormReports.filter((r) => r.status !== 'COMPLETED').length} Active)</span>
          </button>
        </div>

        {/* Tab-specific Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          {activeTab === 'ROOMS' ? (
            <input
              type="text"
              value={roomSearchQuery}
              onChange={(e) => setRoomSearchQuery(e.target.value)}
              placeholder="Search room, floor..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <input
              type="text"
              value={applicantSearchQuery}
              onChange={(e) => setApplicantSearchQuery(e.target.value)}
              placeholder="Search applicant name, ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      {activeTab === 'ROOMS' && (
        <div className="space-y-6">
          {/* Create Room Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Add New Dormitory Room</h3>
            <form onSubmit={handleCreateRoom} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Room Name / Number</label>
                <input
                  type="text"
                  required
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. Room 205 - Female Wing"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Floor Level</label>
                <input
                  type="text"
                  required
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="1st Floor"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Capacity</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={10}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Wing Type *</label>
                </div>
                <select
                  value={wingType}
                  onChange={(e) => {
                    setWingType(e.target.value);
                    if (e.target.value.toLowerCase().includes('female')) {
                      setGender('FEMALE');
                    } else if (e.target.value.toLowerCase().includes('male')) {
                      setGender('MALE');
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {wingTypesList.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Room
              </button>
            </form>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredRooms.length === 0 ? (
              <p className="col-span-2 text-center text-xs text-slate-400 py-8">No dormitory rooms found matching search.</p>
            ) : (
              filteredRooms.map((room) => {
                const isFull = room.residents.length >= room.capacity;
                return (
                  <div key={room.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
                    {/* Room Header */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-900 tracking-tight">{room.roomNumber}</h4>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteData({
                              type: 'ROOM',
                              id: room.id,
                              title: 'Delete & Archive Dorm Room',
                              message: `Are you sure you want to delete room "${room.roomNumber}"? It will be archived in system settings.`,
                            })
                          }
                          className="p-1.5 text-red-600 hover:bg-red-100/80 rounded-lg transition-colors cursor-pointer"
                          title="Delete entire room"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Sub-row below Room Number: Wing type name, Floor & Occupants on left | Announce & Add Resident on right */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider ${room.gender === 'MALE' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-pink-100 text-pink-800 border border-pink-200'}`}>
                            {room.wingType || `${room.gender} Wing`}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Floor: {room.floor} | Occupants: <span className={`font-bold ${isFull ? 'text-red-600 font-extrabold' : 'text-slate-900'}`}>{room.residents.length} / {room.capacity}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openAnnounceSlotModal(room)}
                            className="px-3 py-1.5 text-[11px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300/60 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="Open Announce Slot pop-up"
                          >
                            <Megaphone className="w-3.5 h-3.5 text-amber-700" /> Announce Slot
                          </button>

                          <button
                            type="button"
                            disabled={isFull}
                            onClick={() => setAddingResidentRoomId(room.id)}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                              isFull
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                : 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-700'
                            }`}
                            title={isFull ? 'Room reached max capacity limit' : 'Add resident'}
                          >
                            <Plus className="w-3.5 h-3.5" /> {isFull ? 'Full (Max)' : 'Add Resident'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Table of Residents */}
                    <div className="p-3 flex-1 overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="text-[10px] text-slate-400 font-bold uppercase border-b border-slate-100">
                            <th className="pb-2">Student Name</th>
                            <th className="pb-2">Assigned Date</th>
                            <th className="pb-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {room.residents.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-4 text-center text-[11px] text-slate-400">
                                No occupants currently assigned to this room.
                              </td>
                            </tr>
                          ) : (
                            room.residents.map((res) => (
                              <tr key={res.id} className="hover:bg-slate-50">
                                <td className="py-2">
                                  <span className="font-bold text-slate-900 block">{res.studentName}</span>
                                  <span className="text-[10px] text-slate-400">{res.studentId}</span>
                                </td>
                                <td className="py-2 text-[10px] text-slate-500">{res.assignedDate}</td>
                                <td className="py-2 text-right flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setViewingResident({ resident: res, roomName: room.roomNumber })}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                    title="View Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmDeleteData({
                                        type: 'RESIDENT',
                                        id: room.id,
                                        secondaryId: res.id,
                                        title: 'Remove Occupant',
                                        message: `Are you sure you want to remove occupant "${res.studentName}" from room ${room.roomNumber}?`,
                                      })
                                    }
                                    className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                    title="Delete / Remove Occupant"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'APPLICANTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Dormitory Residence Applicants</h3>
            <span className="text-xs text-slate-500">{filteredApplicants.length} Applicants</span>
          </div>

          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredApplicants.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">No applicants match search.</p>
            ) : (
              filteredApplicants.map((app) => (
                <div key={app.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{app.studentName} ({app.studentId})</h4>
                      <p className="text-[11px] text-slate-500">{app.studentEmail} • Address: {app.address}</p>
                      <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 mt-1">
                        <strong className="text-slate-900 block text-[11px] mb-0.5">Reason for Application:</strong>
                        <p className="whitespace-pre-line leading-relaxed">{app.reason}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                        app.status === 'ACCEPTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : app.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {app.status} {app.assignedRoomNumber ? `(${app.assignedRoomNumber})` : ''}
                    </span>
                  </div>

                  {app.status === 'PENDING' && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() => {
                          setAcceptingApplicant(app);
                          setSelectedTargetRoomId(rooms[0]?.id || '');
                        }}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Review
                      </button>
                    </div>
                  )}

                  {app.status === 'REJECTED' && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() =>
                          setConfirmDeleteData({
                            type: 'ARCHIVE_REJECTED_APPLICANT',
                            id: app.id,
                            title: 'Confirm Archive Rejected Applicant',
                            message: `Sigurado ka ba na gusto mong i-archive ang rejected dorm applicant na ito (${app.studentName})? Mapupunta ito sa System Settings Archive Vault.`,
                          })
                        }
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" /> Archive
                      </button>
                      <button
                        onClick={() => {
                          reApproveDormApplicant(app.id, 'Princess Ann T. Ruzol (Admin)');
                          refreshData();
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Re-Approve
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Dorm Reports Tab */}
      {activeTab === 'REPORTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" /> Dormitory Maintenance & Issue Reports
              </h3>
              <p className="text-[11px] text-slate-500">
                Reports filed by resident students. Marking as "Done" automatically resolves and completes the report for the student.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              {dormReports.filter((r) => r.status !== 'COMPLETED').length} Active Reports
            </span>
          </div>

          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar">
            {dormReports.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">No maintenance reports submitted yet.</p>
            ) : (
              dormReports.map((report) => (
                <div key={report.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-lg">{report.roomNumber}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">• Filed by: {report.studentName} ({report.studentId})</span>
                        {report.status === 'COMPLETED' && (
                          <span
                            title={`Completed: ${report.completedAt ? new Date(report.completedAt).toLocaleString() : 'Recently'}. Auto-archives 1 week after completion.`}
                            className="text-[10px] text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/80 dark:border-amber-900/50"
                          >
                            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                            Expired on: {new Date(new Date(report.completedAt || report.reportedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-black text-amber-900 dark:text-amber-300 mt-1.5 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Issue Category: {
                          report.issueType === 'WATER_SHORTAGE' ? 'Water Shortage Issue' :
                          report.issueType === 'BROKEN_FAUCET' ? 'Broken Faucet / Plumbing Issue' :
                          report.issueType === 'STALKER' ? 'Safety / Stalker Concern' :
                          report.issueType === 'ROOMMATE_CONFLICT' ? 'Roommate Dispute / Conflict' :
                          report.issueType === 'MAINTENANCE' ? 'Electrical & Facility Maintenance' :
                          report.issueType === 'OTHER' ? 'Other Maintenance Issue' :
                          report.issueType || 'General Maintenance Issue'
                        }
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 mt-1 leading-relaxed">
                        {report.description}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase shrink-0 ${
                        report.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : report.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>

                  {/* Resolution Status & Admin Action */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 font-bold ${report.status === 'COMPLETED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {report.status === 'COMPLETED' ? 'Maintenance Resolved & Completed' : 'Pending Maintenance Resolution'}
                      </span>
                    </div>

                    {report.status !== 'COMPLETED' && (
                      <button
                        onClick={() => handleAdminMarkDoneReport(report.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark Done & Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal to Add Resident */}
      {addingResidentRoomId && (
        <Modal isOpen={true} onClose={() => { setAddingResidentRoomId(null); setResStudentSearch(''); }} title="Assign Student Resident to Room" maxWidth="md">
          <form onSubmit={handleAddResident} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Search & Select Student *</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Type student name or ID (e.g. Juan, 2026-000001)..."
                  value={resStudentSearch}
                  onChange={(e) => setResStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Autocomplete Suggestions */}
              {resStudentSearch.trim() !== '' && (
                <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto z-10 space-y-1 p-1">
                  {registeredStudents
                    .filter(
                      (s) =>
                        s.fullName.toLowerCase().includes(resStudentSearch.toLowerCase()) ||
                        s.studentId?.toLowerCase().includes(resStudentSearch.toLowerCase()) ||
                        s.email.toLowerCase().includes(resStudentSearch.toLowerCase())
                    )
                    .map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => {
                          setResStudentId(s.studentId || s.id);
                          setResStudentName(s.fullName);
                          setResContact(s.contactNumber || '0917-000-0000');
                          setResStudentSearch(`${s.studentId || s.id} - ${s.fullName}`);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 rounded-lg flex items-center justify-between cursor-pointer border-b border-slate-50 last:border-none"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{s.fullName}</p>
                          <span className="text-[10px] text-slate-500">ID: {s.studentId || s.id} • {s.course || 'BSIT'}</span>
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Select & Autofill</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Student ID Number</label>
                <input
                  type="text"
                  required
                  readOnly
                  value={resStudentId}
                  placeholder="Auto-filled Student ID"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 font-bold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name (Auto-filled)</label>
                <input
                  type="text"
                  required
                  value={resStudentName}
                  onChange={(e) => setResStudentName(e.target.value)}
                  placeholder="Auto-filled Full Name"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Number (Auto-filled)</label>
              <input
                type="text"
                required
                value={resContact}
                onChange={(e) => setResContact(e.target.value)}
                placeholder="e.g. 09171234567"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Confirm Room Assignment
            </button>
          </form>
        </Modal>
      )}

      {/* Modal for Applicant File Review & Accept */}
      {acceptingApplicant && (
        <Modal
          isOpen={true}
          onClose={() => setAcceptingApplicant(null)}
          title={`Review Dormitory Application: ${acceptingApplicant.studentName}`}
          subtitle="Inspect application details and assign dormitory room"
          maxWidth="lg"
        >
          <form onSubmit={handleAcceptApplicantSubmit} className="space-y-4">
            {/* Applicant Details Panel */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900 text-sm">{acceptingApplicant.studentName} ({acceptingApplicant.studentId})</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                  Pending Verification
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 font-semibold block">Email Address:</span>
                  <p className="font-medium text-slate-800">{acceptingApplicant.studentEmail}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Home Address:</span>
                  <p className="font-medium text-slate-800">{acceptingApplicant.address}</p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block">Statement of Reason / Need:</span>
                <p className="text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 mt-1 leading-relaxed whitespace-pre-line">
                  {acceptingApplicant.reason}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assign Room Target *</label>
              <select
                required
                value={selectedTargetRoomId}
                onChange={(e) => setSelectedTargetRoomId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} (Occupancy: {r.occupiedCount}/{r.capacity}) - {r.gender} Wing
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const appToReject = acceptingApplicant;
                  setAcceptingApplicant(null);
                  handleRejectApplicant(appToReject.id);
                }}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                Reject Application
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" /> Approve Application
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Announce Slot Pop-up Modal */}
      {announcingRoom && (
        <Modal
          isOpen={true}
          onClose={() => setAnnouncingRoom(null)}
          title={`Announce Dormitory Slot: ${announcingRoom.roomNumber}`}
          subtitle="Post an official vacancy notice directly to Student Dormitory Announcements"
          maxWidth="md"
        >
          <form onSubmit={handlePublishAnnounceSlot} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center gap-2 text-amber-900">
              <Megaphone className="w-5 h-5 text-amber-600 shrink-0" />
              <p>
                Posting this will automatically generate an active notice in the <strong>Dormitory Announcement</strong> section for students.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Announcement Title *</label>
              <input
                type="text"
                required
                value={ancTitle}
                onChange={(e) => setAncTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Wing Type</label>
                <input
                  type="text"
                  disabled
                  value={`${announcingRoom.gender} Wing`}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 font-bold text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Available Slots *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={announcingRoom.capacity}
                  value={ancSlots}
                  onChange={(e) => setAncSlots(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Announcement Description & Details *</label>
              <textarea
                rows={4}
                required
                value={ancContent}
                onChange={(e) => setAncContent(e.target.value)}
                className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <Megaphone className="w-4 h-4" /> Publish to Dormitory Announcements
            </button>
          </form>
        </Modal>
      )}

      {/* Detailed Resident Profile Modal */}
      {viewingResident && (
        <Modal
          isOpen={true}
          onClose={() => setViewingResident(null)}
          title={`Resident Profile - ${viewingResident.resident.studentName}`}
          subtitle={`Room: ${viewingResident.roomName}`}
          maxWidth="sm"
        >
          <div className="space-y-3 text-xs">
            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Student ID</span>
              <p className="font-bold text-slate-900">{viewingResident.resident.studentId}</p>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Assigned Date</span>
              <p className="font-semibold text-slate-800">{viewingResident.resident.assignedDate}</p>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Contact Number</span>
              <p className="font-mono text-blue-700 font-bold">{viewingResident.resident.contactNumber || 'N/A'}</p>
            </div>
          </div>
        </Modal>
      )}

      {/* View PDF File Modal */}
      {viewingFileModal && (
        <Modal
          isOpen={true}
          onClose={() => setViewingFileModal(null)}
          title={`Document File: ${viewingFileModal.fileName}`}
          subtitle={`Submitted by ${viewingFileModal.studentName} (${viewingFileModal.studentId})`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {viewingFileModal.attachmentUrl ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[280px]">
                        {viewingFileModal.fileName}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {viewingFileModal.studentName} • ID: {viewingFileModal.studentId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={viewingFileModal.attachmentUrl}
                      download={viewingFileModal.fileName}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 text-[10px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      Download / Open
                    </a>
                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full">
                      Original Upload
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800 flex items-center justify-center max-h-[500px] overflow-auto">
                  {viewingFileModal.attachmentUrl.startsWith('data:image/') ? (
                    <img
                      src={viewingFileModal.attachmentUrl}
                      alt={viewingFileModal.fileName}
                      className="max-h-[460px] w-auto max-w-full object-contain rounded-lg shadow-lg"
                    />
                  ) : (
                    <iframe
                      src={viewingFileModal.attachmentUrl}
                      title={viewingFileModal.fileName}
                      className="w-full h-[460px] rounded-lg border-0 bg-white"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <span className="font-bold text-xs">{viewingFileModal.fileName}</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 rounded">
                    VERIFIED PDF
                  </span>
                </div>

                {/* Simulated Document Preview Container */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-slate-200 text-xs font-mono space-y-3 max-h-80 overflow-y-auto">
                  <div className="text-center border-b border-slate-700 pb-3">
                    <h3 className="font-black text-sm text-amber-400 uppercase tracking-widest">DAVAO CENTRAL COLLEGE</h3>
                    <p className="text-[10px] text-slate-400">Office of Student Affairs and Services (OSAS)</p>
                    <p className="text-xs font-bold text-white mt-1">DORMITORY RESIDENCY APPLICATION FORM & UNDERTAKING</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
                    <p><strong className="text-slate-400">Applicant:</strong> {viewingFileModal.studentName}</p>
                    <p><strong className="text-slate-400">Student ID:</strong> {viewingFileModal.studentId}</p>
                    <p><strong className="text-slate-400">Document Type:</strong> Signed Dorm Agreement & Clearance</p>
                    <p><strong className="text-slate-400">Verification:</strong> Validated by OSAS Registrar</p>
                  </div>

                  <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] font-sans text-slate-300">
                    <p className="font-bold text-emerald-400 mb-1">Official Requirements Included:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                      <li>Certificate of Matriculation / Enrollment Form</li>
                      <li>Barangay Residency Clearance & Health Certificate</li>
                      <li>Parent / Guardian Consent and Liability Waiver</li>
                      <li>1x1 ID Picture & Student Identification Card Copy</li>
                    </ul>
                  </div>

                  <p className="text-[10px] text-slate-500 text-center italic">--- End of Official Document Preview ---</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingFileModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal */}
      {confirmDeleteData && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmDeleteData(null)}
          onConfirm={executeConfirmDelete}
          title={confirmDeleteData.title}
          message={confirmDeleteData.message}
          confirmText="Yes"
          cancelText="No"
          type="danger"
        />
      )}
    </div>
  );
};

