#!/usr/bin/env python3
"""
Remove ONLY the outer white/gray shadow from the current icon.
Preserve all white pixels inside the rounded square (R and shield).
"""

from PIL import Image
from collections import deque
import os

def remove_outer_shadow(input_path, output_path):
    """Remove outer shadow using flood fill from edges."""

    source = Image.open(input_path).convert('RGBA')
    width, height = source.size
    pixels = source.load()

    print(f"Processing {width}x{height} icon...")

    # Find ALL pixels that are light colored (potential shadow)
    def is_light_pixel(pixel):
        r, g, b, a = pixel
        if a < 50:
            return True  # Already transparent
        # Light gray/white in 200-255 range
        return (r > 200 and g > 200 and b > 200) or (200 <= r <= 240 and 200 <= g <= 240 and 200 <= b <= 240 and abs(r-g) < 15 and abs(g-b) < 15)

    # Flood fill from edges to find outer shadow
    outer_pixels = set()
    to_check = deque()

    # Start from all edges
    for x in range(width):
        for y in [0, height-1]:
            if is_light_pixel(pixels[x, y]):
                outer_pixels.add((x, y))
                to_check.append((x, y))

    for y in range(height):
        for x in [0, width-1]:
            if (x, y) not in outer_pixels and is_light_pixel(pixels[x, y]):
                outer_pixels.add((x, y))
                to_check.append((x, y))

    # Flood fill from edges
    while to_check:
        x, y = to_check.popleft()

        for dx, dy in [(0,1), (0,-1), (1,0), (-1,0), (1,1), (-1,-1), (1,-1), (-1,1)]:
            nx, ny = x + dx, y + dy

            if 0 <= nx < width and 0 <= ny < height:
                if (nx, ny) not in outer_pixels:
                    pixel = pixels[nx, ny]
                    r, g, b, a = pixel

                    # Continue flood for light pixels OR very transparent ones
                    is_light = is_light_pixel(pixel)

                    # Also check if it's NOT strong red content
                    is_strong_red = r > 160 and g < 100 and b < 100

                    if is_light and not is_strong_red:
                        outer_pixels.add((nx, ny))
                        to_check.append((nx, ny))

    print(f"Found {len(outer_pixels):,} outer shadow pixels")

    # Create result - remove outer pixels
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()

    kept = 0
    for y in range(height):
        for x in range(width):
            if (x, y) not in outer_pixels:
                result_pixels[x, y] = pixels[x, y]
                if pixels[x, y][3] > 0:
                    kept += 1
            else:
                result_pixels[x, y] = (0, 0, 0, 0)

    result.save(output_path)

    print(f"✓ Saved to {output_path}")
    print(f"  Pixels kept: {kept:,}")
    print(f"  Output size: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')
    output_file = os.path.join(script_dir, 'new-dock-icon.png')

    remove_outer_shadow(input_file, output_file)
    print("\n✅ Outer shadow removed!")
