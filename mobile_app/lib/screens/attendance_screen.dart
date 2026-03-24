import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:intl/intl.dart';
import 'dart:async';

import '../blocs/auth_bloc.dart';
import '../services/location_service.dart';
import '../services/supabase_config.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({Key? key}) : super(key: key);

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _isLoading = false;
  List<Map<String, dynamic>> _logs = [];
  
  OfficeLocation? _selectedOffice;
  Position? _currentPosition;
  double _currentDistance = 0.0;
  
  // Google Maps Controller
  final Completer<GoogleMapController> _controller = Completer();

  @override
  void initState() {
    super.initState();
    _selectedOffice = LocationService.offices.first;
    _fetchLogs();
    _initLocation();
  }

  Future<void> _initLocation() async {
    try {
      final pos = await LocationService.getCurrentPosition();
      if (mounted) {
        setState(() {
          _currentPosition = pos;
          _calculateDistance();
        });
        _moveCameraTo(pos);
      }
    } catch (e) {
      _showError(e.toString());
    }
  }

  void _calculateDistance() {
    if (_currentPosition != null && _selectedOffice != null) {
      _currentDistance = Geolocator.distanceBetween(
        _currentPosition!.latitude,
        _currentPosition!.longitude,
        _selectedOffice!.latitude,
        _selectedOffice!.longitude,
      );
    }
  }

  Future<void> _moveCameraTo(Position pos) async {
    final GoogleMapController controller = await _controller.future;
    controller.animateCamera(CameraUpdate.newCameraPosition(
      CameraPosition(target: LatLng(pos.latitude, pos.longitude), zoom: 16.0),
    ));
  }

  Future<void> _fetchLogs() async {
    final authState = context.read<AuthBloc>().state;
    if (authState is AuthAuthenticated) {
      final employeeId = authState.profile?['employee_id'];
      if (employeeId != null) {
        final response = await SupabaseConfig.client
            .from('attendance_logs')
            .select()
            .eq('employee_id', employeeId)
            .order('date', ascending: false);
            
        setState(() {
          _logs = List<Map<String, dynamic>>.from(response);
        });
      }
    }
  }

  Future<void> _handlePunch(String type) async {
    if (_selectedOffice == null) {
      _showBilingualError('Please select an office location first.', 'தயவுசெய்து அலுவலக இடத்தை தேர்ந்தெடுக்கவும்.');
      return;
    }

    setState(() => _isLoading = true);
    
    try {
      final position = await LocationService.getCurrentPosition();
      setState(() {
        _currentPosition = position;
        _calculateDistance();
      });

      final isWithinArea = LocationService.isWithinRadius(
        currentLat: position.latitude,
        currentLng: position.longitude,
        targetLat: _selectedOffice!.latitude,
        targetLng: _selectedOffice!.longitude,
        radiusInMeters: _selectedOffice!.radius,
      );

      if (!isWithinArea) {
        _showBilingualError(
          'You are not at the office location.',
          'நீங்கள் office-ல் இல்லை.'
        );
        return;
      }

      final authState = context.read<AuthBloc>().state;
      if (authState is AuthAuthenticated) {
        final employeeId = authState.profile?['employee_id'];
        final now = DateTime.now();
        final dateStr = DateFormat('yyyy-MM-dd').format(now);

        if (type == 'in') {
          await SupabaseConfig.client.from('attendance_logs').insert({
            'employee_id': employeeId,
            'check_in': now.toIso8601String(),
            'lat': position.latitude,
            'lng': position.longitude,
            'date': dateStr,
            'status': 'present'
          });
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Punched In Successfully! / பதிவு வெற்றிகரமானது', textAlign: TextAlign.center, style: TextStyle(color: Colors.white)), backgroundColor: Colors.green));
        } else {
          final todayLog = _logs.firstWhere((log) => log['date'] == dateStr && log['check_out'] == null, orElse: () => {});
          if (todayLog.isNotEmpty) {
            await SupabaseConfig.client.from('attendance_logs').update({
              'check_out': now.toIso8601String()
            }).eq('id', todayLog['id']);
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Punched Out Successfully! / பதிவு வெற்றிகரமானது', textAlign: TextAlign.center, style: TextStyle(color: Colors.white)), backgroundColor: Colors.orange));
          }
        }
        _fetchLogs();
      }
    } catch (e) {
      _showError(e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message, style: const TextStyle(color: Colors.white)),
      backgroundColor: Colors.red.shade600,
    ));
  }

  void _showBilingualError(String en, String ta) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('$ta\n$en', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      backgroundColor: Colors.red.shade700,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      margin: const EdgeInsets.all(16),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final todayLog = _logs.firstWhere((log) => log['date'] == todayStr, orElse: () => {});
    
    final hasPunchedIn = todayLog.isNotEmpty;
    final hasPunchedOut = hasPunchedIn && todayLog['check_out'] != null;

    final isDistanceValid = _currentDistance <= (_selectedOffice?.radius ?? 100);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              height: 250,
              decoration: BoxDecoration(color: Colors.grey.shade200),
              child: Stack(
                children: [
                  _currentPosition == null
                    ? const Center(child: CircularProgressIndicator())
                    : GoogleMap(
                        initialCameraPosition: CameraPosition(
                          target: LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
                          zoom: 16.0,
                        ),
                        myLocationEnabled: true,
                        myLocationButtonEnabled: true,
                        mapToolbarEnabled: false,
                        zoomControlsEnabled: false,
                        onMapCreated: (GoogleMapController controller) {
                          if (!_controller.isCompleted) {
                            _controller.complete(controller);
                          }
                        },
                        circles: _selectedOffice == null ? {} : {
                          Circle(
                            circleId: const CircleId('office_radius'),
                            center: LatLng(_selectedOffice!.latitude, _selectedOffice!.longitude),
                            radius: _selectedOffice!.radius,
                            fillColor: isDistanceValid ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2),
                            strokeColor: isDistanceValid ? Colors.green : Colors.red,
                            strokeWidth: 2,
                          )
                        },
                      ),
                  Positioned(
                    bottom: 16, left: 16, right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.95), borderRadius: BorderRadius.circular(12), boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10)]),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          DropdownButtonHideUnderline(
                            child: DropdownButton<OfficeLocation>(
                              isExpanded: true,
                              value: _selectedOffice,
                              icon: const Icon(Icons.arrow_drop_down, color: Color(0xFF1E3A5F)),
                              items: LocationService.offices.map((office) {
                                return DropdownMenuItem(value: office, child: Text(office.name, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))));
                              }).toList(),
                              onChanged: (value) {
                                setState(() {
                                  _selectedOffice = value;
                                  _calculateDistance();
                                });
                                if (_currentPosition != null) _moveCameraTo(_currentPosition!);
                              },
                            ),
                          ),
                          const Divider(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Distance: ${_currentDistance.toStringAsFixed(1)}m', style: TextStyle(fontWeight: FontWeight.bold, color: isDistanceValid ? Colors.green.shade700 : Colors.red.shade700)),
                              Text('Allowed: ${_selectedOffice?.radius.toInt() ?? 100}m', style: const TextStyle(color: Colors.grey, fontSize: 13)),
                            ],
                          )
                        ],
                      ),
                    ),
                  )
                ],
              ),
            ),
          ),
          
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_isLoading) 
                    const Center(child: CircularProgressIndicator())
                  else if (!hasPunchedIn)
                    ElevatedButton.icon(
                      icon: const Icon(Icons.fingerprint),
                      label: const Text('PUNCH IN', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(backgroundColor: isDistanceValid ? Colors.green : Colors.grey, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(56), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      onPressed: isDistanceValid ? () => _handlePunch('in') : () => _showBilingualError('You are not at the office location.', 'நீங்கள் office-ல் இல்லை.'),
                    )
                  else if (!hasPunchedOut)
                    ElevatedButton.icon(
                      icon: const Icon(Icons.exit_to_app),
                      label: const Text('PUNCH OUT', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(backgroundColor: isDistanceValid ? Colors.orange : Colors.grey, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(56), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      onPressed: isDistanceValid ? () => _handlePunch('out') : () => _showBilingualError('You are not at the office location.', 'நீங்கள் office-ல் இல்லை.'),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.green.shade200)),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle, color: Colors.green),
                          SizedBox(width: 8),
                          Text('Attendance completed for today.', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                        ],
                      )
                    ),
                ],
              ),
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),
                  const Text('Monthly Calendar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
                  const SizedBox(height: 12),
                  _buildMonthlyCalendar(),
                  const SizedBox(height: 24),
                  const Text('Recent Logs', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A5F))),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
          
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                if (index >= _logs.length) return null;
                final log = _logs[index];
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                  color: Colors.white,
                  child: ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.calendar_today, color: Color(0xFF1E3A5F), size: 20),
                    ),
                    title: Text(log['date'], style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('In: ${_formatTime(log['check_in'])} - Out: ${_formatTime(log['check_out'])}', style: const TextStyle(fontSize: 12)),
                    trailing: Text(log['status'].toString().toUpperCase(), style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green, fontSize: 12)),
                  ),
                );
              },
              childCount: _logs.length,
            ),
          )
        ],
      ),
    );
  }

  Widget _buildMonthlyCalendar() {
    // Generate a simple static grid representing the current month for UI purposes
    final now = DateTime.now();
    final firstDayOfMonth = DateTime(now.year, now.month, 1);
    final daysInMonth = DateUtils.getDaysInMonth(now.year, now.month);
    
    // List of dates where employee was present (derived from _logs)
    final presentDates = _logs.map((e) => e['date'] as String).toSet();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200)
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(DateFormat('MMMM yyyy').format(now), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              Row(
                children: [
                  Container(width: 8, height: 8, decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  const Text('Present', style: TextStyle(fontSize: 10, color: Colors.grey)),
                ],
              )
            ],
          ),
          const SizedBox(height: 16),
          // Days of week header
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Text('S', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
              Text('M', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
              Text('T', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
              Text('W', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
              Text('T', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
              Text('F', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
              Text('S', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 8),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              crossAxisSpacing: 4,
              mainAxisSpacing: 4,
            ),
            itemCount: 35, // Simulate 5 weeks grid
            itemBuilder: (context, index) {
              // Simple offset logic for demo
              final dayNumber = index - firstDayOfMonth.weekday % 7 + 1;
              if (dayNumber < 1 || dayNumber > daysInMonth) {
                return const SizedBox.shrink();
              }
              
              final dateStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${dayNumber.toString().padLeft(2, '0')}';
              final isPresent = presentDates.contains(dateStr);
              final isToday = dayNumber == now.day;

              return Container(
                decoration: BoxDecoration(
                  color: isPresent ? Colors.green.withOpacity(0.1) : Colors.transparent,
                  border: isToday ? Border.all(color: const Color(0xFF1E3A5F), width: 2) : null,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Text(
                    '$dayNumber',
                    style: TextStyle(
                      color: isPresent ? Colors.green.shade700 : Colors.black87,
                      fontWeight: isToday || isPresent ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ),
              );
            },
          )
        ],
      )
    );
  }

  String _formatTime(String? isoString) {
    if (isoString == null) return '--:--';
    return DateFormat('hh:mm a').format(DateTime.parse(isoString));
  }
}
