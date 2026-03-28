import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:http/http.dart' as http;
import '../services/supabase_config.dart';
import '../widgets/app_drawer.dart';

class DashboardScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const DashboardScreen({Key? key, this.switchTab}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  String _firstName = "";
  bool _isLoading = true;
  bool _isPunchedIn = false;
  int _presentDays = 0;
  int _casualLeaveBalance = 0;
  int _thisMonthLeaveCount = 0;
  double _permissionHours = 0;
  List<dynamic> _recentAnnouncements = [];
  Timer? _skyTimer;
  Timer? _punchTimer;
  DateTime? _checkInTime;
  DateTime? _checkOutTime;
  int _elapsedSeconds = 0;
  Map<String, dynamic>? _todayLog;

  String _weatherCondition = "Clear";
  dynamic _weatherData;
  late AnimationController _weatherAnimationController;
  Timer? _weatherFetchTimer;
  Timer? _clockTimer;
  DateTime _now = DateTime.now();
  List<dynamic> _celebrations = [];


  @override
  void initState() {
    super.initState();
    _weatherAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 20),
    )..repeat();

    _fetchDashboardData();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) setState(() => _now = DateTime.now());
    });

    _fetchWeather();
    _fetchUnreadNotifications();
    _weatherFetchTimer = Timer.periodic(const Duration(minutes: 10), (_) {
      _fetchWeather();
    });

  }

  Future<void> _fetchWeather() async {
    try {
      final url = Uri.parse(
          "https://api.openweathermap.org/data/2.5/weather?lat=11.3410&lon=77.7172&appid=bd5e378503939ddaee76f12ad7a97608&units=metric");
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final weatherArray = data['weather'] as List?;
        if (weatherArray != null && weatherArray.isNotEmpty) {
          final condition = weatherArray[0]['main'] as String? ?? 'Clear';
          if (mounted) {
            setState(() {
              _weatherCondition = condition;
              _weatherData = data;
            });
          }
        }
      }
    } catch (e) {
      print("Weather error: $e");
    }
  }


  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _fetchDashboardData();
  }

  @override
  void dispose() {
    _weatherAnimationController.dispose();
    _weatherFetchTimer?.cancel();
    _skyTimer?.cancel();
    _clockTimer?.cancel();
    _punchTimer?.cancel();
    super.dispose();
  }


  void _startPunchTimer() {
    _punchTimer?.cancel();
    if (_checkInTime == null) return;

    _elapsedSeconds = DateTime.now().difference(_checkInTime!).inSeconds;

    _punchTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _elapsedSeconds = DateTime.now().difference(_checkInTime!).inSeconds;
        });
      }
    });
  }

  Future<void> _fetchDashboardData() async {
    try {
      final user = SupabaseConfig.client.auth.currentUser;
      if (user == null) return;

      final profileRes = await SupabaseConfig.client
          .from('profiles')
          .select('employee_id')
          .eq('id', user.id)
          .maybeSingle();
      if (profileRes != null && profileRes['employee_id'] != null) {
        final empId = profileRes['employee_id'];

        final empRes = await SupabaseConfig.client
            .from('employees')
            .select('full_name')
            .eq('employee_id', empId)
            .maybeSingle();
        if (empRes != null && empRes['full_name'] != null) {
          _firstName = (empRes['full_name'] as String).split(' ').first;
        }

        final now = DateTime.now();
        final startOfMonth =
            DateTime(now.year, now.month, 1).toIso8601String().split('T')[0];
        final endOfMonth = DateTime(now.year, now.month + 1, 0)
            .toIso8601String()
            .split('T')[0];
        final todayStr = DateFormat('yyyy-MM-dd').format(now);

        final attendanceRes = await SupabaseConfig.client
            .from('attendance_logs')
            .select()
            .eq('employee_id', empId)
            .eq('date', todayStr)
            .maybeSingle();

        _todayLog = attendanceRes;

        if (attendanceRes != null && attendanceRes['check_in'] != null) {
          _checkInTime = DateTime.parse(attendanceRes['check_in']).toLocal();
          if (attendanceRes['check_out'] != null) {
            _checkOutTime =
                DateTime.parse(attendanceRes['check_out']).toLocal();
            _isPunchedIn = false;
            _punchTimer?.cancel();
          } else {
            _isPunchedIn = true;
            _startPunchTimer();
          }
        } else {
          _isPunchedIn = false;
          _checkInTime = null;
          _checkOutTime = null;
          _punchTimer?.cancel();
        }

        final presentRes = await SupabaseConfig.client
            .from('attendance_logs')
            .select('id')
            .eq('employee_id', empId)
            .gte('date', startOfMonth)
            .lte('date', endOfMonth)
            .not('check_in', 'is', null);
        _presentDays = (presentRes as List).length;

        final leaveBalanceRes = await SupabaseConfig.client
            .from('leave_balances')
            .select('remaining')
            .eq('employee_id', empId)
            .eq('leave_type', 'Casual Leave')
            .eq('year', now.year)
            .maybeSingle();
        _casualLeaveBalance =
            (leaveBalanceRes?['remaining'] as num?)?.toInt() ?? 0;

        final leaveRequestsRes = await SupabaseConfig.client
            .from('leave_requests')
            .select('id')
            .eq('employee_id', empId)
            .filter('status', 'in', ['pending', 'approved'])
            .gte('start_date', startOfMonth)
            .lte('start_date', endOfMonth);
        _thisMonthLeaveCount = (leaveRequestsRes as List).length;

        final permissionRes = await SupabaseConfig.client
            .from('permissions')
            .select('duration_minutes')
            .eq('employee_id', empId)
            .gte('date', startOfMonth)
            .lte('date', endOfMonth);

        int totalMins = 0;
        for (var p in (permissionRes as List)) {
          totalMins += (p['duration_minutes'] as int?) ?? 0;
        }
        _permissionHours = totalMins / 60.0;

        final announcementsRes = await SupabaseConfig.client
            .from('announcements')
            .select('*')
            .order('created_at', ascending: false);
        _recentAnnouncements = (announcementsRes as List).take(3).toList();

        final today = DateTime.now();
        final endDate = today.add(const Duration(days: 30));
        
        // Fetch Birthdays
        final employeesRes = await SupabaseConfig.client
            .from('employees')
            .select('employee_id, full_name, dob, photo_url');
        
        List<dynamic> birthdays = (employeesRes as List).where((emp) {
          if (emp['dob'] == null) return false;
          final dob = DateTime.parse(emp['dob']);
          final nextBirthday = DateTime(today.year, dob.month, dob.day);
          return nextBirthday.isAfter(today.subtract(const Duration(days: 1))) && 
                 nextBirthday.isBefore(endDate);
        }).map((emp) {
          final dob = DateTime.parse(emp['dob']);
          final nextBirthday = DateTime(today.year, dob.month, dob.day);
          return {
            'id': emp['employee_id'],
            'type': 'birthday',
            'title': emp['full_name'],
            'subtitle': 'Birthday in ${nextBirthday.difference(today).inDays} days',
            'date': nextBirthday,
            'image': emp['photo_url'],
            'accent': Colors.amber
          };
        }).toList();

        // Fetch Business Events
        List<dynamic> events = (announcementsRes).where((ann) {
           if (ann['post_type'] != 'Event' && ann['post_type'] != 'Holiday') return false;
           if (ann['event_date'] == null) return false;
           final evd = DateTime.parse(ann['event_date']);
           return evd.isAfter(today.subtract(const Duration(days: 1)));
        }).map((ann) {
          return {
            'id': ann['id'],
            'type': ann['post_type'] == 'Holiday' ? 'holiday' : 'event',
            'title': ann['title'],
            'subtitle': ann['post_type'],
            'date': DateTime.parse(ann['event_date']),
            'linked_id': ann['id'],
            'accent': ann['post_type'] == 'Holiday' ? Colors.teal : Colors.indigo
          };
        }).toList();

        _celebrations = [...birthdays, ...events]..sort((a,b) => (a['date'] as DateTime).compareTo(b['date']));
      }
      _fetchUnreadNotifications();
      if (mounted) setState(() => _isLoading = false);
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }


  String _getGreeting() {
    final h = DateTime.now().hour + DateTime.now().minute / 60.0;
    if (h >= 5 && h < 12) return 'Good Morning, $_firstName!';
    if (h >= 12 && h < 17) return 'Good Afternoon, $_firstName!';
    if (h >= 17 && h < 21) return 'Good Evening, $_firstName!';
    return 'Good Night, $_firstName!';
  }

  int _unreadNotifications = 0;

  Future<void> _fetchUnreadNotifications() async {
    try {
      final user = SupabaseConfig.client.auth.currentUser;
      if (user == null) return;
      final profileRes = await SupabaseConfig.client
          .from('profiles')
          .select('employee_id')
          .eq('id', user.id)
          .maybeSingle();
      if (profileRes != null && profileRes['employee_id'] != null) {
        final countRes = await SupabaseConfig.client
            .from('notifications')
            .select('id')
            .eq('employee_id', profileRes['employee_id'])
            .eq('is_read', false);
        if (mounted) {
          setState(() {
            _unreadNotifications = (countRes as List).length;
          });
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      drawer: AppDrawer(
        selectedIndex: 0,
        onItemSelected: (i) => widget.switchTab?.call(i),
      ),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1a2744),
        elevation: 0,
        title: Image.asset(
          'assets/images/4 square White Colour.png',
          height: 36,
          fit: BoxFit.contain,
        ),
        centerTitle: false,
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none, color: Colors.white),
                onPressed: () {
                  // TODO: Show notifications list
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Notifications coming soon!")),
                  );
                },
              ),
              if (_unreadNotifications > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 12,
                      minHeight: 12,
                    ),
                    child: Text(
                      '$_unreadNotifications',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: SizedBox(
              height: 220,
              width: double.infinity,
              child: RepaintBoundary(
                child: AnimatedBuilder(
                  animation: _weatherAnimationController,
                  builder: (context, child) {
                    return CustomPaint(
                      painter: SkyWeatherPainter(
                        timeOfDay: DateTime.now(),
                        weatherCondition: _weatherCondition,
                        animationValue: _weatherAnimationController.value,
                      ),
                      child: child,
                    );
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _getGreeting(),
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                      shadows: [Shadow(color: Colors.black26, offset: Offset(0, 2), blurRadius: 4)]),
                                ),
                                const SizedBox(height: 4),
                                const Row(
                                  children: [
                                    Icon(Icons.location_on, color: Colors.white70, size: 12),
                                    SizedBox(width: 4),
                                    Text("Erode, Tamil Nadu", style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w500)),
                                  ],
                                ),
                              ],
                            ),
                            if (_weatherData != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                                ),
                                child: Row(
                                  children: [
                                    Image.network(
                                      "https://openweathermap.org/img/wn/${_weatherData['weather'][0]['icon']}@2x.png",
                                      width: 32,
                                      height: 32,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      "${(_weatherData['main']['temp']).round()}°C",
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                DateFormat('hh:mm:ss a').format(_now),
                                style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w200, letterSpacing: 2),
                              ),
                              Text(
                                DateFormat('EEEE, dd MMMM yyyy').format(_now),
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: _buildPunchSection(),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 1.5,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12),
              delegate: SliverChildListDelegate([
                _buildStatCard("Present Days", "$_presentDays",
                    Icons.calendar_today, Colors.blue),
                _buildStatCard("Casual Leave", "$_casualLeaveBalance",
                    Icons.beach_access, Colors.orange),
                _buildStatCard("This Month Leave", "$_thisMonthLeaveCount",
                    Icons.event_available, Colors.green),
                _buildStatCard(
                    "Permission Hours",
                    _permissionHours.toStringAsFixed(1),
                    Icons.timer,
                    Colors.purple),
              ]),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 0),
              child: _buildTodayAttendanceSummary(),
            ),
          ),
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(16.0, 24.0, 16.0, 12.0),
            sliver: SliverToBoxAdapter(
              child: Text("Celebrations & Events",
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF333333))),
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 130,
              child: _celebrations.isEmpty 
                ? const Center(child: Text("No upcoming celebrations", style: TextStyle(color: Colors.grey, fontSize: 12)))
                : ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _celebrations.length,
                    itemBuilder: (context, index) {
                      final item = _celebrations[index];
                      return _buildCelebrationCard(item);
                    },
                  ),
            ),
          ),
          const SliverPadding(
            padding: EdgeInsets.all(16.0),
            sliver: SliverToBoxAdapter(
              child: Text("Recent Announcements",
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF333333))),
            ),
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final ann = _recentAnnouncements[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16.0, vertical: 6.0),
                  child: InkWell(
                    onTap: () {
                      if (widget.switchTab != null) widget.switchTab!(3);
                    },
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade200)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(ann['title'] ?? '',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 15)),
                          if (ann['content'] != null)
                             Padding(
                               padding: const EdgeInsets.only(top: 4.0),
                               child: Text(ann['content'], maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                             ),
                        ],
                      ),
                    ),
                  ),
                );
              },
              childCount: _recentAnnouncements.length,
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }

  Widget _buildPunchSection() {
    if (_todayLog == null || _checkInTime == null) {
      return InkWell(
        onTap: () {
          if (widget.switchTab != null) widget.switchTab!(1);
        },
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.green.shade600,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Center(
            child: Text(
              "Punch In",
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold),
            ),
          ),
        ),
      );
    } else if (_isPunchedIn && _checkOutTime == null) {
      final hours = (_elapsedSeconds ~/ 3600).toString().padLeft(2, '0');
      final minutes =
          ((_elapsedSeconds % 3600) ~/ 60).toString().padLeft(2, '0');
      final seconds = (_elapsedSeconds % 60).toString().padLeft(2, '0');

      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: Colors.lightGreen, width: 1.5),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "● Punched In",
                  style: TextStyle(
                      fontSize: 12,
                      color: Colors.green,
                      fontWeight: FontWeight.w600),
                ),
                Text(
                  "$hours:$minutes:$seconds",
                  style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1a2744)),
                ),
                Text(
                  "Since ${DateFormat('hh:mm a').format(_checkInTime!)}",
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
            ElevatedButton(
              onPressed: () {
                if (widget.switchTab != null) widget.switchTab!(1);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: const Text("Punch Out"),
            ),
          ],
        ),
      );
    } else {
      final duration = _checkOutTime!.difference(_checkInTime!);
      final hrs = duration.inHours;
      final mins = duration.inMinutes % 60;

      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFF0F4FF),
          border: Border.all(
              color: const Color(0xFF1a2744).withValues(alpha: 0.2), width: 1),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            Column(
              children: [
                const Text("Check In",
                    style: TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 4),
                Text(DateFormat('hh:mm a').format(_checkInTime!),
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Color(0xFF1a2744))),
              ],
            ),
            Container(width: 1, height: 40, color: Colors.grey.shade300),
            Column(
              children: [
                const Text("Check Out",
                    style: TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 4),
                Text(DateFormat('hh:mm a').format(_checkOutTime!),
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Color(0xFF1a2744))),
              ],
            ),
            Container(width: 1, height: 40, color: Colors.grey.shade300),
            Column(
              children: [
                const Text("Duration",
                    style: TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 4),
                Text("${hrs}h ${mins}m",
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Colors.green)),
              ],
            ),
          ],
        ),
      );
    }
  }

  Widget _buildTodayAttendanceSummary() {
    String checkInStr = "--:--";
    String checkOutStr = "--:--";
    String totalStr = "--";

    if (_todayLog == null || _checkInTime == null) {
      checkInStr = "Not punched in today";
    } else {
      checkInStr = DateFormat('hh:mm a').format(_checkInTime!);
      if (_checkOutTime != null) {
        checkOutStr = DateFormat('hh:mm a').format(_checkOutTime!);
        final diff = _checkOutTime!.difference(_checkInTime!);
        totalStr = "${diff.inHours}h ${diff.inMinutes % 60}m";
      } else {
        checkOutStr = "Working...";
      }
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Today's Attendance",
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1a2744))),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Check In",
                      style: TextStyle(color: Colors.grey, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(checkInStr,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Check Out",
                      style: TextStyle(color: Colors.grey, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(checkOutStr,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Total Hours",
                      style: TextStyle(color: Colors.grey, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(totalStr,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: Colors.green)),
                ],
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildCelebrationCard(Map<String, dynamic> item) {
    final bool isToday = DateFormat('yyyy-MM-dd').format(item['date'] as DateTime) == DateFormat('yyyy-MM-dd').format(DateTime.now());
    
    return Container(
      width: 200,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isToday ? Colors.amber.withValues(alpha: 0.5) : Colors.transparent, width: 2),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (item['image'] != null && (item['image'] as String).isNotEmpty)
                CircleAvatar(radius: 16, backgroundImage: NetworkImage(item['image']))
              else
                CircleAvatar(
                  radius: 16,
                  backgroundColor: (item['accent'] as Color).withValues(alpha: 0.1),
                  child: Icon(item['type'] == 'birthday' ? Icons.cake : Icons.event, size: 14, color: item['accent']),
                ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  item['title'],
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            item['subtitle'],
            style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                DateFormat('dd MMM').format(item['date']),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF1a2744)),
              ),
              if (isToday)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.amber, borderRadius: BorderRadius.circular(4)),
                  child: const Text("TODAY", style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String val, IconData icon, Color color) {

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade100)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(height: 4),
          Text(val,
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          Text(label,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
        ],
      ),
    );
  }
}

class SkyWeatherPainter extends CustomPainter {
  final DateTime timeOfDay;
  final String weatherCondition;
  final double animationValue;

  static final List<double> _rainOffsetsX =
      List.generate(20, (index) => math.Random(index).nextDouble());
  static final List<double> _rainOffsetsY =
      List.generate(20, (index) => math.Random(index + 20).nextDouble());
  static final List<double> _snowOffsetsX =
      List.generate(15, (index) => math.Random(index + 40).nextDouble());
  static final List<double> _snowOffsetsY =
      List.generate(15, (index) => math.Random(index + 60).nextDouble());
  static final List<double> _cloudOffsets = [0.1, 0.4, 0.7];

  SkyWeatherPainter({
    required this.timeOfDay,
    required this.weatherCondition,
    required this.animationValue,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final progressInDay = timeOfDay.hour + timeOfDay.minute / 60.0;

    List<Color> gradColors;
    if (progressInDay >= 5 && progressInDay < 8) {
      gradColors = [
        const Color(0xFFFFB347),
        const Color(0xFFFFCB8E),
        const Color(0xFFFFE0B2)
      ];
    } else if (progressInDay >= 8 && progressInDay < 12) {
      gradColors = [
        const Color(0xFF64B5F6),
        const Color(0xFF90CAF9),
        const Color(0xFFBBDEFB)
      ];
    } else if (progressInDay >= 12 && progressInDay < 15) {
      gradColors = [
        const Color(0xFF42A5F5),
        const Color(0xFF64B5F6),
        const Color(0xFF90CAF9)
      ];
    } else if (progressInDay >= 15 && progressInDay < 18.5) {
      gradColors = [
        const Color(0xFFFFB74D),
        const Color(0xFFFFCC80),
        const Color(0xFFFFE0B2)
      ];
    } else if (progressInDay >= 18.5 && progressInDay < 20) {
      gradColors = [
        const Color(0xFF9575CD),
        const Color(0xFFBA68C8),
        const Color(0xFFFF8A65)
      ];
    } else {
      gradColors = [
        const Color(0xFF1A237E),
        const Color(0xFF283593),
        const Color(0xFF3949AB)
      ];
    }

    final gradient = LinearGradient(
        colors: gradColors,
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter);
    canvas.drawRect(rect, Paint()..shader = gradient.createShader(rect));

    if (progressInDay >= 5 && progressInDay < 20) {
      final sunProgress = ((progressInDay - 5) / 14.0).clamp(0.0, 1.0);
      final sunX = sunProgress * size.width;
      final sunY = size.height - math.sin(sunProgress * math.pi) * 165;

      canvas.drawCircle(Offset(sunX, sunY), 20,
          Paint()..color = const Color(0xFFFFF9C4).withValues(alpha: 0.8));
      canvas.drawCircle(Offset(sunX, sunY), 12,
          Paint()..color = Colors.white.withValues(alpha: 0.6));

      if (weatherCondition == "Clear" || weatherCondition == "Clouds") {
        double pulse = 1.0 + 0.1 * math.sin(animationValue * 10 * math.pi * 2);
        final glowGrad = RadialGradient(
          colors: [
            const Color(0xFFFFFFCC).withValues(alpha: 0.3),
            Colors.transparent
          ],
        );
        canvas.drawCircle(
            Offset(sunX, sunY),
            20 * pulse,
            Paint()
              ..shader = glowGrad.createShader(Rect.fromCircle(
                  center: Offset(sunX, sunY), radius: 20 * pulse)));
      }
    } else {
      final moonX = size.width * 0.8;
      final moonY = size.height * 0.4;
      canvas.drawCircle(Offset(moonX, moonY), 20,
          Paint()..color = Colors.white.withValues(alpha: 0.8));
      canvas.drawCircle(
          Offset(moonX - 6, moonY - 6), 18, Paint()..color = gradColors[0]);

      if (weatherCondition == "Clear") {
        final random = math.Random(1);
        for (int i = 0; i < 8; i++) {
          final sx = random.nextDouble() * size.width;
          final sy = random.nextDouble() * (size.height * 0.7);
          canvas.drawCircle(
              Offset(sx, sy),
              1.5,
              Paint()
                ..color = Colors.white
                    .withValues(alpha: 0.5 + 0.5 * math.sin(timeOfDay.second + i)));
        }
      }
    }

    bool showClouds = ["Clouds", "Rain", "Thunderstorm", "Drizzle", "Mist"]
        .contains(weatherCondition);
    bool showMist = ["Mist", "Haze", "Fog"].contains(weatherCondition);
    bool showRain =
        ["Rain", "Drizzle", "Thunderstorm"].contains(weatherCondition);
    bool showThunder = weatherCondition == "Thunderstorm";
    bool showSnow = weatherCondition == "Snow";

    if (weatherCondition == "Clear" || weatherCondition == "Clouds") {
      final birdPaint = Paint()
        ..color = Colors.black.withValues(alpha: 0.4)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0;

      final birdSpeeds = [0.8, 1.2, 0.9];
      final birdYOffsets = [0.15, 0.25, 0.2];
      final birdStartX = [0.1, 0.4, 0.7];

      for (int i = 0; i < 3; i++) {
        double currentXFunc =
            (birdStartX[i] + animationValue * birdSpeeds[i]) % 1.0;
        double x = currentXFunc * (size.width + 100) - 50;
        double y = size.height * birdYOffsets[i];

        double flap = math.sin((animationValue * 40.0 + i) * math.pi);
        double wingHeight = 1.0 + 1.5 * flap; // subtle flap mapping

        canvas.drawArc(
            Rect.fromCenter(
                center: Offset(x - 2.0, y),
                width: 4.0,
                height: wingHeight * 2 + 0.5),
            math.pi,
            math.pi,
            false,
            birdPaint);
        canvas.drawArc(
            Rect.fromCenter(
                center: Offset(x + 2.0, y),
                width: 4.0,
                height: wingHeight * 2 + 0.5),
            math.pi,
            math.pi,
            false,
            birdPaint);
      }
    }

    if (showClouds) {
      double cloudOpacity = 0.5;
      Color cloudColor = Colors.white;
      if (["Rain", "Thunderstorm"].contains(weatherCondition)) {
        cloudOpacity = 0.6;
        cloudColor = const Color(0xFFB0BEC5);
      } else if (showMist) {
        cloudOpacity = 0.3;
      }

      for (int i = 0; i < 3; i++) {
        double startX = _cloudOffsets[i];
        double currentXFunc = (startX + animationValue * (20.0 / 30.0)) % 1.0;
        double x = currentXFunc * (size.width + 100) - 50;
        double y = 30.0 + i * 20.0;

        final paint = Paint()..color = cloudColor.withValues(alpha: cloudOpacity);
        canvas.drawOval(
            Rect.fromCenter(center: Offset(x, y), width: 60, height: 30),
            paint);
        canvas.drawOval(
            Rect.fromCenter(
                center: Offset(x - 15, y + 5), width: 40, height: 25),
            paint);
        canvas.drawOval(
            Rect.fromCenter(
                center: Offset(x + 15, y + 5), width: 45, height: 25),
            paint);
      }
    }

    if (showMist) {
      double mistOpacity =
          0.2 + 0.1 * math.sin(animationValue * 5 * math.pi * 2);
      final paint = Paint()..color = Colors.white.withValues(alpha: mistOpacity);
      canvas.drawRect(
          Rect.fromLTWH(0, size.height * 0.4, size.width, 40), paint);
      canvas.drawRect(
          Rect.fromLTWH(0, size.height * 0.6, size.width, 30), paint);
    }

    if (showRain) {
      final rainPaint = Paint()
        ..color = Colors.lightBlue.withValues(alpha: 0.6)
        ..strokeWidth = 1.5;

      for (int i = 0; i < 20; i++) {
        double phase = _rainOffsetsY[i];
        double dropAnim = (animationValue * 25 + phase) % 1.0;
        double startX = _rainOffsetsX[i] * size.width;
        double startY = dropAnim * size.height - 20;
        canvas.drawLine(
            Offset(startX, startY), Offset(startX + 4, startY + 12), rainPaint);
      }
    }

    if (showSnow) {
      final snowPaint = Paint()..color = Colors.white.withValues(alpha: 0.8);
      for (int i = 0; i < 15; i++) {
        double phaseY = _snowOffsetsY[i];
        double dropAnim = (animationValue * (20.0 / 3.0) + phaseY) % 1.0;
        double startY = dropAnim * size.height - 10;

        double phaseX = _snowOffsetsX[i];
        double sway = math.sin((animationValue * 20 + phaseX * 10)) * 10;
        double startX = phaseX * size.width + sway;
        double radius = 3.0 + (phaseX * 2.0);

        canvas.drawCircle(Offset(startX, startY), radius, snowPaint);
      }
    }

    if (showThunder) {
      double flashCycle = (animationValue * (20.0 / 3.0)) % 1.0;
      double opacity = 0.0;
      if (flashCycle < 0.1) {
        opacity = math.sin((flashCycle / 0.1) * math.pi);
      }

      if (opacity > 0) {
        final thunderPaint = Paint()
          ..color = Colors.yellow.withValues(alpha: opacity)
          ..strokeWidth = 2.0
          ..style = PaintingStyle.stroke;

        double x = 0.5 * size.width;
        double y = 20.0;

        Path path = Path()..moveTo(x, y);
        path.lineTo(x - 10, y + 20);
        path.lineTo(x + 5, y + 25);
        path.lineTo(x - 15, y + 50);
        path.lineTo(x, y + 45);
        path.lineTo(x - 20, y + 80);

        canvas.drawPath(path, thunderPaint);
        canvas.drawRect(
            rect, Paint()..color = Colors.white.withValues(alpha: opacity * 0.3));
      }
    }
  }

  @override
  bool shouldRepaint(covariant SkyWeatherPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue ||
        oldDelegate.weatherCondition != weatherCondition ||
        oldDelegate.timeOfDay != timeOfDay;
  }
}
