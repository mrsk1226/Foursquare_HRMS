import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';

import '../blocs/auth_bloc.dart';
import '../main.dart';
import '../services/auth_service.dart';
import '../widgets/brand_lockup.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  late final AnimationController _animationController;
  late final Animation<double> _headerFadeAnimation;
  late final Animation<Offset> _headerSlideAnimation;
  late final Animation<double> _formFadeAnimation;
  late final Animation<Offset> _formSlideAnimation;
  late final Animation<double> _footerFadeAnimation;
  late final Animation<Offset> _footerSlideAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    );

    final headerCurve = CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.0, 0.55, curve: Curves.easeOutCubic),
    );
    _headerFadeAnimation =
        Tween<double>(begin: 0.0, end: 1.0).animate(headerCurve);
    _headerSlideAnimation = Tween<Offset>(
      begin: const Offset(0, -0.12),
      end: Offset.zero,
    ).animate(headerCurve);

    final formCurve = CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.18, 0.82, curve: Curves.easeOutCubic),
    );
    _formFadeAnimation =
        Tween<double>(begin: 0.0, end: 1.0).animate(formCurve);
    _formSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(formCurve);

    final footerCurve = CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.46, 1.0, curve: Curves.easeOutCubic),
    );
    _footerFadeAnimation =
        Tween<double>(begin: 0.0, end: 1.0).animate(footerCurve);
    _footerSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.10),
      end: Offset.zero,
    ).animate(footerCurve);

    _animationController.forward();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (_isLoading) return;

    setState(() => _isLoading = true);

    try {
      await AuthService().signInWithEmailPassword(
        _emailController.text.trim(),
        _passwordController.text.trim(),
      );

      if (!mounted) return;

      context.read<AuthBloc>().add(HRMSAuthCheckRequested());

      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainScreen()),
        (route) => false,
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Login failed: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Widget _buildBackgroundOrb({
    required double size,
    required Color color,
  }) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFFFFFFF),
              Color(0xFFF6FAFF),
              Color(0xFFEAF2FB),
            ],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned(
              top: -120,
              right: -42,
              child: _buildBackgroundOrb(
                size: 280,
                color: const Color(0x141E3A5F),
              ),
            ),
            Positioned(
              bottom: -70,
              left: -28,
              child: _buildBackgroundOrb(
                size: 220,
                color: const Color(0x122E86AB),
              ),
            ),
            Positioned(
              top: 132,
              left: -58,
              child: _buildBackgroundOrb(
                size: 150,
                color: const Color(0x0D1E3A5F),
              ),
            ),
            SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final horizontalPadding =
                      constraints.maxWidth < 560 ? 22.0 : 32.0;
                  final verticalPadding =
                      constraints.maxWidth < 560 ? 20.0 : 30.0;
                  final minScrollableHeight =
                      (constraints.maxHeight - (verticalPadding * 2))
                          .clamp(0.0, double.infinity)
                          .toDouble();

                  return SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: horizontalPadding,
                      vertical: verticalPadding,
                    ),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: minScrollableHeight,
                      ),
                      child: IntrinsicHeight(
                        child: SizedBox(
                          width: double.infinity,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Center(
                                child: ConstrainedBox(
                                  constraints:
                                      const BoxConstraints(maxWidth: 468),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      FadeTransition(
                                        opacity: _headerFadeAnimation,
                                        child: SlideTransition(
                                          position: _headerSlideAnimation,
                                          child: const Padding(
                                            padding: EdgeInsets.only(
                                              top: 14,
                                              left: 18,
                                              right: 18,
                                            ),
                                            child: BrandLockup(
                                              logoSize: 166,
                                              titleSize: 30,
                                              spacing: 14,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 28),
                                      FadeTransition(
                                        opacity: _formFadeAnimation,
                                        child: SlideTransition(
                                          position: _formSlideAnimation,
                                          child: Container(
                                            width: double.infinity,
                                            padding: const EdgeInsets.fromLTRB(
                                              24,
                                              28,
                                              24,
                                              24,
                                            ),
                                            decoration: BoxDecoration(
                                              color:
                                                  Colors.white.withValues(alpha: 0.90),
                                              borderRadius:
                                                  BorderRadius.circular(30),
                                              border: Border.all(
                                                color: Colors.white
                                                    .withValues(alpha: 0.92),
                                                width: 1.1,
                                              ),
                                              boxShadow: const [
                                                BoxShadow(
                                                  color: Color(0x141E3A5F),
                                                  blurRadius: 34,
                                                  offset: Offset(0, 18),
                                                ),
                                              ],
                                            ),
                                            child: AutofillGroup(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    'Welcome Back',
                                                    style: GoogleFonts.inter(
                                                      fontSize: 28,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      color: const Color(
                                                        0xFF20314D,
                                                      ),
                                                      height: 1.1,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 8),
                                                  Text(
                                                    'Sign in to continue to your HR workspace.',
                                                    style: GoogleFonts.inter(
                                                      fontSize: 14.5,
                                                      fontWeight:
                                                          FontWeight.w500,
                                                      color: const Color(
                                                        0xFF6B7A90,
                                                      ),
                                                      height: 1.45,
                                                    ),
                                                  ),
                                                  const SizedBox(height: 28),
                                                  TextField(
                                                    controller:
                                                        _emailController,
                                                    keyboardType: TextInputType
                                                        .emailAddress,
                                                    textInputAction:
                                                        TextInputAction.next,
                                                    autofillHints: const [
                                                      AutofillHints.username,
                                                    ],
                                                    decoration:
                                                        const InputDecoration(
                                                      hintText:
                                                          'Email address',
                                                      prefixIcon: Icon(
                                                        Icons.email_outlined,
                                                        color:
                                                            Color(0xFF1E3A5F),
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(height: 16),
                                                  TextField(
                                                    controller:
                                                        _passwordController,
                                                    obscureText:
                                                        _obscurePassword,
                                                    textInputAction:
                                                        TextInputAction.done,
                                                    autofillHints: const [
                                                      AutofillHints.password,
                                                    ],
                                                    onSubmitted: (_) =>
                                                        _handleLogin(),
                                                    decoration:
                                                        InputDecoration(
                                                      hintText: 'Password',
                                                      prefixIcon: const Icon(
                                                        Icons.lock_outline,
                                                        color:
                                                            Color(0xFF1E3A5F),
                                                      ),
                                                      suffixIcon: IconButton(
                                                        icon: Icon(
                                                          _obscurePassword
                                                              ? Icons
                                                                  .visibility_off
                                                              : Icons
                                                                  .visibility,
                                                          color: const Color(
                                                            0xFF7B8798,
                                                          ),
                                                        ),
                                                        onPressed: () {
                                                          setState(() {
                                                            _obscurePassword =
                                                                !_obscurePassword;
                                                          });
                                                        },
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(height: 8),
                                                  Align(
                                                    alignment:
                                                        Alignment.centerRight,
                                                    child: TextButton(
                                                      onPressed: () {},
                                                      style: TextButton
                                                          .styleFrom(
                                                        foregroundColor:
                                                            const Color(
                                                          0xFF1E3A5F,
                                                        ),
                                                        padding:
                                                            const EdgeInsets
                                                                .symmetric(
                                                          horizontal: 4,
                                                          vertical: 6,
                                                        ),
                                                      ),
                                                      child: Text(
                                                        'Forgot Password?',
                                                        style:
                                                            GoogleFonts.inter(
                                                          fontSize: 13.5,
                                                          fontWeight:
                                                              FontWeight.w600,
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(height: 18),
                                                  SizedBox(
                                                    width: double.infinity,
                                                    height: 54,
                                                    child: ElevatedButton(
                                                      onPressed: _isLoading
                                                          ? null
                                                          : _handleLogin,
                                                      child: _isLoading
                                                          ? const SizedBox(
                                                              height: 24,
                                                              width: 24,
                                                              child:
                                                                  CircularProgressIndicator(
                                                                color: Colors
                                                                    .white,
                                                                strokeWidth: 2,
                                                              ),
                                                            )
                                                          : Text(
                                                              'Sign In',
                                                              style: GoogleFonts
                                                                  .inter(
                                                                fontSize: 16,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w700,
                                                                color: Colors
                                                                    .white,
                                                              ),
                                                            ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              FadeTransition(
                                opacity: _footerFadeAnimation,
                                child: SlideTransition(
                                  position: _footerSlideAnimation,
                                  child: Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          'powered by',
                                          textAlign: TextAlign.center,
                                          style: GoogleFonts.inter(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            color: const Color(0xFF7D8BA0),
                                            letterSpacing: 0.2,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Four Square Fenestrattion',
                                          textAlign: TextAlign.center,
                                          style: GoogleFonts.inter(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w600,
                                            color: MyApp.primaryBlue,
                                            letterSpacing: 0.1,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
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
