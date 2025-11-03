#!/usr/bin/env python3
"""
Final shadow removal based on actual pixel analysis.
Shadow pixels are RGB(215-235, 215-235, 215-235) with high alpha.
"""

from PIL import Image
from collections import deque
import os

def remove_shadow_final(input_path, output_path):
    """Remove gray shadow based on actual pixel values found."""

    source = Image.open(input_path).convert('RGBA')
    width, height = source.size
    pixels = source.load()

    print(f"Processing {width}x{height} icon...")

    def is_shadow_pixel(pixel):
        """Detect shadow pixels based on actual analysis."""
        r, g, b, a = pixel

        if a < 200:  # Shadow has high alpha
            return False

        # Shadow is light gray with RGB in 215-235 range
        # All three channels are similar (within 5 of each other)
        in_range = 215 <= r <= 235 and 215 <= g <= 235 and 215 <= b <= 235
        similar = abs(r - g) <= 5 and abs(g - b) <= 5 and abs(r - b) <= 5

        return in_range and similar

    def is_strong_content(pixel):
        """Detect strong content pixels (definitely keep these)."""
        r, g, b, a = pixel

        if a < 100:
            return False

        # Red/orange content
        is_red = r > 160 and g < 100 and b < 100

        # Bright white (R and shield)
        is_white = r > 200 and g > 200 and b > 200

        return is_red or is_white

    # Find shadow pixels using flood fill from edges
    shadow_set = set()
    to_check = deque()

    # Start from all edges
    for x in range(width):
        for y in [0, height-1]:
            if is_shadow_pixel(pixels[x, y]):
                shadow_set.add((x, y))
                to_check.append((x, y))

    for y in range(height):
        for x in [0, width-1]:
            if is_shadow_pixel(pixels[x, y]):
                shadow_set.add((x, y))
                to_check.append((x, y))

    # Flood fill shadow regions
    while to_check:
        x, y = to_check.popleft()

        # Check all 8 directions
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue

                nx, ny = x + dx, y + dy

                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in shadow_set:
                        pixel = pixels[nx, ny]

                        # Continue flood if it's shadow and NOT strong content
                        if is_shadow_pixel(pixel) and not is_strong_content(pixel):
                            shadow_set.add((nx, ny))
                            to_check.append((nx, ny))

    print(f"Found {len(shadow_set):,} shadow pixels")

    # Create result
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()

    pixels_removed = 0
    pixels_kept = 0

    for y in range(height):
        for x in range(width):
            if (x, y) in shadow_set:
                result_pixels[x, y] = (0, 0, 0, 0)  # Transparent
                pixels_removed += 1
            else:
                result_pixels[x, y] = pixels[x, y]  # Keep original
                if pixels[x, y][3] > 0:
                    pixels_kept += 1

    result.save(output_path)

    print(f"✓ Saved to {output_path}")
    print(f"  Pixels kept: {pixels_kept:,}")
    print(f"  Shadow pixels removed: {pixels_removed:,}")
    print(f"  Output size: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')
    output_file = os.path.join(script_dir, 'new-dock-icon.png')

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        exit(1)

    remove_shadow_final(input_file, output_file)
    print("\n✅ Shadow removed successfully!")
