import 'package:flutter/material.dart';

import '../widgets/app_drawer.dart';
import '../widgets/dashboard_brand_logo.dart';

const Color _primaryBlue = Color(0xFF1E3A5F);

class EmployeesScreen extends StatelessWidget {
  const EmployeesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _ModulePlaceholderScreen(
      selectedIndex: 1,
      title: 'Employees',
      subtitle: 'Employee directory, profiles, and onboarding workflows will be available here.',
      icon: Icons.groups_rounded,
      highlights: [
        'Employee records synced from your HRMS workspace',
        'Directory search, profiles, and onboarding shortcuts',
        'Prepared for future Supabase-backed mobile views',
      ],
    );
  }
}

class PayrollScreen extends StatelessWidget {
  const PayrollScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _ModulePlaceholderScreen(
      selectedIndex: 4,
      title: 'Payroll',
      subtitle: 'Payroll operations, salary summaries, and payslip actions will appear here.',
      icon: Icons.account_balance_wallet_rounded,
      highlights: [
        'Monthly payroll status and salary cycle tracking',
        'Payslip history and approval actions',
        'Designed to match the enterprise web portal navigation',
      ],
    );
  }
}

class ExpensesScreen extends StatelessWidget {
  const ExpensesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _ModulePlaceholderScreen(
      selectedIndex: 6,
      title: 'Expenses',
      subtitle: 'Claims, receipts, and reimbursement progress will be managed here.',
      icon: Icons.receipt_long_rounded,
      highlights: [
        'Expense submission and reimbursement tracking',
        'Receipt review and approval status visibility',
        'Responsive mobile layout prepared for future data integration',
      ],
    );
  }
}

class PerformanceScreen extends StatelessWidget {
  const PerformanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const _ModulePlaceholderScreen(
      selectedIndex: 7,
      title: 'Performance',
      subtitle: 'Performance reviews, goals, and feedback insights will be surfaced here.',
      icon: Icons.trending_up_rounded,
      highlights: [
        'Review cycles, ratings, and goals at a glance',
        'Manager feedback and growth plans in one place',
        'Built as a dedicated mobile destination for the drawer',
      ],
    );
  }
}

class _ModulePlaceholderScreen extends StatelessWidget {
  const _ModulePlaceholderScreen({
    required this.selectedIndex,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.highlights,
  });

  final int selectedIndex;
  final String title;
  final String subtitle;
  final IconData icon;
  final List<String> highlights;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      drawer: AppDrawer(selectedIndex: selectedIndex),
      drawerEnableOpenDragGesture: true,
      drawerEdgeDragWidth: 28,
      appBar: AppBar(
        leading: Builder(
          builder: (context) => IconButton(
            tooltip: 'Open menu',
            icon: const Icon(Icons.menu_rounded, color: Colors.white),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        title: const DashboardBrandLogo(
          width: 108,
          height: 40,
          padding: EdgeInsets.all(8),
          backgroundColor: Colors.transparent,
        ),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF162741),
                  Color(0xFF1E3A5F),
                  Color(0xFF2E86AB),
                ],
              ),
              borderRadius: BorderRadius.all(Radius.circular(28)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x261E3A5F),
                  blurRadius: 28,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 52,
                  width: 52,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.14),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Icon(icon, color: Colors.white, size: 28),
                ),
                const SizedBox(height: 18),
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.82),
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFE5EAF2)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0D14253B),
                  blurRadius: 18,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Enterprise Module',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: const Color(0xFF1D2C43),
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  'This mobile destination is ready and routed from the drawer so the sidebar matches the web portal structure.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF6A778B),
                        height: 1.5,
                      ),
                ),
                const SizedBox(height: 18),
                ...highlights.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          height: 8,
                          width: 8,
                          decoration: const BoxDecoration(
                            color: _primaryBlue,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            item,
                            style:
                                Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      color: const Color(0xFF44546B),
                                      height: 1.45,
                                    ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
