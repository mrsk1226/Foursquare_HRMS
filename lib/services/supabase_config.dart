import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseConfig {
  static const String supabaseUrl = 'https://pycsrmvhztxihjdihbve.supabase.co';
  static const String supabaseAnonKey = 'sb_publishable_Un8l50_1wRv3099cNjmZvA_q6Wm_im_';

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    );
  }

  static SupabaseClient get client => Supabase.instance.client;
}
