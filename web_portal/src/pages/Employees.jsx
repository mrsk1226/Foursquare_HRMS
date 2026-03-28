import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

import { supabase } from '../lib/supabase_client';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { EmptyStatePanel, TableSkeleton } from '../components/ui/LoadingSkeleton';
import { 
  Users, Search, Plus, Edit, Trash2, X, Download, Filter, 
  ChevronLeft, ChevronRight, Upload, Building2, CreditCard, FileText, User, Eye, MapPin, Calendar, Clock, Briefcase, DownloadCloud,
  CheckCircle2, XCircle, Lock, Mail, Loader2
} from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const getEmployeeValue = (employee, keys, fallback = '') => {
  for (const key of keys) {
    const value = employee?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return fallback;
};

const normalizeEmployeeRecord = (employee) => ({
  ...employee,
  id: getEmployeeValue(employee, ['id', 'employee_id']),
  employee_id: String(getEmployeeValue(employee, ['employee_id', 'emp_id', 'code'], '')),
  full_name: getEmployeeValue(employee, ['full_name', 'name', 'employee_name'], 'Employee'),
  designation: getEmployeeValue(employee, ['designation', 'job_title', 'role_name'], ''),
  department: getEmployeeValue(employee, ['department', 'dept_name'], ''),
  status: String(getEmployeeValue(employee, ['status', 'employment_status'], 'active')).toLowerCase(),
  photo_url: getEmployeeValue(employee, ['photo_url', 'avatar_url', 'profile_image_url'], ''),
  email: getEmployeeValue(employee, ['email', 'work_email', 'personal_email'], ''),
  phone: getEmployeeValue(employee, ['phone', 'mobile_number', 'phone_number'], ''),
  dob: getEmployeeValue(employee, ['dob', 'date_of_birth', 'birth_date'], ''),
});

const FALLBACK_DEPARTMENTS = [
  'Sales', 'Operations', 'Accounts', 'HR', 'Design',
  'Production', 'Installation', 'Service', 'Procurement',
  'Admin', 'Management'
];

const Employees = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isHRorAdmin = ['admin', 'hr'].includes(profile?.role);
  
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [documents, setDocuments] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('Personal');
  const [editingId, setEditingId] = useState(null);

  const initialFormState = {
    // Personal
    full_name: '', email: '', phone: '', dob: '', gender: 'Male', emergency_contact: '', address: '', blood_group: '', photo_url: '',
    // Professional
    employee_id: '', department: 'Sales', designation: '', join_date: '', employment_type: 'Full-time', manager: '', work_location: '', status: 'active',

    // Bank
    bank_account: '', bank_ifsc: '', bank_name: '', account_type: 'Savings', pan_number: '',
    // Docs
    aadhaar_url: '', pan_url: '', offer_letter_url: ''
  };
  const [formData, setFormData] = useState(initialFormState);
  const [activeDocCategory, setActiveDocCategory] = useState(null);

  // View Profile State
  const [viewingEmp, setViewingEmp] = useState(null);
  const [viewTab, setViewTab] = useState('Personal');
  const [viewDocs, setViewDocs] = useState([]);
  const [viewAttendance, setViewAttendance] = useState({ present: 0, absent: 0, chartData: [] });
  const [viewLeaves, setViewLeaves] = useState({ annual: 0, sick: 0, casual: 0 });
  const [isLoadingViewData, setIsLoadingViewData] = useState(false);
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const fileInputRef = useRef(null);



  const openViewModal = async (emp) => {
    setViewingEmp(emp);
    setViewTab('Personal');
    setIsLoadingViewData(true);
    try {
      const { data: docs } = await supabase.from('documents').select('*').eq('employee_id', emp.employee_id);
      setViewDocs(docs || []);
      
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const { data: att } = await supabase.from('attendance_logs').select('status, date').eq('employee_id', emp.employee_id);
      
      const currentMonthAtt = (att || []).filter(a => a.date >= monthStart);
      const present = currentMonthAtt.filter(a => a.status === 'present').length;
      const absent = currentMonthAtt.filter(a => a.status === 'absent').length;
      
      const chartData = [];
      for(let i=5; i>=0; i--) {
        const d = subMonths(new Date(), i);
        const mStart = format(startOfMonth(d), 'yyyy-MM-dd');
        const mEnd = format(endOfMonth(d), 'yyyy-MM-dd');
        const mAtt = (att || []).filter(a => a.date >= mStart && a.date <= mEnd);
        const p = mAtt.filter(a => a.status === 'present').length;
        const total = mAtt.length || 1;
        chartData.push({ month: format(d, 'MMM'), Rate: Math.round((p / total) * 100) });
      }
      setViewAttendance({ present, absent, chartData });

      const { data: lv } = await supabase.from('leave_balances').select('*').eq('employee_id', emp.employee_id).single();
      setViewLeaves(lv || { annual: 12, sick: 7, casual: 7 });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingViewData(false);
    }
  };

  const fetchDepartments = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('departments').select('name').order('name');
      if (!error && data && data.length > 0) {
        setDepartments(data.map(d => d.name));
      } else {
        if (error) {
          console.error('Departments query failed:', error);
        }
        setDepartments(FALLBACK_DEPARTMENTS);
      }
    } catch (err) {
      console.error('Departments fetch failed:', err);
      setDepartments(FALLBACK_DEPARTMENTS);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      let response = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (response.error && /created_at/i.test(response.error.message || '')) {
        console.error('Employees query failed when ordering by created_at, retrying with employee_id:', response.error);
        response = await supabase
          .from('employees')
          .select('*')
          .order('employee_id', { ascending: true });
      }

      if (response.error) {
        console.error('Employees query failed:', response.error);
        throw response.error;
      }

      setEmployees((response.data || []).map(normalizeEmployeeRecord));
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      setEmployees([]);
      setLoadError('Employee records could not be loaded from Supabase.');
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, [fetchDepartments, fetchEmployees]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    const toastId = toast.loading('Uploading photo...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${formData.employee_id || 'new'}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, photo_url: data.publicUrl }));
      toast.success('Photo uploaded locally, save to apply', { id: toastId });
    } catch (err) {
      console.error('Employee photo upload failed:', err);
      toast.error('Failed to upload photo', { id: toastId });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setDocuments([]);
    setModalTab('Personal');
    setIsModalOpen(true);
  };

  const openEditModal = async (emp) => {
    setEditingId(emp.id);
    setFormData({ ...initialFormState, ...emp });
    setModalTab('Personal');
    setIsModalOpen(true);
    
    // Fetch docs
    try {
      const { data } = await supabase.from('documents').select('*').eq('employee_id', emp.employee_id);
      setDocuments(data || []);
    } catch (error) {
      console.error('Failed to fetch employee documents:', error);
      setDocuments([]);
    }
  };

  const autoSaveEmployee = async () => {
    if (editingId) return true; // Already saved
    
    if (!formData.employee_id || !formData.full_name || !formData.email) {
      toast.error('Please fill Full Name, Email, and Employee ID first to auto-save and upload.');
      return false;
    }

    const toastId = toast.loading('Auto-saving employee record...');
    try {
      const payload = {
        employee_id: formData.employee_id,
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        department: formData.department,
        designation: formData.designation,
        join_date: formData.join_date || null,
        bank_account: formData.bank_account,
        bank_ifsc: formData.bank_ifsc,
        pan_number: formData.pan_number,
        address: formData.address,
        status: formData.status,
        photo_url: formData.photo_url,
        emergency_contact: formData.emergency_contact,
        blood_group: formData.blood_group,
        work_location: formData.work_location,
        manager: formData.manager,
        dob: formData.dob || null,
        gender: formData.gender,
        employment_type: formData.employment_type
      };
      
      const { data, error } = await supabase.from('employees').insert([payload]).select().single();
      if (error) throw error;
      
      setEditingId(data.id);
      toast.success('Employee record auto-saved', { id: toastId });
      fetchEmployees();
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to auto-save employee', { id: toastId });
      return false;
    }
  };

  const triggerUpload = async (docCategory) => {
    const isSaved = await autoSaveEmployee();
    if (!isSaved) return;

    setActiveDocCategory(docCategory);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDocumentUpload = async (e) => {
    const docCategory = activeDocCategory;
    const files = Array.from(e.target.files);
    
    // Always clear the input so the same file can be selected again
    e.target.value = null;
    
    if (!files || files.length === 0 || !docCategory) return;

    if (!formData.employee_id) {
      return toast.error('Employee ID is missing.');
    }

    const toastId = toast.loading(`Uploading ${files.length} file(s)...`);
    try {
      const uploadedRecords = [];

      for (const file of files) {
        const safeDocType = docCategory.replace(/[^a-zA-Z0-9]/g, '');
        // Path: employeeId/docType/filename
        const fileName = `${formData.employee_id}/${safeDocType}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;

        const { error: uploadError } = await supabase.storage
          .from('employee-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('employee-documents')
          .getPublicUrl(fileName);

        uploadedRecords.push({
          employee_id: formData.employee_id,
          doc_type: docCategory,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: profile?.full_name || profile?.employee_id || 'Admin'
        });
      }

      const { error: dbError } = await supabase.from('documents').insert(uploadedRecords);
      if (dbError) throw dbError;

      toast.success(`Successfully uploaded`, { id: toastId });
      
      const { data: updatedDocs } = await supabase.from('documents').select('*').eq('employee_id', formData.employee_id);
      setDocuments(updatedDocs || []);
    } catch (err) {
      console.error('Employee document upload failed:', err);
      toast.error(`Upload failed: ${err.message}`, { id: toastId });
    } finally {
      setActiveDocCategory(null);
    }
  };

  const handleDeleteDocument = async (docId, fileUrl) => {
    try {
      // Optional: Delete from storage bucket
      const filePathMatches = fileUrl.match(/employee-documents\/(.+)$/);
      if (filePathMatches && filePathMatches[1]) {
         await supabase.storage.from('employee-documents').remove([filePathMatches[1]]);
      }
      
      // Delete from Database
      await supabase.from('documents').delete().eq('id', docId);
      
      // Refresh state
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast.success('Document deleted');
    } catch (err) {
      console.error('Failed to delete document:', err);
      toast.error('Failed to delete document');
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        toast.success(`${name} deleted successfully`);
        fetchEmployees();
      } catch (error) {
        console.error('Failed to delete employee:', error);
        toast.error('Error deleting employee');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Map standard DB fields (Missing backend schema fields are held in React state to demo UI logic)
      const payload = {
        employee_id: formData.employee_id,
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        department: formData.department,
        designation: formData.designation,
        join_date: formData.join_date || null,
        bank_account: formData.bank_account,
        bank_ifsc: formData.bank_ifsc,
        pan_number: formData.pan_number,
        address: formData.address,
        status: formData.status,
        photo_url: formData.photo_url,
        emergency_contact: formData.emergency_contact,
        blood_group: formData.blood_group,
        work_location: formData.work_location,
        manager: formData.manager,
        dob: formData.dob || null,
        gender: formData.gender,
        employment_type: formData.employment_type
      };

      if (editingId) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Employee updated successfully');
      } else {
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;
        toast.success('Employee added successfully');
      }
      setIsModalOpen(false);
      fetchEmployees();
    } catch (error) {
      console.error('Failed to save employee:', error);
      toast.error(error.message || 'Failed to save employee');
    }
  };

  const handleExportCSV = async () => {
    const toastId = toast.loading('Generating comprehensive report...');
    try {
      // 1. Fetch all documents to check upload status
      const { data: allDocs, error: docError } = await supabase
        .from('documents')
        .select('employee_id, doc_type');
      
      if (docError) throw docError;

      // Map doc types to employee IDs for easy lookup
      const empDocsMap = {};
      allDocs?.forEach(doc => {
        if (!empDocsMap[doc.employee_id]) empDocsMap[doc.employee_id] = new Set();
        empDocsMap[doc.employee_id].add(doc.doc_type);
      });

      // 2. Define headers in groups
      const headers = [
        // Personal
        'Employee ID', 'Full Name', 'Email', 'Phone', 'Date of Birth', 'Gender', 'Blood Group', 'Emergency Contact', 'Residential Address', 'Status',
        // Professional
        'Department', 'Designation', 'Employment Type', 'Work Location', 'Join Date', 'Manager',
        // Bank
        'Bank Name', 'Account Number', 'IFSC Code', 'Account Type', 'PAN Number',
        // Documents
        'Aadhaar Uploaded', 'PAN Card Uploaded', 'Driving Licence Uploaded', 'Bank Passbook Uploaded', 
        'Qualification Certs Uploaded', 'Experience Cert Uploaded', 'Offer Letter Uploaded', 'Other Docs Uploaded'
      ];

      // 3. Transform employee data into CSV rows
      const csvRows = employees.map(e => {
        const docs = empDocsMap[e.employee_id] || new Set();
        
        // Helper to check for multiple possible doc type names or "Others"
        const hasOtherDocs = docs.has('Others') || docs.has('Official Documents') || 
                            docs.has('Confirmation Letter') || docs.has('Photo') || 
                            docs.has('Device & Details Pics');

        return [
          // Personal (Quotes for names and addresses to handle commas)
          e.employee_id || '',
          `"${e.full_name || ''}"`,
          e.email || '',
          e.phone || '',
          e.dob || '',
          e.gender || '',
          e.blood_group || '',
          e.emergency_contact || '',
          `"${(e.address || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          (e.status || 'active').toUpperCase(),
          
          // Professional
          e.department || '',
          e.designation || '',
          e.employment_type || '',
          e.work_location || '',
          e.join_date || '',
          e.manager || '',
          
          // Bank
          e.bank_name || '',
          e.bank_account || '',
          e.bank_ifsc || '',
          e.account_type || '',
          e.pan_number || '',
          
          // Documents (Yes/No as requested)
          docs.has('Aadhaar Card') ? 'Yes' : 'No',
          docs.has('PAN Card') ? 'Yes' : 'No',
          docs.has('Driving Licence') ? 'Yes' : 'No',
          docs.has('Bank Passbook') ? 'Yes' : 'No',
          docs.has('Qualification Certificates') ? 'Yes' : 'No',
          docs.has('Experience Certificate') ? 'Yes' : 'No',
          docs.has('Offer Letter') ? 'Yes' : 'No',
          hasOtherDocs ? 'Yes' : 'No'
        ].join(',');
      });

      // 4. Combine and download
      const csvString = [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `employees_full_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Export completed successfully', { id: toastId });
    } catch (err) {
      toast.error('Export failed: ' + err.message, { id: toastId });
    }
  };

  // Filter Logic
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'All' || emp.department === filterDept;
    const matchesStatus = filterStatus === 'All' || emp.status === filterStatus.toLowerCase();
    
    return matchesSearch && matchesDept && matchesStatus;
  });

  const statuses = ['All', 'Active', 'Inactive', 'On Leave'];

  const TABS = [
    { id: 'Personal', icon: User },
    { id: 'Professional', icon: Building2 },
    { id: 'Bank', icon: CreditCard },
    { id: 'Documents', icon: FileText }
  ];

  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full p-4">
      <Breadcrumb items={[{ label: 'Employees', path: null }]} />
      <button 
        onClick={() => navigate('/dashboard')} 
        className="group flex items-center text-xs font-black text-slate-400 hover:text-[#0f172a] transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        BACK TO DASHBOARD
      </button>

      <div>
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div className="flex space-x-6">
            <button className="text-[#1E3A5F] font-bold border-b-2 border-[#1E3A5F] pb-3 -mb-[13px]">Employee Directory</button>
            <button className="text-gray-500 font-medium hover:text-gray-700 pb-3">Org Chart</button>
            <button className="text-gray-500 font-medium hover:text-gray-700 pb-3">Reports</button>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={handleExportCSV}
              className="flex items-center px-4 py-1.5 bg-white border border-gray-300 rounded text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            <button 
              onClick={openAddModal}
              className="flex items-center px-4 py-1.5 bg-[#1E3A5F] text-white rounded text-sm font-semibold hover:bg-[#2A4D7C] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name or ID..." 
            className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#2E86AB] text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <select 
            className="border border-gray-300 rounded px-3 py-1.5 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#2E86AB]"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="All">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select 
            className="border border-gray-300 rounded px-3 py-1.5 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#2E86AB]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-4">
            <TableSkeleton columns={7} rows={6} />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-6">
            <EmptyStatePanel
              icon={Users}
              title={employees.length === 0 ? 'No employees available' : 'No employees match these filters'}
              description={loadError || (employees.length === 0
                ? 'Add an employee or verify the Supabase employee records to populate this directory.'
                : 'Try changing the search, department, or status filters to see more employees.')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
                  <th className="py-3 px-4 w-12 text-center text-gray-400">#</th>
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, idx) => (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors group cursor-pointer" onClick={() => openViewModal(emp)}>
                    <td className="py-3 px-4 text-center text-gray-400 text-xs">{idx + 1}</td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[#1E3A5F] overflow-hidden text-xs">
                        {emp.photo_url ? (
                          <img src={emp.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          emp.full_name?.charAt(0)
                        )}
                      </div>
                      <div className="font-semibold text-gray-800">{emp.full_name}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{emp.employee_id || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{emp.designation || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{emp.department || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-[11px] font-bold rounded-sm border ${
                        emp.status?.toLowerCase() === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {emp.status?.toUpperCase() || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4 gap-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); openViewModal(emp); }} className="p-1.5 text-gray-500 hover:text-[#1E3A5F] rounded" title="View Profile">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openEditModal(emp); }} className="p-1.5 text-gray-500 hover:text-[#2E86AB] rounded" title="Edit Employee">
                        <Edit className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.full_name); }} className="p-1.5 text-gray-500 hover:text-red-500 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#F5F6FA]">
              <h2 className="text-xl font-bold text-[#1E3A5F]">
                {editingId ? 'Edit Employee Profile' : 'Add New Employee'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1 rounded-full shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-200 bg-white px-6">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = modalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setModalTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                      isActive ? 'border-[#2E86AB] text-[#2E86AB]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.id}
                  </button>
                )
              })}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
              <form id="employee-form" onSubmit={handleSubmit} className="space-y-6">
                
                {/* Personal Tab */}
                {modalTab === 'Personal' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="md:col-span-2 flex justify-center mb-2">
                       <div className="relative group w-24 h-24 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center text-3xl text-[#1E3A5F] font-bold">
                          {formData.photo_url ? (
                            <img src={formData.photo_url} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            formData.full_name?.charAt(0) || <User className="w-10 h-10 text-gray-400" />
                          )}
                          <label className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center cursor-pointer transition-all">
                             {isUploadingImage ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Upload className="w-6 h-6 text-white" />}
                             <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                          </label>
                       </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                      <input required type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address <span className="text-red-500">*</span></label>
                      <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                      <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]">
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
                      <input placeholder="e.g. O+" type="text" name="blood_group" value={formData.blood_group} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Residential Address</label>
                      <textarea name="address" rows="3" value={formData.address} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]"></textarea>
                    </div>
                  </div>
                )}

                {/* Professional Tab */}
                {modalTab === 'Professional' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID <span className="text-red-500">*</span></label>
                      <input required type="text" name="employee_id" value={formData.employee_id} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
                      <input type="text" name="designation" value={formData.designation} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                      <select name="department" value={formData.department} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]">
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
                      <select name="employment_type" value={formData.employment_type} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]">
                        <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date of Joining</label>
                      <input type="date" name="join_date" value={formData.join_date} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="on_leave">On Leave</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Work Location</label>
                      <select name="work_location" value={formData.work_location} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]">
                        <option value="">Select Location</option>
                        <option value="Main Office - Erode">Main Office - Erode</option>
                        <option value="Showroom - Erode">Showroom - Erode</option>
                        <option value="Remote">Remote</option>
                        <option value="Other">Other</option>
                      </select>

                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reporting Manager</label>
                      <select 
                        name="manager" 
                        value={formData.manager} 
                        onChange={handleInputChange} 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F] bg-white text-sm"
                      >
                        <option value="">No Manager Assigned</option>
                        {(employees || [])
                          .filter(e => e.status === 'active' && e.employee_id !== formData.employee_id)
                          .map(e => (
                            <option key={e.employee_id} value={e.employee_id}>
                              {e.full_name} ({e.employee_id})
                            </option>
                          ))
                        }
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact</label>
                      <input type="text" name="emergency_contact" value={formData.emergency_contact} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                  </div>
                )}

                {/* Bank Tab */}
                {modalTab === 'Bank' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                      <input type="text" name="bank_account" value={formData.bank_account} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
                      <input type="text" name="bank_ifsc" value={formData.bank_ifsc} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                      <input type="text" name="bank_name" value={formData.bank_name} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number</label>
                      <input type="text" name="pan_number" value={formData.pan_number} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F] focus:border-[#1E3A5F]" />
                    </div>
                  </div>
                )}

                {/* Documents Tab */}
                {modalTab === 'Documents' && (
                  <div className="space-y-6 relative">
                    {/* Account Section */}
                    {isHRorAdmin && (
                       <div className="bg-white p-6 rounded-xl border-2 border-[#1E3A5F]/10 shadow-sm mb-6">
                         <div className="flex items-center gap-3 mb-4">
                           <div className="p-2 bg-[#1E3A5F]/5 rounded-lg">
                             <Lock className="w-5 h-5 text-[#1E3A5F]" />
                           </div>
                           <h3 className="font-bold text-[#1E3A5F]">User Login Account</h3>
                         </div>
                         
                         <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 text-sm flex items-start gap-3">
                            <span className="text-lg">ðŸ’¡</span>
                            <div>
                               <p className="font-bold">Important Step:</p>
                               <p>1. First, manually create the user account in the <b>Supabase Dashboard</b> using the email below.</p>
                               <p>2. Then, use the button below to send the employee a <b>Password Setup Email</b>.</p>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Login Email</label>
                              <input type="text" readOnly value={formData.email} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                            </div>
                            <button
                              type="button"
                              disabled={isUpdatingAccount || !editingId || !formData.email}
                              onClick={async () => {
                                setIsUpdatingAccount(true);
                                try {
                                  const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
                                    redirectTo: `${window.location.origin}/reset-password`
                                  });
                                  if (error) throw error;
                                  toast.success(`Password setup email sent to ${formData.email}!`, { duration: 6000 });
                                } catch (e) {
                                  toast.error(e.message || 'Failed to send reset email');
                                } finally {
                                  setIsUpdatingAccount(false);
                                }
                              }}
                              className="px-4 py-2 bg-[#2E86AB] text-white rounded-lg text-sm font-bold hover:bg-[#1E3A5F] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                            >
                              {isUpdatingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                              Send Password Setup Email
                            </button>
                         </div>
                       </div>
                    )}

                    {/* Hidden global file input triggered by category buttons */}

                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      multiple 
                      onChange={handleDocumentUpload} 
                    />

                    {!editingId && (
                       <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200 shadow-sm flex items-center gap-3">
                         <span className="text-xl">â„¹ï¸</span>
                         <span className="text-sm font-medium">To upload documents for a new employee, make sure Full Name, Email, and Employee ID are filled. The system will auto-save before uploading.</span>
                       </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        'Aadhaar Card', 'PAN Card', 'Driving Licence', 'Bank Passbook', 
                        'Qualification Certificates', 'Experience Certificate', 'Pay Slip', 
                        'Offer Letter', 'Confirmation Letter', 'Official Documents', 
                        'Photo', 'Device & Details Pics', 'Others'
                      ].map(category => {
                        const categoryDocs = documents.filter(d => d.doc_type === category || d.document_type === category);
                        
                        return (
                          <div key={category} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                            <div className="flex items-center gap-3 mb-3 border-b border-gray-50 pb-3">
                              <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-800 leading-tight">{category}</h3>
                                <p className="text-xs text-gray-400 mt-0.5">{categoryDocs.length} file(s) uploaded</p>
                              </div>
                            </div>
                            
                            {/* Uploaded Files List */}
                            {categoryDocs.length > 0 && (
                               <div className="space-y-2 mb-4">
                                 {categoryDocs.map(doc => (
                                   <div key={doc.id} className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded-lg group hover:border-green-300 transition-colors">
                                      <div className="flex flex-col overflow-hidden max-w-[75%]">
                                        <span className="text-xs font-semibold text-green-800 truncate" title={doc.file_name}>{doc.file_name || 'Document'}</span>
                                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline inline-flex">View / Download</a>
                                      </div>
                                      <button type="button" onClick={() => handleDeleteDocument(doc.id, doc.file_url)} className="p-1.5 text-red-400 opacity-80 hover:opacity-100 hover:text-red-700 hover:bg-red-50 rounded-md transition-all" title="Delete file">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                   </div>
                                 ))}
                               </div>
                            )}

                            {/* Upload Button Area */}
                            <div className="mt-auto pt-2">
                               <button 
                                 type="button"
                                 onClick={() => triggerUpload(category)}
                                 className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-blue-300 rounded-lg text-sm font-medium transition-all bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-400 cursor-pointer"
                               >
                                 <Upload className="w-4 h-4" /> 
                                 {categoryDocs.length > 0 ? 'Upload More' : 'Upload File'}
                               </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button form="employee-form" type="submit" className="px-5 py-2 bg-green-600 text-white font-medium hover:bg-green-700 rounded-lg shadow-sm transition-colors">
                {editingId ? 'Save Changes' : 'Create Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {viewingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#F5F7FA] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 flex justify-between items-center z-10 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center font-bold text-xl text-[#1E3A5F] overflow-hidden border-2 border-white shadow-sm">
                  {viewingEmp.photo_url ? <img src={viewingEmp.photo_url} alt="" className="w-full h-full object-cover" /> : viewingEmp.full_name?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1E3A5F] leading-tight">{viewingEmp.full_name}</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-mono mt-0.5">
                    <span>#{viewingEmp.employee_id}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="text-[#2E86AB] font-semibold">{viewingEmp.designation || 'Employee'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isHRorAdmin && (
                  <button
                    disabled={isUpdatingAccount}
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to send a password reset email to ${viewingEmp.full_name}?`)) {
                        setIsUpdatingAccount(true);
                        try {
                          const { error } = await supabase.auth.resetPasswordForEmail(viewingEmp.email, {
                            redirectTo: `${window.location.origin}/reset-password`
                          });
                          if (error) throw error;
                          toast.success(`Reset email sent to ${viewingEmp.email}!`);
                        } catch (e) {
                          toast.error(e.message || 'Failed to send reset email');
                        } finally {
                          setIsUpdatingAccount(false);
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-bold hover:bg-orange-100 transition-all disabled:opacity-50"
                  >
                    <Mail className="w-4 h-4" />
                    Send Reset Email
                  </button>
                )}

                <button onClick={() => setViewingEmp(null)} className="text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

            </div>

            {/* Content Body */}
            <div className="flex flex-1 overflow-hidden">
               {/* Left Sidebar Tabs */}
               <div className="w-64 bg-white border-r border-gray-100 flex flex-col pt-4 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)] z-0">
                 {[
                   { id: 'Personal', icon: User, label: 'Personal Info' },
                   { id: 'Professional', icon: Briefcase, label: 'Professional Info' },
                   { id: 'Bank', icon: CreditCard, label: 'Bank Details' },
                   { id: 'Documents', icon: FileText, label: 'Documents' },
                   { id: 'Attendance', icon: Clock, label: 'Attendance' },
                   { id: 'Leaves', icon: Calendar, label: 'Leave Balance' }
                 ].map(tab => {
                   const isActive = viewTab === tab.id;
                   return (
                     <button
                       key={tab.id}
                       onClick={() => setViewTab(tab.id)}
                       className={`flex items-center gap-3 px-6 py-3.5 text-sm font-medium transition-all border-l-4 ${
                         isActive ? 'border-[#2E86AB] bg-blue-50/50 text-[#1E3A5F]' : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                       }`}
                     >
                       <tab.icon className={`w-4 h-4 ${isActive ? 'text-[#2E86AB]' : 'text-gray-400'}`} />
                       {tab.label}
                     </button>
                   );
                 })}
               </div>

               {/* Right Content Area */}
               <div className="flex-1 overflow-y-auto p-8 relative">
                  {isLoadingViewData && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 flex items-center justify-center">
                       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E3A5F]"></div>
                    </div>
                  )}

                  {/* TAB 1: Personal Info */}
                  {viewTab === 'Personal' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                       <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-6">Personal Details</h3>
                       
                       <div className="grid grid-cols-2 gap-8">
                         <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date of Birth</p>
                            <p className="font-medium text-gray-900">{viewingEmp.dob ? format(new Date(viewingEmp.dob), 'MMMM dd, yyyy') : '--'}</p>
                         </div>
                         <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Gender</p>
                            <p className="font-medium text-gray-900">{viewingEmp.gender || '--'}</p>
                         </div>
                         <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Blood Group</p>
                            <p className="font-medium text-gray-900">{viewingEmp.blood_group || '--'}</p>
                         </div>
                         <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                            <span className={`px-2 py-0.5 text-xs font-bold rounded bg-gray-100 ${viewingEmp.status === 'active' ? 'text-green-700' : 'text-red-700'}`}>
                              {viewingEmp.status?.toUpperCase() || 'ACTIVE'}
                            </span>
                         </div>
                       </div>
                       
                       <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-6 mt-8">Contact Information</h3>
                       <div className="grid grid-cols-2 gap-8">
                         <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone Number</p>
                            <p className="font-medium text-gray-900">{viewingEmp.phone || '--'}</p>
                         </div>
                         <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</p>
                            <p className="font-medium text-blue-600">{viewingEmp.email || '--'}</p>
                         </div>
                         <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Emergency Contact</p>
                            <p className="font-medium text-gray-900">{viewingEmp.emergency_contact || '--'}</p>
                         </div>
                         <div className="col-span-2">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Residential Address</p>
                            <p className="font-medium text-gray-900">{viewingEmp.address || '--'}</p>
                         </div>
                       </div>
                    </div>
                  )}

                  {/* TAB 2: Professional Info */}
                  {viewTab === 'Professional' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                       <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-6">Employment Details</h3>
                       
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                             <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Department</p>
                             <p className="font-medium text-gray-900">{viewingEmp.department || '--'}</p>
                          </div>
                          <div>
                             <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Designation</p>
                             <p className="font-medium text-gray-900">{viewingEmp.designation || '--'}</p>
                          </div>
                          <div>
                             <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Employment Type</p>
                             <p className="font-medium text-gray-900">{viewingEmp.employment_type || '--'}</p>
                          </div>
                          <div>
                             <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date of Joining</p>
                             <p className="font-medium text-gray-900">{viewingEmp.join_date ? format(new Date(viewingEmp.join_date), 'dd MMM yyyy') : '--'}</p>
                          </div>
                          <div>
                             <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Work Location</p>
                             <p className="font-medium text-gray-900">{viewingEmp.work_location || '--'}</p>
                          </div>
                          <div>
                             <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Reporting Manager</p>
                             <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <p className="font-medium text-[#1E3A5F]">{viewingEmp.manager || '--'}</p>
                             </div>
                          </div>
                        </div>

                    </div>
                  )}

                  {/* TAB 3: Bank Details */}
                  {viewTab === 'Bank' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                       <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-6">Financial Information</h3>
                       
                       <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                          <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-0 opacity-50"></div>
                          
                          <div className="grid grid-cols-2 gap-8 relative z-10">
                            <div className="col-span-2">
                               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Bank Name</p>
                               <p className="font-bold text-xl text-[#1E3A5F]">{viewingEmp.bank_name || 'Not Provided'}</p>
                            </div>
                            <div>
                               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Account Number</p>
                               <p className="font-mono text-lg text-gray-900 tracking-wider">
                                 {viewingEmp.bank_account ? 
                                  'â€¢'.repeat(Math.max(0, viewingEmp.bank_account.length - 4)) + viewingEmp.bank_account.slice(-4) 
                                  : '----'}
                               </p>
                            </div>
                            <div>
                               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">IFSC Code</p>
                               <p className="font-mono text-lg text-gray-900 tracking-wider">{viewingEmp.bank_ifsc || '----'}</p>
                            </div>
                            <div>
                               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Account Type</p>
                               <p className="font-medium text-gray-900">{viewingEmp.account_type || 'Savings'}</p>
                            </div>
                            <div>
                               <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">PAN Number</p>
                               <p className="font-mono font-medium text-gray-900">{viewingEmp.pan_number || '----'}</p>
                            </div>
                          </div>
                       </div>
                    </div>
                  )}

                  {/* TAB 4: Documents */}
                  {viewTab === 'Documents' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                       <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-6">
                         <h3 className="text-lg font-bold text-gray-900">Uploaded Documents</h3>
                         <button onClick={() => { setViewingEmp(null); openEditModal(viewingEmp); }} className="text-sm font-medium text-[#2E86AB] flex items-center hover:underline">
                           <Upload className="w-4 h-4 mr-1" /> Upload New
                         </button>
                       </div>
                       
                       {viewDocs.length === 0 ? (
                         <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                           <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                           <p className="text-gray-500 font-medium">No documents uploaded yet</p>
                         </div>
                       ) : (
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {viewDocs.map(doc => (
                             <div key={doc.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start gap-3 group hover:border-blue-300 transition-colors">
                               <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center shrink-0">
                                 <FileText className="w-5 h-5" />
                               </div>
                               <div className="flex-1 min-w-0">
                                 <h4 className="font-semibold text-gray-900 text-sm truncate">{doc.file_name}</h4>
                                 <div className="flex items-center gap-2 mt-1">
                                   <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{doc.doc_type}</span>
                                   <span className="text-[10px] text-gray-400">{format(new Date(doc.created_at), 'dd MMM yyyy')}</span>
                                 </div>
                               </div>
                               <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-[#2E86AB] hover:bg-blue-50 rounded-lg transition-colors">
                                 <DownloadCloud className="w-5 h-5" />
                               </a>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                  )}

                  {/* TAB 5: Attendance */}
                  {viewTab === 'Attendance' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                       <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-6">Attendance Summary</h3>
                       
                       <div className="grid grid-cols-2 gap-4 mb-8">
                          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                               <p className="text-sm font-semibold text-gray-500">Present (This Month)</p>
                               <p className="text-2xl font-bold text-gray-900">{viewAttendance.present} <span className="text-sm font-medium text-gray-400">days</span></p>
                            </div>
                          </div>
                          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                              <XCircle className="w-6 h-6" />
                            </div>
                            <div>
                               <p className="text-sm font-semibold text-gray-500">Absent (This Month)</p>
                               <p className="text-2xl font-bold text-gray-900">{viewAttendance.absent} <span className="text-sm font-medium text-gray-400">days</span></p>
                            </div>
                          </div>
                       </div>

                       <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                         <h4 className="text-sm font-bold text-gray-700 mb-6">6-Month Attendance Trend (%)</h4>
                         <div className="h-64">
                           <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={viewAttendance.chartData.reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                               <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                               <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                               <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                               <Bar dataKey="Rate" fill="#2E86AB" radius={[4, 4, 0, 0]} barSize={40} />
                             </BarChart>
                           </ResponsiveContainer>
                         </div>
                       </div>
                    </div>
                  )}

                  {/* TAB 6: Leaves */}
                  {viewTab === 'Leaves' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                       <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2 mb-6">Leave Balances</h3>
                       
                       <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm text-center">
                            <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-2">Annual</h4>
                            <div className="text-4xl font-black text-blue-600">{viewLeaves.annual}</div>
                            <p className="text-xs font-medium text-blue-400 mt-1">Days Remaining</p>
                          </div>
                          <div className="bg-white p-6 rounded-xl border border-orange-100 shadow-sm text-center">
                            <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-2">Sick</h4>
                            <div className="text-4xl font-black text-orange-500">{viewLeaves.sick}</div>
                            <p className="text-xs font-medium text-orange-400 mt-1">Days Remaining</p>
                          </div>
                          <div className="bg-white p-6 rounded-xl border border-green-100 shadow-sm text-center">
                            <h4 className="text-sm font-bold text-green-800 uppercase tracking-wider mb-2">Casual</h4>
                            <div className="text-4xl font-black text-green-600">{viewLeaves.casual}</div>
                            <p className="text-xs font-medium text-green-400 mt-1">Days Remaining</p>
                          </div>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Employees;

