import 'package:flutter/material.dart';
import '../services/supabase_config.dart';
import '../main.dart';
import 'login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _logoOpacity;
  late Animation<double> _textOpacity;
  late Animation<double> _progressValue;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    );

    // sequential fade-in: logo (0% - 30%), text (40% - 60%)
    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.3, curve: Curves.easeIn), // 600ms
      ),
    );

    _textOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.2, 0.5, curve: Curves.easeIn), // 400ms delay (started at 400ms)
      ),
    );

    // progress bar animation (20% - 90%)
    _progressValue = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.2, 0.9, curve: Curves.linear),
      ),
    );

    _controller.forward();
    Future.delayed(const Duration(milliseconds: 2200), _checkSessionAndNavigate);
  }

  void _checkSessionAndNavigate() {
    if (!mounted) return;
    final session = SupabaseConfig.client.auth.currentSession;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (c, a, s) => session != null ? const MainScreen() : const LoginScreen(),
        transitionDuration: const Duration(milliseconds: 700),
        transitionsBuilder: (c, a, s, child) => FadeTransition(opacity: a, child: child),
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
            colors: [
              Color(0xFF0F172A),
              Color(0xFF1E3A5F),
              Color(0xFF0A1628),
            ],
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
                const SizedBox(height: 16),
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
                      SizedBox(height: 4),
                      Text(
                        'HRMS PORTAL',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Colors.white60,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: AnimatedBuilder(
              animation: _progressValue,
              builder: (context, child) {
                return LinearProgressIndicator(
                  value: _progressValue.value,
                  minHeight: 3,
                  color: const Color(0xFF1a2744),
                  backgroundColor: const Color(0xFFF0F2F6),
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

