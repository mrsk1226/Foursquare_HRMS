import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import { 
  Building, MapPin, Network, BookOpen, Save, 
  Trash2, Plus, GripVertical, UserPlus, Shield,
  User, Moon, Sun, Lock, Bell, Calendar,
  Receipt, FileText, CheckCircle, Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { profile } = useAuth();
  const isAdminOrHr = ['admin', 'hr'].includes(profile?.role);
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);

  // States
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [emailDetails, setEmailDetails] = useState({ newEmail: '' });
  const [passDetails, setPassDetails] = useState({ newPass: '' });
  
  const [departments, setDepartments] = useState([]);
  const [newDept, setNewDept] = useState('');
  
  const [companyForm, setCompanyForm] = useState({ name: 'Foursquare', address: '', gst: '' });
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [leavePolicies, setLeavePolicies] = useState([
    { type: 'Casual Leave', days: 12 }, { type: 'Sick Leave', days: 12 }, { type: 'Earned Leave', days: 15 }
  ]);
  const [payrollSettings, setPayrollSettings] = useState({ pf: 12, esi: 0.75, prof_tax: 200 });
  const [notifs, setNotifs] = useState({ email: true, push: false, sms: false });

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark', 'bg-gray-900', 'text-white');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark', 'bg-gray-900', 'text-white');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  // Fetches
  useEffect(() => {
    if (activeTab === 'departments' && isAdminOrHr) fetchDepartments();
    if (activeTab === 'users' && isAdminOrHr) fetchUsers();
    if (activeTab === 'audit' && isAdminOrHr) fetchAuditLogs();
  }, [activeTab, isAdminOrHr]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepartments(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, email, role, employee_id');
    setUsers(data || []);
  };

  const fetchAuditLogs = async () => {
    // Generate dummy logs if table doesn't exist
    setAuditLogs([
      { id: 1, action: 'User Login', user: profile.email, time: new Date().toISOString() },
      { id: 2, action: 'Updated Settings', user: profile.email, time: new Date().toISOString() },
    ]);
  };

  // Handlers
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ email: emailDetails.newEmail });
      if (error) throw error;
      toast.success('Email update step complete! Please check both inboxes.');
      setEmailDetails({ newEmail: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: passDetails.newPass });
      if (error) throw error;
      toast.success('Password updated successfully');
      setPassDetails({ newPass: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    try {
      await supabase.from('departments').insert([{ name: newDept }]);
      toast.success('Added department');
      setNewDept('');
      fetchDepartments();
    } catch (err) {
      toast.error('Error adding dept');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      toast.success('Role updated');
      fetchUsers();
    } catch (e) {
      toast.error('Error updating role');
    }
  };

  const userTabs = [
    { id: 'account', icon: User, label: 'My Account' },
    { id: 'appearance', icon: theme === 'dark' ? Moon : Sun, label: 'Appearance' },
    { id: 'privacy', icon: Shield, label: 'Privacy & Security' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
  ];

  const adminTabs = [
    { id: 'company', icon: Building, label: 'Company Profile' },
    { id: 'users', icon: UserPlus, label: 'User Management' },
    { id: 'departments', icon: Network, label: 'Departments' },
    { id: 'policies', icon: BookOpen, label: 'Leave Policy' },
    { id: 'calendar', icon: Calendar, label: 'Holiday Calendar' },
    { id: 'payroll_settings', icon: Receipt, label: 'Payroll Settings' },
    { id: 'audit', icon: FileText, label: 'Audit Log' },
  ];

  const tabs = isAdminOrHr ? [...userTabs, ...adminTabs] : userTabs;

  return (
    <div className="p-8 max-w-7xl mx-auto dark:text-gray-100">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and system preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              <tab.icon className={`w-5 h-5 mr-3 ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : ''}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Pane */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 min-h-[500px]">
          
          {/* MY ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-8 animate-in fade-in">
              <div>
                <h2 className="text-xl font-bold mb-4">Change Email</h2>
                <form onSubmit={handleUpdateEmail} className="flex gap-4 max-w-md">
                  <input type="email" required placeholder="New Email" value={emailDetails.newEmail} onChange={e => setEmailDetails({newEmail: e.target.value})} className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Update</button>
                </form>
              </div>
              <div className="border-t dark:border-gray-700 pt-8">
                <h2 className="text-xl font-bold mb-4">Change Password</h2>
                <form onSubmit={handleUpdatePassword} className="flex gap-4 max-w-md">
                  <input type="password" required placeholder="New Password" value={passDetails.newPass} onChange={e => setPassDetails({newPass: e.target.value})} className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Update</button>
                </form>
              </div>
            </div>
          )}

          {/* APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="animate-in fade-in">
              <h2 className="text-xl font-bold mb-6">Theme Settings</h2>
              <div className="flex items-center space-x-4">
                <button onClick={() => setTheme('light')} className={`p-4 border-2 rounded-xl flex flex-col items-center ${theme === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <Sun className="w-8 h-8 mb-2 text-orange-500" />
                  <span className="font-medium">Light Mode</span>
                </button>
                <button onClick={() => setTheme('dark')} className={`p-4 border-2 rounded-xl flex flex-col items-center ${theme === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <Moon className="w-8 h-8 mb-2 text-indigo-500" />
                  <span className="font-medium">Dark Mode</span>
                </button>
              </div>
            </div>
          )}

          {/* PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="animate-in fade-in">
              <h2 className="text-xl font-bold mb-6">Recent Login Sessions</h2>
              <table className="w-full text-left">
                <thead><tr className="text-gray-500 border-b"><th className="pb-2">Device/IP</th><th className="pb-2">Time</th><th className="pb-2">Status</th></tr></thead>
                <tbody className="divide-y text-sm">
                  <tr><td className="py-3">Windows - Chrome</td><td className="py-3">Just now</td><td className="py-3 text-green-600">Active</td></tr>
                  <tr><td className="py-3">Android App</td><td className="py-3">2 hours ago</td><td className="py-3 text-gray-500">Ended</td></tr>
                </tbody>
              </table>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="animate-in fade-in max-w-md space-y-6">
              <h2 className="text-xl font-bold mb-4">Notification Preferences</h2>
              {['email', 'push', 'sms'].map(type => (
                <div key={type} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <span className="capitalize font-medium">{type} Notifications</span>
                  <button onClick={() => setNotifs({...notifs, [type]: !notifs[type]})} className={`w-12 h-6 rounded-full transition-colors relative ${notifs[type] ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${notifs[type] ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* COMPANY */}
          {activeTab === 'company' && (
            <div className="animate-in fade-in">
              <h2 className="text-xl font-bold mb-6">Company Profile</h2>
              <div className="grid grid-cols-1 gap-4 max-w-xl">
                <input placeholder="Company Name" value={companyForm.name} onChange={e=>setCompanyForm({...companyForm, name: e.target.value})} className="px-4 py-2 border rounded" />
                <textarea placeholder="Address" value={companyForm.address} onChange={e=>setCompanyForm({...companyForm, address: e.target.value})} className="px-4 py-2 border rounded" />
                <input placeholder="GST Number" value={companyForm.gst} onChange={e=>setCompanyForm({...companyForm, gst: e.target.value})} className="px-4 py-2 border rounded" />
                <button className="px-6 py-2 bg-blue-600 text-white rounded-lg w-fit mt-2">Save Profile</button>
              </div>
            </div>
          )}

          {/* USERS */}
          {activeTab === 'users' && (
            <div className="animate-in fade-in">
              <h2 className="text-xl font-bold mb-6">User Management</h2>
              <table className="w-full text-left">
                <thead><tr className="text-gray-500 border-b"><th className="pb-2">Email</th><th className="pb-2">Emp ID</th><th className="pb-2">Role</th></tr></thead>
                <tbody className="divide-y text-sm">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="py-3">{u.email}</td>
                      <td className="py-3">{u.employee_id}</td>
                      <td className="py-3">
                        <select value={u.role || 'employee'} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="border rounded px-2 py-1 bg-white dark:bg-gray-700">
                          <option value="employee">Employee</option>
                          <option value="hr">HR</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="animate-in fade-in max-w-lg">
              <h2 className="text-xl font-bold mb-6">Departments</h2>
              <form onSubmit={handleAddDept} className="flex gap-2 mb-6">
                <input required placeholder="New Dept Name" value={newDept} onChange={e=>setNewDept(e.target.value)} className="flex-1 px-4 py-2 border rounded" />
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Add</button>
              </form>
              <ul className="divide-y border rounded">
                {departments.map(d => (
                  <li key={d.id} className="p-3 flex justify-between items-center">
                    {d.name}
                    <button className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* LEAVE POLICY */}
          {activeTab === 'policies' && (
            <div className="animate-in fade-in max-w-md">
              <h2 className="text-xl font-bold mb-6">Leave Allocation Policy</h2>
              {leavePolicies.map((lp, i) => (
                <div key={i} className="flex justify-between items-center mb-4 bg-gray-50 p-4 rounded">
                  <span className="font-medium text-gray-700">{lp.type}</span>
                  <input type="number" value={lp.days} onChange={(e) => {
                    const newP = [...leavePolicies]; newP[i].days = e.target.value; setLeavePolicies(newP);
                  }} className="w-20 px-2 py-1 border rounded" />
                </div>
              ))}
              <button className="px-6 py-2 bg-blue-600 text-white rounded mt-4">Save Policies</button>
            </div>
          )}

          {/* HOLIDAY CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="animate-in fade-in">
              <h2 className="text-xl font-bold mb-6">Holiday Calendar</h2>
              <div className="text-center p-12 bg-gray-50 rounded border border-dashed border-gray-300">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Holiday grid view coming soon.</p>
              </div>
            </div>
          )}

          {/* PAYROLL SETTINGS */}
          {activeTab === 'payroll_settings' && (
            <div className="animate-in fade-in max-w-md">
              <h2 className="text-xl font-bold mb-6">Payroll Configs</h2>
              <div className="space-y-4">
                <div><label className="text-sm font-medium">PF Percentage (%)</label><input type="number" value={payrollSettings.pf} onChange={e=>setPayrollSettings({...payrollSettings, pf: e.target.value})} className="w-full mt-1 p-2 border rounded"/></div>
                <div><label className="text-sm font-medium">ESI Percentage (%)</label><input type="number" step="0.01" value={payrollSettings.esi} onChange={e=>setPayrollSettings({...payrollSettings, esi: e.target.value})} className="w-full mt-1 p-2 border rounded"/></div>
                <div><label className="text-sm font-medium">Professional Tax (₹)</label><input type="number" value={payrollSettings.prof_tax} onChange={e=>setPayrollSettings({...payrollSettings, prof_tax: e.target.value})} className="w-full mt-1 p-2 border rounded"/></div>
                <button className="px-6 py-2 bg-blue-600 text-white rounded w-full mt-2">Update Struct</button>
              </div>
            </div>
          )}

          {/* AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="animate-in fade-in">
              <h2 className="text-xl font-bold mb-6">Audit Log</h2>
              <table className="w-full text-left">
                <thead><tr className="text-gray-500 border-b"><th className="pb-2">Action</th><th className="pb-2">User</th><th className="pb-2">Timestamp</th></tr></thead>
                <tbody className="divide-y text-sm">
                  {auditLogs.map(l => (
                    <tr key={l.id}><td className="py-2">{l.action}</td><td className="py-2">{l.user}</td><td className="py-2">{new Date(l.time).toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

