import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import { Star, Plus, CheckCircle, Search, Filter, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import toast from 'react-hot-toast';

const StarRating = ({ rating, setRating, interactive = false }) => {
  return (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => setRating?.(star)}
          className={`focus:outline-none ${interactive ? 'hover:scale-110 transition-transform' : ''}`}
        >
          <Star
            className={`w-6 h-6 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  );
};

export default function Performance() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    rating: 0,
    review_period: '',
    comments: '',
    goals: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: revData, error: revError } = await supabase
        .from('performance_reviews')
        .select(`*, employees(full_name, department, designation)`)
        .order('created_at', { ascending: false });
      
      if (revError) throw revError;
      setReviews(revData || []);

      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('employee_id, full_name, department, designation')
        .eq('status', 'Active');
        
      if (empError) throw empError;
      setEmployees(empData || []);
    } catch (error) {
      toast.error('Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.rating === 0) {
        toast.error('Please select a rating');
        return;
      }
      const { error } = await supabase
        .from('performance_reviews')
        .insert([{
          employee_id: formData.employee_id,
          reviewer_id: profile.employee_id,
          rating: formData.rating,
          review_period: formData.review_period,
          comments: formData.comments,
          goals: formData.goals
        }]);

      if (error) throw error;
      toast.success('Review added successfully');
      setShowModal(false);
      setFormData({ employee_id: '', rating: 0, review_period: '', comments: '', goals: '' });
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Error submitting review');
    }
  };

  // Group by employee to show cards
  const employeeStats = employees.map(emp => {
    const empReviews = reviews.filter(r => r.employee_id === emp.employee_id);
    const avgRating = empReviews.length 
      ? empReviews.reduce((sum, r) => sum + r.rating, 0) / empReviews.length 
      : 0;
    return { ...emp, avgRating, totalReviews: empReviews.length };
  });

  return (
    <div className="p-8">
      <button 
        onClick={() => navigate('/dashboard')} 
        className="group flex items-center text-xs font-black text-slate-400 hover:text-[#0f172a] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        BACK TO DASHBOARD
      </button>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Performance</h1>
          <p className="text-gray-500 mt-1">Employee performance reviews & ratings</p>
        </div>
        {['admin', 'hr'].includes(profile?.role) && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Review
          </button>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Employee Ratings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {employeeStats.map(emp => (
            <div key={emp.employee_id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                  {emp.full_name?.charAt(0)}
                </div>
                <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold">
                  {emp.avgRating.toFixed(1)} / 5.0
                </div>
              </div>
              <h3 className="font-bold text-gray-900 truncate">{emp.full_name}</h3>
              <p className="text-sm text-gray-500 truncate mb-4">{emp.designation}</p>
              
              <div className="mt-auto pt-4 border-t border-gray-100">
                <StarRating rating={Math.round(emp.avgRating)} />
                <p className="text-xs text-gray-500 mt-2">{emp.totalReviews} reviews</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">Recent Reviews</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="p-4 font-medium">Employee</th>
                <th className="p-4 font-medium">Period</th>
                <th className="p-4 font-medium">Rating</th>
                <th className="p-4 font-medium">Comments</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {reviews.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No reviews found</td></tr>
              ) : (
                reviews.map(review => (
                  <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{review.employees?.full_name}</div>
                      <div className="text-xs text-gray-500">{review.employees?.department}</div>
                    </td>
                    <td className="p-4 font-medium">{review.review_period}</td>
                    <td className="p-4">
                      <StarRating rating={review.rating} />
                    </td>
                    <td className="p-4 text-gray-600 max-w-sm"><p className="truncate">{review.comments}</p></td>
                    <td className="p-4 text-gray-500">{new Date(review.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Performance Review</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select
                    required
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Employee...</option>
                    {employees.map(emp => (
                      <option key={emp.employee_id} value={emp.employee_id}>
                        {emp.full_name} ({emp.department})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Review Period</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Q1 2026"
                    value={formData.review_period}
                    onChange={(e) => setFormData({ ...formData, review_period: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Overall Rating</label>
                <div className="bg-gray-50 p-4 rounded-lg inline-block border border-gray-100">
                  <StarRating 
                    interactive 
                    rating={formData.rating} 
                    setRating={(r) => setFormData({...formData, rating: r})} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comments/Feedback</label>
                <textarea
                  required
                  rows="4"
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Detailed performance review..."
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goals for Next Period</label>
                <textarea
                  rows="2"
                  value={formData.goals}
                  onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Set objectives..."
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

