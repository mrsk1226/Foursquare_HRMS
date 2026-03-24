import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/auth_service.dart';

part 'auth_event.dart';
part 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthService authService;

  AuthBloc({required this.authService}) : super(AuthInitial()) {
    on<AuthCheckRequested>((event, emit) async {
      try {
        final user = authService.currentUser;
        if (user != null) {
          final profile = await authService.fetchProfile(user.id);
          emit(AuthAuthenticated(user: user, profile: profile));
        } else {
          emit(AuthUnauthenticated());
        }
      } catch (_) {
        emit(AuthUnauthenticated());
      }
    });

    on<AuthLoginRequested>((event, emit) async {
      emit(AuthLoading());
      try {
        final response = await authService.signInWithEmailPassword(event.email, event.password);
        if (response.user != null) {
          final profile = await authService.fetchProfile(response.user!.id);
          emit(AuthAuthenticated(user: response.user!, profile: profile));
        } else {
          emit(const AuthError(message: 'Login failed'));
        }
      } catch (e) {
        emit(AuthError(message: e.toString()));
      }
    });

    on<AuthLogoutRequested>((event, emit) async {
      emit(AuthLoading());
      await authService.signOut();
      emit(AuthUnauthenticated());
    });
  }
}
