# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for Redis ACL Builder Flask backend
#
# This creates a standalone executable that bundles:
# - Python interpreter
# - Flask backend (app.py)
# - All helper modules (data_loader.py, acl_parser.py)
# - All dependencies (Flask, Pydantic, etc.)
# - Frontend assets (HTML, CSS, JS)
#
# Usage:
#   pyinstaller backend/redis-acl-builder.spec
#
# Output:
#   dist/redis-acl-builder - Standalone executable

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Get paths
backend_dir = os.path.abspath(SPECPATH)
project_root = os.path.dirname(backend_dir)
frontend_dir = os.path.join(project_root, 'frontend')

# Set output directory to project root dist/ (for electron-builder)
distpath = os.path.join(project_root, 'dist')

# Collect all frontend assets (templates and static files)
frontend_datas = []

# Add templates
templates_dir = os.path.join(frontend_dir, 'templates')
if os.path.exists(templates_dir):
    for root, dirs, files in os.walk(templates_dir):
        for file in files:
            src = os.path.join(root, file)
            dst_dir = os.path.relpath(root, frontend_dir)
            frontend_datas.append((src, dst_dir))

# Add static files (CSS, JS, images)
static_dir = os.path.join(frontend_dir, 'static')
if os.path.exists(static_dir):
    for root, dirs, files in os.walk(static_dir):
        for file in files:
            src = os.path.join(root, file)
            dst_dir = os.path.relpath(root, frontend_dir)
            frontend_datas.append((src, dst_dir))

# Collect Flask data files (includes Jinja2 templates, etc.)
flask_datas = collect_data_files('flask')
pydantic_datas = collect_data_files('pydantic')

# Collect hidden imports
hidden_imports = [
    'flask',
    'flask_compress',
    'werkzeug',
    'jinja2',
    'click',
    'itsdangerous',
    'pydantic',
    'pydantic_core',
    'annotated_types',
    'typing_extensions',
    'helpers.data_loader',
    'helpers.acl_parser',
    'models.api_models',
]

# Add all pydantic submodules
hidden_imports.extend(collect_submodules('pydantic'))

a = Analysis(
    ['app.py'],
    pathex=[backend_dir],
    binaries=[],
    datas=frontend_datas + flask_datas + pydantic_datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'pytest',
        'unittest',
        'test',
        'tests',
        'tk',
        'tkinter',
        '_tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='redis-acl-builder-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Show console for Flask logs
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='redis-acl-builder-backend',
    distpath=distpath,
)
