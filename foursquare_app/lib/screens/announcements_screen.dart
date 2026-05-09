import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/supabase_config.dart';
import '../widgets/app_drawer.dart';

class AnnouncementsScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const AnnouncementsScreen({super.key, this.switchTab});
  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  String _selectedFilter = 'All';
  List<Map<String, dynamic>> _announcements = [];
  List<Map<String, dynamic>> _todayBirthdays = [];
  Map<String, List<Map<String, dynamic>>> _commentsMap = {};
  final Set<String> _expandedComments = {};
  Set<String> _likedPosts = {};

  String _employeeId = '';
  String _employeeName = '';
  String _employeePhoto = '';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await _loadUser();
    await _loadLikes();
    await _fetchData();
  }

  // â”€â”€ SharedPreferences à®®à¯‚à®²à®®à¯ user load â”€â”€
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
    } catch (e) {
      debugPrint('User load error: $e');
    }
  }

  // â”€â”€ Likes â€” SharedPreferences (announcement_likes table à®‡à®²à¯à®²à¯ˆ) â”€â”€
  Future<void> _loadLikes() async {
    if (_employeeId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList('fsq_liked_$_employeeId') ?? [];
    _likedPosts = saved.toSet();
  }

  Future<void> _saveLikes() async {
    if (_employeeId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('fsq_liked_$_employeeId', _likedPosts.toList());
  }

  void _toggleLike(String postId) {
    setState(() {
      if (_likedPosts.contains(postId)) {
        _likedPosts.remove(postId);
      } else {
        _likedPosts.add(postId);
      }
    });
    _saveLikes();
  }

  // â”€â”€ Fetch announcements + comments + birthdays â”€â”€
  Future<void> _fetchData() async {
    if (mounted) setState(() => _isLoading = true);
    try {
      final now = DateTime.now();

      final annRes = await SupabaseConfig.client
          .from('announcements')
          .select(
              'id, title, content, priority, created_by, created_at, image_url, is_pinned, expires_at')
          .order('is_pinned', ascending: false)
          .order('created_at', ascending: false);

      // Filter expired
      final announcements = (annRes as List)
          .where((a) {
            if (a['expires_at'] == null) return true;
            return DateTime.parse(a['expires_at'].toString()).isAfter(now);
          })
          .map((e) => Map<String, dynamic>.from(e))
          .toList();

      // Comments â€” correct columns
      final commRes = await SupabaseConfig.client
          .from('announcement_comments')
          .select(
              'id, announcement_id, employee_id, employee_name, employee_photo, content, created_at')
          .order('created_at', ascending: true);

      final Map<String, List<Map<String, dynamic>>> commMap = {};
      for (final c in commRes as List) {
        final aid = c['announcement_id'].toString();
        commMap.putIfAbsent(aid, () => []);
        commMap[aid]!.add(Map<String, dynamic>.from(c));
      }

      // Birthdays â€” employees table, dob column
      final empRes = await SupabaseConfig.client
          .from('employees')
          .select('full_name, dob, photo_url')
          .not('dob', 'is', null);

      final births = <Map<String, dynamic>>[];
      for (final e in empRes as List) {
        try {
          final dob = DateTime.parse(e['dob'].toString());
          if (dob.day == now.day && dob.month == now.month) {
            births.add(Map<String, dynamic>.from(e));
          }
        } catch (_) {}
      }

      if (mounted) {
        setState(() {
          _announcements = announcements;
          _commentsMap = commMap;
          _todayBirthdays = births;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Fetch error: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // â”€â”€ Add Comment â”€â”€
  Future<void> _addComment(
      String annId, String text, TextEditingController controller) async {
    if (_employeeId.isEmpty || text.trim().isEmpty) return;
    try {
      final res = await SupabaseConfig.client
          .from('announcement_comments')
          .insert({
            'announcement_id': annId,
            'employee_id': _employeeId,
            'employee_name':
                _employeeName.isNotEmpty ? _employeeName : _employeeId,
            'employee_photo': _employeePhoto.isNotEmpty ? _employeePhoto : null,
            'content': text.trim(),
            'created_at': DateTime.now().toIso8601String(),
          })
          .select()
          .single();

      // Append locally â€” no full reload, no flash
      if (mounted) {
        setState(() {
          _commentsMap.putIfAbsent(annId, () => []);
          _commentsMap[annId]!.add(Map<String, dynamic>.from(res));
          controller.clear();
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to post comment'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '';
    try {
      final dt = DateTime.parse(dateStr);
      final diff = DateTime.now().difference(dt).inDays;
      if (diff == 0) return 'Today';
      if (diff == 1) return 'Yesterday';
      if (diff < 7) return '$diff days ago';
      return DateFormat('dd MMM').format(dt);
    } catch (_) {
      return dateStr;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      drawer: AppDrawer(
        selectedIndex: 3,
        switchTab: (i) => widget.switchTab?.call(i),
      ),
      appBar: AppBar(
        title: const Text('Engage',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: Column(
        children: [
          if (_todayBirthdays.isNotEmpty) _buildBirthdayBanner(),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            color: Colors.white,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: ['All', 'Announcements', 'Events']
                    .map(_buildFilterChip)
                    .toList(),
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Color(0xFF3B82F6)))
                : _announcements.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.campaign_outlined,
                                size: 64, color: Colors.grey),
                            SizedBox(height: 12),
                            Text('No announcements yet',
                                style: TextStyle(
                                    color: Colors.grey, fontSize: 16)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchData,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          itemCount: _announcements.length,
                          itemBuilder: (_, i) => _buildCard(_announcements[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildBirthdayBanner() {
    return Container(
      width: double.infinity,
      color: Colors.yellow.shade100,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          const Icon(Icons.cake, color: Colors.orange, size: 26),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'ðŸŽ‚ ${_todayBirthdays.map((e) => e['full_name']).join(', ')} â€” Birthday today!',
              style: const TextStyle(
                  fontWeight: FontWeight.bold, color: Colors.deepOrange),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final sel = _selectedFilter == label;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        selected: sel,
        label: Text(label,
            style: TextStyle(
                color: sel ? Colors.white : Colors.grey.shade700,
                fontWeight: FontWeight.bold)),
        backgroundColor: Colors.grey.shade100,
        selectedColor: const Color(0xFF1B2E4B),
        checkmarkColor: Colors.white,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(
                color: sel ? const Color(0xFF1B2E4B) : Colors.grey.shade300)),
        onSelected: (_) => setState(() => _selectedFilter = label),
      ),
    );
  }

  Widget _buildCard(Map<String, dynamic> ann) {
    final annId = ann['id'].toString();
    final priority = ann['priority']?.toString().toLowerCase() ?? 'normal';
    final isPinned = ann['is_pinned'] == true;
    final isLiked = _likedPosts.contains(annId);
    final comments = _commentsMap[annId] ?? [];
    final likeCount = _likedPosts.contains(annId) ? 1 : 0;

    Color priorityColor = Colors.blue;
    if (priority == 'urgent') {
      priorityColor = Colors.red;
    } else if (priority == 'important') {
      priorityColor = Colors.orange;
    }

    final commentController = TextEditingController();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isPinned ? Colors.amber.shade200 : Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 4))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // â”€â”€ Header â”€â”€
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                      color: priorityColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10)),
                  child: Icon(Icons.campaign_rounded,
                      color: priorityColor, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (isPinned) ...[
                            const Icon(Icons.push_pin,
                                size: 12, color: Colors.amber),
                            const SizedBox(width: 4),
                          ],
                          _priorityBadge(priority, priorityColor),
                        ],
                      ),
                      Text(_formatDate(ann['created_at']?.toString()),
                          style: TextStyle(
                              color: Colors.grey.shade500, fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // â”€â”€ Content â”€â”€
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ann['title']?.toString() ?? '',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Color(0xFF1B2E4B))),
                const SizedBox(height: 8),
                Text(ann['content']?.toString() ?? '',
                    style: const TextStyle(
                        color: Color(0xFF555555), height: 1.5, fontSize: 14)),
              ],
            ),
          ),

          if (ann['image_url'] != null &&
              ann['image_url'].toString().isNotEmpty) ...[
            const SizedBox(height: 12),
            ClipRRect(
              child: Image.network(
                ann['image_url'].toString(),
                fit: BoxFit.cover,
                width: double.infinity,
                height: 180,
                errorBuilder: (_, __, ___) => const SizedBox(),
              ),
            ),
          ],

          const SizedBox(height: 12),
          const Divider(height: 1),

          // â”€â”€ Actions â”€â”€
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                // Like button â€” optimistic, no flash
                GestureDetector(
                  onTap: () => _toggleLike(annId),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: isLiked
                          ? Colors.blue.withValues(alpha: 0.1)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                          color: isLiked ? Colors.blue : Colors.grey.shade300),
                    ),
                    child: Row(
                      children: [
                        Icon(isLiked ? Icons.thumb_up : Icons.thumb_up_outlined,
                            size: 16,
                            color: isLiked ? Colors.blue : Colors.grey),
                        const SizedBox(width: 6),
                        Text(isLiked ? 'Liked ($likeCount)' : 'Like',
                            style: TextStyle(
                                color: isLiked ? Colors.blue : Colors.grey,
                                fontSize: 13,
                                fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),

                const SizedBox(width: 12),

                // Comment button
                GestureDetector(
                  onTap: () {
                    setState(() {
                      if (_expandedComments.contains(annId)) {
                        _expandedComments.remove(annId);
                      } else {
                        _expandedComments.add(annId);
                      }
                    });
                  },
                  child: Row(
                    children: [
                      const Icon(Icons.chat_bubble_outline,
                          size: 16, color: Colors.grey),
                      const SizedBox(width: 6),
                      Text('${comments.length} Comments',
                          style: const TextStyle(
                              color: Colors.grey, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // â”€â”€ Comments Section â”€â”€
          if (_expandedComments.contains(annId))
            _buildCommentSection(annId, comments, commentController),
        ],
      ),
    );
  }

  Widget _buildCommentSection(String annId, List<Map<String, dynamic>> comments,
      TextEditingController controller) {
    return Container(
      color: Colors.grey.shade50,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (comments.isEmpty)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text('No comments yet',
                  style: TextStyle(color: Colors.grey, fontSize: 13)),
            ),
          ...comments.map((c) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 14,
                      backgroundColor: Colors.blue.shade100,
                      backgroundImage: (c['employee_photo'] != null &&
                              c['employee_photo'].toString().isNotEmpty)
                          ? NetworkImage(c['employee_photo'].toString())
                          : null,
                      child: (c['employee_photo'] == null ||
                              c['employee_photo'].toString().isEmpty)
                          ? Text(
                              (c['employee_name']?.toString() ?? 'U')
                                  .substring(0, 1)
                                  .toUpperCase(),
                              style: const TextStyle(fontSize: 10))
                          : null,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(c['employee_name']?.toString() ?? 'User',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12)),
                              Text(_formatDate(c['created_at']?.toString()),
                                  style: const TextStyle(
                                      color: Colors.grey, fontSize: 10)),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(c['content']?.toString() ?? '',
                              style: const TextStyle(
                                  fontSize: 13, color: Colors.black87)),
                        ],
                      ),
                    ),
                  ],
                ),
              )),

          // Comment Input
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  decoration: InputDecoration(
                    hintText: 'Add a comment...',
                    hintStyle: const TextStyle(fontSize: 13),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 10),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide(color: Colors.grey.shade300)),
                    enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide(color: Colors.grey.shade300)),
                  ),
                  style: const TextStyle(fontSize: 13),
                ),
              ),
              const SizedBox(width: 8),
              CircleAvatar(
                backgroundColor: const Color(0xFF1B2E4B),
                child: IconButton(
                  icon: const Icon(Icons.send, color: Colors.white, size: 18),
                  onPressed: () =>
                      _addComment(annId, controller.text, controller),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _priorityBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(4)),
      child: Text(label.toUpperCase(),
          style: TextStyle(
              color: color, fontSize: 9, fontWeight: FontWeight.bold)),
    );
  }
}
