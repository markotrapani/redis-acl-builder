#!/usr/bin/env python3
"""Analyze pixel values in the shadow area."""

from PIL import Image
import os

def analyze_shadow():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')

    source = Image.open(input_file).convert('RGBA')
    pixels = source.load()
    width, height = source.size

    # Sample pixels from the edges (where shadow should be)
    print("Sampling edge pixels (first 10 rows):")
    print("Format: (x, y): (R, G, B, A)")
    print("-" * 50)

    samples = []
    for y in range(10):
        for x in range(0, width, 100):  # Sample every 100 pixels
            pixel = pixels[x, y]
            r, g, b, a = pixel
            if a > 0:  # Only show non-transparent
                samples.append((x, y, r, g, b, a))
                print(f"({x:3d}, {y:2d}): RGB({r:3d}, {g:3d}, {b:3d}) A={a:3d}")

    print("\n" + "=" * 50)
    print("Sampling bottom edge (last 10 rows):")
    print("-" * 50)

    for y in range(height-10, height):
        for x in range(0, width, 100):
            pixel = pixels[x, y]
            r, g, b, a = pixel
            if a > 0:
                samples.append((x, y, r, g, b, a))
                print(f"({x:3d}, {y:3d}): RGB({r:3d}, {g:3d}, {b:3d}) A={a:3d}")

    print("\n" + "=" * 50)
    print("Sampling left edge (first 10 columns):")
    print("-" * 50)

    for x in range(10):
        for y in range(0, height, 100):
            pixel = pixels[x, y]
            r, g, b, a = pixel
            if a > 0:
                samples.append((x, y, r, g, b, a))
                print(f"({x:2d}, {y:3d}): RGB({r:3d}, {g:3d}, {b:3d}) A={a:3d}")

if __name__ == '__main__':
    analyze_shadow()
