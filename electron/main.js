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
let progressWindow = null;  // Download progress window
let updateDownloadedSuccessfully = false;  // Track if update-downloaded event fired
const FLASK_PORT = 7381;  // Use 7381 for Electron desktop, 7380 for Docker, 5001 for web dev

// File-based logging for debugging auto-updater issues
// NOTE: These will be initialized in app.whenReady() - cannot call app.getPath() before app is ready
let LOG_DIR = null;
let LOG_FILE = null;

// Save original console methods FIRST before any functions are defined
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// Logging utility that writes to both console and file
function log(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    const logLine = `[${timestamp}] [${level}] ${message}\n`;

    // Write to console using ORIGINAL console.log (not the overridden one)
    originalLog(...args);

    // Write to file (append mode) - only if LOG_FILE is initialized
    if (LOG_FILE) {
        try {
            fs.appendFileSync(LOG_FILE, logLine);
        } catch (err) {
            // Use original console.error to avoid recursion
            originalError('Failed to write to log file:', err);
        }
    }
}

// Replace console methods with logging wrappers
console.log = (...args) => {
    originalLog(...args);
    // Only write to file if LOG_FILE is set
    if (LOG_FILE) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        const logLine = `[${timestamp}] [INFO] ${message}\n`;
        try {
            fs.appendFileSync(LOG_FILE, logLine);
        } catch (err) {
            originalError('Failed to write to log file:', err);
        }
    }
};

console.error = (...args) => {
    originalError(...args);
    if (LOG_FILE) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        const logLine = `[${timestamp}] [ERROR] ${message}\n`;
        try {
            fs.appendFileSync(LOG_FILE, logLine);
        } catch (err) {
            originalError('Failed to write to log file:', err);
        }
    }
};

console.warn = (...args) => {
    originalWarn(...args);
    if (LOG_FILE) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        const logLine = `[${timestamp}] [WARN] ${message}\n`;
        try {
            fs.appendFileSync(LOG_FILE, logLine);
        } catch (err) {
            originalError('Failed to write to log file:', err);
        }
    }
};

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
                },
                { type: 'separator' },
                {
                    label: 'Open Log File',
                    click: () => {
                        // Open the log file in Finder
                        shell.showItemInFolder(LOG_FILE);
                    }
                },
                {
                    label: 'View Logs Folder',
                    click: () => {
                        shell.openPath(LOG_DIR);
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
            console.error('❌ Fallback icon also not found - creating tray with programmatic icon');
            // Create a simple 16x16 black square as fallback
            const iconSize = 16;
            const buffer = Buffer.alloc(iconSize * iconSize * 4); // RGBA
            
            // Fill with solid black pixels
            for (let i = 0; i < buffer.length; i += 4) {
                buffer[i] = 0;     // R
                buffer[i + 1] = 0; // G  
                buffer[i + 2] = 0; // B
                buffer[i + 3] = 255; // A (opaque)
            }
            
            const fallbackIcon = nativeImage.createFromBuffer(buffer, { width: iconSize, height: iconSize });
            fallbackIcon.setTemplateImage(true);
            tray = new Tray(fallbackIcon);
            console.log('✅ System tray created with programmatic fallback icon');
            return;
        }
    } else {
        console.log('✅ Found system tray icon:', iconPath);
    }

    // Create tray icon
    let trayIcon;
    
    if (process.platform === 'darwin') {
        // For macOS, use our actual app icon properly resized
        console.log('🔒 Using app icon for tray...');
        const appIconPath = path.join(__dirname, 'build', 'icon.png');
        console.log('🔒 App icon path:', appIconPath);
        
        trayIcon = nativeImage.createFromPath(appIconPath);
        console.log('🔒 App icon loaded, isEmpty:', trayIcon.isEmpty());
        console.log('🔒 App icon size:', trayIcon.getSize());
        
        // Use 22x22 for better visibility in macOS menu bar
        if (!trayIcon.isEmpty()) {
            // Extremely aggressive cropping - assume the actual icon is only in the center 60% of the image
            const originalSize = trayIcon.getSize();
            console.log('🔒 Original icon size:', originalSize);
            
            // Very aggressive crop - use only 60% of the original image
            const cropFactor = 0.6; // Use only 60% of the image (removes 20% padding on each side)
            const cropWidth = Math.floor(originalSize.width * cropFactor);
            const cropHeight = Math.floor(originalSize.height * cropFactor);
            const cropX = Math.floor((originalSize.width - cropWidth) / 2);
            const cropY = Math.floor((originalSize.height - cropHeight) / 2);
            
            console.log('🔒 Aggressive cropping to:', { x: cropX, y: cropY, width: cropWidth, height: cropHeight });
            
            // Crop first, then resize
            const croppedIcon = trayIcon.crop({ x: cropX, y: cropY, width: cropWidth, height: cropHeight });
            trayIcon = croppedIcon.resize({ width: 22, height: 22 });
            console.log('🔒 Aggressively cropped and resized to 22x22 for menu bar');
        } else {
            console.log('🔒 Custom icon failed, falling back to PNG...');
            const pngIconPath = path.join(__dirname, 'build', 'icon.png');
            trayIcon = nativeImage.createFromPath(pngIconPath);
            if (!trayIcon.isEmpty()) {
                trayIcon = trayIcon.resize({ width: 22, height: 22 });
                console.log('🔒 Using PNG fallback, resized to 22x22');
            }
        }
    } else {
        // For other platforms, use the regular icon
        trayIcon = nativeImage.createFromPath(iconPath);
    }
    
    tray = new Tray(trayIcon);

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open ACL Builder',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                    console.log('🔄 Window opened from tray menu');
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

    // Show context menu on tray icon click (all platforms)
    tray.on('click', () => {
        tray.popUpContextMenu();
    });

    console.log('✅ System tray created');
}

// Create download progress window
function createProgressWindow() {
    if (progressWindow) {
        return; // Already exists
    }

    progressWindow = new BrowserWindow({
        width: 500,
        height: 200,
        parent: mainWindow,
        modal: true,
        show: false,
        frame: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Simple HTML for progress display
    const progressHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                    padding: 30px;
                    margin: 0;
                    background: #f5f5f5;
                }
                .container {
                    text-align: center;
                }
                h2 {
                    color: #333;
                    font-size: 18px;
                    margin-bottom: 20px;
                }
                .progress-bar-container {
                    background: #e0e0e0;
                    border-radius: 10px;
                    height: 20px;
                    overflow: hidden;
                    margin-bottom: 15px;
                }
                .progress-bar {
                    background: linear-gradient(90deg, #4CAF50, #45a049);
                    height: 100%;
                    width: 0%;
                    transition: width 0.3s ease;
                }
                .progress-bar.verifying {
                    width: 100%;
                    background: linear-gradient(90deg, #2196F3, #1976D2, #2196F3);
                    background-size: 200% 100%;
                    animation: verifyingAnimation 2s linear infinite;
                }
                @keyframes verifyingAnimation {
                    0% { background-position: 0% 0%; }
                    100% { background-position: 200% 0%; }
                }
                .progress-text {
                    color: #666;
                    font-size: 14px;
                    margin-top: 10px;
                }
                .speed-text {
                    color: #999;
                    font-size: 12px;
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Downloading Update...</h2>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="progressBar"></div>
                </div>
                <div class="progress-text" id="progressText">0%</div>
                <div class="speed-text" id="speedText">Preparing download...</div>
            </div>
        </body>
        </html>
    `;

    progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(progressHTML)}`);

    progressWindow.once('ready-to-show', () => {
        progressWindow.show();
    });

    progressWindow.on('closed', () => {
        progressWindow = null;
    });
}

// Update progress window
function updateProgressWindow(percent, speedMBs) {
    if (!progressWindow) return;

    const roundedPercent = Math.round(percent);

    progressWindow.webContents.executeJavaScript(`
        document.getElementById('progressBar').style.width = '${percent}%';
        document.getElementById('progressText').textContent = '${roundedPercent}%';
        document.getElementById('speedText').textContent = '${speedMBs} MB/s';
    `);
}

// Close progress window (returns a promise that resolves when window is closed)
function closeProgressWindow() {
    return new Promise((resolve) => {
        if (!progressWindow) {
            console.log('✅ No progress window to close');
            resolve();
            return;
        }

        console.log('🔄 Attempting to close progress window...');
        console.log(`   Window destroyed? ${progressWindow.isDestroyed()}`);
        console.log(`   Window closable? ${progressWindow.isClosable()}`);

        // Wait for window to actually close before resolving
        progressWindow.once('closed', () => {
            console.log('✅ Progress window closed successfully');
            progressWindow = null;
            resolve();
        });

        // Listen for close event (happens before 'closed')
        progressWindow.once('close', (event) => {
            console.log('🔔 Progress window close event fired');
        });

        // Try to close the window
        try {
            if (!progressWindow.isDestroyed()) {
                // Use destroy() instead of close() to force immediate closure
                // This bypasses any beforeunload handlers or other blocking
                progressWindow.destroy();
                console.log('✅ Destroy command sent to progress window');
                // Window is destroyed immediately, no need to wait
                progressWindow = null;
                resolve();
            } else {
                console.log('⚠️ Progress window already destroyed');
                progressWindow = null;
                resolve();
            }
        } catch (error) {
            console.error('❌ Error closing progress window:', error);
            progressWindow = null;
            resolve();
        }
    });
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

    // Wrap in try-catch to prevent crashes from auto-updater errors
    try {
        autoUpdater.checkForUpdates();
    } catch (err) {
        console.error('❌ Error during initial update check:', err);
        // Silently ignore - error event handler will handle it
    }

    // Auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
        console.log('🔍 Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('✨ Update available:', info.version);

        // Reset flag when starting a new download
        updateDownloadedSuccessfully = false;

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
                // Create progress window before starting download
                createProgressWindow();
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

        // Close progress window if it's open
        closeProgressWindow();

        // Reset dock progress bar
        if (mainWindow && process.platform === 'darwin') {
            mainWindow.setProgressBar(-1);
        }

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
        const percent = Math.round(progressObj.percent);
        const speedMBs = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2);
        const message = `Download speed: ${speedMBs} MB/s - Downloaded ${percent}%`;
        console.log(`📥 ${message}`);

        // Update progress window (primary UI)
        updateProgressWindow(progressObj.percent, speedMBs);

        // Also update macOS dock progress bar
        if (process.platform === 'darwin' && mainWindow) {
            mainWindow.setProgressBar(progressObj.percent / 100);
        }

        // When download reaches 100%, wait briefly for update-downloaded event
        // If it doesn't fire, force-show the restart dialog
        if (percent === 100) {
            console.log('📦 Download reached 100%');
            console.log(`   progressWindow exists: ${!!progressWindow}`);
            console.log(`   updateDownloadedSuccessfully: ${updateDownloadedSuccessfully}`);
            console.log('   Waiting 10 seconds for update-downloaded event...');

            // Reset flag at start of download
            updateDownloadedSuccessfully = false;

            // Set a timeout to force-show dialog if update-downloaded doesn't fire
            setTimeout(async () => {
                // Only show if update-downloaded event hasn't fired successfully
                if (!updateDownloadedSuccessfully) {
                    console.warn('⚠️ update-downloaded event did not fire, forcing restart dialog');
                    console.log(`   progressWindow exists: ${!!progressWindow}`);

                    // Close progress window if it still exists
                    if (progressWindow) {
                        await closeProgressWindow();
                    }

                    if (mainWindow && process.platform === 'darwin') {
                        mainWindow.setProgressBar(-1);
                    }

                    // Check if mainWindow is still valid
                    if (!mainWindow || mainWindow.isDestroyed()) {
                        console.error('❌ Main window destroyed, cannot show restart dialog');
                        return;
                    }

                    const result = await dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'Update Ready',
                        message: 'Update has been downloaded',
                        detail: 'The application will restart to install the update.',
                        buttons: ['Restart Now', 'Later'],
                        defaultId: 0,
                        cancelId: 1
                    });

                    if (result.response === 0) {
                        console.log('🔄 User chose to restart (forced dialog)');
                        app.isQuitting = true;
                        app.isAutoUpdating = true;
                        setImmediate(() => {
                            try {
                                autoUpdater.quitAndInstall(false, true);
                            } catch (err) {
                                console.error('❌ quitAndInstall failed:', err);
                                app.quit();
                            }
                        });
                    } else {
                        console.log('⏸️ User chose to restart later (forced dialog)');
                    }
                } else {
                    console.log('✅ update-downloaded event fired successfully, skipping timeout fallback');
                }
            }, 10000); // 10 second timeout
        }
    });

    autoUpdater.on('update-downloaded', async (info) => {
        console.log('✅ Update downloaded EVENT FIRED:', info.version);
        console.log('📋 Update info:', JSON.stringify(info, null, 2));

        // Set flag to prevent timeout from showing duplicate dialog
        updateDownloadedSuccessfully = true;

        try {
            // Clear the polling interval since event fired properly
            if (global.verificationPollInterval) {
                clearInterval(global.verificationPollInterval);
                global.verificationPollInterval = null;
                console.log('✅ Cleared polling interval (event fired)');
            }

            // Clear the verification timeout since update succeeded
            if (global.verificationTimeout) {
                clearTimeout(global.verificationTimeout);
                global.verificationTimeout = null;
                console.log('✅ Cleared verification timeout');
            }

            // Close progress window and wait for it to fully close
            console.log('🔄 Closing progress window...');
            await closeProgressWindow();
            console.log('✅ Progress window closed');

            // Reset dock progress bar
            if (mainWindow && process.platform === 'darwin') {
                mainWindow.setProgressBar(-1); // -1 removes the progress bar
                console.log('✅ Dock progress bar reset');
            }

            // Ensure mainWindow exists before showing dialog
            if (!mainWindow || mainWindow.isDestroyed()) {
                console.error('❌ Main window is destroyed or null, cannot show restart dialog');
                return;
            }

            console.log('📋 Showing restart dialog...');

            // Now show the restart dialog (window is guaranteed to be closed)
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Update Ready',
                message: 'Update has been downloaded',
                detail: 'The application will restart to install the update.',
                buttons: ['Restart Now', 'Later'],
                defaultId: 0,
                cancelId: 1
            });

            console.log('✅ Dialog shown, user response:', result.response === 0 ? 'Restart Now' : 'Later');

            if (result.response === 0) {
                // Set flags to allow clean auto-update restart
                app.isQuitting = true;
                app.isAutoUpdating = true;  // Special flag for auto-update flow

                console.log('🔄 User chose to restart, calling quitAndInstall...');

                // Force quit and restart - isSilent=false (show), isForceRunAfter=true (restart immediately)
                setImmediate(() => {
                    autoUpdater.quitAndInstall(false, true);
                });
            } else {
                console.log('⏸️ User chose to restart later');
            }
        } catch (error) {
            console.error('❌ Error in update-downloaded handler:', error);
            console.error('Stack trace:', error.stack);
        }
    });
}

// Start Python Flask backend
function startPythonBackend() {
    const projectRoot = path.join(__dirname, '..');
    const isDevMode = isDevelopment();

    console.log('Starting Python backend...');
    console.log('Development mode:', isDevMode);
    console.log('Project root:', projectRoot);

    // Check if port 7381 is already in use and kill any existing processes
    const { exec } = require('child_process');
    const killCommand = process.platform === 'win32' 
        ? `netstat -ano | findstr :${FLASK_PORT} | for /f "tokens=5" %a in ('more') do taskkill /pid %a /f`
        : `lsof -ti:${FLASK_PORT} | xargs kill -9 2>/dev/null || true`;
    
    console.log(`🔍 Checking port ${FLASK_PORT} and cleaning up any existing processes...`);
    
    exec(killCommand, (error, stdout, stderr) => {
        if (error && !error.message.includes('No matching processes')) {
            console.log('⚠️ Could not clean up existing processes:', error.message);
        } else {
            console.log('✅ Port cleanup completed');
        }
        
        // Wait a moment for processes to fully terminate, then start backend
        setTimeout(() => {
            startBackendProcess();
        }, 500);
    });
}

function startBackendProcess() {
    const projectRoot = path.join(__dirname, '..');
    const isDevMode = isDevelopment();

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
        // Flask/Werkzeug writes INFO logs to stderr, so use console.log instead of console.error
        console.log(`[Python] ${data.toString().trim()}`);
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
            // Keep Python backend running to preserve user state
            console.log('🔄 Window minimized to tray - keeping Python backend running');
            
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

// Comprehensive cleanup function
function cleanupAndExit() {
    console.log('🧹 Cleaning up before exit...');
    
    // Stop Python backend
    stopPythonBackend();
    
    // Destroy tray
    if (tray) {
        tray.destroy();
        tray = null;
    }
    
    // Close all windows
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        if (!window.isDestroyed()) {
            window.destroy();
        }
    });
    
    console.log('✅ Cleanup complete');
}

// Handle all possible termination events
process.on('SIGTERM', () => {
    console.log('📡 Received SIGTERM');

    // Skip cleanup during auto-update - let the updater handle it
    if (app.isAutoUpdating) {
        console.log('⚡ Auto-update in progress - allowing clean termination');
        process.exit(0);
        return;
    }

    console.log('📡 Cleaning up...');
    cleanupAndExit();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📡 Received SIGINT');

    // Skip cleanup during auto-update - let the updater handle it
    if (app.isAutoUpdating) {
        console.log('⚡ Auto-update in progress - allowing clean termination');
        process.exit(0);
        return;
    }

    console.log('📡 Cleaning up...');
    cleanupAndExit();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    cleanupAndExit();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);

    // Don't crash the app for auto-updater errors - these are non-critical
    if (reason && (
        reason.code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' ||
        reason.message?.includes('latest-mac.yml') ||
        reason.message?.includes('Cannot find latest')
    )) {
        console.warn('⚠️ Auto-updater error ignored - app will continue running');
        return;
    }

    // For other unhandled rejections, crash the app
    cleanupAndExit();
    process.exit(1);
});

// App lifecycle
app.whenReady().then(async () => {
    // Initialize logging paths NOW that app is ready
    LOG_DIR = app.getPath('logs');
    LOG_FILE = path.join(LOG_DIR, 'auto-updater.log');

    // Ensure log directory exists
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    console.log('🚀 Redis ACL Builder v2.1.7-beta - Testing unsigned builds for auto-update installation');
    console.log('📝 Log file location:', LOG_FILE);
    console.log('   You can view logs via Help > Open Log File');

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
    } else if (mainWindow && mainWindow.isVisible() === false) {
        // Window exists but is hidden (minimized to tray), restore it
        console.log('🔄 Restoring window from dock click');
        mainWindow.show();
        mainWindow.focus();
    }
});

// Cleanup on quit
app.on('will-quit', () => {
    console.log('📡 App will-quit event - cleaning up...');

    // Skip cleanup during auto-update - let the updater handle it
    if (app.isAutoUpdating) {
        console.log('⚡ Auto-update in progress - skipping cleanup to allow restart');
        return;
    }

    cleanupAndExit();
});

app.on('before-quit', () => {
    console.log('📡 App before-quit event - cleaning up...');
    app.isQuitting = true;

    // Skip cleanup during auto-update - let the updater handle it
    if (app.isAutoUpdating) {
        console.log('⚡ Auto-update in progress - skipping cleanup to allow restart');
        return;
    }

    cleanupAndExit();
});
