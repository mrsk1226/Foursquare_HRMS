import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class HrContactScreen extends StatelessWidget {
  const HrContactScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      appBar: AppBar(
        title: const Text('HR Contact'),
        backgroundColor: const Color(0xFF1a2744),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF1a2744),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.support_agent_rounded,
                    color: Colors.white,
                    size: 36,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'HR Department',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'We\'re here to help you',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.7),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Contact Cards
          _buildContactCard(
            context: context,
            icon: Icons.phone_outlined,
            label: 'Phone',
            value: '+91 98765 43210',
            color: const Color(0xFF4CAF50),
            onTap: () => _launchUrl('tel:+919876543210'),
          ),
          const SizedBox(height: 12),
          _buildContactCard(
            context: context,
            icon: Icons.email_outlined,
            label: 'Email',
            value: 'hr@foursquare.com',
            color: const Color(0xFF2196F3),
            onTap: () => _launchUrl('mailto:hr@foursquare.com'),
          ),
          const SizedBox(height: 12),
          _buildContactCard(
            context: context,
            icon: Icons.access_time_outlined,
            label: 'Office Hours',
            value: 'Mon – Fri: 9:00 AM – 6:00 PM',
            color: const Color(0xFFFF8C00),
            onTap: null,
          ),
          const SizedBox(height: 12),
          _buildContactCard(
            context: context,
            icon: Icons.location_on_outlined,
            label: 'Location',
            value: 'HR Office, 2nd Floor\nFoursquare HQ',
            color: const Color(0xFFE91E63),
            onTap: null,
          ),

          const SizedBox(height: 24),

          // Quick Help Section
          const Text(
            'Quick Help',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1a2744),
            ),
          ),
          const SizedBox(height: 12),

          _buildQuickHelpItem(
              Icons.beach_access_outlined, 'Leave Policy', context),
          _buildQuickHelpItem(Icons.account_balance_wallet_outlined,
              'Payroll Queries', context),
          _buildQuickHelpItem(
              Icons.medical_services_outlined, 'Medical Benefits', context),
          _buildQuickHelpItem(
              Icons.school_outlined, 'Training & Development', context),
        ],
      ),
    );
  }

  Widget _buildContactCard({
    required BuildContext context,
    required IconData icon,
    required String label,
    required String value,
    required Color color,
    required VoidCallback? onTap,
  }) {
    return GestureDetector(
      onLongPress: () {
        Clipboard.setData(ClipboardData(text: value));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$label copied!'),
            duration: const Duration(seconds: 2),
          ),
        );
      },
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      value,
                      style: const TextStyle(
                        color: Color(0xFF1a2744),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (onTap != null)
                Icon(Icons.arrow_forward_ios_rounded,
                    size: 14, color: Colors.grey.shade400),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickHelpItem(
      IconData icon, String title, BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF1a2744), size: 22),
        title: Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Color(0xFF1a2744),
          ),
        ),
        trailing: const Icon(Icons.arrow_forward_ios_rounded,
            size: 14, color: Colors.grey),
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('$title - Coming soon!')),
          );
        },
      ),
    );
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }
}
