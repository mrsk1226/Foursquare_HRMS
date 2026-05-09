import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { supabase } from '../lib/supabase_client';

const TopNavbar = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const [employee, setEmployee] = useState(null);
  const [status, setStatus] = useState('connected');

  useEffect(() => {
    let isActive = true;
    async function fetchEmployee() {
      if (!profile?.employee_id) return;
      const { data, error } = await supabase
        .from('employees')
        .select('full_name, photo_url')
        .eq('employee_id', profile.employee_id)
        .maybeSingle();
      if (isActive && !error && data) {
        setEmployee(data);
      }
    }
    fetchEmployee();
    return () => { isActive = false; };
  }, [profile?.employee_id]);

  useEffect(() => {
    const updateStatus = () => {
      setStatus(navigator.onLine ? 'connected' : 'disconnected');
    };
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const displayName = employee?.full_name || profile?.full_name || profile?.email || 'User';
  const avatarLetter = displayName?.charAt(0)?.toUpperCase() || 'U';

  const getPageTitle = (pathname) => {
    const path = pathname.split('/')[1] || 'dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
  };

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-8 flex-shrink-0 z-10 shadow-sm">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-[#1a2744]">
          {getPageTitle(location.pathname)}
        </h1>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-100">
          <div className={`w-2 h-2 rounded-full ${
            status === 'connected'
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
              : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
          }`} />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            {status === 'connected' ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-8">
        <div className="text-right hidden sm:block">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{dateString}</p>
        </div>
        <div className="flex items-center space-x-6">
          <NotificationBell />
          <div className="flex items-center space-x-3 cursor-pointer group">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs font-bold text-gray-800 leading-none">
                {displayName}
              </span>
              <span className="text-[10px] text-gray-500 capitalize leading-tight">
                {profile?.role || 'Employee'}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-[#1a2744] text-white flex items-center justify-center text-xs font-bold border-2 border-transparent group-hover:border-blue-400 transition-all overflow-hidden shadow-sm">
              {employee?.photo_url ? (
                <img
                  src={employee.photo_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                avatarLetter
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopNavbar;