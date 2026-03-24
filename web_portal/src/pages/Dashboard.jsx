import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase_client';
import { 
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { UserPlus, Database, FileText, Plus, ChevronRight, Users, UserCheck, CalendarOff } from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('Welcome');

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-8">
      <WelcomeView profile={profile} />
      {profile?.role === 'admin' && (
        <>
          <hr className="border-gray-200" />
          <LiveStats />
          <AnalyticsDashView />
        </>
      )}
    </div>
  );
}

function LiveStats() {
  const [stats, setStats] = useState({ loggedIn: 0, presentToday: 0, onLeave: 0 });

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: attData } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('date', today);
        
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('status', 'Approved')
        .lte('start_date', today)
        .gte('end_date', today);

      let loggedIn = 0;
      let present = 0;

      if (attData) {
        loggedIn = attData.filter(d => d.check_in && !d.check_out).length;
        present = attData.filter(d => d.status === 'present' || d.status === 'late').length;
      }

      setStats({
        loggedIn,
        presentToday: present,
        onLeave: leaveData ? leaveData.length : 0
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();

    const channel = supabase.channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard 
        icon={Users} 
        title="Active Now" 
        value={stats.loggedIn} 
        color="#2E86AB" 
        bg="#E3F2FD" 
      />
      <StatCard 
        icon={UserCheck} 
        title="Present Today" 
        value={stats.presentToday} 
        color="#27AE60" 
        bg="#E8F5E9" 
      />
      <StatCard 
        icon={CalendarOff} 
        title="On Leave Today" 
        value={stats.onLeave} 
        color="#E74C3C" 
        bg="#FFEBEE" 
      />
    </div>
  );
}

function StatCard({ icon: Icon, title, value, color, bg }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: bg, color: color }}>
        <Icon size={28} />
      </div>
      <div>
        <p className="text-gray-500 text-sm font-semibold">{title}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function WelcomeView({ profile }) {
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Main Content Area */}
      <div className="flex-1 w-full space-y-6">
        
        {/* Banner */}
        <div className="bg-[#f0f2f5] rounded-xl flex flex-col md:flex-row items-center justify-between p-8 relative overflow-hidden">
          <div className="z-10">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Good Afternoon, {profile?.full_name?.split(' ')[0] || 'User'}!</h1>
            <p className="text-gray-600 text-lg">Let's do great things together. 🚀 ✨</p>
          </div>
          <div className="mt-6 md:mt-0 z-10 w-64 h-32 opacity-90">
            {/* SVG Skyline Illustration */}
            <svg viewBox="0 0 200 100" className="w-full h-full">
              <defs>
                <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff9a9e" />
                  <stop offset="100%" stopColor="#fecfef" />
                </linearGradient>
                <linearGradient id="bld" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a18cd1" />
                  <stop offset="100%" stopColor="#fbc2eb" />
                </linearGradient>
              </defs>
              <circle cx="150" cy="40" r="25" fill="url(#sky)" />
              <rect x="20" y="50" width="30" height="50" rx="3" fill="url(#bld)" />
              <rect x="60" y="30" width="40" height="70" rx="4" fill="url(#bld)" />
              <rect x="110" y="60" width="25" height="40" rx="2" fill="url(#bld)" />
              <rect x="145" y="20" width="35" height="80" rx="4" fill="url(#bld)" />
              {/* Windows */}
              <rect x="65" y="40" width="8" height="8" fill="#ffffff" opacity="0.6" />
              <rect x="80" y="40" width="8" height="8" fill="#ffffff" opacity="0.6" />
              <rect x="65" y="60" width="8" height="8" fill="#ffffff" opacity="0.6" />
              <rect x="80" y="60" width="8" height="8" fill="#ffffff" opacity="0.6" />
              <rect x="155" y="30" width="15" height="6" fill="#ffffff" opacity="0.6" />
              <rect x="155" y="45" width="15" height="6" fill="#ffffff" opacity="0.6" />
            </svg>
          </div>
        </div>

        {/* My Favourites */}
        <div>
          <h2 className="text-lg font-bold text-[#1E3A5F] mb-4">My Favourites</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <button className="h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-[#1E3A5F] hover:border-[#1E3A5F] hover:bg-white transition-all bg-white shadow-sm">
              <Plus size={24} className="mb-2" />
              <span className="font-semibold">Add</span>
            </button>
            <ShortcutCard icon={UserPlus} title="Add Employee" />
            <ShortcutCard icon={Database} title="Update Payroll Data" />
            <ShortcutCard icon={Database} title="Process Payroll" />
            <ShortcutCard icon={FileText} title="Salary statement for a month" />
          </div>
        </div>

        {/* Help Links */}
        <div>
           <div className="flex flex-wrap gap-3 mt-8">
              {['Foursquare Community', 'Statutory Compliances', 'Knowledge Centre', 'Resource Centre', 'How to Videos', 'FSQ HR Academy'].map(link => (
                <button key={link} className="py-2 px-4 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-600 hover:border-[#1E3A5F] hover:text-[#1E3A5F] transition-colors">
                  {link}
                </button>
              ))}
           </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-80 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="h-32 bg-blue-50 flex items-center justify-center p-4">
             <img src="https://illustrations.popsy.co/amber/remote-work.svg" alt="Webinar" className="h-full object-contain mix-blend-multiply" />
          </div>
          <div className="p-5">
            <span className="text-xs font-bold text-pink-500 uppercase tracking-wider">Product Webinar</span>
            <h3 className="font-bold text-gray-800 mt-2 mb-2">Mastering HR Automation</h3>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">Learn how to streamline your HR processes and save up to 10 hours a week.</p>
            <button className="flex items-center text-[#2E86AB] font-semibold text-sm hover:underline">
              Register Now <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-[#1E3A5F] mb-4">Latest Updates</h3>
          <div className="space-y-4">
            <UpdateItem date="19 Mar" desc="New Leave Policy guidelines uploaded to the Resource Centre." />
            <UpdateItem date="15 Mar" desc="Performance appraisal forms are now available." />
            <UpdateItem date="10 Mar" desc="IT maintenance scheduled for this weekend. Sub-systems may be offline." />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutCard({ icon: Icon, title }) {
  return (
    <button className="h-32 bg-[#fffdf0] rounded-xl flex flex-col items-center justify-center p-4 shadow-sm border border-[#f0eed0] hover:shadow-md transition-shadow text-center">
      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 mb-3">
        <Icon size={20} />
      </div>
      <span className="text-xs font-semibold text-gray-700 leading-tight">{title}</span>
    </button>
  );
}

function UpdateItem({ date, desc }) {
  return (
    <div className="flex gap-3">
      <div className="min-w-fit pt-1">
        <div className="bg-gray-100 rounded text-[10px] font-bold px-2 py-1 text-gray-600">{date}</div>
      </div>
      <p className="text-sm text-gray-700 leading-snug">{desc}</p>
    </div>
  );
}

// ---- Analytics Dashboard View ---- //

const TEAL = "#26A69A";
const PINK = "#EC407A";
const TITLE_COLOR = "#1E5F8C";

function AnalyticsDashView() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-sm font-semibold text-gray-700">
          Edit
        </button>
      </div>
      
      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Gender Distribution">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={[{name: 'Male', value: 60}, {name: 'Female', value: 40}]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                <Cell fill={TEAL} />
                <Cell fill="#80CBC4" />
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        
        <ChartCard title="Age Distribution">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={[{age: '20-25', count: 15}, {age: '26-30', count: 35}, {age: '31-35', count: 25}, {age: '36-40', count: 15}, {age: '40+', count: 10}]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="age" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={TEAL} strokeWidth={3} dot={{fill: TEAL, r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Additions and Attrition" subtitle="April-2025 to March-2026">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={[
              {month: 'Apr', joined: 4, resigned: 1}, {month: 'May', joined: 5, resigned: 2}, 
              {month: 'Jun', joined: 2, resigned: 1}, {month: 'Jul', joined: 8, resigned: 3},
              {month: 'Aug', joined: 3, resigned: 0}, {month: 'Sep', joined: 4, resigned: 2}
            ]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <Tooltip />
              <Legend iconType="circle" />
              <Line type="monotone" name="Joined" dataKey="joined" stroke={TEAL} strokeWidth={2} dot={{fill: TEAL, r: 4}} />
              <Line type="monotone" name="Resigned" dataKey="resigned" stroke={PINK} strokeWidth={2} dot={{fill: PINK, r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        
        <ChartCard title="Years In Service Distribution">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={[{years: '<1', count: 20}, {years: '1-3', count: 45}, {years: '3-5', count: 25}, {years: '5+', count: 10}]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="years" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <Tooltip />
              <Line type="step" dataKey="count" stroke={TEAL} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Employees By Status">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart layout="vertical" data={[{status: 'Confirmed', count: 75}, {status: 'Probation', count: 20}, {status: 'Notice', count: 5}]} margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <YAxis dataKey="status" type="category" axisLine={false} tickLine={false} tick={{fill: '#555', fontSize: 12, fontWeight: 'bold'}} />
              <Tooltip />
              <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        
        <ChartCard title="Employee Count By Department">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart layout="vertical" data={[{dept: 'Engineering', count: 40}, {dept: 'Sales', count: 25}, {dept: 'HR', count: 10}, {dept: 'Finance', count: 8}]} margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <YAxis dataKey="dept" type="category" axisLine={false} tickLine={false} tick={{fill: '#555', fontSize: 12, fontWeight: 'bold'}} />
              <Tooltip />
              <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 4 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="ANNUAL CTC By Department">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart layout="vertical" data={[{dept: 'Engineering', val: 120}, {dept: 'Sales', val: 75}, {dept: 'HR', val: 30}, {dept: 'Finance', val: 40}]} margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <YAxis dataKey="dept" type="category" axisLine={false} tickLine={false} tick={{fill: '#555', fontSize: 12, fontWeight: 'bold'}} />
              <Tooltip formatter={(value) => [`$${value}k`, "CTC"]} />
              <Bar dataKey="val" fill={TEAL} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ANNUAL CTC By Status">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart layout="vertical" data={[{status: 'Confirmed', val: 240}, {status: 'Probation', val: 40}]} margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <YAxis dataKey="status" type="category" axisLine={false} tickLine={false} tick={{fill: '#555', fontSize: 12, fontWeight: 'bold'}} />
              <Tooltip formatter={(value) => [`$${value}k`, "CTC"]} />
              <Bar dataKey="val" fill={TEAL} radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Last 6 Months ANNUAL CTC">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[{mon: 'Oct', val: 20}, {mon: 'Nov', val: 22}, {mon: 'Dec', val: 24}, {mon: 'Jan', val: 26}, {mon: 'Feb', val: 28}, {mon: 'Mar', val: 30}]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="mon" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
              <Tooltip formatter={(value) => [`$${value}k`, "CTC"]} />
              <Bar dataKey="val" fill={TEAL} radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        
        <ChartCard title="Top 5 Leave Takers">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left font-semibold text-gray-500">Employee Name</th>
                  <th className="py-2 text-right font-semibold text-gray-500">Leave Days</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Arjun Das', days: 12 },
                  { name: 'Sneha Sharma', days: 9 },
                  { name: 'Rahul V', days: 7 },
                  { name: 'Priya M', days: 6 },
                  { name: 'Vikas K', days: 5 },
                ].map((l, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-3 text-gray-800">{l.name}</td>
                    <td className="py-3 text-right text-[#1E3A5F] font-bold">{l.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col">
      <h3 className="text-[15px] font-bold mb-1" style={{ color: TITLE_COLOR }}>{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mb-4">{subtitle}</p>}
      {!subtitle && <div className="h-4"></div>}
      <div className="flex-1 w-full relative">
        {children}
      </div>
    </div>
  );
}

