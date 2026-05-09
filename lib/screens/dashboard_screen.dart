import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/supabase_config.dart';
import '../widgets/app_drawer.dart';
import '../widgets/dashboard_brand_logo.dart';

class DashboardScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const DashboardScreen({Key? key, this.switchTab}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String _employeeId = '';
  String _greetingName = 'Employee';
  bool _isLoading = true;
  bool _isPunchedIn = false;
  int _presentDays = 0;
  int _casualLeaveBalance = 0;
  int _thisMonthLeaveCount = 0;
  double _permissionHours = 0;
  int _elapsedSeconds = 0;
  DateTime? _checkInTime;
  DateTime? _checkOutTime;
  Map<String, dynamic>? _todayLog;
  List<Map<String, dynamic>> _recentAnnouncements = [];
  List<Map<String, dynamic>> _notifications = [];
  List<_CelebrationItem> _celebrations = [];
  Timer? _punchTimer;
  StreamSubscription<List<Map<String, dynamic>>>? _notificationSubscription;

  @override
  void initState() {
    super.initState();
    _fetchDashboardData();
  }

  @override
  void dispose() {
    _punchTimer?.cancel();
    _notificationSubscription?.cancel();
    super.dispose();
  }

  Future<void> _fetchDashboardData() async {
    if (mounted) setState(() => _isLoading = true);
    try {
      final user = SupabaseConfig.client.auth.currentUser;
      if (user == null) return;
      final profile = await SupabaseConfig.client
          .from('profiles')
          .select('employee_id')
          .eq('id', user.id)
          .maybeSingle();
      if (profile == null || profile['employee_id'] == null) return;
      _employeeId = profile['employee_id'] as String;
      final now = DateTime.now();
      final today = DateFormat('yyyy-MM-dd').format(now);
      final start =
          DateTime(now.year, now.month, 1).toIso8601String().split('T')[0];
      final end =
          DateTime(now.year, now.month + 1, 0).toIso8601String().split('T')[0];
      final results = await Future.wait([
        SupabaseConfig.client
            .from('employees')
            .select('full_name')
            .eq('employee_id', _employeeId)
            .maybeSingle(),
        SupabaseConfig.client
            .from('attendance_logs')
            .select()
            .eq('employee_id', _employeeId)
            .eq('date', today)
            .maybeSingle(),
        SupabaseConfig.client
            .from('attendance_logs')
            .select('id')
            .eq('employee_id', _employeeId)
            .gte('date', start)
            .lte('date', end)
            .not('check_in', 'is', null),
        SupabaseConfig.client
            .from('leave_balances')
            .select('remaining')
            .eq('employee_id', _employeeId)
            .eq('leave_type', 'Casual Leave')
            .eq('year', now.year)
            .maybeSingle(),
        SupabaseConfig.client
            .from('leave_requests')
            .select('id')
            .eq('employee_id', _employeeId)
            .inFilter('status', ['pending', 'approved'])
            .gte('start_date', start)
            .lte('start_date', end),
        SupabaseConfig.client
            .from('permissions')
            .select('duration_minutes')
            .eq('employee_id', _employeeId)
            .gte('date', start)
            .lte('date', end),
        SupabaseConfig.client
            .from('announcements')
            .select('*')
            .order('created_at', ascending: false)
            .limit(3),
        SupabaseConfig.client.from('employees').select(
            'employee_id, full_name, photo_url, date_of_birth, dob, joining_date, join_date'),
      ]);
      final employee = results[0] as Map<String, dynamic>?;
      _todayLog = results[1] as Map<String, dynamic>?;
      _presentDays = (results[2] as List).length;
      _casualLeaveBalance =
          ((results[3] as Map<String, dynamic>?)?['remaining'] as num?)
                  ?.toInt() ??
              0;
      _thisMonthLeaveCount = (results[4] as List).length;
      _recentAnnouncements =
          (results[6] as List).map((e) => Map<String, dynamic>.from(e)).toList();
      _celebrations = _buildCelebrations(
        (results[7] as List).map((e) => Map<String, dynamic>.from(e)).toList(),
      );
      if (employee != null && employee['full_name'] != null) {
        final fullName = (employee['full_name'] as String).trim();
        if (fullName.isNotEmpty) _greetingName = fullName.split(' ').first;
      }
      int totalMinutes = 0;
      for (final item in (results[5] as List)) {
        totalMinutes += (item['duration_minutes'] as int?) ?? 0;
      }
      _permissionHours = totalMinutes / 60;
      _preparePunchState();
      _startNotificationStream();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _preparePunchState() {
    if (_todayLog == null || _todayLog!['check_in'] == null) {
      _todayLog = null;
      _checkInTime = null;
      _checkOutTime = null;
      _isPunchedIn = false;
      _punchTimer?.cancel();
      return;
    }
    _checkInTime = DateTime.parse(_todayLog!['check_in'] as String).toLocal();
    if (_todayLog!['check_out'] != null) {
      _checkOutTime =
          DateTime.parse(_todayLog!['check_out'] as String).toLocal();
      _isPunchedIn = false;
      _punchTimer?.cancel();
      return;
    }
    _checkOutTime = null;
    _isPunchedIn = true;
    _startPunchTimer();
  }

  void _startPunchTimer() {
    _punchTimer?.cancel();
    if (_checkInTime == null) return;
    _elapsedSeconds = DateTime.now().difference(_checkInTime!).inSeconds;
    _punchTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _checkInTime == null) return;
      setState(() {
        _elapsedSeconds = DateTime.now().difference(_checkInTime!).inSeconds;
      });
    });
  }

  void _startNotificationStream() {
    _notificationSubscription?.cancel();
    if (_employeeId.isEmpty) return;
    _notificationSubscription = SupabaseConfig.client
        .from('notifications')
        .stream(primaryKey: ['id'])
        .eq('recipient_employee_id', _employeeId)
        .order('created_at', ascending: false)
        .limit(20)
        .listen((rows) {
      if (!mounted) return;
      setState(() {
        _notifications = rows.map((e) => Map<String, dynamic>.from(e)).toList();
      });
        });
  }

  List<_CelebrationItem> _buildCelebrations(
      List<Map<String, dynamic>> employees) {
    final now = DateUtils.dateOnly(DateTime.now());
    final items = <_CelebrationItem>[];
    for (final employee in employees) {
      final name = (employee['full_name'] as String?)?.trim();
      if (name == null || name.isEmpty) continue;
      final birthdayRaw = employee['date_of_birth'] ?? employee['dob'];
      if (birthdayRaw is String) {
        final dt = DateTime.tryParse(birthdayRaw);
        if (dt != null) {
          final next = _nextOccurrence(now, dt.month, dt.day);
          final diff = next.difference(now).inDays;
          if (diff >= 0 && diff <= 30) {
            items.add(_CelebrationItem(
              id: 'birthday-${employee['employee_id']}',
              type: 'Birthday',
              title: name,
              subtitle: diff == 0
                  ? 'Celebrating today'
                  : 'Birthday in $diff day${diff == 1 ? '' : 's'}',
              date: next,
              photoUrl: employee['photo_url'] as String?,
            ));
          }
        }
      }
      final anniversaryRaw = employee['joining_date'] ?? employee['join_date'];
      if (anniversaryRaw is String) {
        final dt = DateTime.tryParse(anniversaryRaw);
        if (dt != null) {
          final next = _nextOccurrence(now, dt.month, dt.day);
          final diff = next.difference(now).inDays;
          if (diff >= 0 && diff <= 30) {
            final years = next.year - dt.year;
            items.add(_CelebrationItem(
              id: 'anniversary-${employee['employee_id']}',
              type: 'Anniversary',
              title: name,
              subtitle: diff == 0
                  ? '$years year${years == 1 ? '' : 's'} with FSQ today'
                  : 'Work anniversary in $diff day${diff == 1 ? '' : 's'}',
              date: next,
              photoUrl: employee['photo_url'] as String?,
            ));
          }
        }
      }
    }
    items.sort((a, b) => a.date.compareTo(b.date));
    return items.take(8).toList();
  }

  DateTime _nextOccurrence(DateTime now, int month, int day) {
    final current = DateTime(now.year, month, day);
    return current.isBefore(now) ? DateTime(now.year + 1, month, day) : current;
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning, $_greetingName!';
    if (hour < 17) return 'Good Afternoon, $_greetingName!';
    if (hour < 21) return 'Good Evening, $_greetingName!';
    return 'Good Night, $_greetingName!';
  }

  String _timeAgo(DateTime dateTime) {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hr ago';
    if (diff.inDays < 7) return '${diff.inDays} day ago';
    return DateFormat('dd MMM').format(dateTime);
  }

  IconData _notificationIcon(Map<String, dynamic> item) {
    final signal =
        '${item['type'] ?? ''} ${item['reference_type'] ?? ''}'.toLowerCase();
    if (signal.contains('announcement')) return Icons.campaign_rounded;
    if (signal.contains('birthday') || signal.contains('anniversary')) {
      return Icons.celebration_rounded;
    }
    if (signal.contains('permission')) return Icons.timer_rounded;
    if (signal.contains('leave')) return Icons.event_note_rounded;
    return Icons.notifications_active_rounded;
  }

  Future<void> _markRead(dynamic id) async {
    if (id == null) return;
    await SupabaseConfig.client
        .from('notifications')
        .update({'is_read': true}).eq('id', id);
  }

  Future<void> _handleNotificationTap(
      BuildContext context, Map<String, dynamic> item) async {
    Navigator.of(context).pop();
    await _markRead(item['id']);
    if (!mounted) return;
    final signal =
        '${item['type'] ?? ''} ${item['reference_type'] ?? ''}'.toLowerCase();
    if (signal.contains('announcement')) {
      widget.switchTab?.call(3);
    } else if (signal.contains('leave') || signal.contains('permission')) {
      widget.switchTab?.call(2);
    } else {
      ScaffoldMessenger.of(this.context).showSnackBar(
        SnackBar(
          content: Text(item['title'] as String? ?? 'Notification opened'),
        ),
      );
    }
  }

  void _openNotifications() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _NotificationSheet(
        employeeId: _employeeId,
        notifications: _notifications,
        iconFor: _notificationIcon,
        timeAgo: _timeAgo,
        onTap: (item) => _handleNotificationTap(context, item),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _notifications.any((e) => e['is_read'] != true);
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      drawer: AppDrawer(
        selectedIndex: 0,
        onItemSelected: widget.switchTab,
      ),
      drawerEnableOpenDragGesture: true,
      drawerEdgeDragWidth: 28,
      appBar: AppBar(
        leading: Builder(
          builder: (context) => IconButton(
            tooltip: 'Open menu',
            icon: const Icon(Icons.menu_rounded, color: Colors.white),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        title: LayoutBuilder(
          builder: (context, constraints) {
            final logoWidth = constraints.maxWidth > 420 ? 122.0 : 104.0;
            return Align(
              alignment: Alignment.centerLeft,
              child: DashboardBrandLogo(
                width: logoWidth,
                height: 40,
                padding: const EdgeInsets.all(8),
                backgroundColor: Colors.white.withValues(alpha: 0.08),
                borderColor: Colors.white.withValues(alpha: 0.10),
                borderRadius: 16,
              ),
            );
          },
        ),
        actions: [
          Stack(
            children: [
              IconButton(
                tooltip: 'Open notifications',
                onPressed: _openNotifications,
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  color: Colors.white,
                ),
              ),
              if (hasUnread)
                const Positioned(
                  right: 12,
                  top: 12,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Color(0xFFFF4D4F),
                      shape: BoxShape.circle,
                    ),
                    child: SizedBox(width: 10, height: 10),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _FadeUp(delay: 0, child: _header()),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _FadeUp(delay: 80, child: _celebrationsSection()),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _FadeUp(delay: 140, child: _punchCard()),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _FadeUp(delay: 200, child: _statsGrid()),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _FadeUp(delay: 260, child: _attendanceSummary()),
            ),
          ),
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 18, 16, 10),
              child: Text(
                'Recent Announcements',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1C2D46),
                ),
              ),
            ),
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final item = _recentAnnouncements[index];
                return Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: _FadeUp(
                    delay: 320 + (index * 50),
                    child: RepaintBoundary(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(22),
                        onTap: () => widget.switchTab?.call(3),
                        child: Ink(
                          padding: const EdgeInsets.all(16),
                          decoration: _cardDecoration(),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['title'] as String? ?? 'Update',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                  color: Color(0xFF1D2D45),
                                ),
                              ),
                              if ((item['content'] as String?)?.isNotEmpty ??
                                  false) ...[
                                const SizedBox(height: 8),
                                Text(
                                  item['content'] as String,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    height: 1.4,
                                    color: Color(0xFF6A778B),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
              childCount: _recentAnnouncements.length,
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 28)),
        ],
      ),
    );
  }

  Widget _header() => RepaintBoundary(
        child: Container(
          padding: const EdgeInsets.all(22),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF162741),
                Color(0xFF1E3A5F),
                Color(0xFF2E86AB),
              ],
            ),
            borderRadius: BorderRadius.all(Radius.circular(28)),
            boxShadow: [
              BoxShadow(
                color: Color(0x261E3A5F),
                blurRadius: 28,
                offset: Offset(0, 16),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text(
                  'Enterprise Dashboard',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _greeting(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Track attendance, leave balances, and people updates from one premium workspace.',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.78),
                  height: 1.4,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      );

  Widget _celebrationsSection() => Container(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
        decoration: _cardDecoration(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEF5FF),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.celebration_rounded,
                    color: Color(0xFF1E3A5F),
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Celebrations',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1C2D46),
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Upcoming birthdays and anniversaries',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF74839A),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_celebrations.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFFF7F9FC),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'No celebrations are scheduled for the next few weeks.',
                  style: TextStyle(
                    color: Color(0xFF708097),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              )
            else
              RepaintBoundary(
                child: SizedBox(
                  height: 156,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    itemCount: _celebrations.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, index) =>
                        _CelebrationCard(item: _celebrations[index]),
                  ),
                ),
              ),
          ],
        ),
      );

  Widget _statsGrid() => GridView.count(
        shrinkWrap: true,
        crossAxisCount: 2,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 1.16,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        children: [
          _statCard(
            'Present Days',
            '$_presentDays',
            Icons.calendar_today_rounded,
            const Color(0xFF2E86AB),
          ),
          _statCard(
            'Casual Leave',
            '$_casualLeaveBalance',
            Icons.beach_access_rounded,
            const Color(0xFFF59E0B),
          ),
          _statCard(
            'This Month Leave',
            '$_thisMonthLeaveCount',
            Icons.event_available_rounded,
            const Color(0xFF16A34A),
          ),
          _statCard(
            'Permission Hours',
            _permissionHours.toStringAsFixed(1),
            Icons.timer_rounded,
            const Color(0xFF7C3AED),
          ),
        ],
      );

  Widget _statCard(String label, String value, IconData icon, Color accent) =>
      RepaintBoundary(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: _cardDecoration(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, size: 18, color: accent),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1D2C43),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    style: const TextStyle(
                      color: Color(0xFF708097),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );

  Widget _punchCard() {
    if (_todayLog == null || _checkInTime == null) {
      return InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => widget.switchTab?.call(1),
        child: Ink(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF16A34A), Color(0xFF22C55E)],
            ),
            borderRadius: BorderRadius.all(Radius.circular(24)),
            boxShadow: [
              BoxShadow(
                color: Color(0x2516A34A),
                blurRadius: 18,
                offset: Offset(0, 10),
              ),
            ],
          ),
          child: const Center(
            child: Text(
              'Punch In',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      );
    }
    if (_isPunchedIn && _checkOutTime == null) {
      final hours = (_elapsedSeconds ~/ 3600).toString().padLeft(2, '0');
      final minutes =
          ((_elapsedSeconds % 3600) ~/ 60).toString().padLeft(2, '0');
      final seconds = (_elapsedSeconds % 60).toString().padLeft(2, '0');
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: _cardDecoration(borderColor: const Color(0xFFB9E6C8)),
        child: Row(
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: const BoxDecoration(
                color: Color(0xFF16A34A),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Punched In',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF16A34A),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '$hours:$minutes:$seconds',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1D2C43),
                    ),
                  ),
                  Text(
                    'Since ${DateFormat('hh:mm a').format(_checkInTime!)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF76859A),
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () => widget.switchTab?.call(1),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
              ),
              child: const Text('Punch Out'),
            ),
          ],
        ),
      );
    }
    final diff = _checkOutTime!.difference(_checkInTime!);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: _cardDecoration(),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _summaryCol('Check In', DateFormat('hh:mm a').format(_checkInTime!)),
          _divider(),
          _summaryCol(
              'Check Out', DateFormat('hh:mm a').format(_checkOutTime!)),
          _divider(),
          _summaryCol(
            'Duration',
            '${diff.inHours}h ${diff.inMinutes % 60}m',
            valueColor: const Color(0xFF16A34A),
          ),
        ],
      ),
    );
  }

  Widget _attendanceSummary() {
    String checkIn = '--', checkOut = '--', total = '--';
    if (_todayLog == null || _checkInTime == null) {
      checkIn = 'Not punched in';
    } else {
      checkIn = DateFormat('hh:mm a').format(_checkInTime!);
      if (_checkOutTime != null) {
        checkOut = DateFormat('hh:mm a').format(_checkOutTime!);
        final diff = _checkOutTime!.difference(_checkInTime!);
        total = '${diff.inHours}h ${diff.inMinutes % 60}m';
      } else {
        checkOut = 'Working';
      }
    }
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: _cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Today\'s Attendance',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1D2C43),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _summaryCol('Check In', checkIn),
              _summaryCol('Check Out', checkOut),
              _summaryCol(
                'Total Hours',
                total,
                valueColor: const Color(0xFF16A34A),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryCol(String label, String value, {Color? valueColor}) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: Color(0xFF8694A7), fontSize: 12),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: valueColor ?? const Color(0xFF1D2C43),
            ),
          ),
        ],
      );

  Widget _divider() =>
      Container(width: 1, height: 36, color: const Color(0xFFE5EAF1));

  BoxDecoration _cardDecoration(
          {Color borderColor = const Color(0xFFE5EAF2)}) =>
      BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0D14253B),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      );
}

class _CelebrationItem {
  final String id;
  final String type;
  final String title;
  final String subtitle;
  final DateTime date;
  final String? photoUrl;

  const _CelebrationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.date,
    required this.photoUrl,
  });
}

class _CelebrationCard extends StatelessWidget {
  final _CelebrationItem item;

  const _CelebrationCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final colors = item.type == 'Birthday'
        ? const [Color(0xFFFFC766), Color(0xFFFF8A65)]
        : const [Color(0xFFA78BFA), Color(0xFF6366F1)];
    return RepaintBoundary(
      child: Container(
        width: 184,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: colors),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: Colors.white.withValues(alpha: 0.18),
                  backgroundImage: item.photoUrl != null &&
                          item.photoUrl!.isNotEmpty
                      ? NetworkImage(item.photoUrl!)
                      : null,
                  child: item.photoUrl == null || item.photoUrl!.isEmpty
                      ? Text(
                          item.title.substring(0, 1).toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        )
                      : null,
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    item.type,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const Spacer(),
            Text(
              item.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              item.subtitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.86),
                fontSize: 12,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              DateFormat('dd MMM').format(item.date),
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationSheet extends StatelessWidget {
  final String employeeId;
  final List<Map<String, dynamic>> notifications;
  final IconData Function(Map<String, dynamic>) iconFor;
  final String Function(DateTime) timeAgo;
  final Future<void> Function(Map<String, dynamic>) onTap;

  const _NotificationSheet({
    required this.employeeId,
    required this.notifications,
    required this.iconFor,
    required this.timeAgo,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasUnread = notifications.any((e) => e['is_read'] != true);
    return RepaintBoundary(
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.74,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            Container(
              width: 46,
              height: 5,
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFD6DCE8),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Notification Center',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E2C45),
                      ),
                    ),
                  ),
                  if (hasUnread)
                    TextButton(
                      onPressed: () async {
                        await SupabaseConfig.client
                            .from('notifications')
                            .update({'is_read': true}).eq(
                                'recipient_employee_id', employeeId).eq(
                                'is_read', false);
                        if (context.mounted) Navigator.of(context).pop();
                      },
                      child: const Text('Mark all as read'),
                    ),
                ],
              ),
            ),
            Expanded(
              child: notifications.isEmpty
                  ? const Center(
                      child: Text(
                        'No notifications yet',
                        style: TextStyle(
                          color: Color(0xFF6A778B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(18, 0, 18, 20),
                      itemCount: notifications.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final item = notifications[index];
                        final isRead = item['is_read'] == true;
                        final createdAt = DateTime.tryParse(
                            item['created_at']?.toString() ?? '');
                        return RepaintBoundary(
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              borderRadius: BorderRadius.circular(22),
                              onTap: () => onTap(item),
                              child: Ink(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: isRead
                                      ? const Color(0xFFF7F9FC)
                                      : const Color(0xFFEFF5FF),
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(
                                    color: isRead
                                        ? const Color(0xFFE3E8F1)
                                        : const Color(0xFFD8E8FF),
                                  ),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      height: 42,
                                      width: 42,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF1E3A5F)
                                            .withValues(alpha: 0.10),
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                      child: Icon(
                                        iconFor(item),
                                        color: const Color(0xFF1E3A5F),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  item['title'] as String? ??
                                                      'Notification',
                                                  style: const TextStyle(
                                                    fontWeight: FontWeight.w700,
                                                    color: Color(0xFF1B2A42),
                                                  ),
                                                ),
                                              ),
                                              if (!isRead)
                                                Container(
                                                  width: 8,
                                                  height: 8,
                                                  decoration:
                                                      const BoxDecoration(
                                                    color: Color(0xFFFF4D4F),
                                                    shape: BoxShape.circle,
                                                  ),
                                                ),
                                            ],
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            item['message'] as String? ??
                                                'Open to view more details.',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: Color(0xFF69788F),
                                              height: 1.4,
                                            ),
                                          ),
                                          if (createdAt != null) ...[
                                            const SizedBox(height: 8),
                                            Text(
                                              timeAgo(createdAt),
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: Color(0xFF8B98AB),
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ],
                                        ],
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

class _FadeUp extends StatelessWidget {
  final Widget child;
  final int delay;

  const _FadeUp({required this.child, required this.delay});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 420 + delay),
      curve: Curves.easeOutCubic,
      child: child,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, (1 - value) * 18),
          child: child,
        ),
      ),
    );
  }
}
