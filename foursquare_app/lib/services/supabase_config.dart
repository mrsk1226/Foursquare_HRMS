import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseConfig {
  static const String supabaseUrl = 'https://pycsrmvhztxihjdihbve.supabase.co';

  static const String supabaseAnonKey =
      'sb_publishable_Un8l50_1wRv3099cNjmZvA_q6Wm_im_';

  static bool _initialized = false;
  static StreamSubscription<AuthState>? _authSubscription;

  static Future<void> initialize() async {
    if (_initialized) {
      return;
    }

    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,

      authOptions: const FlutterAuthClientOptions(autoRefreshToken: true),

      realtimeClientOptions: const RealtimeClientOptions(
        eventsPerSecond: 10,
        timeout: Duration(seconds: 30),
      ),
    );

    _initialized = true;

    _authSubscription?.cancel();
    _authSubscription = client.auth.onAuthStateChange.listen((data) {
      final event = data.event;

      if (event == AuthChangeEvent.signedOut) {
        clearSessionCache();
      }
    });
  }

  static SupabaseClient get client => Supabase.instance.client;

  static String? _cachedEmployeeId;
  static Map<String, dynamic>? _cachedProfile;

  static DateTime? _profileFetchedAt;
  static DateTime? _lastNetworkToastAt;

  // ------------------------------
  // SAFE TIMEOUT
  // ------------------------------

  static Future<T> withTimeout<T>(
    Future<T> future, {
    Duration timeout = const Duration(seconds: 30),
  }) async {
    try {
      return await future.timeout(timeout);
    } on TimeoutException {
      throw Exception('Connection timeout');
    }
  }

  // ------------------------------
  // ERROR NORMALIZATION
  // ------------------------------

  static String normalizeError(Object error) {
    final raw = error.toString().toLowerCase();

    if (raw.contains('timeout')) {
      return 'Server taking too long. Retrying...';
    }

    if (raw.contains('socketexception') ||
        raw.contains('failed host lookup') ||
        raw.contains('network')) {
      return 'Network unstable. Reconnecting...';
    }

    if (raw.contains('jwt')) {
      return 'Session expired. Please login again.';
    }

    return 'Something went wrong.';
  }

  // ------------------------------
  // PREVENT TOAST SPAM
  // ------------------------------

  static bool shouldShowNetworkMessage() {
    final now = DateTime.now();

    if (_lastNetworkToastAt == null ||
        now.difference(_lastNetworkToastAt!) > const Duration(seconds: 45)) {
      _lastNetworkToastAt = now;
      return true;
    }

    return false;
  }

  // ------------------------------
  // EMPLOYEE ID
  // ------------------------------

  static Future<String?> getEmployeeId({bool forceRefresh = false}) async {
    if (!forceRefresh && _cachedEmployeeId != null) {
      return _cachedEmployeeId;
    }

    final user = client.auth.currentUser;

    if (user == null) {
      return null;
    }

    final profile = await withTimeout(
      client.from('profiles').select('employee_id').eq('id', user.id).single(),
    );

    _cachedEmployeeId = profile['employee_id'];

    return _cachedEmployeeId;
  }

  // ------------------------------
  // PROFILE CACHE
  // ------------------------------

  static Future<Map<String, dynamic>?> getProfile({
    bool forceRefresh = false,
  }) async {
    final cacheValid =
        _cachedProfile != null &&
        _profileFetchedAt != null &&
        DateTime.now().difference(_profileFetchedAt!) <
            const Duration(minutes: 5);

    if (!forceRefresh && cacheValid) {
      return _cachedProfile;
    }

    final user = client.auth.currentUser;

    if (user == null) {
      return null;
    }

    final profile = await withTimeout(
      client
          .from('profiles')
          .select('employee_id, role')
          .eq('id', user.id)
          .maybeSingle(),
    );

    _cachedProfile = profile;
    _profileFetchedAt = DateTime.now();

    _cachedEmployeeId = profile?['employee_id'];

    return profile;
  }

  // ------------------------------
  // INTERNET CHECK
  // ------------------------------

  static Future<bool> isConnected() async {
    try {
      await client.from('profiles').select('id').limit(1);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ------------------------------
  // CLEAR CACHE
  // ------------------------------

  static void clearSessionCache() {
    _cachedEmployeeId = null;
    _cachedProfile = null;
    _profileFetchedAt = null;
    _lastNetworkToastAt = null;
  }
}
