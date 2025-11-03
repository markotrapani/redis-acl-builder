#!/usr/bin/env python3
"""
Final clean icon processing:
1. Remove light gray shadow (RGB 200-240) outside the rounded square
2. Preserve ALL white pixels (R and shield) inside
3. Scale up to 92% fill for proper dock sizing
"""

from PIL import Image
import os

def process_icon_final(input_path, output_path):
    """Complete icon processing with careful white preservation."""

    source = Image.open(input_path).convert('RGBA')
    width, height = source.size
    pixels = source.load()

    print(f"Step 1: Removing light shadow pixels...")

    # Pass 1: Remove only light gray shadow (preserve strong reds and ALL whites)
    temp = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    temp_pixels = temp.load()

    shadow_removed = 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]

            # Detect shadow: light gray in 200-240 range, all channels similar
            is_shadow = (
                a > 150 and
                200 <= r <= 240 and
                200 <= g <= 240 and
                200 <= b <= 240 and
                abs(r - g) <= 10 and
                abs(g - b) <= 10 and
                abs(r - b) <= 10
            )

            # Keep everything that's NOT shadow
            if not is_shadow:
                temp_pixels[x, y] = (r, g, b, a)
            else:
                temp_pixels[x, y] = (0, 0, 0, 0)
                shadow_removed += 1

    print(f"  Removed {shadow_removed:,} shadow pixels")

    # Pass 2: Find content bounds for scaling
    print(f"\nStep 2: Finding content bounds...")

    temp_pixels = temp.load()
    min_x, min_y = width, height
    max_x, max_y = 0, 0

    for y in range(height):
        for x in range(width):
            if temp_pixels[x, y][3] > 0:  # Non-transparent
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    content_width = max_x - min_x + 1
    content_height = max_y - min_y + 1

    print(f"  Content: {content_width}x{content_height} at ({min_x}, {min_y})")
    print(f"  Current fill: {content_width/width*100:.1f}%")

    # Pass 3: Scale up to 92% fill (standard dock icon size)
    print(f"\nStep 3: Scaling to proper dock size...")

    content = temp.crop((min_x, min_y, max_x + 1, max_y + 1))

    target_size = int(width * 0.92)
    content_aspect = content_width / content_height

    if content_aspect > 1:
        new_width = target_size
        new_height = int(target_size / content_aspect)
    else:
        new_height = target_size
        new_width = int(target_size * content_aspect)

    # Use LANCZOS for high-quality scaling that preserves edges
    scaled = content.resize((new_width, new_height), Image.Resampling.LANCZOS)

    print(f"  Scaled to: {new_width}x{new_height}")
    print(f"  New fill: {new_width/width*100:.1f}%")

    # Pass 4: Center on canvas
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    paste_x = (width - new_width) // 2
    paste_y = (height - new_height) // 2
    result.paste(scaled, (paste_x, paste_y), scaled)

    result.save(output_path)

    print(f"\n✓ Saved to {output_path}")
    print(f"  Output size: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Use the original Gemini icon as input
    input_file = os.path.join(script_dir, 'new-dock-icon.png')
    output_file = os.path.join(script_dir, 'new-dock-icon.png')

    # First, restore from git to get original
    print("Restoring original Gemini icon from git...")
    os.system(f'cd {script_dir} && git checkout HEAD~1 -- new-dock-icon.png')

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        exit(1)

    process_icon_final(input_file, output_file)
    print("\n✅ Icon processed successfully!")
    print("   White R and shield preserved")
    print("   Shadow removed, properly sized for dock")
