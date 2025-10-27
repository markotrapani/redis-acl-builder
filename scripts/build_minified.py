#!/usr/bin/env python3
"""
Build script to minify CSS and JavaScript files for production deployment.

This script:
1. Minifies all CSS files and combines them into styles.min.css
2. Minifies all JavaScript files individually (preserving ES6 modules)
3. Generates a build report with file sizes

Usage:
    python build_minified.py
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Tuple

import csscompressor  # type: ignore[import-untyped]
import rjsmin  # type: ignore[import-untyped]

# Directories (monorepo structure)
STATIC_DIR = Path(__file__).parent.parent / 'frontend' / 'static'
CSS_DIR = STATIC_DIR / 'css'
JS_DIR = STATIC_DIR / 'js'

def get_file_size(path: Path) -> int:
    """Get file size in bytes."""
    return os.path.getsize(path)

def format_size(bytes_size: float) -> str:
    """Format bytes as human-readable size."""
    size: float = bytes_size
    for unit in ['B', 'KB', 'MB']:
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} GB"

def minify_css() -> Tuple[int, int]:
    """Minify all CSS files and combine into styles.min.css."""
    print("\n=== Minifying CSS ===")

    # Find all CSS files (excluding already minified)
    css_files: list[Path] = sorted([
        f for f in CSS_DIR.glob('*.css')
        if not f.name.endswith('.min.css')
    ])

    if not css_files:
        print("No CSS files found to minify")
        return 0, 0

    # Combine and minify
    combined_css: list[str] = []
    original_size: int = 0

    for css_file in css_files:
        print(f"  Processing: {css_file.name}")
        with open(css_file, 'r', encoding='utf-8') as f:
            content = f.read()
            original_size += len(content.encode('utf-8'))
            combined_css.append(f"/* {css_file.name} */\n{content}\n")

    # Minify combined CSS
    combined_content: str = '\n'.join(combined_css)
    minified: str = csscompressor.compress(combined_content)  # type: ignore[arg-type]

    # Write minified file
    output_file: Path = CSS_DIR / 'styles.min.css'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(minified)

    minified_size: int = get_file_size(output_file)

    print(f"\n  Combined {len(css_files)} files:")
    print(f"    Original:  {format_size(original_size)}")
    print(f"    Minified:  {format_size(minified_size)}")
    print(f"    Savings:   {format_size(original_size - minified_size)} ({100 * (1 - minified_size/original_size):.1f}%)")
    print(f"    Output:    {output_file}")

    return original_size, minified_size

def minify_javascript() -> Tuple[int, int]:
    """Minify JavaScript files individually (preserve ES6 modules)."""
    print("\n=== Minifying JavaScript ===")

    # Find all JS files (excluding already minified)
    js_files: list[Path] = sorted([
        f for f in JS_DIR.rglob('*.js')
        if not f.name.endswith('.min.js')
    ])

    if not js_files:
        print("No JavaScript files found to minify")
        return 0, 0

    total_original: int = 0
    total_minified: int = 0

    for js_file in js_files:
        # Read original
        with open(js_file, 'r', encoding='utf-8') as f:
            content: str = f.read()
            original_size: int = len(content.encode('utf-8'))

        # Minify
        minified: str = str(rjsmin.jsmin(content))  # type: ignore[arg-type]

        # Write minified version
        output_file: Path = js_file.parent / f"{js_file.stem}.min.js"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(minified)

        minified_size: int = get_file_size(output_file)
        total_original += original_size
        total_minified += minified_size

        # Relative path for cleaner output
        rel_path: Path = js_file.relative_to(STATIC_DIR)
        savings: float = 100 * (1 - minified_size/original_size)
        print(f"  {rel_path}")
        print(f"    {format_size(original_size)} → {format_size(minified_size)} ({savings:.1f}% smaller)")

    print(f"\n  Total for {len(js_files)} files:")
    print(f"    Original:  {format_size(total_original)}")
    print(f"    Minified:  {format_size(total_minified)}")
    print(f"    Savings:   {format_size(total_original - total_minified)} ({100 * (1 - total_minified/total_original):.1f}%)")

    return total_original, total_minified

def main() -> None:
    """Run the build process."""
    print("=" * 60)
    print("Redis ACL Builder - Production Build")
    print("=" * 60)

    # Minify CSS
    css_original: int
    css_minified: int
    css_original, css_minified = minify_css()

    # Minify JavaScript
    js_original: int
    js_minified: int
    js_original, js_minified = minify_javascript()

    # Overall summary
    total_original: int = css_original + js_original
    total_minified: int = css_minified + js_minified

    print("\n" + "=" * 60)
    print("Build Summary")
    print("=" * 60)
    print(f"  Total Original:  {format_size(total_original)}")
    print(f"  Total Minified:  {format_size(total_minified)}")
    print(f"  Total Savings:   {format_size(total_original - total_minified)} ({100 * (1 - total_minified/total_original):.1f}%)")
    print("=" * 60)
    print("\n✅ Build complete!")

if __name__ == '__main__':
    main()
