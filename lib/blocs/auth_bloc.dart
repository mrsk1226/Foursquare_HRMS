import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'auth_event.dart';
part 'auth_state.dart';

class AuthBloc extends Bloc<HRMSAuthEvent, HRMSAuthState> {
  final AuthService authService;

  AuthBloc({required this.authService}) : super(HRMSAuthInitial()) {
    on<HRMSAuthCheckRequested>((event, emit) async {
      try {
        final prefs = await SharedPreferences.getInstance();
        final isLoggedIn = prefs.getBool('is_logged_in') ?? false;
        
        final user = authService.currentUser;
        if (isLoggedIn && user != null) {
          final profile = await authService.fetchProfile(user.id);
          emit(HRMSAuthAuthenticated(user: user, profile: profile));
        } else {
          emit(HRMSAuthUnauthenticated());
        }
      } catch (_) {
        emit(HRMSAuthUnauthenticated());
      }
    });

    on<HRMSAuthLoginRequested>((event, emit) async {
      emit(HRMSAuthLoading());
      try {
        final response = await authService.signInWithEmailPassword(event.email, event.password);
        if (response.user != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setBool('is_logged_in', true);
          
          final profile = await authService.fetchProfile(response.user!.id);
          emit(HRMSAuthAuthenticated(user: response.user!, profile: profile));
        } else {
          emit(const HRMSAuthError(message: 'Login failed'));
        }
      } catch (e) {
        emit(HRMSAuthError(message: e.toString()));
      }
    });

    on<HRMSAuthLogoutRequested>((event, emit) async {
      emit(HRMSAuthLoading());
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_logged_in', false);
      await authService.signOut();
      emit(HRMSAuthUnauthenticated());
    });
  }
}
