import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:async';
import '../services/supabase_config.dart';
import '../services/permission_service.dart';
import '../widgets/app_drawer.dart';

class AttendanceScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const AttendanceScreen({Key? key, this.switchTab}) : super(key: key);

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _isLoading = true;
  String? _employeeId;
  String? _workLocation;
  String? _selectedOffice;

  // Punch State
  bool _isPunchedIn = false;
  bool _isPunchedOut = false;
  DateTime? _punchInTime;
  DateTime? _punchOutTime;
  Map<String, dynamic>? _todayLog;

  // Timer
  Timer? _timer;
  Duration _elapsed = Duration.zero;

  // Calendar & Stats
  Map<DateTime, Map<String, dynamic>> _attendanceMap = {};
  List<dynamic> _monthlyLogs = [];
  List<dynamic> _leaves = [];
  List<dynamic> _holidays = [];

  int _presentCount = 0;
  int _absentCount = 0;
  double _totalHoursCount = 0;

  // Office Data
  final Map<String, dynamic> _offices = {
    'Main Office': {
      'lat': 11.3292918,
      'lng': 77.7007555,
      'radius': 100.0,
    },
    'Showroom': {
      'lat': 11.3319983,
      'lng': 77.7012905,
      'radius': 50.0,
    },
  };

  @override
  void initState() {
    super.initState();
    _initializeScreen();
  }

  @override
  void dispose() {
    _stopTimer();
    super.dispose();
  }

  Future<void> _initializeScreen() async {
    setState(() => _isLoading = true);
    await _loadEmployeeProfile();
    if (_employeeId != null) {
      await _loadTodayAttendance();
      await _loadMonthAttendance();
      _calculateStats();
    }
    setState(() => _isLoading = false);

    if (_isPunchedIn && !_isPunchedOut && _punchInTime != null) {
      _elapsed = DateTime.now().difference(_punchInTime!);
      _startTimer();
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_punchInTime != null && mounted) {
        setState(() {
          _elapsed = DateTime.now().difference(_punchInTime!);
        });
      }
    });
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  String get _timerDisplay {
    final h = _elapsed.inHours.toString().padLeft(2, '0');
    final m = (_elapsed.inMinutes % 60).toString().padLeft(2, '0');
    final s = (_elapsed.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  Future<void> _loadEmployeeProfile() async {
    try {
      final user = SupabaseConfig.client.auth.currentUser;
      if (user == null) return;

      final profileRes = await SupabaseConfig.client
          .from('profiles')
          .select('employee_id')
          .eq('id', user.id)
          .maybeSingle();

      if (profileRes != null && profileRes['employee_id'] != null) {
        _employeeId = profileRes['employee_id'];
        final empRes = await SupabaseConfig.client
            .from('employees')
            .select('work_location')
            .eq('employee_id', _employeeId!)
            .maybeSingle();
        _workLocation = empRes?['work_location'] ?? 'Main Office';
      }
    } catch (e) {
      debugPrint('Profile load error: $e');
    }
  }

  Future<void> _loadTodayAttendance() async {
    if (_employeeId == null) return;
    try {
      final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final todayRes = await SupabaseConfig.client
          .from('attendance_logs')
          .select()
          .eq('employee_id', _employeeId!)
          .eq('date', todayStr)
          .maybeSingle();

      if (todayRes != null) {
        _todayLog = todayRes;
        _punchInTime = DateTime.parse(todayRes['check_in']).toLocal();
        _isPunchedIn = true;
        if (todayRes['check_out'] != null) {
          _punchOutTime = DateTime.parse(todayRes['check_out']).toLocal();
          _isPunchedOut = true;
        } else {
          _isPunchedOut = false;
        }
      } else {
        _isPunchedIn = false;
        _isPunchedOut = false;
        _todayLog = null;
      }
    } catch (e) {
      debugPrint('Today attendance error: $e');
    }
  }

  Future<void> _loadMonthAttendance() async {
    if (_employeeId == null) return;
    try {
      final now = DateTime.now();
      final firstDayMonth = DateTime(now.year, now.month, 1).toIso8601String().split('T')[0];
      final lastDayMonth = DateTime(now.year, now.month + 1, 0).toIso8601String().split('T')[0];

      final results = await Future.wait([
        SupabaseConfig.client.from('attendance_logs').select().eq('employee_id', _employeeId!).gte('date', firstDayMonth).lte('date', lastDayMonth),
        SupabaseConfig.client.from('leave_requests').select().eq('employee_id', _employeeId!).eq('status', 'approved').gte('start_date', firstDayMonth).lte('end_date', lastDayMonth),
        SupabaseConfig.client.from('holidays').select().gte('holiday_date', firstDayMonth).lte('holiday_date', lastDayMonth),
      ]);

      _monthlyLogs = results[0] as List;
      _leaves = results[1] as List;
      _holidays = results[2] as List;

      _attendanceMap.clear();
      for (var log in _monthlyLogs) {
        final date = DateTime.parse(log['date']);
        _attendanceMap[DateTime(date.year, date.month, date.day)] = {...log, 'status': 'present'};
      }
      for (var leave in _leaves) {
        DateTime s = DateTime.parse(leave['start_date']);
        DateTime e = DateTime.parse(leave['end_date']);
        for (int i = 0; i <= e.difference(s).inDays; i++) {
          final date = s.add(Duration(days: i));
          final key = DateTime(date.year, date.month, date.day);
          if (!_attendanceMap.containsKey(key)) {
            _attendanceMap[key] = {...leave, 'status': 'leave'};
          }
        }
      }
      for (var holiday in _holidays) {
        final date = DateTime.parse(holiday['holiday_date']);
        final key = DateTime(date.year, date.month, date.day);
        if (!_attendanceMap.containsKey(key)) {
          _attendanceMap[key] = {...holiday, 'status': 'holiday'};
        }
      }
    } catch (e) {
      debugPrint('Month attendance error: $e');
    }
  }

  void _calculateStats() {
    final now = DateTime.now();
    _presentCount = _monthlyLogs.length;
    
    int pastDays = 0;
    for (int i = 1; i < now.day; i++) {
        final d = DateTime(now.year, now.month, i);
        if (d.weekday != DateTime.sunday) pastDays++;
    }

    int leavesCount = _attendanceMap.values.where((v) => v['status'] == 'leave').length;
    int holidaysCount = _attendanceMap.values.where((v) => v['status'] == 'holiday' && DateTime.parse(v['holiday_date']).day < now.day).length;
    
    _absentCount = (pastDays - _presentCount - leavesCount - holidaysCount).clamp(0, 31);

    double totalHrs = 0;
    for (var log in _monthlyLogs) {
      if (log['check_in'] != null && log['check_out'] != null) {
        final cin = DateTime.parse(log['check_in']).toLocal();
        final cout = DateTime.parse(log['check_out']).toLocal();
        totalHrs += cout.difference(cin).inMinutes / 60.0;
      }
    }
    _totalHoursCount = totalHrs;
  }

  Future<void> _handlePunch() async {
    if (_selectedOffice == null && !_isPunchedIn) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select your office first'), backgroundColor: Colors.orange));
      return;
    }

    final bool hasPermission = await PermissionService.checkAndRequestLocation();
    if (!hasPermission) return;

    Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
    
    if (!_isPunchedIn) {
      final targetOffice = _offices[_selectedOffice];
      double distance = Geolocator.distanceBetween(
        position.latitude, position.longitude,
        targetOffice['lat'], targetOffice['lng']
      );

      if (distance > targetOffice['radius']) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('You are ${distance.toInt()}m away. Must be within ${targetOffice['radius'].toInt()}m'),
          backgroundColor: Colors.red,
        ));
        return;
      }
    }

    try {
      final now = DateTime.now();
      final nowStr = now.toUtc().toIso8601String();
      final todayStr = DateFormat('yyyy-MM-dd').format(now);
      bool isSunday = now.weekday == DateTime.sunday;

      if (!_isPunchedIn) {
        if (isSunday && _workLocation == 'Main Office') {
          await SupabaseConfig.client.from('sunday_punch_requests').insert({
            'employee_id': _employeeId,
            'date': todayStr,
            'check_in': nowStr,
            'lat': position.latitude,
            'lng': position.longitude,
            'status': 'pending'
          });
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Sunday attendance submitted for approval"), backgroundColor: Colors.green));
        } else {
          final res = await SupabaseConfig.client.from('attendance_logs').insert({
            'employee_id': _employeeId,
            'check_in': nowStr,
            'lat': position.latitude,
            'lng': position.longitude,
            'date': todayStr,
            'status': 'present'
          }).select().single();
          
          setState(() {
            _isPunchedIn = true;
            _isPunchedOut = false;
            _punchInTime = now;
            _todayLog = res;
          });
          _startTimer();
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Punched in successfully"), backgroundColor: Colors.green));
        }
      } else {
        await SupabaseConfig.client.from('attendance_logs').update({'check_out': nowStr}).eq('id', _todayLog!['id']);
        setState(() {
          _isPunchedOut = true;
          _punchOutTime = now;
        });
        _stopTimer();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Punched out successfully"), backgroundColor: Colors.green));
      }
      await _loadMonthAttendance();
      _calculateStats();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Failed to save punch log"), backgroundColor: Colors.red));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      drawer: AppDrawer(
        selectedIndex: 1,
        onItemSelected: (i) => widget.switchTab?.call(i),
      ),
      appBar: AppBar(
        title: const Text('Attendance', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            if (!_isPunchedIn) ...[
              const Text("Select Office Location", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 12),
              Row(
                children: [
                  _buildOfficeButton('Main Office'),
                  const SizedBox(width: 12),
                  _buildOfficeButton('Showroom'),
                ],
              ),
              const SizedBox(height: 24),
            ],

            if (!_isPunchedIn || !_isPunchedOut) 
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)]),
              child: Column(
                children: [
                  Text(_isPunchedIn ? "Working Today" : "Not Punched In", style: const TextStyle(fontSize: 14, color: Colors.grey, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 8),
                  Text(
                    _isPunchedIn ? _timerDisplay : "--:--:--",
                    style: TextStyle(
                      fontSize: 48, 
                      fontWeight: FontWeight.bold, 
                      color: _isPunchedIn ? const Color(0xFFD32F2F) : const Color(0xFF1B2E4B)
                    ),
                  ),
                  if (_isPunchedIn) 
                    Text(
                      "Punched at: ${DateFormat('hh:mm a').format(_punchInTime!)}",
                      style: TextStyle(fontSize: 14, color: Colors.blue.shade700, fontWeight: FontWeight.bold),
                    ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: _handlePunch,
                      icon: Icon(_isPunchedIn ? Icons.logout : Icons.login, color: Colors.white),
                      label: Text(
                        _isPunchedIn ? "Punch Out" : "Punch In",
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _isPunchedIn ? const Color(0xFFD32F2F) : const Color(0xFF2E7D32),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            if (_isPunchedIn && _isPunchedOut)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.green.shade200)),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.green, size: 40),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("Attendance Completed", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.green)),
                        Text("In: ${DateFormat('hh:mm a').format(_punchInTime!)}  Out: ${DateFormat('hh:mm a').format(_punchOutTime!)}", style: TextStyle(color: Colors.green.shade700, fontSize: 13)),
                      ],
                    ),
                  )
                ],
              ),
            ),

            const SizedBox(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildStatColumn("Present Days", "$_presentCount"),
                _buildStatColumn("Absent Days", "$_absentCount"),
                _buildStatColumn("Total Hours", "${_totalHoursCount.toStringAsFixed(1)}h"),
              ],
            ),
            const SizedBox(height: 24),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text("Monthly Calendar", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF333333))),
            ),
            const SizedBox(height: 12),
            _buildCalendar(),
            const SizedBox(height: 24),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text("Recent History", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF333333))),
            ),
            const SizedBox(height: 12),
            _buildHistoryList(),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildOfficeButton(String name) {
    bool isSelected = _selectedOffice == name;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedOffice = name),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF1B2E4B) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? const Color(0xFF1B2E4B) : Colors.grey.shade300),
          ),
          child: Column(
            children: [
              Icon(Icons.location_on, color: isSelected ? Colors.white : Colors.grey, size: 20),
              const SizedBox(height: 4),
              Text(name, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: isSelected ? Colors.white : Colors.grey.shade700)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatColumn(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF1B2E4B))),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }

  Widget _buildCalendar() {
    final now = DateTime.now();
    final firstDay = DateTime(now.year, now.month, 1);
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final startOffset = (firstDay.weekday) % 7;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.grey.shade200)),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, childAspectRatio: 1),
        itemCount: daysInMonth + startOffset,
        itemBuilder: (context, index) {
          if (index < startOffset) return const SizedBox();
          final day = index - startOffset + 1;
          final date = DateTime(now.year, now.month, day);
          final key = DateTime(date.year, date.month, date.day);
          
          final record = _attendanceMap[key];
          
          bool isToday = day == now.day && now.month == date.month && now.year == date.year;
          bool isFuture = date.isAfter(DateTime(now.year, now.month, now.day));
          bool isSunday = date.weekday == DateTime.sunday;

          Color dotColor = Colors.transparent;
          if (record != null) {
            switch (record['status']) {
              case 'present': dotColor = const Color(0xFF2E7D32); break;
              case 'leave': dotColor = const Color(0xFFE65100); break;
              case 'holiday': dotColor = const Color(0xFF1565C0); break;
            }
          } else if (!isFuture && !isToday && !isSunday) {
            dotColor = const Color(0xFFD32F2F); // absent
          }

          return GestureDetector(
            onTap: () => _handleDateTap(date, record),
            child: Container(
              margin: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: isToday ? Border.all(color: Colors.blue.shade700, width: 2) : null,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                   Text("$day", style: TextStyle(
                     fontWeight: isToday ? FontWeight.bold : FontWeight.w500,
                     color: isToday ? Colors.blue.shade700 : (isSunday ? Colors.grey : Colors.black87)
                   )),
                   if (dotColor != Colors.transparent) ...[
                     const SizedBox(height: 4),
                     Container(width: 6, height: 6, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
                   ]
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _handleDateTap(DateTime date, Map<String, dynamic>? record) {
    final now = DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day);
    if (date.isAfter(now)) return;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        Widget content;
        if (record == null) {
          content = const Column(
            children: [
              Icon(Icons.info_outline, color: Colors.red, size: 48),
              SizedBox(height: 16),
              Text("No Attendance Record", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Text("You were marked as absent for this day."),
            ],
          );
        } else if (record['status'] == 'present') {
          final cIn = DateTime.parse(record['check_in']).toLocal();
          final cOut = record['check_out'] != null ? DateTime.parse(record['check_out']).toLocal() : null;
          content = Column(
            children: [
              const Icon(Icons.check_circle, color: Color(0xFF2E7D32), size: 48),
              const SizedBox(height: 16),
              const Text("Present", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF2E7D32))),
              const SizedBox(height: 16),
              _row("Check In", DateFormat('hh:mm a').format(cIn)),
              _row("Check Out", cOut != null ? DateFormat('hh:mm a').format(cOut) : "--:--"),
              if (cOut != null) _row("Duration", "${cOut.difference(cIn).inHours}h ${cOut.difference(cIn).inMinutes % 60}m"),
            ],
          );
        } else if (record['status'] == 'leave') {
          content = Column(
            children: [
              const Icon(Icons.event_note, color: Color(0xFFE65100), size: 48),
              const SizedBox(height: 16),
              const Text("On Leave", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFFE65100))),
              const SizedBox(height: 16),
              _row("Type", record['leave_type'] ?? "Other"),
              _row("Reason", record['reason'] ?? "--"),
              _row("Approved", "Yes"),
            ],
          );
        } else if (record['status'] == 'holiday') {
          content = Column(
            children: [
              const Icon(Icons.celebration, color: Color(0xFF1565C0), size: 48),
              const SizedBox(height: 16),
              const Text("Public Holiday", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF1565C0))),
              const SizedBox(height: 16),
              _row("Occasion", record['holiday_name'] ?? "Holiday"),
            ],
          );
        } else {
           content = const SizedBox();
        }

        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            content,
            const SizedBox(height: 24),
          ]),
        );
      },
    );
  }

  Widget _buildHistoryList() {
    final now = DateTime.now();
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final List<DateTime> pastDays = [];
    for (int i = now.day; i >= 1; i--) {
      pastDays.add(DateTime(now.year, now.month, i));
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: pastDays.length,
      itemBuilder: (context, index) {
        final date = pastDays[index];
        final record = _attendanceMap[date];
        final isSunday = date.weekday == DateTime.sunday;
        
        if (isSunday && record == null) return const SizedBox();

        String title = "Absent";
        String subtitle = "No record found";
        Widget statusChip = _buildStatusChip("Absent", const Color(0xFFD32F2F));

        if (record != null) {
          if (record['status'] == 'present') {
            final cIn = DateTime.parse(record['check_in']).toLocal();
            final cOut = record['check_out'] != null ? DateTime.parse(record['check_out']).toLocal() : null;
            title = "IN: ${DateFormat('hh:mm a').format(cIn)}";
            if (cOut != null) {
               title += "  OUT: ${DateFormat('hh:mm a').format(cOut)}";
               final diff = cOut.difference(cIn);
               subtitle = "${diff.inHours}h ${diff.inMinutes % 60}m duration";
            } else {
               subtitle = "Currently working";
            }
            statusChip = _buildStatusChip("Present", const Color(0xFF2E7D32));
          } else if (record['status'] == 'leave') {
            title = "On Leave";
            subtitle = record['leave_type'] ?? "Casual Leave";
            statusChip = _buildStatusChip("Leave", const Color(0xFFE65100));
          } else if (record['status'] == 'holiday') {
            title = "Public Holiday";
            subtitle = record['holiday_name'] ?? "Holiday";
            statusChip = _buildStatusChip("Holiday", const Color(0xFF1565C0));
          }
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8)]),
          child: Row(
            children: [
              Container(
                width: 45,
                child: Column(
                  children: [
                    Text(DateFormat('dd').format(date), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    Text(DateFormat('MMM').format(date).toUpperCase(), style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                  ],
                ),
              ),
              statusChip,
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 11)),
    );
  }

  Widget _row(String l, String v) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(l, style: const TextStyle(color: Colors.grey)), Text(v, style: const TextStyle(fontWeight: FontWeight.bold))]),
  );
}

