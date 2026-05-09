import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../main.dart';
import 'login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _logoOpacity;
  late Animation<double> _textOpacity;
  late Animation<double> _progressValue;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 2200),
      vsync: this,
    );

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.35, curve: Curves.easeIn),
      ),
    );

    _textOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.25, 0.55, curve: Curves.easeIn),
      ),
    );

    _progressValue = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.1, 0.95, curve: Curves.easeInOut),
      ),
    );

    _controller.forward();
    Future.delayed(
      const Duration(milliseconds: 2500),
      _checkSessionAndNavigate,
    );
  }

  Future<void> _checkSessionAndNavigate() async {
    if (!mounted) return;
    final prefs = await SharedPreferences.getInstance();
    final employeeId = prefs.getString('employee_id')?.trim() ?? '';
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (c, a, s) =>
            employeeId.isNotEmpty ? const MainScreen() : const LoginScreen(),
        transitionDuration: const Duration(milliseconds: 600),
        transitionsBuilder: (c, a, s, child) =>
            FadeTransition(opacity: a, child: child),
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F172A), Color(0xFF1E3A5F), Color(0xFF0A1628)],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  FadeTransition(
                    opacity: _logoOpacity,
                    child: Image.asset(
                      'assets/images/4 square White Colour.png',
                      width: 200,
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(height: 20),
                  FadeTransition(
                    opacity: _textOpacity,
                    child: const Column(
                      children: [
                        Text(
                          'FOURSQUARE HRMS',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: 2.0,
                          ),
                        ),
                        SizedBox(height: 6),
                        Text(
                          'HRMS PORTAL',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: Colors.white60,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // ✅ Progress bar — white color, visible on dark background
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: AnimatedBuilder(
                animation: _progressValue,
                builder: (context, child) {
                  return LinearProgressIndicator(
                    value: _progressValue.value,
                    minHeight: 4,
                    // ✅ Fixed: white progress on dark bg
                    color: Colors.white,
                    backgroundColor: Colors.white.withValues(alpha: 0.15),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
