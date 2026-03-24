import React from 'react';
import { Building2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const AccessDenied = () => {
  const { signOut, profile } = useAuth();

  // If they are admin or HR, they shouldn't be here
  if (profile && profile.role !== 'employee') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100 flex flex-col items-center">
        
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
          <Building2 className="w-10 h-10 text-[#1E3A5F]" />
        </div>
        
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Access Denied</h1>
        
        <p className="text-gray-600 font-medium mb-1">
          Web portal is for Admin & HR only.
        </p>
        <p className="text-sm text-gray-500 mb-8 border-b border-gray-100 pb-8">
          Please use the Foursquare HRMS Mobile App to access your account, punch attendance, and apply for leaves.
        </p>

        <button 
          onClick={signOut}
          className="w-full flex items-center justify-center px-6 py-3 bg-[#1E3A5F] text-white rounded-xl font-medium hover:bg-[#2A4D7C] transition-colors shadow-sm"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out of Web Portal
        </button>
      </div>
    </div>
  );
};

export default AccessDenied;

