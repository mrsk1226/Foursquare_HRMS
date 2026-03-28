import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';
import '../services/auth_service.dart';
import '../services/supabase_config.dart';
import '../widgets/app_drawer.dart';
import 'login_screen.dart';

const String _profileHeroTag = 'employee-profile-photo';

class ProfileScreen extends StatefulWidget {
  final Function(int)? switchTab;
  const ProfileScreen({Key? key, this.switchTab}) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  Map<String, dynamic>? _profileData;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchProfile();
  }

  Future<void> _fetchProfile() async {
    try {
      final user = SupabaseConfig.client.auth.currentUser;
      if (user == null) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      final profileRes = await SupabaseConfig.client
          .from('profiles')
          .select('employee_id')
          .eq('id', user.id)
          .maybeSingle();
      if (profileRes != null && profileRes['employee_id'] != null) {
        final empRes = await SupabaseConfig.client
            .from('employees')
            .select('*')
            .eq('employee_id', profileRes['employee_id'])
            .maybeSingle();
        if (mounted) {
          setState(() {
            _profileData = empRes ?? {};
            _isLoading = false;
          });
        }
      } else {
        if (mounted) setState(() => _isLoading = false);
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _handleLogout(BuildContext context) async {
    await AuthService().signOut();
    if (context.mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_profileData == null)
      return const Center(child: Text("Profile not found"));

    final name = _profileData!['full_name'] ?? 'User';
    final photoUrl = _profileData!['photo_url'];
    final designation = _profileData!['designation'] ?? 'N/A';
    final department = _profileData!['department'] ?? 'N/A';
    final empId = _profileData!['employee_id'] ?? 'N/A';
    final status = _profileData!['status'] ?? 'N/A';
    final joinDate =
        _profileData!['joining_date'] ?? _profileData!['join_date'];

    final formattedJoinDate = joinDate != null
        ? DateFormat('dd MMM yyyy').format(DateTime.parse(joinDate))
        : 'N/A';

    return Scaffold(
      backgroundColor: Colors.white,
      drawer: const AppDrawer(selectedIndex: -1),
      drawerEnableOpenDragGesture: true,
      drawerEdgeDragWidth: 28,
      appBar: AppBar(
        backgroundColor: const Color(0xFF1B2E4B),
        leading: Builder(
          builder: (context) => IconButton(
            tooltip: 'Open menu',
            icon: const Icon(Icons.menu_rounded, color: Colors.white),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        title: const Text("My Profile",
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
              onPressed: () => _handleLogout(context),
              icon: const Icon(Icons.logout, color: Colors.white)),
        ],
      ),
      body: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(24),
            color: const Color(0xFF1B2E4B),
            child: Column(
              children: [
                Row(
                  children: [
                    _buildProfileAvatar(name: name, photoUrl: photoUrl),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold)),
                          Text("$designation | $department",
                              style: const TextStyle(
                                  color: Colors.white70, fontSize: 13)),
                        ],
                      ),
                    )
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    _buildChip(empId, Icons.badge_outlined),
                    const SizedBox(width: 8),
                    _buildChip(formattedJoinDate, Icons.event),
                    const SizedBox(width: 8),
                    _buildChip(status, Icons.check_circle_outline,
                        color: Colors.green.shade400),
                  ],
                )
              ],
            ),
          ),

          // TabBar
          TabBar(
            controller: _tabController,
            labelColor: const Color(0xFF1B2E4B),
            unselectedLabelColor: Colors.grey,
            indicatorColor: const Color(0xFF1B2E4B),
            tabs: const [
              Tab(text: "Personal"),
              Tab(text: "Work"),
            ],
          ),

          // TabBarView
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildPersonalTab(),
                _buildWorkTab(),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildChip(String label, IconData icon, {Color? color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
          color: Colors.white12, borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color ?? Colors.white70),
          const SizedBox(width: 4),
          Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildProfileAvatar(
      {required String name, required String? photoUrl}) {
    final fallback = Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.blue.shade900,
      ),
      alignment: Alignment.center,
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : 'U',
        style: const TextStyle(
          fontSize: 32,
          color: Colors.white,
          fontWeight: FontWeight.bold,
        ),
      ),
    );

    final avatarChild = photoUrl != null && photoUrl.isNotEmpty
        ? ClipOval(
            child: SizedBox(
              width: 80,
              height: 80,
              child: _buildNetworkImage(photoUrl),
            ),
          )
        : fallback;

    return GestureDetector(
      onTap: photoUrl != null && photoUrl.isNotEmpty
          ? () => _openProfileImage(photoUrl)
          : null,
      child: Hero(
        tag: _profileHeroTag,
        child: Material(
          color: Colors.transparent,
          child: Stack(
            children: [
              avatarChild,
              if (photoUrl != null && photoUrl.isNotEmpty)
                Positioned(
                  right: 2,
                  bottom: 2,
                  child: Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.35),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.open_in_full_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNetworkImage(String imageUrl) {
    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        if (wasSynchronouslyLoaded || frame != null) {
          return child;
        }
        return _buildShimmerPlaceholder();
      },
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) {
          return child;
        }
        return _buildShimmerPlaceholder();
      },
      errorBuilder: (context, error, stackTrace) {
        return Container(
          color: Colors.blue.shade900,
          alignment: Alignment.center,
          child: const Icon(
            Icons.person_rounded,
            color: Colors.white,
            size: 34,
          ),
        );
      },
    );
  }

  Widget _buildShimmerPlaceholder() {
    return Shimmer.fromColors(
      baseColor: const Color(0xFFE4E8F0),
      highlightColor: const Color(0xFFF7F9FC),
      child: Container(
        color: Colors.white,
      ),
    );
  }

  Future<void> _openProfileImage(String photoUrl) async {
    await Navigator.of(context).push(
      PageRouteBuilder<void>(
        opaque: false,
        transitionDuration: const Duration(milliseconds: 320),
        reverseTransitionDuration: const Duration(milliseconds: 260),
        pageBuilder: (context, animation, secondaryAnimation) {
          return _ProfileImageViewer(photoUrl: photoUrl);
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            ),
            child: child,
          );
        },
      ),
    );
  }

  Widget _buildPersonalTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _infoCard(
            "Official Email",
            _profileData!['personal_email'] ?? _profileData!['email'] ?? 'N/A',
            Icons.email_outlined),
        _infoCard(
            "Phone Number",
            _profileData!['phone_number'] ?? _profileData!['phone'] ?? 'N/A',
            Icons.phone_outlined),
        _infoCard(
            "Date of Birth",
            _formatDate(_profileData!['date_of_birth'] ?? _profileData!['dob']),
            Icons.cake_outlined),
        _infoCard(
            "Gender", _profileData!['gender'] ?? 'N/A', Icons.person_outline),
        _infoCard("Blood Group", _profileData!['blood_group'] ?? 'N/A',
            Icons.water_drop_outlined),
        _infoCard(
            "Permanent Address",
            _profileData!['permanent_address'] ??
                _profileData!['address'] ??
                'N/A',
            Icons.location_on_outlined),
        _infoCard(
            "Emergency Contact",
            _profileData!['emergency_contact_number'] ??
                _profileData!['emergency_contact'] ??
                'N/A',
            Icons.contact_phone_outlined),
      ],
    );
  }

  Widget _buildWorkTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _infoCard("Employee ID", _profileData!['employee_id'] ?? 'N/A',
            Icons.badge_outlined),
        _infoCard("Department", _profileData!['department'] ?? 'N/A',
            Icons.business_outlined),
        _infoCard("Designation", _profileData!['designation'] ?? 'N/A',
            Icons.work_outline),
        _infoCard("Reporting Manager", _profileData!['manager_name'] ?? 'N/A',
            Icons.supervisor_account_outlined),
        _infoCard("Work Location", _profileData!['work_location'] ?? 'N/A',
            Icons.place_outlined),
        _infoCard("Employment Type", _profileData!['employment_type'] ?? 'N/A',
            Icons.assignment_ind_outlined),
      ],
    );
  }

  Widget _infoCard(String label, String value, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: const Color(0xFFF5F6FA),
          borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
                color: Colors.white, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 20, color: const Color(0xFF1B2E4B)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(color: Colors.grey, fontSize: 12)),
                Text(value,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: Color(0xFF1B2E4B))),
              ],
            ),
          )
        ],
      ),
    );
  }

  String _formatDate(String? dt) {
    if (dt == null) return 'N/A';
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(dt));
    } catch (_) {
      return dt;
    }
  }
}

class _ProfileImageViewer extends StatefulWidget {
  final String photoUrl;

  const _ProfileImageViewer({required this.photoUrl});

  @override
  State<_ProfileImageViewer> createState() => _ProfileImageViewerState();
}

class _ProfileImageViewerState extends State<_ProfileImageViewer> {
  double _dragOffset = 0;

  void _closeViewer() {
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final opacity = (1 - (_dragOffset / 260).clamp(0.0, 0.75)).toDouble();

    return Scaffold(
      backgroundColor: Colors.black.withOpacity(opacity),
      body: SafeArea(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onVerticalDragUpdate: (details) {
            if (details.primaryDelta != null && details.primaryDelta! > 0) {
              setState(() {
                _dragOffset =
                    (_dragOffset + details.primaryDelta!).clamp(0, 320);
              });
            }
          },
          onVerticalDragEnd: (details) {
            final shouldClose =
                _dragOffset > 120 || (details.primaryVelocity ?? 0) > 900;
            if (shouldClose) {
              _closeViewer();
              return;
            }
            setState(() {
              _dragOffset = 0;
            });
          },
          child: Stack(
            children: [
              Center(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOut,
                  transform: Matrix4.identity()..translate(0.0, _dragOffset),
                  child: Hero(
                    tag: _profileHeroTag,
                    child: InteractiveViewer(
                      minScale: 1,
                      maxScale: 3.5,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: AspectRatio(
                          aspectRatio: 1,
                          child: Image.network(
                            widget.photoUrl,
                            fit: BoxFit.cover,
                            loadingBuilder: (context, child, loadingProgress) {
                              if (loadingProgress == null) {
                                return child;
                              }
                              return Shimmer.fromColors(
                                baseColor: const Color(0xFF1C2536),
                                highlightColor: const Color(0xFF2C3648),
                                child:
                                    Container(color: const Color(0xFF141C29)),
                              );
                            },
                            errorBuilder: (context, error, stackTrace) {
                              return Container(
                                color: const Color(0xFF141C29),
                                alignment: Alignment.center,
                                child: const Icon(
                                  Icons.broken_image_rounded,
                                  color: Colors.white70,
                                  size: 44,
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 10,
                right: 14,
                child: IconButton(
                  tooltip: 'Close image',
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.black.withOpacity(0.38),
                    foregroundColor: Colors.white,
                  ),
                  onPressed: _closeViewer,
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 26,
                child: IgnorePointer(
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.28),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text(
                        'Swipe down to close',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
