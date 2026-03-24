import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../blocs/auth_bloc.dart';
import '../services/supabase_config.dart';

class AnnouncementDetailsScreen extends StatefulWidget {
  final Map<String, dynamic> announcement;
  const AnnouncementDetailsScreen({Key? key, required this.announcement}) : super(key: key);

  @override
  State<AnnouncementDetailsScreen> createState() => _AnnouncementDetailsScreenState();
}

class _AnnouncementDetailsScreenState extends State<AnnouncementDetailsScreen> {
  final _supabase = SupabaseConfig.client;
  final _commentCtrl = TextEditingController();
  
  List<dynamic> _reactions = [];
  List<dynamic> _comments = [];
  bool _isLoading = true;

  final List<String> _emojis = ['👍', '❤️', '😂', '😮', '👏', '🎉'];

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    try {
      final annId = widget.announcement['id'];
      final rs = await _supabase.from('announcement_reactions').select().eq('announcement_id', annId);
      final cs = await _supabase.from('announcement_comments').select().eq('announcement_id', annId).order('created_at');
      
      if (mounted) {
        setState(() {
          _reactions = List.from(rs);
          _comments = List.from(cs);
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _addReaction(String type) async {
    final state = context.read<AuthBloc>().state;
    if (state is HRMSAuthAuthenticated) {
      final empId = state.profile?['employee_id'];
      if (empId == null) return;
      
      try {
        await _supabase.from('announcement_reactions').upsert({
          'announcement_id': widget.announcement['id'],
          'employee_id': empId,
          'employee_name': state.profile?['employees']?['full_name'] ?? state.user.email,
          'reaction_type': type
        }, onConflict: 'announcement_id,employee_id');
        _fetchDetails();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _addComment() async {
    final state = context.read<AuthBloc>().state;
    final text = _commentCtrl.text.trim();
    if (state is HRMSAuthAuthenticated && text.isNotEmpty) {
      final empId = state.profile?['employee_id'];
      if (empId == null) return;
      
      try {
        await _supabase.from('announcement_comments').insert({
          'announcement_id': widget.announcement['id'],
          'employee_id': empId,
          'employee_name': state.profile?['employees']?['full_name'] ?? 'User',
          'content': text
        });
        _commentCtrl.clear();
        _fetchDetails();
        FocusScope.of(context).unfocus();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ann = widget.announcement;
    final date = DateTime.tryParse(ann['created_at'].toString()) ?? DateTime.now();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Announcement'),
        backgroundColor: const Color(0xFF1E3A5F),
      ),
      backgroundColor: Colors.white,
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.campaign, color: Color(0xFF2E86AB), size: 32),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(ann['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 22, color: Color(0xFF1E3A5F))),
                            const SizedBox(height: 6),
                            Text(DateFormat('MMM dd, yyyy • hh:mm a').format(date), style: TextStyle(color: Colors.grey.shade500, fontSize: 13, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      )
                    ],
                  ),
                  const SizedBox(height: 24),
                  
                  if (ann['image_url'] != null && ann['image_url'].toString().isNotEmpty) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(ann['image_url'], width: double.infinity, height: 200, fit: BoxFit.cover, errorBuilder: (c,e,s) => const SizedBox.shrink()),
                    ),
                    const SizedBox(height: 24),
                  ],
                  
                  Text(ann['content'] ?? '', style: TextStyle(color: Colors.grey.shade800, fontSize: 16, height: 1.6)),
                  const SizedBox(height: 32),
                  const Divider(),
                  const SizedBox(height: 16),
                  
                  // Reactions Segment
                  const Text('Reactions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E3A5F))),
                  const SizedBox(height: 12),
                  if (_isLoading) const CircularProgressIndicator()
                  else Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _emojis.map((emoji) {
                      final count = _reactions.where((r) => r['reaction_type'] == emoji).length;
                      return ActionChip(
                        label: Text('$emoji $count'),
                        backgroundColor: count > 0 ? Colors.blue.shade50 : Colors.grey.shade100,
                        onPressed: () => _addReaction(emoji),
                      );
                    }).toList(),
                  ),
                  
                  const SizedBox(height: 32),
                  const Text('Comments', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E3A5F))),
                  const SizedBox(height: 16),
                  
                  if (_isLoading) const CircularProgressIndicator()
                  else if (_comments.isEmpty) const Text('No comments yet.', style: TextStyle(color: Colors.grey))
                  else ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _comments.length,
                    itemBuilder: (ctx, idx) {
                      final c = _comments[idx];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade200)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(c['employee_name'] ?? 'User', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            const SizedBox(height: 4),
                            Text(c['content'] ?? '', style: const TextStyle(fontSize: 14)),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
          
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.grey.shade300, blurRadius: 4, offset: const Offset(0, -2))]),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _commentCtrl,
                      decoration: InputDecoration(
                        hintText: 'Add a comment...',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                        filled: true,
                        fillColor: Colors.grey.shade100,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  CircleAvatar(
                    backgroundColor: const Color(0xFF1E3A5F),
                    child: IconButton(
                      icon: const Icon(Icons.send, color: Colors.white, size: 18),
                      onPressed: _addComment,
                    ),
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
