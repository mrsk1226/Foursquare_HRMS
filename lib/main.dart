import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'services/supabase_config.dart';
import 'screens/splash_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/attendance_screen.dart';
import 'screens/leave_screen.dart';
import 'screens/announcements_screen.dart';
import 'screens/profile_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: 'https://pycsrmvhztxihjdihbve.supabase.co',
    anonKey: 'sb_publishable_Un8l50_1wRv3099cNjmZvA_q6Wm_im_',
  );
  await SharedPreferences.getInstance();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Foursquare HRMS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        primaryColor: const Color(0xFF1B2E4B),
        scaffoldBackgroundColor: const Color(0xFFF5F6FA),
        textTheme: GoogleFonts.interTextTheme(Theme.of(context).textTheme),
      ),
      home: const SplashScreen(),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({Key? key}) : super(key: key);

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _selectedIndex = 0;

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
        selectedItemColor: const Color(0xFF1B2E4B),
        unselectedItemColor: Colors.grey,
        showUnselectedLabels: true,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.event_available_outlined), activeIcon: Icon(Icons.event_available), label: 'Attendance'),
          BottomNavigationBarItem(icon: Icon(Icons.event_busy_outlined), activeIcon: Icon(Icons.event_busy), label: 'Leave'),
          BottomNavigationBarItem(icon: Icon(Icons.forum_outlined), activeIcon: Icon(Icons.forum), label: 'Engage'),
          BottomNavigationBarItem(icon: Icon(Icons.person_pin_outlined), activeIcon: Icon(Icons.person_pin), label: 'Profile'),
        ],
      ),
    );
  }
}
