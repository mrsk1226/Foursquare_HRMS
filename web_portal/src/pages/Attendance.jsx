import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isWeekend, parseISO, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { CalendarIcon, ChevronLeft, ChevronRight, Edit, Clock, CheckCircle, XCircle, Users, Activity, FileText, AlertCircle } from 'lucide-react';

export default function Attendance() {
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = ['admin', 'hr', 'md'].includes(profile?.role);
  
  const [mainTab, setMainTab] = useState(location.state?.tab || 'attendance'); 
  const [highlightId, setHighlightId] = useState(location.state?.highlightId || null);
  
  // -- STATE --
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [logs, setLogs] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [loading, setLoading] = useState(true);
  
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [sundayRequests, setSundayRequests] = useState([]);
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  
  const [manualForm, setManualForm] = useState({ id: null, employee_id: '', date: format(new Date(), 'yyyy-MM-dd'), check_in: '', check_out: '', status: 'present' });
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'Casual Leave', start_date: '', end_date: '', reason: '' });
  const [approvalForm, setApprovalForm] = useState({ id: null, action: 'approve', remarks: '', type: 'leave' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.employee_id) {
      loadInitialData();
    }
  }, [profile, mainTab, selectedEmployee]);

  useEffect(() => {
     if (location.state?.tab) setMainTab(location.state.tab);
     if (location.state?.highlightId) setHighlightId(location.state.highlightId);
  }, [location.state]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      if (mainTab === 'attendance') await fetchAttendance();
      else if (mainTab === 'leaves') { await fetchLeaves(); await fetchMyBalances(); }
      else if (mainTab === 'permissions') await fetchPermissions();
      else if (mainTab === 'sunday') await fetchSundayRequests();
      await fetchEmployees();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('employee_id, full_name, department');
    setAllEmployees(data || []);
  };

  const fetchAttendance = async () => {
    try {
      const firstDay = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const lastDay = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      let query = supabase.from('attendance_logs').select('*, employees(full_name, department)').gte('date', firstDay).lte('date', lastDay);
      if (!isAdmin) query = query.eq('employee_id', profile.employee_id);
      else if (selectedEmployee !== 'all') query = query.eq('employee_id', selectedEmployee);
      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      setLogs(data || []);
    } catch (e) { toast.error('Error fetching attendance'); }
  };

  const fetchLeaves = async () => {
    try {
      let query = supabase.from('leave_requests').select('*, employees(full_name, department)').order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('employee_id', profile.employee_id);
      const { data, error } = await query;
      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (e) { toast.error('Error fetching leaves'); }
  };

  const fetchPermissions = async () => {
    try {
      let query = supabase.from('permissions').select('*, employees(full_name, department)').order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('employee_id', profile.employee_id);
      const { data, error } = await query;
      if (error) throw error;
      setPermissionRequests(data || []);
    } catch (e) { toast.error('Error fetching permissions'); }
  };

  const fetchSundayRequests = async () => {
    try {
      const { data, error } = await supabase.from('sunday_punch_requests').select('*, employees(full_name, department)').order('created_at', { ascending: false });
      if (error) throw error;
      setSundayRequests(data || []);
    } catch (e) { toast.error('Error fetching Sunday requests'); }
  };

  const fetchMyBalances = async () => {
    try {
      const { data } = await supabase.from('leave_balances').select('*').eq('employee_id', profile.employee_id);
      if (data && data.length > 0) setLeaveBalances(data);
    } catch (e) {}
  };

  const handleProcessApproval = async (e) => {
    if (e) e.preventDefault();
    const type = selectedRequest?.leave_type ? 'leave' : 'permission';
    const id = selectedRequest?.id;
    if (approvalForm.action === 'reject' && !approvalForm.remarks.trim()) return toast.error("Remarks required for rejection");
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
        ? "Leave approved! MD has been notified for final approval." 
        : "Leave rejected. Employee has been notified.";
      
      toast.success(successMsg, { position: 'bottom-right', duration: 3000 });
      setSelectedRequest(null);
      type === 'leave' ? fetchLeaves() : fetchPermissions();
    } catch (e) { toast.error('Error: ' + e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleManualSave = async (e) => {
    e.preventDefault();
    try {
      let ci = manualForm.check_in ? new Date(`${manualForm.date}T${manualForm.check_in}`).toISOString() : null;
      let co = manualForm.check_out ? new Date(`${manualForm.date}T${manualForm.check_out}`).toISOString() : null;
      const payload = { employee_id: manualForm.employee_id || selectedEmployee, date: manualForm.date, check_in: ci, check_out: co, status: manualForm.status };
      if (manualForm.id) await supabase.from('attendance_logs').update(payload).eq('id', manualForm.id);
      else await supabase.from('attendance_logs').insert([payload]);
      toast.success("Saved!"); setIsManualModalOpen(false); fetchAttendance();
    } catch (e) { toast.error("Error saving"); }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('leave_requests').insert([{ employee_id: profile.employee_id, leave_type: leaveForm.leave_type, start_date: leaveForm.start_date, end_date: leaveForm.end_date, reason: leaveForm.reason, status: 'pending' }]);
      toast.success('Leave applied'); setIsLeaveModalOpen(false); fetchLeaves();
    } catch (e) { toast.error('Error applying'); }
  };

  const handleSundayApprove = async (req) => {
    try {
      await supabase.from('attendance_logs').insert([{ employee_id: req.employee_id, date: req.date, check_in: req.check_in, status: 'present' }]);
      await supabase.from('sunday_punch_requests').update({ status: 'approved' }).eq('id', req.id);
      toast.success('Approved'); fetchSundayRequests();
    } catch (e) { toast.error('Failed'); }
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
    if (status === 'approved') return <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-200"><CheckCircle size={24} fill="currentColor" stroke="none" /></div>;
    if (status === 'rejected') return <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-200"><XCircle size={24} fill="currentColor" stroke="none" /></div>;
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
        <div style={{ width: '580px' }} className="bg-white rounded-[20px] shadow-[0_25px_60px_rgba(0,0,0,0.18)] overflow-hidden max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-250 ease-out">
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
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Applied on {format(new Date(req.created_at), 'dd MMM yyyy')}</p>
              </div>
            </div>
          </div>

          <div className="p-7 space-y-8">
            <div className="bg-[#EEF4FF] rounded-[14px] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 text-blue-800">
                   <CalendarIcon size={20} className="text-blue-500" />
                   <span className="font-bold text-sm">{type==='leave'?`${format(parseISO(req.start_date),'dd MMM yyyy')} → ${format(parseISO(req.end_date),'dd MMM yyyy')}` : format(parseISO(req.date),'dd MMM yyyy')}</span>
                </div>
                <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[11px] font-black uppercase shadow-md shadow-blue-200">
                   {type==='leave'?`${differenceInDays(new Date(req.end_date),new Date(req.start_date))+1} Day(s)` : `${req.duration_minutes} Min`}
                </div>
              </div>
              <div className="pt-3 border-t border-blue-100/50 italic text-xs text-gray-500 font-medium leading-relaxed italic">"{req.reason}"</div>
            </div>

            <div className="space-y-0 relative pl-10">
              <div className={`absolute left-[19px] top-6 bottom-6 w-0.5 ${req.hr_status === 'approved' ? 'bg-green-500' : 'bg-gray-100 border-l border-dashed border-gray-300'}`}></div>
              <div className="relative mb-8">
                <div className="absolute -left-10 top-0"><StatusIcon status={req.hr_status} active={req.hr_status === 'pending'} /></div>
                <div>
                  <h4 className="text-[15px] font-bold text-[#1a2744]">HR Review</h4>
                  <p className={`text-xs font-bold uppercase tracking-tight ${req.hr_status==='pending'?'text-amber-500':req.hr_status==='approved'?'text-green-600':'text-red-500'}`}>
                    {req.hr_status==='pending'?'Processing decision':req.hr_status==='approved'?`Approved on ${format(new Date(req.hr_approved_at||req.created_at),'dd MMM')}`:'Rejected'}
                  </p>
                  {req.hr_remarks && <div className="mt-2 bg-gray-100 p-3 rounded-xl border border-gray-200 text-xs text-gray-600 font-medium">{req.hr_remarks}</div>}
                </div>
              </div>
              <div className="relative">
                <div className="absolute -left-10 top-0">{req.hr_status === 'pending' ? <div className="w-10 h-10 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center border border-gray-200"><AlertCircle size={20} /></div> : <StatusIcon status={req.md_status} active={req.hr_status === 'approved' && req.md_status === 'pending'} />}</div>
                <div>
                  <h4 className="text-[15px] font-bold text-[#1a2744]">MD Final Approval</h4>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
                    {req.hr_status==='pending'?'Waiting for HR approval first':req.md_status==='pending'?'Awaiting MD decision':req.md_status==='approved'?`Finally Approved on ${format(new Date(req.md_approved_at||req.created_at),'dd MMM')}`:'Rejected'}
                  </p>
                  {req.md_remarks && <div className="mt-2 bg-gray-100 p-3 rounded-xl border border-gray-200 text-xs text-gray-600 font-medium">{req.md_remarks}</div>}
                </div>
              </div>
            </div>

            {isPending && profile.role === 'hr' && (
              <div className="pt-6 border-t border-gray-100 space-y-4">
                {!showRemarksInput ? (
                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={()=>{setApprovalForm({...approvalForm,action:'approve'});setShowRemarksInput(true)}} className="w-full h-[50px] bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white rounded-xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-green-200 hover:scale-[1.02] transition-transform">Approve Request</button>
                    <button onClick={()=>{setApprovalForm({...approvalForm,action:'reject'});setShowRemarksInput(true)}} className="w-full h-[50px] bg-white border-2 border-red-500 text-red-500 rounded-xl font-black text-sm uppercase tracking-[0.2em] hover:bg-red-50 transition-colors">Reject with Reason</button>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">{approvalForm.action==='approve'?'Approval Remarks (Optional)':'Reason for Rejection (Mandatory)'}</label>
                    <textarea autoFocus className={`w-full p-4 bg-gray-50 rounded-xl text-sm font-medium border-2 focus:outline-none transition-colors ${approvalForm.action==='reject' && !approvalForm.remarks.trim() ? 'border-red-100 focus:border-red-500' : 'border-blue-50 focus:border-blue-500'}`} placeholder={approvalForm.action==='approve'?"Good to go / Enjoy your leave...":"Specify reason for rejection..."} value={approvalForm.remarks} onChange={e=>setApprovalForm({...approvalForm,remarks:e.target.value})} />
                    <div className="flex gap-3 mt-4">
                       <button onClick={()=>setShowRemarksInput(false)} className="flex-1 py-3 text-gray-400 font-bold text-xs uppercase tracking-widest">Back</button>
                       <button onClick={handleProcessApproval} disabled={isSubmitting} className={`flex-[2] py-4 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-xl ${approvalForm.action==='approve'?'bg-green-600 shadow-green-200':'bg-red-600 shadow-red-200'}`}>{isSubmitting ? <Clock className="animate-spin inline"/> : `Confirm ${approvalForm.action}`}</button>
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

  const renderAttendanceTab = () => (
    <div className="animate-in fade-in">
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-8">
        <div className="flex justify-between items-center mb-6">
           <h2 className="text-xl font-bold">Attendance Calendar</h2>
           <div className="flex space-x-2">
              <button onClick={()=>setCurrentMonth(subMonths(currentMonth,1))} className="p-2 border rounded hover:bg-gray-50"><ChevronLeft size={16}/></button>
              <span className="py-2 px-4 border rounded font-bold">{format(currentMonth,'MMMM yyyy')}</span>
              <button onClick={()=>setCurrentMonth(addMonths(currentMonth,1))} className="p-2 border rounded hover:bg-gray-50"><ChevronRight size={16}/></button>
           </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
           {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="text-center font-bold text-gray-400 text-[10px] uppercase py-2">{d}</div>)}
           {eachDayOfInterval({start:startOfMonth(currentMonth),end:endOfMonth(currentMonth)}).map(d=>{
              const dateStr = format(d,'yyyy-MM-dd');
              const log = (logs||[]).find(l=>l.date===dateStr);
              return (
                 <div key={d} className={`aspect-square flex flex-col items-center justify-center rounded-lg ${log?.status==='present'?'bg-green-50 text-green-700':isSameDay(d,new Date())?'ring-2 ring-[#1a2744]':''}`}>
                    <span className="text-sm font-bold">{format(d,'d')}</span>
                 </div>
              );
           })}
        </div>
      </div>
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
         <div className="p-4 bg-gray-50 font-black uppercase text-[10px] tracking-[0.2em] flex justify-between items-center">
            Log Summary {isAdmin && <button onClick={()=>setIsManualModalOpen(true)} className="bg-[#1a2744] text-white px-3 py-1 rounded-md">Manual Entry</button>}
         </div>
         <table className="w-full text-left text-sm"><tbody className="divide-y divide-gray-50">{(logs||[]).map(l=>(<tr key={l.id} className="hover:bg-gray-50"><td className="p-4 font-bold">{format(parseISO(l.date),'dd MMM yyyy')}</td>{isAdmin && <td className="p-4">{l.employees?.full_name}</td>}<td className="p-4">{l.check_in?format(parseISO(l.check_in),'HH:mm'):'-'}</td><td className="p-4 text-right"><span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${l.status==='present'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{l.status}</span></td></tr>))}</tbody></table>
      </div>
    </div>
  );

  const renderLeaveTab = () => (
    <div className="animate-in fade-in">
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
         <div className="p-4 bg-gray-50 font-black uppercase text-[10px] tracking-[0.2em] flex justify-between items-center">
            Leaves {isAdmin && '(All)'} {!isAdmin && <button onClick={()=>setIsLeaveModalOpen(true)} className="bg-[#1a2744] text-white px-3 py-1 rounded-md">New Request</button>}
         </div>
         <table className="w-full text-left text-sm"><tbody className="divide-y divide-gray-50">{(leaveRequests||[]).map(r=>(<tr key={r.id} onClick={()=>setSelectedRequest(r)} className="hover:bg-gray-50 cursor-pointer"><td className="p-4 font-bold text-[#1a2744]">{r.employees?.full_name || '...'}</td><td className="p-4 font-bold text-blue-600">{r.leave_type}</td><td className="p-4 text-gray-400 font-bold">{format(parseISO(r.start_date),'dd MMM')} - {format(parseISO(r.end_date),'dd MMM')}</td><td className="p-4 text-right"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${r.status==='pending'?'bg-orange-100 text-orange-600':r.status==='hr_approved'?'bg-blue-100 text-blue-600':'bg-green-100 text-green-600'}`}>{r.status==='hr_approved'?'HR OK | MD ⏳':r.status}</span></td></tr>))}</tbody></table>
      </div>
    </div>
  );

  const renderPermissionTab = () => (
    <div className="animate-in fade-in">
       <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
          <div className="p-4 bg-gray-50 font-black uppercase text-[10px] tracking-[0.2em]">Permissions</div>
          <table className="w-full text-left text-sm"><tbody className="divide-y divide-gray-50">{(permissionRequests||[]).map(p=>(<tr key={p.id} onClick={()=>setSelectedRequest(p)} className="hover:bg-gray-50 cursor-pointer"><td className="p-4 font-bold">{p.employees?.full_name}</td><td className="p-4 text-gray-400">{format(parseISO(p.date),'dd MMM yyyy')}</td><td className="p-4 text-right"><span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${p.status==='pending'?'bg-orange-100 text-orange-600':'bg-green-100 text-green-600'}`}>{p.status}</span></td></tr>))}</tbody></table>
       </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="mb-10 flex justify-between items-end">
        <div><h1 className="text-4xl font-black text-[#1a2744] tracking-tight uppercase leading-none">Fleet Manager</h1><p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-1">Resource & Attendance Stratum</p></div>
      </div>
      <div className="flex gap-2 mb-10 overflow-x-auto pb-2">
        <TabButton active={mainTab==='attendance'} onClick={()=>setMainTab('attendance')} icon={<Activity size={14}/>} label="Attendance" />
        <TabButton active={mainTab==='leaves'} onClick={()=>setMainTab('leaves')} icon={<FileText size={14}/>} label="Leaves" />
        {isAdmin && <TabButton active={mainTab==='permissions'} onClick={()=>setMainTab('permissions')} icon={<Clock size={14}/>} label="Permissions" />}
        {isAdmin && <TabButton active={mainTab==='sunday'} onClick={()=>setMainTab('sunday')} icon={<Users size={14}/>} label="Sundays" />}
      </div>
      {loading ? <div className="p-20 text-center"><Clock className="animate-spin inline text-gray-200" size={40}/><p className="text-[10px] font-black mt-4 text-gray-300">Syncing...</p></div> : <>{mainTab==='attendance'&&renderAttendanceTab()}{mainTab==='leaves'&&renderLeaveTab()}{mainTab==='permissions'&&renderPermissionTab()}{mainTab==='sunday'&&fetchSundayRequests()}</>}
      {renderDetailPopup()}
    </div>
  );
}

const TabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${active ? 'bg-[#1a2744] text-white shadow-xl' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50/50'}`}>{icon}<span>{label}</span></button>
);
