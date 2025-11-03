#!/usr/bin/env python3
"""Generate Linux PNG icons from source PNG."""

from PIL import Image
import os

def generate_linux_icons():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source_path = os.path.join(script_dir, 'source', 'new-dock-icon.png')
    linux_dir = os.path.join(script_dir, 'linux')

    # Ensure linux directory exists
    os.makedirs(linux_dir, exist_ok=True)

    # Load source image
    img = Image.open(source_path)

    # Generate all sizes
    sizes = [512, 256, 128, 64, 32, 16]

    print("Generating Linux PNG icons...")
    for size in sizes:
        output_path = os.path.join(linux_dir, f'icon-{size}.png')
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(output_path, 'PNG')
        file_size = os.path.getsize(output_path)
        print(f"  ✓ {size}x{size}: {file_size:,} bytes")

    print(f"\n✅ Generated {len(sizes)} Linux PNG icons in {linux_dir}")

if __name__ == '__main__':
    generate_linux_icons()
