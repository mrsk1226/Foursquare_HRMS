import 'dart:async';
import 'dart:convert';

import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'supabase_config.dart';

class AttendanceService {
  AttendanceService._();

  static const _table = 'attendance_logs';
  static const _selectFields =
      'id, employee_id, check_in, check_out, date, status, lat, lng';
  static const _queueKey = 'attendance_punch_queue_v1';

  static String todayKey([DateTime? now]) {
    return DateFormat('yyyy-MM-dd').format(now ?? DateTime.now());
  }

  static DateTime? checkInOf(Map<String, dynamic>? row) {
    final raw = row?['check_in']?.toString();
    return raw == null || raw.isEmpty ? null : DateTime.tryParse(raw)?.toLocal();
  }

  static DateTime? checkOutOf(Map<String, dynamic>? row) {
    final raw = row?['check_out']?.toString();
    return raw == null || raw.isEmpty ? null : DateTime.tryParse(raw)?.toLocal();
  }

  static Future<Map<String, dynamic>?> fetchToday(String employeeId) {
    return SupabaseConfig.withTimeout(
      SupabaseConfig.client
          .from(_table)
          .select(_selectFields)
          .eq('employee_id', employeeId)
          .eq('date', todayKey())
          .maybeSingle(),
    );
  }

  static Future<List<Map<String, dynamic>>> fetchMonth(
    String employeeId,
    DateTime month,
  ) async {
    final firstDay = DateFormat('yyyy-MM-dd').format(
      DateTime(month.year, month.month),
    );
    final lastDay = DateFormat('yyyy-MM-dd').format(
      DateTime(month.year, month.month + 1, 0),
    );

    final rows = await SupabaseConfig.withTimeout(
      SupabaseConfig.client
          .from(_table)
          .select(_selectFields)
          .eq('employee_id', employeeId)
          .gte('date', firstDay)
          .lte('date', lastDay)
          .order('date', ascending: false),
    );

    return (rows as List)
        .map((row) => Map<String, dynamic>.from(row as Map))
        .toList();
  }

  static Future<Map<String, dynamic>> punchIn(
    String employeeId, {
    double? lat,
    double? lng,
  }) async {
    final existing = await fetchToday(employeeId);
    if (existing?['check_in'] != null) {
      return existing!;
    }

    final now = DateTime.now();
    final payload = <String, dynamic>{
      'employee_id': employeeId,
      'check_in': now.toUtc().toIso8601String(),
      'date': todayKey(now),
      'status': 'present',
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
    };

    try {
      final inserted = await SupabaseConfig.withTimeout(
        SupabaseConfig.client
            .from(_table)
            .insert(payload)
            .select(_selectFields)
            .single(),
      );
      return Map<String, dynamic>.from(inserted as Map);
    } on PostgrestException catch (error) {
      if (error.code == '23505') {
        final fresh = await fetchToday(employeeId);
        if (fresh != null) return fresh;
      }
      rethrow;
    } catch (_) {
      await _queue({'type': 'punch_in', ...payload});
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> punchOut(
    String employeeId, {
    double? lat,
    double? lng,
  }) async {
    final existing = await fetchToday(employeeId);
    if (existing == null || existing['check_in'] == null) {
      throw StateError('No open attendance record found for today.');
    }
    if (existing['check_out'] != null) {
      return existing;
    }

    final now = DateTime.now().toUtc().toIso8601String();
    final payload = <String, dynamic>{
      'check_out': now,
      'status': 'present',
    };

    try {
      final updated = await SupabaseConfig.withTimeout(
        SupabaseConfig.client
            .from(_table)
            .update(payload)
            .eq('id', existing['id'])
            .isFilter('check_out', null)
            .select(_selectFields)
            .maybeSingle(),
      );

      if (updated != null) {
        return Map<String, dynamic>.from(updated as Map);
      }

      final fresh = await fetchToday(employeeId);
      if (fresh != null) return fresh;
      throw StateError('Attendance record changed while punching out.');
    } catch (_) {
      await _queue({
        'type': 'punch_out',
        'employee_id': employeeId,
        'date': todayKey(),
        'check_out': now,
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      });
      rethrow;
    }
  }

  static Future<void> flushQueuedPunches(String employeeId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_queueKey);
    if (raw == null || raw.isEmpty) return;

    final entries = (jsonDecode(raw) as List)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .where((item) => item['employee_id'] == employeeId)
        .toList();

    final remaining = <Map<String, dynamic>>[];
    for (final entry in entries) {
      try {
        if (entry['type'] == 'punch_in') {
          await punchIn(
            employeeId,
            lat: (entry['lat'] as num?)?.toDouble(),
            lng: (entry['lng'] as num?)?.toDouble(),
          );
        } else if (entry['type'] == 'punch_out') {
          await punchOut(employeeId);
        }
      } catch (_) {
        remaining.add(entry);
      }
    }

    await prefs.setString(_queueKey, jsonEncode(remaining));
  }

  static Future<void> _queue(Map<String, dynamic> entry) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_queueKey);
    final current = raw == null || raw.isEmpty
        ? <Map<String, dynamic>>[]
        : (jsonDecode(raw) as List)
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();

    current.add({...entry, 'queued_at': DateTime.now().toIso8601String()});
    await prefs.setString(_queueKey, jsonEncode(current.take(20).toList()));
  }
}
