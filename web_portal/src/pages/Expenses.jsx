import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import { Download, Plus, FileText, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import toast from 'react-hot-toast';

export default function Expenses() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('my-claims');
  const [claims, setClaims] = useState([]);
  const [allPendingClaims, setAllPendingClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    expense_date: '',
    category: 'Travel',
    amount: '',
    description: '',
    receiptFile: null,
  });

  const categories = ['Travel', 'Food', 'Accommodation', 'Communication', 'Office Supplies', 'Medical', 'Other'];

  // ✅ FIX: profile ready ஆனபோதுதான் fetch பண்ணும்
  const fetchClaims = useCallback(async () => {
    if (!profile?.employee_id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expense_claims')
        .select('*')
        .eq('employee_id', profile.employee_id)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      setClaims(data || []);
    } catch (error) {
      toast.error('Error fetching claims');
    } finally {
      setLoading(false);
    }
  }, [profile?.employee_id]);

  const fetchAllPendingClaims = useCallback(async () => {
    if (!profile?.employee_id) return;
    try {
      const { data, error } = await supabase
        .from('expense_claims')
        .select('*, employees(full_name)')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllPendingClaims(data || []);
    } catch (error) {
      console.error('Pending claims error:', error);
    }
  }, [profile?.employee_id]);

  // ✅ FIX: profile?.employee_id ready ஆனபோது மட்டும் run
  useEffect(() => {
    if (!profile?.employee_id) return;
    fetchClaims();
    if (['admin', 'hr', 'md'].includes(profile?.role)) {
      fetchAllPendingClaims();
    }
  }, [profile?.employee_id, fetchClaims, fetchAllPendingClaims]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, receiptFile: e.target.files[0] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile?.employee_id) {
      toast.error('Profile not loaded. Please refresh.');
      return;
    }
    try {
      setLoading(true);
      let receipt_url = null;

      if (formData.receiptFile) {
        const fileExt = formData.receiptFile.name.split('.').pop();
        const fileName = `${profile.employee_id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(fileName, formData.receiptFile);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage
          .from('expense-receipts')
          .getPublicUrl(fileName);
        receipt_url = publicUrlData.publicUrl;
      }

      const { error } = await supabase
        .from('expense_claims')
        .insert([{
          employee_id: profile.employee_id,
          expense_date: formData.expense_date,
          category: formData.category,
          amount: parseFloat(formData.amount),
          description: formData.description,
          receipt_url,
          status: 'Pending'
        }]);
      if (error) throw error;

      toast.success('Expense claim submitted!');
      setShowForm(false);
      setFormData({ expense_date: '', category: 'Travel', amount: '', description: '', receiptFile: null });
      fetchClaims();
    } catch (error) {
      toast.error(error.message || 'Error submitting claim');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('expense_claims')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Claim ${newStatus}`);
      fetchAllPendingClaims();
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  const exportCSV = () => {
    const dataToExport = activeTab === 'my-claims' ? claims : allPendingClaims;
    if (!dataToExport.length) return;
    const headers = ['Date', 'Category', 'Amount', 'Description', 'Status'];
    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + dataToExport.map(c => `${c.expense_date},${c.category},${c.amount},"${c.description || ''}",${c.status}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "expenses.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = {
    pending: claims.filter(c => c.status === 'Pending').length,
    approved: claims.filter(c => c.status === 'Approved').length,
    thisMonthTotal: claims
      .filter(c => {
        const d = new Date(c.expense_date);
        const now = new Date();
        return c.status === 'Approved' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)
  };

  const statusColor = (status) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-orange-100 text-orange-800';
    }
  };

  // ✅ Profile load ஆகும் வரை loading show பண்ணு
  if (!profile?.employee_id) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 text-sm">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <Breadcrumb items={[{ label: 'Expenses', path: null }]} />
      <button
        onClick={() => navigate('/dashboard')}
        className="group flex items-center text-xs font-black text-slate-400 hover:text-[#0f172a] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        BACK TO DASHBOARD
      </button>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 mt-1">Manage your expense claims</p>
        </div>
        <button onClick={exportCSV} className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
          <Download className="w-5 h-5 mr-2" />
          Export CSV
        </button>
      </div>

      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 w-max">
        <button
          onClick={() => setActiveTab('my-claims')}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${activeTab === 'my-claims' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          My Claims
        </button>
        {['admin', 'hr', 'md'].includes(profile?.role) && (
          <button
            onClick={() => setActiveTab('approve-claims')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${activeTab === 'approve-claims' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Approve Claims
          </button>
        )}
      </div>

      {activeTab === 'my-claims' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 font-medium">Pending Claims</p>
              <h3 className="text-3xl font-bold text-orange-600 mt-2">{summary.pending}</h3>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 font-medium">Approved Claims</p>
              <h3 className="text-3xl font-bold text-green-600 mt-2">{summary.approved}</h3>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500 font-medium">This Month Total</p>
              <h3 className="text-3xl font-bold text-blue-600 mt-2">₹{summary.thisMonthTotal.toFixed(2)}</h3>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Claim History</h2>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Claim
              </button>
            </div>

            {showForm && (
              <div className="p-6 bg-gray-50 border-b border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input type="date" required value={formData.expense_date} onChange={e => setFormData({ ...formData, expense_date: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select required value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500">
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">₹</span>
                        <input type="number" required min="1" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="0.00" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receipt</label>
                      <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="w-full px-4 py-2 border rounded-lg text-sm bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea rows="2" required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="Expense description..."></textarea>
                  </div>
                  <div className="flex justify-end space-x-3 mt-4">
                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center">
                      {loading ? 'Submitting...' : 'Submit Claim'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium">Category</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Description</th>
                    <th className="p-4 font-medium">Receipt</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {loading ? (
                    <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading...</td></tr>
                  ) : claims.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-gray-500">No claims found</td></tr>
                  ) : (
                    claims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-gray-50">
                        <td className="p-4">{new Date(claim.expense_date).toLocaleDateString()}</td>
                        <td className="p-4">{claim.category}</td>
                        <td className="p-4 font-medium">₹{claim.amount}</td>
                        <td className="p-4 max-w-xs truncate">{claim.description}</td>
                        <td className="p-4">
                          {claim.receipt_url ? (
                            <a href={claim.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                              <FileText className="w-4 h-4 mr-1" /> View
                            </a>
                          ) : '-'}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(claim.status)}`}>
                            {claim.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Pending Approvals</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Employee</th>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Amount</th>
                  <th className="p-4 font-medium">Receipt</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {allPendingClaims.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500">No pending claims</td></tr>
                ) : (
                  allPendingClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{claim.employees?.full_name || claim.employee_id}</td>
                      <td className="p-4">{new Date(claim.expense_date).toLocaleDateString()}</td>
                      <td className="p-4">{claim.category}</td>
                      <td className="p-4 font-medium">₹{claim.amount}</td>
                      <td className="p-4">
                        {claim.receipt_url ? (
                          <a href={claim.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                            <FileText className="w-4 h-4 mr-1" /> View
                          </a>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => handleStatusUpdate(claim.id, 'Approved')} className="p-1 hover:bg-green-100 text-green-600 rounded">
                            <CheckCircle className="w-6 h-6" />
                          </button>
                          <button onClick={() => handleStatusUpdate(claim.id, 'Rejected')} className="p-1 hover:bg-red-100 text-red-600 rounded">
                            <XCircle className="w-6 h-6" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}