part of 'auth_bloc.dart';

abstract class HRMSAuthState extends Equatable {
  const HRMSAuthState();
  
  @override
  List<Object?> get props => [];
}

class HRMSAuthInitial extends HRMSAuthState {}

class HRMSAuthLoading extends HRMSAuthState {}

class HRMSAuthAuthenticated extends HRMSAuthState {
  final User user;
  final Map<String, dynamic>? profile;

  const HRMSAuthAuthenticated({required this.user, this.profile});

  @override
  List<Object?> get props => [user, profile];
}

class HRMSAuthUnauthenticated extends HRMSAuthState {}

class HRMSAuthError extends HRMSAuthState {
  final String message;

  const HRMSAuthError({required this.message});

  @override
  List<Object> get props => [message];
}
