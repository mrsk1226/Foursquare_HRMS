import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../blocs/auth_bloc.dart';
import '../screens/payslip_screen.dart';
import '../screens/hr_contact_screen.dart';

class AppDrawer extends StatelessWidget {
  final int selectedIndex;
  final Function(int) onTabSelected;

  const AppDrawer({Key? key, required this.selectedIndex, required this.onTabSelected}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, HRMSAuthState>(
      builder: (context, state) {
        String name = 'User';
        String email = '';
        String avatarUrl = '';
        if (state is HRMSAuthAuthenticated) {
          name = state.profile?['employees']?['full_name'] ?? 'Employee';
          email = state.user.email ?? '';
          avatarUrl = state.profile?['employees']?['profile_picture'] ?? '';
        }

        return Drawer(
          child: Column(
            children: [
              UserAccountsDrawerHeader(
                decoration: const BoxDecoration(color: Color(0xFF1E3A5F)),
                accountName: Row(
                  children: [
                    Image.asset('assets/images/logo_white.png', height: 24),
                    const SizedBox(width: 8),
                    Flexible(child: Text(name, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold))),
                  ],
                ),
                accountEmail: Text(email),
                currentAccountPicture: CircleAvatar(
                  backgroundColor: Colors.white,
                  backgroundImage: avatarUrl.isNotEmpty ? NetworkImage(avatarUrl) : null,
                  child: avatarUrl.isEmpty
                      ? Text(name.isNotEmpty ? name[0].toUpperCase() : 'U', style: const TextStyle(fontSize: 24, color: Color(0xFF1E3A5F), fontWeight: FontWeight.bold))
                      : null,
                ),
              ),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    _buildDrawerItem(icon: Icons.home, title: 'Home', isSelected: selectedIndex == 0, onTap: () {
                      Navigator.pop(context);
                      onTabSelected(0);
                    }),
                    _buildDrawerItem(icon: Icons.access_time, title: 'Attendance', isSelected: selectedIndex == 1, onTap: () {
                      Navigator.pop(context);
                      onTabSelected(1);
                    }),
                    _buildDrawerItem(icon: Icons.event_busy, title: 'Leaves', isSelected: selectedIndex == 2, onTap: () {
                      Navigator.pop(context);
                      onTabSelected(2);
                    }),
                    _buildDrawerItem(icon: Icons.receipt_long, title: 'My Payslip', isSelected: false, onTap: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const PayslipScreen()));
                    }),
                    _buildDrawerItem(icon: Icons.campaign, title: 'Announcements', isSelected: selectedIndex == 3, onTap: () {
                      Navigator.pop(context);
                      onTabSelected(3);
                    }),
                    _buildDrawerItem(icon: Icons.phone, title: 'HR Contact', isSelected: false, onTap: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const HrContactScreen()));
                    }),
                    _buildDrawerItem(icon: Icons.person, title: 'My Profile', isSelected: selectedIndex == 4, onTap: () {
                      Navigator.pop(context);
                      onTabSelected(4);
                    }),
                  ],
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.logout, color: Colors.red),
                title: const Text('Logout', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                onTap: () {
                  Navigator.pop(context);
                  context.read<AuthBloc>().add(HRMSAuthLogoutRequested());
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDrawerItem({required IconData icon, required String title, required bool isSelected, required VoidCallback onTap}) {
    return ListTile(
      leading: Icon(icon, color: isSelected ? const Color(0xFF2E86AB) : Colors.grey.shade700),
      title: Text(title, style: TextStyle(color: isSelected ? const Color(0xFF2E86AB) : Colors.grey.shade800, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
      selected: isSelected,
      selectedTileColor: const Color(0xFF2E86AB).withAlpha(20),
      onTap: onTap,
    );
  }
}
