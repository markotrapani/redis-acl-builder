const { app, BrowserWindow, nativeImage, dialog, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let pythonProcess = null;
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
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    console.log('✅ Application menu created');
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

    // Check for updates when app starts
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

        // Show dialog to user
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'No Updates Available',
            message: 'You have the latest version!',
            detail: `Current version: ${info.version}`,
            buttons: ['OK']
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('❌ Auto-update error:', err);

        // Show error dialog to user
        dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Update Check Failed',
            message: 'Failed to check for updates',
            detail: err.message || 'An unknown error occurred',
            buttons: ['OK']
        });
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
}

// App lifecycle
app.whenReady().then(async () => {
    console.log('🚀 Redis ACL Builder v2.1.7-beta - Testing unsigned builds for auto-update installation');

    // Set app name (important for macOS - shows in menu bar and About panel)
    app.setName('Redis ACL Builder');

    // Create application menu
    createAppMenu();

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
    // Unlike typical macOS apps, we want to quit completely when window closes
    // since this is a single-window application with a backend server
    app.quit();
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
});

app.on('before-quit', () => {
    stopPythonBackend();
});
