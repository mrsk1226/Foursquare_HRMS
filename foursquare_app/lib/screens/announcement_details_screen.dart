import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/supabase_config.dart';

class AnnouncementDetailsScreen extends StatefulWidget {
  final Map<String, dynamic> announcement;
  const AnnouncementDetailsScreen({super.key, required this.announcement});
  @override
  State<AnnouncementDetailsScreen> createState() =>
      _AnnouncementDetailsScreenState();
}

class _AnnouncementDetailsScreenState extends State<AnnouncementDetailsScreen> {
  final _commentCtrl = TextEditingController();
  List<Map<String, dynamic>> _comments = [];
  bool _isLoading = true;
  String _employeeId = '';
  String _employeeName = '';
  String _employeePhoto = '';

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    await _loadUser();
    await _fetchComments();
  }

  Future<void> _loadUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _employeeId = prefs.getString('employee_id') ?? '';
      if (_employeeId.isEmpty) return;
      final emp = await SupabaseConfig.client
          .from('employees')
          .select('full_name, photo_url')
          .eq('employee_id', _employeeId)
          .maybeSingle();
      if (emp != null) {
        _employeeName = emp['full_name']?.toString() ?? '';
        _employeePhoto = emp['photo_url']?.toString() ?? '';
      }
    } catch (_) {}
  }

  Future<void> _fetchComments() async {
    try {
      final annId = widget.announcement['id'].toString();
      final res = await SupabaseConfig.client
          .from('announcement_comments')
          .select(
              'id, announcement_id, employee_id, employee_name, employee_photo, content, created_at')
          .eq('announcement_id', annId)
          .order('created_at', ascending: true);
      if (mounted) {
        setState(() {
          _comments = List<Map<String, dynamic>>.from(res);
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _addComment() async {
    final text = _commentCtrl.text.trim();
    if (_employeeId.isEmpty || text.isEmpty) return;
    try {
      final res = await SupabaseConfig.client
          .from('announcement_comments')
          .insert({
            'announcement_id': widget.announcement['id'].toString(),
            'employee_id': _employeeId,
            'employee_name':
                _employeeName.isNotEmpty ? _employeeName : _employeeId,
            'employee_photo': _employeePhoto.isNotEmpty ? _employeePhoto : null,
            'content': text,
            'created_at': DateTime.now().toIso8601String(),
          })
          .select()
          .single();

      if (mounted) {
        setState(() {
          _comments.add(Map<String, dynamic>.from(res));
          _commentCtrl.clear();
        });
        FocusScope.of(context).unfocus();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to post comment')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ann = widget.announcement;
    final date = DateTime.tryParse(ann['created_at']?.toString() ?? '') ??
        DateTime.now();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Announcement'),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.campaign,
                            color: Color(0xFF2E86AB), size: 32),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(ann['title']?.toString() ?? '',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 20,
                                    color: Color(0xFF1E3A5F))),
                            const SizedBox(height: 4),
                            Text(
                                DateFormat('dd MMM yyyy • hh:mm a')
                                    .format(date),
                                style: TextStyle(
                                    color: Colors.grey.shade500, fontSize: 12)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  if (ann['image_url'] != null &&
                      ann['image_url'].toString().isNotEmpty) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        ann['image_url'].toString(),
                        width: double.infinity,
                        height: 200,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox(),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                  Text(ann['content']?.toString() ?? '',
                      style: TextStyle(
                          color: Colors.grey.shade800,
                          fontSize: 15,
                          height: 1.6)),
                  const SizedBox(height: 24),
                  const Divider(),
                  const SizedBox(height: 16),
                  const Text('Comments',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: Color(0xFF1E3A5F))),
                  const SizedBox(height: 12),
                  if (_isLoading)
                    const Center(child: CircularProgressIndicator())
                  else if (_comments.isEmpty)
                    const Text('No comments yet.',
                        style: TextStyle(color: Colors.grey))
                  else
                    ...(_comments.map((c) => Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                              color: Colors.grey.shade50,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey.shade200)),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 12,
                                    backgroundColor: Colors.blue.shade100,
                                    child: Text(
                                        (c['employee_name']?.toString() ?? 'U')
                                            .substring(0, 1)
                                            .toUpperCase(),
                                        style: const TextStyle(fontSize: 10)),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(c['employee_name']?.toString() ?? 'User',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13)),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(c['content']?.toString() ?? '',
                                  style: const TextStyle(fontSize: 14)),
                            ],
                          ),
                        ))),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),

          // ── Comment Input ──
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                    color: Colors.grey.shade300,
                    blurRadius: 4,
                    offset: const Offset(0, -2))
              ],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _commentCtrl,
                      decoration: InputDecoration(
                        hintText: 'Add a comment...',
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none),
                        filled: true,
                        fillColor: Colors.grey.shade100,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  CircleAvatar(
                    backgroundColor: const Color(0xFF0F172A),
                    child: IconButton(
                      icon:
                          const Icon(Icons.send, color: Colors.white, size: 18),
                      onPressed: _addComment,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
