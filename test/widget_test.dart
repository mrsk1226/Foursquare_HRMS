import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('basic widget smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Text('Foursquare HRMS'),
        ),
      ),
    );

    expect(find.text('Foursquare HRMS'), findsOneWidget);
  });
}
