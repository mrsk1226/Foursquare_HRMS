import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';
import '../services/supabase_config.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({Key? key}) : super(key: key);

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  final _supabase = SupabaseConfig.client;
  bool _isLoading = true;
  List<dynamic> _announcements = [];

  @override
  void initState() {
    super.initState();
    _fetchAnnouncements();
  }

  Future<void> _fetchAnnouncements() async {
    try {
      final res = await _supabase.from('announcements')
          .select()
          .order('created_at', ascending: false);
          
      if (mounted) {
        setState(() {
          _announcements = res ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Announcements'),
        backgroundColor: const Color(0xFF1E3A5F),
      ),
      backgroundColor: const Color(0xFFF5F6FA),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : _announcements.isEmpty
          ? const Center(child: Text('No announcements available', style: TextStyle(color: Colors.grey)))
          : ListView.builder(
              padding: const EdgeInsets.all(16.0),
              itemCount: _announcements.length,
              itemBuilder: (context, index) {
                final ann = _announcements[index];
                final date = DateTime.tryParse(ann['created_at'].toString()) ?? DateTime.now();
                
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(20),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(12)),
                              child: const Icon(Icons.campaign, color: Color(0xFF2E86AB), size: 28),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(child: Text(ann['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18))),
                                      if (ann['is_pinned'] == true) 
                                        const Icon(Icons.push_pin, color: Colors.redAccent, size: 16)
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    DateFormat('MMM dd, yyyy • hh:mm a').format(date), 
                                    style: TextStyle(color: Colors.grey.shade500, fontSize: 12, fontWeight: FontWeight.bold)
                                  ),
                                  const SizedBox(height: 12),
                                  Text(ann['content'] ?? '', style: TextStyle(color: Colors.grey.shade700, fontSize: 14, height: 1.5)),
                                ],
                              ),
                            )
                          ],
                        ),
                      ),
                      if (ann['priority'] == 'high')
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: const BoxDecoration(color: Colors.red, borderRadius: BorderRadius.only(bottomLeft: Radius.circular(16), bottomRight: Radius.circular(16))),
                          child: const Text('HIGH PRIORITY', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
                        )
                    ],
                  ),
                );
              },
            ),
    );
  }
}
