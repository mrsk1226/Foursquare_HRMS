import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';

import 'blocs/auth_bloc.dart';
import 'services/auth_service.dart';
import 'services/supabase_config.dart';
import 'screens/announcements_screen.dart';
import 'screens/attendance_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/hr_contact_screen.dart';
import 'screens/leave_screen.dart';
import 'screens/login_screen.dart';
import 'screens/payslip_screen.dart';
import 'screens/profile_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseConfig.initialize();

  runApp(const FoursquareHRMSApp());
}

class FoursquareHRMSApp extends StatelessWidget {
  const FoursquareHRMSApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (context) => AuthBloc(authService: AuthService())..add(AuthCheckRequested()),
        ),
      ],
      child: MaterialApp(
        title: 'Foursquare HRMS',
        debugShowCheckedModeBanner: false,
        routes: {
          '/login': (_) => const LoginScreen(),
          '/dashboard': (_) => const DashboardScreen(),
          '/attendance': (_) => const AttendanceScreen(),
          '/leave': (_) => const LeaveScreen(),
          '/profile': (_) => const ProfileScreen(),
          '/payslip': (_) => const PayslipScreen(),
          '/announcements': (_) => const AnnouncementsScreen(),
          '/hr-contact': (_) => const HRContactScreen(),
        },
        theme: ThemeData(
          primaryColor: const Color(0xFF1E3A5F),
          scaffoldBackgroundColor: const Color(0xFFF5F6FA),
          colorScheme: ColorScheme.fromSwatch().copyWith(
            primary: const Color(0xFF1E3A5F),
            secondary: const Color(0xFF2A4D7C),
          ),
          textTheme: GoogleFonts.interTextTheme(
            Theme.of(context).textTheme,
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1E3A5F),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8.0),
              ),
              padding: const EdgeInsets.symmetric(vertical: 16.0),
            ),
          ),
        ),
        home: const AuthWrapper(),
      ),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        if (state is AuthAuthenticated) {
          return const DashboardScreen();
        } else if (state is AuthUnauthenticated) {
          return const LoginScreen();
        }
        return const Scaffold(
          body: Center(
            child: CircularProgressIndicator(color: Color(0xFF1E3A5F)),
          ),
        );
      },
    );
  }
}
