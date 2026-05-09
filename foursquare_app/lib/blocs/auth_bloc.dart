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
        final empId = prefs.getString('employee_id') ?? '';
        final user = authService.currentUser;

        if (empId.isNotEmpty && user != null) {
          // ✅ profiles table இல்லை — employees மட்டும்
          final emp = await authService.fetchProfile(user.id);
          emit(HRMSAuthAuthenticated(user: user, profile: emp));
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
        final response = await authService.signInWithEmailPassword(
          event.email,
          event.password,
        );
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
      await prefs.clear();
      await authService.signOut();
      emit(HRMSAuthUnauthenticated());
    });
  }
}
