import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addDays, differenceInCalendarDays, format, isWithinInterval, formatDistanceToNow } from 'date-fns';
import { AnimatePresence, Reorder, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase_client';
import { DashboardWidgetSkeleton, EmptyStatePanel, SkeletonBlock, StatsWidgetSkeleton } from '../components/ui/LoadingSkeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { 
  ArrowRight, CalendarDays, Cake, ChevronLeft, ChevronRight, Eye, EyeOff, FileText, GripVertical, 
  HeartHandshake, IndianRupee, Settings2, Sparkles, Users, UserCheck, CalendarOff, UserPlus, 
  Database, X, Cloud, CloudRain, Sun, CloudLightning, Thermometer, Droplets, MapPin, 
  Clock as ClockIcon, Receipt, Megaphone, Phone, CheckSquare, DollarSign, CheckCircle, BarChart2, Edit, Plus, Trash2, ChevronUp, ChevronDown, Minus
} from 'lucide-react';
import { toast } from 'react-hot-toast';


const PAGE_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: 'easeOut' },
};

const MotionDiv = motion.div;
const ReorderGroup = Reorder.Group;
const ReorderItem = Reorder.Item;

const OFFICE_EVENTS = [
  { id: 'townhall', title: 'Quarterly Town Hall', dayOffset: 3, host: 'Leadership Team', accent: 'from-sky-500 to-cyan-400' },
  { id: 'wellness', title: 'Wellness Friday', dayOffset: 8, host: 'People Team', accent: 'from-emerald-500 to-teal-400' },
  { id: 'training', title: 'Leadership Workshop', dayOffset: 12, host: 'Learning Hub', accent: 'from-violet-500 to-indigo-400' },
];

const ICON_MAP = {
  Clock: ClockIcon,
  Calendar: CalendarDays,
  FileText: FileText,
  Receipt: Receipt,
  User: UserCheck,
  Megaphone: Megaphone,
  Phone: Phone,
  UserPlus: UserPlus,
  CheckSquare: CheckSquare,
  DollarSign: DollarSign,
  CheckCircle: CheckCircle,
  BarChart2: BarChart2,
  Edit: Edit,
  Default: Database
};

const MASTER_CARDS = {
  employee: [
    { key: 'attendance', label: 'Attendance', icon: 'Clock', route: '/attendance', description: 'View & punch attendance' },
    { key: 'leave', label: 'Leave Requests', icon: 'Calendar', route: '/leave-requests', description: 'Apply & track leaves' },
    { key: 'payslip', label: 'Salary Statements', icon: 'FileText', route: '/payroll', description: 'View payslips' },
    { key: 'expenses', label: 'Claim Expenses', icon: 'Receipt', route: '/expenses', description: 'Submit expense claims' },
    { key: 'profile', label: 'My Profile', icon: 'User', route: '/my-profile', description: 'View & edit profile' },
    { key: 'announcements', label: 'Company Feed', icon: 'Megaphone', route: '/announcements', description: 'Company updates' },
    { key: 'hr_contact', label: 'HR Contact', icon: 'Phone', route: '/hr-contact', description: 'Reach HR team' },
  ],
  hr: [
    { key: 'attendance', label: 'Attendance', icon: 'Clock', route: '/attendance', description: 'View & punch attendance' },
    { key: 'leave', label: 'Leave Requests', icon: 'Calendar', route: '/leave-requests', description: 'Apply & track leaves' },
    { key: 'payslip', label: 'Salary Statements', icon: 'FileText', route: '/payroll', description: 'View payslips' },
    { key: 'expenses', label: 'Claim Expenses', icon: 'Receipt', route: '/expenses', description: 'Submit expense claims' },
    { key: 'profile', label: 'My Profile', icon: 'User', route: '/my-profile', description: 'View & edit profile' },
    { key: 'announcements', label: 'Company Feed', icon: 'Megaphone', route: '/announcements', description: 'Company updates' },
    { key: 'hr_contact', label: 'HR Contact', icon: 'Phone', route: '/hr-contact', description: 'Reach HR team' },
    { key: 'add_employee', label: 'Add Employee', icon: 'UserPlus', route: '/employees', description: 'Onboard new staff' },
    { key: 'leave_approval', label: 'Leave Approvals', icon: 'CheckSquare', route: '/leave-requests', description: 'Review leave requests' },
    { key: 'payroll', label: 'Process Payroll', icon: 'DollarSign', route: '/payroll', description: 'Manage payroll cycles' },
    { key: 'expense_approval', label: 'Expense Approvals', icon: 'CheckCircle', route: '/expenses', description: 'Approve expense claims' },
  ],
  admin: [
    { key: 'attendance', label: 'Attendance', icon: 'Clock', route: '/attendance', description: 'View & punch attendance' },
    { key: 'leave', label: 'Leave Requests', icon: 'Calendar', route: '/leave-requests', description: 'Apply & track leaves' },
    { key: 'payslip', label: 'Salary Statements', icon: 'FileText', route: '/payroll', description: 'View payslips' },
    { key: 'expenses', label: 'Claim Expenses', icon: 'Receipt', route: '/expenses', description: 'Submit expense claims' },
    { key: 'profile', label: 'My Profile', icon: 'User', route: '/my-profile', description: 'View & edit profile' },
    { key: 'announcements', label: 'Company Feed', icon: 'Megaphone', route: '/announcements', description: 'Company updates' },
    { key: 'hr_contact', label: 'HR Contact', icon: 'Phone', route: '/hr-contact', description: 'Reach HR team' },
    { key: 'add_employee', label: 'Add Employee', icon: 'UserPlus', route: '/employees', description: 'Onboard new staff' },
    { key: 'leave_approval', label: 'Leave Approvals', icon: 'CheckSquare', route: '/leave-requests', description: 'Review leave requests' },
    { key: 'payroll', label: 'Process Payroll', icon: 'DollarSign', route: '/payroll', description: 'Manage payroll cycles' },
    { key: 'expense_approval', label: 'Expense Approvals', icon: 'CheckCircle', route: '/expenses', description: 'Approve expense claims' },
    { key: 'update_payroll', label: 'Update Payroll', icon: 'Edit', route: '/payroll', description: 'Monthly compensation inputs' },
    { key: 'reports', label: 'Reports', icon: 'BarChart2', route: '/reports', description: 'Analytics & reports' },
  ]
};

const TEAL = '#26A69A';
const PINK = '#EC407A';

function getFirstValue(record, keys, fallback = null) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return fallback;
}

async function runQuery(queryPromise, timeoutMs = 15000) {
  const timed = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  );
  return Promise.race([queryPromise, timed]);
}

function normalizeAnnouncement(item, index) {
  return {
    id: String(getFirstValue(item, ['id'], `announcement-${index}`)),
    title: getFirstValue(item, ['title', 'heading', 'subject'], 'Organisation update'),
    content: getFirstValue(item, ['content', 'message', 'description'], ''),
    created_at: getFirstValue(item, ['created_at', 'updated_at'], new Date().toISOString()),
  };
}

function normalizeLeaveBalance(item) {
  return {
    ...item,
    leave_type: getFirstValue(item, ['leave_type', 'type'], ''),
    total: Number(getFirstValue(item, ['total', 'allocated', 'total_leaves', 'entitled'], 0)),
    remaining: Number(getFirstValue(item, ['remaining', 'balance', 'remaining_leaves'], 0)),
  };
}

const WeatherWidget = () => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
        if (!apiKey || apiKey === 'your_openweathermap_api_key_here') {
           setWeather({ unavailable: true });
           return;
        }
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=11.3410&lon=77.7172&units=metric&appid=${apiKey}`);
        const data = await res.json();
        if (data.cod !== 200) throw new Error(data.message);
        setWeather(data);
      } catch (err) {
        console.error('Weather fetch error:', err);
        setWeather({ unavailable: true });
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // 10 mins
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="bg-white/8 backdrop-blur-md border border-white/15 rounded-2xl p-4 w-48 h-[88px] animate-pulse flex flex-col justify-center">
      <div className="h-3 w-20 bg-white/10 rounded-full mb-2"></div>
      <div className="h-6 w-32 bg-white/10 rounded-full"></div>
    </div>
  );

  if (weather?.unavailable) return (
    <div className="bg-white/8 backdrop-blur-md border border-white/15 rounded-2xl p-4 w-52 flex flex-col justify-center items-end text-right">
       <div className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-wider mb-1">
          <MapPin size={10} /> Erode
       </div>
       <p className="text-white text-xs font-bold">Weather unavailable</p>
    </div>
  );

  const iconUrl = `https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`;

  return (
    <div className="bg-white/8 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-xl flex items-center gap-4 group transition-all hover:bg-white/12">
       <div className="relative">
         <img src={iconUrl} alt={weather.weather[0].main} className="w-12 h-12 drop-shadow-lg" />
         <div className="absolute inset-0 bg-blue-400/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
       </div>
       <div>
         <div className="flex items-center gap-2 text-white/65 text-[10px] font-black uppercase tracking-widest mb-0.5">
           <MapPin size={10} className="text-blue-300" /> Erode
         </div>
         <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-white">{Math.round(weather.main.temp)}°C</span>
            <span className="text-[10px] font-bold text-white/80">{weather.weather[0].description}</span>
         </div>
         <div className="flex items-center gap-3 mt-1 text-[10px] font-medium text-white/45">
            <span className="flex items-center gap-1"><Droplets size={10} /> {weather.main.humidity}%</span>
            <span className="flex items-center gap-1"><Thermometer size={10} /> {Math.round(weather.main.feels_like)}°C</span>
         </div>
       </div>
    </div>
  );
};

const LiveClock = ({ className }) => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className={`flex flex-col items-end ${className}`}>
            <div className="text-lg font-black tracking-tight text-white leading-none">
                {time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="mt-1 text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <ClockIcon size={10} className="text-blue-400" />
                {time.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
        </div>
    );
};


export default function Dashboard() {
  const { profile } = useAuth();
  const [loadError, setLoadError] = useState('');
  const offlineToastShown = useRef(false);

  useEffect(() => {
    if (!profile) return;
  }, [profile]);

  return (
    <MotionDiv {...PAGE_MOTION} className="mx-auto w-full max-w-[1536px] px-6 py-6 space-y-6">
      
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-red-700 flex items-center justify-between mb-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-2 rounded-xl">
              <Database className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-black text-sm uppercase tracking-wider">Connection Issue</p>
              <p className="text-sm opacity-80 mt-1">{loadError}</p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-white text-red-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-red-50 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}
      
      <ExecutiveOverview 
        profile={profile} 
        onDataError={(err) => setLoadError(err)}
      />

      {profile?.role === 'admin' && (
        <>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <LiveStats />
          <AnalyticsDashView />
        </>
      )}
    </MotionDiv>
  );
}

function ExecutiveOverview({ profile, onDataError }) {
  const navigate = useNavigate();
  const [celebrations, setCelebrations] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [favouriteCards, setFavouriteCards] = useState([]);
  const offlineToastShown = useRef(false);

  const defaultCards = useMemo(() => [
    { key: 'attendance', label: 'Attendance', icon: 'Clock', route: '/attendance', description: 'View & punch attendance' },
    { key: 'leave', label: 'Leave Requests', icon: 'Calendar', route: '/leave-requests', description: 'Apply & track leaves' },
    { key: 'payslip', label: 'Salary Statements', icon: 'FileText', route: '/payroll', description: 'View payslips' },
    { key: 'expenses', label: 'Claim Expenses', icon: 'Receipt', route: '/expenses', description: 'Submit expense claims' },
    { key: 'profile', label: 'My Profile', icon: 'User', route: '/my-profile', description: 'View & edit profile' },
    { key: 'feed', label: 'Company Feed', icon: 'Megaphone', route: '/announcements', description: 'Company updates' },
  ], []);

  // Load Everything
  useEffect(() => {
    let isActive = true;
    async function loadData() {
      if (!profile?.id) return;
      setLoading(true);
      
      const localKey = `fsq_dashboard_cards_${profile.employee_id}`;
      const saved = localStorage.getItem(localKey);
      let userFavs = [];
      if (saved) {
        userFavs = JSON.parse(saved);
      } else {
        userFavs = defaultCards.map(c => ({
          ...c,
          id: c.key,
          card_key: c.key,
          card_label: c.label,
          card_icon: c.icon,
          card_route: c.route,
          card_description: c.description,
          is_visible: true
        }));
        localStorage.setItem(localKey, JSON.stringify(userFavs));
      }
      setFavouriteCards(userFavs);

      try {
        const today = new Date();
        const [empResult, balResult, annResult] = await Promise.allSettled([
          runQuery(supabase.from('employees').select('id, employee_id, full_name, dob, photo_url')),
          runQuery(
            supabase
              .from('leave_balances')
              .select('*')
              .eq('employee_id', profile.employee_id)
              .eq('year', today.getFullYear())
          ),
          runQuery(
            supabase
              .from('announcements')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(4)
          )
        ]);

        if (!isActive) return;
        const empRes = empResult.status === 'fulfilled' ? empResult.value : { data: [] };
        const balRes = balResult.status === 'fulfilled' ? balResult.value : { data: [] };
        const annRes = annResult.status === 'fulfilled' ? annResult.value : { data: [] };

        // Birthdays Logic
        const births = (empRes.data || []).flatMap(e => {
          if (!e.dob) return [];
          const dob = new Date(e.dob);
          const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
          if (next < today) next.setFullYear(today.getFullYear() + 1);
          const diff = differenceInCalendarDays(next, today);
          if (diff > 30) return [];
          return [{
            id: e.id, type: 'birthday', title: e.full_name, 
            subtitle: diff === 0 ? 'Today!' : `In ${diff} days`, 
            date: next, photoUrl: e.photo_url, accent: 'from-amber-400 to-rose-400'
          }];
        });

        if (empRes.data) {
          const self = empRes.data.find(e => e.employee_id === profile.employee_id);
          if (self && self.full_name) {
            setDisplayName(self.full_name);
          }
        }

        setCelebrations(births.sort((a,b) => a.date - b.date));
        setLeaveBalances((balRes.data || []).map(normalizeLeaveBalance));
        setRecentAnnouncements(annRes.data || []);

      } catch (err) {
        console.error('Dash Error:', err);
      } finally {
        if (isActive) setLoading(false);
      }
    }
    loadData();
    return () => { isActive = false; };
  }, [profile, defaultCards]);

  const saveToPersistence = (updated) => {
    const localKey = `fsq_dashboard_cards_${profile.employee_id}`;
    localStorage.setItem(localKey, JSON.stringify(updated));
    setFavouriteCards(updated);
  };

  const removeFavourite = (cardId) => {
    const updated = favouriteCards.filter(c => c.id !== cardId);
    saveToPersistence(updated);
  };

  const addFavourite = (masterCard) => {
    if (favouriteCards.some(f => f.card_key === masterCard.key)) return;
    const newFav = {
      id: masterCard.key,
      user_id: profile.id, 
      card_key: masterCard.key, 
      card_label: masterCard.label,
      card_icon: masterCard.icon, 
      card_route: masterCard.route, 
      card_description: masterCard.description,
      is_visible: true
    };
    const updated = [...favouriteCards, newFav];
    saveToPersistence(updated);
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const updated = [...favouriteCards];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    saveToPersistence(updated);
  };

  const moveDown = (index) => {
    if (index === favouriteCards.length - 1) return;
    const updated = [...favouriteCards];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    saveToPersistence(updated);
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const leaveStats = useMemo(() => {
    const types = [
      { key: 'casual', label: 'Casual', accent: 'from-sky-500 to-cyan-400' },
      { key: 'sick', label: 'Sick', accent: 'from-emerald-500 to-teal-400' },
      { key: 'earned', label: 'Earned', accent: 'from-violet-500 to-indigo-400' }
    ];
    return types.map(t => {
      const b = leaveBalances.find(l => l.leave_type?.toLowerCase().includes(t.key)) || { total: 12, remaining: 10 };
      return { ...t, data: b };
    });
  }, [leaveBalances]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_0.9fr]">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[40px] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_35%,#334155_100%)] p-10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <div className="absolute top-0 right-0 p-8">
            <LiveClock />
          </div>
          
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between pr-24">
            <div>
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#34d399]" />
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400/80">Live • Dashboard</span>
              </div>
              <h1 className="text-5xl font-black tracking-tight leading-tight text-white mb-2">
                {greeting}{displayName ? ',' : '!'}
              </h1>
              {displayName && (
                <h1 className="text-6xl font-black tracking-tighter leading-none mb-6">
                  <span style={{
                      background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      display: 'inline-block',
                      paddingRight: '20px'
                  }}>
                    {displayName}
                  </span>
                </h1>
              )}
              <p className="mt-4 text-sm text-white/50 max-w-md leading-relaxed">Your HR ecosystem is fully operational. Manage team velocity, approvals, and workplace culture from one central hub.</p>
            </div>
            <div className="lg:mt-6">
               <WeatherWidget />
            </div>
          </div>

          <div className="mt-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4">Celebrations</p>
            <div className="flex gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {celebrations.length ? celebrations.map(c => (
                <CelebrationCard key={c.id} item={c} currentUserId={profile.id} />
              )) : <div className="text-sm text-white/40 italic py-4">No upcoming celebrations</div>}
            </div>
          </div>
        </section>
        <section className="relative rounded-[40px] bg-[#0f172a] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/5 p-8 transition-all hover:border-white/10 group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400/60 mb-1">Productivity</p>
              <h2 className="text-2xl font-black text-white">Daily Actions</h2>
            </div>
            <button onClick={() => setIsDrawerOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-full text-[11px] font-black uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white transition-all">
              <Settings2 size={12} /> Customize Workspace
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {favouriteCards.filter(c => c.is_visible).map(card => (
                <FavouriteCard 
                  key={card.id || card.card_key} 
                  title={card.card_label} 
                  subtitle={card.card_description} 
                  icon={ICON_MAP[card.card_icon] || ICON_MAP.Default}
                  onClick={() => navigate(card.card_route)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      </div>

      <aside className="space-y-8">
        <section className="glass-gpu rounded-[40px] border border-white/60 bg-white/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">My Status</p>
              <h2 className="text-2xl font-black text-slate-900 mt-1">Leave Balance</h2>
            </div>
            <HeartHandshake className="text-blue-500" size={24} />
          </div>
          <div className="space-y-5">
            {loading ? <StatsWidgetSkeleton rows={3} /> : leaveStats.map((item, index) => (
              <QuickStatBar 
                key={item.key} 
                item={item} 
                index={index} 
                onClick={() => navigate(`/leave-requests?type=${item.key}&tab=balance`)}
              />
            ))}
          </div>
        </section>

        <section className="glass-gpu rounded-[40px] border border-white/60 bg-white/85 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Updates</p>
              <h2 className="text-2xl font-black text-slate-900 mt-1">Latest News</h2>
            </div>
            <button onClick={() => navigate('/announcements')} className="text-[10px] font-black text-blue-600 hover:text-blue-800 tracking-widest uppercase">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {loading ? (
               <div className="space-y-6">
                 {[1,2,3].map(i => <div key={i} className="animate-pulse"><div className="h-3 bg-slate-200 rounded w-1/4 mb-2"></div><div className="h-4 bg-slate-200 rounded w-3/4"></div></div>)}
               </div>
            ) : recentAnnouncements.length ? recentAnnouncements.map(ann => (
              <button 
                key={ann.id} 
                onClick={() => navigate(`/announcements?post=${ann.id}`)}
                className="w-full text-left group p-4 -mx-4 rounded-3xl hover:bg-white/50 transition-all border border-transparent hover:border-white/40"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDistanceToNow(new Date(ann.created_at))} ago</span>
                  {ann.is_pinned && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                </div>
                <h3 className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">{ann.title}</h3>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed opacity-70">{ann.content}</p>
              </button>
            )) : <div className="py-12 text-center text-slate-400 italic text-sm">No recent updates found</div>}
          </div>
        </section>
      </aside>

      {/* CUSTOMISE DRAWER */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[1001]" 
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[1002] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-slate-900">Customise Dashboard</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-10 pr-2">
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center justify-between">
                    <span>Active Workspace</span>
                    <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-[9px]">{favouriteCards.length} Cards</span>
                  </h3>
                  <div className="space-y-3">
                    {favouriteCards.map((card, idx) => (
                      <div 
                        key={card.id || card.card_key} 
                        className={`bg-white rounded-[24px] p-5 border shadow-sm flex items-center gap-5 transition-all ${card.is_visible ? 'border-slate-100' : 'border-slate-100 opacity-60'}`}
                      >
                        <div className="flex flex-col gap-1 items-center justify-center pr-2">
                           <button onClick={(e) => { e.stopPropagation(); moveUp(idx); }} disabled={idx === 0} className="text-slate-300 hover:text-blue-500 disabled:opacity-30"><ChevronUp size={16} /></button>
                           <button onClick={(e) => { e.stopPropagation(); moveDown(idx); }} disabled={idx === favouriteCards.length - 1} className="text-slate-300 hover:text-blue-500 disabled:opacity-30"><ChevronDown size={16} /></button>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-slate-800">{card.card_label}</p>
                          <p className="text-[10px] text-slate-400">{card.card_description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeFavourite(card.id); }} 
                            className="w-10 h-10 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-100 transition-all font-black text-lg"
                          >
                            <Minus size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Available Modules</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {defaultCards
                      .filter(m => !favouriteCards.some(f => f.card_key === m.key))
                      .map(m => (
                        <div key={m.key} className="bg-slate-50 rounded-[24px] p-5 border border-slate-100 flex items-center justify-between group transition-all hover:bg-white hover:shadow-md hover:border-blue-100">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                              {React.createElement(ICON_MAP[m.icon] || ICON_MAP.Default, { size: 20 })}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800">{m.label}</p>
                              <p className="text-[10px] text-slate-400">{m.description}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => addFavourite(m)} 
                            className="w-10 h-10 bg-white border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      ))}
                    {defaultCards.filter(m => !favouriteCards.some(f => f.card_key === m.key)).length === 0 && (
                        <div className="py-10 text-center text-slate-400 text-xs italic bg-slate-50 rounded-[24px] border border-dashed border-slate-200">
                            All modules are already in your workspace
                        </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function CelebrationCard({ item, currentUserId }) {
  const navigate = useNavigate();
  const [showWishModal, setShowWishModal] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const itemDateStr = item.date.toISOString().split('T')[0];
  const isToday = todayStr === itemDateStr;

  const handleClick = () => {
    if (item.linked_post_id) {
      navigate(`/announcements#post-${item.linked_post_id}`);
    } else if (item.type === 'birthday') {
      setShowWishModal(true);
    }
  };

  return (
    <>
      <div
        data-celebration-id={item.id}
        onClick={handleClick}
        className="glass-gpu min-w-[260px] rounded-[28px] border border-white/15 bg-white/10 p-5 shadow-[0_18px_35px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all hover:scale-[1.02] cursor-pointer"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {item.photoUrl ? (
              <img src={item.photoUrl} alt={item.title} className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30" />
            ) : (
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${item.accent} text-sm font-black text-white ring-2 ring-white/30`}>
                {item.title.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-black text-white">{item.title}</p>
              <p className="mt-1 text-xs text-white/65">{item.subtitle}</p>
            </div>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white`}>
            {item.type === 'birthday' ? <Cake size={18} /> : item.type === 'holiday' ? <UserPlus size={18} /> : <CalendarDays size={18} />}
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/75">
          <span>{format(item.date, 'dd MMM yyyy')}</span>
          <span className={isToday ? 'text-amber-300 font-bold' : ''}>
            {isToday ? 'TODAY' : `${differenceInCalendarDays(item.date, new Date())} day(s)`}
          </span>
        </div>
      </div>
      
      <AnimatePresence>
        {showWishModal && (
          <BirthdayWishModal 
            isOpen={showWishModal} 
            onClose={() => setShowWishModal(false)}
            targetName={item.title}
            targetId={item.target_profile_id || item.id}
            currentUserId={currentUserId}
            isToday={isToday}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const BirthdayWishModal = ({ isOpen, onClose, targetName, targetId, currentUserId, isToday }) => {
  const [wish, setWish] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!wish.trim()) return;
    setSending(true);
    try {
      await supabase.from('notifications').insert({
        employee_id: targetId,
        message: `🎂 Birthday Wish: ${wish}`,
        type: 'birthday_wish',
        created_by: currentUserId
      });
      toast.success('Wish sent successfully!');
      onClose();
    } catch (err) {
      toast.error('Failed to send wish');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-slate-100 relative overflow-hidden"
      >
        {isToday && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 animate-pulse" />}
        <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                {isToday ? '🎉' : '📅'}
            </div>
            <h3 className="text-xl font-black text-slate-900">
                {isToday ? `Wish ${targetName.split(' ')[0]} a Happy Birthday!` : `${targetName}'s Birthday Preview`}
            </h3>
            <p className="text-sm text-slate-500 mt-2">
                {isToday ? 'Share some love and celebration with your team member.' : 'Coming up soon! You can wish them on their special day.'}
            </p>
            
            {isToday ? (
                <div className="mt-6 space-y-4">
                    <textarea 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                        placeholder="Type your birthday wish here..."
                        rows={3}
                        value={wish}
                        onChange={(e) => setWish(e.target.value)}
                    />
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
                        <button 
                            onClick={handleSend}
                            disabled={sending || !wish.trim()}
                            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
                        >
                            {sending ? 'Sending...' : 'Send Wish'}
                        </button>
                    </div>
                </div>
            ) : (
                <button onClick={onClose} className="mt-8 w-full py-3 px-4 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">Close</button>
            )}
        </div>
      </MotionDiv>
    </div>
  );
};


function FavouriteCard({ icon, title, subtitle, onClick }) {
  const Icon = icon;
  return (
    <button onClick={onClick} className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-left transition duration-300 hover:-translate-y-1 hover:bg-white/10 group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
        <Icon size={20} />
      </div>
      <p className="mt-5 text-base font-black text-white">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-white/50">{subtitle}</p>
    </button>
  );
}

function QuickStatBar({ item, index, onClick }) {
  const total = Number(item.data?.total || 0);
  const remaining = Number(item.data?.remaining || 0);
  const percentage = total > 0 ? (remaining / total) * 100 : 0;

  return (
    <button onClick={onClick} className="w-full text-left rounded-[24px] border border-slate-50 bg-slate-50/50 p-5 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
          <p className="text-sm font-black text-slate-900">{remaining} Available <span className="text-slate-300 font-normal">/ {total}</span></p>
        </div>
        <div className={`p-2 rounded-xl bg-gradient-to-br ${item.accent} text-white shadow-lg`}>
          <Sparkles size={16} />
        </div>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, delay: 0.1 * index }}
          className={`h-full bg-gradient-to-r ${item.accent} rounded-full`} 
        />
      </div>
    </button>
  );
}

function LiveStats() {
  const [stats, setStats] = useState({ loggedIn: 0, presentToday: 0, onLeave: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchStats() {
      try {
        if (isActive) setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const { data: attendance } = await runQuery(
          supabase.from('attendance_logs').select('*').eq('date', today)
        );
        const { data: leaves } = await runQuery(
          supabase
            .from('leave_requests')
            .select('*')
            .eq('status', 'approved')
            .lte('start_date', today)
            .gte('end_date', today)
        );
        if (!isActive) return;
        setStats({
          loggedIn: (attendance || []).filter((item) => item.check_in && !item.check_out).length,
          presentToday: (attendance || []).filter((item) => item.status === 'present' || item.status === 'late').length,
          onLeave: (leaves || []).length,
        });
      } catch (error) {
        console.error(error);
      } finally {
        if (isActive) setLoading(false);
      }
    }

    fetchStats();
    const interval = window.setInterval(fetchStats, 60000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="glass-gpu relative overflow-hidden rounded-[28px] border border-white/50 bg-white/80 p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <SkeletonBlock className="h-14 w-14 rounded-2xl" />
              <div className="w-full">
                <SkeletonBlock className="h-4 w-1/2 rounded-full" />
                <SkeletonBlock className="mt-3 h-8 w-1/3 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <StatCard icon={Users} title="Active Now" value={stats.loggedIn} color="text-sky-600" bg="bg-sky-100" />
      <StatCard icon={UserCheck} title="Present Today" value={stats.presentToday} color="text-emerald-600" bg="bg-emerald-100" />
      <StatCard icon={CalendarOff} title="On Leave Today" value={stats.onLeave} color="text-rose-600" bg="bg-rose-100" />
    </div>
  );
}

function StatCard({ icon, title, value, color, bg }) {
  const Icon = icon;
  return (
    <div className="glass-gpu relative overflow-hidden rounded-[28px] border border-white/50 bg-white/80 p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400/0 via-sky-400/60 to-cyan-400/0" />
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${bg} ${color}`}>
          <Icon size={28} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="text-3xl font-black text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function UpdateItem({ date, desc }) {
  return (
    <div className="flex gap-4 px-6 py-5 transition-colors hover:bg-slate-50">
      <div className="pt-1">
        <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{date}</div>
      </div>
      <p className="text-sm leading-7 text-slate-700">{desc}</p>
    </div>
  );
}

function AnalyticsDashView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ChartCard title="Gender Distribution">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={[{ name: 'Male', value: 60 }, { name: 'Female', value: 40 }]} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={5} dataKey="value">
                <Cell fill={TEAL} />
                <Cell fill="#80CBC4" />
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Age Distribution">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={[{ age: '20-25', count: 15 }, { age: '26-30', count: 35 }, { age: '31-35', count: 25 }, { age: '36-40', count: 15 }, { age: '40+', count: 10 }]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="age" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={TEAL} strokeWidth={3} dot={{ fill: TEAL, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ChartCard title="Additions and Attrition" subtitle="April 2025 to March 2026">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={[{ month: 'Apr', joined: 4, resigned: 1 }, { month: 'May', joined: 5, resigned: 2 }, { month: 'Jun', joined: 2, resigned: 1 }, { month: 'Jul', joined: 8, resigned: 3 }, { month: 'Aug', joined: 3, resigned: 0 }, { month: 'Sep', joined: 4, resigned: 2 }]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip />
              <Legend iconType="circle" />
              <Line type="monotone" name="Joined" dataKey="joined" stroke={TEAL} strokeWidth={2} dot={{ fill: TEAL, r: 4 }} />
              <Line type="monotone" name="Resigned" dataKey="resigned" stroke={PINK} strokeWidth={2} dot={{ fill: PINK, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Years In Service Distribution">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={[{ years: '<1', count: 20 }, { years: '1-3', count: 45 }, { years: '3-5', count: 25 }, { years: '5+', count: 10 }]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="years" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip />
              <Line type="step" dataKey="count" stroke={TEAL} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ChartCard title="Employees By Status">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart layout="vertical" data={[{ status: 'Confirmed', count: 75 }, { status: 'Probation', count: 20 }, { status: 'Notice', count: 5 }]} margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis dataKey="status" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} />
              <Tooltip />
              <Bar dataKey="count" fill={TEAL} radius={[0, 6, 6, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Employee Count By Department">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart layout="vertical" data={[{ dept: 'Engineering', count: 40 }, { dept: 'Sales', count: 25 }, { dept: 'HR', count: 10 }, { dept: 'Finance', count: 8 }]} margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis dataKey="dept" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} />
              <Tooltip />
              <Bar dataKey="count" fill={TEAL} radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="glass-gpu rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <h3 className="text-[15px] font-black text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : <div className="h-5" />}
      <div className="relative mt-3 w-full flex-1">{children}</div>
    </div>
  );
}
