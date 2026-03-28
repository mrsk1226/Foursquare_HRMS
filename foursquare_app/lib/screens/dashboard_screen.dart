import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shimmer/shimmer.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/supabase_config.dart';
import '../widgets/app_drawer.dart';
import 'attendance_screen.dart';
import 'leave_screen.dart';
import 'payslip_screen.dart';
import 'profile_screen.dart';
import 'announcements_screen.dart';

class DashboardScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const DashboardScreen({Key? key, this.switchTab}) : super(key: key);

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  String _displayName = "Santhoshkumar";
  bool _isLoading = true;
  List<dynamic> _recentAnnouncements = [];
  List<dynamic> _celebrations = [];
  Map<String, dynamic>? _leaveBalances;
  DateTime _now = DateTime.now();
  Timer? _clockTimer;
  Timer? _weatherTimer;
  dynamic _weatherData;

  List<String> _visibleCards = ['Attendance', 'Leave', 'Payslip', 'Profile', 'Feed'];

  final Map<String, dynamic> _allActions = {
    'Attendance': {'icon': Icons.watch_later_rounded, 'desc': 'Check punch log'},
    'Leave': {'icon': Icons.calendar_month_rounded, 'desc': 'Apply for leave'},
    'Payslip': {'icon': Icons.description_rounded, 'desc': 'Salary statements'},
    'Profile': {'icon': Icons.person_rounded, 'desc': 'Manage privacy'},
    'Feed': {'icon': Icons.campaign_rounded, 'desc': 'Latest news'},
  };

  Widget _getScreen(String key) {
    switch (key) {
      case 'Attendance': return const AttendanceScreen();
      case 'Leave': return const LeaveScreen();
      case 'Payslip': return const PayslipScreen();
      case 'Profile': return const ProfileScreen();
      case 'Feed': return const AnnouncementsScreen();
      default: return const AttendanceScreen();
    }
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList('dashboard_cards');
    if (saved != null) {
      setState(() => _visibleCards = saved);
    }
  }

  Future<void> _savePreferences() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('dashboard_cards', _visibleCards);
  }

  @override
  void initState() {
    super.initState();
    _loadPreferences();
    _fetchDashboardData();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) setState(() => _now = DateTime.now());
    });
    _weatherTimer = Timer.periodic(const Duration(minutes: 10), (timer) {
      _fetchWeather();
    });
    _fetchWeather();
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    _weatherTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchWeather() async {
    try {
      final res = await http.get(Uri.parse(
          "https://api.openweathermap.org/data/2.5/weather?lat=11.3410&lon=77.7172&appid=bd5e378503939ddaee76f12ad7a97608&units=metric"));
      if (res.statusCode == 200) {
        if (mounted) setState(() => _weatherData = json.decode(res.body));
      }
    } catch (_) {}
  }

  Future<void> _fetchDashboardData() async {
    try {
      final user = SupabaseConfig.client.auth.currentUser;
      if (user == null) return;

      final empIdRes = await SupabaseConfig.client
          .from('profiles')
          .select('employee_id')
          .eq('id', user.id)
          .maybeSingle();

      if (empIdRes != null) {
        final empId = empIdRes['employee_id'];
        
        final empData = await SupabaseConfig.client
            .from('employees')
            .select('full_name')
            .eq('employee_id', empId)
            .maybeSingle();
        if (empData != null) _displayName = empData['full_name'];

        final balRes = await SupabaseConfig.client
            .from('leave_balances')
            .select('*')
            .eq('employee_id', empId)
            .eq('year', DateTime.now().year);
        
        final annRes = await SupabaseConfig.client
            .from('announcements')
            .select('*')
            .order('created_at', ascending: false)
            .limit(3);

        final allEmpRes = await SupabaseConfig.client
            .from('employees')
            .select('full_name, dob, photo_url');

        // Logic for celebrations
        final today = DateTime.now();
        List<dynamic> births = (allEmpRes as List).where((e) {
          if (e['dob'] == null) return false;
          final dob = DateTime.parse(e['dob']);
          return dob.month == today.month && dob.day >= today.day && dob.day <= today.day + 7;
        }).map((e) => {
          'title': e['full_name'],
          'type': 'Birthday',
          'day': DateTime.parse(e['dob']).day == today.day ? 'Today' : 'Upcoming'
        }).toList();

        if (mounted) {
          setState(() {
            _leaveBalances = {for (var b in (balRes as List)) b['leave_type']: b};
            _recentAnnouncements = annRes as List;
            _celebrations = births;
            _isLoading = false;
          });
        }
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _getTimeGreeting() {
    final h = DateTime.now().hour;
    if (h < 12) return "Good Morning,";
    if (h < 17) return "Good Afternoon,";
    return "Good Evening,";
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: AppDrawer(selectedIndex: 0, onItemSelected: (i) => widget.switchTab?.call(i)),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          _buildAppBar(),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   _buildGreetingCard(),
                   const SizedBox(height: 32),
                   _buildSectionTitle("Daily Actions", "Customize", onAction: _showCustomizeSheet),
                   const SizedBox(height: 16),
                   _buildDailyActionsGrid(),
                   const SizedBox(height: 32),
                   _buildSectionTitle("Leave Balance", "View History"),
                   const SizedBox(height: 16),
                   _buildLeaveBalanceList(),
                   const SizedBox(height: 32),
                   _buildSectionTitle("Latest News", "View All"),
                   const SizedBox(height: 16),
                   _buildNewsFeed(),
                   const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar() {
    return SliverAppBar(
      floating: true,
      backgroundColor: const Color(0xFF0F172A),
      iconTheme: const IconThemeData(color: Colors.white),
      elevation: 0,
      title: Image.asset('assets/images/4 square White Colour.png', height: 32),
      centerTitle: false,
      actions: [
        IconButton(
          icon: const Icon(Icons.notifications_none_rounded, color: Colors.white),
          onPressed: () {},
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildGreetingCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(32),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F172A), Color(0xFF1E3A5F)],
        ),
        boxShadow: [
          BoxShadow(color: const Color(0xFF0F172A).withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 10))
        ]
      ),
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 6, height: 6,
                    decoration: const BoxDecoration(color: Color(0xFF34D399), shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 8),
                  Text("LIVE • DASHBOARD", 
                    style: GoogleFonts.inter(color: Colors.white.withOpacity(0.6), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2)),
                ],
              ),
              const SizedBox(height: 20),
              Text(_getTimeGreeting(),
                style: GoogleFonts.inter(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Shimmer.fromColors(
                baseColor: Colors.white,
                highlightColor: const Color(0xFF60A5FA),
                child: Text(_displayName,
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -1)),
              ),
              const SizedBox(height: 16),
              Text("Your HR ecosystem is fully operational. Manage team velocity and workflows.",
                style: GoogleFonts.inter(color: Colors.white.withOpacity(0.5), fontSize: 12, height: 1.5)),
              const SizedBox(height: 24),
              if (_celebrations.isNotEmpty) _buildCelebrationsBox(),
            ],
          ),
          Positioned(
            top: 0, right: 0,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(DateFormat('hh:mm a').format(_now),
                  style: GoogleFonts.inter(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900)),
                Text(DateFormat('dd MMM').format(_now),
                  style: GoogleFonts.inter(color: Colors.white.withOpacity(0.4), fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.5)),
                if (_weatherData != null) ...[
                   const SizedBox(height: 12),
                   _buildWeatherMiniWidget(),
                ]
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildWeatherMiniWidget() {
    final temp = (_weatherData['main']['temp']).round();
    final icon = _weatherData['weather'][0]['icon'];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.network("https://openweathermap.org/img/wn/$icon@2x.png", width: 20, height: 20),
          const SizedBox(width: 4),
          Text("$temp°C", style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _buildCelebrationsBox() {
    return Container(
       padding: const EdgeInsets.all(12),
       decoration: BoxDecoration(
         color: Colors.white.withOpacity(0.05),
         borderRadius: BorderRadius.circular(20),
         border: Border.all(color: Colors.white.withOpacity(0.05)),
       ),
       child: Row(
         children: [
           Container(
             padding: const EdgeInsets.all(8),
             decoration: BoxDecoration(color: Colors.amber.withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
             child: const Icon(Icons.cake_rounded, color: Colors.amber, size: 16),
           ),
           const SizedBox(width: 12),
           Expanded(
             child: Column(
               crossAxisAlignment: CrossAxisAlignment.start,
               children: [
                 Text("Upcoming Celebration", 
                   style: GoogleFonts.inter(color: Colors.white.withOpacity(0.4), fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 1)),
                 const SizedBox(height: 2),
                 Text("${_celebrations[0]['title']}'s ${_celebrations[0]['type']}",
                   style: GoogleFonts.inter(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
               ],
             ),
           )
         ],
       ),
    );
  }

  Widget _buildSectionTitle(String title, String action, {VoidCallback? onAction}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title.toUpperCase(), 
              style: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2)),
            const SizedBox(height: 4),
            Text(title, style: GoogleFonts.inter(color: const Color(0xFF0F172A), fontSize: 20, fontWeight: FontWeight.w900)),
          ],
        ),
        TextButton(
          onPressed: onAction,
          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(50, 30)),
          child: Text(action.toUpperCase(), 
            style: GoogleFonts.inter(color: const Color(0xFF2563EB), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5)),
        )
      ],
    );
  }

  Widget _buildDailyActionsGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, crossAxisSpacing: 16, mainAxisSpacing: 16, childAspectRatio: 1.3
      ),
      itemCount: _visibleCards.length,
      itemBuilder: (context, i) {
        String key = _visibleCards[i];
        final action = _allActions[key];
        if (action == null) return const SizedBox();
        return GestureDetector(
          onTap: () {
            Navigator.push(context, MaterialPageRoute(builder: (_) => _getScreen(key)));
          },
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [BoxShadow(color: const Color(0xFF0F172A).withOpacity(0.1), blurRadius: 10, offset: const Offset(0, 4))]
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(action['icon'], color: Colors.blueAccent, size: 24),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(key, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(action['desc'], style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 10)),
                  ],
                )
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildLeaveBalanceList() {
    final List<Map<String, dynamic>> balances = [
      {'label': 'Casual Leave', 'key': 'Casual Leave', 'total': 12, 'color': Colors.blueAccent},
      {'label': 'Sick Leave', 'key': 'Sick Leave', 'total': 12, 'color': Colors.tealAccent},
      {'label': 'Earned Leave', 'key': 'Earned Leave', 'total': 24, 'color': Colors.orangeAccent},
    ];

    return Column(
      children: balances.map((b) {
        final rem = _leaveBalances?[b['key']]?['remaining'] ?? b['total'];
        final total = b['total'];
        final progress = rem / total;

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.grey.shade100),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(b['label'], style: GoogleFonts.inter(fontWeight: FontWeight.w900, color: const Color(0xFF1E293B))),
                  Text("$rem / $total", style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey)),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress, minHeight: 6,
                  backgroundColor: Colors.grey.shade100,
                  valueColor: AlwaysStoppedAnimation<Color>(b['color'] as Color),
                ),
              )
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildNewsFeed() {
    return Column(
      children: _recentAnnouncements.map((ann) {
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.grey.shade100),
          ),
          child: Row(
            children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.campaign_rounded, color: Colors.blue, size: 20),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(ann['title'] ?? 'Announcement', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(fontWeight: FontWeight.w900, color: const Color(0xFF1E293B))),
                    const SizedBox(height: 4),
                    Text(ann['content'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.grey),
            ],
          ),
        );
      }).toList(),
    );
  }

  void _showCustomizeSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) {
          final allKeys = ['Attendance', 'Leave', 'Payslip', 'Profile', 'Feed'];
          final displayList = List<String>.from(_visibleCards);
          for (var k in allKeys) {
            if (!displayList.contains(k)) displayList.add(k);
          }

          return Container(
            height: MediaQuery.of(context).size.height * 0.8,
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
            ),
            padding: const EdgeInsets.all(32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text("Customize Workspace", style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w900)),
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded)),
                  ],
                ),
                const SizedBox(height: 32),
                const Text("Drag to Reorder • Tap to Toggle", style: TextStyle(fontWeight: FontWeight.w900, color: Colors.grey, fontSize: 10, letterSpacing: 2)),
                const SizedBox(height: 16),
                Expanded(
                  child: ReorderableListView(
                    onReorder: (oldIndex, newIndex) {
                      setSheetState(() {
                        if (newIndex > oldIndex) newIndex -= 1;
                        final String item = displayList.removeAt(oldIndex);
                        displayList.insert(newIndex, item);
                        
                        _visibleCards = displayList.where((k) => _visibleCards.contains(k)).toList();
                        _savePreferences();
                      });
                      setState(() {});
                    },
                    children: displayList.map((key) {
                      final isActive = _visibleCards.contains(key);
                      return _buildCustomizeItem(key, isActive, () {
                        setSheetState(() {
                          if (isActive) {
                            _visibleCards.remove(key);
                          } else {
                            _visibleCards.add(key);
                          }
                          _savePreferences();
                        });
                        setState(() {});
                      });
                    }).toList(),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCustomizeItem(String label, bool isActive, VoidCallback onTap) {
    return Container(
      key: ValueKey(label),
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Row(
        children: [
          const Icon(Icons.drag_indicator_rounded, color: Colors.grey, size: 20),
          const SizedBox(width: 16),
          Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
          const Spacer(),
          GestureDetector(
            onTap: onTap,
            child: Icon(
              isActive ? Icons.check_circle_rounded : Icons.add_circle_outline_rounded,
              color: isActive ? Colors.blue : Colors.grey,
            ),
          ),
        ],
      ),
    );
  }
}
