/**
 * Integrated Command + Keyspace Tester
 * Provides unified testing of command permission + key pattern access
 */

import API from '../api/api-client.js';
import AppState from '../core/app-state.js';
import InteractiveACLBuilder from './interactive-acl-builder.js';

// DOM element references
let commandPanel, keyspacePanel, integratedPanel;
let commandIntegrateBtn, keyspaceIntegrateBtn, splitModeBtn;
let commandInput, keyspaceInput, integratedCommandInput, integratedKeyInput;
let integratedTestBtn, integratedResultDiv, keyPermissionHint;

// Store auto-dismiss timeout ID
let integratedDismissTimeout = null;

/**
 * Initialize the integrated tester
 */
export function initIntegratedTester() {
    // Get DOM references
    commandPanel = document.getElementById('command-tester-panel');
    keyspacePanel = document.getElementById('keyspace-tester-panel');
    integratedPanel = document.getElementById('integrated-tester-panel');

    commandIntegrateBtn = document.getElementById('command-integrate-btn');
    keyspaceIntegrateBtn = document.getElementById('keyspace-integrate-btn');
    splitModeBtn = document.getElementById('split-mode-btn');

    commandInput = document.getElementById('testCommand');
    keyspaceInput = document.getElementById('testKeyspace');
    integratedCommandInput = document.getElementById('integratedCommand');
    integratedKeyInput = document.getElementById('integratedKey');

    integratedTestBtn = document.getElementById('integrated-test-btn');
    integratedResultDiv = document.getElementById('integratedTestResult');
    keyPermissionHint = document.getElementById('key-permission-hint');

    // Setup event listeners
    if (commandIntegrateBtn) {
        commandIntegrateBtn.addEventListener('click', enterIntegratedMode);
    }

    if (keyspaceIntegrateBtn) {
        keyspaceIntegrateBtn.addEventListener('click', enterIntegratedMode);
    }

    if (splitModeBtn) {
        splitModeBtn.addEventListener('click', exitIntegratedMode);
    }

    if (integratedTestBtn) {
        integratedTestBtn.addEventListener('click', testIntegrated);
    }

    // Enable/disable integrated test button based on input
    if (integratedCommandInput && integratedKeyInput) {
        integratedCommandInput.addEventListener('input', updateIntegratedButtonState);
        integratedKeyInput.addEventListener('input', updateIntegratedButtonState);
    }

    // Restore integrated mode state from localStorage
    restoreIntegratedModeState();
}

/**
 * Enter integrated mode - merge both panels into one
 */
function enterIntegratedMode() {
    if (!commandPanel || !keyspacePanel || !integratedPanel) return;

    // Save state to localStorage
    localStorage.setItem('testerMode', 'integrated');

    // Hide separate panels with fade out
    commandPanel.style.transition = 'opacity 200ms ease-out';
    keyspacePanel.style.transition = 'opacity 200ms ease-out';
    commandPanel.style.opacity = '0';
    keyspacePanel.style.opacity = '0';

    setTimeout(() => {
        commandPanel.style.display = 'none';
        keyspacePanel.style.display = 'none';

        // Show integrated panel with fade in
        integratedPanel.style.display = 'block';
        integratedPanel.style.opacity = '0';
        integratedPanel.style.transition = 'opacity 300ms ease-in';

        // Copy current values from separate panels
        if (commandInput && integratedCommandInput) {
            integratedCommandInput.value = commandInput.value;
        }
        if (keyspaceInput && integratedKeyInput) {
            integratedKeyInput.value = keyspaceInput.value;
        }

        // Check if current ACL has key permissions
        checkForKeyPermissions();

        // Update button state
        updateIntegratedButtonState();

        // Trigger fade in
        setTimeout(() => {
            integratedPanel.style.opacity = '1';

            // Clear inline styles after animation completes to prevent interference with drag-drop
            setTimeout(() => {
                integratedPanel.style.transition = '';
                integratedPanel.style.opacity = '';
                integratedPanel.style.display = '';
            }, 300);
        }, 10);
    }, 200);
}

/**
 * Exit integrated mode - split back to separate panels
 */
function exitIntegratedMode() {
    if (!commandPanel || !keyspacePanel || !integratedPanel) return;

    // Save state to localStorage
    localStorage.setItem('testerMode', 'split');

    // Fade out integrated panel
    integratedPanel.style.transition = 'opacity 200ms ease-out';
    integratedPanel.style.opacity = '0';

    setTimeout(() => {
        integratedPanel.style.display = 'none';

        // Copy values back to separate panels
        if (integratedCommandInput && commandInput) {
            commandInput.value = integratedCommandInput.value;
        }
        if (integratedKeyInput && keyspaceInput) {
            keyspaceInput.value = integratedKeyInput.value;
        }

        // Show separate panels with fade in
        commandPanel.style.display = 'block';
        keyspacePanel.style.display = 'block';
        commandPanel.style.opacity = '0';
        keyspacePanel.style.opacity = '0';
        commandPanel.style.transition = 'opacity 300ms ease-in';
        keyspacePanel.style.transition = 'opacity 300ms ease-in';

        // Clear integrated result
        if (integratedResultDiv) {
            integratedResultDiv.textContent = '';
        }

        // Enable split tester buttons if there's prefilled data
        updateSplitButtonStates();

        // Trigger fade in
        setTimeout(() => {
            commandPanel.style.opacity = '1';
            keyspacePanel.style.opacity = '1';

            // Clear inline styles after animation completes to prevent interference with drag-drop
            setTimeout(() => {
                commandPanel.style.transition = '';
                commandPanel.style.opacity = '';
                commandPanel.style.display = '';
                keyspacePanel.style.transition = '';
                keyspacePanel.style.opacity = '';
                keyspacePanel.style.display = '';
            }, 300);
        }, 10);
    }, 200);
}

/**
 * Test command + key access together
 */
async function testIntegrated() {
    if (!integratedCommandInput || !integratedKeyInput || !integratedResultDiv) return;

    const command = integratedCommandInput.value.trim();
    const key = integratedKeyInput.value.trim();
    const rule = InteractiveACLBuilder.getLastValidRule();

    if (!command || !key) {
        showIntegratedResult({
            is_allowed: false,
            command: command || '(empty)',
            key: key || '(empty)',
            reason: 'Both command and key are required',
            command_granted: false,
            key_access_granted: false,
            command_categories: []
        }, true);
        return;
    }

    try {
        const result = await API.testCommandKey(rule, command, key, AppState.currentVersion, AppState.currentMode);
        showIntegratedResult(result, false);
    } catch (error) {
        showIntegratedResult({
            is_allowed: false,
            command: command,
            key: key,
            reason: `Error: ${error.message}`,
            command_granted: false,
            key_access_granted: false,
            command_categories: []
        }, true);
    }
}

/**
 * Display integrated test result
 */
function showIntegratedResult(result, isError) {
    if (!integratedResultDiv) return;

    const statusClass = result.is_allowed ? 'success' : 'error';
    const statusIcon = result.is_allowed ? '✅' : '❌';
    const statusText = result.is_allowed ? 'ACCESS GRANTED' : 'ACCESS DENIED';

    // Clear previous content
    integratedResultDiv.textContent = '';

    // Create main result div
    const resultDiv = document.createElement('div');
    resultDiv.className = `integrated-result test-result ${statusClass}`;
    resultDiv.style.opacity = '0';
    resultDiv.style.transform = 'scale(0.95)';

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'test-result-close';
    closeBtn.onclick = dismissIntegratedResult;
    closeBtn.setAttribute('aria-label', 'Dismiss result');
    closeBtn.textContent = '✕';
    resultDiv.appendChild(closeBtn);

    // Create header
    const header = document.createElement('h4');
    header.className = 'result-header';
    header.textContent = `${statusIcon} ${statusText}`;
    resultDiv.appendChild(header);

    if (!isError) {
        // Show detailed breakdown
        const breakdownDiv = document.createElement('div');
        breakdownDiv.className = 'breakdown';

        // Command permission check item
        const commandCheckItem = document.createElement('div');
        commandCheckItem.className = `check-item ${result.command_granted ? 'pass' : 'fail'}`;

        commandCheckItem.appendChild(document.createTextNode(result.command_granted ? '✅ ' : '❌ '));

        const commandStrong = document.createElement('strong');
        commandStrong.textContent = 'Command Permission:';
        commandCheckItem.appendChild(commandStrong);

        commandCheckItem.appendChild(document.createTextNode(` ${result.command}`));

        if (result.command_categories && result.command_categories.length > 0) {
            commandCheckItem.appendChild(document.createElement('br'));
            const categoriesSmall = document.createElement('small');
            categoriesSmall.className = 'categories';
            categoriesSmall.textContent = `Categories: ${result.command_categories.join(', ')}`;
            commandCheckItem.appendChild(categoriesSmall);
        }

        breakdownDiv.appendChild(commandCheckItem);

        // Key access check item
        const keyCheckItem = document.createElement('div');
        keyCheckItem.className = `check-item ${result.key_access_granted ? 'pass' : 'fail'}`;

        keyCheckItem.appendChild(document.createTextNode(result.key_access_granted ? '✅ ' : '❌ '));

        const keyStrong = document.createElement('strong');
        keyStrong.textContent = 'Key Access:';
        keyCheckItem.appendChild(keyStrong);

        keyCheckItem.appendChild(document.createTextNode(` ${result.key}`));

        if (result.matched_pattern) {
            keyCheckItem.appendChild(document.createElement('br'));
            const patternSmall = document.createElement('small');
            patternSmall.className = 'pattern-match';
            patternSmall.appendChild(document.createTextNode('Pattern: '));

            const patternCode = document.createElement('code');
            patternCode.textContent = result.matched_pattern;
            patternSmall.appendChild(patternCode);

            patternSmall.appendChild(document.createTextNode(' '));

            const permissionBadge = document.createElement('span');
            permissionBadge.className = `permission-badge ${result.permission_type}`;
            permissionBadge.textContent = `(${formatPermissionType(result.permission_type)})`;
            patternSmall.appendChild(permissionBadge);

            keyCheckItem.appendChild(patternSmall);
        }

        breakdownDiv.appendChild(keyCheckItem);
        resultDiv.appendChild(breakdownDiv);
    }

    // Add explanation
    const explanationDiv = document.createElement('div');
    explanationDiv.className = 'explanation';
    explanationDiv.textContent = result.reason;
    resultDiv.appendChild(explanationDiv);

    integratedResultDiv.appendChild(resultDiv);

    // Trigger fade-in animation
    setTimeout(() => {
        const resultEl = integratedResultDiv.querySelector('.integrated-result');
        if (resultEl) {
            resultEl.style.transition = 'opacity 300ms ease-in, transform 300ms ease-in';
            resultEl.style.opacity = '1';
            resultEl.style.transform = 'scale(1)';
        }
    }, 10);

    // Clear any existing auto-dismiss timeout
    if (integratedDismissTimeout) {
        clearTimeout(integratedDismissTimeout);
    }

    // Auto-dismiss after 15 seconds (longer than split testers due to more content)
    integratedDismissTimeout = setTimeout(() => {
        dismissIntegratedResult();
        integratedDismissTimeout = null;
    }, 15000);
}

/**
 * Dismiss the integrated test result
 */
function dismissIntegratedResult() {
    if (!integratedResultDiv) return;

    // Clear the auto-dismiss timeout if manually dismissing
    if (integratedDismissTimeout) {
        clearTimeout(integratedDismissTimeout);
        integratedDismissTimeout = null;
    }

    // Add dismissing class for fade-out animation
    integratedResultDiv.classList.add('dismissing');

    // Remove after animation completes
    setTimeout(() => {
        integratedResultDiv.textContent = '';
        integratedResultDiv.classList.remove('dismissing');
    }, 400);
}

// Make dismissIntegratedResult globally available for onclick handler
window.dismissIntegratedResult = dismissIntegratedResult;

/**
 * Format permission type for display
 */
function formatPermissionType(permissionType) {
    const typeMap = {
        'read-only': '%R~ read-only',
        'write-only': '%W~ write-only',
        'read-write': '~ read-write'
    };
    return typeMap[permissionType] || permissionType;
}

/**
 * Check if current ACL rule contains key permissions
 */
function checkForKeyPermissions() {
    const rule = AppState.currentACLRule || '';
    const hasKeyPermissions = rule.includes('%R~') || rule.includes('%W~') || rule.includes('%RW~');

    if (keyPermissionHint) {
        keyPermissionHint.style.display = hasKeyPermissions ? 'block' : 'none';
    }
}

/**
 * Update integrated test button enabled/disabled state
 */
function updateIntegratedButtonState() {
    if (!integratedTestBtn || !integratedCommandInput || !integratedKeyInput) return;

    const hasCommand = integratedCommandInput.value.trim().length > 0;
    const hasKey = integratedKeyInput.value.trim().length > 0;

    integratedTestBtn.disabled = !hasCommand || !hasKey;
}

/**
 * Check for key permissions when ACL rule changes
 * This should be called from the main rule parsing logic
 */
export function updateKeyPermissionHint() {
    if (integratedPanel && integratedPanel.style.display !== 'none') {
        checkForKeyPermissions();
    }
}

/**
 * Restore integrated/split mode state from localStorage
 * Note: Display switching is handled by inline script in HTML to prevent flash
 */
function restoreIntegratedModeState() {
    const savedMode = localStorage.getItem('testerMode');

    if (savedMode === 'integrated') {
        // Display is already set by inline script - just update state
        if (integratedPanel) {
            // Check for key permissions
            checkForKeyPermissions();

            // Update button state
            updateIntegratedButtonState();
        }
    } else {
        // Default to split mode - ensure buttons are enabled if data is prefilled
        setTimeout(() => {
            updateSplitButtonStates();
        }, 100);
    }
}

/**
 * Update split tester button states based on prefilled data
 */
function updateSplitButtonStates() {
    // Update command tester button (select by class since it has no ID)
    const commandTestBtn = document.querySelector('.command-test-button');
    if (commandTestBtn && commandInput) {
        commandTestBtn.disabled = commandInput.value.trim().length === 0;
    }

    // Update keyspace tester button (select by class since it has no ID)
    const keyspaceTestBtn = document.querySelector('.keyspace-test-button');
    if (keyspaceTestBtn && keyspaceInput) {
        keyspaceTestBtn.disabled = keyspaceInput.value.trim().length === 0;
    }
}

export default {
    initIntegratedTester,
    updateKeyPermissionHint
};
