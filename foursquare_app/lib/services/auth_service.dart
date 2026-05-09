import 'supabase_config.dart';

class AuthService {
  AuthService({this.clearEmployeeIdOnSignOut = true});

  final bool clearEmployeeIdOnSignOut;

  dynamic get currentUser => SupabaseConfig.client.auth.currentUser;

  Future<dynamic> signInWithEmailPassword(String email, String password) async {
    return SupabaseConfig.client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<Map<String, dynamic>?> fetchProfile(String userId) async {
    try {
      return await SupabaseConfig.getProfile(forceRefresh: true);
    } catch (_) {
      return null;
    }
  }

  Future<void> signOut() async {
    if (clearEmployeeIdOnSignOut) {
      SupabaseConfig.clearSessionCache();
    }
    await SupabaseConfig.client.auth.signOut();
  }
}
