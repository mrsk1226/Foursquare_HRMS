import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, FileClock, IndianRupee, UserPlus, ClipboardCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Workflow() {
  const { profile } = useAuth();
  
  const [leaves, setLeaves] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [onboarding, setOnboarding] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      
      const { data: leavesData, error: leavesError } = await supabase
        .from('leave_requests')
        .select(`*, employees(full_name)`)
        .eq('status', 'Pending');
      if (leavesError) throw leavesError;
      setLeaves(leavesData || []);

      const { data: expData, error: expError } = await supabase
        .from('expense_claims')
        .select(`*, employees(full_name)`)
        .eq('status', 'Pending');
      if (expError) throw expError;
      setExpenses(expData || []);

      // Fetch incomplete onboarding
      // Assuming 'onboarding_tasks' table or similar, the prompt says 'onboarding'
      const { data: onbData, error: onbError } = await supabase
        .from('onboarding')
        .select(`*, employees(full_name)`)
        .eq('status', 'Pending');
      
      // If table onboarding doesn't exist, it might fail. The user said fetch incomplete from 'onboarding'.
      // Usually status might be Pending or Incomplete.
      if (onbError) {
        if(onbError.code !== '42P01') {
           console.error('Onboarding fetch error:', onbError);
        }
      } else {
        setOnboarding(onbData || []);
      }
      
    } catch (error) {
      toast.error('Error fetching pending approvals');
      console.error(error);
    } finally {
        setLoading(false);
    }
  };

  const handleLeaveAction = async (id, status) => {
    try {
      const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
      if (error) throw error;
      toast.success(`Leave ${status}`);
      setLeaves(leaves.filter(l => l.id !== id)); // quick remove from UI
    } catch (error) {
       toast.error('Error updating leave');
    }
  };

  const handleExpenseAction = async (id, status) => {
     try {
      const { error } = await supabase.from('expense_claims').update({ status }).eq('id', id);
      if (error) throw error;
      toast.success(`Expense ${status}`);
      setExpenses(expenses.filter(e => e.id !== id));
    } catch (error) {
       toast.error('Error updating expense');
    }
  };

  const verifyOnboarding = async (id) => {
    try {
      // Prompt says Verify button, updates DB
      const { error } = await supabase.from('onboarding').update({ status: 'Completed' }).eq('id', id);
      if (error) throw error;
      toast.success('Task Verified');
      setOnboarding(onboarding.filter(o => o.id !== id));
    } catch (error) {
       toast.error('Error verifying task');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 border-b pb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <ClipboardCheck className="w-8 h-8 mr-3 text-blue-600" />
          Pending Approvals
        </h1>
        <p className="text-gray-500 mt-2 text-lg">Central hub for HR & Admin approvals</p>
      </div>

      <div className="space-y-8">
        {/* Leaves Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-orange-50/30">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <FileClock className="w-5 h-5 mr-2 text-orange-500" />
              Leave Requests
            </h2>
            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
              {leaves.length} Pending
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50">
                <tr className="text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium pl-6">Employee</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Dates</th>
                  <th className="p-4 font-medium">Reason</th>
                  <th className="p-4 font-medium text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {leaves.length === 0 ? (
                   <tr><td colSpan="5" className="p-6 text-center text-gray-400">All caught up!</td></tr>
                ) : leaves.map(leave => (
                   <tr key={leave.id} className="hover:bg-gray-50/50">
                     <td className="p-4 pl-6 font-medium text-gray-900">{leave.employees?.full_name}</td>
                     <td className="p-4 text-gray-600">{leave.leave_type}</td>
                     <td className="p-4 text-gray-600">
                        {new Date(leave.start_date).toLocaleDateString()} to {new Date(leave.end_date).toLocaleDateString()}
                     </td>
                     <td className="p-4 text-gray-600 truncate max-w-xs">{leave.reason}</td>
                     <td className="p-4 pr-6 flex justify-end space-x-2">
                        <button onClick={() => handleLeaveAction(leave.id, 'Approved')} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg group transition-colors" title="Approve">
                          <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                        <button onClick={() => handleLeaveAction(leave.id, 'Rejected')} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg group transition-colors" title="Reject">
                          <XCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>
                     </td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-50/30">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <IndianRupee className="w-5 h-5 mr-2 text-blue-500" />
              Expense Claims
            </h2>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
              {expenses.length} Pending
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50">
                <tr className="text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium pl-6">Employee</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Amount</th>
                  <th className="p-4 font-medium text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                 {expenses.length === 0 ? (
                   <tr><td colSpan="4" className="p-6 text-center text-gray-400">All caught up!</td></tr>
                 ) : expenses.map(exp => (
                   <tr key={exp.id} className="hover:bg-gray-50/50">
                     <td className="p-4 pl-6 font-medium text-gray-900">{exp.employees?.full_name}</td>
                     <td className="p-4 text-gray-600">{exp.category}</td>
                     <td className="p-4 font-medium text-gray-900">₹{exp.amount}</td>
                     <td className="p-4 pr-6 flex justify-end space-x-2">
                        <button onClick={() => handleExpenseAction(exp.id, 'Approved')} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg group transition-colors">
                          <CheckCircle className="w-5 h-5 group-hover:scale-110" />
                        </button>
                        <button onClick={() => handleExpenseAction(exp.id, 'Rejected')} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg group transition-colors">
                          <XCircle className="w-5 h-5 group-hover:scale-110" />
                        </button>
                     </td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Onboarding Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-purple-50/30">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <UserPlus className="w-5 h-5 mr-2 text-purple-500" />
              Onboarding Tasks
            </h2>
            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full">
              {onboarding.length} Pending
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50">
                <tr className="text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium pl-6">Employee</th>
                  <th className="p-4 font-medium">Task / Step</th>
                  <th className="p-4 font-medium text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                 {onboarding.length === 0 ? (
                   <tr><td colSpan="3" className="p-6 text-center text-gray-400">All caught up!</td></tr>
                 ) : onboarding.map(task => (
                   <tr key={task.id} className="hover:bg-gray-50/50">
                     <td className="p-4 pl-6 font-medium text-gray-900">{task.employees?.full_name}</td>
                     <td className="p-4 text-gray-600">{task.task_name || task.step || task.title}</td>
                     <td className="p-4 pr-6 flex justify-end">
                        <button onClick={() => verifyOnboarding(task.id)} className="px-4 py-2 bg-purple-50 text-purple-700 font-medium hover:bg-purple-100 rounded-lg transition-colors border border-purple-100">
                          Verify Task
                        </button>
                     </td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

