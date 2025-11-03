#!/usr/bin/env python3
"""Generate Windows .ico file from source PNG."""

from PIL import Image
import os

def generate_windows_icon():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source_path = os.path.join(script_dir, 'source', 'new-dock-icon.png')
    output_path = os.path.join(script_dir, 'win', 'icon.ico')

    # Load source image
    img = Image.open(source_path)

    # Generate all sizes
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    images = [img.resize(size, Image.Resampling.LANCZOS) for size in sizes]

    # Save as .ico
    images[0].save(output_path, format='ICO', sizes=sizes, append_images=images[1:])

    # Print info
    file_size = os.path.getsize(output_path)
    print(f"✓ Generated Windows icon: {output_path}")
    print(f"  Size: {file_size:,} bytes")
    print(f"  Resolutions: {', '.join([f'{w}x{h}' for w, h in sizes])}")

if __name__ == '__main__':
    generate_windows_icon()
