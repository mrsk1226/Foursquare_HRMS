import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, parseISO, isSunday, addDays } from 'date-fns';
import { useLocation } from 'react-router-dom';
import {
  Plus, CheckCircle, XCircle, Clock,
  X, Users, FileSignature, AlertCircle, Calendar, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RequestStatusModal from '../components/RequestStatusModal';
import { DashboardWidgetSkeleton, TableSkeleton } from '../components/ui/LoadingSkeleton';

const LeaveManagement = () => {
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = ['admin', 'hr', 'md'].includes(profile?.role);

  const [activeTab, setActiveTab] = useState(location.state?.tab || 'MyLeaves');
  const [requests, setRequests] = useState([]);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState(location.state?.highlightId || null);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Forms
  const [formData, setFormData] = useState({ leave_type: 'Casual Leave', start_date: '', end_date: '', reason: '' });
  const [permFormData, setPermFormData] = useState({ date: '', start_time: '', end_time: '', reason: 'Medical Appointment', otherReason: '', remarks: '' });
  const [rejectForm, setRejectForm] = useState({ id: null, type: '', reason: '', recipient_id: '', leave_type: '', start_date: '', end_date: '', date: '' });

  const runQuery = async (query, timeoutMs = 15000) => {
    const timed = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    );
    return Promise.race([query, timed]);
  };

  const fetchEmployees = async () => {
    const { data } = await runQuery(
      supabase.from('employees').select('employee_id, full_name, department')
    );
    setAllEmployees(data || []);
  };

  const fetchMyLeaves = async () => {
    const { data } = await runQuery(
      supabase
        .from('leave_requests')
        .select('*, employees(full_name, department)')
        .eq('employee_id', profile.employee_id)
        .order('created_at', { ascending: false })
    );
    setRequests(data || []);
  };

  const fetchMyBalances = async () => {
    const { data } = await runQuery(
      supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', profile.employee_id)
        .eq('year', new Date().getFullYear())
    );
    setBalances(data || []);
  };

  const fetchAllRequests = async () => {
    let query = supabase.from('leave_requests').select('*, employees(full_name, department)').order('created_at', { ascending: false });
    if (selectedEmployee !== 'all') query = query.eq('employee_id', selectedEmployee);
    const { data } = await runQuery(query);
    setRequests(data || []);
  };

  const fetchMyPermissions = async () => {
    const { data } = await runQuery(
      supabase
        .from('permissions')
        .select('*, employees(full_name, department)')
        .eq('employee_id', profile.employee_id)
        .order('created_at', { ascending: false })
    );
    setPermissionRequests(data || []);
  };

  const fetchAllPermissions = async () => {
    let query = supabase.from('permissions').select('*, employees(full_name, department)').order('created_at', { ascending: false });
    if (selectedEmployee !== 'all') query = query.eq('employee_id', selectedEmployee);
    const { data } = await runQuery(query);
    setPermissionRequests(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.allSettled([
        activeTab === 'MyLeaves'
          ? fetchMyLeaves()
          : activeTab === 'TeamLeaves'
              ? fetchAllRequests()
              : activeTab === 'MyPermissions'
                  ? fetchMyPermissions()
                  : fetchAllPermissions(),
        fetchMyBalances(),
        fetchEmployees(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.employee_id) {
      loadData();
    }
  }, [profile, activeTab, selectedEmployee]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
    if (location.state?.highlightId) {
      setHighlightId(String(location.state.highlightId));
    }
  }, [location.state]);

  useEffect(() => {
    if (!highlightId) return;

    const targetRow = document.querySelector(`[data-request-row="${activeTab}-${highlightId}"]`);
    if (!targetRow) return;

    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeoutId = window.setTimeout(() => setHighlightId(null), 5000);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, highlightId, requests, permissionRequests]);

  const calculateDays = (start, end, dept = '') => {
    let s = parseISO(start);
    let e = parseISO(end);
    let count = 0;
    let isOffice = dept.toLowerCase().includes('office');

    let cur = s;
    while (cur <= e) {
      if (!(isOffice && isSunday(cur))) {
        count++;
      }
      cur = addDays(cur, 1);
    }
    return count;
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!formData.reason) return toast.error("Reason is required");
    try {
      const { data, error } = await supabase.from('leave_requests').insert([{
        employee_id: profile.employee_id,
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
        status: 'pending',
        created_at: new Date().toISOString()
      }]).select().single();

      if (error) throw error;

      const days = calculateDays(formData.start_date, formData.end_date);
      await supabase.from('notifications').insert([{
        recipient_employee_id: 'FSQ002',
        sender_employee_id: profile.employee_id,
        type: 'leave_request',
        title: 'New Leave Request',
        message: `${profile.full_name} applied for ${formData.leave_type} - ${days} days (${formData.start_date} to ${formData.end_date})`,
        reference_type: 'leave_request',
        reference_id: data.id.toString(),
        is_read: false
      }]);

      toast.success('Leave application submitted!');
      setIsModalOpen(false);
      setFormData({ leave_type: 'Casual Leave', start_date: '', end_date: '', reason: '' });
      fetchMyLeaves();
    } catch {
      toast.error('Failed to apply');
    }
  };

  const handleApplyPermission = async (e) => {
    e.preventDefault();
    const finalReason = permFormData.reason === 'Others' ? permFormData.otherReason : permFormData.reason;
    if (!finalReason) return toast.error("Reason is required");

    // Simple duration calc for client side display
    const startMins = parseInt(permFormData.start_time.split(':')[0]) * 60 + parseInt(permFormData.start_time.split(':')[1]);
    const endMins = parseInt(permFormData.end_time.split(':')[0]) * 60 + parseInt(permFormData.end_time.split(':')[1]);
    const duration = endMins - startMins;

    try {
      const { data, error } = await supabase.from('permissions').insert([{
        employee_id: profile.employee_id,
        date: permFormData.date,
        start_time: permFormData.start_time,
        end_time: permFormData.end_time,
        duration_minutes: duration,
        reason: finalReason,
        remarks: permFormData.remarks,
        status: 'pending',
        created_at: new Date().toISOString()
      }]).select().single();

      if (error) throw error;

      await supabase.from('notifications').insert([{
        recipient_employee_id: 'FSQ002',
        sender_employee_id: profile.employee_id,
        type: 'permission_request',
        title: 'Permission Request',
        message: `${profile.full_name} requested permission on ${permFormData.date} from ${permFormData.start_time} to ${permFormData.end_time} - ${finalReason}`,
        reference_type: 'permission_request',
        reference_id: data.id.toString(),
        is_read: false
      }]);

      toast.success('Permission request submitted!');
      setIsPermissionModalOpen(false);
      setPermFormData({ date: '', start_time: '', end_time: '', reason: 'Medical Appointment', otherReason: '', remarks: '' });
      fetchMyPermissions();
    } catch {
      toast.error('Failed to submit permission');
    }
  };

  const handleApprove = async (req, type) => {
    try {
      const table = type === 'leave' ? 'leave_requests' : 'permissions';
      const { error } = await supabase.from(table).update({
        status: 'approved',
        approved_by: profile.employee_id,
        approved_at: new Date().toISOString()
      }).eq('id', req.id);

      if (error) throw error;

      if (type === 'leave') {
        const days = calculateDays(req.start_date, req.end_date, req.employees?.department);
        const { data: bal } = await supabase.from('leave_balances').select('*').eq('employee_id', req.employee_id).eq('leave_type', req.leave_type).eq('year', new Date().getFullYear()).maybeSingle();
        if (bal) {
          await supabase.from('leave_balances').update({
            used: (bal.used || 0) + days,
            remaining: (bal.remaining || 0) - days
          }).eq('id', bal.id);
        }

        await supabase.from('notifications').insert([{
          recipient_employee_id: req.employee_id,
          sender_employee_id: profile.employee_id,
          type: 'leave_approved',
          title: 'Leave Approved',
          message: `Your ${req.leave_type} from ${req.start_date} to ${req.end_date} has been approved by HR`,
          reference_type: 'leave_request',
          reference_id: String(req.id),
          is_read: false
        }]);
      } else {
        await supabase.from('notifications').insert([{
          recipient_employee_id: req.employee_id,
          sender_employee_id: profile.employee_id,
          type: 'permission_approved',
          title: 'Permission Approved',
          message: `Your permission request for ${req.date} has been approved by HR`,
          reference_type: 'permission_request',
          reference_id: String(req.id),
          is_read: false
        }]);
      }

      toast.success('Request approved successfully');
      loadData();
    } catch {
      toast.error('Approval failed');
    }
  };

  const handleRejectClick = (req, type) => {
    setRejectForm({
      id: req.id,
      type,
      reason: '',
      recipient_id: req.employee_id,
      leave_type: req.leave_type,
      start_date: req.start_date,
      end_date: req.end_date,
      date: req.date
    });
    setIsRejectModalOpen(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectForm.reason.trim()) return;

    try {
      const table = rejectForm.type === 'leave' ? 'leave_requests' : 'permissions';
      // User specifies rejection_reason for leave but didn't specify for permissions. I'll use rejection_reason as requested.
      const updateData = { status: 'rejected' };
      if (rejectForm.type === 'leave') updateData.rejection_reason = rejectForm.reason;
      else updateData.rejection_reason = rejectForm.reason; // Standardizing

      await supabase.from(table).update(updateData).eq('id', rejectForm.id);

      const title = rejectForm.type === 'leave' ? 'Leave Rejected' : 'Permission Rejected';
      const msg = rejectForm.type === 'leave'
        ? `Your ${rejectForm.leave_type} request was rejected. Reason: ${rejectForm.reason}`
        : `Your permission for ${rejectForm.date} was rejected. Reason: ${rejectForm.reason}`;

      await supabase.from('notifications').insert([{
        recipient_employee_id: rejectForm.recipient_id,
        sender_employee_id: profile.employee_id,
        type: `${rejectForm.type}_rejected`,
        title,
        message: msg,
        reference_type: rejectForm.type === 'leave' ? 'leave_request' : 'permission_request',
        reference_id: String(rejectForm.id),
        is_read: false
      }]);

      toast.success('Request rejected');
      setIsRejectModalOpen(false);
      loadData();
    } catch {
      toast.error('Rejection failed');
    }
  };

  const openRequestDetail = (request) => {
    setSelectedRequestDetail(request);
  };

  const StatusBadge = ({ status }) => {
    const s = status?.toLowerCase() || 'pending';
    const colors = { pending: 'bg-orange-100 text-orange-600', approved: 'bg-green-100 text-green-600', rejected: 'bg-red-100 text-red-600' };
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${colors[s]}`}>
        {status}
      </span>
    );
  };

  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6 bg-[#F8F9FD] min-h-screen">
      <button
        onClick={() => navigate('/dashboard')}
        className="group flex items-center text-xs font-black text-slate-400 hover:text-[#0f172a] transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        BACK TO DASHBOARD
      </button>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-[#1E3A5F] tracking-tighter">LEAVE & PERMISSIONS</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Manage your leave requests</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
          {['MyLeaves', 'MyPermissions', 'TeamLeaves', 'TeamPermissions'].map(tab => (
            (tab.startsWith('Team') && !isAdmin) ? null : (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === tab ? 'bg-[#1E3A5F] text-white shadow-lg' : 'text-gray-400 hover:text-[#1E3A5F]'}`}
              >
                {tab.replace(/([A-Z])/g, ' $1').toUpperCase()}
              </button>
            )
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {loading && activeTab.startsWith('My') ? (
          <DashboardWidgetSkeleton />
        ) : activeTab.startsWith('My') && (
          <>
            {balances.map(b => (
              <div key={b.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Calendar size={64} />
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{b.leave_type}</p>
                <h3 className="text-3xl font-black text-[#1E3A5F]">{b.remaining} <span className="text-xs text-gray-400 font-bold">/ {b.total}</span></h3>
                <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${(b.remaining / b.total) * 100}%` }}></div>
                </div>
              </div>
            ))}
            <button
              onClick={() => activeTab === 'MyLeaves' ? setIsModalOpen(true) : setIsPermissionModalOpen(true)}
              className="bg-[#1E3A5F] p-6 rounded-3xl text-white flex flex-col items-center justify-center gap-2 hover:bg-[#2A4D7C] transition-all shadow-xl group"
            >
              <Plus className="group-hover:rotate-90 transition-transform" />
              <span className="font-bold text-sm uppercase tracking-tighter">Apply New</span>
            </button>
          </>
        )}
      </div>

      {activeTab.startsWith('Team') && (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={18} /></div>
            <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="text-sm font-bold bg-transparent border-none focus:ring-0">
              <option value="all">ALL EMPLOYEES OVERVIEW</option>
              {allEmployees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.full_name} ({e.employee_id})</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50/50 text-gray-400 font-black uppercase tracking-tighter border-b border-gray-100">
              {activeTab.startsWith('Team') && <th className="p-5">Employee & Dept</th>}
              <th className="p-5">{activeTab.includes('Leaves') ? 'Leave Type' : 'Date'}</th>
              <th className="p-5">{activeTab.includes('Leaves') ? 'From | To' : 'Time (Start - End)'}</th>
              <th className="p-5">{activeTab.includes('Leaves') ? 'Total Days' : 'Duration'}</th>
              <th className="p-5">Reason</th>
              <th className="p-5">Applied On</th>
              <th className="p-5 text-center">Status</th>
              {activeTab.startsWith('Team') && <th className="p-5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 font-bold text-[#1E3A5F]">
            {(activeTab.includes('Leaves') ? requests : permissionRequests).map(req => {
              const isHighlighted = String(req.id) === String(highlightId);

              return (
                <tr
                  key={req.id}
                  data-request-row={`${activeTab}-${req.id}`}
                  onClick={() => openRequestDetail(req)}
                  className={`cursor-pointer transition-colors ${isHighlighted ? 'bg-amber-50 shadow-[inset_4px_0_0_0_#f59e0b]' : 'hover:bg-blue-50/10'}`}
                >
                  {activeTab.startsWith('Team') && (
                    <td className="p-5">
                      <p>{req.employees?.full_name}</p>
                      <p className="text-[10px] text-gray-400 font-medium uppercase">{req.employees?.department}</p>
                    </td>
                  )}
                  <td className="p-5">
                    <div className="flex items-center gap-2">
                      {activeTab.includes('Leaves') ? <FileSignature size={14} className="text-blue-400" /> : <Clock size={14} className="text-orange-400" />}
                      {activeTab.includes('Leaves') ? req.leave_type : format(parseISO(req.date), 'dd MMM yyyy')}
                    </div>
                  </td>
                  <td className="p-5">
                    {activeTab.includes('Leaves') ? `${req.start_date} | ${req.end_date}` : `${req.start_time} - ${req.end_time}`}
                  </td>
                  <td className="p-5">
                    {activeTab.includes('Leaves') ? `${calculateDays(req.start_date, req.end_date, req.employees?.department)} Days` : `${req.duration_minutes} Mins`}
                  </td>
                  <td className="p-5 max-w-[200px] truncate" title={req.reason}>
                    {req.reason}
                  </td>
                  <td className="p-5 text-gray-400 uppercase text-[10px]">
                    {format(new Date(req.created_at), 'dd MMM | HH:mm')}
                  </td>
                  <td className="p-5 text-center"><StatusBadge status={req.status} /></td>
                  {activeTab.startsWith('Team') && (
                    <td className="p-5">
                      {req.status?.toLowerCase() === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={(event) => { event.stopPropagation(); handleApprove(req, activeTab.includes('Leaves') ? 'leave' : 'permission'); }} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all"><CheckCircle size={16} /></button>
                          <button onClick={(event) => { event.stopPropagation(); handleRejectClick(req, activeTab.includes('Leaves') ? 'leave' : 'permission'); }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"><XCircle size={16} /></button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {loading && (
          <div className="p-5">
            <TableSkeleton columns={activeTab.startsWith('Team') ? 8 : 6} rows={6} />
          </div>
        )}
        {!loading && (activeTab.includes('Leaves') ? requests : permissionRequests).length === 0 && (
          <div className="p-20 text-center text-gray-300">
            <AlertCircle className="mx-auto mb-2 opacity-20" size={48} />
            <p className="font-black italic">NO DATA FLOWING THROUGH THIS CHANNEL</p>
          </div>
        )}
      </div>

      {/* LEAVE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gray-50 px-8 py-6 flex justify-between items-center border-b">
              <h2 className="text-xl font-black text-[#1E3A5F] tracking-tighter">LEAVE APPLICATION</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500"><X /></button>
            </div>
            <form onSubmit={handleApplyLeave} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Type of Leave</label>
                <select required className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={formData.leave_type} onChange={e => setFormData({ ...formData, leave_type: e.target.value })}>
                  <option>Casual Leave</option>
                  <option>Sick Leave</option>
                  <option>Earned Leave</option>
                  <option>Loss of Pay (LOP)</option>
                  <option>Maternity Leave</option>
                  <option>Paternity Leave</option>
                  <option>Compensatory Off (Comp Off)</option>
                  <option>Marriage Leave</option>
                  <option>Bereavement Leave</option>
                  <option>Emergency Leave</option>
                  <option>Public Holiday</option>
                  <option>Work From Home (WFH)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Start Date</label>
                  <input required type="date" className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">End Date</label>
                  <input required type="date" className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detailed Reason</label>
                <textarea required rows="3" className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} placeholder="Explain your requirement clearly..." />
              </div>
              <button type="submit" className="w-full py-4 bg-[#1E3A5F] text-white rounded-2xl font-black shadow-xl hover:translate-y-[-2px] transition-all">TRANSMIT REQUEST</button>
            </form>
          </div>
        </div>
      )}

      {/* PERMISSION MODAL */}
      {isPermissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gray-50 px-8 py-6 flex justify-between items-center border-b">
              <h2 className="text-xl font-black text-[#1E3A5F] tracking-tighter">PERMISSION REQUEST</h2>
              <button onClick={() => setIsPermissionModalOpen(false)} className="text-gray-400 hover:text-red-500"><X /></button>
            </div>
            <form onSubmit={handleApplyPermission} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date of Permission</label>
                <input required type="date" className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={permFormData.date} onChange={e => setPermFormData({ ...permFormData, date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Start Time</label>
                  <input required type="time" className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={permFormData.start_time} onChange={e => setPermFormData({ ...permFormData, start_time: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">End Time</label>
                  <input required type="time" className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={permFormData.end_time} onChange={e => setPermFormData({ ...permFormData, end_time: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason Category</label>
                <select required className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={permFormData.reason} onChange={e => setPermFormData({ ...permFormData, reason: e.target.value })}>
                  {['Medical Appointment', 'Family Emergency', 'Bank Work', 'Government Office Work', 'Vehicle Breakdown', 'Child School Work', 'Personal Health Issue', 'Home Emergency', 'Court/Legal Work', 'Others'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {permFormData.reason === 'Others' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Specify Reason</label>
                  <input required type="text" className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={permFormData.otherReason} onChange={e => setPermFormData({ ...permFormData, otherReason: e.target.value })} />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Additional Remarks</label>
                <input type="text" className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50 font-bold" value={permFormData.remarks} onChange={e => setPermFormData({ ...permFormData, remarks: e.target.value })} />
              </div>
              <button type="submit" className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-xl hover:translate-y-[-2px] transition-all">SUBMIT PERMISSION</button>
            </form>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 border-2 border-red-50">
            <div className="flex items-center gap-3 text-red-600 mb-6">
              <AlertCircle size={24} />
              <h2 className="text-xl font-black tracking-tighter uppercase">Rejection Reason</h2>
            </div>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Explanation <span className="text-red-500">*MANDATORY</span></label>
                <textarea required className="w-full px-4 py-3 rounded-xl border-2 border-red-50 bg-red-50/20 font-bold" rows="4" placeholder="Briefly explain why..." value={rejectForm.reason} onChange={e => setRejectForm({ ...rejectForm, reason: e.target.value })}></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-3 text-gray-400 font-bold hover:bg-gray-100 rounded-xl transition-all">CANCEL</button>
                <button
                  type="submit"
                  disabled={!rejectForm.reason.trim()}
                  className={`flex-1 py-3 bg-red-600 text-white font-black rounded-xl shadow-lg transition-all ${!rejectForm.reason.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'}`}
                >
                  REJECT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RequestStatusModal
        open={Boolean(selectedRequestDetail)}
        request={selectedRequestDetail}
        kind={activeTab.includes('Permissions') ? 'permission' : selectedRequestDetail?.leave_type ? 'leave' : 'permission'}
        fallbackName={profile?.full_name}
        onClose={() => setSelectedRequestDetail(null)}
      />
    </div>
  );
};

export default LeaveManagement;
