import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supabase;
import 'supabase_config.dart';

class AuthService {
  final supabase.SupabaseClient _client = SupabaseConfig.client;

  supabase.User? get currentUser => _client.auth.currentUser;

  Stream<supabase.AuthState> get authStateChanges =>
      _client.auth.onAuthStateChange;

  Future<supabase.AuthResponse> signInWithEmailPassword(
    String email,
    String password,
  ) async {
    try {
      debugPrint('AuthService: attempting login for $email');
      final response = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );
      debugPrint('AuthService: login success for ${response.user?.id}');
      return response;
    } catch (e) {
      debugPrint('AuthService: login error: $e');
      if (e is supabase.AuthException) {
        throw e.message;
      }
      throw e.toString();
    }
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  Future<Map<String, dynamic>?> fetchProfile(String userId) async {
    try {
      final response = await _client
          .from('profiles')
          .select('*, employees(*)')
          .eq('id', userId)
          .single();
      return response;
    } catch (e) {
      return null;
    }
  }
}
