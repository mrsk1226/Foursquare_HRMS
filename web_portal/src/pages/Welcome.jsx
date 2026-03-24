import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, differenceInCalendarDays, isWithinInterval } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase_client';
import { Plus, Calendar, Gift, Star, ArrowRight } from 'lucide-react';

const Welcome = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  const isAdminOrHR = profile?.role === 'admin' || profile?.role === 'hr';

  useEffect(() => {
    async function fetchEmployeeAndEvents() {
      if (!profile?.employee_id) return;
      setLoadingEvents(true);
      try {
        const { data: emp, error: empErr } = await supabase
          .from('employees')
          .select('*')
          .eq('employee_id', profile.employee_id)
          .maybeSingle();
        if (!empErr && emp) {
          setEmployee(emp);
        }

        const today = new Date();
        const endDate = addDays(today, 30);

        const { data: allEmployees, error: listErr } = await supabase
          .from('employees')
          .select('full_name, dob, join_date');

        if (listErr || !allEmployees) {
          setEvents([]);
          return;
        }

        const upcoming = [];

        allEmployees.forEach((e) => {
          if (e.dob) {
            const dobDate = new Date(e.dob);
            const thisYearBirthday = new Date(
              today.getFullYear(),
              dobDate.getMonth(),
              dobDate.getDate()
            );
            if (
              isWithinInterval(thisYearBirthday, {
                start: today,
                end: endDate,
              })
            ) {
              upcoming.push({
                type: 'birthday',
                name: e.full_name,
                date: thisYearBirthday,
                description: `${e.full_name}'s Birthday`,
              });
            }
          }

          if (e.join_date) {
            const joinDate = new Date(e.join_date);
            const years = today.getFullYear() - joinDate.getFullYear();
            if (years >= 1) {
              const thisYearAnniv = new Date(
                today.getFullYear(),
                joinDate.getMonth(),
                joinDate.getDate()
              );
              if (
                isWithinInterval(thisYearAnniv, {
                  start: today,
                  end: endDate,
                })
              ) {
                upcoming.push({
                  type: 'anniversary',
                  name: e.full_name,
                  date: thisYearAnniv,
                  years,
                  description: `${e.full_name}'s ${years}th Work Anniversary`,
                });
              }
            }
          }
        });

        upcoming.sort((a, b) => a.date - b.date);
        setEvents(upcoming);
      } finally {
        setLoadingEvents(false);
      }
    }

    async function fetchAnnouncements() {
      setLoadingAnnouncements(true);
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        if (!error && data) {
          setAnnouncements(data);
        } else {
          setAnnouncements([]);
        }
      } finally {
        setLoadingAnnouncements(false);
      }
    }

    fetchEmployeeAndEvents();
    fetchAnnouncements();
  }, [profile?.employee_id]);

  const displayName = useMemo(() => {
    return (
      employee?.full_name ||
      profile?.full_name ||
      profile?.email?.split('@')[0] ||
      'Employee'
    );
  }, [employee, profile]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const handleFavouriteClick = (action) => {
    switch (action) {
      case 'add-employee':
        navigate('/employees?mode=add');
        break;
      case 'update-payroll':
      case 'process-payroll':
      case 'salary-statement':
        navigate('/payroll');
        break;
      default:
        break;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full space-y-6">
          <div className="bg-gradient-to-r from-[#EEF2FF] via-[#E0F2FE] to-[#F5F5FF] rounded-2xl flex flex-col md:flex-row items-center justify-between p-8 relative overflow-hidden">
            <div className="z-10 max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500 mb-2">
                Welcome to FSQ HR
              </p>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-2">
                {greeting}, {displayName.split(' ')[0]}!
              </h1>
              <p className="text-slate-600 text-sm md:text-base">
                Here&apos;s a quick view of what matters today – favourites, upcoming
                people events, and the latest updates from your organisation.
              </p>
            </div>
            <div className="mt-8 md:mt-0 relative z-10">
              <div className="w-40 h-40 rounded-full bg-white/70 border border-white shadow-lg flex items-center justify-center">
                <div className="w-28 h-28 rounded-[32px] bg-gradient-to-br from-[#1E3A5F] to-[#2E86AB] flex flex-col items-center justify-center text-white shadow-xl">
                  <span className="text-[10px] uppercase tracking-[0.25em] opacity-80">
                    FSQ
                  </span>
                  <span className="text-xl font-bold">HR</span>
                  <span className="mt-1 text-[10px] opacity-70">
                    Employee Hub
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 w-20 h-20 rounded-2xl bg-amber-300/80 flex items-center justify-center shadow-lg">
                <Calendar className="w-8 h-8 text-amber-800" />
              </div>
            </div>
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-100 rounded-full opacity-60" />
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-sky-100 rounded-full opacity-60" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#1E3A5F]">My Favourites</h2>
              {isAdminOrHR && (
                <button
                  type="button"
                  className="inline-flex items-center text-xs font-semibold text-[#2E86AB] hover:text-[#1E3A5F]"
                  onClick={() => navigate('/settings')}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Customise
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => handleFavouriteClick('add-employee')}
                className="h-32 bg-white rounded-xl flex flex-col items-center justify-center p-4 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-gray-800 leading-tight">
                  Add Employee
                </span>
                <span className="mt-1 text-[10px] text-gray-400">
                  Directory &amp; onboarding
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleFavouriteClick('update-payroll')}
                className="h-32 bg-white rounded-xl flex flex-col items-center justify-center p-4 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 mb-3">
                  <Calendar className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-gray-800 leading-tight">
                  Update Payroll Data
                </span>
                <span className="mt-1 text-[10px] text-gray-400">
                  Monthly salary inputs
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleFavouriteClick('process-payroll')}
                className="h-32 bg-white rounded-xl flex flex-col items-center justify-center p-4 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
                  <Star className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-gray-800 leading-tight">
                  Process Payroll
                </span>
                <span className="mt-1 text-[10px] text-gray-400">
                  Run &amp; approve payroll
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleFavouriteClick('salary-statement')}
                className="h-32 bg-white rounded-xl flex flex-col items-center justify-center p-4 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 mb-3">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-gray-800 leading-tight">
                  Salary statement
                </span>
                <span className="mt-1 text-[10px] text-gray-400">
                  View/download payslips
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center">
                <span className="w-1.5 h-5 rounded-full bg-emerald-400 mr-2" />
                Upcoming Events
              </h3>
              <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                Next 30 days
              </span>
            </div>

            <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
              {loadingEvents ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-12 bg-gray-100 rounded-lg"
                    />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  No birthdays or work anniversaries in the next 30 days.
                </div>
              ) : (
                events.map((event, idx) => {
                  const isBirthday = event.type === 'birthday';
                  const borderColor = isBirthday ? 'border-amber-400' : 'border-sky-500';
                  const emoji = isBirthday ? '🎂' : '⭐';
                  const label = isBirthday
                    ? `${event.name}'s Birthday`
                    : `${event.name}'s ${event.years}th Work Anniversary`;
                  return (
                    <div
                      key={`${event.type}-${event.name}-${idx}`}
                      className={`flex items-center gap-3 rounded-lg border-l-4 ${borderColor} bg-gray-50 px-3 py-2`}
                    >
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-lg">
                        {emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {label}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {format(event.date, 'dd MMM yyyy')} (
                          {differenceInCalendarDays(event.date, new Date())}{' '}
                          days)
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-gray-100 bg-slate-50/80">
              <div className="py-2 overflow-hidden">
                <div className="whitespace-nowrap animate-[marquee_18s_linear_infinite] text-[11px] text-slate-600 px-4">
                  Today&apos;s events scrolling smoothly • Celebrate your team&apos;s
                  milestones • Keep your people at the centre of everything •
                  Birthdays • Work anniversaries • Welcomes • Farewells •
                  Appreciation moments
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#1E3A5F]" />
                Latest Updates
              </h3>
              <button
                type="button"
                onClick={() => navigate('/announcements')}
                className="text-[11px] text-[#2E86AB] hover:text-[#1E3A5F] font-semibold"
              >
                View all
              </button>
            </div>
            <div className="p-4 space-y-3">
              {loadingAnnouncements ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-9 bg-gray-100 rounded"
                    />
                  ))}
                </div>
              ) : announcements.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">
                  No announcements yet. You&apos;re all caught up.
                </p>
              ) : (
                announcements.map((a) => {
                  const createdAt = a.created_at
                    ? new Date(a.created_at)
                    : null;
                  const dateLabel = createdAt
                    ? format(createdAt, 'dd MMM')
                    : '--';
                  const title = (a.title || '').length > 50
                    ? `${a.title.slice(0, 50)}...`
                    : a.title || '(Untitled)';
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => navigate('/announcements')}
                      className="w-full flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 text-left group"
                    >
                      <div className="min-w-[46px]">
                        <div className="bg-slate-100 rounded text-[10px] font-bold px-2 py-1 text-slate-600 text-center">
                          {dateLabel}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-800 group-hover:text-[#1E3A5F]">
                          {title}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {a.priority
                            ? `${a.priority} priority • Announcement`
                            : 'Announcement'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default Welcome;


