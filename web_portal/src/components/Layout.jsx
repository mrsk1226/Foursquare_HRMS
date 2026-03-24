import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TopNavbar from './TopNavbar';
import Sidebar from './Sidebar';
import { Toaster } from 'react-hot-toast';

export const ProtectedRoute = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a2744]"></div>
          <p className="text-[#1a2744] font-medium text-sm">Loading Foursquare HRMS...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">Loading profile...</div>;

  // Restrict access for employees to generic access-denied or specific dashboard
  // (Assuming Admin/HR only for many management pages, but Dashboard is for everyone)
  // For now, follow the existing logic or allow entry. 
  // The Sidebar already handles admin-only filtering.

  return (
    <div className="flex h-screen bg-[#F5F6FA] text-[#333333] overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Sidebar - FIXED width, controlled internally or by parent */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <TopNavbar />
        
        <main className="flex-1 overflow-auto p-6 bg-[#F5F6FA]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const RoleBasedRoute = ({ children, allowedRoles }) => {
  const { profile, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a2744]"></div>
    </div>
  );

  if (!allowedRoles.includes(profile?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export const AdminRoute = ({ children }) => {
  const { profile, loading } = useAuth();

  if (loading) return null;

  if (profile?.role !== 'admin' && profile?.role !== 'md') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

