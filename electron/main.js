/*
 * Copyright (c) 2025 Marko Trapani
 * Licensed under the MIT License - see LICENSE file for details
 */

const { app, BrowserWindow, nativeImage, dialog, Menu, shell, Tray } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let pythonProcess = null;
let tray = null;  // System tray
const FLASK_PORT = 7381;  // Use 7381 for Electron desktop, 7380 for Docker, 5001 for web dev

// Simple development mode detection
function isDevelopment() {
    // Check if we're running from source (electron/main.js exists) vs packaged
    return fs.existsSync(path.join(__dirname, '..', 'backend', 'app.py'));
}

// Debug build detection - checks if built from a -debug tag
function isDebugBuild() {
    // Check for ELECTRON_DEVTOOLS environment variable (for local development)
    if (process.env.ELECTRON_DEVTOOLS === 'true') {
        return true;
    }

    // Check for .debug-build marker file (created during -debug builds)
    const debugMarkerPath = path.join(__dirname, '.debug-build');
    return fs.existsSync(debugMarkerPath);
}

// Create application menu
function createAppMenu() {
    const isMac = process.platform === 'darwin';
    const isDevMode = isDevelopment();

    const template = [
        // App menu (macOS only)
        ...(isMac ? [{
            label: 'Redis ACL Builder',
            submenu: [
                { role: 'about', label: 'About Redis ACL Builder' },
                { type: 'separator' },
                ...(!isDevMode ? [{
                    label: 'Check for Updates...',
                    click: () => {
                        console.log('🔍 Manual update check requested');
                        isManualUpdateCheck = true;
                        autoUpdater.checkForUpdates();
                    }
                }] : []),
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide', label: 'Hide Redis ACL Builder' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit', label: 'Quit Redis ACL Builder' }
            ]
        }] : []),
        // Edit menu
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        // View menu
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        // Window menu
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ] : [
                    { role: 'close' }
                ])
            ]
        },
        // Help menu
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    accelerator: 'F1',
                    click: () => {
                        shell.openExternal('https://github.com/markotrapani/redis-acl-builder/blob/main/README.md');
                    }
                },
                {
                    label: 'Report Issue',
                    click: () => {
                        shell.openExternal('https://github.com/markotrapani/redis-acl-builder/issues/new');
                    }
                },
                {
                    label: 'View on GitHub',
                    click: () => {
                        shell.openExternal('https://github.com/markotrapani/redis-acl-builder');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    console.log('✅ Application menu created');
}

// Track whether update check was manually triggered by user
let isManualUpdateCheck = false;

// Create system tray icon and menu
function createSystemTray() {
    // In production, icons are in app.asar.unpacked or Resources root
    // In development, icons are in electron/build/
    let iconPath;
    
    if (isDevelopment()) {
        // Development mode: use build directory
        iconPath = path.join(__dirname, 'build',
            process.platform === 'darwin' ? 'icon.icns' :
            process.platform === 'win32' ? 'icon.ico' :
            'icon.png'
        );
    } else {
        // Production mode: use Resources directory
        iconPath = process.resourcesPath
            ? path.join(process.resourcesPath,
                process.platform === 'darwin' ? 'icon.icns' :
                process.platform === 'win32' ? 'icon.ico' :
                'icon.png')
            : path.join(__dirname, '..', '..', 'icon.icns');
    }

    console.log('🔍 Looking for system tray icon at:', iconPath);
    console.log('🔍 __dirname:', __dirname);
    console.log('🔍 process.resourcesPath:', process.resourcesPath);
    
    if (!fs.existsSync(iconPath)) {
        console.error('❌ System tray icon not found:', iconPath);
        // Try fallback location
        const fallbackPath = path.join(__dirname, '..', 'icon.icns');
        if (fs.existsSync(fallbackPath)) {
            console.log('✅ Using fallback icon:', fallbackPath);
            iconPath = fallbackPath;
        } else {
            console.error('❌ Fallback icon also not found - creating tray without icon');
            // Create a simple 16x16 black square as fallback
            const fallbackIcon = nativeImage.createEmpty();
            tray = new Tray(fallbackIcon);
            console.log('✅ System tray created with fallback icon');
            return;
        }
    } else {
        console.log('✅ Found system tray icon:', iconPath);
    }

    // Create tray icon
    let trayIcon;
    
    if (process.platform === 'darwin') {
        // For macOS, create a simple monochrome icon using nativeImage
        // Create a 16x16 black square with transparent background
        const iconSize = 16;
        const buffer = Buffer.alloc(iconSize * iconSize * 4); // RGBA
        
        // Fill with black pixels
        for (let i = 0; i < buffer.length; i += 4) {
            buffer[i] = 0;     // R
            buffer[i + 1] = 0; // G  
            buffer[i + 2] = 0; // B
            buffer[i + 3] = 255; // A (opaque)
        }
        
        // Create a simple pattern - make some pixels transparent
        for (let y = 0; y < iconSize; y++) {
            for (let x = 0; x < iconSize; x++) {
                const index = (y * iconSize + x) * 4;
                // Create a simple border pattern
                if (x < 2 || x >= iconSize - 2 || y < 2 || y >= iconSize - 2) {
                    buffer[index + 3] = 255; // Keep border opaque
                } else if (x >= 4 && x < 12 && y >= 4 && y < 12) {
                    buffer[index + 3] = 0; // Make center transparent
                }
            }
        }
        
        trayIcon = nativeImage.createFromBuffer(buffer, { width: iconSize, height: iconSize });
        trayIcon.setTemplateImage(true);  // Make it a template for better visibility
    } else {
        // For other platforms, use the regular icon
        trayIcon = nativeImage.createFromPath(iconPath);
    }
    
    tray = new Tray(trayIcon);

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Window',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Minimize to Tray',
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    // Set tooltip
    tray.setToolTip('Redis ACL Builder');

    // Show context menu on click
    tray.setContextMenu(contextMenu);

    // Toggle window visibility on tray icon click (macOS behavior)
    if (process.platform === 'darwin') {
        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        });
    } else {
        // On Windows/Linux, show context menu on click
        tray.on('click', () => {
            tray.popUpContextMenu();
        });
    }

    console.log('✅ System tray created');
}

// Configure auto-updater
function setupAutoUpdater() {
    const isDevMode = isDevelopment();

    // Skip auto-update in development mode
    if (isDevMode) {
        console.log('🔧 Development mode: Auto-update disabled');
        return;
    }

    console.log('🔄 Setting up auto-updater...');
    console.log('📦 Current app version:', app.getVersion());

    // Configure updater to use GitHub provider explicitly
    autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'markotrapani',
        repo: 'redis-acl-builder'
    });

    // Disable signature validation for unsigned builds (development/testing)
    // TODO: Remove this once proper code signing is implemented
    process.env.ELECTRON_ENABLE_SECURITY_WARNINGS = 'false';

    autoUpdater.autoDownload = false; // We'll ask user first
    autoUpdater.autoInstallOnAppQuit = true;

    // Allow updates to older versions (in case current version tag doesn't have artifacts)
    autoUpdater.allowDowngrade = true;

    // Check for updates when app starts (silently - no dialog if up to date)
    isManualUpdateCheck = false;
    autoUpdater.checkForUpdates();

    // Auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
        console.log('🔍 Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('✨ Update available:', info.version);

        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `A new version (${info.version}) is available!`,
            detail: 'Would you like to download and install it?',
            buttons: ['Download', 'Later'],
            defaultId: 0,
            cancelId: 1
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.downloadUpdate();
            }
        });
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('✅ App is up to date:', info.version);

        // Only show dialog if user manually requested update check
        if (isManualUpdateCheck) {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'No Updates Available',
                message: 'You have the latest version!',
                detail: `Current version: ${info.version}`,
                buttons: ['OK']
            });
        }

        // Reset flag after check completes
        isManualUpdateCheck = false;
    });

    autoUpdater.on('error', (err) => {
        console.error('❌ Auto-update error:', err);

        // Check if error is due to missing latest.yml (incomplete release)
        const isMissingYamlError = err.message && (
            err.message.includes('Cannot find latest') ||
            err.message.includes('latest-mac.yml') ||
            err.message.includes('latest.yml') ||
            err.message.includes('404')
        );

        if (isMissingYamlError) {
            console.warn('⚠️  Latest release missing auto-update metadata files');
            console.warn('   This usually means the release build is still in progress');
            console.warn('   or the release doesn\'t include installable artifacts.');

            // Silently ignore missing YAML errors on automatic checks
            // Only show user-friendly message if manually triggered
            if (isManualUpdateCheck) {
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'Update Check Unavailable',
                    message: 'Unable to check for updates at this time',
                    detail: 'The latest release may still be building. Please try again later.',
                    buttons: ['OK']
                });
            }
        } else {
            // Only show error dialog for other errors if user manually requested update check
            if (isManualUpdateCheck) {
                dialog.showMessageBox(mainWindow, {
                    type: 'error',
                    title: 'Update Check Failed',
                    message: 'Failed to check for updates',
                    detail: err.message || 'An unknown error occurred',
                    buttons: ['OK']
                });
            }
        }

        // Reset flag after check completes
        isManualUpdateCheck = false;
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
        console.log(`📥 ${message}`);
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('✅ Update downloaded:', info.version);

        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'Update has been downloaded',
            detail: 'The application will restart to install the update.',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
            cancelId: 1
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });
}

// Start Python Flask backend
function startPythonBackend() {
    const projectRoot = path.join(__dirname, '..');
    const isDevMode = isDevelopment();

    console.log('Starting Python backend...');
    console.log('Development mode:', isDevMode);
    console.log('Project root:', projectRoot);

    let command;
    let args = [];
    let cwd = projectRoot;

    if (isDevMode) {
        // DEVELOPMENT MODE: Use venv with Python script
        console.log('📝 Using development mode (venv + Python script)');
        const backendPath = path.join(projectRoot, 'backend', 'app.py');
        console.log('Backend path:', backendPath);

        // Use shell script to activate venv and run Python
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? 'cmd.exe' : '/bin/bash';
        const shellArgs = isWindows
            ? ['/c', `cd ${projectRoot} && venv\\Scripts\\activate && python backend\\app.py`]
            : ['-c', `cd "${projectRoot}" && source venv/bin/activate && python backend/app.py`];

        command = shell;
        args = shellArgs;
    } else {
        // PRODUCTION MODE: Use bundled PyInstaller executable
        console.log('📦 Using production mode (bundled executable)');

        // Path to bundled backend executable inside .app bundle
        // When packaged with electron-builder, resources are in app.asar or app.asar.unpacked
        const backendExecutableName = process.platform === 'win32'
            ? 'redis-acl-builder-backend.exe'
            : 'redis-acl-builder-backend';

        // Try multiple possible locations for the backend executable
        const possiblePaths = [
            // Location when bundled with electron-builder (Resources/dist/)
            path.join(process.resourcesPath, 'dist', 'redis-acl-builder-backend', backendExecutableName),
            // Alternative: Resources root
            path.join(process.resourcesPath, 'redis-acl-builder-backend', backendExecutableName),
            // Fallback: relative to electron directory (for local testing without packaging)
            path.join(projectRoot, 'dist', 'redis-acl-builder-backend', backendExecutableName),
        ];

        let backendExecutable = null;
        for (const execPath of possiblePaths) {
            if (fs.existsSync(execPath)) {
                backendExecutable = execPath;
                console.log('✅ Found backend executable:', execPath);
                break;
            }
        }

        if (!backendExecutable) {
            console.error('❌ ERROR: Could not find bundled backend executable!');
            console.error('Searched paths:', possiblePaths);
            throw new Error('Backend executable not found. Please rebuild the application.');
        }

        command = backendExecutable;
        args = [];
    }

    // Spawn Python process in its own process group for easier cleanup
    pythonProcess = spawn(command, args, {
        env: {
            ...process.env,
            FLASK_PORT: FLASK_PORT.toString(),
            FLASK_ENV: isDevMode ? 'development' : 'production',
            FLASK_DEBUG: isDevMode ? 'True' : 'False'
        },
        cwd: cwd,
        detached: process.platform !== 'win32' // Create process group on Unix systems
    });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[Python] ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python Error] ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
        pythonProcess = null;
    });
}

// Stop Python backend
function stopPythonBackend() {
    if (pythonProcess) {
        console.log('Stopping Python backend...');

        // Kill the entire process tree (parent + all children like Flask reloader)
        // On macOS/Linux, use negative PID to kill process group
        try {
            if (process.platform !== 'win32') {
                process.kill(-pythonProcess.pid, 'SIGTERM');
            } else {
                // On Windows, use taskkill to kill process tree
                spawn('taskkill', ['/pid', pythonProcess.pid, '/T', '/F']);
            }
        } catch (err) {
            console.error('Error killing backend process tree:', err);
            // Fallback to regular kill
            pythonProcess.kill();
        }

        pythonProcess = null;
    }
}

// Create the main window
function createWindow() {
    // Electron window dimensions for optimal layout:
    // Width: 1416px matches web app panel-container width
    // Height: 965px fits header + three-column panels + test sections perfectly
    const PANEL_WIDTH = 1416;
    const PANEL_HEIGHT = 965;

    mainWindow = new BrowserWindow({
        width: PANEL_WIDTH,   // 1416px - matches web app width
        height: PANEL_HEIGHT,  // 965px - perfect fit without scrolling or excess space
        minWidth: PANEL_WIDTH,  // Same as default - prevents resizing smaller than optimal
        minHeight: PANEL_HEIGHT,  // Same as default - prevents resizing smaller than optimal
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            // Set Content Security Policy for security
            webSecurity: true,
            allowRunningInsecureContent: false
        },
        title: 'Redis ACL Builder',
        // Custom title bar for native macOS look
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        trafficLightPosition: process.platform === 'darwin' ? { x: 15, y: 15 } : undefined,
        // Set app icon (platform-specific formats)
        icon: path.join(__dirname, 'build',
            process.platform === 'darwin' ? 'icon.icns' :   // macOS
            process.platform === 'win32' ? 'icon.ico' :      // Windows
            'icon.png'                                        // Linux
        ),
        show: false // Don't show until ready
    });

    // Load the app
    mainWindow.loadURL(`http://localhost:${FLASK_PORT}`);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();

        // Open DevTools in detached mode for debug builds
        if (isDebugBuild()) {
            console.log('🐛 Debug build detected - opening DevTools in separate window');
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Prevent window from closing completely - minimize to tray instead
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            // Show notification that app is minimized to tray
            if (process.platform !== 'darwin' && tray) {
                // On Windows/Linux, use toast notification if available
                tray.setContextMenu(Menu.buildFromTemplate([
                    {
                        label: 'Show Window',
                        click: () => {
                            if (mainWindow) {
                                mainWindow.show();
                                mainWindow.focus();
                            }
                        }
                    },
                    {
                        label: 'Quit',
                        click: () => {
                            app.isQuitting = true;
                            app.quit();
                        }
                    }
                ]));
            }
        }
    });
}

// App lifecycle
app.whenReady().then(async () => {
    console.log('🚀 Redis ACL Builder v2.1.7-beta - Testing unsigned builds for auto-update installation');

    // Set app name (important for macOS - shows in menu bar and About panel)
    app.setName('Redis ACL Builder');

    // Create application menu
    createAppMenu();

    // Create system tray
    createSystemTray();

    // Set dock icon on macOS using larger cropped icon
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, 'build', 'icon-cropped-larger.png');
        if (fs.existsSync(iconPath)) {
            try {
                // Use the larger cropped icon (15% bigger to match dock icon sizes)
                await app.dock.setIcon(iconPath);
                console.log('✅ Dock icon set with larger icon (matches dock size)');
            } catch (err) {
                console.error('❌ Failed to set dock icon:', err.message);
            }
        } else {
            console.warn('⚠️  Icon not found:', iconPath);
        }
    }

    try {
        // Start Python backend
        startPythonBackend();

        // Wait for Flask to initialize (Flask reloader needs time)
        console.log('⏳ Waiting for backend to start...');
        await new Promise(resolve => setTimeout(resolve, 5000));  // Simple 5s wait

        // Create window
        createWindow();

        // Set up auto-updater (after window is created)
        setupAutoUpdater();

        console.log('✅ Application ready!');
    } catch (error) {
        console.error('❌ Failed to start application:', error);
        stopPythonBackend();
        app.quit();
    }
});

// Quit when all windows are closed (including macOS for this single-window app)
app.on('window-all-closed', () => {
    // On macOS, don't quit when all windows are closed - let it run in tray
    // On other platforms, quit when window is closed (but we handle this in window close event)
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Recreate window on macOS when dock icon is clicked
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Cleanup on quit
app.on('will-quit', () => {
    stopPythonBackend();
    if (tray) {
        tray.destroy();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
    stopPythonBackend();
    if (tray) {
        tray.destroy();
    }
});
