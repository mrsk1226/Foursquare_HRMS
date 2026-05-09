import 'package:flutter/material.dart';

const String _whiteLogoAsset = 'assets/images/4 square White Colour.png';
const double _whiteLogoAssetHeight = 449;
const double _whiteLogoCropWidth = 283;
const double _whiteLogoCropHeight = 277;
const double _whiteLogoLeftInset = 125;
const double _whiteLogoTopInset = 46;

class DashboardBrandLogo extends StatelessWidget {
  const DashboardBrandLogo({
    super.key,
    this.width = 52,
    this.height = 52,
    this.padding = const EdgeInsets.all(10),
    this.backgroundColor = Colors.transparent,
    this.borderRadius = 18,
    this.borderColor,
  });

  final double width;
  final double height;
  final EdgeInsets padding;
  final Color backgroundColor;
  final double borderRadius;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(borderRadius),
          border: borderColor != null ? Border.all(color: borderColor!) : null,
        ),
        child: Padding(
          padding: padding,
          child: LayoutBuilder(
            builder: (context, constraints) {
              const cropAspect = _whiteLogoCropWidth / _whiteLogoCropHeight;
              final fittedHeight = [
                constraints.maxHeight,
                constraints.maxWidth / cropAspect,
              ].reduce((value, element) => value < element ? value : element);
              final fittedWidth = fittedHeight * cropAspect;
              final renderedImageHeight =
                  fittedHeight * (_whiteLogoAssetHeight / _whiteLogoCropHeight);
              final fittedXOffset =
                  fittedHeight * (_whiteLogoLeftInset / _whiteLogoCropHeight);
              final fittedYOffset =
                  fittedHeight * (_whiteLogoTopInset / _whiteLogoCropHeight);

              return Center(
                child: SizedBox(
                  width: fittedWidth,
                  height: fittedHeight,
                  child: ClipRect(
                    child: Transform.translate(
                      offset: Offset(-fittedXOffset, -fittedYOffset),
                      child: Image.asset(
                        _whiteLogoAsset,
                        height: renderedImageHeight,
                        fit: BoxFit.fitHeight,
                        filterQuality: FilterQuality.high,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
