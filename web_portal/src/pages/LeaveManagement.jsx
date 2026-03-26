import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, CheckCircle2, Clock3, FileText, XCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';

const HR_EMPLOYEE_ID = 'FSQ002';

const emptyLeaveForm = {
  leave_type: 'Casual Leave',
  start_date: '',
  end_date: '',
  reason: '',
};

const getStatusMeta = (request) => {
  const status = (request?.status || 'pending').toLowerCase();
  const currentLevel = Number(request?.current_approval_level || 1);
  const isDirectHrFlow = request?.level_1_approver_id === HR_EMPLOYEE_ID;

  if (status === 'approved') {
    return { label: 'Approved', className: 'bg-green-100 text-green-700' };
  }

  if (status === 'rejected') {
    return { label: 'Rejected', className: 'bg-red-100 text-red-700' };
  }

  if (currentLevel >= 2 && !isDirectHrFlow) {
    return {
      label: 'Manager Approved | HR Pending',
      className: 'bg-blue-100 text-blue-700',
    };
  }

  return {
    label: isDirectHrFlow ? 'Waiting for HR' : 'Waiting for Manager',
    className: 'bg-amber-100 text-amber-700',
  };
};

const canHrProcessRequest = (request) => {
  const status = (request?.status || 'pending').toLowerCase();
  if (status !== 'pending') return false;

  const currentLevel = Number(request?.current_approval_level || 1);
  return currentLevel === 2 || request?.level_1_approver_id === HR_EMPLOYEE_ID;
};

const approvalSummary = (request) => {
  if ((request?.status || '').toLowerCase() === 'approved') {
    return 'Final approval completed';
  }

  if ((request?.status || '').toLowerCase() === 'rejected') {
    return 'Request was rejected';
  }

  if (Number(request?.current_approval_level || 1) >= 2 && request?.level_1_approver_id !== HR_EMPLOYEE_ID) {
    return 'Manager approved. Waiting for HR final approval';
  }

  return request?.level_1_approver_id === HR_EMPLOYEE_ID
    ? 'Waiting for HR approval'
    : 'Waiting for manager approval';
};

export default function LeaveManagement() {
  const location = useLocation();
  const { profile } = useAuth();

  const canFinalApprove = profile?.role === 'hr';
  const tabs = useMemo(
    () => (canFinalApprove ? ['MyLeaves', 'TeamLeaves', 'MyPermissions', 'TeamPermissions'] : ['MyLeaves', 'MyPermissions']),
    [canFinalApprove]
  );

  const [activeTab, setActiveTab] = useState(location.state?.tab || tabs[0]);
  const [highlightId, setHighlightId] = useState(location.state?.highlightId || null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedType, setSelectedType] = useState('leave');
  const [approvalAction, setApprovalAction] = useState('approve');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyLeaveForm);

  useEffect(() => {
    if (tabs.length && !tabs.includes(activeTab)) {
      setActiveTab(tabs[0]);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (location.state?.tab) setActiveTab(location.state.tab);
    if (location.state?.highlightId) setHighlightId(location.state.highlightId);
  }, [location.state]);

  useEffect(() => {
    if (profile?.employee_id) {
      loadData();
    }
  }, [profile?.employee_id, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        activeTab === 'MyLeaves' ? fetchMyLeaves() : Promise.resolve(),
        activeTab === 'TeamLeaves' ? fetchTeamLeaves() : Promise.resolve(),
        activeTab === 'MyPermissions' ? fetchMyPermissions() : Promise.resolve(),
        activeTab === 'TeamPermissions' ? fetchTeamPermissions() : Promise.resolve(),
        fetchMyBalances(),
      ]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyLeaves = async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', profile.employee_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setRequests(data || []);
  };

  const fetchTeamLeaves = async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, employees(full_name, department, work_location)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setRequests((data || []).filter(canHrProcessRequest));
  };

  const fetchMyPermissions = async () => {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('employee_id', profile.employee_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setPermissionRequests(data || []);
  };

  const fetchTeamPermissions = async () => {
    const { data, error } = await supabase
      .from('permissions')
      .select('*, employees(full_name, department, work_location)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setPermissionRequests((data || []).filter(canHrProcessRequest));
  };

  const fetchMyBalances = async () => {
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', profile.employee_id);

    if (error) throw error;
    setBalances(data || []);
  };

  const sendNotification = async ({
    recipientId,
    type,
    title,
    message,
    referenceType,
    referenceId,
  }) => {
    const { error } = await supabase.from('notifications').insert({
      recipient_employee_id: recipientId,
      sender_employee_id: profile.employee_id,
      type,
      title,
      message,
      reference_type: referenceType,
      reference_id: String(referenceId),
      is_read: false,
    });

    if (error) throw error;
  };

  const resolveRouting = async () => {
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('department, work_location')
      .eq('employee_id', profile.employee_id)
      .single();

    if (employeeError) throw employeeError;

    const { data: routing, error: routingError } = await supabase
      .from('approval_routing')
      .select('level_1_approver_id, level_2_approver_id')
      .eq('department', employee.department)
      .eq('work_location', employee.work_location)
      .single();

    if (routingError) throw routingError;
    return routing;
  };

  const handleApplyLeave = async (event) => {
    event.preventDefault();

    try {
      const routing = await resolveRouting();
      const { data: inserted, error } = await supabase
        .from('leave_requests')
        .insert({
          employee_id: profile.employee_id,
          leave_type: formData.leave_type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          reason: formData.reason,
          status: 'pending',
          hr_status: 'pending',
          current_approval_level: 1,
          level_1_approver_id: routing.level_1_approver_id,
        })
        .select()
        .single();

      if (error) throw error;

      await sendNotification({
        recipientId: routing.level_1_approver_id,
        type: 'leave_request',
        title: routing.level_1_approver_id === HR_EMPLOYEE_ID ? 'New Leave Request for HR Approval' : 'New Leave Request for Manager Approval',
        message: `${profile.employee_id} submitted a leave request from ${formData.start_date} to ${formData.end_date}.`,
        referenceType: 'leave_request',
        referenceId: inserted.id,
      });

      toast.success('Leave request submitted');
      setFormData(emptyLeaveForm);
      setIsModalOpen(false);
      fetchMyLeaves();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to apply leave');
    }
  };

  const openRequest = (request, type) => {
    setSelectedRequest(request);
    setSelectedType(type);
    setApprovalAction('approve');
    setApprovalRemarks('');
  };

  const handleProcessApproval = async () => {
    if (!selectedRequest) return;
    if (approvalAction === 'reject' && !approvalRemarks.trim()) {
      toast.error('Remarks are required for rejection');
      return;
    }

    const tableName = selectedType === 'leave' ? 'leave_requests' : 'permissions';
    const referenceType = selectedType === 'leave' ? 'leave_request' : 'permission_request';
    const now = new Date().toISOString();
    const updates =
      approvalAction === 'approve'
        ? {
            status: 'approved',
            hr_status: 'approved',
            current_approval_level: Number(selectedRequest.current_approval_level || 1) === 1 ? 2 : selectedRequest.current_approval_level,
            level_1_approved_at: selectedRequest.level_1_approved_at || now,
            level_1_remarks: selectedRequest.level_1_approved_at ? selectedRequest.level_1_remarks : approvalRemarks.trim() || null,
            final_approver_id: profile.employee_id,
            final_approved_at: now,
          }
        : {
            status: 'rejected',
            hr_status: 'rejected',
            level_1_remarks: approvalRemarks.trim(),
            final_approver_id: profile.employee_id,
          };

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from(tableName).update(updates).eq('id', selectedRequest.id);
      if (error) throw error;

      await sendNotification({
        recipientId: selectedRequest.employee_id,
        type: referenceType,
        title:
          approvalAction === 'approve'
            ? `${selectedType === 'leave' ? 'Leave' : 'Permission'} Approved`
            : `${selectedType === 'leave' ? 'Leave' : 'Permission'} Rejected`,
        message:
          approvalAction === 'approve'
            ? `Your ${selectedType} request has been approved by HR.`
            : `Your ${selectedType} request was rejected by HR.${approvalRemarks.trim() ? ` Remarks: ${approvalRemarks.trim()}` : ''}`,
        referenceType,
        referenceId: selectedRequest.id,
      });

      toast.success(
        approvalAction === 'approve'
          ? `${selectedType === 'leave' ? 'Leave' : 'Permission'} approved`
          : `${selectedType === 'leave' ? 'Leave' : 'Permission'} rejected`
      );

      setSelectedRequest(null);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Unable to process request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBalanceCards = () => {
    if (!balances.length || !activeTab.startsWith('My')) return null;

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {balances.map((balance) => (
          <div key={balance.id || balance.leave_type} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">{balance.leave_type || 'Leave Balance'}</p>
            <p className="mt-3 text-3xl font-black text-[#1a2744]">{balance.balance_days ?? balance.remaining_days ?? 0}</p>
            <p className="text-sm text-gray-500">days available</p>
          </div>
        ))}
      </div>
    );
  };

  const renderRequestsTable = (data, type) => (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
          <tr>
            <th className="p-4">Employee</th>
            <th className="p-4">{type === 'leave' ? 'Request' : 'Time'}</th>
            <th className="p-4">Date</th>
            <th className="p-4">Status</th>
            <th className="p-4 text-right">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((request) => {
            const meta = getStatusMeta(request);
            const isHighlighted = highlightId === String(request.id);
            const employeeName = request.employees?.full_name || request.employee_id;
            const subtitle = request.employees?.department || 'Employee';

            return (
              <tr
                key={`${type}-${request.id}`}
                onClick={() => openRequest(request, type)}
                className={`cursor-pointer transition hover:bg-gray-50 ${isHighlighted ? 'bg-blue-50' : ''}`}
              >
                <td className="p-4">
                  <p className="font-bold text-[#1a2744]">{employeeName}</p>
                  <p className="text-xs uppercase tracking-wide text-gray-400">{subtitle}</p>
                </td>
                <td className="p-4 font-medium text-gray-700">
                  {type === 'leave'
                    ? request.leave_type
                    : `${String(request.start_time || '--').slice(0, 5)} - ${String(request.end_time || '--').slice(0, 5)}`}
                </td>
                <td className="p-4 font-medium text-gray-500">
                  {type === 'leave'
                    ? `${format(parseISO(request.start_date), 'dd MMM yyyy')} - ${format(parseISO(request.end_date), 'dd MMM yyyy')}`
                    : format(parseISO(request.date), 'dd MMM yyyy')}
                </td>
                <td className="p-4">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase ${meta.className}`}>{meta.label}</span>
                </td>
                <td className="p-4 text-right text-xs font-bold uppercase tracking-wide text-gray-400">View</td>
              </tr>
            );
          })}
          {!data.length && (
            <tr>
              <td colSpan="5" className="p-10 text-center text-sm text-gray-400">
                No requests found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-[#1a2744]">Leave Management</h1>
          <p className="mt-2 text-sm text-gray-500">
            {canFinalApprove ? 'HR final approval queue and employee leave history.' : 'Track your leave and permission requests.'}
          </p>
        </div>
        {!canFinalApprove && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#1a2744] px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg"
          >
            <CalendarDays size={16} />
            Apply Leave
          </button>
        )}
      </div>

      {renderBalanceCards()}

      <div className="flex flex-wrap gap-6 border-b border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-xs font-black uppercase tracking-[0.2em] ${
              activeTab === tab ? 'border-b-2 border-[#1a2744] text-[#1a2744]' : 'text-gray-400'
            }`}
          >
            {tab.replace(/([A-Z])/g, ' $1').trim()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl bg-white p-16 text-gray-400 shadow-sm">
          <Clock3 className="mr-3 animate-spin" size={22} />
          Loading requests...
        </div>
      ) : activeTab === 'MyLeaves' || activeTab === 'TeamLeaves' ? (
        renderRequestsTable(requests, 'leave')
      ) : (
        renderRequestsTable(permissionRequests, 'permission')
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                  {selectedType === 'leave' ? 'Leave Request' : 'Permission Request'}
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#1a2744]">
                  {selectedRequest.employees?.full_name || selectedRequest.employee_id}
                </h2>
                <p className="mt-2 text-sm text-gray-500">{approvalSummary(selectedRequest)}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100">
                <XCircle size={22} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 rounded-2xl bg-gray-50 p-5 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 text-[#1a2744]" size={18} />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Reason</p>
                  <p className="mt-1 text-sm text-gray-700">{selectedRequest.reason || 'No reason provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 text-[#1a2744]" size={18} />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Request Window</p>
                  <p className="mt-1 text-sm text-gray-700">
                    {selectedType === 'leave'
                      ? `${format(parseISO(selectedRequest.start_date), 'dd MMM yyyy')} - ${format(parseISO(selectedRequest.end_date), 'dd MMM yyyy')}`
                      : `${format(parseISO(selectedRequest.date), 'dd MMM yyyy')} | ${String(selectedRequest.start_time || '--').slice(0, 5)} - ${String(selectedRequest.end_time || '--').slice(0, 5)}`}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Level 1 Approver</p>
                <p className="mt-1 text-sm text-gray-700">{selectedRequest.level_1_approver_id || 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Current Status</p>
                <div className="mt-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase ${getStatusMeta(selectedRequest).className}`}>
                    {getStatusMeta(selectedRequest).label}
                  </span>
                </div>
              </div>
            </div>

            {selectedRequest.level_1_remarks && (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Previous Remarks</p>
                <p className="mt-2 text-sm text-gray-600">{selectedRequest.level_1_remarks}</p>
              </div>
            )}

            {canFinalApprove && canHrProcessRequest(selectedRequest) && (
              <div className="mt-6 space-y-4 border-t border-gray-100 pt-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => setApprovalAction('approve')}
                    className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.2em] ${
                      approvalAction === 'approve' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700'
                    }`}
                  >
                    <CheckCircle2 className="mr-2 inline" size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => setApprovalAction('reject')}
                    className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.2em] ${
                      approvalAction === 'reject' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    <XCircle className="mr-2 inline" size={16} />
                    Reject
                  </button>
                </div>
                <textarea
                  value={approvalRemarks}
                  onChange={(event) => setApprovalRemarks(event.target.value)}
                  placeholder={approvalAction === 'reject' ? 'Rejection remarks are required' : 'Remarks (optional)'}
                  className="min-h-[120px] w-full rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:border-[#1a2744]"
                />
                <button
                  onClick={handleProcessApproval}
                  disabled={isSubmitting}
                  className={`w-full rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white ${
                    approvalAction === 'approve' ? 'bg-[#1a2744]' : 'bg-red-600'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isSubmitting ? 'Processing...' : `Confirm ${approvalAction}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-[#1a2744]">Apply Leave</h2>
            <form onSubmit={handleApplyLeave} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-gray-400">Leave Type</label>
                <select
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
                  value={formData.leave_type}
                  onChange={(event) => setFormData((current) => ({ ...current, leave_type: event.target.value }))}
                >
                  <option>Casual Leave</option>
                  <option>Sick Leave</option>
                  <option>Earned Leave</option>
                  <option>Emergency Leave</option>
                  <option>Loss of Pay</option>
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-gray-400">Start Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
                    value={formData.start_date}
                    onChange={(event) => setFormData((current) => ({ ...current, start_date: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-gray-400">End Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
                    value={formData.end_date}
                    onChange={(event) => setFormData((current) => ({ ...current, end_date: event.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-gray-400">Reason</label>
                <textarea
                  required
                  rows="4"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm"
                  value={formData.reason}
                  onChange={(event) => setFormData((current) => ({ ...current, reason: event.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-500">
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-2xl bg-[#1a2744] px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white">
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
