import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';

import '../services/permission_service.dart';
import '../services/supabase_config.dart';
import '../widgets/app_drawer.dart';

class AttendanceScreen extends StatefulWidget {
  final Function(int)? switchTab;

  const AttendanceScreen({
    super.key,
    this.switchTab,
  });

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _isFetchingToday = false;

  String? _employeeId;

  Map<String, dynamic>? _todayLog;

  Timer? _timer;
  Duration _elapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _initializeScreen();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<String?> _getEmployeeId() async {
    return SupabaseConfig.getEmployeeId();
  }

  Future<void> _initializeScreen() async {
    debugPrint('Attendance screen initialize started');

    if (mounted) {
      setState(() {
        _isLoading = true;
      });
    }

    try {
      _employeeId = await _getEmployeeId();

      debugPrint('Employee ID: $_employeeId');

      await _loadTodayAttendance();

      _startTimerIfNeeded();
    } catch (e) {
      debugPrint('Attendance initialize failed: $e');

      if (mounted &&
          SupabaseConfig.shouldShowNetworkMessage()) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              SupabaseConfig.normalizeError(e),
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      debugPrint('Attendance initialize completed');

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadTodayAttendance() async {
    if (_isFetchingToday) {
      debugPrint('Attendance fetch skipped (already fetching)');
      return;
    }

    _isFetchingToday = true;

    try {
      debugPrint('Attendance fetch started');

      if (_employeeId == null ||
          _employeeId!.trim().isEmpty) {
        debugPrint('Employee ID missing');

        if (mounted) {
          setState(() {
            _todayLog = null;
            _isLoading = false;
          });
        }

        return;
      }

      final today =
          DateFormat('yyyy-MM-dd').format(DateTime.now());

      final response =
          await SupabaseConfig.withTimeout(
        SupabaseConfig.client
            .from('attendance_logs')
            .select(
              '''
              id,
              employee_id,
              punch_in,
              punch_out,
              date,
              status,
              location,
              office_name
              ''',
            )
            .eq('employee_id', _employeeId!)
            .eq('date', today)
            .maybeSingle(),
      );

      debugPrint('Attendance fetch success');
      debugPrint('Attendance data: $response');

      if (!mounted) return;

      setState(() {
        _todayLog = response;
      });
    } catch (e) {
      debugPrint('Attendance fetch failed: $e');

      if (!mounted) return;

      setState(() {
        _todayLog = null;
      });

      if (SupabaseConfig.shouldShowNetworkMessage()) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              SupabaseConfig.normalizeError(e),
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      debugPrint('Attendance fetch completed');

      _isFetchingToday = false;

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _startTimerIfNeeded() {
    _timer?.cancel();

    final punchInStr =
        _todayLog?['punch_in']?.toString();

    final punchOutStr =
        _todayLog?['punch_out']?.toString();

    if (punchInStr == null || punchOutStr != null) {
      return;
    }

    final punchIn =
        DateTime.tryParse(punchInStr)?.toLocal();

    if (punchIn == null) {
      return;
    }

    _elapsed =
        DateTime.now().difference(punchIn);

    _timer = Timer.periodic(
      const Duration(seconds: 1),
      (_) {
        if (!mounted) return;

        setState(() {
          _elapsed =
              DateTime.now().difference(punchIn);
        });
      },
    );
  }

  Future<void> _handlePunch() async {
    if (_isSubmitting || _employeeId == null) {
      return;
    }

    if (mounted) {
      setState(() {
        _isSubmitting = true;
      });
    }

    try {
      debugPrint('Punch process started');

      final hasPermission =
          await PermissionService
              .checkAndRequestLocation();

      if (!hasPermission) {
        if (!mounted) return;

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:
                Text('Location permission required'),
            backgroundColor: Colors.orange,
          ),
        );

        return;
      }

      final position =
          await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      final now = DateTime.now();

      final today =
          DateFormat('yyyy-MM-dd').format(now);

      final nowIso =
          now.toUtc().toIso8601String();

      final locationText =
          '${position.latitude},${position.longitude}';

      final hasPunchIn =
          _todayLog?['punch_in'] != null;

      final hasPunchOut =
          _todayLog?['punch_out'] != null;

      if (!hasPunchIn) {
        debugPrint('Punch In started');

        final inserted =
            await SupabaseConfig.withTimeout(
          SupabaseConfig.client
              .from('attendance_logs')
              .insert({
                'employee_id': _employeeId,
                'punch_in': nowIso,
                'date': today,
                'status': 'present',
                'location': locationText,
              })
              .select(
                '''
                id,
                employee_id,
                punch_in,
                punch_out,
                date,
                status,
                location,
                office_name
                ''',
              )
              .single(),
        );

        if (!mounted) return;

        setState(() {
          _todayLog = inserted;
        });

        _startTimerIfNeeded();

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Punch In at ${DateFormat('hh:mm a').format(now)}',
            ),
            backgroundColor: Colors.green,
          ),
        );
      } else if (!hasPunchOut) {
        debugPrint('Punch Out started');

        final logId = _todayLog?['id'];

        if (logId == null) {
          await _loadTodayAttendance();
        }

        final freshLogId = _todayLog?['id'];

        if (freshLogId == null) {
          throw Exception(
            'Attendance log not found',
          );
        }

        await SupabaseConfig.withTimeout(
          SupabaseConfig.client
              .from('attendance_logs')
              .update({
                'punch_out': nowIso,
              })
              .eq('id', freshLogId),
        );

        await _loadTodayAttendance();

        _timer?.cancel();

        if (!mounted) return;

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Punch Out at ${DateFormat('hh:mm a').format(now)}',
            ),
            backgroundColor: Colors.green,
          ),
        );
      }

      debugPrint('Punch process completed');
    } catch (e) {
      debugPrint('Punch process failed: $e');

      if (mounted &&
          SupabaseConfig.shouldShowNetworkMessage()) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              SupabaseConfig.normalizeError(e),
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  String _statusLabel() {
    final hasPunchIn =
        _todayLog?['punch_in'] != null;

    final hasPunchOut =
        _todayLog?['punch_out'] != null;

    if (!hasPunchIn) {
      return 'Not Punched In';
    }

    if (!hasPunchOut) {
      final hrs = _elapsed.inHours;
      final mins = _elapsed.inMinutes % 60;

      return 'Working - $hrs hrs $mins mins';
    }

    return 'Done for today';
  }

  String _timeLabel() {
    final hasPunchIn =
        _todayLog?['punch_in'] != null;

    final hasPunchOut =
        _todayLog?['punch_out'] != null;

    if (!hasPunchIn) {
      return '--:--:--';
    }

    if (!hasPunchOut) {
      final h =
          _elapsed.inHours.toString().padLeft(2, '0');

      final m = (_elapsed.inMinutes % 60)
          .toString()
          .padLeft(2, '0');

      final s = (_elapsed.inSeconds % 60)
          .toString()
          .padLeft(2, '0');

      return '$h:$m:$s';
    }

    final pIn = DateTime.tryParse(
      _todayLog!['punch_in'].toString(),
    )?.toLocal();

    final pOut = DateTime.tryParse(
      _todayLog!['punch_out'].toString(),
    )?.toLocal();

    if (pIn == null || pOut == null) {
      return '--:--:--';
    }

    final diff = pOut.difference(pIn);

    return '${diff.inHours.toString().padLeft(2, '0')}:${(diff.inMinutes % 60).toString().padLeft(2, '0')}:${(diff.inSeconds % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final hasPunchIn =
        _todayLog?['punch_in'] != null;

    final hasPunchOut =
        _todayLog?['punch_out'] != null;

    final buttonColor = hasPunchIn
        ? const Color(0xFFD32F2F)
        : const Color(0xFF2E7D32);

    final buttonLabel =
        hasPunchIn ? 'Punch Out' : 'Punch In';

    final buttonIcon =
        hasPunchIn ? Icons.logout : Icons.login;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      drawer: AppDrawer(
        selectedIndex: 1,
        switchTab: (i) =>
            widget.switchTab?.call(i),
      ),
      appBar: AppBar(
        title: const Text(
          'Attendance',
          style: TextStyle(
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: const Color(0xFF1a2744),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            onPressed: _initializeScreen,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(),
            )
          : RefreshIndicator(
              onRefresh: _initializeScreen,
              child: SingleChildScrollView(
                physics:
                    const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment:
                      CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding:
                          const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius:
                            BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black
                                .withValues(alpha: 0.06),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Text(
                            _statusLabel(),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight:
                                  FontWeight.w700,
                              color:
                                  Color(0xFF1a2744),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _timeLabel(),
                            style: TextStyle(
                              fontSize: 48,
                              fontWeight:
                                  FontWeight.bold,
                              fontFeatures: const [
                                FontFeature
                                    .tabularFigures(),
                              ],
                              color: hasPunchIn &&
                                      !hasPunchOut
                                  ? const Color(
                                      0xFFD32F2F)
                                  : const Color(
                                      0xFF1a2744),
                            ),
                          ),
                          const SizedBox(height: 20),
                          SizedBox(
                            width: double.infinity,
                            height: 54,
                            child:
                                ElevatedButton.icon(
                              onPressed:
                                  hasPunchIn &&
                                          hasPunchOut
                                      ? null
                                      : (_isSubmitting
                                          ? null
                                          : _handlePunch),
                              icon: _isSubmitting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child:
                                          CircularProgressIndicator(
                                        color:
                                            Colors.white,
                                        strokeWidth:
                                            2,
                                      ),
                                    )
                                  : Icon(buttonIcon),
                              label: Text(
                                buttonLabel,
                                style:
                                    const TextStyle(
                                  fontSize: 16,
                                  fontWeight:
                                      FontWeight.w700,
                                ),
                              ),
                              style:
                                  ElevatedButton
                                      .styleFrom(
                                backgroundColor:
                                    buttonColor,
                                foregroundColor:
                                    Colors.white,
                                disabledBackgroundColor:
                                    Colors
                                        .grey
                                        .shade400,
                                shape:
                                    RoundedRectangleBorder(
                                  borderRadius:
                                      BorderRadius
                                          .circular(
                                    14,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding:
                          const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius:
                            BorderRadius.circular(16),
                      ),
                      child: Column(
                        crossAxisAlignment:
                            CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Employee: ${_employeeId ?? 'N/A'}',
                            style:
                                const TextStyle(
                              fontWeight:
                                  FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          const Divider(height: 16),
                          Text(
                            'Date: ${DateFormat('dd MMM yyyy, EEEE').format(DateTime.now())}',
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              const Icon(
                                Icons.login,
                                size: 16,
                                color: Colors.green,
                              ),
                              const SizedBox(
                                  width: 6),
                              Expanded(
                                child: Text(
                                  'Punch In: ${_todayLog?['punch_in'] != null ? DateFormat('hh:mm a').format(DateTime.parse(_todayLog!['punch_in'].toString()).toLocal()) : '--'}',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              const Icon(
                                Icons.logout,
                                size: 16,
                                color: Colors.red,
                              ),
                              const SizedBox(
                                  width: 6),
                              Expanded(
                                child: Text(
                                  'Punch Out: ${_todayLog?['punch_out'] != null ? DateFormat('hh:mm a').format(DateTime.parse(_todayLog!['punch_out'].toString()).toLocal()) : '--'}',
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }
}