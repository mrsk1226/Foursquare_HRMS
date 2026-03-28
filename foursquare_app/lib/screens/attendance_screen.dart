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
  String? _selectedOffice; // 'Main Office' or 'Showroom'
  Map<String, dynamic>? _todayLog;
  List<dynamic> _monthlyLogs = [];

  // Final Stat Display values
  int _presentCount = 0;
  int _absentCount = 0;
  int _leaveCount = 0;
  List<dynamic> _leaves = [];
  List<dynamic> _holidays = [];
  double _totalHoursCount = 0;
  String _currentTimeStr = '--:--';
  DateTime _now = DateTime.now();
  Timer? _timer;

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
    _fetchAttendanceData();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _now = DateTime.now();
          if (_todayLog?['check_in'] != null && _todayLog?['check_out'] == null) {
            _currentTimeStr = DateFormat('hh:mm:ss a').format(_now);
          } else {
            _currentTimeStr = '--:--';
          }
        });
      }
    });
  }

  Future<void> _fetchAttendanceData() async {
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
            .eq('employee_id', _employeeId as String)
            .maybeSingle();
        _workLocation = empRes?['work_location'] ?? 'Main Office';

        final now = DateTime.now();
        final todayStr = DateFormat('yyyy-MM-dd').format(now);
        
        final todayRes = await SupabaseConfig.client
            .from('attendance_logs')
            .select()
            .eq('employee_id', _employeeId as String)
            .eq('date', todayStr)
            .maybeSingle();
        
        final firstDayMonth = DateTime(now.year, now.month, 1).toIso8601String().split('T')[0];
        final lastDayMonth = DateTime(now.year, now.month + 1, 0).toIso8601String().split('T')[0];
        
        final monthRes = await SupabaseConfig.client
            .from('attendance_logs')
            .select()
            .eq('employee_id', _employeeId as String)
            .gte('date', firstDayMonth)
            .lte('date', lastDayMonth);

        final leaveRes = await SupabaseConfig.client
            .from('leave_requests')
            .select()
            .eq('employee_id', _employeeId as String)
            .eq('status', 'approved')
            .gte('start_date', firstDayMonth)
            .lte('end_date', lastDayMonth);

        final holidayRes = await SupabaseConfig.client
            .from('holidays')
            .select()
            .gte('holiday_date', firstDayMonth)
            .lte('holiday_date', lastDayMonth);

        _monthlyLogs = (monthRes as List?) ?? [];
        final List<dynamic> leaves = (leaveRes as List?) ?? [];
        final List<dynamic> holidays = (holidayRes as List?) ?? [];
        _todayLog = todayRes;

        // Calculate Stats
        _leaves = leaves;
        _holidays = holidays;
        _calculateStats(leaves, holidays);

        if (mounted) setState(() => _isLoading = false);
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _calculateStats(List<dynamic> leaves, List<dynamic> holidays) {
    final now = DateTime.now();
    _presentCount = _monthlyLogs.length;
    _leaveCount = leaves.length;

    int absents = 0;
    for (int day = 1; day <= now.day; day++) {
      final d = DateTime(now.year, now.month, day);
      if (d.weekday != DateTime.sunday) {
        final dStr = DateFormat('yyyy-MM-dd').format(d);
        bool hasLog = _monthlyLogs.any((l) => l['date'] == dStr);
        bool hasHoliday = holidays.any((h) => h['holiday_date'] == dStr);
        bool hasLeave = leaves.any((l) {
          DateTime s = DateTime.parse(l['start_date']);
          DateTime e = DateTime.parse(l['end_date']);
          return d.isAfter(s.subtract(const Duration(days: 1))) && d.isBefore(e.add(const Duration(days: 1)));
        });
        
        if (!hasLog && !hasLeave && !hasHoliday && d.isBefore(now.subtract(const Duration(days: 0)))) {
           final isToday = d.day == now.day && d.month == now.month && d.year == now.year;
           if (!isToday) absents++;
        }
      }
    }
    _absentCount = absents;

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
    if (_selectedOffice == null && _todayLog?['check_in'] == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select your office first'), backgroundColor: Colors.orange));
      return;
    }

    final bool hasPermission = await PermissionService.checkAndRequestLocation();
    if (!hasPermission) return;

    Position position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
    
    // Check range
    if (_todayLog == null) {
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
      final nowStr = DateTime.now().toUtc().toIso8601String();
      final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
      bool isSunday = DateTime.now().weekday == DateTime.sunday;

      if (_todayLog == null) {
        if (isSunday && _workLocation == 'Main Office') {
          await SupabaseConfig.client.from('sunday_punch_requests').insert({
            'employee_id': _employeeId,
            'date': todayStr,
            'check_in': nowStr,
            'lat': position.latitude,
            'lng': position.longitude,
            'status': 'pending'
          });
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Sunday attendance submitted for HR approval"), backgroundColor: Colors.green));
        } else {
          await SupabaseConfig.client.from('attendance_logs').insert({
            'employee_id': _employeeId,
            'check_in': nowStr,
            'lat': position.latitude,
            'lng': position.longitude,
            'date': todayStr,
            'status': 'present'
          });
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Punched in successfully"), backgroundColor: Colors.green));
        }
      } else {
        await SupabaseConfig.client.from('attendance_logs').update({'check_out': nowStr}).eq('id', _todayLog!['id']);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Punched out successfully"), backgroundColor: Colors.green));
      }

      await _fetchAttendanceData();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Failed to save punch log"), backgroundColor: Colors.red));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      drawer: AppDrawer(
        selectedIndex: 1,
        onItemSelected: (i) => widget.switchTab?.call(i),
      ),
      appBar: AppBar(
        title: const Text('Attendance', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1B2E4B),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            if (_todayLog == null) ...[
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

            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10)]),
              child: Column(
                children: [
                  Text(_todayLog?['check_in'] != null ? "Working Today" : "Not Punched In", style: const TextStyle(fontSize: 14, color: Colors.grey, fontWeight: FontWeight.w500)),
                  const SizedBox(height: 8),
                  Text(
                    _currentTimeStr,
                    style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Color(0xFF1B2E4B)),
                  ),
                  if (_todayLog?['check_in'] != null) 
                    Text(
                      "Punched at: ${DateFormat('hh:mm a').format(DateTime.parse(_todayLog!['check_in']).toLocal())}",
                      style: TextStyle(fontSize: 14, color: Colors.blue.shade700, fontWeight: FontWeight.bold),
                    ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: (_todayLog?['check_out'] != null) ? null : _handlePunch,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _todayLog?['check_in'] == null ? const Color(0xFF1B2E4B) : Colors.red.shade600,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text(
                        _todayLog?['check_out'] != null ? "Punch Completed" : (_todayLog?['check_in'] == null ? "Punch In" : "Punch Out"),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ),
                  ),
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
          final dateStr = DateFormat('yyyy-MM-dd').format(date);
          
          final log = _monthlyLogs.firstWhere((l) => l['date'] == dateStr, orElse: () => null);
          final holiday = _holidays.firstWhere((h) => h['holiday_date'] == dateStr, orElse: () => null);
          final leave = _leaves.firstWhere((l) {
            DateTime s = DateTime.parse(l['start_date']);
            DateTime e = DateTime.parse(l['end_date']);
            return date.isAfter(s.subtract(const Duration(days: 1))) && date.isBefore(e.add(const Duration(days: 1)));
          }, orElse: () => null);
          
          bool isSunday = date.weekday == DateTime.sunday;
          bool isToday = day == now.day && now.month == date.month && now.year == date.year;
          bool isFuture = date.isAfter(DateTime(now.year, now.month, now.day));

          Color cellColor = Colors.transparent;
          Color textColor = Colors.black87;
          BoxBorder? border;

          if (log != null) {
            cellColor = const Color(0xFFE8F5E9); // present
            textColor = Colors.green.shade800;
          } else if (leave != null) {
            cellColor = const Color(0xFFFFF3E0); // leave
            textColor = Colors.orange.shade800;
          } else if (holiday != null) {
            cellColor = const Color(0xFFE3F2FD); // holiday
            textColor = Colors.blue.shade800;
          } else if (isSunday) {
            cellColor = const Color(0xFFF5F5F5); // sunday
            textColor = Colors.black38;
          } else if (!isFuture && !isToday) {
            cellColor = const Color(0xFFFFEBEE); // absent
            textColor = Colors.red.shade800;
          }

          if (isToday) {
            border = Border.all(color: const Color(0xFF1B2E4B), width: 2);
          }

          return GestureDetector(
            onTap: () {
              if (log != null) {
                 _showLogDetails(log);
              } else if (!isFuture) {
                 _showAbsentDetails(dateStr);
              }
            },
            child: Container(
              margin: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: cellColor,
                borderRadius: BorderRadius.circular(8),
                border: border,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                   Text("$day", style: TextStyle(fontWeight: isToday ? FontWeight.bold : FontWeight.w500, color: textColor)),
                   if (log != null) 
                     Container(width: 4, height: 4, decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle)),
                   if (leave != null && log == null)
                     Container(width: 4, height: 4, decoration: const BoxDecoration(color: Colors.orange, shape: BoxShape.circle)),
                   if (holiday != null && log == null)
                     Container(width: 4, height: 4, decoration: const BoxDecoration(color: Colors.blue, shape: BoxShape.circle)),
                   if (log == null && leave == null && holiday == null && !isSunday && !isFuture && !isToday)
                     Container(width: 4, height: 4, decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildHistoryList() {
    if (_monthlyLogs.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        width: double.infinity,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
        child: const Center(child: Text("No history available for this month")),
      );
    }

    final sortedLogs = List.from(_monthlyLogs)..sort((a,b) => b['date'].compareTo(a['date']));

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: sortedLogs.length,
      itemBuilder: (context, index) {
        final log = sortedLogs[index];
        final cIn = DateTime.parse(log['check_in']).toLocal();
        final cOut = log['check_out'] != null ? DateTime.parse(log['check_out']).toLocal() : null;
        
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8)]),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(DateFormat('dd MMM yyyy').format(DateTime.parse(log['date'])), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 4),
                  Text("${DateFormat('hh:mm a').format(cIn)} - ${cOut != null ? DateFormat('hh:mm a').format(cOut) : 'Working'}", style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
                child: Text("Present", style: TextStyle(color: Colors.green.shade700, fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showAbsentDetails(String date) {
     showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.info_outline, color: Colors.red, size: 48),
            const SizedBox(height: 16),
            const Text("Absent", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.red)),
            const SizedBox(height: 8),
            Text("No attendance record found for $date.", style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 12),
            const Text("If you were on leave, please ensure your leave request was approved.", textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  void _showLogDetails(Map<String, dynamic> log) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        final cIn = DateTime.parse(log['check_in']).toLocal();
        final cOut = log['check_out'] != null ? DateTime.parse(log['check_out']).toLocal() : null;
        String duration = cOut != null ? "${cOut.difference(cIn).inHours}h ${cOut.difference(cIn).inMinutes % 60}m" : "Logged In";

        return Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text("Attendance Details", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              _row("Date", log['date']),
              _row("Check In", DateFormat('hh:mm a').format(cIn)),
              _row("Check Out", cOut != null ? DateFormat('hh:mm a').format(cOut) : "--:--"),
              _row("Duration", duration),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }

  Widget _row(String l, String v) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(l, style: const TextStyle(color: Colors.grey)), Text(v, style: const TextStyle(fontWeight: FontWeight.bold))]),
  );
}
