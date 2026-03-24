import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useLocation } from 'react-router-dom';
import { 
  CheckCircle, XCircle, Clock, 
  Calendar as CalendarIcon, ChevronRight, AlertCircle
} from 'lucide-react';

export default function LeaveManagement() {
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = ['admin', 'hr', 'md'].includes(profile?.role);
  
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'MyLeaves');
  const [highlightId, setHighlightId] = useState(location.state?.highlightId || null);
  const [requests, setRequests] = useState([]);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [loading, setLoading] = useState(true);
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({ leave_type: 'Casual Leave', start_date: '', end_date: '', reason: '' });
  const [approvalForm, setApprovalForm] = useState({ id: null, action: 'approve', remarks: '', type: 'leave' });

  useEffect(() => {
    if (profile?.employee_id) {
      loadData();
    }
  }, [profile, activeTab, selectedEmployee]);

  useEffect(() => {
    if (location.state?.tab) setActiveTab(location.state.tab);
    if (location.state?.highlightId) setHighlightId(location.state.highlightId);
  }, [location.state]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'MyLeaves') await fetchMyLeaves();
      else if (activeTab === 'TeamLeaves') await fetchAllRequests();
      else if (activeTab === 'MyPermissions') await fetchMyPermissions();
      else if (activeTab === 'TeamPermissions') await fetchAllPermissions();
      
      await fetchMyBalances();
      await fetchEmployees();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('employee_id, full_name, department');
    setAllEmployees(data || []);
  };

  const fetchMyLeaves = async () => {
    const { data } = await supabase.from('leave_requests').select('*').eq('employee_id', profile.employee_id).order('created_at', { ascending: false });
    setRequests(data || []);
  };

  const fetchMyBalances = async () => {
    const { data } = await supabase.from('leave_balances').select('*').eq('employee_id', profile.employee_id);
    setBalances(data || []);
  };

  const fetchAllRequests = async () => {
    let query = supabase.from('leave_requests').select('*, employees(full_name, department)').order('created_at', { ascending: false });
    if (selectedEmployee !== 'all') query = query.eq('employee_id', selectedEmployee);
    const { data } = await query;
    setRequests(data || []);
  };

  const fetchMyPermissions = async () => {
    const { data } = await supabase.from('permissions').select('*').eq('employee_id', profile.employee_id).order('created_at', { ascending: false });
    setPermissionRequests(data || []);
  };

  const fetchAllPermissions = async () => {
    let query = supabase.from('permissions').select('*, employees(full_name, department)').order('created_at', { ascending: false });
    if (selectedEmployee !== 'all') query = query.eq('employee_id', selectedEmployee);
    const { data } = await query;
    setPermissionRequests(data || []);
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('leave_requests').insert([{
        employee_id: profile.employee_id,
        leave_type: formData.leave_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason,
        status: 'pending'
      }]);
      toast.success('Leave application submitted!');
      setIsModalOpen(false);
      setFormData({ leave_type: 'Casual Leave', start_date: '', end_date: '', reason: '' });
      fetchMyLeaves();
    } catch (err) { toast.error('Failed to apply'); }
  };

  const handleProcessApproval = async (e) => {
    if (e) e.preventDefault();
    const type = selectedRequest?.leave_type ? 'leave' : 'permission';
    const id = selectedRequest?.id;

    if (approvalForm.action === 'reject' && !approvalForm.remarks.trim()) {
      return toast.error("Remarks required for rejection");
    }

    setIsSubmitting(true);
    try {
      const userRole = profile.role === 'md' ? 'md' : 'hr';
      const rpcName = type === 'leave' ? 'process_leave_approval' : 'process_permission_approval';
      const payload = type === 'leave' 
        ? { p_leave_id: id, p_approver_role: userRole, p_action: approvalForm.action, p_remarks: approvalForm.remarks }
        : { p_permission_id: id, p_action: approvalForm.action, p_remarks: approvalForm.remarks };

      const { error } = await supabase.rpc(rpcName, payload);
      if (error) throw error;

      const successMsg = approvalForm.action === 'approve' 
        ? "Leave approved! MD notified." 
        : "Leave rejected. Employee notified.";
      
      toast.success(successMsg);
      setSelectedRequest(null);
      loadData();
    } catch (e) { toast.error('Error: ' + e.message); }
    finally { setIsSubmitting(false); }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getTypeColor = (type) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('casual')) return 'bg-blue-500';
    if (t.includes('sick')) return 'bg-orange-500';
    if (t.includes('earned')) return 'bg-green-500';
    if (t.includes('loss') || t.includes('pay')) return 'bg-red-500';
    if (t.includes('emergency')) return 'bg-purple-500';
    if (t.includes('maternity')) return 'bg-pink-500';
    return 'bg-gray-500';
  };

  const StatusIcon = ({ status, active }) => {
    if (status === 'approved') return <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg"><CheckCircle size={24} fill="currentColor" stroke="none" /></div>;
    if (status === 'rejected') return <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"><XCircle size={24} fill="currentColor" stroke="none" /></div>;
    return <div className={`w-10 h-10 ${active ? 'bg-amber-500 text-white animate-pulse' : 'bg-gray-200 text-gray-400'} rounded-full flex items-center justify-center`}><Clock size={20} /></div>;
  };

  const renderDetailPopup = () => {
    if (!selectedRequest) return null;
    const req = selectedRequest;
    const type = req.leave_type ? 'leave' : 'permission';
    const isPending = req.hr_status === 'pending';
    const [showRemarksInput, setShowRemarksInput] = useState(false);
    
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[4px] p-4 animate-in fade-in duration-300">
        <div style={{ width: '580px' }} className="bg-white rounded-[20px] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-250">
          <div className="bg-[#1a2744] p-6 text-white relative">
            <button onClick={() => setSelectedRequest(null)} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"><XCircle size={24} /></button>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-600 border-2 border-white/20 flex items-center justify-center font-black text-lg">{getInitials(req.employees?.full_name)}</div>
                <div>
                  <h2 className="text-xl font-bold leading-tight">{req.employees?.full_name || '...'}</h2>
                  <p className="text-[13px] text-white/70">ID: {req.employee_id}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-4 py-1.5 rounded-full text-[12px] font-black uppercase tracking-wider shadow-lg ${getTypeColor(req.leave_type)}`}>{type === 'leave' ? req.leave_type : 'Permission Request'}</span>
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold font-bold">Applied on {format(new Date(req.created_at), 'dd MMM yyyy')}</p>
              </div>
            </div>
          </div>

          <div className="p-7 space-y-8">
            <div className="bg-[#EEF4FF] rounded-[14px] p-5">
              <div className="flex items-center justify-between mb-3 text-blue-800">
                <div className="flex items-center gap-3">
                   <CalendarIcon size={20} className="text-blue-500" />
                   <span className="font-bold text-sm">{type==='leave'?`${format(parseISO(req.start_date),'dd MMM yyyy')} → ${format(parseISO(req.end_date),'dd MMM yyyy')}` : format(parseISO(req.date),'dd MMM yyyy')}</span>
                </div>
                <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[11px] font-black uppercase shadow-md">
                   {type==='leave'?`${differenceInDays(new Date(req.end_date),new Date(req.start_date))+1} Day(s)` : `${req.duration_minutes} Min`}
                </div>
              </div>
              {type==='permission' && <p className="text-xs font-bold text-blue-600 mb-3">{req.start_time.substring(0,5)} - {req.end_time.substring(0,5)}</p>}
              <div className="pt-3 border-t border-blue-100/50 italic text-xs text-gray-500 font-medium">"{req.reason}"</div>
            </div>

            <div className="space-y-0 relative pl-10 border-l border-dashed border-gray-200 ml-[19px]">
              <div className="relative mb-8">
                <div className="absolute -left-[40px] top-0"><StatusIcon status={req.hr_status} active={req.hr_status === 'pending'} /></div>
                <div>
                  <h4 className="text-[15px] font-bold text-[#1a2744]">HR Review</h4>
                  <p className={`text-xs font-bold uppercase ${req.hr_status==='pending'?'text-amber-500':req.hr_status==='approved'?'text-green-600':'text-red-500'}`}>
                    {req.hr_status==='pending'?'Processing decision':req.hr_status==='approved'?`Approved on ${format(new Date(req.hr_approved_at||req.created_at),'dd MMM')}`:'Rejected'}
                  </p>
                  {req.hr_remarks && <div className="mt-2 bg-gray-100 p-3 rounded-xl text-xs text-gray-600">{req.hr_remarks}</div>}
                </div>
              </div>
              <div className="relative">
                <div className="absolute -left-[40px] top-0">{req.hr_status === 'pending' ? <div className="w-10 h-10 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center border border-gray-200"><AlertCircle size={20} /></div> : <StatusIcon status={req.md_status} active={req.hr_status === 'approved' && req.md_status === 'pending'} />}</div>
                <div>
                  <h4 className="text-[15px] font-bold text-[#1a2744]">MD Final Approval</h4>
                  <p className="text-xs font-bold text-gray-400 uppercase">
                    {req.hr_status==='pending'?'Waiting for HR':req.md_status==='pending'?'Awaiting MD':req.md_status==='approved'?`Finally Approved` : 'Rejected'}
                  </p>
                  {req.md_remarks && <div className="mt-2 bg-gray-100 p-3 rounded-xl text-xs text-gray-600">{req.md_remarks}</div>}
                </div>
              </div>
            </div>

            {isPending && profile.role === 'hr' && (
              <div className="pt-6 border-t border-gray-100 space-y-4">
                {!showRemarksInput ? (
                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={()=>{setApprovalForm({...approvalForm,action:'approve'});setShowRemarksInput(true)}} className="w-full h-[50px] bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-green-100 hover:scale-[1.02] transition-transform">Approve Request</button>
                    <button onClick={()=>{setApprovalForm({...approvalForm,action:'reject'});setShowRemarksInput(true)}} className="w-full h-[50px] bg-white border-2 border-red-500 text-red-500 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-red-50 transition-colors">Reject with Reason</button>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">{approvalForm.action==='approve'?'Remarks (Optional)':'Reason (Mandatory)'}</label>
                    <textarea autoFocus className={`w-full p-4 bg-gray-50 rounded-xl text-sm border-2 ${approvalForm.action==='reject' && !approvalForm.remarks.trim() ? 'border-red-200' : 'border-blue-50'}`} placeholder="Enter here..." value={approvalForm.remarks} onChange={e=>setApprovalForm({...approvalForm,remarks:e.target.value})} />
                    <div className="flex gap-3 mt-4">
                       <button onClick={()=>setShowRemarksInput(false)} className="flex-1 py-3 text-gray-400 font-bold uppercase text-[10px]">Back</button>
                       <button onClick={handleProcessApproval} disabled={isSubmitting} className={`flex-[2] py-4 rounded-xl font-black text-xs uppercase text-white ${approvalForm.action==='approve'?'bg-green-600':'bg-red-600'}`}>{isSubmitting ? '...' : `Confirm ${approvalForm.action}`}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLeavesTable = (data) => (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
          <tr><th className="p-4">Employee</th><th className="p-4">Type</th><th className="p-4">Dates</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">Action</th></tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {(data || []).map(req => {
            const isHighlighted = highlightId === req.id.toString();
            return (
              <tr key={req.id} onClick={() => setSelectedRequest(req)} className={`hover:bg-gray-50/80 cursor-pointer transition-all ${isHighlighted ? 'bg-blue-50 ring-2 ring-blue-100' : ''}`}>
                <td className="p-4">
                   <p className="font-black text-[#1a2744] text-sm mb-1 leading-none">{req.employees?.full_name || '...'}</p>
                   <p className="text-[10px] text-gray-400 font-bold uppercase">{req.employees?.department}</p>
                </td>
                <td className="p-4"><span className="font-bold text-blue-600">{req.leave_type}</span></td>
                <td className="p-4 font-bold text-gray-500">{format(parseISO(req.start_date), 'dd MMM')} - {format(parseISO(req.end_date), 'dd MMM')}</td>
                <td className="p-4 text-center">
                   <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${req.status==='pending' ? 'bg-orange-100 text-orange-600' : req.status==='hr_approved' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                     {req.status === 'hr_approved' ? 'HR OK | MD ⏳' : req.status}
                   </span>
                </td>
                <td className="p-4 text-right"><ChevronRight className="inline text-gray-300" size={16} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex justify-between items-end mb-10">
        <div><h1 className="text-5xl font-black text-[#1a2744] tracking-tight uppercase leading-none">Resource Control</h1><p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mt-2">Global Leave & Deployment Orchestration</p></div>
        {!isAdmin && <button onClick={() => setIsModalOpen(true)} className="px-6 py-3 bg-[#1a2744] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Deploy Request</button>}
      </div>

      <div className="flex border-b border-gray-100 mb-8 gap-6">
        {['MyLeaves', 'TeamLeaves', 'MyPermissions', 'TeamPermissions'].map(tab => (
           (tab.startsWith('Team') && !isAdmin) ? null : 
           <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 px-2 font-black text-[10px] uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-[#1a2744]' : 'text-gray-300 hover:text-gray-500'}`}>{tab.replace(/([A-Z])/g, ' $1').trim()}{activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1a2744] rounded-t-full"></div>}</button>
        ))}
      </div>

      {loading ? <div className="flex flex-col items-center justify-center p-20 text-gray-200"><Clock className="animate-spin mb-4" size={48} /><p className="font-bold uppercase tracking-widest text-[10px]">Accessing Stratum...</p></div> : (activeTab.includes('Leave') ? renderLeavesTable(requests) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden text-sm animate-in fade-in">
           <table className="w-full text-left">
              <tbody className="divide-y divide-gray-50">{(permissionRequests || []).map(p => (<tr key={p.id} onClick={()=>setSelectedRequest(p)} className="hover:bg-gray-50 cursor-pointer"><td className="p-4 font-black">{p.employees?.full_name}</td><td className="p-4 font-bold text-gray-400">{format(parseISO(p.date), 'dd MMM yyyy')}</td><td className="p-4 font-mono text-[11px]">{p.start_time.substring(0,5)} - {p.end_time.substring(0,5)}</td><td className="p-4 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${p.status==='pending' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{p.status}</span></td><td className="p-4 text-right"><ChevronRight size={16} className="text-gray-200 inline" /></td></tr>))}</tbody>
           </table>
        </div>
      ))}
      {renderDetailPopup()}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-black mb-6 uppercase text-[#1a2744]">Apply Leave</h2>
              <form onSubmit={handleApplyLeave} className="space-y-4">
                 <div><label className="text-[10px] font-black uppercase mb-1 block">Leave Type</label><select className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={formData.leave_type} onChange={e=>setFormData({...formData, leave_type: e.target.value})}><option>Casual Leave</option><option>Sick Leave</option><option>Earned Leave</option></select></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-black uppercase mb-1 block">Start Date</label><input type="date" required className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={formData.start_date} onChange={e=>setFormData({...formData, start_date: e.target.value})} /></div>
                    <div><label className="text-[10px] font-black uppercase mb-1 block">End Date</label><input type="date" required className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={formData.end_date} onChange={e=>setFormData({...formData, end_date: e.target.value})} /></div>
                 </div>
                 <div><label className="text-[10px] font-black uppercase mb-1 block">Reason</label><textarea required className="w-full p-3 bg-gray-50 border rounded-xl" rows="3" value={formData.reason} onChange={e=>setFormData({...formData, reason: e.target.value})} /></div>
                 <div className="flex gap-4 pt-4"><button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 font-bold text-gray-400">Cancel</button><button type="submit" className="flex-1 bg-[#1a2744] text-white py-3 rounded-xl font-black uppercase">Submit</button></div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
