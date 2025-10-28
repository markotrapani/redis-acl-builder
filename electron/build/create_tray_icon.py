#!/usr/bin/env python3
"""
Create a custom tray icon optimized for macOS menu bar
- 22x22 pixels (optimal size for macOS menu bar)
- White lock symbol on transparent background
- Clean, professional design that matches our app identity
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_tray_icon():
    # Create a 22x22 image with transparent background
    size = 22
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))  # Transparent background
    draw = ImageDraw.Draw(img)
    
    # Lock design - even smaller to ensure no cutoff
    # Lock body: very small rectangle
    body_x = 8
    body_y = 12
    body_width = 6
    body_height = 5
    
    # Draw lock body
    draw.rectangle([body_x, body_y, body_x + body_width, body_y + body_height], 
                   fill=(255, 255, 255, 255))
    
    # Draw shackle: very small arc with lots of room
    shackle_x = 9
    shackle_y = 5  # Start much higher to avoid cutoff
    shackle_width = 4
    shackle_height = 7  # Taller to ensure full arc
    
    # Draw shackle as a simple arc
    draw.arc([shackle_x, shackle_y, shackle_x + shackle_width, shackle_y + shackle_height], 
             start=0, end=180, fill=(255, 255, 255, 255), width=2)
    
    # Save the icon
    output_path = os.path.join(os.path.dirname(__file__), 'tray-icon.png')
    img.save(output_path, 'PNG')
    print(f"✅ Created white lock tray icon: {output_path}")
    
    return output_path

if __name__ == "__main__":
    create_tray_icon()