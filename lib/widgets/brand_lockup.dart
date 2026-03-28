import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../main.dart';

const String _blueLogoAsset = 'assets/images/Four Square Logo blue.png';

class BrandLockup extends StatelessWidget {
  const BrandLockup({
    super.key,
    this.logoSize = 80,
    this.titleSize = 24,
    this.spacing = 16,
    this.textColor = MyApp.primaryBlue,
  });

  final double logoSize;
  final double titleSize;
  final double spacing;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          _blueLogoAsset,
          width: logoSize,
          height: logoSize,
          fit: BoxFit.contain,
          errorBuilder: (context, error, stackTrace) {
            return Icon(
              Icons.business,
              size: logoSize,
              color: textColor,
            );
          },
        ),
        SizedBox(height: spacing),
        Text(
          'Foursquare HRMS',
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(
            fontSize: titleSize,
            fontWeight: FontWeight.w800,
            color: textColor,
            letterSpacing: 0.3,
            height: 1.1,
          ),
        ),
      ],
    );
  }
}

