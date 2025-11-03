#!/usr/bin/env python3
"""
Adjust icon size to 88% fill (slightly smaller than 92%).
"""

from PIL import Image
import os

def adjust_icon_size(input_path, output_path, target_fill=0.88):
    """Scale icon content to target fill percentage."""

    source = Image.open(input_path).convert('RGBA')
    width, height = source.size
    pixels = source.load()

    # Find content bounds
    min_x, min_y = width, height
    max_x, max_y = 0, 0

    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] > 0:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    content_width = max_x - min_x + 1
    content_height = max_y - min_y + 1

    print(f"Current content: {content_width}x{content_height}")
    print(f"Current fill: {content_width/width*100:.1f}%")

    # Crop to content
    content = source.crop((min_x, min_y, max_x + 1, max_y + 1))

    # Scale to target fill
    target_size = int(width * target_fill)
    content_aspect = content_width / content_height

    if content_aspect > 1:
        new_width = target_size
        new_height = int(target_size / content_aspect)
    else:
        new_height = target_size
        new_width = int(target_size * content_aspect)

    scaled = content.resize((new_width, new_height), Image.Resampling.LANCZOS)

    print(f"Scaled to: {new_width}x{new_height}")
    print(f"New fill: {new_width/width*100:.1f}%")

    # Center on canvas
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    paste_x = (width - new_width) // 2
    paste_y = (height - new_height) // 2
    result.paste(scaled, (paste_x, paste_y), scaled)

    result.save(output_path)

    print(f"✓ Saved to {output_path}")
    print(f"  Output size: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')
    output_file = os.path.join(script_dir, 'new-dock-icon.png')

    adjust_icon_size(input_file, output_file, target_fill=0.88)
    print("\n✅ Icon resized to 88% fill!")
