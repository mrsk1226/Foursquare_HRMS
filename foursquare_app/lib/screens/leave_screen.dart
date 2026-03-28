import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../widgets/app_drawer.dart';

class LeaveScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const LeaveScreen({Key? key, this.switchTab}) : super(key: key);

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen>
    with SingleTickerProviderStateMixin {
  final supabase = Supabase.instance.client;

  String? _employeeId;
  String _fullName = '';
  String _userRole = 'employee';
  String _department = '';
  bool _isLoading = true;

  List<dynamic> _leaveRequests = [];
  List<dynamic> _permissions = [];
  List<dynamic> _leaveTypes = [];

  bool _isLeaveLoading = false;
  bool _isPermLoading = false;

  late TabController _tabController;

  // ─── Colours ───────────────────────────────────────────────
  static const _navy = Color(0xFF1a2744);
  static const _orange = Color(0xFFFF8C00);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) setState(() {});
    });
    _loadProfile();
  }

  // ──────────────────────────────────────────────────────────
  // DATA LOADING
  // ──────────────────────────────────────────────────────────

  Future<void> _loadProfile() async {
    try {
      final user = supabase.auth.currentUser;
      if (user == null) {
        setState(() => _isLoading = false);
        return;
      }

      final profileData = await supabase
          .from('profiles')
          .select('employee_id, role')
          .eq('id', user.id)
          .single();

      final empId = profileData['employee_id'];
      final role = profileData['role'] ?? 'employee';

      final employeeData = await supabase
          .from('employees')
          .select('full_name, department')
          .eq('employee_id', empId)
          .single();

      if (mounted) {
        setState(() {
          _employeeId = empId;
          _fullName = employeeData['full_name'] ?? '';
          _department = employeeData['department'] ?? '';
          _userRole = role;
          _isLoading = false;
        });
        _loadLeaveTypes();
        _loadLeaveRequests();
        _loadPermissions();
      }
    } catch (e) {
      debugPrint("Error loading profile: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }


  Future<void> _loadLeaveRequests() async {
    if (_employeeId == null) return;
    setState(() => _isLeaveLoading = true);
    try {
      final data = await supabase
          .from('leave_requests')
          .select()
          .eq('employee_id', _employeeId!)
          .order('created_at', ascending: false);
      if (mounted) {
        setState(() {
          _leaveRequests = data;
          _isLeaveLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLeaveLoading = false);
    }
  }

  Future<void> _loadPermissions() async {
    if (_employeeId == null) return;
    setState(() => _isPermLoading = true);
    try {
      final data = await supabase
          .from('permissions')
          .select()
          .eq('employee_id', _employeeId!)
          .order('created_at', ascending: false);
      if (mounted) {
        setState(() {
          _permissions = data;
          _isPermLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isPermLoading = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // ──────────────────────────────────────────────────────────
  // BUILD
  // ──────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        drawer: AppDrawer(
          selectedIndex: 2,
          onItemSelected: (i) => widget.switchTab?.call(i),
        ),
        appBar: _appBar(),
        body: const Center(child: CircularProgressIndicator(color: _navy)),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      drawer: AppDrawer(
        selectedIndex: 2,
        onItemSelected: (i) => widget.switchTab?.call(i),
      ),
      appBar: _appBar(withTabs: true),
      body: TabBarView(
        controller: _tabController,
        children: [_buildLeaveTab(), _buildPermissionTab()],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          if (_employeeId == null) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                content: Text('Please wait, profile is loading...')));
            return;
          }
          _tabController.index == 0
              ? _showLeaveForm(context)
              : _showPermissionForm(context);
        },
        backgroundColor: _orange,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: Text(
          _tabController.index == 0 ? 'Apply Leave' : 'Apply Permission',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  AppBar _appBar({bool withTabs = false}) {
    return AppBar(
      title: const Text('Leave & Permissions',
          style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
      backgroundColor: const Color(0xFF0F172A),
      iconTheme: const IconThemeData(color: Colors.white),
      centerTitle: true,
      bottom: withTabs
          ? TabBar(
              controller: _tabController,
              indicatorColor: _orange,
              indicatorWeight: 3,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              tabs: const [
                Tab(text: "LEAVE REQUESTS"),
                Tab(text: "PERMISSIONS"),
              ],
            )
          : null,
    );
  }

  // ──────────────────────────────────────────────────────────
  // LEAVE TAB
  // ──────────────────────────────────────────────────────────

  Widget _buildLeaveTab() {
    return RefreshIndicator(
      onRefresh: _loadLeaveRequests,
      child: _isLeaveLoading
          ? const Center(child: CircularProgressIndicator())
          : _leaveRequests.isEmpty
              ? _buildEmptyState(
                  "No leave requests found", Icons.beach_access_outlined)
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _leaveRequests.length + 1,
                  itemBuilder: (context, index) {
                    if (index == _leaveRequests.length) {
                      return const SizedBox(height: 80);
                    }
                    return _buildLeaveCard(_leaveRequests[index]);
                  },
                ),
    );
  }

  // ──────────────────────────────────────────────────────────
  // LEAVE CARD  (2-stage status)
  // ──────────────────────────────────────────────────────────

  Widget _buildLeaveCard(dynamic leave) {
    final type = leave['leave_type'] ?? 'Casual Leave';
    final status = (leave['status'] ?? 'pending').toLowerCase();
    final hrStatus = (leave['hr_status'] ?? 'pending').toLowerCase();
    final mdStatus = (leave['md_status'] ?? 'waiting').toLowerCase();

    DateTime start =
        DateTime.tryParse(leave['start_date'] ?? '') ?? DateTime.now();
    DateTime end = DateTime.tryParse(leave['end_date'] ?? '') ?? DateTime.now();
    int days = end.difference(start).inDays + 1;

    // Leave type colour
    final Map<String, Color> typeColors = {
      'Sick Leave': Colors.orange,
      'Earned Leave': Colors.green,
      'Emergency Leave': Colors.red,
      'Loss of Pay': Colors.grey,
    };
    final badgeColor = typeColors[type] ?? Colors.blue;

    return InkWell(
      onTap: () => _showLeaveDetails(context, leave),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 12,
                offset: const Offset(0, 4))
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Row 1: leave type + overall status ──
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _typeBadge(type, badgeColor),
                  _overallStatusBadge(status),
                ],
              ),
              const SizedBox(height: 12),

              // ── Dates ──
              Row(
                children: [
                  const Icon(Icons.calendar_today, size: 15, color: _navy),
                  const SizedBox(width: 6),
                  Text(
                    "${DateFormat('dd MMM').format(start)} → "
                    "${DateFormat('dd MMM yyyy').format(end)}  "
                    "($days ${days == 1 ? 'day' : 'days'})",
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: _navy),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(leave['reason'] ?? 'No reason provided',
                  style: TextStyle(color: Colors.grey[600], fontSize: 13)),

              const SizedBox(height: 12),

              // ── 2-Stage progress bar ──
              _buildStageProgress(hrStatus, mdStatus, status),

              // ── Rejection reason ──
              if ((status == 'rejected') &&
                  (leave['hr_remarks'] != null ||
                      leave['md_remarks'] != null)) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(8)),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline,
                          color: Colors.red, size: 16),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          "Rejected: ${leave['md_remarks'] ?? leave['hr_remarks']}",
                          style: const TextStyle(
                              color: Colors.red,
                              fontWeight: FontWeight.w600,
                              fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _loadLeaveTypes() async {
    try {
      final data = await supabase
          .from('leave_types')
          .select('name, max_days_per_year')
          .eq('is_active', true)
          .order('name');
      if (mounted) setState(() => _leaveTypes = data);
    } catch (e) {
      // fallback to 12 defaults
      if (mounted) {
        setState(() => _leaveTypes = [
              {'name': 'Casual Leave'},
              {'name': 'Sick Leave'},
              {'name': 'Earned Leave'},
              {'name': 'Loss of Pay (LOP)'},
              {'name': 'Maternity Leave'},
              {'name': 'Paternity Leave'},
              {'name': 'Compensatory Off (Comp Off)'},
              {'name': 'Marriage Leave'},
              {'name': 'Bereavement Leave'},
              {'name': 'Emergency Leave'},
              {'name': 'Public Holiday'},
              {'name': 'Work From Home (WFH)'},
            ]);
      }
    }
  }

  // ── 2-Stage progress indicator ──────────────────────────

  Widget _buildStageProgress(
      String hrStatus, String mdStatus, String overallStatus) {
    final stage1Done = hrStatus == 'approved' || overallStatus == 'approved';
    final rejected = overallStatus == 'rejected';
    final isFinal = overallStatus == 'approved';
    final isShowroom = _department.toUpperCase() == 'SHOWROOM';
    final approverLabel = isShowroom ? "Dinesh Action" : "HR Action";

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("Approval Timeline",
            style: TextStyle(
                fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _step(
                label: "Submitted",
                status: 'approved',
                icon: Icons.send_rounded),
            _line(stage1Done),
            _step(
                label: approverLabel,
                status: rejected && hrStatus == 'rejected'
                    ? 'rejected'
                    : stage1Done
                        ? 'approved'
                        : 'pending',
                icon: isShowroom ? Icons.person : Icons.person_search),
            _line(isFinal),
            _step(
                label: "Final",
                status: isFinal ? 'approved' : 'waiting',
                icon: Icons.assignment_turned_in),
          ],
        ),
      ],
    );
  }

  Widget _line(bool active) => Expanded(
        child: Container(
          height: 2,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          color: active ? Colors.green : Colors.grey[300],
        ),
      );

  Widget _step(
      {required String label, required String status, required IconData icon}) {
    Color color;
    IconData statusIcon;
    switch (status) {
      case 'approved':
        color = Colors.green;
        statusIcon = Icons.check_circle;
        break;
      case 'rejected':
        color = Colors.red;
        statusIcon = Icons.cancel;
        break;
      case 'pending':
        color = Colors.orange;
        statusIcon = Icons.access_time_filled;
        break;
      default: // waiting
        color = Colors.grey;
        statusIcon = Icons.hourglass_top_rounded;
    }

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
              border: Border.all(color: color, width: 1.5)),
          child: Icon(statusIcon, color: color, size: 16),
        ),
        const SizedBox(height: 4),
        Text(label,
            style: TextStyle(
                fontSize: 10, color: color, fontWeight: FontWeight.bold)),
        Text(status.toUpperCase(), style: TextStyle(fontSize: 9, color: color)),
      ],
    );
  }

  Widget _typeBadge(String type, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8)),
      child: Text(type,
          style: TextStyle(
              color: color, fontWeight: FontWeight.bold, fontSize: 12)),
    );
  }

  Widget _overallStatusBadge(String status) {
    Color color;
    IconData icon;
    String label;

    switch (status) {
      case 'approved':
        color = Colors.green;
        icon = Icons.check_circle_outline;
        label = 'Fully Approved';
        break;
      case 'rejected':
        color = Colors.red;
        icon = Icons.cancel_outlined;
        label = 'Rejected';
        break;
      case 'hr_approved':
        color = Colors.green;
        icon = Icons.check_circle_outline;
        label = 'HR Approved';
        break;
      case 'pending':
      default:
        color = Colors.amber;
        icon = Icons.hourglass_empty;
        final isShowroom = _department.toUpperCase() == 'SHOWROOM';
        label = isShowroom ? 'Waiting for Dinesh' : 'Waiting for HR';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3))),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  color: color, fontWeight: FontWeight.bold, fontSize: 10)),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────
  // PERMISSION TAB
  // ──────────────────────────────────────────────────────────

  Widget _buildPermissionTab() {
    return RefreshIndicator(
      onRefresh: _loadPermissions,
      child: _isPermLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildPermissionSummary(),
                Expanded(
                  child: _permissions.isEmpty
                      ? _buildEmptyState("No permission requests found",
                          Icons.access_time_outlined)
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _permissions.length + 1,
                          itemBuilder: (context, index) {
                            if (index == _permissions.length) {
                              return const SizedBox(height: 80);
                            }
                            return _buildPermissionCard(_permissions[index]);
                          },
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildPermissionSummary() {
    double usedMinutes = 0;
    final now = DateTime.now();
    for (var p in _permissions) {
      final pDate = DateTime.tryParse(p['date'] ?? '');
      if (pDate != null &&
          pDate.month == now.month &&
          pDate.year == now.year &&
          p['status'] != 'rejected') {
        usedMinutes += (p['duration_minutes'] ?? 0);
      }
    }
    final usedHours = usedMinutes / 60;
    final progress = (usedHours / 4.0).clamp(0.0, 1.0);

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, 4))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Monthly Summary (${DateFormat('MMMM').format(now)})",
                style:
                    const TextStyle(fontWeight: FontWeight.bold, color: _navy),
              ),
              Text(
                "${usedHours.toStringAsFixed(1)} / 4.0 hrs",
                style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: progress >= 1.0 ? Colors.red : Colors.blue),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: Colors.grey[200],
              valueColor: AlwaysStoppedAnimation<Color>(
                  progress >= 1.0 ? Colors.red : Colors.blue),
              minHeight: 8,
            ),
          ),
          if (progress >= 1.0) ...[
            const SizedBox(height: 8),
            const Text("⚠️ Monthly permission limit reached!",
                style: TextStyle(
                    color: Colors.red,
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
          ]
        ],
      ),
    );
  }

  Widget _buildPermissionCard(dynamic perm) {
    final status = (perm['status'] ?? 'pending').toLowerCase();
    final hrStatus = (perm['hr_status'] ?? 'pending').toLowerCase();
    final mdStatus = (perm['md_status'] ?? 'waiting').toLowerCase();
    final date = DateTime.tryParse(perm['date'] ?? '') ?? DateTime.now();

    String startTime = perm['start_time'] ?? '--:--';
    String endTime = perm['end_time'] ?? '--:--';
    if (startTime.length > 5) startTime = startTime.substring(0, 5);
    if (endTime.length > 5) endTime = endTime.substring(0, 5);

    return InkWell(
      onTap: () => _showPermissionDetails(context, perm),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 12,
                offset: const Offset(0, 4)),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(DateFormat('dd MMM yyyy').format(date),
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, color: _navy)),
                  _overallStatusBadge(status),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.access_time, size: 15, color: _navy),
                  const SizedBox(width: 6),
                  Text(
                    "$startTime - $endTime  (${perm['duration_minutes']} min)",
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: _navy),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(perm['reason'] ?? 'No reason',
                  style: TextStyle(color: Colors.grey[600], fontSize: 13)),
              const SizedBox(height: 12),
              _buildStageProgress(hrStatus, mdStatus, status),
              if (status == 'rejected' &&
                  (perm['hr_remarks'] != null ||
                      perm['md_remarks'] != null)) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(8)),
                  child: Text(
                    "Rejected: ${perm['md_remarks'] ?? perm['hr_remarks']}",
                    style: const TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.w600,
                        fontSize: 12),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────
  // EMPTY STATE
  // ──────────────────────────────────────────────────────────

  Widget _buildEmptyState(String msg, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(msg,
              style: TextStyle(
                  color: Colors.grey[500],
                  fontWeight: FontWeight.w500,
                  fontSize: 15)),
          const SizedBox(height: 8),
          Text("Tap '+' to apply",
              style: TextStyle(color: Colors.grey[400], fontSize: 13)),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────
  // LEAVE FORM  (Apply Leave)
  // ──────────────────────────────────────────────────────────

  void _showLeaveForm(BuildContext context) {
    String? selectedLeaveType;
    DateTime? startDate;
    DateTime? endDate;
    final reasonController = TextEditingController();
    bool isSubmitting = false;

    final typeNames = _leaveTypes.isNotEmpty
        ? _leaveTypes.map<String>((e) => e['name'] as String).toList()
        : ['Casual Leave', 'Sick Leave', 'Earned Leave'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (ctx, setModalState) => DraggableScrollableSheet(
          initialChildSize: 0.88,
          maxChildSize: 0.95,
          minChildSize: 0.5,
          builder: (_, scrollCtrl) => Container(
            decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
            child: Column(
              children: [
                const SizedBox(height: 12),
                Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey[300],
                        borderRadius: BorderRadius.circular(2))),
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text("Apply Leave",
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: _navy)),
                ),

                // ── Role notice for HR ──
                if (_userRole.toLowerCase() == 'hr')
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(10)),
                    child: const Row(
                      children: [
                        Icon(Icons.info_outline, color: Colors.blue, size: 16),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            "HR leave requests go directly to MD for approval.",
                            style: TextStyle(
                                color: Colors.blue,
                                fontSize: 12,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),

                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollCtrl,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Leave type dropdown (from DB)
                          DropdownButtonFormField<String>(
                            initialValue: selectedLeaveType,
                            decoration: InputDecoration(
                              labelText: "Leave Type",
                              prefixIcon: const Icon(Icons.category_outlined,
                                  color: _navy),
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                            items: typeNames
                                .map((e) =>
                                    DropdownMenuItem(value: e, child: Text(e)))
                                .toList(),
                            onChanged: (v) =>
                                setModalState(() => selectedLeaveType = v),
                          ),
                          const SizedBox(height: 16),

                          // Date pickers
                          Row(
                            children: [
                              Expanded(
                                  child: _datePicker(
                                      label: "Start Date",
                                      value: startDate,
                                      onPicked: (d) =>
                                          setModalState(() => startDate = d),
                                      context: context)),
                              const SizedBox(width: 12),
                              Expanded(
                                  child: _datePicker(
                                      label: "End Date",
                                      value: endDate,
                                      firstDate: startDate,
                                      onPicked: (d) =>
                                          setModalState(() => endDate = d),
                                      context: context)),
                            ],
                          ),

                          // Duration chip
                          if (startDate != null && endDate != null) ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                  color: Colors.blue[50],
                                  borderRadius: BorderRadius.circular(12)),
                              child: Row(
                                children: [
                                  const Icon(Icons.info_outline,
                                      color: Colors.blue, size: 18),
                                  const SizedBox(width: 8),
                                  Text(
                                    "Duration: ${endDate!.difference(startDate!).inDays + 1} working days",
                                    style: const TextStyle(
                                        color: Colors.blue,
                                        fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 16),

                          // Reason
                          TextField(
                            controller: reasonController,
                            maxLines: 3,
                            decoration: InputDecoration(
                              labelText: "Reason for Leave",
                              prefixIcon: const Icon(Icons.edit_note_outlined,
                                  color: _navy),
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Submit button
                          ElevatedButton.icon(
                            onPressed: isSubmitting
                                ? null
                                : () => _submitLeave(
                                      ctx: ctx,
                                      setModalState: setModalState,
                                      selectedLeaveType: selectedLeaveType,
                                      startDate: startDate,
                                      endDate: endDate,
                                      reason: reasonController.text.trim(),
                                      setSubmitting: (v) =>
                                          setModalState(() => isSubmitting = v),
                                    ),
                            icon: isSubmitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                        color: Colors.white, strokeWidth: 2))
                                : const Icon(Icons.send, color: Colors.white),
                            label: Text(
                              isSubmitting
                                  ? 'Submitting...'
                                  : 'Submit Leave Request',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _navy,
                              minimumSize: const Size(double.infinity, 52),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],
                      ),
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

  // ── Leave submit logic ──────────────────────────────────

  Future<void> _submitLeave({
    required BuildContext ctx,
    required StateSetter setModalState,
    required String? selectedLeaveType,
    required DateTime? startDate,
    required DateTime? endDate,
    required String reason,
    required Function(bool) setSubmitting,
  }) async {
    if (selectedLeaveType == null ||
        startDate == null ||
        endDate == null ||
        reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please fill all fields')));
      return;
    }

    setSubmitting(true);

    try {
      final totalDays = endDate.difference(startDate).inDays + 1;
      final isHR = _userRole.toLowerCase() == 'hr';

      final hrStatus = 'pending';
      final mdStatus = 'approved'; // MD skipped
      final overallStatus = 'pending';
      final appliedByRole = _userRole.toLowerCase();

      final res = await supabase
          .from('leave_requests')
          .insert({
            'employee_id': _employeeId,
            'leave_type': selectedLeaveType,
            'start_date': startDate.toIso8601String().split('T')[0],
            'end_date': endDate.toIso8601String().split('T')[0],
            'reason': reason,
            'status': overallStatus,
            'hr_status': hrStatus,
            'md_status': mdStatus,
            'applied_by_role': appliedByRole,
            'total_days': totalDays,
          })
          .select()
          .single();

      // Notification routing
      final recipientId = isHR ? 'FSQ000' : 'FSQ002';
      final notifTitle =
          isHR ? '🔔 HR Leave - MD Approval Needed' : '📋 New Leave Request';
      final notifMessage = isHR
          ? 'HR Manager applied for $selectedLeaveType. Needs your final approval.'
          : '$_fullName applied for $selectedLeaveType from '
              '${DateFormat('dd MMM').format(startDate)} to '
              '${DateFormat('dd MMM').format(endDate)} ($totalDays days)';

      await supabase.from('notifications').insert({
        'recipient_employee_id': recipientId,
        'sender_employee_id': _employeeId,
        'type': 'leave_request',
        'title': notifTitle,
        'message': notifMessage,
        'reference_type': 'leave_request',
        'reference_id': res['id'].toString(),
        'is_read': false,
      });

      if (mounted) {
        Navigator.pop(context);
        _loadLeaveRequests();
        final approver = _department.toUpperCase() == 'SHOWROOM' ? 'Dinesh' : 'HR';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('✅ Leave applied! Waiting for $approver approval.'),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 3),
        ));
      }
    } catch (e) {
      setSubmitting(false);
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    }
  }

  // ──────────────────────────────────────────────────────────
  // PERMISSION FORM  (Apply Permission)
  // ──────────────────────────────────────────────────────────

  void _showPermissionForm(BuildContext context) {
    DateTime? permDate = DateTime.now();
    TimeOfDay? startTime;
    TimeOfDay? endTime;
    String? selectedReason;
    final othersController = TextEditingController();
    final remarksController = TextEditingController();
    bool isSubmitting = false;

    final reasons = [
      'Medical Appointment',
      'Family Emergency',
      'Bank Work',
      'Government Office Work',
      'Vehicle Breakdown',
      'Child School Work',
      'Personal Health Issue',
      'Home Emergency',
      'Court/Legal Work',
      'Others',
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (ctx, setModalState) => DraggableScrollableSheet(
          initialChildSize: 0.88,
          maxChildSize: 0.95,
          minChildSize: 0.5,
          builder: (_, scrollCtrl) => Container(
            decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
            child: Column(
              children: [
                const SizedBox(height: 12),
                Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: Colors.grey[300],
                        borderRadius: BorderRadius.circular(2))),
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text("Apply Permission",
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: _navy)),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollCtrl,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Date picker
                          _datePicker(
                            label: "Date",
                            value: permDate,
                            onPicked: (d) => setModalState(() => permDate = d),
                            context: context,
                            firstDate: DateTime.now()
                                .subtract(const Duration(days: 7)),
                            lastDate:
                                DateTime.now().add(const Duration(days: 30)),
                            fullWidth: true,
                          ),
                          const SizedBox(height: 16),

                          // Time pickers
                          Row(
                            children: [
                              Expanded(
                                  child: _timePicker(
                                      label: "Start Time",
                                      value: startTime,
                                      onPicked: (t) =>
                                          setModalState(() => startTime = t),
                                      context: context,
                                      initial:
                                          const TimeOfDay(hour: 9, minute: 0))),
                              const SizedBox(width: 12),
                              Expanded(
                                  child: _timePicker(
                                      label: "End Time",
                                      value: endTime,
                                      onPicked: (t) =>
                                          setModalState(() => endTime = t),
                                      context: context,
                                      initial: startTime ??
                                          const TimeOfDay(
                                              hour: 10, minute: 0))),
                            ],
                          ),

                          // Duration display
                          if (startTime != null && endTime != null) ...[
                            const SizedBox(height: 12),
                            Builder(builder: (_) {
                              final s =
                                  startTime!.hour * 60 + startTime!.minute;
                              final e = endTime!.hour * 60 + endTime!.minute;
                              final dur = e - s;
                              final isValid = dur > 0 && dur <= 120;
                              return Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                    color: isValid
                                        ? Colors.blue[50]
                                        : Colors.red[50],
                                    borderRadius: BorderRadius.circular(10)),
                                child: Text(
                                  isValid
                                      ? "⏱ Duration: ${dur ~/ 60}h ${dur % 60}min"
                                      : "⚠️ Invalid time range (max 2 hrs)",
                                  style: TextStyle(
                                      color: isValid ? Colors.blue : Colors.red,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13),
                                ),
                              );
                            }),
                          ],
                          const SizedBox(height: 16),

                          // Reason dropdown
                          DropdownButtonFormField<String>(
                            initialValue: selectedReason,
                            decoration: InputDecoration(
                              labelText: "Reason",
                              prefixIcon: const Icon(Icons.list_alt_outlined,
                                  color: _navy),
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                            items: reasons
                                .map((e) =>
                                    DropdownMenuItem(value: e, child: Text(e)))
                                .toList(),
                            onChanged: (v) =>
                                setModalState(() => selectedReason = v),
                          ),

                          if (selectedReason == 'Others') ...[
                            const SizedBox(height: 12),
                            TextField(
                              controller: othersController,
                              decoration: InputDecoration(
                                labelText: "Please specify",
                                border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ],
                          const SizedBox(height: 12),

                          // Remarks
                          TextField(
                            controller: remarksController,
                            decoration: InputDecoration(
                              labelText: "Additional Remarks (Optional)",
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Submit
                          ElevatedButton.icon(
                            onPressed: isSubmitting
                                ? null
                                : () => _submitPermission(
                                      ctx: ctx,
                                      setModalState: setModalState,
                                      permDate: permDate,
                                      startTime: startTime,
                                      endTime: endTime,
                                      selectedReason: selectedReason,
                                      othersText: othersController.text.trim(),
                                      remarks: remarksController.text.trim(),
                                      setSubmitting: (v) =>
                                          setModalState(() => isSubmitting = v),
                                    ),
                            icon: isSubmitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                        color: Colors.white, strokeWidth: 2))
                                : const Icon(Icons.send, color: Colors.white),
                            label: Text(
                              isSubmitting
                                  ? 'Submitting...'
                                  : 'Submit Permission Request',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _navy,
                              minimumSize: const Size(double.infinity, 52),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],
                      ),
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

  // ── Permission submit logic ─────────────────────────────

  Future<void> _submitPermission({
    required BuildContext ctx,
    required StateSetter setModalState,
    required DateTime? permDate,
    required TimeOfDay? startTime,
    required TimeOfDay? endTime,
    required String? selectedReason,
    required String othersText,
    required String remarks,
    required Function(bool) setSubmitting,
  }) async {
    if (permDate == null ||
        startTime == null ||
        endTime == null ||
        selectedReason == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please fill all required fields')));
      return;
    }

    final startMins = startTime.hour * 60 + startTime.minute;
    final endMins = endTime.hour * 60 + endTime.minute;
    final duration = endMins - startMins;

    if (duration <= 0 || duration > 120) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Duration must be between 1 and 120 minutes')));
      return;
    }

    if (selectedReason == 'Others' && othersText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please specify the reason')));
      return;
    }

    // Monthly limit check
    final now = DateTime.now();
    final monthlyCount = _permissions.where((p) {
      final pDate = DateTime.tryParse(p['date'] ?? '');
      return pDate != null &&
          pDate.month == now.month &&
          pDate.year == now.year &&
          p['status'] != 'rejected';
    }).length;

    if (monthlyCount >= 4) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Monthly limit of 4 permissions reached')));
      return;
    }

    setSubmitting(true);

    try {
      final finalReason =
          selectedReason == 'Others' ? othersText : selectedReason;
      final isHR = _userRole.toLowerCase() == 'hr';

      final hrStatus = 'pending';
      final mdStatus = 'approved'; // MD skipped
      final overallStatus = 'pending';

      final startTimeStr =
          '${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}:00';
      final endTimeStr =
          '${endTime.hour.toString().padLeft(2, '0')}:${endTime.minute.toString().padLeft(2, '0')}:00';

      final res = await supabase
          .from('permissions')
          .insert({
            'employee_id': _employeeId,
            'date': permDate.toIso8601String().split('T')[0],
            'start_time': startTimeStr,
            'end_time': endTimeStr,
            'duration_minutes': duration,
            'reason': finalReason,
            'remarks': remarks,
            'status': overallStatus,
            'hr_status': hrStatus,
            'md_status': mdStatus,
            'applied_by_role': _userRole.toLowerCase(),
          })
          .select()
          .single();

      final recipientId = isHR ? 'FSQ000' : 'FSQ002';
      await supabase.from('notifications').insert({
        'recipient_employee_id': recipientId,
        'sender_employee_id': _employeeId,
        'type': 'permission_request',
        'title': isHR
            ? '🔔 HR Permission - MD Approval Needed'
            : '📋 New Permission Request',
        'message': isHR
            ? 'HR Manager requested permission on ${DateFormat('dd MMM').format(permDate)} for $finalReason. Needs your approval.'
            : '$_fullName requested permission on ${DateFormat('dd MMM').format(permDate)} for $finalReason ($duration min)',
        'reference_type': 'permission_request',
        'reference_id': res['id'].toString(),
        'is_read': false,
      });

      if (mounted) {
        Navigator.pop(context);
        _loadPermissions();
        final approver = _department.toUpperCase() == 'SHOWROOM' ? 'Dinesh' : 'HR';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('✅ Permission applied! Waiting for $approver approval.'),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 3),
        ));
      }
    } catch (e) {
      setSubmitting(false);
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    }
  }

  // ──────────────────────────────────────────────────────────
  // HELPER WIDGETS
  // ──────────────────────────────────────────────────────────

  Widget _datePicker({
    required String label,
    required DateTime? value,
    required Function(DateTime) onPicked,
    required BuildContext context,
    DateTime? firstDate,
    DateTime? lastDate,
    bool fullWidth = false,
  }) {
    final widget = InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate:
              firstDate ?? DateTime.now().subtract(const Duration(days: 30)),
          lastDate: lastDate ?? DateTime.now().add(const Duration(days: 365)),
        );
        if (picked != null) onPicked(picked);
      },
      child: Container(
        width: fullWidth ? double.infinity : null,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[350]!),
            borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: TextStyle(color: Colors.grey[600], fontSize: 11)),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.calendar_today, size: 14, color: _navy),
                const SizedBox(width: 6),
                Text(
                  value == null
                      ? 'Select'
                      : DateFormat('dd MMM yyyy').format(value),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    return widget;
  }

  Widget _timePicker({
    required String label,
    required TimeOfDay? value,
    required Function(TimeOfDay) onPicked,
    required BuildContext context,
    required TimeOfDay initial,
  }) {
    return InkWell(
      onTap: () async {
        final picked =
            await showTimePicker(context: context, initialTime: initial);
        if (picked != null) onPicked(picked);
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[350]!),
            borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: TextStyle(color: Colors.grey[600], fontSize: 11)),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.access_time, size: 14, color: _navy),
                const SizedBox(width: 6),
                Text(
                  value == null ? 'Select' : value.format(context),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────
  // DETAILS POPUPS
  // ──────────────────────────────────────────────────────────

  void _showLeaveDetails(BuildContext context, dynamic leave) {
    final status = (leave['status'] ?? 'pending').toLowerCase();
    final hrStatus = (leave['hr_status'] ?? 'pending').toLowerCase();
    final mdStatus = (leave['md_status'] ?? 'waiting').toLowerCase();
    final hrRemarks = leave['hr_remarks'];
    final mdRemarks = leave['md_remarks'];

    String overallMsg = "";
    if (status == 'rejected') {
      overallMsg = "Leave rejected. See remarks above.";
    } else if (mdStatus == 'approved') {
      overallMsg = "Your leave is fully approved!";
    } else if (hrStatus == 'approved' && mdStatus == 'pending') {
      overallMsg = "HR Approved. Waiting for MD final approval.";
    } else {
      overallMsg = "Waiting for HR approval";
    }

    _showDetailsBottomSheet(
      context: context,
      title: "Leave Details",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(leave['leave_type'] ?? 'Leave Request',
              style: const TextStyle(
                  fontSize: 22, fontWeight: FontWeight.bold, color: _navy)),
          const SizedBox(height: 8),
          Text(
            "${DateFormat('dd MMM yyyy').format(DateTime.parse(leave['start_date']))} to "
            "${DateFormat('dd MMM yyyy').format(DateTime.parse(leave['end_date']))}",
            style: const TextStyle(
                fontWeight: FontWeight.w600, fontSize: 16, color: _orange),
          ),
          Text(
            "${leave['total_days'] ?? (DateTime.parse(leave['end_date']).difference(DateTime.parse(leave['start_date'])).inDays + 1)} working days",
            style: TextStyle(color: Colors.grey[600], fontSize: 14),
          ),
          const Divider(height: 32),
          const Text("Reason:",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 4),
          Text(leave['reason'] ?? 'No reason provided',
              style: const TextStyle(fontSize: 15)),
          const Divider(height: 32),
          _detailRow("Stage 1 — HR Approval", hrStatus, hrRemarks),
          const SizedBox(height: 16),
          _detailRow("Stage 2 — MD Final Approval", mdStatus, mdRemarks),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            width: double.infinity,
            decoration: BoxDecoration(
              color: _navy.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _navy.withValues(alpha: 0.1)),
            ),
            child: Text(
              overallMsg,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontWeight: FontWeight.bold, color: _navy, fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }

  void _showPermissionDetails(BuildContext context, dynamic perm) {
    final status = (perm['status'] ?? 'pending').toLowerCase();
    final hrStatus = (perm['hr_status'] ?? 'pending').toLowerCase();
    final mdStatus = (perm['md_status'] ?? 'waiting').toLowerCase();
    final hrRemarks = perm['hr_remarks'];
    final mdRemarks = perm['md_remarks'];

    String overallMsg = "";
    if (status == 'rejected') {
      overallMsg = "Permission rejected. See remarks above.";
    } else if (mdStatus == 'approved') {
      overallMsg = "Your permission is fully approved!";
    } else if (hrStatus == 'approved' && mdStatus == 'pending') {
      overallMsg = "HR Approved. Waiting for MD final approval.";
    } else {
      overallMsg = "Waiting for HR approval";
    }

    _showDetailsBottomSheet(
      context: context,
      title: "Permission Details",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Permission Request",
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.bold, color: _navy)),
          const SizedBox(height: 8),
          Text(
            DateFormat('dd MMMM yyyy').format(DateTime.parse(perm['date'])),
            style: const TextStyle(
                fontWeight: FontWeight.w600, fontSize: 18, color: _orange),
          ),
          Text(
            "${perm['start_time'].toString().substring(0, 5)} - ${perm['end_time'].toString().substring(0, 5)} (${perm['duration_minutes']} min)",
            style: TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.grey[700],
                fontSize: 15),
          ),
          const Divider(height: 32),
          const Text("Reason:",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 4),
          Text(perm['reason'] ?? 'No reason provided',
              style: const TextStyle(fontSize: 15)),
          if (perm['remarks'] != null && perm['remarks'].isNotEmpty) ...[
            const SizedBox(height: 8),
            Text("Remarks: ${perm['remarks']}",
                style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          ],
          const Divider(height: 32),
          _detailRow("Stage 1 — HR Approval", hrStatus, hrRemarks),
          const SizedBox(height: 16),
          _detailRow("Stage 2 — MD Final Approval", mdStatus, mdRemarks),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            width: double.infinity,
            decoration: BoxDecoration(
              color: _navy.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _navy.withValues(alpha: 0.1)),
            ),
            child: Text(
              overallMsg,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontWeight: FontWeight.bold, color: _navy, fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }

  void _showDetailsBottomSheet({
    required BuildContext context,
    required String title,
    required Widget child,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.75,
        maxChildSize: 0.9,
        minChildSize: 0.5,
        builder: (_, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey)),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.grey),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                  child: child,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailRow(String label, String status, dynamic remarks) {
    Color color;
    IconData icon;
    switch (status) {
      case 'approved':
        color = Colors.green;
        icon = Icons.check_circle;
        break;
      case 'rejected':
        color = Colors.red;
        icon = Icons.cancel;
        break;
      case 'pending':
        color = Colors.orange;
        icon = Icons.hourglass_top;
        break;
      default:
        color = Colors.grey;
        icon = Icons.lock_outline;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 10),
            Text(label,
                style:
                    const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const Spacer(),
            Text(status.toUpperCase(),
                style: TextStyle(
                    color: color, fontWeight: FontWeight.w900, fontSize: 11)),
          ],
        ),
        if (remarks != null && remarks.toString().trim().isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(left: 32, top: 4),
            child: Text(
              "Remarks: $remarks",
              style: const TextStyle(
                  color: Colors.black87,
                  fontSize: 13,
                  fontStyle: FontStyle.italic),
            ),
          ),
        ],
      ],
    );
  }
}
