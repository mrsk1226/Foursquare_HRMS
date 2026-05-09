import 'package:flutter/material.dart';
import '../screens/login_screen.dart';
import '../services/auth_service.dart';
import '../services/supabase_config.dart';

class AppDrawer extends StatefulWidget {
  final int selectedIndex;
  final Function(int)? switchTab;

  const AppDrawer({super.key, required this.selectedIndex, this.switchTab});

  @override
  State<AppDrawer> createState() => _AppDrawerState();
}

class _AppDrawerState extends State<AppDrawer> {
  String _name = 'Employee';
  String _employeeId = '';
  String _role = 'EMPLOYEE';

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final profile = await SupabaseConfig.getProfile();
      final empId = profile?['employee_id']?.toString() ?? '';
      final role = profile?['role']?.toString() ?? 'employee';
      String name = 'Employee';

      if (empId.isNotEmpty) {
        final emp = await SupabaseConfig.withTimeout(
          SupabaseConfig.client
              .from('employees')
              .select('full_name')
              .eq('employee_id', empId)
              .maybeSingle(),
        );
        name = emp?['full_name']?.toString() ?? 'Employee';
      }
      if (mounted) {
        setState(() {
          _employeeId = empId;
          _name = name;
          _role = role.toUpperCase();
        });
      }
    } catch (_) {}
  }

  Future<void> _handleLogout() async {
    SupabaseConfig.clearSessionCache();
    await AuthService().signOut();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(0xFF1a2744),
      child: Column(
        children: [
          // HEADER
          Container(
            width: double.infinity,
            padding: EdgeInsets.fromLTRB(
              20,
              MediaQuery.of(context).padding.top + 24,
              20,
              20,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: const Color(0xFF2E3F6B),
                  child: Text(
                    _name.isNotEmpty ? _name[0].toUpperCase() : 'U',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'ID: $_employeeId',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2979FF),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    _role,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const Divider(color: Color(0xFF2E3F6B), height: 1),

          // MENU ITEMS
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _item(context, Icons.home_rounded, 'Dashboard', 0),
                _item(context, Icons.access_time_rounded, 'Attendance', 1),
                _item(
                  context,
                  Icons.calendar_month_rounded,
                  'Leave & Permission',
                  2,
                ),
                _item(context, Icons.campaign_rounded, 'Engage', 3),
                _item(context, Icons.person_rounded, 'Profile', 4),
              ],
            ),
          ),

          const Divider(color: Color(0xFF2E3F6B), height: 1),

          // LOGOUT
          ListTile(
            leading: const Icon(Icons.logout_rounded, color: Color(0xFFFF5252)),
            title: const Text(
              'Logout',
              style: TextStyle(
                color: Color(0xFFFF5252),
                fontWeight: FontWeight.bold,
              ),
            ),
            onTap: () {
              Navigator.pop(context);
              _handleLogout();
            },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _item(BuildContext context, IconData icon, String title, int index) {
    final isSelected = widget.selectedIndex == index;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: isSelected
            ? const Color(0xFF2979FF).withValues(alpha: 0.15)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: Icon(
          icon,
          color: isSelected ? const Color(0xFF2979FF) : Colors.white70,
          size: 22,
        ),
        title: Text(
          title,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.white70,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontSize: 14,
          ),
        ),
        onTap: () {
          Navigator.pop(context);
          if (widget.switchTab != null) {
            widget.switchTab!(index);
          }
        },
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
