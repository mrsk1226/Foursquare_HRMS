import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PermissionService {
  static const String _prefKey = 'location_asked';

  static Future<bool> checkAndRequestLocation() async {
    final prefs = await SharedPreferences.getInstance();
    final bool locationAsked = prefs.getBool(_prefKey) ?? false;

    // First launch only: request permissions
    if (!locationAsked) {
      Map<Permission, PermissionStatus> statuses = await [
        Permission.location,
        Permission.locationWhenInUse,
      ].request();
      
      await prefs.setBool(_prefKey, true);
      return statuses[Permission.location]?.isGranted ?? false;
    }

    // Never ask again after first time, just check status
    final status = await Permission.location.status;
    return status.isGranted;
  }

  static Future<bool> isPermissionAlreadyGranted() async {
    final status = await Permission.location.status;
    return status.isGranted;
  }
}
