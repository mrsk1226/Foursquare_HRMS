import { format } from 'date-fns';
import { supabase } from './supabase_client';

const SELECT_FIELDS = 'id, employee_id, check_in, check_out, date, status, lat, lng';

export const getCheckIn = (record) => record?.check_in || null;
export const getCheckOut = (record) => record?.check_out || null;

export function todayKey(date = new Date()) {
  return format(date, 'yyyy-MM-dd');
}

export async function withTimeout(queryPromise, timeoutMs = 15000) {
  const timed = new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });
  return Promise.race([queryPromise, timed]);
}

export function getBrowserPosition(timeout = 8000) {
  if (!navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}

export async function fetchTodayAttendance(employeeId) {
  if (!employeeId) return { data: null, error: null };

  return withTimeout(
    supabase
      .from('attendance_logs')
      .select(SELECT_FIELDS)
      .eq('employee_id', employeeId)
      .eq('date', todayKey())
      .maybeSingle(),
  );
}

export async function fetchAttendanceRange({ employeeId, firstDay, lastDay, isAdmin }) {
  let query = supabase
    .from('attendance_logs')
    .select('*, employees(full_name)')
    .gte('date', firstDay)
    .lte('date', lastDay)
    .order('date', { ascending: false });

  if (!isAdmin) query = query.eq('employee_id', employeeId);
  return withTimeout(query);
}

export async function punchIn(employeeId, position) {
  const existing = await fetchTodayAttendance(employeeId);
  if (existing.error) throw existing.error;
  if (existing.data?.check_in) return existing;

  const now = new Date();
  const coords = position?.coords;
  const payload = {
    employee_id: employeeId,
    check_in: now.toISOString(),
    date: todayKey(now),
    status: 'present',
    ...(coords ? { lat: coords.latitude, lng: coords.longitude } : {}),
  };

  const result = await withTimeout(
    supabase
      .from('attendance_logs')
      .insert(payload)
      .select(SELECT_FIELDS)
      .single(),
  );

  if (result.error?.code === '23505') {
    return fetchTodayAttendance(employeeId);
  }

  return result;
}

export async function punchOut(employeeId, todayRecord) {
  const existing = todayRecord?.id
    ? { data: todayRecord, error: null }
    : await fetchTodayAttendance(employeeId);

  if (existing.error) throw existing.error;
  if (!existing.data?.id || !existing.data?.check_in) {
    throw new Error('No open attendance record found for today.');
  }
  if (existing.data.check_out) return existing;

  const result = await withTimeout(
    supabase
      .from('attendance_logs')
      .update({ check_out: new Date().toISOString(), status: 'present' })
      .eq('id', existing.data.id)
      .is('check_out', null)
      .select(SELECT_FIELDS)
      .maybeSingle(),
  );

  if (!result.error && !result.data) {
    return fetchTodayAttendance(employeeId);
  }

  return result;
}

export function debounceRealtime(callback, delay = 350) {
  let timeoutId;
  return () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(callback, delay);
  };
}
