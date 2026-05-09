import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'blocs/auth_bloc.dart';
import 'screens/announcement_details_screen.dart';
import 'screens/announcements_screen.dart';
import 'screens/attendance_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/hr_contact_screen.dart';
import 'screens/leave_screen.dart';
import 'screens/login_screen.dart';
import 'screens/module_placeholder_screen.dart';
import 'screens/payslip_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/splash_screen.dart';
import 'services/auth_service.dart';
import 'services/supabase_config.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseConfig.initialize();
  await SharedPreferences.getInstance();

  runApp(const MyApp());
}

final GlobalKey<NavigatorState> _appNavigatorKey = GlobalKey<NavigatorState>();

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  static const Color primaryBlue = Color(0xFF1E3A5F);
  static const Color scaffoldTint = Color(0xFFF5F7FB);

  @override
  Widget build(BuildContext context) {
    final baseTextTheme = GoogleFonts.interTextTheme();
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primaryBlue,
      primary: primaryBlue,
      secondary: const Color(0xFF2E86AB),
      surface: Colors.white,
      brightness: Brightness.light,
    );

    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (_) => AuthBloc(authService: AuthService())
            ..add(HRMSAuthCheckRequested()),
        ),
      ],
      child: BlocListener<AuthBloc, HRMSAuthState>(
        listenWhen: (previous, current) =>
            previous is! HRMSAuthInitial &&
            current is HRMSAuthUnauthenticated,
        listener: (context, state) {
          _appNavigatorKey.currentState?.pushNamedAndRemoveUntil(
            '/login',
            (route) => false,
          );
        },
        child: MaterialApp(
          title: 'FSQ HRMS',
          navigatorKey: _appNavigatorKey,
          debugShowCheckedModeBanner: false,
          routes: {
            '/splash': (_) => const SplashScreen(),
            '/login': (_) => const LoginScreen(),
            '/dashboard': (_) => const MainScreen(initialIndex: 0),
            '/employees': (_) => const EmployeesScreen(),
            '/attendance': (_) => const MainScreen(initialIndex: 1),
            '/leave-requests': (_) => const MainScreen(initialIndex: 2),
            '/payroll': (_) => const PayrollScreen(),
            '/announcements': (_) => const MainScreen(initialIndex: 3),
            '/expenses': (_) => const ExpensesScreen(),
            '/performance': (_) => const PerformanceScreen(),
            '/profile': (_) => const MainScreen(initialIndex: 4),
            '/hr-contact': (_) => const HrContactScreen(),
            '/payslips': (_) => const PayslipScreen(),
          },
          onGenerateRoute: (settings) {
            if (settings.name == '/announcement-details' &&
                settings.arguments is Map<String, dynamic>) {
              return MaterialPageRoute<void>(
                builder: (_) => AnnouncementDetailsScreen(
                  announcement: settings.arguments! as Map<String, dynamic>,
                ),
              );
            }
            return null;
          },
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: colorScheme,
            primaryColor: primaryBlue,
            scaffoldBackgroundColor: scaffoldTint,
            textTheme: baseTextTheme.apply(
              bodyColor: const Color(0xFF20314D),
              displayColor: const Color(0xFF20314D),
            ),
            primaryTextTheme: baseTextTheme.apply(
              bodyColor: Colors.white,
              displayColor: Colors.white,
            ),
            appBarTheme: AppBarTheme(
              backgroundColor: primaryBlue,
              foregroundColor: Colors.white,
              elevation: 0,
              centerTitle: false,
              titleTextStyle: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            bottomNavigationBarTheme: const BottomNavigationBarThemeData(
              selectedItemColor: primaryBlue,
              unselectedItemColor: Colors.grey,
              selectedLabelStyle: TextStyle(fontWeight: FontWeight.w700),
              unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w500),
            ),
            elevatedButtonTheme: ElevatedButtonThemeData(
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryBlue,
                foregroundColor: Colors.white,
                textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 16,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFDCE3EE)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFDCE3EE)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: primaryBlue, width: 1.2),
              ),
            ),
          ),
          home: const SplashScreen(),
        ),
      ),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({Key? key, this.initialIndex = 0}) : super(key: key);

  final int initialIndex;

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  late int _selectedIndex;

  @override
  void initState() {
    super.initState();
    _selectedIndex = widget.initialIndex;
  }

  void switchTab(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      DashboardScreen(switchTab: switchTab),
      AttendanceScreen(switchTab: switchTab),
      LeaveScreen(switchTab: switchTab),
      AnnouncementsScreen(switchTab: switchTab),
      ProfileScreen(switchTab: switchTab),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: pages,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: switchTab,
        type: BottomNavigationBarType.fixed,
        showUnselectedLabels: true,
        items: const [
          BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'Home'),
          BottomNavigationBarItem(
              icon: Icon(Icons.event_available_outlined),
              activeIcon: Icon(Icons.event_available),
              label: 'Attendance'),
          BottomNavigationBarItem(
              icon: Icon(Icons.event_busy_outlined),
              activeIcon: Icon(Icons.event_busy),
              label: 'Leave'),
          BottomNavigationBarItem(
              icon: Icon(Icons.forum_outlined),
              activeIcon: Icon(Icons.forum),
              label: 'Engage'),
          BottomNavigationBarItem(
              icon: Icon(Icons.person_pin_outlined),
              activeIcon: Icon(Icons.person_pin),
              label: 'Profile'),
        ],
      ),
    );
  }
}
