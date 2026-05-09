import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseConfig {
  static const String supabaseUrl = 'https://pycsrmvhztxihjdihbve.supabase.co';
  static const String supabaseAnonKey =
      'sb_publishable_Un8l50_1wRv3099cNjmZvA_q6Wm_im_';

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      realtimeClientOptions: const RealtimeClientOptions(eventsPerSecond: 2),
    );
  }

  static SupabaseClient get client => Supabase.instance.client;

  static String? _cachedEmployeeId;
  static Map<String, dynamic>? _cachedProfile;
  static DateTime? _profileFetchedAt;
  static DateTime? _lastNetworkToastAt;

  static Future<T> withTimeout<T>(
    Future<T> future, {
    Duration timeout = const Duration(seconds: 15),
  }) {
    return future.timeout(
      timeout,
      onTimeout: () => throw TimeoutException('Request timeout'),
    );
  }

  static String normalizeError(Object error) {
    final raw = error.toString();
    if (raw.contains('Timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (raw.contains('SocketException') ||
        raw.contains('Failed host lookup') ||
        raw.contains('Network')) {
      return 'Network issue. Reconnecting...';
    }
    return 'Something went wrong. Please try again.';
  }

  static bool shouldShowNetworkMessage() {
    final now = DateTime.now();
    if (_lastNetworkToastAt == null ||
        now.difference(_lastNetworkToastAt!) > const Duration(seconds: 20)) {
      _lastNetworkToastAt = now;
      return true;
    }
    return false;
  }

  static Future<String?> getEmployeeId({bool forceRefresh = false}) async {
    if (!forceRefresh && _cachedEmployeeId != null) {
      return _cachedEmployeeId;
    }
    final user = client.auth.currentUser;
    if (user == null) return null;

    final profile = await withTimeout(
      client.from('profiles').select('employee_id').eq('id', user.id).single(),
    );
    _cachedEmployeeId = profile['employee_id'] as String?;
    return _cachedEmployeeId;
  }

  static Future<Map<String, dynamic>?> getProfile({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh &&
        _cachedProfile != null &&
        _profileFetchedAt != null &&
        DateTime.now().difference(_profileFetchedAt!) <
            const Duration(minutes: 5)) {
      return _cachedProfile;
    }
    final user = client.auth.currentUser;
    if (user == null) return null;
    final profile = await withTimeout(
      client
          .from('profiles')
          .select('employee_id, role')
          .eq('id', user.id)
          .maybeSingle(),
    );
    _cachedProfile = profile;
    _profileFetchedAt = DateTime.now();
    _cachedEmployeeId = profile?['employee_id'] as String?;
    return profile;
  }

  static void clearSessionCache() {
    _cachedEmployeeId = null;
    _cachedProfile = null;
    _profileFetchedAt = null;
    _lastNetworkToastAt = null;
  }
}
