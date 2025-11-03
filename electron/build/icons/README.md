# Redis ACL Builder - Icon Assets

This directory contains all icon assets for the Redis ACL Builder desktop application.

## Directory Structure

```
icons/
├── source/          # Source PNG files (high-resolution originals)
├── mac/             # macOS icon files (.icns)
├── win/             # Windows icon files (.ico)
├── linux/           # Linux icon files (.png at various sizes)
└── tray/            # System tray/menu bar icons (all platforms)
```

## Current Files

### Source Files (`source/`)
- `icon.png` - Original icon (59 KB)
- `icon-cropped-larger.png` - Larger cropped version (195 KB)

**Note**: Place new high-resolution PNG files here (1024x1024+ recommended)

### macOS Icons (`mac/`)
- `icon.icns` - macOS icon set (contains multiple sizes from 16x16 to 512x512@2x)

### Windows Icons (`win/`)
- `icon.ico` - Windows icon set (contains multiple sizes: 16x16, 32x32, 48x48, 256x256)

### Linux Icons (`linux/`)
Currently empty. Will contain PNG files at standard sizes:
- 512x512, 256x256, 128x128, 64x64, 32x32, 16x16

### Tray Icons (`tray/`)
- `tray-icon.png` - Current tray icon (116 bytes - very small!)
- `tray-icon.svg` - SVG version for scaling
- `create_tray_icon.py` - Script to generate tray icons

## Adding New Icons

### 1. Place Source Files

Add your new high-resolution PNG files to `source/`:
- `icon-dock-1024.png` - Main application icon (1024x1024+ recommended)
- `icon-tray-template.png` - Simplified tray icon (44x44+ for @2x)

### 2. Generate Platform-Specific Icons

#### macOS (.icns)
```bash
# Using iconutil (macOS built-in)
mkdir icon.iconset
# Create all required sizes (16x16, 32x32, 128x128, 256x256, 512x512, plus @2x)
sips -z 16 16 source/icon-dock-1024.png --out icon.iconset/icon_16x16.png
sips -z 32 32 source/icon-dock-1024.png --out icon.iconset/icon_16x16@2x.png
# ... (repeat for all sizes)
iconutil -c icns icon.iconset -o mac/icon.icns
rm -rf icon.iconset
```

#### Windows (.ico)
```bash
# Using ImageMagick
convert source/icon-dock-1024.png -define icon:auto-resize=256,128,64,48,32,16 win/icon.ico
```

#### Linux (.png)
```bash
# Export at standard sizes
for size in 512 256 128 64 32 16; do
  sips -z $size $size source/icon-dock-1024.png --out linux/icon-${size}.png
done
```

#### Tray Icons
```bash
# macOS (22x22 for menu bar)
sips -z 22 22 source/icon-tray-template.png --out tray/tray-icon-mac.png

# Windows (16x16 for system tray)
sips -z 16 16 source/icon-tray-template.png --out tray/tray-icon-win.png

# Linux (24x24 for system tray)
sips -z 24 24 source/icon-tray-template.png --out tray/tray-icon-linux.png
```

## Transparency Requirements

All icons should have proper alpha channel transparency:
- Use PNG format with transparency
- Avoid white/black backgrounds
- Tray icons should be monochrome for best results (adapts to system theme)

## macOS Tray Icon Template

macOS tray icons should follow the template image specification:
- Name: `*Template.png` suffix
- Style: Monochrome (black shapes on transparent background)
- Size: 22x22 (or 44x44 for @2x retina)
- macOS will automatically invert colors for dark/light mode

## Icon Design Guidelines

### Dock/Application Icon
- **Size**: 1024x1024+ for source
- **Style**: Detailed design with Redis branding
- **Colors**: Redis red (#DC382D) as primary
- **Elements**: Database symbols, security metaphors (shield/lock)
- **Format**: Flat design with subtle gradients

### Tray Icon
- **Size**: 22x22 (macOS), 16x16 (Windows), 24x24 (Linux)
- **Style**: Simplified, high contrast
- **Colors**: Monochrome (adapts to system theme)
- **Elements**: Simple recognizable silhouette
- **Format**: Bold, clean shapes (no fine details)

## Build Integration

The electron-builder configuration references these icons:
- macOS: `icons/mac/icon.icns`
- Windows: `icons/win/icon.ico`
- Linux: `icons/linux/icon-*.png`

See `electron/package.json` for the complete electron-builder configuration.

## Automation Scripts

TODO: Add npm scripts to automate icon generation:
```json
{
  "scripts": {
    "icons:generate": "node scripts/generate-icons.js",
    "icons:tray": "python3 electron/build/icons/tray/create_tray_icon.py"
  }
}
```

## References

- [electron-builder Icons Documentation](https://www.electron.build/icons)
- [macOS Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Windows Icon Guidelines](https://docs.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-design)
