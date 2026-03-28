import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  User, Lock, FileText, Phone, Mail, MapPin, Briefcase, 
  CalendarDays, Save, Download, EyeOff, Eye, Upload
} from 'lucide-react';
import { format } from 'date-fns';
import Breadcrumb from '../components/Breadcrumb';


const MyProfile = () => {
  const { profile, user } = useAuth();
  
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState('Profile');
  const [activeSubTab, setActiveSubTab] = useState('AboutMe');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [documents, setDocuments] = useState([]);
  
  // Login History State (Mocked)
  const loginHistoryLogs = [
    { date: '19 Mar 2026, 09:30 AM', ip: '192.168.1.1', device: 'Chrome on Windows 11', status: 'Success' },
    { date: '18 Mar 2026, 09:15 AM', ip: '192.168.1.1', device: 'Chrome on Windows 11', status: 'Success' },
    { date: '17 Mar 2026, 09:42 AM', ip: '192.168.1.1', device: 'Chrome on Windows 11', status: 'Success' },
    { date: '16 Mar 2026, 12:05 PM', ip: '10.0.0.54', device: 'Safari on iPhone', status: 'Success' },
    { date: '15 Mar 2026, 08:50 AM', ip: '192.168.1.1', device: 'Chrome on Windows 11', status: 'Failed' },
  ];

  // Edit State
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    phone: '', address: '', emergency_contact: ''
  });

  // Password State
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  useEffect(() => {
    if (profile?.employee_id) fetchEmployeeData();
  }, [profile]);

  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      if (!profile?.employee_id) return setLoading(false);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', profile.employee_id)
        .maybeSingle();
      if (error) throw error;
      
      setEmployeeData(data || {});
      setFormData({
        phone: data.phone || '',
        address: data.address || '',
        emergency_contact: data.emergency_contact || ''
      });

      // Fetch documents
      const { data: docs } = await supabase.from('documents').select('*').eq('employee_id', profile.employee_id);
      setDocuments(docs || []);
    } catch (err) {
      console.error('Error fetching profile data (ignoring on empty UI):', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('employees')
        .update({ phone: formData.phone, address: formData.address })
        .eq('employee_id', profile.employee_id);
      
      if (error) throw error;
      
      toast.success('Profile updated successfully');
      setEditMode(false);
      fetchEmployeeData();
    } catch (err) {
      toast.error('Failed to update profile');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    const toastId = toast.loading('Uploading photo...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.employee_id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('employees')
        .update({ photo_url: data.publicUrl })
        .eq('employee_id', profile.employee_id);

      if (updateError) throw updateError;

      toast.success('Profile photo updated', { id: toastId });
      fetchEmployeeData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload photo', { id: toastId });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDocumentUpload = async (e, docType) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!profile?.employee_id) return toast.error('Employee ID missing - cannot upload docs');

    const toastId = toast.loading(`Uploading ${docType}...`);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.employee_id}-${docType.replace(/\s+/g, '')}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('employee-documents')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from('documents').insert([{ 
        employee_id: profile.employee_id, 
        document_type: docType, 
        file_url: data.publicUrl
      }]);

      if (dbError) throw dbError;

      toast.success(`${docType} uploaded`, { id: toastId });
      
      const { data: updatedDocs } = await supabase.from('documents').select('*').eq('employee_id', profile.employee_id);
      setDocuments(updatedDocs || []);
    } catch (err) {
      toast.error(`Failed to upload ${docType}`, { id: toastId });
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return toast.error("Passwords do not match!");
    }
    if (passwords.new.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    setIsUpdatingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) throw error;
      
      toast.success("Password updated successfully");
      setPasswords({ new: '', confirm: '' });
    } catch (err) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setIsUpdatingPass(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-full min-h-[60vh]">
       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E3A5F]"></div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full p-8">
      <Breadcrumb items={[{ label: 'My Profile', path: null }]} />
      {/* Breadcrumb & Top Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">My Profile</h1>
        </div>
        <div className="flex items-center gap-3">
           <span className="text-sm font-semibold text-gray-600">Payroll Month</span>
           <select className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#1E3A5F] bg-white text-gray-700 font-medium">
             <option>May 2025</option>
             <option>Apr 2025</option>
             <option>Mar 2025</option>
           </select>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex space-x-6 border-b border-gray-200">
        <button 
          onClick={() => setActiveMainTab('Profile')}
          className={`font-semibold pb-3 border-b-2 transition-colors ${activeMainTab === 'Profile' ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Profile
        </button>
        <button 
          onClick={() => setActiveMainTab('LoginHistory')}
          className={`font-semibold pb-3 border-b-2 transition-colors ${activeMainTab === 'LoginHistory' ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Login History
        </button>
      </div>

      {activeMainTab === 'Profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
          
          {/* Left Column: Avatar & Quick Info */}
          <div className="lg:col-span-4 space-y-6">
             <div className="bg-white rounded border border-gray-200 overflow-hidden text-center">
                <div className="h-32 bgGradient from-[#1E3A5F] to-[#2E86AB] bg-[#1E3A5F]"></div>
                <div className="px-6 flex flex-col items-center">
                   <div className="w-24 h-24 bg-white rounded-full border-4 border-white shadow-lg -mt-12 overflow-hidden flex items-center justify-center relative group">
                      {employeeData?.photo_url ? (
                        <img src={employeeData.photo_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-100 flex items-center justify-center text-4xl font-bold text-[#1E3A5F]">
                           {employeeData?.full_name?.charAt(0)}
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                         {isUploadingImage ? (
                           <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                         ) : (
                           <Upload className="w-6 h-6 text-white" />
                         )}
                         <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                      </label>
                   </div>
                   <h2 className="text-xl font-bold text-gray-900 mt-4">{employeeData?.full_name}</h2>
                   <p className="text-sm font-semibold text-[#2E86AB] mb-1">{employeeData?.designation || 'Employee'}</p>
                   <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-mono mb-6">{employeeData?.employee_id}</span>
                </div>
                <div className="border-t border-gray-100 p-6 flex flex-col gap-3 text-sm text-left">
                   <div className="flex items-center text-gray-600"><Briefcase className="w-4 h-4 mr-3 text-gray-400"/> {employeeData?.department || 'N/A'} Dept</div>
                   <div className="flex items-center text-gray-600"><Mail className="w-4 h-4 mr-3 text-gray-400"/> {employeeData?.email}</div>
                   <div className="flex items-center text-gray-600"><CalendarDays className="w-4 h-4 mr-3 text-gray-400"/> Joined {employeeData?.join_date}</div>
                </div>
             </div>
          </div>

          {/* Right Column: Content */}
          <div className="lg:col-span-8 bg-white rounded border border-gray-200 overflow-hidden flex flex-col">
             {/* Sub Tab Navigation */}
             <div className="flex border-b border-gray-200 bg-gray-50/50 px-6">
               {[ {id: 'AboutMe', icon: User, label: 'About Me'}, 
                  {id: 'Security', icon: Lock, label: 'Security'}, 
                  {id: 'Documents', icon: FileText, label: 'Documents'}
               ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 text-sm ${
                      activeSubTab === tab.id ? 'border-[#2E86AB] text-[#2E86AB]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
               ))}
             </div>

             {/* Tab Content */}
             <div className="p-6 flex-1 bg-white">
                
                {activeSubTab === 'AboutMe' && (
                  <div className="space-y-8 animate-in fade-in duration-300">
                     <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800">Personal Information</h3>
                        <button 
                          onClick={() => editMode ? handleProfileUpdate(new Event('submit')) : setEditMode(true)}
                          className="px-4 py-2 bg-gray-50 text-[#1E3A5F] rounded-lg font-medium text-sm hover:bg-gray-100 border border-gray-200 transition-colors flex items-center"
                        >
                          {editMode ? <><Save className="w-4 h-4 mr-2"/> Save Changes</> : 'Edit Information'}
                        </button>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                        <div>
                           <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Full Name</label>
                           <p className="text-gray-900 font-medium">{employeeData?.full_name}</p>
                        </div>
                        <div>
                           <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Date of Birth</label>
                           <p className="text-gray-900 font-medium">{employeeData?.dob || 'Not Provided'}</p>
                        </div>
                        <div>
                           <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Phone Number</label>
                           {editMode ? (
                             <input type="text" className="w-full p-2 border border-gray-300 rounded focus:ring-[#1E3A5F] text-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                           ) : (
                             <p className="text-gray-900 font-medium flex items-center"><Phone className="w-3 h-3 mr-2 text-gray-400"/> {formData.phone || 'N/A'}</p>
                           )}
                        </div>
                        <div>
                           <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Emergency Contact</label>
                           {editMode ? (
                             <input type="text" className="w-full p-2 border border-gray-300 rounded focus:ring-[#1E3A5F] text-sm" value={formData.emergency_contact} onChange={e => setFormData({...formData, emergency_contact: e.target.value})} />
                           ) : (
                             <p className="text-gray-900 font-medium">{formData.emergency_contact || 'N/A'}</p>
                           )}
                        </div>
                        <div className="md:col-span-2">
                           <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Residential Address</label>
                           {editMode ? (
                             <textarea className="w-full p-2 border border-gray-300 rounded focus:ring-[#1E3A5F] text-sm" rows="3" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}></textarea>
                           ) : (
                             <p className="text-gray-900 font-medium flex items-start"><MapPin className="w-4 h-4 mr-2 mt-0.5 text-gray-400"/> {formData.address || 'N/A'}</p>
                           )}
                        </div>
                     </div>

                     <div className="pt-6">
                        <h3 className="text-lg font-bold text-gray-800 pb-4 border-b border-gray-100 mb-6">Financial Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                           <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Bank Account</label>
                              <p className="text-gray-900 font-medium font-mono">•••• •••• {employeeData?.bank_account?.slice(-4) || 'N/A'}</p>
                           </div>
                           <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">IFSC Code</label>
                              <p className="text-gray-900 font-medium">{employeeData?.bank_ifsc || 'N/A'}</p>
                           </div>
                           <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">PAN Number</label>
                              <p className="text-gray-900 font-medium uppercase">{employeeData?.pan_number || 'N/A'}</p>
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {activeSubTab === 'Security' && (
                  <div className="animate-in fade-in duration-300 max-w-md">
                     <h3 className="text-lg font-bold text-gray-800 mb-2">Change Password</h3>
                     <p className="text-sm text-gray-500 mb-6 pb-4 border-b border-gray-100">Ensure your account is using a long, random password to stay secure.</p>
                     
                     <form onSubmit={handlePasswordUpdate} className="space-y-4">
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                          <input type="email" value={user.email} disabled className="w-full p-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg cursor-not-allowed" />
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">New Password <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <input required type={showPass ? 'text' : 'password'} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F]" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} />
                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                               {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                            </button>
                          </div>
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                          <input required type={showPass ? 'text' : 'password'} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#1E3A5F]" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
                       </div>
                       <div className="pt-2">
                          <button disabled={isUpdatingPass} type="submit" className="px-6 py-2 bg-[#1E3A5F] text-white rounded-lg font-medium hover:bg-[#2A4D7C] transition-colors shadow-sm disabled:opacity-70">
                             {isUpdatingPass ? 'Updating...' : 'Update Password'}
                          </button>
                       </div>
                     </form>
                  </div>
                )}

                {activeSubTab === 'Documents' && (
                  <div className="animate-in fade-in duration-300">
                     <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-6">
                        <h3 className="text-lg font-bold text-gray-800">My Documents</h3>
                        <p className="text-sm text-gray-500">View and download your official documents.</p>
                     </div>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {['Aadhaar Card', 'PAN Card', 'Offer Letter', 'Experience Letter', 'Other'].map(doc => {
                          const uploadedDoc = documents.find(d => d.document_type === doc);
                          return (
                          <div key={doc} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${uploadedDoc ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-blue-500'}`}>
                              <FileText className="w-6 h-6" />
                            </div>
                            <h3 className="font-semibold text-gray-800 mb-2">{doc}</h3>
                            {uploadedDoc ? (
                               <div className="mt-2 space-y-2">
                                 <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold uppercase">Uploaded</span>
                                 <a href={uploadedDoc.file_url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline">Download / View</a>
                               </div>
                            ) : (
                               <>
                                 <p className="text-xs text-gray-500 mb-4">PDF, JPG up to 5MB</p>
                                 <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium cursor-pointer flex items-center gap-2">
                                   <Upload className="w-4 h-4" /> Upload
                                   <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => handleDocumentUpload(e, doc)} />
                                 </label>
                               </>
                            )}
                          </div>
                        )})}
                     </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {activeMainTab === 'LoginHistory' && (
        <div className="space-y-6 animate-in fade-in">
           {/* Summary Cards */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#E8F5E9] rounded-lg p-5 border border-[#C8E6C9] shadow-sm flex flex-col justify-center">
                <span className="text-sm font-bold text-green-800 uppercase tracking-wider mb-2">Total Logins</span>
                <span className="text-3xl font-black text-green-700">24</span>
                <span className="text-xs text-green-600 mt-2 font-medium">This month</span>
              </div>
              <div className="bg-[#FCE4EC] rounded-lg p-5 border border-[#F8BBD0] shadow-sm flex flex-col justify-center">
                <span className="text-sm font-bold text-pink-800 uppercase tracking-wider mb-2">Failed Attempts</span>
                <span className="text-3xl font-black text-pink-700">1</span>
                <span className="text-xs text-pink-600 mt-2 font-medium">Last 30 days</span>
              </div>
              <div className="bg-[#F3E5F5] rounded-lg p-5 border border-[#E1BEE7] shadow-sm flex flex-col justify-center">
                <span className="text-sm font-bold text-purple-800 uppercase tracking-wider mb-2">Last Login Date</span>
                <span className="text-2xl font-black text-purple-700">19 Mar 2026</span>
                <span className="text-xs text-purple-600 mt-2 font-medium">09:30 AM</span>
              </div>
           </div>

           {/* Table */}
           <div className="bg-white rounded border border-gray-200 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">IP Address</th>
                      <th className="py-3 px-4">Device Used</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistoryLogs.map((log, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 font-medium text-gray-800">{log.date}</td>
                        <td className="py-4 px-4 text-gray-600 font-mono">{log.ip}</td>
                        <td className="py-4 px-4 text-gray-600">{log.device}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded border ${log.status === 'Success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
             {/* Pagination Footer Mock */}
             <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-gray-50 text-sm text-gray-500">
               <span>Showing 1 to 5 of 24 entries</span>
               <div className="flex gap-2">
                 <button className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50">Previous</button>
                 <button className="px-3 py-1 border border-gray-300 rounded bg-[#1E3A5F] text-white">1</button>
                 <button className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50">2</button>
                 <button className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50">3</button>
                 <button className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50">Next</button>
               </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default MyProfile;

