import 'package:geolocator/geolocator.dart';

class OfficeLocation {
  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final double radius;

  const OfficeLocation({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.radius,
  });
}

class LocationService {
  static const List<OfficeLocation> offices = [
    OfficeLocation(
      id: 'main_office',
      name: 'Foursquare Main Office',
      latitude: 11.3292918,
      longitude: 77.7007555,
      radius: 100.0,
    ),
    OfficeLocation(
      id: 'showroom',
      name: 'Foursquare Showroom',
      latitude: 11.3319983,
      longitude: 77.7012905,
      radius: 50.0,
    ),
  ];
  /// Check permissions and get current position
  static Future<Position> getCurrentPosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw 'Location services are disabled.';
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw 'Location permissions are denied';
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw 'Location permissions are permanently denied, we cannot request permissions.';
    }

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }

  /// Check if the user is within a distance of a target location (geofencing)
  static bool isWithinRadius({
    required double currentLat,
    required double currentLng,
    required double targetLat,
    required double targetLng,
    required double radiusInMeters,
  }) {
    double distanceInMeters = Geolocator.distanceBetween(
      currentLat,
      currentLng,
      targetLat,
      targetLng,
    );
    
    return distanceInMeters <= radiusInMeters;
  }
}
