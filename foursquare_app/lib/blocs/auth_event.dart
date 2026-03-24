part of 'auth_bloc.dart';

abstract class HRMSAuthEvent extends Equatable {
  const HRMSAuthEvent();

  @override
  List<Object> get props => [];
}

class HRMSAuthCheckRequested extends HRMSAuthEvent {}

class HRMSAuthLoginRequested extends HRMSAuthEvent {
  final String email;
  final String password;

  const HRMSAuthLoginRequested(this.email, this.password);

  @override
  List<Object> get props => [email, password];
}

class HRMSAuthLogoutRequested extends HRMSAuthEvent {}
