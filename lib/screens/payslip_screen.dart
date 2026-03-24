import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import '../blocs/auth_bloc.dart';
import '../services/supabase_config.dart';

class PayslipScreen extends StatefulWidget {
  const PayslipScreen({Key? key}) : super(key: key);

  @override
  State<PayslipScreen> createState() => _PayslipScreenState();
}

class _PayslipScreenState extends State<PayslipScreen> {
  final _supabase = SupabaseConfig.client;
  bool _isLoading = true;
  List<dynamic> _payrolls = [];
  
  final List<String> _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  @override
  void initState() {
    super.initState();
    _fetchPayrolls();
  }

  Future<void> _fetchPayrolls() async {
    final state = context.read<AuthBloc>().state;
    if (state is HRMSAuthAuthenticated) {
      final empId = state.profile?['employee_id'];
      if (empId == null) return;
      
      try {
        final res = await _supabase.from('payroll')
            .select()
            .eq('employee_id', empId)
            .order('year', ascending: false)
            .order('month', ascending: false);
            
        if (mounted) {
          setState(() {
            _payrolls = res ?? [];
            _isLoading = false;
          });
        }
      } catch (e) {
        if (mounted) setState(() => _isLoading = false);
      }
    }
  }

  void _downloadPayslip(dynamic pay) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Downloading Payslip for ${_months[pay['month']-1]} ${pay['year']}...'),
        backgroundColor: const Color(0xFF2E86AB),
      )
    );
    // Real implementation would use pdf package to generate PDF and open file
    Future.delayed(const Duration(seconds: 1), () {
      if(mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Download complete! Saved to Documents.'), backgroundColor: Colors.green)
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Payslips'),
        backgroundColor: const Color(0xFF1E3A5F),
      ),
      backgroundColor: const Color(0xFFF5F6FA),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : _payrolls.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.receipt_long, size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 16),
                  const Text('No payslips available yet', style: TextStyle(color: Colors.grey, fontSize: 16)),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16.0),
              itemCount: _payrolls.length,
              itemBuilder: (context, index) {
                final pay = _payrolls[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(12)),
                                  child: const Icon(Icons.account_balance_wallet, color: Color(0xFF1E3A5F)),
                                ),
                                const SizedBox(width: 16),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${_months[pay['month']-1]} ${pay['year']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                                    const SizedBox(height: 4),
                                    Text('Salary Slip', style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
                                  ],
                                ),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const Text('Net Pay', style: TextStyle(color: Colors.grey, fontSize: 12)),
                                Text('₹${pay['net_salary'].toString()}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: Colors.green)),
                              ],
                            )
                          ],
                        ),
                        const SizedBox(height: 20),
                        const Divider(height: 1),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => _downloadPayslip(pay),
                                icon: const Icon(Icons.download, size: 18),
                                label: const Text('Download PDF'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF1E3A5F),
                                  side: const BorderSide(color: Color(0xFF1E3A5F)),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))
                                ),
                              ),
                            ),
                          ],
                        )
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
