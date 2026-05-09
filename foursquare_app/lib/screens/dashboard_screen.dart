import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/attendance_service.dart';
import '../services/supabase_config.dart';
import '../widgets/app_drawer.dart';

class DashboardScreen extends StatefulWidget {
  final Function(int)? switchTab;

  const DashboardScreen({
    super.key,
    this.switchTab,
  });

  @override
  State<DashboardScreen> createState() =>
      _DashboardScreenState();
}

class _DashboardScreenState
    extends State<DashboardScreen> {
  String _displayName = '';
  String? _employeeId;
  String _designation = '';
  String _department = '';

  bool _isLoading = true;
  bool _isFetchingData = false;
  bool _hasInitLoaded = false;

  List<dynamic> _recentAnnouncements = [];

  Map<String, dynamic> _leaveBalance = {};

  Map<String, dynamic>? _todayAttendance;

  DateTime _now = DateTime.now();

  Timer? _clockTimer;
  Timer? _weatherTimer;
  Timer? _refreshDebounce;
  RealtimeChannel? _dashboardChannel;

  bool _weatherLoaded = false;

  String _weatherTemp = '';
  String _weatherCondition = '';
  String _weatherIcon = '';

  DateTime? _lastRefreshAt;

  final List<Map<String, dynamic>>
      _allActions = [
    {
      'key': 'Attendance',
      'icon': Icons.access_time_rounded,
      'desc': 'Punch In / Out',
      'color': const Color(0xFF1565C0),
    },
    {
      'key': 'Leave',
      'icon': Icons.calendar_month_rounded,
      'desc': 'Apply Leave',
      'color': const Color(0xFF2E7D32),
    },
    {
      'key': 'Payslip',
      'icon': Icons.receipt_long_rounded,
      'desc': 'Salary',
      'color': const Color(0xFFFF8C00),
    },
    {
      'key': 'Profile',
      'icon': Icons.person_rounded,
      'desc': 'My Profile',
      'color': const Color(0xFF00838F),
    },
    {
      'key': 'Engage',
      'icon': Icons.campaign_rounded,
      'desc': 'Announcements',
      'color': const Color(0xFFE65100),
    },
  ];

  @override
  void initState() {
    super.initState();

    _initialize();

    _clockTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) {
        if (!mounted) return;

        setState(() {
          _now = DateTime.now();
        });
      },
    );

    _weatherTimer = Timer.periodic(
      const Duration(minutes: 30),
      (_) => _loadWeather(),
    );
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    _weatherTimer?.cancel();
    _refreshDebounce?.cancel();
    final channel = _dashboardChannel;
    if (channel != null) {
      SupabaseConfig.client.removeChannel(channel);
    }
    super.dispose();
  }

  Future<void> _initialize() async {
    await _loadEmployeeId();

    await Future.wait([
      _fetchDashboardData(),
      _loadWeather(),
    ]);
  }

  Future<void> _loadEmployeeId() async {
    try {
      final empId =
          await SupabaseConfig.getEmployeeId();

      if (!mounted) return;

      setState(() {
        _employeeId = empId;
      });

      _startRealtime();
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _employeeId = null;
      });
    }
  }

  Future<void> _loadWeather() async {
    try {
      const lat = 11.3410;
      const lon = 77.7172;

      final response = await http
          .get(
            Uri.parse(
              'https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current_weather=true&timezone=Asia%2FKolkata',
            ),
          )
          .timeout(
            const Duration(seconds: 10),
          );

      if (response.statusCode != 200) return;

      final data = jsonDecode(response.body);

      final currentWeather =
          data['current_weather'];

      final code =
          currentWeather['weathercode'] as int;

      final temp =
          currentWeather['temperature'];

      String icon;
      String condition;

      if (code == 0) {
        icon = '☀️';
        condition = 'Clear';
      } else if (code <= 3) {
        icon = '⛅';
        condition = 'Cloudy';
      } else if (code <= 48) {
        icon = '🌫️';
        condition = 'Fog';
      } else if (code <= 67) {
        icon = '🌧️';
        condition = 'Rain';
      } else if (code <= 82) {
        icon = '🌦️';
        condition = 'Showers';
      } else {
        icon = '⛈️';
        condition = 'Storm';
      }

      if (!mounted) return;

      setState(() {
        _weatherLoaded = true;
        _weatherTemp =
            '${temp.toStringAsFixed(0)}°C';
        _weatherCondition = condition;
        _weatherIcon = icon;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _weatherLoaded = false;
      });
    }
  }

  Future<void> _fetchDashboardData() async {
    if (_isFetchingData) return;

    if (_lastRefreshAt != null &&
        DateTime.now().difference(
              _lastRefreshAt!,
            ) <
            const Duration(seconds: 1)) {
      return;
    }

    _isFetchingData = true;

    _lastRefreshAt = DateTime.now();

    try {
      if (_employeeId == null ||
          _employeeId!.isEmpty) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }

        return;
      }

      final futures = <Future<dynamic>>[
        SupabaseConfig.withTimeout(
          SupabaseConfig.client
              .from('employees')
              .select(
                'full_name, designation, department',
              )
              .eq(
                'employee_id',
                _employeeId!,
              )
              .maybeSingle(),
        ),

        SupabaseConfig.withTimeout(
          SupabaseConfig.client
              .from('announcements')
              .select(
                'id, title, content, created_at, priority',
              )
              .order(
                'created_at',
                ascending: false,
              )
              .limit(3),
        ),

        SupabaseConfig.withTimeout(
          AttendanceService.fetchToday(_employeeId!),
        ),

        SupabaseConfig.withTimeout(
          SupabaseConfig.client
              .from('leave_requests')
              .select(
                'leave_type, start_date, end_date',
              )
              .eq(
                'employee_id',
                _employeeId!,
              )
              .eq('status', 'approved'),
        ),
      ];

      final results =
          await Future.wait<dynamic>(
        futures,
      );

      final empData =
          results[0]
              as Map<String, dynamic>?;

      final annRes =
          results[1] as List<dynamic>;

      final attRes =
          results[2]
              as Map<String, dynamic>?;

      final leaveRes =
          results[3] as List<dynamic>;

      if (empData != null) {
        _displayName =
            (empData['full_name'] ?? '')
                .toString()
                .split(' ')
                .first;

        _designation =
            empData['designation']
                    ?.toString() ??
                '';

        _department =
            empData['department']
                    ?.toString() ??
                '';
      }

      final leaveBalance =
          <String, dynamic>{
        'Casual Leave': {
          'used': 0,
          'total': 12,
        },
        'Sick Leave': {
          'used': 0,
          'total': 12,
        },
        'Earned Leave': {
          'used': 0,
          'total': 24,
        },
      };

      for (final leave in leaveRes) {
        final type =
            leave['leave_type']
                    ?.toString() ??
                '';

        final start =
            DateTime.tryParse(
          (leave['start_date'] ?? '')
              .toString(),
        );

        final end =
            DateTime.tryParse(
          (leave['end_date'] ?? '')
              .toString(),
        );

        if (start != null &&
            end != null &&
            leaveBalance.containsKey(
              type,
            )) {
          leaveBalance[type]['used'] =
              (leaveBalance[type]['used']
                      as int) +
                  end
                      .difference(start)
                      .inDays +
                  1;
        }
      }

      if (!mounted) return;

      setState(() {
        _recentAnnouncements = annRes;

        _todayAttendance = attRes;

        _leaveBalance = leaveBalance;

        _isLoading = false;

        _hasInitLoaded = true;
      });
    } catch (e) {
      debugPrint(
        'Dashboard fetch error: $e',
      );

      if (!mounted) return;

      if (!_hasInitLoaded) {
        setState(() {
          _isLoading = false;
        });
      }

      if (SupabaseConfig
          .shouldShowNetworkMessage()) {
        ScaffoldMessenger.of(context)
            .showSnackBar(
          SnackBar(
            behavior:
                SnackBarBehavior.floating,
            content: Text(
              SupabaseConfig
                  .normalizeError(e),
            ),
          ),
        );
      }
    } finally {
      _isFetchingData = false;
    }
  }

  void _startRealtime() {
    if (_employeeId == null || _employeeId!.isEmpty) return;

    final existing = _dashboardChannel;
    if (existing != null) {
      SupabaseConfig.client.removeChannel(existing);
      _dashboardChannel = null;
    }

    void scheduleRefresh() {
      _refreshDebounce?.cancel();
      _refreshDebounce = Timer(const Duration(milliseconds: 450), () {
        if (mounted) {
          _fetchDashboardData();
        }
      });
    }

    final employeeFilter = PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'employee_id',
      value: _employeeId!,
    );

    _dashboardChannel = SupabaseConfig.client
        .channel('dashboard-mobile-${_employeeId!}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'attendance_logs',
          filter: employeeFilter,
          callback: (_) => scheduleRefresh(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'leave_requests',
          filter: employeeFilter,
          callback: (_) => scheduleRefresh(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'announcements',
          callback: (_) => scheduleRefresh(),
        )
        .subscribe();
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;

    if (hour < 12) {
      return 'Good Morning,';
    }

    if (hour < 17) {
      return 'Good Afternoon,';
    }

    return 'Good Evening,';
  }

  void _navigateTo(String key) {
    switch (key) {
      case 'Attendance':
        widget.switchTab?.call(1);
        break;

      case 'Leave':
        widget.switchTab?.call(2);
        break;

      case 'Engage':
        widget.switchTab?.call(3);
        break;

      case 'Profile':
        widget.switchTab?.call(4);
        break;

      default:
        ScaffoldMessenger.of(context)
            .showSnackBar(
          const SnackBar(
            content: Text('Coming soon!'),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor:
            Color(0xFFF8FAFC),
        body: Center(
          child:
              CircularProgressIndicator(
            color: Color(0xFF1565C0),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor:
          const Color(0xFFF8FAFC),

      drawer: AppDrawer(
        selectedIndex: 0,
        switchTab: (i) =>
            widget.switchTab?.call(i),
      ),

      floatingActionButton:
          _employeeId != null
              ? FloatingActionButton(
                  backgroundColor:
                      const Color(
                    0xFFFF8C00,
                  ),
                  onPressed: () =>
                      widget.switchTab
                          ?.call(1),
                  child: const Icon(
                    Icons
                        .access_time_rounded,
                  ),
                )
              : null,

      body: RefreshIndicator(
        onRefresh: _fetchDashboardData,

        child: CustomScrollView(
          physics:
              const BouncingScrollPhysics(),

          slivers: [
            SliverAppBar(
              floating: true,
              backgroundColor:
                  const Color(
                0xFF1a2744,
              ),

              iconTheme:
                  const IconThemeData(
                color: Colors.white,
              ),

              title: Image.asset(
                'assets/images/4 square White Colour.png',
                height: 32,
              ),

              actions: [
                IconButton(
                  icon: const Icon(
                    Icons
                        .notifications_none_rounded,
                    color: Colors.white,
                  ),
                  onPressed: () {},
                ),

                const SizedBox(width: 8),
              ],
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding:
                    const EdgeInsets.all(
                  20,
                ),

                child: Column(
                  crossAxisAlignment:
                      CrossAxisAlignment
                          .start,

                  children: [
                    _buildGreetingCard(),

                    const SizedBox(
                      height: 20,
                    ),

                    _buildTodayStatusCard(),

                    const SizedBox(
                      height: 24,
                    ),

                    _sectionTitle(
                      'Daily Actions',
                    ),

                    const SizedBox(
                      height: 12,
                    ),

                    _buildActionsGrid(),

                    const SizedBox(
                      height: 24,
                    ),

                    _sectionTitle(
                      'Leave Balance',
                    ),

                    const SizedBox(
                      height: 12,
                    ),

                    _buildLeaveBalance(),

                    const SizedBox(
                      height: 24,
                    ),

                    _sectionTitle(
                      'Latest News',
                    ),

                    const SizedBox(
                      height: 12,
                    ),

                    _buildNewsFeed(),

                    const SizedBox(
                      height: 40,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGreetingCard() {
    return Container(
      width: double.infinity,

      padding: const EdgeInsets.all(
        24,
      ),

      decoration: BoxDecoration(
        borderRadius:
            BorderRadius.circular(28),

        gradient:
            const LinearGradient(
          begin: Alignment.topLeft,
          end:
              Alignment.bottomRight,
          colors: [
            Color(0xFF0F172A),
            Color(0xFF1E3A5F),
          ],
        ),
      ),

      child: Column(
        crossAxisAlignment:
            CrossAxisAlignment.start,

        children: [
          Text(
            _getGreeting(),
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 20,
              fontWeight:
                  FontWeight.w500,
            ),
          ),

          const SizedBox(height: 4),

          Shimmer.fromColors(
            baseColor: Colors.white,
            highlightColor:
                const Color(
              0xFF60A5FA,
            ),

            child: Text(
              _displayName.isEmpty
                  ? 'Employee'
                  : _displayName,

              style:
                  GoogleFonts.inter(
                color: Colors.white,
                fontSize: 30,
                fontWeight:
                    FontWeight.w900,
              ),
            ),
          ),

          const SizedBox(height: 12),

          Text(
            [
              if (_designation.isNotEmpty) _designation,
              if (_department.isNotEmpty) _department,
              DateFormat('EEE, dd MMM - hh:mm a').format(_now),
              if (_weatherLoaded)
                'Erode $_weatherTemp $_weatherCondition $_weatherIcon',
            ].join('  |  '),
            style: GoogleFonts.inter(
              color: Colors.white.withValues(alpha: 0.78),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTodayStatusCard() {
    final hasIn =
        _todayAttendance?['check_in'] !=
            null;

    final hasOut =
        _todayAttendance?['check_out'] !=
            null;

    String status;

    if (hasIn && hasOut) {
      status = 'Completed';
    } else if (hasIn) {
      status = 'Punched In';
    } else {
      status = 'Not Punched In';
    }

    return Container(
      padding: const EdgeInsets.all(
        16,
      ),

      decoration: BoxDecoration(
        color: Colors.white,

        borderRadius:
            BorderRadius.circular(20),
      ),

      child: Row(
        children: [
          const Icon(
            Icons.access_time_rounded,
          ),

          const SizedBox(width: 12),

          Expanded(
            child: Text(
              status,
              style: const TextStyle(
                fontWeight:
                    FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionsGrid() {
    return GridView.builder(
      shrinkWrap: true,

      physics:
          const NeverScrollableScrollPhysics(),

      gridDelegate:
          const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),

      itemCount: _allActions.length,

      itemBuilder: (context, i) {
        final action = _allActions[i];

        final color =
            action['color'] as Color;

        return GestureDetector(
          onTap: () => _navigateTo(
            action['key'] as String,
          ),

          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,

              borderRadius:
                  BorderRadius.circular(
                20,
              ),
            ),

            child: Column(
              mainAxisAlignment:
                  MainAxisAlignment
                      .center,

              children: [
                Icon(
                  action['icon']
                      as IconData,
                  color: color,
                ),

                const SizedBox(
                  height: 8,
                ),

                Text(
                  action['key']
                      as String,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildLeaveBalance() {
    return Container(
      padding: const EdgeInsets.all(
        16,
      ),

      decoration: BoxDecoration(
        color: Colors.white,

        borderRadius:
            BorderRadius.circular(16),
      ),

      child: Column(
        children:
            _leaveBalance.entries.map(
          (e) {
            return Padding(
              padding:
                  const EdgeInsets.only(
                bottom: 10,
              ),

              child: Row(
                mainAxisAlignment:
                    MainAxisAlignment
                        .spaceBetween,

                children: [
                  Text(e.key),

                  Text(
                    '${e.value['used']} / ${e.value['total']}',
                  ),
                ],
              ),
            );
          },
        ).toList(),
      ),
    );
  }

  Widget _buildNewsFeed() {
    if (_recentAnnouncements.isEmpty) {
      return Container(
        padding:
            const EdgeInsets.all(24),

        decoration: BoxDecoration(
          color: Colors.white,

          borderRadius:
              BorderRadius.circular(
            16,
          ),
        ),

        child: const Center(
          child: Text(
            'No announcements',
          ),
        ),
      );
    }

    return Column(
      children:
          _recentAnnouncements.map(
        (ann) {
          return Container(
            margin:
                const EdgeInsets.only(
              bottom: 10,
            ),

            padding:
                const EdgeInsets.all(
              14,
            ),

            decoration: BoxDecoration(
              color: Colors.white,

              borderRadius:
                  BorderRadius.circular(
                16,
              ),
            ),

            child: Column(
              crossAxisAlignment:
                  CrossAxisAlignment
                      .start,

              children: [
                Text(
                  (ann['title'] ?? '')
                      .toString(),

                  style:
                      const TextStyle(
                    fontWeight:
                        FontWeight.bold,
                  ),
                ),

                const SizedBox(
                  height: 4,
                ),

                Text(
                  (ann['content'] ?? '')
                      .toString(),
                ),
              ],
            ),
          );
        },
      ).toList(),
    );
  }

  Widget _sectionTitle(String title) {
    return Text(
      title,

      style: GoogleFonts.inter(
        color: const Color(
          0xFF0F172A,
        ),
        fontSize: 18,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}
