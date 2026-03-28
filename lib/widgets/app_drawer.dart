import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../blocs/auth_bloc.dart';

const String _drawerLogoAsset = 'assets/images/4 square White Colour.png';

class AppDrawer extends StatelessWidget {
  final int selectedIndex;

  const AppDrawer({
    Key? key,
    required this.selectedIndex,
  }) : super(key: key);

  static const List<_DrawerDestination> _destinations = [
    _DrawerDestination(
      index: 0,
      title: 'Dashboard',
      subtitle: 'Overview and quick actions',
      icon: Icons.dashboard_rounded,
      routeName: '/dashboard',
    ),
    _DrawerDestination(
      index: 1,
      title: 'Employees',
      subtitle: 'Directory and employee records',
      icon: Icons.groups_rounded,
      routeName: '/employees',
    ),
    _DrawerDestination(
      index: 2,
      title: 'Attendance',
      subtitle: 'Punch and daily logs',
      icon: Icons.access_time_filled_rounded,
      routeName: '/attendance',
    ),
    _DrawerDestination(
      index: 3,
      title: 'Leave Requests',
      subtitle: 'Leave and permission records',
      icon: Icons.event_note_rounded,
      routeName: '/leave-requests',
    ),
    _DrawerDestination(
      index: 4,
      title: 'Payroll',
      subtitle: 'Salary cycles and statements',
      icon: Icons.account_balance_wallet_rounded,
      routeName: '/payroll',
    ),
    _DrawerDestination(
      index: 5,
      title: 'Announcements',
      subtitle: 'Updates and celebrations',
      icon: Icons.campaign_rounded,
      routeName: '/announcements',
    ),
    _DrawerDestination(
      index: 6,
      title: 'Expenses',
      subtitle: 'Claims and reimbursements',
      icon: Icons.receipt_long_rounded,
      routeName: '/expenses',
    ),
    _DrawerDestination(
      index: 7,
      title: 'Performance',
      subtitle: 'Goals, reviews, and growth',
      icon: Icons.trending_up_rounded,
      routeName: '/performance',
    ),
  ];

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

        return Theme(
          data: Theme.of(context).copyWith(
            splashFactory: InkRipple.splashFactory,
            highlightColor: Colors.white.withOpacity(0.04),
          ),
          child: Drawer(
            width: MediaQuery.of(context).size.width * 0.82,
            backgroundColor: Colors.transparent,
            elevation: 0,
            child: SafeArea(
              child: ClipRRect(
                borderRadius: const BorderRadius.only(
                  topRight: Radius.circular(28),
                  bottomRight: Radius.circular(28),
                ),
                child: Material(
                  color: const Color(0xFF0F1A2E),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          const Color(0xFF13213B),
                          const Color(0xFF0F1A2E),
                          const Color(0xFF0B1526),
                        ],
                      ),
                    ),
                    child: Column(
                      children: [
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
                          decoration: BoxDecoration(
                            border: Border(
                              bottom: BorderSide(
                                color: Colors.white.withOpacity(0.08),
                              ),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Align(
                                      alignment: Alignment.centerLeft,
                                      child: LayoutBuilder(
                                        builder: (context, constraints) {
                                          final logoWidth =
                                              constraints.maxWidth.clamp(
                                                    120.0,
                                                    168.0,
                                                  )
                                                  as double;
                                          return Container(
                                            height: 64,
                                            padding: const EdgeInsets.all(12),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withOpacity(
                                                0.08,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(22),
                                              border: Border.all(
                                                color: Colors.white.withOpacity(
                                                  0.10,
                                                ),
                                              ),
                                            ),
                                            child: Image.asset(
                                              _drawerLogoAsset,
                                              width: logoWidth,
                                              fit: BoxFit.contain,
                                              filterQuality:
                                                  FilterQuality.high,
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 18),
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 24,
                                    backgroundColor: const Color(0xFF1E3A5F),
                                    backgroundImage: avatarUrl.isNotEmpty
                                        ? NetworkImage(avatarUrl)
                                        : null,
                                    child: avatarUrl.isEmpty
                                        ? Text(
                                            name.isNotEmpty
                                                ? name[0].toUpperCase()
                                                : 'U',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 18,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          )
                                        : null,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 3),
                                        Text(
                                          email,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: Colors.white.withOpacity(0.58),
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: ListView(
                            padding: const EdgeInsets.fromLTRB(14, 18, 14, 12),
                            children: [
                              _DrawerSectionLabel(label: 'Navigation'),
                              const SizedBox(height: 8),
                              ..._destinations.map(
                                (destination) => _buildDrawerItem(
                                  context: context,
                                  icon: destination.icon,
                                  title: destination.title,
                                  subtitle: destination.subtitle,
                                  isSelected: selectedIndex == destination.index,
                                  onTap: () {
                                    final navigator = Navigator.of(context);
                                    navigator.pop();
                                    if (selectedIndex == destination.index) {
                                      return;
                                    }
                                    Future<void>.microtask(() {
                                      navigator.pushNamed(
                                        destination.routeName,
                                      );
                                    });
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 0, 14, 18),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              borderRadius: BorderRadius.circular(22),
                              splashColor: Colors.red.withOpacity(0.16),
                              onTap: () {
                                Navigator.pop(context);
                                context
                                    .read<AuthBloc>()
                                    .add(HRMSAuthLogoutRequested());
                              },
                              child: Ink(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 14,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.red.withOpacity(0.08),
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(
                                    color: Colors.red.withOpacity(0.20),
                                  ),
                                ),
                                child: Row(
                                  children: const [
                                    Icon(
                                      Icons.logout_rounded,
                                      color: Color(0xFFFF8B8B),
                                    ),
                                    SizedBox(width: 12),
                                    Text(
                                      'Logout',
                                      style: TextStyle(
                                        color: Color(0xFFFF8B8B),
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDrawerItem({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          splashColor: Colors.white.withOpacity(0.12),
          highlightColor: Colors.white.withOpacity(0.04),
          onTap: onTap,
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: isSelected
                  ? const Color(0xFF1E3A5F).withOpacity(0.82)
                  : Colors.white.withOpacity(0.03),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: isSelected
                    ? const Color(0xFF2E86AB).withOpacity(0.55)
                    : Colors.white.withOpacity(0.06),
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: const Color(0xFF2E86AB).withOpacity(0.18),
                        blurRadius: 18,
                        offset: const Offset(0, 10),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOut,
                  height: 42,
                  width: 42,
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFF2E86AB).withOpacity(0.22)
                        : Colors.white.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    icon,
                    size: 21,
                    color: isSelected
                        ? const Color(0xFF8DD3FF)
                        : Colors.white.withOpacity(0.84),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.96),
                          fontSize: 14,
                          fontWeight:
                              isSelected ? FontWeight.w700 : FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.50),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                AnimatedOpacity(
                  duration: const Duration(milliseconds: 180),
                  opacity: isSelected ? 1 : 0.35,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFF8DD3FF)
                          : Colors.white.withOpacity(0.26),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DrawerDestination {
  final int index;
  final String title;
  final String subtitle;
  final IconData icon;
  final String routeName;

  const _DrawerDestination({
    required this.index,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.routeName,
  });
}

class _DrawerSectionLabel extends StatelessWidget {
  final String label;

  const _DrawerSectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Text(
        label,
        style: TextStyle(
          color: Colors.white.withOpacity(0.42),
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}
