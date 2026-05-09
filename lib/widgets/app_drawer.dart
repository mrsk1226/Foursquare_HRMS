import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../blocs/auth_bloc.dart';

const String _drawerLogoAsset = 'assets/images/4 square White Colour.png';

class AppDrawer extends StatelessWidget {
  const AppDrawer({
    super.key,
    required this.selectedIndex,
    this.onItemSelected,
  });

  final int selectedIndex;
  final ValueChanged<int>? onItemSelected;

  static const List<_DrawerDestination> _workspaceDestinations = [
    _DrawerDestination(
      selectionIndex: 0,
      tabIndex: 0,
      title: 'Dashboard',
      subtitle: 'Overview and quick actions',
      icon: Icons.dashboard_rounded,
      routeName: '/dashboard',
    ),
    _DrawerDestination(
      selectionIndex: 1,
      tabIndex: 1,
      title: 'Attendance',
      subtitle: 'Punch and daily logs',
      icon: Icons.access_time_filled_rounded,
      routeName: '/attendance',
    ),
    _DrawerDestination(
      selectionIndex: 2,
      tabIndex: 2,
      title: 'Leave',
      subtitle: 'Leave and permission records',
      icon: Icons.event_note_rounded,
      routeName: '/leave-requests',
    ),
    _DrawerDestination(
      selectionIndex: 3,
      tabIndex: 3,
      title: 'Engage',
      subtitle: 'Updates and celebrations',
      icon: Icons.campaign_rounded,
      routeName: '/announcements',
    ),
    _DrawerDestination(
      selectionIndex: 4,
      tabIndex: 4,
      title: 'Profile',
      subtitle: 'Personal and work details',
      icon: Icons.person_rounded,
      routeName: '/profile',
    ),
  ];

  static const List<_DrawerDestination> _moduleDestinations = [
    _DrawerDestination(
      selectionIndex: 10,
      title: 'Employees',
      subtitle: 'Directory and employee records',
      icon: Icons.groups_rounded,
      routeName: '/employees',
    ),
    _DrawerDestination(
      selectionIndex: 11,
      title: 'Payroll',
      subtitle: 'Salary cycles and statements',
      icon: Icons.account_balance_wallet_rounded,
      routeName: '/payroll',
    ),
    _DrawerDestination(
      selectionIndex: 12,
      title: 'Expenses',
      subtitle: 'Claims and reimbursements',
      icon: Icons.receipt_long_rounded,
      routeName: '/expenses',
    ),
    _DrawerDestination(
      selectionIndex: 13,
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
            highlightColor: Colors.white.withValues(alpha: 0.04),
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
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color(0xFF13213B),
                          Color(0xFF0F1A2E),
                          Color(0xFF0B1526),
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
                                color: Colors.white.withValues(alpha: 0.08),
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
                                          final logoWidth = constraints.maxWidth
                                              .clamp(120.0, 168.0);
                                          return Container(
                                            height: 64,
                                            padding: const EdgeInsets.all(12),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withValues(
                                                alpha: 0.08,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(22),
                                              border: Border.all(
                                                color: Colors.white.withValues(
                                                  alpha: 0.10,
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
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
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
                                            color: Colors.white.withValues(
                                              alpha: 0.58,
                                            ),
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
                              const _DrawerSectionLabel(label: 'Workspace'),
                              const SizedBox(height: 8),
                              ..._workspaceDestinations.map(
                                (destination) => _buildDrawerItem(
                                  context: context,
                                  destination: destination,
                                ),
                              ),
                              const SizedBox(height: 12),
                              const _DrawerSectionLabel(label: 'Modules'),
                              const SizedBox(height: 8),
                              ..._moduleDestinations.map(
                                (destination) => _buildDrawerItem(
                                  context: context,
                                  destination: destination,
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
                              splashColor: Colors.red.withValues(alpha: 0.16),
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
                                  color: Colors.red.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(
                                    color: Colors.red.withValues(alpha: 0.20),
                                  ),
                                ),
                                child: const Row(
                                  children: [
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
    required _DrawerDestination destination,
  }) {
    final isSelected = selectedIndex == destination.selectionIndex;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          splashColor: Colors.white.withValues(alpha: 0.12),
          highlightColor: Colors.white.withValues(alpha: 0.04),
          onTap: () => _handleDestinationTap(context, destination),
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: isSelected
                  ? const Color(0xFF1E3A5F).withValues(alpha: 0.82)
                  : Colors.white.withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: isSelected
                    ? const Color(0xFF2E86AB).withValues(alpha: 0.55)
                    : Colors.white.withValues(alpha: 0.06),
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: const Color(0xFF2E86AB).withValues(alpha: 0.18),
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
                        ? const Color(0xFF2E86AB).withValues(alpha: 0.22)
                        : Colors.white.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    destination.icon,
                    size: 21,
                    color: isSelected
                        ? const Color(0xFF8DD3FF)
                        : Colors.white.withValues(alpha: 0.84),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        destination.title,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.96),
                          fontSize: 14,
                          fontWeight:
                              isSelected ? FontWeight.w700 : FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        destination.subtitle,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.50),
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
                          : Colors.white.withValues(alpha: 0.26),
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

  void _handleDestinationTap(
    BuildContext context,
    _DrawerDestination destination,
  ) {
    final navigator = Navigator.of(context);
    navigator.pop();

    if (selectedIndex == destination.selectionIndex) {
      return;
    }

    Future<void>.microtask(() {
      if (destination.tabIndex != null && onItemSelected != null) {
        onItemSelected!(destination.tabIndex!);
        return;
      }

      navigator.pushReplacementNamed(destination.routeName);
    });
  }
}

class _DrawerDestination {
  const _DrawerDestination({
    required this.selectionIndex,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.routeName,
    this.tabIndex,
  });

  final int selectionIndex;
  final int? tabIndex;
  final String title;
  final String subtitle;
  final IconData icon;
  final String routeName;
}

class _DrawerSectionLabel extends StatelessWidget {
  const _DrawerSectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Text(
        label,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.42),
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}
