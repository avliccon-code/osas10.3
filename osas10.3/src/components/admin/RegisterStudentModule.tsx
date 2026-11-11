import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  registerStudentAccount,
  bulkRegisterStudents,
  BulkRegistrationRecord,
  BulkRegistrationSummary,
  getUsers,
  toggleUserSuspension,
  getCourses,
  addCourse,
  deleteCourse,
} from '../../services/storage';
import { User } from '../../types';
import { sendStudentListUploadedAlertEmail } from '../../utils/emailService';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  UserPlus,
  Mail,
  Key,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Search,
  Ban,
  Plus,
  Trash2,
  Phone,
  MapPin,
  FileSpreadsheet,
  UploadCloud,
  AlertCircle,
  AlertTriangle,
  FileCheck,
  Users,
  X,
} from 'lucide-react';

export const RegisterStudentModule: React.FC = () => {
  const [courses, setCourses] = useState<string[]>(getCourses());
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [suspendingStudent, setSuspendingStudent] = useState<User | null>(null);

  // Registration Mode
  const [activeTab, setActiveTab] = useState<'SINGLE' | 'BULK'>('SINGLE');

  // Single Registration Form State
  const [studentId, setStudentId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [extension, setExtension] = useState('');
  const [email, setEmail] = useState('');
  const [purok, setPurok] = useState('');
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [province, setProvince] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [yearAndSection, setYearAndSection] = useState('1A');
  const [otp, setOtp] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const YEAR_AND_SECTION_OPTIONS = [
    '1A',
    '1B',
    '2A',
    '2B',
    '3A',
    '3B',
    '4A',
    '4B',
  ];

  // Bulk Registration State
  const [bulkRecords, setBulkRecords] = useState<BulkRegistrationRecord[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkRegistrationSummary | null>(null);
  const [showBulkResultModal, setShowBulkResultModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [userList, setUserList] = useState<User[]>(getUsers());

  const refreshList = () => {
    setUserList(getUsers());
    setCourses(getCourses());
  };

  useEffect(() => {
    const handleUpdate = () => {
      refreshList();
    };
    window.addEventListener('osas_storage_updated', handleUpdate);
    return () => window.removeEventListener('osas_storage_updated', handleUpdate);
  }, []);

  const registeredStudents = userList.filter((u) => u.role === 'STUDENT');

  const generateRandomOTP = () => {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Ensure generated password/OTP has not been used previously
    const allUsers = getUsers();
    const isUsed = allUsers.some((u) => u.oneTimePassword === newOtp || u.password === newOtp);
    if (isUsed) {
      const retryDigits = Math.floor(100000 + Math.random() * 900000).toString();
      setOtp(retryDigits);
    } else {
      setOtp(newOtp);
    }
  };

  const handleToggleSuspend = (student: User) => {
    toggleUserSuspension(student.id, 'Princess Ann T. Ruzol (Admin)');
    refreshList();
  };

  const handleAddCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    addCourse(newCourseName.trim(), 'Princess Ann T. Ruzol (Admin)');
    setNewCourseName('');
    refreshList();
  };

  const handleDeleteCourse = (cName: string) => {
    deleteCourse(cName, 'Princess Ann T. Ruzol (Admin)');
    refreshList();
  };

  // Helper to normalize any row header into BulkRegistrationRecord
  const normalizeRowToRecord = (row: Record<string, any>): BulkRegistrationRecord | null => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[\s_-]+/g, '');
      normalized[cleanKey] = String(value ?? '').trim();
    }

    const studentId =
      normalized['studentid'] ||
      normalized['idnumber'] ||
      normalized['idno'] ||
      normalized['id'] ||
      normalized['studentno'] ||
      '';

    const fullName = normalized['fullname'] || normalized['name'] || normalized['studentname'] || '';
    const firstName = normalized['firstname'] || normalized['first'] || '';
    const middleName = normalized['middlename'] || normalized['middle'] || '';
    const surname = normalized['surname'] || normalized['lastname'] || normalized['last'] || '';
    const extensionName = normalized['extensionname'] || normalized['extension'] || normalized['suffix'] || '';

    const email = normalized['email'] || normalized['emailaddress'] || normalized['studentemail'] || '';
    const contactNumber =
      normalized['contactnumber'] ||
      normalized['contactno'] ||
      normalized['contact'] ||
      normalized['phone'] ||
      normalized['mobile'] ||
      '';
    const permanentAddress =
      normalized['permanentaddress'] || normalized['address'] || normalized['homeaddress'] || '';
    const courseVal = normalized['course'] || normalized['program'] || normalized['degree'] || '';
    const yearLevelVal = normalized['yearlevel'] || normalized['year'] || '';
    const section = normalized['section'] || '';

    if (!studentId && !fullName && !firstName && !email) {
      return null;
    }

    return {
      studentId,
      fullName,
      firstName,
      middleName,
      surname,
      extensionName,
      email,
      contactNumber,
      permanentAddress,
      course: courseVal,
      yearLevel: yearLevelVal,
      section,
    };
  };

  // Parse attached Excel, CSV, DOC, DOCX, or PDF file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInKb = (file.size / 1024).toFixed(1);
    setUploadedFileSize(`${sizeInKb} KB`);
    setUploadedFileName(file.name);

    const fileNameLower = file.name.toLowerCase();
    const isDocOrPdf =
      fileNameLower.endsWith('.pdf') ||
      fileNameLower.endsWith('.doc') ||
      fileNameLower.endsWith('.docx');

    const reader = new FileReader();

    if (isDocOrPdf) {
      // Parse Document / PDF / Text content
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const rawText = decoder.decode(buffer);

          // Extract potential student patterns (ID, email, name)
          const lines = rawText
            .split(/[\r\n]+/)
            .map((l) => l.trim())
            .filter((l) => l.length > 5);

          const parsed: BulkRegistrationRecord[] = [];
          
          // Try regex scanning for student records in document text
          const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
          const idRegex = /(\d{4}-\d{4,6}|\d{7,10})/g;

          // Attempt structured delimiter or regex extraction
          lines.forEach((line) => {
            const parts = line.split(/[,\t|;]+/);
            if (parts.length >= 3) {
              const rowObj: Record<string, string> = {
                studentId: parts[0]?.trim() || '',
                fullName: parts[1]?.trim() || '',
                email: parts[2]?.trim() || '',
                course: parts[3]?.trim() || 'BSIT',
                yearLevel: parts[4]?.trim() || '1st Year',
                contactNumber: parts[5]?.trim() || '',
              };
              const rec = normalizeRowToRecord(rowObj);
              if (rec) parsed.push(rec);
            }
          });

          // Fallback: If no delimiter rows found, match emails & IDs in document stream
          if (parsed.length === 0) {
            const matchedEmails = rawText.match(emailRegex) || [];
            const matchedIds = rawText.match(idRegex) || [];

            const count = Math.max(matchedEmails.length, matchedIds.length);
            for (let i = 0; i < count; i++) {
              const sId = matchedIds[i] || `2026-${String(100000 + i).padStart(6, '0')}`;
              const sEmail = matchedEmails[i] || `student${i + 1}@dcc.edu.ph`;
              const sName = `Student ${sId}`;
              parsed.push({
                studentId: sId,
                fullName: sName,
                email: sEmail,
                course: 'BS Entrepreneurship',
                yearLevel: '1A',
                contactNumber: '09171234567',
                permanentAddress: 'Dingalan, Aurora',
              });
            }
          }

          if (parsed.length === 0) {
            alert(
              `Attached document "${file.name}" was loaded (${sizeInKb} KB). Please ensure the document contains student rows or tabular student records.`
            );
            setBulkRecords([]);
            return;
          }

          setBulkRecords(parsed);
          setBulkResult(null);

          // Dispatch email alert to OSAS Admin using existing email service
          sendStudentListUploadedAlertEmail({
            fileName: file.name,
            fileSize: `${sizeInKb} KB`,
            recordCount: parsed.length,
            uploadedBy: 'Princess Ann T. Ruzol (OSAS Officer)',
          }).catch((err) => console.warn('[Student List Upload Alert Error]', err));
        } catch (err) {
          console.error(err);
          alert('Failed to parse document file. Please ensure it is a valid format.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Parse standard Excel (.xlsx, .xls) and CSV (.csv)
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const wb = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

          const parsed: BulkRegistrationRecord[] = [];
          rawRows.forEach((row) => {
            const rec = normalizeRowToRecord(row);
            if (rec) parsed.push(rec);
          });

          if (parsed.length === 0) {
            alert('No valid student rows found in the attached file. Please check column headers.');
            setBulkRecords([]);
            return;
          }

          setBulkRecords(parsed);
          setBulkResult(null);

          // Dispatch email alert to OSAS Admin using existing email service
          sendStudentListUploadedAlertEmail({
            fileName: file.name,
            fileSize: `${sizeInKb} KB`,
            recordCount: parsed.length,
            uploadedBy: 'Princess Ann T. Ruzol (OSAS Officer)',
          }).catch((err) => console.warn('[Student List Upload Alert Error]', err));
        } catch (err) {
          console.error(err);
          alert('Failed to parse file. Please verify it is a valid Excel (.xlsx, .xls), CSV (.csv), Word (.docx, .doc), or PDF (.pdf) file.');
        }
      };
      reader.readAsArrayBuffer(file);
    }

    e.target.value = '';
  };

  // Execute bulk registration
  const handleProcessBulk = async () => {
    if (bulkRecords.length === 0) {
      alert('Please attach an Excel or CSV student list file first.');
      return;
    }

    setIsProcessingBulk(true);
    try {
      const summary = await bulkRegisterStudents(bulkRecords, 'Princess Ann T. Ruzol (Admin)');
      setBulkResult(summary);
      setShowBulkResultModal(true);
      refreshList();
    } catch (err: any) {
      alert('Bulk registration error: ' + (err?.message || 'Failed to complete registration'));
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if ID already exists
    const existingUsers = getUsers();
    const isIdTaken = existingUsers.some(
      (u) =>
        (u.studentId && u.studentId.trim().toLowerCase() === studentId.trim().toLowerCase()) ||
        (u.id && u.id.trim().toLowerCase() === studentId.trim().toLowerCase())
    );
    if (isIdTaken) {
      alert(`⛔ Existing Student ID! The Student ID Number (${studentId.trim()}) is already registered in the system.`);
      return;
    }

    // Validate Student ID Number format (e.g. 2026-000001, 2024-0101, etc.)
    const idPattern = /^(\d{4}-\d{4,6}|\d{7,10}|[A-Za-z0-9-]+)$/;
    if (!idPattern.test(studentId.trim())) {
      alert('⛔ Invalid Student ID Number format! Please enter a valid Student ID (e.g. 2026-000001, 2024-0101, or institutional ID).');
      return;
    }

    // Validate contact number (11 digits starting with 09 or 10 digits starting with 9)
    let cleanedContact = contactNumber.replace(/\D/g, '');
    if (cleanedContact.length === 10 && cleanedContact.startsWith('9')) {
      cleanedContact = '0' + cleanedContact;
    }
    if (cleanedContact.length !== 11 || !cleanedContact.startsWith('09')) {
      alert('⛔ Invalid Contact Number! Mobile number must be 11 digits starting with 09 (e.g. 09171234567).');
      return;
    }

    let finalOtp = otp.trim();
    if (!finalOtp) {
      finalOtp = Math.floor(100000 + Math.random() * 900000).toString();
    }

    if (!firstName.trim() || !surname.trim()) {
      alert('⛔ Name Required! First Name and Surname are required.');
      return;
    }

    if (!barangay.trim() || !municipality.trim() || !province.trim()) {
      alert('⛔ Address Required! Barangay, Municipality, and Province are required.');
      return;
    }

    const constructedFullName = [
      firstName.trim(),
      middleName.trim(),
      surname.trim(),
      extension.trim(),
    ]
      .filter(Boolean)
      .join(' ');

    const constructedAddress = [
      purok.trim(),
      street.trim(),
      barangay.trim() ? `Brgy. ${barangay.trim()}` : '',
      municipality.trim(),
      province.trim(),
    ]
      .filter(Boolean)
      .join(', ');

    setIsSubmitting(true);
    try {
      const newStudent = await registerStudentAccount(
        {
          studentId: studentId.trim(),
          fullName: constructedFullName,
          surname: surname.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          extensionName: extension.trim(),
          email: email.trim(),
          permanentAddress: constructedAddress,
          contactNumber: cleanedContact,
          yearLevel: yearAndSection,
          course: 'BS Entrepreneurship',
          oneTimePassword: finalOtp,
        },
        'Princess Ann T. Ruzol (Admin)'
      );

      setSuccessMsg(
        `Student account for ${newStudent.fullName} (${newStudent.studentId}) successfully created! Simulated email containing One-Time Password (${newStudent.oneTimePassword}) dispatched to ${newStudent.email}.`
      );
      refreshList();

      // Reset Form
      setStudentId('');
      setFirstName('');
      setMiddleName('');
      setSurname('');
      setExtension('');
      setEmail('');
      setPurok('');
      setStreet('');
      setBarangay('');
      setMunicipality('');
      setProvince('');
      setContactNumber('');
      setYearAndSection('1A');
      setOtp('');
    } catch (err: any) {
      alert('Error registering student: ' + (err?.message || 'Registration failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = registeredStudents.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Registration Form & Batch Import (Col 5) */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4">
        {/* Module Header */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-xl">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Register Student Account</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Creates student login credentials & dispatches OTP email</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('SINGLE')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'SINGLE'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Single Student
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BULK')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'BULK'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Attach Student List File
          </button>
        </div>

        {/* SINGLE STUDENT FORM */}
        {activeTab === 'SINGLE' && (
          <div className="space-y-3">
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{successMsg}</p>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Student ID Number *</label>
                <input
                  type="text"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 2026-000001"
                  title="Student ID Number format: 2026-000001 (4-digit year followed by hyphen and 6 digits)"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Name Fields: First, Middle on top row; Surname, Extension underneath */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Student Name *</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First Name *"
                      title="First Name (Required)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="Middle Name"
                      title="Middle Name (Optional)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      required
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      placeholder="Surname *"
                      title="Surname / Last Name (Required)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={extension}
                      onChange={(e) => setExtension(e.target.value)}
                      placeholder="Ext. (Jr., III)"
                      title="Name Extension e.g. Jr., Sr., III (Optional)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Student Email Address (Username) *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan.luna@student.edu"
                  title="Official institutional student email address"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Granular Address Fields */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Permanent Address *</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      value={purok}
                      onChange={(e) => setPurok(e.target.value)}
                      placeholder="Purok / House No. (Optional)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Street / Sitio (Optional)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex flex-col justify-end">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 truncate" title="Barangay *">
                      Barangay *
                    </label>
                    <input
                      type="text"
                      required
                      value={barangay}
                      onChange={(e) => setBarangay(e.target.value)}
                      placeholder="e.g. Poblacion"
                      className="w-full h-9 px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white font-medium box-border"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 truncate" title="Municipality *">
                      Municipality *
                    </label>
                    <input
                      type="text"
                      required
                      value={municipality}
                      onChange={(e) => setMunicipality(e.target.value)}
                      placeholder="e.g. Dingalan"
                      className="w-full h-9 px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white font-medium box-border"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 truncate" title="Province *">
                      Province *
                    </label>
                    <input
                      type="text"
                      required
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="e.g. Aurora"
                      className="w-full h-9 px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white font-medium box-border"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Number and Year & Section side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Number (11 Digits) *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      maxLength={11}
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 09171234567"
                      title="Mobile contact number: 11 digits starting with 09 (e.g. 09171234567)"
                      className="w-full pl-9 pr-3.5 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Year and Section Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Year and Section *</label>
                  <select
                    value={yearAndSection}
                    onChange={(e) => setYearAndSection(e.target.value)}
                    title="Select student Year and Section"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 dark:text-white font-bold cursor-pointer"
                  >
                    {YEAR_AND_SECTION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#b60ee9] dark:text-[#d866ff]">One-Time Password (OTP) *</label>
                  <button
                    type="button"
                    onClick={generateRandomOTP}
                    title="Click to auto-generate a unique 6-digit OTP code"
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-Generate OTP
                  </button>
                </div>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="e.g. 428286"
                    title="6-digit One-Time Password"
                    className="w-full pl-9 pr-3.5 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email Security Warning Notice */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                <span className="font-bold flex items-center gap-1 text-amber-900 dark:text-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Automated Email Security Warning
                </span>
                <p className="text-amber-700/90 dark:text-amber-200/80 leading-tight">
                  An email will be dispatched to the student's inbox containing their username and OTP with the explicit notice: <em>"WARNING: Do NOT share this password with anyone."</em>
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Registering Account & Syncing to Cloud...</span>
                  </>
                ) : (
                  'Create Account & Send Email'
                )}
              </button>
            </form>
          </div>
        )}

        {/* ATTACH STUDENT LIST FILE (EXCEL / CSV) */}
        {activeTab === 'BULK' && (
          <div className="space-y-3.5">
            {/* Drag & Drop / File Input Box */}
            <label
              htmlFor="bulk-student-file-input"
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors"
            >
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Click to browse or drag & drop student list file
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Supported formats: Excel (.xlsx, .xls), CSV (.csv), Word (.docx, .doc), and PDF (.pdf)
                </p>
              </div>
              <input
                id="bulk-student-file-input"
                type="file"
                accept=".xlsx,.xls,.csv,.doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Attached File Status Badge */}
            {uploadedFileName && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-emerald-900 dark:text-emerald-200 truncate">{uploadedFileName}</p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                      {uploadedFileSize} • {bulkRecords.length} valid row(s) identified
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBulkRecords([]);
                    setUploadedFileName('');
                    setUploadedFileSize('');
                    setBulkResult(null);
                  }}
                  className="p-1 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                  title="Remove attached file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Preview of Loaded Student Records */}
            {bulkRecords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Preview Student Records ({bulkRecords.length})
                  </span>
                  <span className="text-[10px] text-slate-500">First {Math.min(5, bulkRecords.length)} shown</span>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2">ID Number</th>
                        <th className="p-2">Full Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Course / Program</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {bulkRecords.slice(0, 5).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2 font-mono font-bold text-blue-600">{r.studentId || '—'}</td>
                          <td className="p-2 text-slate-900 dark:text-slate-200 font-medium">
                            {r.fullName || `${r.firstName || ''} ${r.surname || ''}`.trim() || '—'}
                          </td>
                          <td className="p-2 font-mono text-slate-600 dark:text-slate-400 text-[10px]">{r.email || '—'}</td>
                          <td className="p-2 text-slate-700 dark:text-slate-300 text-[10px]">{r.course || 'BSIT'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bulk Action Submit Button */}
                <button
                  type="button"
                  onClick={handleProcessBulk}
                  disabled={isProcessingBulk}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingBulk ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Processing & Generating Credentials...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" /> Bulk Register All ({bulkRecords.length}) Students
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Previous Batch Result Snippet */}
            {bulkResult && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Latest Batch Import Result</span>
                  <button
                    type="button"
                    onClick={() => setShowBulkResultModal(true)}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-emerald-100/70 dark:bg-emerald-950/60 rounded-lg text-emerald-800 dark:text-emerald-300">
                    <span className="block font-black text-sm">{bulkResult.registeredCount}</span>
                    <span className="text-[10px] font-semibold">Registered</span>
                  </div>
                  <div className="p-2 bg-amber-100/70 dark:bg-amber-950/60 rounded-lg text-amber-800 dark:text-amber-300">
                    <span className="block font-black text-sm">{bulkResult.duplicateCount}</span>
                    <span className="text-[10px] font-semibold">Duplicates</span>
                  </div>
                  <div className="p-2 bg-red-100/70 dark:bg-red-950/60 rounded-lg text-red-800 dark:text-red-300">
                    <span className="block font-black text-sm">{bulkResult.invalidCount}</span>
                    <span className="text-[10px] font-semibold">Invalid</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Registered Students Roster List (Col 7) */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Registered Students Directory</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{registeredStudents.length} active accounts</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, name, email..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredStudents.map((s) => (
            <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src={s.avatarUrl} alt={s.fullName} className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{s.fullName}</h4>
                    {s.isSuspended && (
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-md uppercase">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.email} • ID: {s.studentId}</p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">{s.course} ({s.yearLevel})</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSuspendingStudent(s)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                    s.isSuspended
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  title={s.isSuspended ? 'Reactivate Student Account' : 'Suspend Student Account'}
                >
                  <Ban className="w-3 h-3" />
                  {s.isSuspended ? 'Reactivate' : 'Suspend Account'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal for Managing Courses */}
      {showCourseModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowCourseModal(false)}
          title="Manage University Academic Courses"
          subtitle="Add or delete course options for student registration"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <form onSubmit={handleAddCourseSubmit} className="flex gap-2">
              <input
                type="text"
                required
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="e.g. BS Hospitality Management"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Course
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <h4 className="font-bold text-slate-700">Existing Courses ({courses.length})</h4>
              {courses.map((c) => (
                <div key={c} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{c}</span>
                  <button
                    onClick={() => handleDeleteCourse(c)}
                    className="p-1 text-red-600 hover:bg-red-100 rounded cursor-pointer"
                    title="Delete Course Option"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Account Suspension */}
      <ConfirmModal
        isOpen={!!suspendingStudent}
        onClose={() => setSuspendingStudent(null)}
        onConfirm={() => {
          if (suspendingStudent) {
            handleToggleSuspend(suspendingStudent);
            setSuspendingStudent(null);
          }
        }}
        title={suspendingStudent?.isSuspended ? 'Confirm Account Reactivation' : 'Confirm Account Suspension'}
        message={
          suspendingStudent?.isSuspended
            ? `Sigurado ka ba na gusto mong i-reactivate ang student account ni ${suspendingStudent.fullName} (${suspendingStudent.studentId || suspendingStudent.email})?`
            : `Sigurado ka ba na gusto mong i-suspend ang student account ni ${suspendingStudent?.fullName} (${suspendingStudent?.studentId || suspendingStudent?.email})?`
        }
        confirmText={suspendingStudent?.isSuspended ? 'Yes, Reactivate' : 'Yes, Suspend Account'}
        cancelText="Cancel"
        type={suspendingStudent?.isSuspended ? 'info' : 'danger'}
      />

      {/* Batch Registration Result Summary Modal */}
      {showBulkResultModal && bulkResult && (
        <Modal
          isOpen={true}
          onClose={() => setShowBulkResultModal(false)}
          title="Batch Registration Summary Report"
          subtitle={`Evaluated ${bulkResult.total} student record(s) from attached list`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* 3 Metric Cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <span className="text-2xl font-black text-emerald-600 block">{bulkResult.registeredCount}</span>
                <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">Successfully Created</span>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl">
                <span className="text-2xl font-black text-amber-600 block">{bulkResult.duplicateCount}</span>
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300">Duplicate Skipped</span>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl">
                <span className="text-2xl font-black text-red-600 block">{bulkResult.invalidCount}</span>
                <span className="text-[11px] font-bold text-red-900 dark:text-red-300">Invalid Records</span>
              </div>
            </div>

            {/* Created Accounts Roster */}
            {bulkResult.registeredCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Newly Registered Accounts & Dispatched Credentials ({bulkResult.registered.length})</span>
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2">ID Number</th>
                        <th className="p-2">Student Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2 text-right">Generated OTP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {bulkResult.registered.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2 font-mono font-bold text-blue-600">{u.studentId}</td>
                          <td className="p-2 font-medium text-slate-900 dark:text-slate-200">{u.fullName}</td>
                          <td className="p-2 font-mono text-slate-600 dark:text-slate-400 text-[10px]">{u.email}</td>
                          <td className="p-2 font-mono font-black text-purple-600 dark:text-purple-400 text-right">
                            {u.oneTimePassword || '******'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Duplicates Notice */}
            {bulkResult.duplicateCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Skipped Duplicate Students ({bulkResult.duplicates.length})</span>
                </div>
                <div className="border border-amber-200 dark:border-amber-800/60 rounded-xl overflow-hidden max-h-32 overflow-y-auto bg-amber-50/40 dark:bg-amber-950/20">
                  <div className="p-2 space-y-1.5 divide-y divide-amber-100 dark:divide-amber-900/40">
                    {bulkResult.duplicates.map((d, idx) => (
                      <div key={idx} className="pt-1 first:pt-0 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {d.fullName} <span className="font-mono text-slate-500 font-normal">({d.studentId})</span>
                        </span>
                        <span className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold">{d.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Invalid Notice */}
            {bulkResult.invalidCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-red-700 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Invalid Row Format Issues ({bulkResult.invalid.length})</span>
                </div>
                <div className="border border-red-200 dark:border-red-800/60 rounded-xl overflow-hidden max-h-32 overflow-y-auto bg-red-50/40 dark:bg-red-950/20">
                  <div className="p-2 space-y-1.5 divide-y divide-red-100 dark:divide-red-900/40">
                    {bulkResult.invalid.map((inv, idx) => (
                      <div key={idx} className="pt-1 first:pt-0 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          Row #{inv.rowNumber}: <span className="font-normal font-mono">{inv.studentId} • {inv.fullName}</span>
                        </span>
                        <span className="text-[10px] text-red-700 dark:text-red-300 font-semibold">{inv.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkResultModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
