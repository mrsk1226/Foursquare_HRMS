import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class HrContactScreen extends StatefulWidget {
  const HrContactScreen({Key? key}) : super(key: key);

  @override
  State<HrContactScreen> createState() => _HrContactScreenState();
}

class _HrContactScreenState extends State<HrContactScreen> {
  final _subjectCtrl = TextEditingController();
  final _msgCtrl = TextEditingController();

  Future<void> _launchUrl(Uri url) async {
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open external app.')));
      }
    }
  }

  void _sendMessage() {
    if (_subjectCtrl.text.isEmpty || _msgCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all fields.')));
      return;
    }
    // Simulate send
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Message sent to HR successfully!'), backgroundColor: Colors.green));
    _subjectCtrl.clear();
    _msgCtrl.clear();
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('HR Contact'),
        backgroundColor: const Color(0xFF1E3A5F),
      ),
      backgroundColor: const Color(0xFFF5F6FA),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // HR Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.grey.withAlpha(20), blurRadius: 10)]),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 60, height: 60,
                        decoration: BoxDecoration(color: const Color(0xFF1E3A5F).withAlpha(30), shape: BoxShape.circle),
                        child: const Center(child: Text('HR', style: TextStyle(color: Color(0xFF1E3A5F), fontSize: 24, fontWeight: FontWeight.bold))),
                      ),
                      const SizedBox(width: 16),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('HR Department', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
                          const SizedBox(height: 4),
                          Text('Available Mon-Fri, 9AM-6PM', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                        ],
                      )
                    ],
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.chat, size: 18),
                          label: const Text('WhatsApp'),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: Colors.white),
                          onPressed: () => _launchUrl(Uri.parse('https://wa.me/917305803080')),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.email, size: 18),
                          label: const Text('Email'),
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E3A5F), foregroundColor: Colors.white),
                          onPressed: () => _launchUrl(Uri(scheme: 'mailto', path: 'hr@foursquare.com')),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.phone),
                      label: const Text('Call +91 73058 03080'),
                      style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFF1E3A5F), side: const BorderSide(color: Color(0xFF1E3A5F))),
                      onPressed: () => _launchUrl(Uri(scheme: 'tel', path: '+917305803080')),
                    ),
                  )
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Send Message Form
            const Text('Send a Message', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.grey.withAlpha(20), blurRadius: 10)]),
              child: Column(
                children: [
                  TextField(controller: _subjectCtrl, decoration: const InputDecoration(labelText: 'Subject', border: OutlineInputBorder())),
                  const SizedBox(height: 16),
                  TextField(controller: _msgCtrl, maxLines: 4, decoration: const InputDecoration(labelText: 'Your Message', border: OutlineInputBorder())),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _sendMessage,
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E3A5F), foregroundColor: Colors.white, minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                    child: const Text('Send Message', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  )
                ],
              ),
            ),
            const SizedBox(height: 32),

            // FAQ
            const Text('Frequently Asked Questions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
            const SizedBox(height: 16),
            _buildFAQ('How to apply for leave?', 'Go to the Leaves tab from the Bottom Navigation, click on Apply Leave, fill the form, and submit.'),
            _buildFAQ('How to get payslip?', 'Open the App Drawer, tap on My Payslip, and select the specific month to view and download your payslip.'),
            _buildFAQ('How to update profile?', 'Go to the Profile tab, scroll down to Edit Contact Info, input your new details safely and click Save Changes.'),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildFAQ(String question, String answer) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
      child: ExpansionTile(
        title: Text(question, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0).copyWith(top: 0),
            child: Text(answer, style: TextStyle(color: Colors.grey.shade700, height: 1.5)),
          )
        ],
      ),
    );
  }
}
