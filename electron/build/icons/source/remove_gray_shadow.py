#!/usr/bin/env python3
"""
Remove gray shadow from icon by detecting light gray pixels near the outer edge
while preserving anti-aliasing on the red square and white R/shield.
"""

from PIL import Image
from collections import deque
import os

def remove_gray_shadow(input_path, output_path):
    """Remove gray shadow while preserving all icon content and anti-aliasing."""

    # Load the icon
    source = Image.open(input_path).convert('RGBA')
    width, height = source.size
    pixels = source.load()

    print(f"Processing {width}x{height} icon...")

    def is_light_gray_shadow(pixel):
        """Detect light gray shadow pixels (not content)."""
        r, g, b, a = pixel

        # Shadow is very light gray with similar RGB values
        # Content (red) has R >> G and R >> B
        # Content (white) has all high RGB values

        if a < 50:  # Already transparent
            return False

        # Light gray: RGB values are similar and in the 200-240 range
        is_similar = abs(r - g) < 20 and abs(g - b) < 20 and abs(r - b) < 20
        is_light = 200 < r < 240 and 200 < g < 240 and 200 < b < 240

        return is_similar and is_light

    def is_content(pixel):
        """Detect actual icon content (red square or white R/shield)."""
        r, g, b, a = pixel

        if a < 100:  # Too transparent to be content
            return False

        # Red/orange detection
        is_red = r > 180 and g < 120 and b < 120

        # Bright white detection (R and shield)
        is_white = r > 220 and g > 220 and b > 220

        return is_red or is_white

    # Find the bounding box of actual content
    min_x, min_y = width, height
    max_x, max_y = 0, 0

    for y in range(height):
        for x in range(width):
            if is_content(pixels[x, y]):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    print(f"Content bounding box: ({min_x}, {min_y}) to ({max_x}, {max_y})")

    # Add a margin around content to preserve anti-aliasing
    margin = 5
    min_x = max(0, min_x - margin)
    min_y = max(0, min_y - margin)
    max_x = min(width - 1, max_x + margin)
    max_y = min(height - 1, max_y + margin)

    print(f"With margin: ({min_x}, {min_y}) to ({max_x}, {max_y})")

    # Flood fill from edges to find shadow pixels
    shadow_pixels = set()
    to_check = deque()

    # Start from all edge pixels
    for x in range(width):
        if is_light_gray_shadow(pixels[x, 0]):
            to_check.append((x, 0))
            shadow_pixels.add((x, 0))
        if is_light_gray_shadow(pixels[x, height-1]):
            to_check.append((x, height-1))
            shadow_pixels.add((x, height-1))

    for y in range(height):
        if is_light_gray_shadow(pixels[0, y]):
            to_check.append((0, y))
            shadow_pixels.add((0, y))
        if is_light_gray_shadow(pixels[width-1, y]):
            to_check.append((width-1, y))
            shadow_pixels.add((width-1, y))

    # Flood fill shadow regions from edges
    while to_check:
        x, y = to_check.popleft()

        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)]:
            nx, ny = x + dx, y + dy

            if 0 <= nx < width and 0 <= ny < height:
                if (nx, ny) not in shadow_pixels:
                    # Only continue flood if it's shadow AND outside content box
                    if is_light_gray_shadow(pixels[nx, ny]) and (
                        nx < min_x or nx > max_x or ny < min_y or ny > max_y
                    ):
                        shadow_pixels.add((nx, ny))
                        to_check.append((nx, ny))

    print(f"Found {len(shadow_pixels):,} shadow pixels to remove")

    # Create result
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()

    pixels_kept = 0
    pixels_removed = 0

    for y in range(height):
        for x in range(width):
            if (x, y) in shadow_pixels:
                result_pixels[x, y] = (0, 0, 0, 0)  # Transparent
                pixels_removed += 1
            else:
                result_pixels[x, y] = pixels[x, y]  # Keep original
                if pixels[x, y][3] > 0:
                    pixels_kept += 1

    # Save result
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

    remove_gray_shadow(input_file, output_file)
    print("\n✅ Gray shadow removed!")
    print("   Anti-aliasing on content should be preserved.")
