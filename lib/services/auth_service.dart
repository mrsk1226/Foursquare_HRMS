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
      print('DEBUG: Attempting login for email: $email');
      final response = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );
      print('DEBUG: Login success for user: ${response.user?.id}');
      return response;
    } catch (e) {
      print('DEBUG: Login error: $e');
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
