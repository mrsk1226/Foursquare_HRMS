import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_config.dart';
import '../widgets/app_drawer.dart';

class LeaveScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const LeaveScreen({Key? key, this.switchTab}) : super(key: key);

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final supabase = SupabaseConfig.client;

  String? _employeeId;
  String? _fullName;
  bool _isInitLoading = true;

  List<dynamic> _leaveRequests = [];
  bool _isLeaveLoading = false;

  List<dynamic> _permissions = [];
  bool _isPermLoading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() {}); // Rebuild to update FAB label
      }
    });
    _loadProfileData();
  }

  Future<void> _loadProfileData() async {
    try {
      final user = supabase.auth.currentUser;
      if (user == null) return;

      final profile = await supabase
          .from('profiles')
          .select('employee_id, full_name')
          .eq('id', user.id)
          .maybeSingle();

      if (profile != null) {
        setState(() {
          _employeeId = profile['employee_id'];
          _fullName = profile['full_name'];
          _isInitLoading = false;
        });
        _loadLeaveRequests();
        _loadPermissions();
      }
    } catch (e) {
      if (mounted) setState(() => _isInitLoading = false);
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
      setState(() {
        _leaveRequests = data ?? [];
        _isLeaveLoading = false;
      });
    } catch (e) {
      setState(() => _isLeaveLoading = false);
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
      setState(() {
        _permissions = data ?? [];
        _isPermLoading = false;
      });
    } catch (e) {
      setState(() => _isPermLoading = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _openApplyForm() {
    if (_employeeId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please wait, loading profile...')));
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _tabController.index == 0
          ? _LeaveFormSheet(
              employeeId: _employeeId!,
              fullName: _fullName!,
              onSuccess: () {
                _loadLeaveRequests();
              })
          : _PermissionFormSheet(
              employeeId: _employeeId!,
              fullName: _fullName!,
              existingPermissions: _permissions,
              onSuccess: () {
                _loadPermissions();
              }),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isInitLoading) {
      return const Scaffold(
          backgroundColor: Color(0xFFF5F7FA),
          body: Center(
              child: CircularProgressIndicator(color: Color(0xFF1a2744))));
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      drawer: const AppDrawer(selectedIndex: 3),
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
        title: const Text('Leave & Permissions',
            style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 18)),
        backgroundColor: const Color(0xFF1a2744),
        elevation: 0,
        centerTitle: false,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFFFF8C00),
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(text: "LEAVE REQUESTS"),
            Tab(text: "PERMISSIONS"),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildLeaveTab(),
          _buildPermissionTab(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openApplyForm,
        backgroundColor: const Color(0xFFFF8C00),
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text(
            _tabController.index == 0 ? 'Apply Leave' : 'Apply Permission',
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildLeaveTab() {
    return RefreshIndicator(
      onRefresh: _loadLeaveRequests,
      child: _isLeaveLoading
          ? const Center(child: CircularProgressIndicator())
          : _leaveRequests.isEmpty
              ? _buildEmptyState("No leave requests found")
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _leaveRequests.length + 1,
                  itemBuilder: (context, index) {
                    if (index == _leaveRequests.length)
                      return const SizedBox(height: 80);
                    return _buildLeaveCard(_leaveRequests[index]);
                  },
                ),
    );
  }

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
                      ? _buildEmptyState("No permission requests found")
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _permissions.length + 1,
                          itemBuilder: (context, index) {
                            if (index == _permissions.length)
                              return const SizedBox(height: 80);
                            return _buildPermissionCard(_permissions[index]);
                          },
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildLeaveCard(dynamic leave) {
    String type = leave['leave_type'] ?? 'Casual Leave';
    String status = (leave['status'] ?? 'pending').toLowerCase();
    DateTime start =
        DateTime.tryParse(leave['start_date'] ?? '') ?? DateTime.now();
    DateTime end = DateTime.tryParse(leave['end_date'] ?? '') ?? DateTime.now();
    int days = end.difference(start).inDays + 1;

    Color badgeColor = Colors.blue;
    if (type.contains('Sick')) badgeColor = Colors.orange;
    if (type.contains('Earned')) badgeColor = Colors.green;

    Color statusColor = Colors.amber;
    if (status == 'approved') statusColor = Colors.green;
    if (status == 'rejected') statusColor = Colors.red;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4))
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
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                      color: badgeColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8)),
                  child: Text(type,
                      style: TextStyle(
                          color: badgeColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 12)),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8)),
                  child: Text(status.toUpperCase(),
                      style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 11)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              "${DateFormat('dd MMM').format(start)} - ${DateFormat('dd MMM').format(end)} ($days ${days == 1 ? 'day' : 'days'})",
              style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: Color(0xFF1a2744)),
            ),
            const SizedBox(height: 6),
            Text(leave['reason'] ?? 'No reason provided',
                style: TextStyle(color: Colors.grey[600], fontSize: 13)),
            if (status == 'rejected' && leave['rejection_reason'] != null) ...[
              const SizedBox(height: 10),
              Text("Rejected: ${leave['rejection_reason']}",
                  style: const TextStyle(
                      color: Colors.red,
                      fontWeight: FontWeight.w600,
                      fontSize: 12)),
            ]
          ],
        ),
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
    double usedHours = usedMinutes / 60;
    double progress = usedHours / 4.0;
    if (progress > 1.0) progress = 1.0;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Monthly Summary (${DateFormat('MMMM').format(now)})",
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, color: Color(0xFF1a2744))),
              Text("Used: ${usedHours.toStringAsFixed(1)} hrs / 4.0 hrs",
                  style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                      color: Colors.blue)),
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
        ],
      ),
    );
  }

  Widget _buildPermissionCard(dynamic perm) {
    String status = (perm['status'] ?? 'pending').toLowerCase();
    DateTime date = DateTime.tryParse(perm['date'] ?? '') ?? DateTime.now();
    Color statusColor = Colors.amber;
    if (status == 'approved') statusColor = Colors.green;
    if (status == 'rejected') statusColor = Colors.red;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4))
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
                        fontWeight: FontWeight.bold, color: Color(0xFF1a2744))),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8)),
                  child: Text(status.toUpperCase(),
                      style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 11)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              "${perm['start_time']} - ${perm['end_time']} (${perm['duration_minutes']} min)",
              style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: Color(0xFF1a2744)),
            ),
            const SizedBox(height: 6),
            Text(perm['reason'] ?? 'No reason',
                style: TextStyle(color: Colors.grey[600], fontSize: 13)),
            if (status == 'rejected' && perm['rejection_reason'] != null) ...[
              const SizedBox(height: 10),
              Text("Rejected: ${perm['rejection_reason']}",
                  style: const TextStyle(
                      color: Colors.red,
                      fontWeight: FontWeight.w600,
                      fontSize: 12)),
            ]
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(String msg) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.assignment_late_outlined,
              size: 60, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(msg,
              style: TextStyle(
                  color: Colors.grey[500], fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _LeaveFormSheet extends StatefulWidget {
  final String employeeId;
  final String fullName;
  final VoidCallback onSuccess;

  const _LeaveFormSheet(
      {required this.employeeId,
      required this.fullName,
      required this.onSuccess});

  @override
  State<_LeaveFormSheet> createState() => _LeaveFormSheetState();
}

class _LeaveFormSheetState extends State<_LeaveFormSheet> {
  final supabase = SupabaseConfig.client;
  String _leaveType = 'Casual Leave';
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  final _reasonController = TextEditingController();
  bool _isSubmitting = false;

  int get _days => _endDate.difference(_startDate).inDays + 1;

  Future<void> _submitLeave(BuildContext context) async {
    if (_reasonController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Reason is required')));
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final res = await supabase
          .from('leave_requests')
          .insert({
            'employee_id': widget.employeeId,
            'leave_type': _leaveType,
            'start_date': DateFormat('yyyy-MM-dd').format(_startDate),
            'end_date': DateFormat('yyyy-MM-dd').format(_endDate),
            'reason': _reasonController.text.trim(),
            'status': 'pending',
          })
          .select()
          .single();

      await supabase.from('notifications').insert({
        'recipient_employee_id': 'FSQ002',
        'sender_employee_id': widget.employeeId,
        'type': 'leave_request',
        'title': 'New Leave Request',
        'message':
            '${widget.fullName} applied for $_leaveType from ${DateFormat('dd MMM').format(_startDate)} to ${DateFormat('dd MMM').format(_endDate)} ($_days days)',
        'reference_type': 'leave_request',
        'reference_id': res['id'].toString(),
        'is_read': false,
      });

      if (mounted) {
        Navigator.pop(context);
        widget.onSuccess();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Leave request submitted'),
            backgroundColor: Colors.green));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (ctx, scrollController) {
        try {
          return Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                      child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                              color: Colors.grey[300],
                              borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 24),
                  const Text("Apply for Leave",
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1a2744))),
                  const SizedBox(height: 24),
                  DropdownButtonFormField<String>(
                    initialValue: _leaveType,
                    decoration: InputDecoration(
                      labelText: "Leave Type",
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    items: ['Casual Leave', 'Sick Leave', 'Earned Leave']
                        .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                        .toList(),
                    onChanged: (v) => setState(() => _leaveType = v!),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                          child: _buildDatePicker("Start Date", _startDate,
                              (d) => setState(() => _startDate = d))),
                      const SizedBox(width: 16),
                      Expanded(
                          child: _buildDatePicker("End Date", _endDate,
                              (d) => setState(() => _endDate = d))),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                        color: Colors.blue[50],
                        borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline,
                            color: Colors.blue, size: 20),
                        const SizedBox(width: 8),
                        Text("Requested: $_days working days",
                            style: const TextStyle(
                                color: Colors.blue,
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _reasonController,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: "Reason for Leave",
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : () => _submitLeave(ctx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1a2744),
                      minimumSize: const Size(double.infinity, 52),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isSubmitting
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('Submit Leave Request',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          );
        } catch (e) {
          return Container(
            color: Colors.white,
            padding: const EdgeInsets.all(20),
            child: Center(child: Text('Error: $e')),
          );
        }
      },
    );
  }

  Widget _buildDatePicker(
      String label, DateTime date, Function(DateTime) onChanged) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date,
          firstDate: DateTime.now().subtract(const Duration(days: 90)),
          lastDate: DateTime.now().add(const Duration(days: 365)),
        );
        if (picked != null && mounted) {
          onChanged(picked);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[300]!),
            borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: TextStyle(color: Colors.grey[600], fontSize: 11)),
            const SizedBox(height: 4),
            Text(DateFormat('dd MMM yyyy').format(date),
                style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}

class _PermissionFormSheet extends StatefulWidget {
  final String employeeId;
  final String fullName;
  final List<dynamic> existingPermissions;
  final VoidCallback onSuccess;

  const _PermissionFormSheet(
      {required this.employeeId,
      required this.fullName,
      required this.existingPermissions,
      required this.onSuccess});

  @override
  State<_PermissionFormSheet> createState() => _PermissionFormSheetState();
}

class _PermissionFormSheetState extends State<_PermissionFormSheet> {
  final supabase = SupabaseConfig.client;
  DateTime _date = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 09, minute: 00);
  TimeOfDay _endTime = const TimeOfDay(hour: 10, minute: 00);
  String _selectedReason = 'Medical Appointment';
  final _otherReasonController = TextEditingController();
  final _remarksController = TextEditingController();
  bool _isSubmitting = false;

  final List<String> _reasons = [
    'Medical Appointment',
    'Family Emergency',
    'Bank Work',
    'Government Office Work',
    'Vehicle Breakdown',
    'Child School Work',
    'Personal Health Issue',
    'Home Emergency',
    'Court/Legal Work',
    'Others'
  ];

  int get _durationMinutes {
    final start = _startTime.hour * 60 + _startTime.minute;
    final end = _endTime.hour * 60 + _endTime.minute;
    return end - start;
  }

  Future<void> _submitPermission(BuildContext context) async {
    final now = DateTime.now();
    final monthlyPerms = widget.existingPermissions.where((p) {
      final pDate = DateTime.tryParse(p['date'] ?? '');
      return pDate != null &&
          pDate.month == now.month &&
          pDate.year == now.year &&
          p['status'] != 'rejected';
    }).length;

    if (monthlyPerms >= 4) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text("Maximum 4 permissions per month allowed")));
      return;
    }

    if (_durationMinutes > 60) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text("Maximum 60 minutes allowed per permission")));
      return;
    }

    if (_durationMinutes <= 0) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text("Invalid time range")));
      return;
    }

    if (_selectedReason == 'Others' &&
        _otherReasonController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text("Please specify reason")));
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final reason = _selectedReason == 'Others'
          ? _otherReasonController.text.trim()
          : _selectedReason;
      final startTimeStr =
          "${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}";
      final endTimeStr =
          "${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}";

      final res = await supabase
          .from('permissions')
          .insert({
            'employee_id': widget.employeeId,
            'date': DateFormat('yyyy-MM-dd').format(_date),
            'start_time': startTimeStr,
            'end_time': endTimeStr,
            'duration_minutes': _durationMinutes,
            'reason': reason,
            'remarks': _remarksController.text.trim(),
            'status': 'pending',
          })
          .select()
          .single();

      await supabase.from('notifications').insert({
        'recipient_employee_id': 'FSQ002',
        'sender_employee_id': widget.employeeId,
        'type': 'permission_request',
        'title': 'Permission Request',
        'message':
            '${widget.fullName} requested permission on ${DateFormat('dd MMM').format(_date)} $startTimeStr-$endTimeStr for $reason',
        'reference_type': 'permission_request',
        'reference_id': res['id'].toString(),
        'is_read': false,
      });

      if (mounted) {
        Navigator.pop(context);
        widget.onSuccess();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Permission request submitted'),
            backgroundColor: Colors.green));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      builder: (ctx, scrollController) {
        try {
          return Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                      child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                              color: Colors.grey[300],
                              borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 24),
                  const Text("Apply for Permission",
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1a2744))),
                  const SizedBox(height: 24),
                  _buildDatePicker(
                      "Date", _date, (d) => setState(() => _date = d)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                          child: _buildTimePicker("Start Time", _startTime,
                              (t) => setState(() => _startTime = t))),
                      const SizedBox(width: 16),
                      Expanded(
                          child: _buildTimePicker("End Time", _endTime,
                              (t) => setState(() => _endTime = t))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text("Duration: $_durationMinutes min",
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: _durationMinutes > 60 || _durationMinutes <= 0
                              ? Colors.red
                              : Colors.blue)),
                  const SizedBox(height: 20),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedReason,
                    decoration: InputDecoration(
                      labelText: "Reason",
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    items: _reasons
                        .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                        .toList(),
                    onChanged: (v) => setState(() => _selectedReason = v!),
                  ),
                  if (_selectedReason == 'Others') ...[
                    const SizedBox(height: 16),
                    TextField(
                      controller: _otherReasonController,
                      decoration: InputDecoration(
                        labelText: "Please specify reason",
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  TextField(
                    controller: _remarksController,
                    decoration: InputDecoration(
                      labelText: "Remarks (Optional)",
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed:
                        _isSubmitting ? null : () => _submitPermission(ctx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1a2744),
                      minimumSize: const Size(double.infinity, 52),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isSubmitting
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('Submit Permission Request',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          );
        } catch (e) {
          return Container(
            color: Colors.white,
            padding: const EdgeInsets.all(20),
            child: Center(child: Text('Error: $e')),
          );
        }
      },
    );
  }

  Widget _buildDatePicker(
      String label, DateTime date, Function(DateTime) onChanged) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date,
          firstDate: DateTime.now().subtract(const Duration(days: 7)),
          lastDate: DateTime.now().add(const Duration(days: 30)),
        );
        if (picked != null && mounted) {
          onChanged(picked);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[300]!),
            borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            const Icon(Icons.calendar_today, color: Colors.blue, size: 20),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(color: Colors.grey[600], fontSize: 11)),
                Text(DateFormat('dd MMM yyyy').format(date),
                    style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimePicker(
      String label, TimeOfDay time, Function(TimeOfDay) onChanged) {
    return InkWell(
      onTap: () async {
        final picked = await showTimePicker(
          context: context,
          initialTime: time,
        );
        if (picked != null && mounted) {
          onChanged(picked);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            border: Border.all(color: Colors.grey[300]!),
            borderRadius: BorderRadius.circular(12)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: TextStyle(color: Colors.grey[600], fontSize: 11)),
            const SizedBox(height: 4),
            Text(time.format(context),
                style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}
