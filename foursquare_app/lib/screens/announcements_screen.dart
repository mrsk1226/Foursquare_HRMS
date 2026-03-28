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
  Map<String, Map<String, dynamic>> _authorsMap = {};
  Set<String> _expandedComments = {};
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

      // Authors & Birthdays check
      final employeesRes = await db
          .from('employees')
          .select('full_name, employee_id, job_title, photo_url, date_of_birth');
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
      final commRes = await db.from('announcement_comments').select('*').order('created_at', ascending: true);

      Map<String, Map<String, dynamic>> authorsMap = {};
      for (var e in employeesRes) {
        if (e['employee_id'] != null) authorsMap[e['employee_id']] = e;
      }
      
      final profilesRes = await db.from('profiles').select('id, employee_id');
      for (var p in profilesRes) {
        if (p['employee_id'] != null && authorsMap.containsKey(p['employee_id'])) {
          authorsMap[p['id']] = authorsMap[p['employee_id']]!;
        }
      }

      if (mounted) {
        setState(() {
          _announcements = List<Map<String, dynamic>>.from(announcementsRes);
          _todayBirthdays = todayBdays;
          _reactions = List<Map<String, dynamic>>.from(reactRes);
          _comments = List<Map<String, dynamic>>.from(commRes);
          _authorsMap = authorsMap;
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
                r['employee_id'] == _currentEmployeeId,
          )
          .toList();

      if (matches.isNotEmpty && matches.first['reaction_type'] == reactionType) {
        await SupabaseConfig.client
            .from('announcement_reactions')
            .delete()
            .eq('id', matches.first['id']);
      } else {
        if (matches.isNotEmpty) {
           await SupabaseConfig.client
            .from('announcement_reactions')
            .delete()
            .eq('id', matches.first['id']);
        }
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

  Future<void> _addComment(String annId, String text) async {
     if (_currentEmployeeId == null || text.trim().isEmpty) return;
     try {
       await SupabaseConfig.client.from('announcement_comments').insert({
         'announcement_id': annId,
         'employee_id': _currentEmployeeId,
         'employee_name': _currentEmployeeName ?? 'User',
         'content': text
       });
       _fetchData();
     } catch (e) {
       debugPrint("Comment error: $e");
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
        onItemSelected: (i) => widget.switchTab?.call(i),
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
                const Text("Birthday Celebration! 🎊",
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
    } else if (priority == 'important') priorityColor = Colors.orange;

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

    final author = _authorsMap[ann['created_by']] ?? {
      'full_name': 'Company Admin',
      'job_title': 'Organization',
      'photo_url': null
    };

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 4))],
          border: Border.all(color: Colors.grey.shade100)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundImage: author['photo_url'] != null ? NetworkImage(author['photo_url']) : null,
                  backgroundColor: priorityColor.withValues(alpha: 0.1),
                  child: author['photo_url'] == null 
                  ? Text(author['full_name']?.toString().substring(0, 1) ?? 'C', style: TextStyle(color: priorityColor, fontWeight: FontWeight.bold)) 
                  : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(author['full_name'] ?? 'Company Admin',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      Row(
                        children: [
                          Text("${author['job_title']} • ", style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
                          Text(_formatDate(ann['created_at']),
                              style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                          const SizedBox(width: 8),
                          _buildPriorityBadge(priority, priorityColor),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Content
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ann['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1B2E4B))),
                const SizedBox(height: 6),
                Text(ann['content'] ?? '',
                    style: const TextStyle(
                        color: Color(0xFF555555), height: 1.4, fontSize: 14)),
              ],
            ),
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
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    _buildMainLikeButton(ann),
                    if (itemReactions.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Row(
                        children: [
                          _reactionSummaryItem('👍', likes),
                          _reactionSummaryItem('❤️', hearts),
                          _reactionSummaryItem('👏', claps),
                        ],
                      ),
                    ]
                  ],
                ),
                TextButton.icon(
                  onPressed: () {
                    setState(() {
                      if (_expandedComments.contains(ann['id'])) {
                        _expandedComments.remove(ann['id']);
                      } else {
                        _expandedComments.add(ann['id'] as String);
                      }
                    });
                  },
                  icon: const Icon(Icons.chat_bubble_outline,
                      size: 16, color: Colors.grey),
                  label: Text("${itemComments.length} Comments",
                      style: const TextStyle(color: Colors.grey, fontSize: 12)),
                ),
              ],
            ),
          ),

          // Comments Section
          if (_expandedComments.contains(ann['id']))
            _buildCommentSection(ann['id'], itemComments),
        ],
      ),
    );
  }

  Widget _buildMainLikeButton(Map<String, dynamic> ann) {
     final hasLiked = _reactions.any((r) => r['announcement_id'] == ann['id'] && r['employee_id'] == _currentEmployeeId);
     return GestureDetector(
       onLongPress: () => _showReactionPicker(ann['id']),
       onTap: () => _toggleReaction(ann['id'], 'like'),
       child: Container(
         padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
         decoration: BoxDecoration(
           color: hasLiked ? Colors.blue.withValues(alpha: 0.1) : Colors.transparent,
           borderRadius: BorderRadius.circular(16),
           border: Border.all(color: hasLiked ? Colors.blue : Colors.grey.shade300),
         ),
         child: Row(
           children: [
             Icon(hasLiked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 16, color: hasLiked ? Colors.blue : Colors.grey),
             const SizedBox(width: 6),
             Text(hasLiked ? "Liked" : "Like", style: TextStyle(color: hasLiked ? Colors.blue : Colors.grey, fontSize: 13, fontWeight: FontWeight.bold)),
           ],
         ),
       ),
     );
  }

  Widget _reactionSummaryItem(String emoji, int count) {
    if (count == 0) return const SizedBox();
    return Container(
      margin: const EdgeInsets.only(right: 4),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      child: Row(children: [Text(emoji, style: const TextStyle(fontSize: 12)), const SizedBox(width: 2), Text("$count", style: const TextStyle(fontSize: 11, color: Colors.grey))]),
    );
  }

  void _showReactionPicker(String annId) {
     final reactions = ['like', 'love', 'haha', 'wow', 'sad', 'clap'];
     final emojis = ['👍', '❤️', '😂', '😮', '😢', '👏'];
     
     showGeneralDialog(
       context: context,
       barrierDismissible: true,
       barrierLabel: '',
       barrierColor: Colors.black.withValues(alpha: 0.2),
       pageBuilder: (context, a1, a2) => Container(),
       transitionDuration: const Duration(milliseconds: 200),
       transitionBuilder: (context, a1, a2, child) {
         return Transform.scale(
           scale: a1.value,
           child: Center(
             child: Material(
               color: Colors.transparent,
               child: Container(
                 padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                 decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(30), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10)]),
                 child: SingleChildScrollView(
                   scrollDirection: Axis.horizontal,
                   child: Row(
                     mainAxisSize: MainAxisSize.min,
                     children: List.generate(reactions.length, (i) => GestureDetector(
                       onTap: () {
                         Navigator.pop(context);
                         _toggleReaction(annId, reactions[i]);
                       },
                       child: Padding(
                         padding: const EdgeInsets.symmetric(horizontal: 8),
                         child: Text(emojis[i], style: const TextStyle(fontSize: 28)),
                       ),
                     )),
                   ),
                 ),
               ),
             ),
           ),
         );
       },
     );
  }

  Widget _buildCommentSection(String annId, List<Map<String, dynamic>> comments) {
    final controller = TextEditingController();
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      color: Colors.grey.shade50,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ...comments.map((c) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(radius: 12, backgroundColor: Colors.blue.shade100, child: Text(c['employee_name']?.toString().substring(0,1) ?? 'U', style: const TextStyle(fontSize: 10))),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(c['employee_name'] ?? 'User', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                          Text(_formatDate(c['created_at']?.toString() ?? ''), style: const TextStyle(color: Colors.grey, fontSize: 10)),
                        ],
                      ),
                      Text(c['content'] ?? '', style: const TextStyle(fontSize: 13, color: Colors.black87)),
                    ],
                  ),
                ),
              ],
            ),
          )).toList(),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  decoration: const InputDecoration(hintText: "Add a comment...", border: InputBorder.none, hintStyle: TextStyle(fontSize: 13)),
                  style: const TextStyle(fontSize: 13),
                ),
              ),
              IconButton(icon: const Icon(Icons.send, size: 20, color: Color(0xFF1B2E4B)), onPressed: () => _addComment(annId, controller.text)),
            ],
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
