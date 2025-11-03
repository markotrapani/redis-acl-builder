#!/usr/bin/env python3
"""
Scale up icon content to fill more of the canvas for proper dock sizing.
macOS dock icons should use most of the available space.
"""

from PIL import Image
import os

def scale_up_icon(input_path, output_path):
    """Scale up the icon content to fill 90% of canvas (from ~80%)."""

    source = Image.open(input_path).convert('RGBA')
    width, height = source.size

    print(f"Processing {width}x{height} icon...")

    # Find current content bounds
    pixels = source.load()
    min_x, min_y = width, height
    max_x, max_y = 0, 0

    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] > 0:  # Non-transparent
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    content_width = max_x - min_x + 1
    content_height = max_y - min_y + 1

    print(f"Current content: {content_width}x{content_height} at ({min_x}, {min_y})")
    print(f"Current fill: {content_width/width*100:.1f}% width, {content_height/height*100:.1f}% height")

    # Crop to content
    content = source.crop((min_x, min_y, max_x + 1, max_y + 1))

    # Target 92% of canvas (standard for macOS dock icons)
    target_size = int(width * 0.92)

    # Scale up content to target size (maintain aspect ratio)
    content_aspect = content_width / content_height
    if content_aspect > 1:
        new_width = target_size
        new_height = int(target_size / content_aspect)
    else:
        new_height = target_size
        new_width = int(target_size * content_aspect)

    scaled_content = content.resize((new_width, new_height), Image.Resampling.LANCZOS)

    print(f"Scaled to: {new_width}x{new_height}")
    print(f"New fill: {new_width/width*100:.1f}% width, {new_height/height*100:.1f}% height")

    # Center on transparent canvas
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    paste_x = (width - new_width) // 2
    paste_y = (height - new_height) // 2
    result.paste(scaled_content, (paste_x, paste_y), scaled_content)

    result.save(output_path)

    print(f"✓ Saved to {output_path}")
    print(f"  Output size: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')
    output_file = os.path.join(script_dir, 'new-dock-icon.png')

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        exit(1)

    scale_up_icon(input_file, output_file)
    print("\n✅ Icon scaled up to proper dock size!")
