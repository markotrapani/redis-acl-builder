#!/usr/bin/env python3
"""
Aggressive shadow removal - expand RGB range to catch all light pixels outside content.
"""

from PIL import Image
import os

def remove_all_light_pixels(input_path, output_path):
    """Remove all light gray/white pixels that aren't strong content."""

    source = Image.open(input_path).convert('RGBA')
    width, height = source.size
    pixels = source.load()

    print(f"Processing {width}x{height} icon...")

    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()

    removed_count = 0
    kept_count = 0

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]

            # Strong content detection
            is_red = r > 160 and g < 120 and b < 120  # Red/orange
            is_bright_white = r > 230 and g > 230 and b > 230  # Very bright white (R and shield)

            # Light gray/shadow detection (expand range)
            is_light = (
                a > 150 and
                200 <= r <= 240 and
                200 <= g <= 240 and
                200 <= b <= 240 and
                abs(r - g) <= 10 and
                abs(g - b) <= 10 and
                abs(r - b) <= 10
            )

            if is_red or is_bright_white:
                # Keep strong content
                result_pixels[x, y] = (r, g, b, a)
                kept_count += 1
            elif is_light:
                # Remove light gray/shadow
                result_pixels[x, y] = (0, 0, 0, 0)
                removed_count += 1
            else:
                # Keep everything else (anti-aliasing, gradients)
                result_pixels[x, y] = (r, g, b, a)
                if a > 0:
                    kept_count += 1

    result.save(output_path)

    print(f"✓ Saved to {output_path}")
    print(f"  Pixels kept: {kept_count:,}")
    print(f"  Light pixels removed: {removed_count:,}")
    print(f"  Output size: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')
    output_file = os.path.join(script_dir, 'new-dock-icon.png')

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        exit(1)

    remove_all_light_pixels(input_file, output_file)
    print("\n✅ All light pixels removed!")
