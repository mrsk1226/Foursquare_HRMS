import React, { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

const HR_EMPLOYEE_ID = 'FSQ002';

export default function ManagerApprovals() {
  const location = useLocation();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('leaves');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedType, setSelectedType] = useState('leave');
  const [remarks, setRemarks] = useState('');
  const [action, setAction] = useState('approve');
  const [submitting, setSubmitting] = useState(false);
  const [highlightId, setHighlightId] = useState(location.state?.highlightId || null);

  useEffect(() => {
    if (profile?.employee_id) {
      loadRequests();
    }
  }, [loadRequests, profile?.employee_id]);

  useEffect(() => {
    if (location.state?.highlightId) {
      setHighlightId(String(location.state.highlightId));
    }
  }, [location.state]);

  useEffect(() => {
    if (!highlightId) return;

    const row = document.querySelector(`[data-approval-row="${activeTab}-${highlightId}"]`);
    if (!row) return;

    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeoutId = window.setTimeout(() => setHighlightId(null), 4200);

    return () => window.clearTimeout(timeoutId);
  }, [activeTab, highlightId, leaveRequests, permissionRequests]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [leaveResponse, permissionResponse] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('*, employees(full_name, department, work_location)')
          .eq('status', 'pending')
          .eq('current_approval_level', 1)
          .eq('level_1_approver_id', profile.employee_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('permissions')
          .select('*, employees(full_name, department, work_location)')
          .eq('status', 'pending')
          .eq('current_approval_level', 1)
          .eq('level_1_approver_id', profile.employee_id)
          .order('created_at', { ascending: false }),
      ]);

      if (leaveResponse.error) throw leaveResponse.error;
      if (permissionResponse.error) throw permissionResponse.error;

      setLeaveRequests(leaveResponse.data || []);
      setPermissionRequests(permissionResponse.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load manager approvals');
    } finally {
      setLoading(false);
    }
  }, [profile?.employee_id]);

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

  const openRequest = (request, type) => {
    setSelectedRequest(request);
    setSelectedType(type);
    setRemarks('');
    setAction('approve');
  };

  const processRequest = async () => {
    if (!selectedRequest) return;
    if (action === 'reject' && !remarks.trim()) {
      toast.error('Remarks are required for rejection');
      return;
    }

    const tableName = selectedType === 'leave' ? 'leave_requests' : 'permissions';
    const referenceType = selectedType === 'leave' ? 'leave_request' : 'permission_request';
    const now = new Date().toISOString();
    const updates =
      action === 'approve'
        ? {
            status: 'pending',
            hr_status: 'approved',
            current_approval_level: 2,
            level_1_approved_at: now,
            level_1_remarks: remarks.trim() || null,
          }
        : {
            status: 'rejected',
            hr_status: 'rejected',
            level_1_remarks: remarks.trim(),
          };

    setSubmitting(true);
    try {
      const { error } = await supabase.from(tableName).update(updates).eq('id', selectedRequest.id);
      if (error) throw error;

      if (action === 'approve') {
        await sendNotification({
          recipientId: HR_EMPLOYEE_ID,
          type: referenceType,
          title: `${selectedType === 'leave' ? 'Leave' : 'Permission'} Ready for HR Approval`,
          message: `${selectedRequest.employees?.full_name || selectedRequest.employee_id} has a ${selectedType} request waiting for final approval.`,
          referenceType,
          referenceId: selectedRequest.id,
        });
      } else {
        await sendNotification({
          recipientId: selectedRequest.employee_id,
          type: referenceType,
          title: `${selectedType === 'leave' ? 'Leave' : 'Permission'} Rejected`,
          message: `Your ${selectedType} request was rejected by your manager.${remarks.trim() ? ` Remarks: ${remarks.trim()}` : ''}`,
          referenceType,
          referenceId: selectedRequest.id,
        });
      }

      toast.success(
        action === 'approve'
          ? `${selectedType === 'leave' ? 'Leave' : 'Permission'} moved to HR`
          : `${selectedType === 'leave' ? 'Leave' : 'Permission'} rejected`
      );

      setSelectedRequest(null);
      await loadRequests();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Unable to process request');
    } finally {
      setSubmitting(false);
    }
  };

  const currentData = activeTab === 'leaves' ? leaveRequests : permissionRequests;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="text-4xl font-black uppercase tracking-tight text-[#1a2744]">Manager Approvals</h1>
        <p className="mt-2 text-sm text-gray-500">Review pending leave and permission requests assigned to you as level 1 approver.</p>
      </div>

      <div className="flex gap-6 border-b border-gray-100">
        {[
          { id: 'leaves', label: 'Leave Requests' },
          { id: 'permissions', label: 'Permission Requests' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 text-xs font-black uppercase tracking-[0.2em] ${
              activeTab === tab.id ? 'border-b-2 border-[#1a2744] text-[#1a2744]' : 'text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl bg-white p-16 text-gray-400 shadow-sm">
          <Clock3 className="mr-3 animate-spin" size={22} />
          Loading manager queue...
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
              <tr>
                <th className="p-4">Employee</th>
                <th className="p-4">{activeTab === 'leaves' ? 'Request' : 'Time'}</th>
                <th className="p-4">Date</th>
                <th className="p-4">Location</th>
                <th className="p-4 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentData.map((request) => (
                <tr
                  key={`${activeTab}-${request.id}`}
                  data-approval-row={`${activeTab}-${request.id}`}
                  onClick={() => openRequest(request, activeTab === 'leaves' ? 'leave' : 'permission')}
                  className={`cursor-pointer transition ${
                    String(request.id) === String(highlightId)
                      ? 'bg-amber-50 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.5)]'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="p-4">
                    <p className="font-bold text-[#1a2744]">{request.employees?.full_name || request.employee_id}</p>
                    <p className="text-xs uppercase tracking-wide text-gray-400">{request.employees?.department}</p>
                  </td>
                  <td className="p-4 font-medium text-gray-700">
                    {activeTab === 'leaves'
                      ? request.leave_type
                      : `${String(request.start_time || '--').slice(0, 5)} - ${String(request.end_time || '--').slice(0, 5)}`}
                  </td>
                  <td className="p-4 font-medium text-gray-500">
                    {activeTab === 'leaves'
                      ? `${format(parseISO(request.start_date), 'dd MMM yyyy')} - ${format(parseISO(request.end_date), 'dd MMM yyyy')}`
                      : format(parseISO(request.date), 'dd MMM yyyy')}
                  </td>
                  <td className="p-4 text-gray-500">{request.employees?.work_location || '-'}</td>
                  <td className="p-4 text-right text-xs font-bold uppercase tracking-wide text-gray-400">View</td>
                </tr>
              ))}
              {!currentData.length && (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-sm text-gray-400">
                    No manager approvals are waiting right now
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                <p className="mt-2 text-sm text-gray-500">{selectedRequest.reason || 'No reason provided'}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100">
                <XCircle size={22} />
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-gray-50 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Department</p>
                  <p className="mt-2 text-sm text-gray-700">{selectedRequest.employees?.department || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Work Location</p>
                  <p className="mt-2 text-sm text-gray-700">{selectedRequest.employees?.work_location || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Request Window</p>
                  <p className="mt-2 text-sm text-gray-700">
                    {selectedType === 'leave'
                      ? `${format(parseISO(selectedRequest.start_date), 'dd MMM yyyy')} - ${format(parseISO(selectedRequest.end_date), 'dd MMM yyyy')}`
                      : `${format(parseISO(selectedRequest.date), 'dd MMM yyyy')} | ${String(selectedRequest.start_time || '--').slice(0, 5)} - ${String(selectedRequest.end_time || '--').slice(0, 5)}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Current Level</p>
                  <p className="mt-2 text-sm text-gray-700">Level {selectedRequest.current_approval_level || 1}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4 border-t border-gray-100 pt-6">
              <div className="flex gap-3">
                <button
                  onClick={() => setAction('approve')}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.2em] ${
                    action === 'approve' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700'
                  }`}
                >
                  <CheckCircle2 className="mr-2 inline" size={16} />
                  Approve
                </button>
                <button
                  onClick={() => setAction('reject')}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.2em] ${
                    action === 'reject' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700'
                  }`}
                >
                  <XCircle className="mr-2 inline" size={16} />
                  Reject
                </button>
              </div>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder={action === 'reject' ? 'Rejection remarks are required' : 'Remarks (optional)'}
                className="min-h-[120px] w-full rounded-2xl border border-gray-200 p-4 text-sm outline-none focus:border-[#1a2744]"
              />
              <button
                onClick={processRequest}
                disabled={submitting}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white ${
                  action === 'approve' ? 'bg-[#1a2744]' : 'bg-red-600'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {submitting ? 'Processing...' : `Confirm ${action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
