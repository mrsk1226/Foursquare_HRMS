import React, { useEffect, useState, useRef, useCallback } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import {
  debounceRealtime,
  fetchAttendanceRange,
  fetchTodayAttendance,
  getBrowserPosition,
  getCheckIn,
  getCheckOut,
  punchIn,
  punchOut,
  withTimeout,
} from '../lib/attendance';
import {
  Activity, ChevronLeft, ChevronRight, Clock, FileText,
  ShieldCheck, LogIn, LogOut, CheckCircle, MapPin, RefreshCw,
  AlertCircle
} from 'lucide-react';
import RequestStatusModal from '../components/RequestStatusModal';
import { SkeletonBlock, TableSkeleton } from '../components/ui/LoadingSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import Breadcrumb from '../components/Breadcrumb';
import toast from 'react-hot-toast';

const MotionDiv = motion.div;

export default function Attendance() {
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = ['admin', 'hr', 'md'].includes(profile?.role);

  const [tab, setTab] = useState(location.state?.tab || 'attendance');
  const [highlightId, setHighlightId] = useState(location.state?.highlightId || null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Data lists
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [sundays, setSundays] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Punch State
  const [loadingPunch, setLoadingPunch] = useState(true);
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [isPunchedOut, setIsPunchedOut] = useState(false);
  const [punchInTime, setPunchInTime] = useState(null);
  const [punchOutTime, setPunchOutTime] = useState(null);
  const [todayRecord, setTodayRecord] = useState(null);
  const [selectedOffice, setSelectedOffice] = useState('Main Office');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);

  const formatElapsedTime = useCallback((secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, []);

  const runQuery = useCallback((query, timeoutMs = 15000) => withTimeout(query, timeoutMs), []);

  const fetchTodayStatus = useCallback(async ({ showSpinner = true } = {}) => {
    if (!profile?.employee_id) return;
    if (showSpinner && isMountedRef.current) setLoadingPunch(true);
    try {
      const { data, error } = await fetchTodayAttendance(profile.employee_id);

      if (error) throw error;

      if (data) {
        const checkIn = getCheckIn(data);
        const checkOut = getCheckOut(data);

        setTodayRecord(data);
        const cin = checkIn ? new Date(checkIn) : null;
        setPunchInTime(cin);
        setIsPunchedIn(Boolean(checkIn));

        if (checkOut) {
          setPunchOutTime(new Date(checkOut));
          setIsPunchedOut(true);
          if (timerRef.current) clearInterval(timerRef.current);
        } else if (checkIn && cin) {
          setIsPunchedOut(false);
          const diff = Math.floor((Date.now() - cin.getTime()) / 1000);
          setElapsed(diff > 0 ? diff : 0);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setElapsed(prev => prev + 1);
          }, 1000);
        } else {
          setIsPunchedOut(false);
          setElapsed(0);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } else {
        setIsPunchedIn(false);
        setIsPunchedOut(false);
        setTodayRecord(null);
        setPunchInTime(null);
        setPunchOutTime(null);
        setElapsed(0);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch (err) {
      console.error('Error fetching today status:', err);
    } finally {
      if (showSpinner && isMountedRef.current) setLoadingPunch(false);
    }
  }, [profile?.employee_id, runQuery]);

  const fetchAttendance = useCallback(async () => {
    const firstDay = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const lastDay = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const { data } = await fetchAttendanceRange({
      employeeId: profile.employee_id,
      firstDay,
      lastDay,
      isAdmin,
    });
    setAttendance(data || []);
  }, [currentMonth, isAdmin, profile?.employee_id]);

  const fetchLeaves = useCallback(async () => {
    let query = supabase.from('leave_requests').select('*, employees(full_name)').order('created_at', { ascending: false });
    if (!isAdmin) query = query.eq('employee_id', profile.employee_id);
    const { data } = await runQuery(query);
    setLeaves(data || []);
  }, [isAdmin, profile?.employee_id, runQuery]);

  const fetchPermissions = useCallback(async () => {
    let query = supabase.from('permissions').select('*, employees(full_name)').order('created_at', { ascending: false });
    if (!isAdmin) query = query.eq('employee_id', profile.employee_id);
    const { data } = await runQuery(query);
    setPermissions(data || []);
  }, [isAdmin, profile?.employee_id, runQuery]);

  const fetchSundays = useCallback(async () => {
    const { data } = await runQuery(
      supabase.from('sunday_punch_requests').select('*, employees(full_name)').order('created_at', { ascending: false })
    );
    setSundays(data || []);
  }, [runQuery]);

  const loadAllData = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner && isMountedRef.current) setLoading(true);
    await Promise.allSettled([
      fetchAttendance(),
      fetchLeaves(),
      fetchPermissions(),
      fetchSundays(),
      fetchTodayStatus({ showSpinner })
    ]);
    if (showSpinner && isMountedRef.current) setLoading(false);
  }, [fetchAttendance, fetchLeaves, fetchPermissions, fetchSundays, fetchTodayStatus]);

  useEffect(() => {
    isMountedRef.current = true;
    if (profile?.employee_id) {
      loadAllData({ showSpinner: true });
    }
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [profile?.employee_id, loadAllData]);

  useEffect(() => {
    if (location.state?.tab) setTab(location.state.tab);
    if (location.state?.highlightId) setHighlightId(String(location.state.highlightId));
  }, [location.state]);

  useEffect(() => {
    if (!profile?.employee_id) return undefined;

    const filter = isAdmin ? undefined : `employee_id=eq.${profile.employee_id}`;
    const attendanceOptions = { event: '*', schema: 'public', table: 'attendance_logs' };
    const scopedAttendanceOptions = filter ? { ...attendanceOptions, filter } : attendanceOptions;
    const scopedRequests = filter ? { filter } : {};

    const scheduleRefresh = debounceRealtime(() => {
      fetchAttendance();
      fetchTodayStatus({ showSpinner: false });
    });

    const channel = supabase
      .channel(`attendance-screen-${profile.employee_id}-${isAdmin ? 'admin' : 'employee'}`)
      .on('postgres_changes', scopedAttendanceOptions, () => {
        scheduleRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests', ...scopedRequests }, fetchLeaves)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permissions', ...scopedRequests }, fetchPermissions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sunday_punch_requests' }, fetchSundays)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    fetchAttendance,
    fetchLeaves,
    fetchPermissions,
    fetchSundays,
    fetchTodayStatus,
    isAdmin,
    profile?.employee_id,
  ]);

  useEffect(() => {
    if (!highlightId || tab !== 'leaves') return undefined;
    const node = document.querySelector(`[data-leave-id="${highlightId}"]`);
    if (!node) return undefined;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeoutId = window.setTimeout(() => setHighlightId(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [highlightId, tab, leaves]);

  const handlePunchIn = async () => {
    if (!profile?.employee_id) return;
    try {
      setLoadingPunch(true);
      const position = await getBrowserPosition();
      const { data, error } = await punchIn(profile.employee_id, position);

      if (error) throw error;

      toast.success('Punched in successfully!');
      const checkIn = getCheckIn(data) ? new Date(getCheckIn(data)) : new Date();
      setTodayRecord(data);
      setPunchInTime(checkIn);
      setIsPunchedIn(true);
      setIsPunchedOut(false);
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);

      fetchAttendance();
    } catch (err) {
      toast.error('Punch in failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoadingPunch(false);
    }
  };

  const handlePunchOut = async () => {
    if (!todayRecord?.id) return;

    try {
      setLoadingPunch(true);
      const { data, error } = await punchOut(profile.employee_id, todayRecord);

      if (error) throw error;

      toast.success('Punched out successfully!');
      if (timerRef.current) clearInterval(timerRef.current);

      setTodayRecord(data);
      setPunchOutTime(getCheckOut(data) ? new Date(getCheckOut(data)) : new Date());
      setIsPunchedOut(true);
      fetchAttendance();
    } catch (err) {
      toast.error('Punch out failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoadingPunch(false);
    }
  };

  const tabs = [
    { id: 'attendance', label: 'Attendance', icon: <Activity size={14} /> },
    { id: 'leaves', label: 'Leaves', icon: <FileText size={14} /> },
    ...(isAdmin ? [
      { id: 'permissions', label: 'Permissions', icon: <Clock size={14} /> },
      { id: 'sundays', label: 'Sundays', icon: <ShieldCheck size={14} /> }
    ] : []),
  ];

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="mx-auto max-w-7xl space-y-8 p-8"
    >
      <div className="flex items-center justify-between">
        <Breadcrumb items={[{ label: 'Attendance', path: null }]} />
        <button
          onClick={() => loadAllData({ showSpinner: true })}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#1a2744] shadow-sm border border-slate-100 hover:bg-slate-50 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </div>

      <div>
        <h1 className="text-4xl font-black tracking-tight text-[#1a2744] uppercase mb-1">Attendance Desk</h1>
        <p className="text-sm text-slate-500 font-medium">Logged in as <span className="text-[#1a2744] font-bold">{profile?.full_name}</span> • {format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* PUNCH SECTION */}
      {!isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            {loadingPunch ? (
              <div className="h-48 rounded-3xl bg-white border border-slate-100 animate-pulse flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-32 bg-slate-100 rounded-lg"></div>
                  <div className="h-4 w-48 bg-slate-50 rounded-lg"></div>
                </div>
              </div>
            ) : (
              <div className="h-full rounded-3xl border border-slate-100 bg-white p-8 shadow-sm relative overflow-hidden group">
                {/* Decoration */}
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Activity size={120} />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="space-y-4 text-center md:text-left">
                    <div>
                      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Session</h2>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className={`text-4xl font-black tracking-tighter ${isPunchedIn && !isPunchedOut ? 'text-[#D32F2F]' : 'text-[#1a2744]'}`}>
                          {isPunchedIn && !isPunchedOut ? formatElapsedTime(elapsed) : '--:--:--'}
                        </span>
                        {isPunchedIn && !isPunchedOut && <span className="animate-pulse text-xs font-black text-red-500 uppercase italic">Active</span>}
                      </div>
                    </div>
                    {isPunchedIn && (
                      <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500">
                        <div className="flex items-center gap-2"><LogIn size={14} /> In: {format(punchInTime, 'hh:mm a')}</div>
                        {isPunchedOut && <div className="flex items-center gap-2 text-emerald-600"><LogOut size={14} /> Out: {format(punchOutTime, 'hh:mm a')}</div>}
                      </div>
                    )}
                  </div>

                  {!isPunchedIn ? (
                    <div className="flex flex-col gap-4 w-full md:w-auto">
                      <div className="flex bg-slate-50 p-1 rounded-xl">
                        {['Main Office', 'Showroom'].map(loc => (
                          <button
                            key={loc}
                            onClick={() => setSelectedOffice(loc)}
                            className={`flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedOffice === loc ? 'bg-white text-[#1a2744] shadow-sm' : 'text-slate-400'}`}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handlePunchIn}
                        className="flex items-center justify-center gap-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-emerald-200 transition-all hover:-translate-y-1 active:scale-95"
                      >
                        <LogIn size={20} />
                        PUNCH IN NOW
                      </button>
                    </div>
                  ) : !isPunchedOut ? (
                    <button
                      onClick={handlePunchOut}
                      className="flex items-center justify-center gap-2 bg-[#D32F2F] hover:bg-[#B71C1C] text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-red-200 transition-all hover:-translate-y-1 active:scale-95 w-full md:w-auto"
                    >
                      <LogOut size={20} />
                      FINISH DAY (PUNCH OUT)
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-100 px-6 py-4 rounded-2xl text-emerald-700">
                      <CheckCircle className="text-emerald-500" size={32} />
                      <div>
                        <p className="text-sm font-black uppercase tracking-widest">Shift Completed</p>
                        <p className="text-xs font-medium opacity-80">You have completed your shift for today.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-4 h-full">
            <div className="bg-[#1a2744] h-full rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
               <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">My Work Location</h3>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-lg"><MapPin size={20} /></div>
                      <div>
                        <p className="text-lg font-black tracking-tight">{profile?.work_location || 'Office'}</p>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none">PRIMARY ASSIGNMENT</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                       <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Session Type</p>
                       <p className="text-sm font-bold mt-1">Full Day</p>
                    </div>
                    <div className="flex-1">
                       <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Shift Hours</p>
                       <p className="text-sm font-bold mt-1">09:00 - 18:00</p>
                    </div>
                  </div>
               </div>
               <div className="absolute -bottom-6 -right-6 opacity-10">
                 <ShieldCheck size={120} />
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN TABS */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all shrink-0 ${
              tab === item.id ? 'bg-[#1a2744] text-white shadow-xl translate-y-[-2px]' : 'bg-white text-slate-400 hover:text-slate-900 shadow-sm border border-slate-50'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <MotionDiv
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AttendanceLoadingState activeTab={tab} isAdmin={isAdmin} />
          </MotionDiv>
        ) : (
          <MotionDiv
            key={tab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'attendance' && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm overflow-hidden relative">
                  <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 uppercase">Monthly Track</h2>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">{format(currentMonth, 'MMMM yyyy')} Summary</p>
                    </div>
                    <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                      <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-xl border border-transparent p-2 text-slate-400 hover:text-[#1a2744] transition-colors"><ChevronLeft size={16} /></button>
                      <span className="px-6 flex items-center text-xs font-black uppercase tracking-widest text-[#1a2744]">{format(currentMonth, 'MMM yyyy')}</span>
                      <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-xl border border-transparent p-2 text-slate-400 hover:text-[#1a2744] transition-colors"><ChevronRight size={16} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-4">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">{day}</div>
                    ))}
                    {eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).map((day) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const record = attendance.find((entry) => entry.date === dateKey);
                      const isToday = isSameDay(day, new Date());
                      const recordCheckIn = getCheckIn(record);
                      return (
                        <div
                          key={dateKey}
                          title={record ? `${record.status.toUpperCase()} - ${recordCheckIn ? format(parseISO(recordCheckIn), 'HH:mm') : 'No Punch'}` : 'No Record'}
                          className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-xs font-black transition-all group relative cursor-help ${
                            record?.status === 'present'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'
                              : isToday
                                ? 'bg-[#1a2744] text-white shadow-lg shadow-slate-200'
                                : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-transparent'
                          }`}
                        >
                          {format(day, 'd')}
                          {record?.status === 'present' && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <DataTable
                  columns={isAdmin ? ['Date', 'Employee', 'Location', 'In | Out', 'Status'] : ['Date', 'Location', 'In | Out', 'Status']}
                  rows={attendance.map((item) => [
                    format(parseISO(item.date), 'dd MMM yyyy'),
                    ...(isAdmin ? [
                      <div className="flex flex-col">
                        <span className="font-black text-[#1a2744] uppercase text-xs tracking-tight">{item.employees?.full_name || item.employee_id}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{item.employee_id}</span>
                      </div>
                    ] : []),
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">@{item.location || 'Office'}</span>,
                    <div className="font-bold tabular-nums">
                      {getCheckIn(item) ? format(parseISO(getCheckIn(item)), 'HH:mm') : '--:--'} | {getCheckOut(item) ? format(parseISO(getCheckOut(item)), 'HH:mm') : '--:--'}
                    </div>,
                    <StatusBadge status={item.status} />
                  ])}
                  emptyText="No attendance records were found for this month."
                />
              </div>
            )}

            {tab === 'leaves' && (
              <div className="space-y-4">
                {leaves.map((item) => (
                  <button
                    key={item.id}
                    data-leave-id={item.id}
                    onClick={() => setSelectedRecord(item)}
                    className={`w-full rounded-3xl border px-8 py-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden ${
                      String(item.id) === String(highlightId) ? 'border-amber-200 bg-amber-50 ring-2 ring-amber-100' : 'border-slate-100 bg-white'
                    }`}
                  >
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-5">
                         <div className={`p-4 rounded-2xl font-black text-center min-w-[60px] ${item.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <p className="text-xl leading-none">{format(parseISO(item.start_date), 'dd')}</p>
                            <p className="text-[10px] uppercase tracking-widest mt-1">{format(parseISO(item.start_date), 'MMM')}</p>
                         </div>
                         <div>
                            <h3 className="text-lg font-black text-[#1a2744] uppercase tracking-tighter">{item.employees?.full_name || profile?.full_name}</h3>
                            <div className="mt-1 flex items-center gap-3">
                              <span className="text-xs font-black text-sky-600 uppercase tracking-widest">{item.leave_type}</span>
                              <span className="text-slate-200">•</span>
                              <span className="text-xs font-bold text-slate-400 italic">
                                {format(parseISO(item.start_date), 'dd MMM')} - {format(parseISO(item.end_date), 'dd MMM yyyy')}
                              </span>
                            </div>
                         </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <StatusBadge status={item.status} />
                        <p className="mt-2 text-[10px] font-black uppercase text-slate-300 tracking-[0.2em]">Click to track status</p>
                      </div>
                    </div>
                  </button>
                ))}
                {!leaves.length && <EmptyState text="No leave records found." />}
              </div>
            )}

            {tab === 'permissions' && (
              <DataTable
                columns={['Employee', 'Date', 'Time Window', 'Duration', 'Status']}
                rows={permissions.map((item) => [
                  <div className="font-black text-[#1a2744] uppercase text-xs tracking-tight">{item.employees?.full_name || item.employee_id}</div>,
                  <div className="font-bold text-slate-500">{format(parseISO(item.date), 'dd MMM yyyy')}</div>,
                  <div className="font-bold tabular-nums text-slate-700 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 inline-block">
                    {String(item.start_time || '--').slice(0, 5)} - {String(item.end_time || '--').slice(0, 5)}
                  </div>,
                  <div className="text-[11px] font-black uppercase text-slate-400 italic">{item.duration_minutes || '--'} mins</div>,
                  <StatusBadge status={item.status} />
                ])}
                emptyText="No permission requests were found."
              />
            )}

            {tab === 'sundays' && (
              <DataTable
                columns={['Employee', 'Requested Date', 'Punch In', 'Approval Status']}
                rows={sundays.map((item) => [
                  <div className="font-black text-[#1a2744] uppercase text-xs tracking-tight">{item.employees?.full_name || item.employee_id}</div>,
                  <div className="font-bold text-slate-500">{format(parseISO(item.date), 'dd MMM yyyy')}</div>,
                  <div className="font-bold tabular-nums text-emerald-600">{getCheckIn(item) ? format(parseISO(getCheckIn(item)), 'hh:mm a') : '--:--'}</div>,
                  <StatusBadge status={item.status} />
                ])}
                emptyText="No Sunday requests are waiting right now."
              />
            )}
          </MotionDiv>
        )}
      </AnimatePresence>

      <RequestStatusModal
        open={Boolean(selectedRecord)}
        request={selectedRecord}
        kind={selectedRecord?.leave_type ? 'leave' : 'permission'}
        fallbackName={profile?.full_name}
        onClose={() => setSelectedRecord(null)}
      />
    </MotionDiv>
  );
}

function StatusBadge({ status }) {
  const s = status?.toLowerCase() || 'pending';
  const colors = {
    pending: 'bg-orange-100 text-orange-600 border-orange-200',
    approved: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    rejected: 'bg-red-100 text-red-600 border-red-200'
  };
  return (
    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border ${colors[s] || colors.pending}`}>
      {status}
    </span>
  );
}

function DataTable({ columns, rows, emptyText }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          <tr>{columns.map((column) => <th key={column} className="px-6 py-5">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-slate-50/50 transition-colors">
              {row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} className="px-6 py-5 text-slate-600 font-medium">{cell}</td>)}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="px-6 py-24 text-center">
                <div className="flex flex-col items-center gap-3">
                   <AlertCircle className="text-slate-200" size={48} />
                   <p className="text-slate-400 font-black italic uppercase tracking-widest">{emptyText}</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 px-6 py-16 text-center text-slate-300">
       <div className="flex flex-col items-center gap-3">
          <FileText size={48} className="opacity-20" />
          <p className="font-black italic uppercase tracking-widest">{text}</p>
       </div>
    </div>
  );
}

function AttendanceLoadingState({ activeTab, isAdmin }) {
  if (activeTab === 'attendance') {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <SkeletonBlock className="h-6 w-48 rounded-full" />
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
              <SkeletonBlock className="h-10 w-36 rounded-xl" />
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: 31 }).map((_, index) => (
              <SkeletonBlock key={index} className="aspect-square rounded-2xl" />
            ))}
          </div>
        </div>
        <TableSkeleton columns={isAdmin ? 5 : 4} rows={6} />
      </div>
    );
  }

  if (activeTab === 'leaves') {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-24 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  return <TableSkeleton columns={5} rows={6} />;
}
