import React, { useEffect, useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase_client';
import { useAuth } from '../context/AuthContext';
import { Activity, ChevronLeft, ChevronRight, Clock, FileText, ShieldCheck } from 'lucide-react';
import RequestStatusModal from '../components/RequestStatusModal';
import { ListSkeleton, SkeletonBlock, TableSkeleton } from '../components/ui/LoadingSkeleton';

import { motion } from 'framer-motion';
import Breadcrumb from '../components/Breadcrumb';

export default function Attendance() {
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = ['admin', 'hr', 'md'].includes(profile?.role);

  const [tab, setTab] = useState(location.state?.tab || 'attendance');
  const [highlightId, setHighlightId] = useState(location.state?.highlightId || null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [sundays, setSundays] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    if (location.state?.tab) setTab(location.state.tab);
    if (location.state?.highlightId) setHighlightId(String(location.state.highlightId));
  }, [location.state]);

  useEffect(() => {
    if (!profile?.employee_id) return;
    loadData();

    const channel = supabase.channel(`attendance-realtime-${profile.employee_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs', filter: isAdmin ? undefined : `employee_id=eq.${profile.employee_id}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests', filter: isAdmin ? undefined : `employee_id=eq.${profile.employee_id}` }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permissions', filter: isAdmin ? undefined : `employee_id=eq.${profile.employee_id}` }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.employee_id, tab, currentMonth, isAdmin, loadData]);

  useEffect(() => {
    if (!highlightId || tab !== 'leaves') return;
    const node = document.querySelector(`[data-leave-id="${highlightId}"]`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeoutId = window.setTimeout(() => setHighlightId(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [highlightId, tab, leaves]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'attendance') await fetchAttendance();
      if (tab === 'leaves') await fetchLeaves();
      if (tab === 'permissions') await fetchPermissions();
      if (tab === 'sundays') await fetchSundays();
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    const firstDay = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const lastDay = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    let query = supabase.from('attendance_logs').select('*, employees(full_name)').gte('date', firstDay).lte('date', lastDay).order('date', { ascending: false });
    if (!isAdmin) query = query.eq('employee_id', profile.employee_id);
    const { data } = await query;
    setAttendance(data || []);
  };

  const fetchLeaves = async () => {
    let query = supabase.from('leave_requests').select('*, employees(full_name, department)').order('created_at', { ascending: false });
    if (!isAdmin) query = query.eq('employee_id', profile.employee_id);
    const { data } = await query;
    setLeaves(data || []);
  };

  const fetchPermissions = async () => {
    let query = supabase.from('permissions').select('*, employees(full_name, department)').order('created_at', { ascending: false });
    if (!isAdmin) query = query.eq('employee_id', profile.employee_id);
    const { data } = await query;
    setPermissions(data || []);
  };

  const fetchSundays = async () => {
    const { data } = await supabase.from('sunday_punch_requests').select('*, employees(full_name)').order('created_at', { ascending: false });
    setSundays(data || []);
  };

  const tabs = [
    { id: 'attendance', label: 'Attendance', icon: <Activity size={14} /> },
    { id: 'leaves', label: 'Leaves', icon: <FileText size={14} /> },
    ...(isAdmin ? [{ id: 'permissions', label: 'Permissions', icon: <Clock size={14} /> }, { id: 'sundays', label: 'Sundays', icon: <ShieldCheck size={14} /> }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="mx-auto max-w-7xl space-y-8 p-8"
    >
      <Breadcrumb items={[{ label: 'Attendance', path: null }]} />
      <div>
        <h1 className="text-4xl font-black tracking-tight text-[#1a2744]">Attendance</h1>
        <p className="mt-2 text-sm text-slate-500">Track attendance, leave history, permissions, and Sunday requests.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${tab === item.id ? 'bg-[#1a2744] text-white shadow-xl' : 'bg-white text-slate-400 hover:text-slate-900'
              }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AttendanceLoadingState activeTab={tab} isAdmin={isAdmin} />
      ) : (
        <>
          {tab === 'attendance' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-900">Attendance Calendar</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-xl border border-slate-200 p-2"><ChevronLeft size={16} /></button>
                    <span className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">{format(currentMonth, 'MMMM yyyy')}</span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-xl border border-slate-200 p-2"><ChevronRight size={16} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="text-center text-[10px] font-black uppercase text-slate-400">{day}</div>)}
                  {eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const record = attendance.find((entry) => entry.date === dateKey);
                    return (
                      <div key={dateKey} className={`aspect-square rounded-2xl flex items-center justify-center text-sm font-bold ${record?.status === 'present' ? 'bg-emerald-50 text-emerald-700' : isSameDay(day, new Date()) ? 'ring-2 ring-[#1a2744]' : 'bg-slate-50 text-slate-500'}`}>
                        {format(day, 'd')}
                      </div>
                    );
                  })}
                </div>
              </div>

              <DataTable
                columns={isAdmin ? ['Date', 'Employee', 'Check In', 'Status'] : ['Date', 'Check In', 'Status']}
                rows={attendance.map((item) => [
                  format(parseISO(item.date), 'dd MMM yyyy'),
                  ...(isAdmin ? [item.employees?.full_name || item.employee_id] : []),
                  item.check_in ? format(parseISO(item.check_in), 'HH:mm') : '-',
                  item.status,
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
                  className={`w-full rounded-3xl border px-5 py-5 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${String(item.id) === String(highlightId) ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white'
                    }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-[#1a2744]">{item.employees?.full_name || profile?.full_name || item.employee_id}</h3>
                      <p className="mt-1 text-sm font-semibold text-sky-600">{item.leave_type}</p>
                      <p className="mt-1 text-sm text-slate-500">{format(parseISO(item.start_date), 'dd MMM yyyy')} - {format(parseISO(item.end_date), 'dd MMM yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Status</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">{item.status}</p>
                    </div>
                  </div>
                </button>
              ))}
              {!leaves.length && <EmptyState text="No leave records found." />}
            </div>
          )}

          {tab === 'permissions' && (
            <DataTable
              columns={['Employee', 'Date', 'Time', 'Status']}
              rows={permissions.map((item) => [
                item.employees?.full_name || item.employee_id,
                format(parseISO(item.date), 'dd MMM yyyy'),
                `${String(item.start_time || '--').slice(0, 5)} - ${String(item.end_time || '--').slice(0, 5)}`,
                item.status,
              ])}
              emptyText="No permission requests were found."
            />
          )}

          {tab === 'sundays' && (
            <DataTable
              columns={['Employee', 'Date', 'Check In', 'Status']}
              rows={sundays.map((item) => [
                item.employees?.full_name || item.employee_id,
                format(parseISO(item.date), 'dd MMM yyyy'),
                item.check_in ? format(parseISO(item.check_in), 'hh:mm a') : '-',
                item.status,
              ])}
              emptyText="No Sunday requests are waiting right now."
            />
          )}
        </>
      )}

      <RequestStatusModal
        open={Boolean(selectedRecord)}
        request={selectedRecord}
        kind={selectedRecord?.leave_type ? 'leave' : 'permission'}
        fallbackName={profile?.full_name}
        onClose={() => setSelectedRecord(null)}
      />
    </motion.div>
  );
}

function DataTable({ columns, rows, emptyText }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          <tr>{columns.map((column) => <th key={column} className="px-5 py-4">{column}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-slate-50">
              {row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} className="px-5 py-4 text-slate-700">{cell}</td>)}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-400">{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-400">{text}</div>;
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
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, index) => (
              <SkeletonBlock key={index} className="aspect-square rounded-2xl" />
            ))}
          </div>
        </div>
        <TableSkeleton columns={isAdmin ? 4 : 3} rows={6} />
      </div>
    );
  }

  if (activeTab === 'leaves') {
    return <ListSkeleton items={4} />;
  }

  return <TableSkeleton columns={4} rows={6} />;
}
