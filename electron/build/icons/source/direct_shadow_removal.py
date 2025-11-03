#!/usr/bin/env python3
"""
Direct shadow removal - just remove all shadow-colored pixels.
Based on analysis: shadow is RGB(215-235, 215-235, 215-235).
"""

from PIL import Image
import os

def remove_all_shadow_pixels(input_path, output_path):
    """Remove ALL shadow pixels regardless of location."""

    source = Image.open(input_path).convert('RGBA')
    width, height = source.size
    pixels = source.load()

    print(f"Processing {width}x{height} icon...")

    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()

    shadow_count = 0
    kept_count = 0

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]

            # Detect shadow: RGB in 215-235 range, all similar
            is_shadow = (
                a > 200 and
                215 <= r <= 235 and
                215 <= g <= 235 and
                215 <= b <= 235 and
                abs(r - g) <= 5 and
                abs(g - b) <= 5 and
                abs(r - b) <= 5
            )

            if is_shadow:
                # Make transparent
                result_pixels[x, y] = (0, 0, 0, 0)
                shadow_count += 1
            else:
                # Keep original
                result_pixels[x, y] = (r, g, b, a)
                if a > 0:
                    kept_count += 1

    result.save(output_path)

    print(f"✓ Saved to {output_path}")
    print(f"  Pixels kept: {kept_count:,}")
    print(f"  Shadow pixels removed: {shadow_count:,}")
    print(f"  Output size: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')
    output_file = os.path.join(script_dir, 'new-dock-icon.png')

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        exit(1)

    remove_all_shadow_pixels(input_file, output_file)
    print("\n✅ All shadow pixels removed!")
