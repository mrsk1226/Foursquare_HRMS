import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../blocs/auth_bloc.dart';
import 'attendance_screen.dart';
import 'leave_screen.dart';
import 'profile_screen.dart';
import 'payslip_screen.dart';
import 'announcements_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;

  static const List<Widget> _widgetOptions = <Widget>[
    _DashboardHome(),
    AttendanceScreen(),
    LeaveScreen(),
    ProfileScreen(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Foursquare HRMS'),
        backgroundColor: const Color(0xFF1E3A5F),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              context.read<AuthBloc>().add(AuthLogoutRequested());
            },
          )
        ],
      ),
      body: _widgetOptions.elementAt(_selectedIndex),
      bottomNavigationBar: BottomNavigationBar(
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.access_time),
            label: 'Attendance',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.event_busy),
            label: 'Leaves',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: const Color(0xFF1E3A5F),
        unselectedItemColor: Colors.grey,
        onTap: _onItemTapped,
        type: BottomNavigationBarType.fixed,
      ),
    );
  }
}

class _DashboardHome extends StatefulWidget {
  const _DashboardHome({Key? key}) : super(key: key);

  @override
  State<_DashboardHome> createState() => _DashboardHomeState();
}

class _DashboardHomeState extends State<_DashboardHome> {
  final _supabase = Supabase.instance.client;
  bool _isLoading = true;
  List<dynamic> _announcements = [];
  Map<String, dynamic>? _attendanceToday;

  @override
  void initState() {
    super.initState();
    _fetchDashboardData();
  }

  Future<void> _fetchDashboardData() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;

      // Fetch Profile for employee_id
      final profileRes = await _supabase
          .from('profiles')
          .select('employee_id')
          .eq('id', user.id)
          .maybeSingle();
      final empId = profileRes?['employee_id'];

      // Fetch Announcements
      final annRes = await _supabase
          .from('announcements')
          .select()
          .order('created_at', ascending: false)
          .limit(3);

      // Fetch Today's Attendance
      final today = DateTime.now().toIso8601String().split('T')[0];
      final attRes = await _supabase
          .from('attendance_logs')
          .select()
          .eq('employee_id', empId ?? '')
          .eq('date', today)
          .maybeSingle();

      if (mounted) {
        setState(() {
          _announcements = annRes ?? [];
          _attendanceToday = attRes;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _getGreeting() {
    var hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        String name = 'User';
        if (state is AuthAuthenticated) {
          name = state.profile?['employees']?['full_name']?.split(' ')[0] ??
              'User';
        }

        if (_isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        return RefreshIndicator(
          onRefresh: _fetchDashboardData,
          color: const Color(0xFF1E3A5F),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Greeting & Profile snippet
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${_getGreeting()},',
                            style: const TextStyle(
                                fontSize: 16, color: Colors.grey)),
                        Text(name,
                            style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1E3A5F))),
                      ],
                    ),
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: const Color(0xFF2E86AB).withOpacity(0.2),
                      child: Text(name[0],
                          style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E3A5F))),
                    )
                  ],
                ),
                const SizedBox(height: 24),

                // Today Attendance Status Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20.0),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                        colors: [Color(0xFF1E3A5F), Color(0xFF2E86AB)]),
                    borderRadius: BorderRadius.circular(16.0),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.blue.withOpacity(0.2),
                          blurRadius: 10,
                          offset: const Offset(0, 4))
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Today\'s Attendance',
                          style:
                              TextStyle(color: Colors.white70, fontSize: 14)),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Punch In',
                                  style: TextStyle(
                                      color: Colors.white54, fontSize: 12)),
                              Text(_attendanceToday?['check_in'] ?? '--:--',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 20,
                                      fontWeight: FontWeight.bold)),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text('Punch Out',
                                  style: TextStyle(
                                      color: Colors.white54, fontSize: 12)),
                              Text(_attendanceToday?['check_out'] ?? '--:--',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 20,
                                      fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Quick Actions
                const Text('Quick Actions',
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E3A5F))),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildActionBtn(
                        context,
                        Icons.fingerprint,
                        'Punch',
                        Colors.orange,
                        () => DefaultTabController.of(context).animateTo(1)),
                    _buildActionBtn(
                        context,
                        Icons.event_note,
                        'Leave',
                        Colors.green,
                        () => DefaultTabController.of(context).animateTo(2)),
                    _buildActionBtn(
                        context,
                        Icons.receipt_long,
                        'Payslip',
                        Colors.blue,
                        () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const PayslipScreen()))),
                    _buildActionBtn(
                        context,
                        Icons.person,
                        'Profile',
                        Colors.purple,
                        () => DefaultTabController.of(context).animateTo(3)),
                  ],
                ),
                const SizedBox(height: 24),

                // Leave Balance Summary (Mocked for UI brevity, to implement actual sum in leave module)
                const Text('Leave Balance',
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E3A5F))),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                        child: _buildLeaveCard('Casual', '12', Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(child: _buildLeaveCard('Sick', '04', Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _buildLeaveCard('Earned', '15', Colors.green)),
                  ],
                ),
                const SizedBox(height: 24),

                // Announcements
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Recent Announcements',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1E3A5F))),
                    TextButton(
                        onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const AnnouncementsScreen())),
                        child: const Text('View All',
                            style: TextStyle(color: Color(0xFF2E86AB)))),
                  ],
                ),
                if (_announcements.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Center(
                        child: Text('No announcements available',
                            style: TextStyle(color: Colors.grey))),
                  )
                else
                  ..._announcements
                      .map((ann) => Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                      color: Colors.blue.shade50,
                                      borderRadius: BorderRadius.circular(8)),
                                  child: const Icon(Icons.campaign,
                                      color: Color(0xFF2E86AB)),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(ann['title'] ?? '',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 16)),
                                      const SizedBox(height: 4),
                                      Text(ann['content'] ?? '',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              color: Colors.grey.shade600,
                                              fontSize: 13)),
                                    ],
                                  ),
                                )
                              ],
                            ),
                          ))
                      .toList(),

                const SizedBox(height: 32),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildActionBtn(BuildContext context, IconData icon, String label,
      Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
                color: color.withOpacity(0.1), shape: BoxShape.circle),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(height: 8),
          Text(label,
              style:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildLeaveCard(String title, String bal, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Text(title,
              style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 12,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(bal,
              style: TextStyle(
                  color: color, fontSize: 22, fontWeight: FontWeight.black)),
        ],
      ),
    );
  }
}
