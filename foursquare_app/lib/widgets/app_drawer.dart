import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_config.dart';
import '../screens/login_screen.dart';

class AppDrawer extends StatelessWidget {
  final int selectedIndex;
  final Function(int) onItemSelected;

  const AppDrawer({
    Key? key,
    required this.selectedIndex,
    required this.onItemSelected,
  }) : super(key: key);

  Future<Map<String, dynamic>> _fetchUserData() async {
    final user = SupabaseConfig.client.auth.currentUser;
    if (user == null) return {};

    final profile = await SupabaseConfig.client
        .from('profiles')
        .select('employee_id, role')
        .eq('id', user.id)
        .maybeSingle();

    if (profile == null) return {};

    final employee = await SupabaseConfig.client
        .from('employees')
        .select('full_name, photo_url')
        .eq('employee_id', profile['employee_id'])
        .maybeSingle();

    return {
      'name': employee?['full_name'] ?? 'User',
      'id': profile['employee_id'] ?? '---',
      'role': (profile['role'] ?? 'employee').toString().toUpperCase(),
      'photo': employee?['photo_url'],
    };
  }

  @override
  Widget build(BuildContext context) {
    const navy = Color(0xFF0F172A);
    const blue = Color(0xFF3B82F6);

    return Drawer(
      backgroundColor: navy,
      child: FutureBuilder<Map<String, dynamic>>(
        future: _fetchUserData(),
        builder: (context, snapshot) {
          final data = snapshot.data ?? {};
          return Column(
            children: [
              // Header
              UserAccountsDrawerHeader(
                decoration: const BoxDecoration(color: Color(0xFF1E293B)),
                currentAccountPicture: CircleAvatar(
                  backgroundColor: blue.withValues(alpha: 0.2),
                  backgroundImage: data['photo'] != null ? NetworkImage(data['photo']) : null,
                  child: data['photo'] == null
                      ? Text(data['name']?.toString().substring(0, 1) ?? 'U',
                          style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold))
                      : null,
                ),
                accountName: Text(data['name'] ?? 'Loading...', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                accountEmail: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("ID: ${data['id']}", style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 12)),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: blue, borderRadius: BorderRadius.circular(4)),
                      child: Text(data['role'] ?? '...', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),

              // Menu Items
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    _drawerItem(0, Icons.dashboard_outlined, Icons.dashboard, "Dashboard", blue),
                    _drawerItem(1, Icons.watch_later_outlined, Icons.watch_later, "Attendance", blue),
                    _drawerItem(2, Icons.calendar_month_outlined, Icons.calendar_month, "Leave & Permissions", blue),
                    _drawerItem(3, Icons.campaign_outlined, Icons.campaign, "Engage", blue),
                    _drawerItem(4, Icons.person_outline, Icons.person, "My Profile", blue),
                    _drawerItem(-1, Icons.receipt_long_outlined, Icons.receipt_long, "Payslip", blue, route: 'payslip'),
                    _drawerItem(-1, Icons.contact_support_outlined, Icons.contact_support, "HR Contact", blue, route: 'contact'),
                    const Divider(color: Colors.white10),
                    ListTile(
                      leading: const Icon(Icons.logout, color: Colors.redAccent),
                      title: const Text("Sign Out", style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                      onTap: () async {
                        await SupabaseConfig.client.auth.signOut();
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                          (route) => false,
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _drawerItem(int index, IconData icon, IconData activeIcon, String title, Color activeColor, {String? route}) {
    final isSelected = selectedIndex == index;
    return ListTile(
      selected: isSelected,
      leading: Icon(isSelected ? activeIcon : icon, color: isSelected ? activeColor : Colors.white70),
      title: Text(title, style: TextStyle(color: isSelected ? Colors.white : Colors.white70, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
      onTap: () {
        if (index != -1) {
          onItemSelected(index);
        } else {
           // Handle external routes if needed, but for now we'll just close drawer
        }
      },
      selectedTileColor: activeColor.withValues(alpha: 0.1),
    );
  }
}
