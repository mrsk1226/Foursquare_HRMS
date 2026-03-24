import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import '../blocs/auth_bloc.dart';
import '../services/supabase_config.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({Key? key}) : super(key: key);

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  final _supabase = SupabaseConfig.client;
  bool _isLoading = true;
  List<dynamic> _leaveHistory = [];
  Map<String, dynamic>? _balances;

  // Form State
  String _leaveType = 'Casual Leave';
  DateTime? _startDate;
  DateTime? _endDate;
  final _reasonController = TextEditingController();

  final List<String> _leaveTypes = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Loss of Pay'];

  @override
  void initState() {
    super.initState();
    _fetchLeaveData();
  }

  Future<void> _fetchLeaveData() async {
    final state = context.read<AuthBloc>().state;
    if (state is AuthAuthenticated) {
      final empId = state.profile?['employee_id'];
      if (empId == null) return;
      
      try {
        final resLeaves = await _supabase.from('leave_requests').select().eq('employee_id', empId).order('created_at', ascending: false);
        final resBals = await _supabase.from('leave_balances').select().eq('employee_id', empId).maybeSingle();
        
        if (mounted) {
          setState(() {
            _leaveHistory = resLeaves ?? [];
            _balances = resBals;
            _isLoading = false;
          });
        }
      } catch (e) {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _applyLeave() async {
    if (_startDate == null || _endDate == null || _reasonController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all fields')));
      return;
    }

    final state = context.read<AuthBloc>().state;
    if (state is AuthAuthenticated) {
      final empId = state.profile?['employee_id'];
      
      try {
        setState(() => _isLoading = true);
        await _supabase.from('leave_requests').insert({
          'employee_id': empId,
          'leave_type': _leaveType,
          'start_date': _startDate!.toIso8601String().split('T')[0],
          'end_date': _endDate!.toIso8601String().split('T')[0],
          'reason': _reasonController.text.trim(),
          'status': 'pending'
        });
        
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Leave applied successfully!'), backgroundColor: Colors.green));
        _reasonController.clear();
        _startDate = null;
        _endDate = null;
        _fetchLeaveData();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _selectDate(BuildContext context, bool isStart) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(DateTime.now().year + 1),
      builder: (context, child) {
        return Theme(
          data: ThemeData.light().copyWith(
            colorScheme: const ColorScheme.light(primary: Color(0xFF1E3A5F)),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate != null && _endDate!.isBefore(_startDate!)) {
            _endDate = _startDate;
          }
        } else {
          _endDate = picked;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave Management'),
        backgroundColor: const Color(0xFF1E3A5F),
      ),
      backgroundColor: const Color(0xFFF5F6FA),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Balances
            const Text('Leave Balances', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _buildBalanceCard('Casual', _balances?['casual_leave']?.toString() ?? '12', Colors.blue)),
                const SizedBox(width: 8),
                Expanded(child: _buildBalanceCard('Sick', _balances?['sick_leave']?.toString() ?? '4', Colors.red)),
                const SizedBox(width: 8),
                Expanded(child: _buildBalanceCard('Earned', _balances?['earned_leave']?.toString() ?? '15', Colors.green)),
              ],
            ),
            const SizedBox(height: 24),

            // Apply Form
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.1), blurRadius: 10)]),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Apply for Leave', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
                  const SizedBox(height: 16),
                  
                  DropdownButtonFormField<String>(
                    value: _leaveType,
                    decoration: const InputDecoration(labelText: 'Leave Type', border: OutlineInputBorder()),
                    items: _leaveTypes.map((type) => DropdownMenuItem(value: type, child: Text(type))).toList(),
                    onChanged: (val) => setState(() => _leaveType = val!),
                  ),
                  const SizedBox(height: 16),
                  
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => _selectDate(context, true),
                          child: InputDecorator(
                            decoration: const InputDecoration(labelText: 'From Date', border: OutlineInputBorder()),
                            child: Text(_startDate != null ? DateFormat('MMM dd, yyyy').format(_startDate!) : 'Select Date'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: InkWell(
                          onTap: () => _selectDate(context, false),
                          child: InputDecorator(
                            decoration: const InputDecoration(labelText: 'To Date', border: OutlineInputBorder()),
                            child: Text(_endDate != null ? DateFormat('MMM dd, yyyy').format(_endDate!) : 'Select Date'),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  TextField(
                    controller: _reasonController,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Reason for leave', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 20),
                  
                  ElevatedButton(
                    onPressed: _applyLeave,
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E3A5F), foregroundColor: Colors.white, minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                    child: const Text('Submit Application', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  )
                ],
              ),
            ),
            const SizedBox(height: 24),

            // History
            const Text('Leave History', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
            const SizedBox(height: 12),
            _leaveHistory.isEmpty 
              ? const Padding(padding: EdgeInsets.all(16.0), child: Text('No leave applications found', style: TextStyle(color: Colors.grey)))
              : ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _leaveHistory.length,
                  itemBuilder: (context, index) {
                    final leave = _leaveHistory[index];
                    Color statusColor = Colors.orange;
                    if (leave['status'] == 'approved') statusColor = Colors.green;
                    if (leave['status'] == 'rejected') statusColor = Colors.red;

                    return Card(
                      color: Colors.white,
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
                      child: ListTile(
                        title: Text(leave['leave_type'], style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('${leave['start_date']} to ${leave['end_date']}\nReason: ${leave['reason']}'),
                        isThreeLine: true,
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                          child: Text(leave['status'].toString().toUpperCase(), style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    );
                  },
                )
          ],
        ),
      ),
    );
  }

  Widget _buildBalanceCard(String title, String bal, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade200)),
      child: Column(
        children: [
          Text(title, style: TextStyle(color: Colors.grey.shade600, fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(bal, style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
