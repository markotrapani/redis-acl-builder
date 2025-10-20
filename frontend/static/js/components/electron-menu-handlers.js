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
