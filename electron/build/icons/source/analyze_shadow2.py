#!/usr/bin/env python3
"""Analyze pixel values around the rounded square where shadow is visible."""

from PIL import Image
import os

def analyze_around_content():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')

    source = Image.open(input_file).convert('RGBA')
    pixels = source.load()
    width, height = source.size

    # Check bottom area (where shadow is most visible per user feedback)
    print("Sampling bottom area around y=900-1000:")
    print("Format: (x, y): (R, G, B, A)")
    print("-" * 50)

    for y in [900, 920, 940, 960, 980, 1000, 1020]:
        print(f"\nRow y={y}:")
        for x in [100, 200, 300, 400, 500, 600, 700, 800, 900]:
            if 0 <= x < width and 0 <= y < height:
                pixel = pixels[x, y]
                r, g, b, a = pixel
                if a > 0:
                    print(f"  ({x:3d}, {y:4d}): RGB({r:3d}, {g:3d}, {b:3d}) A={a:3d}")

    print("\n" + "=" * 50)
    print("Sampling horizontal line at y=950 (bottom edge area):")
    print("-" * 50)

    y = 950
    for x in range(0, width, 50):
        pixel = pixels[x, y]
        r, g, b, a = pixel
        if a > 10:  # Show even faint pixels
            print(f"({x:4d}, {y}): RGB({r:3d}, {g:3d}, {b:3d}) A={a:3d}")

if __name__ == '__main__':
    analyze_around_content()
