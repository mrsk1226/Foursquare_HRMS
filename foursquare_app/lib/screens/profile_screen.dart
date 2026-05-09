import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/auth_service.dart';
import '../services/supabase_config.dart';
import 'login_screen.dart';
import '../widgets/app_drawer.dart';

class ProfileScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const ProfileScreen({super.key, this.switchTab});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  Map<String, dynamic>? _profileData;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchProfile();
  }

  Future<void> _fetchProfile() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final employeeId = prefs.getString('employee_id')?.trim() ?? '';

      if (employeeId.isEmpty) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      final empRes = await SupabaseConfig.client
          .from('employees')
          .select('*')
          .eq('employee_id', employeeId)
          .maybeSingle();

      if (mounted) {
        setState(() {
          _profileData =
              empRes != null ? Map<String, dynamic>.from(empRes) : null;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _handleLogout(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('employee_id');
    await AuthService().signOut();
    if (context.mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_profileData == null) return const Center(child: Text("Profile not found"));

    final name = (_profileData!['full_name'] ?? 'User').toString();
    final photoUrl = _profileData!['photo_url']?.toString();
    final designation = (_profileData!['designation'] ?? 'N/A').toString();
    final department = (_profileData!['department'] ?? 'N/A').toString();
    final empId = (_profileData!['employee_id'] ?? 'N/A').toString();
    final status = (_profileData!['status'] ?? 'N/A').toString();
    final joinDate = _profileData!['joining_date'] ?? _profileData!['join_date'];
    final nameInitial = name.isNotEmpty ? name[0].toUpperCase() : 'U';
    
    final formattedJoinDate = joinDate != null 
        ? DateFormat('dd MMM yyyy').format(DateTime.parse(joinDate)) 
        : 'N/A';

    return Scaffold(
      backgroundColor: Colors.white,
      drawer: AppDrawer(
        selectedIndex: 4,
        switchTab: (i) => widget.switchTab?.call(i),
      ),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text("My Profile", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(onPressed: () => _handleLogout(context), icon: const Icon(Icons.logout, color: Colors.white)),
        ],
      ),
      body: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(24),
            color: const Color(0xFF1B2E4B),
            child: Column(
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: Colors.blue.shade900,
                      backgroundImage: (photoUrl != null && photoUrl.isNotEmpty)
                          ? NetworkImage(photoUrl)
                          : null,
                      child: (photoUrl == null || photoUrl.isEmpty)
                        ? Text(nameInitial, style: const TextStyle(fontSize: 32, color: Colors.white, fontWeight: FontWeight.bold))
                        : null,
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                          Text("$designation | $department", style: const TextStyle(color: Colors.white70, fontSize: 13)),
                        ],
                      ),
                    )
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    _buildChip(empId, Icons.badge_outlined),
                    const SizedBox(width: 8),
                    _buildChip(formattedJoinDate, Icons.event),
                    const SizedBox(width: 8),
                    _buildChip(status, Icons.check_circle_outline, color: Colors.green.shade400),
                  ],
                )
              ],
            ),
          ),

          // TabBar
          TabBar(
            controller: _tabController,
            labelColor: const Color(0xFF1B2E4B),
            unselectedLabelColor: Colors.grey,
            indicatorColor: const Color(0xFF1B2E4B),
            tabs: const [
              Tab(text: "Personal"),
              Tab(text: "Work"),
            ],
          ),

          // TabBarView
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildPersonalTab(),
                _buildWorkTab(),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildChip(String label, IconData icon, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color ?? Colors.white70),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildPersonalTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _infoCard("Official Email", _profileData!['personal_email'] ?? _profileData!['email'] ?? 'N/A', Icons.email_outlined),
        _infoCard("Phone Number", _profileData!['phone_number'] ?? _profileData!['phone'] ?? 'N/A', Icons.phone_outlined),
        _infoCard("Date of Birth", _formatDate(_profileData!['date_of_birth'] ?? _profileData!['dob']), Icons.cake_outlined),
        _infoCard("Gender", _profileData!['gender'] ?? 'N/A', Icons.person_outline),
        _infoCard("Blood Group", _profileData!['blood_group'] ?? 'N/A', Icons.water_drop_outlined),
        _infoCard("Permanent Address", _profileData!['permanent_address'] ?? _profileData!['address'] ?? 'N/A', Icons.location_on_outlined),
        _infoCard("Emergency Contact", _profileData!['emergency_contact_number'] ?? _profileData!['emergency_contact'] ?? 'N/A', Icons.contact_phone_outlined),
      ],
    );
  }

  Widget _buildWorkTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _infoCard("Employee ID", _profileData!['employee_id'] ?? 'N/A', Icons.badge_outlined),
        _infoCard("Department", _profileData!['department'] ?? 'N/A', Icons.business_outlined),
        _infoCard("Designation", _profileData!['designation'] ?? 'N/A', Icons.work_outline),
        _infoCard("Reporting Manager", _profileData!['manager_name'] ?? 'N/A', Icons.supervisor_account_outlined),
        _infoCard("Work Location", _profileData!['work_location'] ?? 'N/A', Icons.place_outlined),
        _infoCard("Employment Type", _profileData!['employment_type'] ?? 'N/A', Icons.assignment_ind_outlined),
      ],
    );
  }

  Widget _infoCard(String label, String value, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFFF5F6FA), borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 20, color: const Color(0xFF1B2E4B)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1B2E4B))),
              ],
            ),
          )
        ],
      ),
    );
  }

  String _formatDate(String? dt) {
    if (dt == null) return 'N/A';
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(dt));
    } catch (_) {
      return dt;
    }
  }
}
