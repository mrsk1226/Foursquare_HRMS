import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase_client';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Receipt,
  LogOut,
  UserPlus,
  Megaphone,
  UserCircle,
  Headset,
  BarChart3,
  Settings,
  Star,
  ClipboardCheck,
  ShieldCheck,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import BrandLogo from './BrandLogo';

const Sidebar = () => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [employeeDetails, setEmployeeDetails] = useState({ name: '', id: '' });

  useEffect(() => {
    async function loadEmployee() {
      if (!profile?.employee_id) return;
      const { data, error } = await supabase
        .from('employees')
        .select('full_name, employee_id')
        .eq('employee_id', profile.employee_id)
        .maybeSingle();
      
      if (!error && data) {
        setEmployeeDetails({
          name: data.full_name || '',
          id: data.employee_id || ''
        });
      }
    }
    loadEmployee();
  }, [profile?.employee_id]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'hr', 'employee'] },
    { name: 'Employees', path: '/employees', icon: Users, roles: ['admin', 'md', 'hr'] },
    { name: 'Attendance', path: '/attendance', icon: CalendarCheck, roles: ['admin', 'md', 'hr', 'employee'] },
    { name: 'Leave Requests', path: '/leaves', icon: CalendarDays, roles: ['admin', 'md', 'hr', 'employee'] },
    { name: 'Manager Approvals', path: '/manager-approvals', icon: ShieldCheck, roles: ['manager'] },
    { name: 'Payroll', path: '/payroll', icon: Receipt, roles: ['admin', 'md', 'hr', 'employee'] },
    { name: 'Announcements', path: '/announcements', icon: Megaphone, roles: ['admin', 'md', 'hr', 'employee'] },
    { name: 'Onboarding', path: '/onboarding', icon: UserPlus, roles: ['admin', 'md', 'hr'] },
    { name: 'Expenses', path: '/expenses', icon: IndianRupee, roles: ['admin', 'md', 'hr', 'employee'] },
    { name: 'Performance', path: '/performance', icon: Star, roles: ['admin', 'md', 'hr'] },
    { name: 'Workflow', path: '/workflow', icon: ClipboardCheck, roles: ['admin', 'md'] },
    { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['admin', 'md', 'hr'] },
    { name: 'My Profile', path: '/profile', icon: UserCircle, roles: ['admin', 'md', 'hr', 'employee'] },
    { name: 'HR Contact', path: '/hr-contact', icon: Headset, roles: ['admin', 'md', 'hr', 'employee'] },
    { name: 'Settings', path: '/settings', icon: Settings, roles: ['admin', 'md', 'hr'] },
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(profile?.role));
  const displayName = employeeDetails.name || profile?.full_name || 'User';
  const displayId = employeeDetails.id || profile?.employee_id || 'FSQ-ID';

  return (
    <div
      className={`h-screen flex flex-col transition-all duration-300 shadow-[0_24px_70px_rgba(15,23,42,0.28)] z-20 overflow-hidden bg-[linear-gradient(180deg,#0f172a_0%,#16243b_42%,#1e3a5f_100%)] text-white`}
      style={{ width: collapsed ? '80px' : '240px' }}
    >
      {/* Header with Name + ID */}
      <div className="p-4 border-b border-white/10 flex flex-col space-y-3">
        <div className="flex items-center min-h-[40px]">
          <div className="relative flex-1 flex items-center h-[40px]">
            {/* Expanded Logo */}
            <div 
              className={`absolute left-0 transition-all duration-250 cubic-bezier(0.4, 0, 0.2, 1) ${
                collapsed 
                  ? 'opacity-0 scale-90 pointer-events-none' 
                  : 'opacity-100 scale-100 delay-100'
              }`}
            >
              <img 
                src="/images/4square_white.png" 
                alt="Foursquare Logo" 
                className="h-[36px] w-auto object-contain"
              />
            </div>

            {/* Collapsed Logo (App Icon) */}
            <div 
              className={`absolute left-1/2 -translate-x-1/2 transition-all duration-250 cubic-bezier(0.4, 0, 0.2, 1) ${
                collapsed 
                  ? 'opacity-100 scale-100 delay-100' 
                  : 'opacity-0 scale-90 pointer-events-none'
              }`}
            >
              <img 
                src="/images/app_icon.png" 
                alt="App Icon" 
                className="w-8 h-8 object-contain"
              />
            </div>
          </div>
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {!collapsed && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
            <p className="text-sm font-semibold truncate text-white">{displayName}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200">ID: {displayId}</p>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 sidebar-scroll">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              title={collapsed ? item.name : ''}
              className={({ isActive }) =>
                `flex items-center rounded-2xl transition-all duration-200 ${
                  collapsed ? 'justify-center p-3' : 'px-3 py-2.5 space-x-3'
                } ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-400 shadow-[0_14px_30px_rgba(15,23,42,0.24)] ring-1 ring-sky-500/30'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`
              }
            >
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className={`flex items-center w-full text-slate-300 hover:text-red-300 hover:bg-red-500/10 rounded-2xl transition-all ${
            collapsed ? 'justify-center p-3' : 'px-3 py-2.5 space-x-3'
          }`}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
