import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/supabase_config.dart';
import '../widgets/app_drawer.dart';

class AnnouncementsScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const AnnouncementsScreen({Key? key, this.switchTab}) : super(key: key);

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  String _selectedFilter = 'All';
  List<Map<String, dynamic>> _announcements = [];
  List<Map<String, dynamic>> _todayBirthdays = [];
  List<Map<String, dynamic>> _reactions = [];
  List<Map<String, dynamic>> _comments = [];
  String? _currentEmployeeId;
  String? _currentEmployeeName;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    await _fetchCurrentUser();
    await _fetchData();
  }

  Future<void> _fetchCurrentUser() async {
    final user = SupabaseConfig.client.auth.currentUser;
    if (user != null) {
      final profile = await SupabaseConfig.client
          .from('profiles')
          .select('employee_id')
          .eq('id', user.id)
          .maybeSingle();
      if (profile != null) {
        _currentEmployeeId = profile['employee_id'];
        final emp = await SupabaseConfig.client
            .from('employees')
            .select('full_name')
            .eq('employee_id', _currentEmployeeId as String)
            .maybeSingle();
        _currentEmployeeName = emp?['full_name'];
      }
    }
  }

  Future<void> _fetchData() async {
    try {
      final db = SupabaseConfig.client;
      // Announcements - NO JOIN
      final announcementsRes = await db
          .from('announcements')
          .select('*')
          .order('created_at', ascending: false);

      // Birthdays check
      final employeesRes = await db
          .from('employees')
          .select('full_name, date_of_birth, photo_url');
      List<Map<String, dynamic>> todayBdays = [];
      final today = DateTime.now();

      for (var emp in employeesRes) {
        final dobStr = emp['date_of_birth'] ?? emp['dob'];
        if (dobStr != null) {
          try {
            final dob = DateTime.parse(dobStr);
            if (dob.day == today.day && dob.month == today.month) {
              todayBdays.add(emp);
            }
          } catch (_) {}
        }
      }

      // Reactions & Comments counts
      final reactRes = await db.from('announcement_reactions').select('*');
      final commRes = await db.from('announcement_comments').select('*');

      if (mounted) {
        setState(() {
          _announcements = List<Map<String, dynamic>>.from(announcementsRes);
          _todayBirthdays = todayBdays;
          _reactions = List<Map<String, dynamic>>.from(reactRes);
          _comments = List<Map<String, dynamic>>.from(commRes);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleReaction(
      String announcementId, String reactionType) async {
    if (_currentEmployeeId == null) return;
    try {
      final matches = _reactions
          .where(
            (r) =>
                r['announcement_id'] == announcementId &&
                r['employee_id'] == _currentEmployeeId &&
                r['reaction_type'] == reactionType,
          )
          .toList();

      if (matches.isNotEmpty) {
        await SupabaseConfig.client
            .from('announcement_reactions')
            .delete()
            .eq('id', matches.first['id']);
      } else {
        await SupabaseConfig.client.from('announcement_reactions').insert({
          'announcement_id': announcementId,
          'employee_id': _currentEmployeeId,
          'employee_name': _currentEmployeeName ?? 'User',
          'reaction_type': reactionType
        });
      }
      _fetchData();
    } catch (e) {
      debugPrint("Reaction error: $e");
    }
  }

  String _formatDate(String dateStr) {
    try {
      final dt = DateTime.parse(dateStr);
      final diff = DateTime.now().difference(dt).inDays;
      if (diff < 7) {
        if (diff == 0) return "Today";
        if (diff == 1) return "Yesterday";
        return "$diff days ago";
      }
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
        onItemSelected: widget.switchTab,
      ),
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
        title: const Text('Engage',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1B2E4B),
        elevation: 0,
      ),
      body: Column(
        children: [
          // Birthday Banner
          if (_todayBirthdays.isNotEmpty) _buildBirthdayBanner(),

          // Post Filter
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            color: Colors.white,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: ['All', 'Announcements', 'Events']
                    .map((e) => _buildFilterChip(e))
                    .toList(),
              ),
            ),
          ),

          // Content
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _fetchData,
                    child: ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      itemCount: _announcements.length,
                      itemBuilder: (context, index) =>
                          _buildAnnouncementCard(_announcements[index]),
                    ),
                  ),
          )
        ],
      ),
    );
  }

  Widget _buildBirthdayBanner() {
    return Container(
      width: double.infinity,
      color: Colors.yellow.shade100,
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const Icon(Icons.cake, color: Colors.orange, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("Birthday Celebration! ðŸŽŠ",
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: Colors.orange)),
                Text(
                    "${_todayBirthdays.map((e) => e['full_name']).join(', ')} celebrating birthday today!",
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w500)),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedFilter == label;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        selected: isSelected,
        label: Text(label,
            style: TextStyle(
                color: isSelected ? Colors.white : Colors.grey.shade700,
                fontWeight: FontWeight.bold)),
        backgroundColor: Colors.grey.shade100,
        selectedColor: const Color(0xFF1B2E4B),
        checkmarkColor: Colors.white,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(
                color: isSelected
                    ? const Color(0xFF1B2E4B)
                    : Colors.grey.shade300)),
        onSelected: (_) => setState(() => _selectedFilter = label),
      ),
    );
  }

  Widget _buildAnnouncementCard(Map<String, dynamic> ann) {
    final priority = ann['priority']?.toString().toLowerCase() ?? 'normal';
    Color priorityColor = Colors.blue;
    if (priority == 'urgent') {
      priorityColor = Colors.red;
    } else if (priority == 'important') {
      priorityColor = Colors.orange;
    }

    final itemReactions =
        _reactions.where((r) => r['announcement_id'] == ann['id']).toList();
    final itemComments =
        _comments.where((c) => c['announcement_id'] == ann['id']).toList();

    final likes =
        itemReactions.where((r) => r['reaction_type'] == 'like').length;
    final hearts =
        itemReactions.where((r) => r['reaction_type'] == 'love').length;
    final claps =
        itemReactions.where((r) => r['reaction_type'] == 'clap').length;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                    backgroundColor: priorityColor.withValues(alpha: 0.1),
                    child:
                        Icon(Icons.campaign, color: priorityColor, size: 20)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(_formatDate(ann['created_at']),
                              style: const TextStyle(
                                  color: Colors.grey, fontSize: 11)),
                          const SizedBox(width: 8),
                          _buildPriorityBadge(priority, priorityColor),
                        ],
                      ),
                      Text(ann['title'] ?? 'Announcement',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Content
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(ann['content'] ?? '',
                style: const TextStyle(
                    color: Color(0xFF555555), height: 1.4, fontSize: 14)),
          ),

          if (ann['image_url'] != null) ...[
            const SizedBox(height: 12),
            Image.network(ann['image_url'],
                fit: BoxFit.cover, width: double.infinity, height: 180),
          ],

          const SizedBox(height: 12),
          const Divider(height: 1),

          // Actions
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    _reactionBtn(
                        'ðŸ‘', likes, () => _toggleReaction(ann['id'], 'like')),
                    _reactionBtn(
                        'â¤ï¸', hearts, () => _toggleReaction(ann['id'], 'love')),
                    _reactionBtn(
                        'ðŸ‘', claps, () => _toggleReaction(ann['id'], 'clap')),
                  ],
                ),
                TextButton.icon(
                  onPressed: () {}, // User can implement comment view
                  icon: const Icon(Icons.chat_bubble_outline,
                      size: 16, color: Colors.grey),
                  label: Text("${itemComments.length} Comments",
                      style: const TextStyle(color: Colors.grey, fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriorityBadge(String label, Color color) {
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

  Widget _reactionBtn(String emoji, int count, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200)),
        child: Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 4),
            Text(count.toString(),
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
