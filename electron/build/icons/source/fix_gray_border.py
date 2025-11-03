#!/usr/bin/env python3
"""
Fix gray border on dock icon using morphological operations (erosion/dilation)
without scipy dependency.
"""

from PIL import Image, ImageFilter
import os

def fix_gray_border(input_path, output_path):
    """Remove gray border while preserving anti-aliasing using PIL filters."""

    # Load the icon
    source = Image.open(input_path).convert('RGBA')
    width, height = source.size
    pixels = source.load()

    print(f"Processing {width}x{height} icon...")

    # Create a binary mask of content pixels
    # Content is: red/orange areas OR bright pixels (white R and shield)
    mask = Image.new('L', (width, height), 0)
    mask_pixels = mask.load()

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]

            # Red/orange detection (the rounded square background)
            is_red = r > 150 and g > 50 and b < 150 and a > 200

            # Bright pixel detection (white R and shield)
            is_bright = (r > 180 or g > 180 or b > 180) and a > 150

            if is_red or is_bright:
                mask_pixels[x, y] = 255  # Mark as content
            else:
                mask_pixels[x, y] = 0    # Mark as background

    print("✓ Content mask created")

    # Erode: Shrink the content regions to remove gray border pixels
    # MinFilter shrinks bright regions (pulls edges inward)
    eroded = mask.filter(ImageFilter.MinFilter(5))
    print("✓ Mask eroded (gray border removed)")

    # Dilate: Expand the content regions back out for smooth edges
    # MaxFilter expands bright regions (pushes edges back out)
    dilated = eroded.filter(ImageFilter.MaxFilter(5))
    print("✓ Mask dilated (smooth edges restored)")

    # Apply the mask to the original image
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()
    dilated_pixels = dilated.load()

    pixels_kept = 0
    pixels_removed = 0

    for y in range(height):
        for x in range(width):
            if dilated_pixels[x, y] > 128:  # Content pixel
                result_pixels[x, y] = pixels[x, y]
                pixels_kept += 1
            else:  # Background pixel
                result_pixels[x, y] = (0, 0, 0, 0)  # Transparent
                pixels_removed += 1

    # Save result
    result.save(output_path)

    print(f"✓ Saved to {output_path}")
    print(f"  Pixels kept: {pixels_kept:,}")
    print(f"  Pixels made transparent: {pixels_removed:,}")
    print(f"  Output size: {os.path.getsize(output_path):,} bytes")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'new-dock-icon.png')
    output_file = os.path.join(script_dir, 'new-dock-icon.png')

    if not os.path.exists(input_file):
        print(f"❌ Error: {input_file} not found")
        exit(1)

    fix_gray_border(input_file, output_file)
    print("\n✅ Gray border removed successfully!")
    print("   The white R and shield inside should be preserved.")
    print("   Preview the icon to verify the result.")
