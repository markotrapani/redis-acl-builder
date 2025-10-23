/**
 * Electron Menu Handlers
 * Handles IPC communication from Electron main process menu actions
 */

/**
 * Initialize Electron menu handlers (only in Electron environment)
 */
export function initElectronMenuHandlers() {
    // Only setup handlers if running in Electron
    if (!window.electronAPI) {
        console.log('Not running in Electron - menu handlers skipped');
        return;
    }

    console.log('🔧 Setting up Electron menu handlers');

    // Create draggable title bar element for cursor feedback
    createDraggableTitleBar();

    // View menu: Expand All Test Sections
    window.electronAPI.onExpandAllTesters(() => {
        console.log('📤 Expand All Test Sections requested from menu');
        expandAllTestSections();
    });

    // View menu: Collapse All Test Sections
    window.electronAPI.onCollapseAllTesters(() => {
        console.log('📥 Collapse All Test Sections requested from menu');
        collapseAllTestSections();
    });
}

/**
 * Expand all test section panels
 */
function expandAllTestSections() {
    const testSections = document.querySelectorAll('.test-section');

    testSections.forEach(section => {
        // Make sure section is visible
        if (section.style.display === 'none' && section.id !== 'integrated-tester-panel') {
            section.style.display = '';
        }

        // If there's a collapsed class, remove it
        section.classList.remove('collapsed');

        // Store state in localStorage
        if (section.id) {
            localStorage.setItem(`${section.id}-collapsed`, 'false');
        }
    });

    console.log('✅ All test sections expanded');
}

/**
 * Collapse all test section panels
 */
function collapseAllTestSections() {
    const testSections = document.querySelectorAll('.test-section');

    testSections.forEach(section => {
        // Don't collapse the integrated tester if it's currently active
        if (section.id === 'integrated-tester-panel' && section.style.display !== 'none') {
            return;
        }

        // Add collapsed class
        section.classList.add('collapsed');

        // Store state in localStorage
        if (section.id) {
            localStorage.setItem(`${section.id}-collapsed`, 'true');
        }
    });

    console.log('✅ All test sections collapsed');
}

/**
 * Create a draggable title bar element with proper cursor feedback
 * This replaces the CSS pseudo-element approach which can't have cursor styles
 */
function createDraggableTitleBar() {
    const header = document.querySelector('header');
    if (!header) return;

    // Create the draggable title bar div
    const titleBar = document.createElement('div');
    titleBar.className = 'electron-title-bar';
    titleBar.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 60px;
        height: 24px;
        -webkit-app-region: drag;
        z-index: 100;
        cursor: grab;
        pointer-events: auto;
    `;

    // Change cursor to grabbing when actively dragging
    titleBar.addEventListener('mousedown', () => {
        titleBar.style.cursor = 'grabbing';
    });

    titleBar.addEventListener('mouseup', () => {
        titleBar.style.cursor = 'grab';
    });

    // Insert at the beginning of header
    header.insertBefore(titleBar, header.firstChild);

    console.log('✅ Draggable title bar element created');
}
