#!/usr/bin/env python3
"""
Enhance icon colors - boost red saturation and vibrancy for better dock appearance.
"""

from PIL import Image, ImageEnhance
import os

def enhance_icon_colors(input_path, output_path):
    """Boost saturation and vibrancy of the icon."""

    source = Image.open(input_path).convert('RGBA')

    print(f"Enhancing colors in {os.path.basename(input_path)}...")

    # Split into RGB and alpha
    rgb_image = Image.new('RGB', source.size, (255, 255, 255))
    rgb_image.paste(source, mask=source.split()[3])  # Use alpha as mask

    # Enhance color saturation (make reds more vibrant)
    color_enhancer = ImageEnhance.Color(rgb_image)
    enhanced = color_enhancer.enhance(1.3)  # 30% more saturation

    # Enhance contrast slightly for punch
    contrast_enhancer = ImageEnhance.Contrast(enhanced)
    enhanced = contrast_enhancer.enhance(1.1)  # 10% more contrast

    # Merge back with original alpha channel
    result = Image.new('RGBA', source.size)
    result.paste(enhanced, (0, 0))

    # Apply original alpha channel
    r, g, b = result.split()[:3]
    a = source.split()[3]
    result = Image.merge('RGBA', (r, g, b, a))

    result.save(output_path)

    print(f"✓ Saved enhanced icon to {output_path}")
    print(f"  Saturation boost: +30%")
    print(f"  Contrast boost: +10%")
    print(f"  Output size: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')
    output_file = os.path.join(script_dir, 'new-dock-icon.png')

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        exit(1)

    enhance_icon_colors(input_file, output_file)
    print("\n✅ Icon colors enhanced!")
    print("   Reds should appear more vibrant and punchy in dock.")
