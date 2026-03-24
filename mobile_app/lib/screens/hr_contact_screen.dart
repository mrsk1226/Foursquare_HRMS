import 'package:flutter/material.dart';

class HRContactScreen extends StatelessWidget {
  const HRContactScreen({Key? key}) : super(key: key);

  void _simulateAction(BuildContext context, String action) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Simulating $action...')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('HR Helpdesk'),
        backgroundColor: const Color(0xFF1E3A5F),
      ),
      backgroundColor: const Color(0xFFF5F6FA),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Your HR Representatives', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
            const SizedBox(height: 16),
            
            _buildHRCard(context, 'Priya Sharma', 'HR Manager', 'priya.hr@foursquare.com', '+91 9876543210'),
            const SizedBox(height: 12),
            _buildHRCard(context, 'Arun Kumar', 'Payroll Specialist', 'arun.hr@foursquare.com', '+91 9876543211'),
            
            const SizedBox(height: 32),
            const Text('Send a Message', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
            const SizedBox(height: 16),
            
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.1), blurRadius: 10)]),
              child: Column(
                children: [
                  const TextField(
                    decoration: InputDecoration(labelText: 'Subject', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 16),
                  const TextField(
                    maxLines: 4,
                    decoration: InputDecoration(labelText: 'How can we help you?', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: () {
                      FocusScope.of(context).unfocus();
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Message sent to HR team!'), backgroundColor: Colors.green));
                    },
                    icon: const Icon(Icons.send),
                    label: const Text('Send Message', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E3A5F), foregroundColor: Colors.white, minimumSize: const Size.fromHeight(50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
                  )
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildHRCard(BuildContext context, String name, String title, String email, String phone) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.grey.shade200)),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: const Color(0xFF2E86AB).withOpacity(0.2),
            child: Text(name[0], style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                Text(title, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    GestureDetector(
                      onTap: () => _simulateAction(context, 'WhatsApp Chat'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.green.shade200)),
                        child: const Row(children: [Icon(Icons.chat, size: 14, color: Colors.green), SizedBox(width: 4), Text('WhatsApp', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.green))]),
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () => _simulateAction(context, 'Email App'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.blue.shade200)),
                        child: const Row(children: [Icon(Icons.mail, size: 14, color: Colors.blue), SizedBox(width: 4), Text('Email', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blue))]),
                      ),
                    ),
                  ],
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
