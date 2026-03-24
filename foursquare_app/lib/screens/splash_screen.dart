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
  late Animation<double> _logoScale;
  late Animation<double> _logoOpacity;
  late Animation<double> _textOpacity;
  late Animation<double> _progressValue;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 2800),
      vsync: this,
    );

    // 0ms to 700ms: Logo Scale and Opacity
    _logoScale = Tween<double>(begin: 0.7, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.25, curve: Curves.easeOutCubic),
      ),
    );
    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.25, curve: Curves.easeIn),
      ),
    );

    // 700ms to 1000ms: Text Fade In
    _textOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.25, 0.357, curve: Curves.easeIn),
      ),
    );

    // 1000ms to 2500ms: LinearProgressIndicator
    _progressValue = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.357, 0.893, curve: Curves.linear),
      ),
    );

    _controller.forward();
    
    Future.delayed(const Duration(milliseconds: 2800), _checkSessionAndNavigate);
  }

  void _checkSessionAndNavigate() {
    if (!mounted) return;
    final session = SupabaseConfig.client.auth.currentSession;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (c, a, s) => session != null ? const MainScreen() : const LoginScreen(),
        transitionDuration: const Duration(milliseconds: 600),
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
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) {
                    return Opacity(
                      opacity: _logoOpacity.value,
                      child: Transform.scale(
                        scale: _logoScale.value,
                        child: child,
                      ),
                    );
                  },
                  child: Image.asset(
                    'assets/images/Four Square Logo blue.png',
                    width: 180,
                    height: 180,
                  ),
                ),
                const SizedBox(height: 20),
                FadeTransition(
                  opacity: _textOpacity,
                  child: const Text(
                    'HRMS',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1a2744),
                      letterSpacing: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: AnimatedBuilder(
              animation: _progressValue,
              builder: (context, child) {
                return LinearProgressIndicator(
                  value: _progressValue.value,
                  minHeight: 3,
                  color: const Color(0xFF1a2744),
                  backgroundColor: const Color(0xFFE8EAF0),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
