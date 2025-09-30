/**
 * Main Application Entry Point
 * Modular version of the Redis Enterprise ACL Builder application
 */

// Import all modules
import DOMElements from './core/dom-elements.js';
import Utils from './core/utils.js';
import Storage from './core/storage.js';
import AppState from './core/app-state.js';
import RuleManager from './managers/rule-manager.js';
import CategoryManager from './managers/category-manager.js';
import CommandTester from './components/command-tester.js';
import KeyspaceTester from './components/keyspace-tester.js';
import InteractiveACLBuilder from './components/interactive-acl-builder.js';
import SearchManager from './components/search-manager.js';
import ResizableContainer from './components/resizable-container.js';
import SavedRules from './components/saved-rules.js';
import DragDropPanels from './components/drag-drop-panels.js';
import IntegratedTester from './components/integrated-tester.js';
import EventHandlers from './handlers/event-handlers.js';

// Application main object
const App = {
    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize DOM references
            DOMElements.init();

            // Initialize drag-and-drop panel reordering system early (to prevent pop-in)
            DragDropPanels.init();

            // Clean up deprecated localStorage keys
            Storage.cleanupDeprecatedKeys();

            // Set up event handlers first (needed for version restoration)
            EventHandlers.init();

            // Restore saved user data from localStorage (after event handlers are ready)
            this.restoreUserData();
            
            // Initialize interactive ACL builder (three-column layout)
            // Note: InteractiveACLBuilder.init() will handle parsing restored rules
            await InteractiveACLBuilder.init();

            // Initialize search functionality AFTER interactive builder is ready
            await SearchManager.init();

            // Initialize resizable container system
            ResizableContainer.init();

            // Initialize saved rules system
            SavedRules.init();

            // Initialize integrated command+key tester
            IntegratedTester.initIntegratedTester();

            // Clean up saved rule reference (already handled by init)
            if (this.savedRuleToSync) {
                delete this.savedRuleToSync;
            }
        } catch (error) {
            console.error('Failed to initialize application:', error);
            // Show user-friendly error message
            if (DOMElements.commandResults) {
                Utils.showMessage(DOMElements.commandResults, 
                    'Failed to initialize application. Please refresh the page.', 'error');
            }
        }
    },

    /**
     * Restore user data from localStorage
     */
    restoreUserData() {
        try {
            // Restore ACL rule text
            const savedRule = Storage.loadAclRule();
            if (savedRule && DOMElements.aclRuleInput) {
                // Mark as programmatic update to prevent hiding redundancy warnings
                DOMElements.aclRuleInput.dataset.programmaticUpdate = 'true';
                DOMElements.aclRuleInput.value = savedRule;
                
                // Update character counter and button states
                EventHandlers.updateCharacterCounterProgrammatically(DOMElements.aclRuleInput);
                EventHandlers.updateActionButtonStates();

                // Store the saved rule for later sync after InteractiveACLBuilder is initialized
                this.savedRuleToSync = savedRule;

                // Mark that button states were already initialized during restoration
                this.buttonStatesInitialized = true;
            }

            
            // Update test button states for both inputs
            EventHandlers.updateTestButtonStates();

            // Restore Redis version - toggle state already set by inline script
            const savedVersion = Storage.loadRedisVersion();
            const versionToggle = document.getElementById('versionToggle');

            if (versionToggle) {
                const initialVersion = savedVersion || 'redis7';

                // Update AppState to match the saved/default version
                AppState.currentVersion = initialVersion;

                // Verify toggle state matches (should already be set by inline script)
                const expectedToggleState = initialVersion === 'redis8';
                if (versionToggle.checked !== expectedToggleState) {
                    versionToggle.checked = expectedToggleState;
                }

                // Call performVersionSwitch directly with restoration flag to avoid hiding redundancy warnings
                // This won't cause visual toggle movement since state is already correct
                if (versionToggle.performVersionSwitch) {
                    versionToggle.performVersionSwitch(initialVersion, true); // true = isRestoration
                }
            }

        } catch (error) {
            console.warn('Failed to restore user data:', error);
        }
    }
};

// Global functions (for onclick handlers in HTML)
window.setRule = (rule) => RuleManager.setRule(rule);
window.setRuleAndParse = (rule) => {
    // Add current rule to history before applying the new rule (only if different)
    const aclRuleTextarea = document.getElementById('aclRule');
    if (aclRuleTextarea) {
        const currentRule = aclRuleTextarea.value;
        // Only add to history if the new rule is different from current
        if (currentRule !== rule) {
            Storage.addToHistory(currentRule);
        }
    }

    RuleManager.setRule(rule);
    RuleManager.parseRule();

    // Add the new rule to history after applying it (same as manual commit)
    Storage.addToHistory(rule);

    // Also sync to interactive builder (same as clicking Submit Changes)
    if (InteractiveACLBuilder.state.isInitialized) {
        InteractiveACLBuilder.syncFromRuleText();
    }
};
window.testCommand = () => CommandTester.testCommand();
window.testKeyspace = () => KeyspaceTester.testKeyspace();
window.CategoryManager = CategoryManager; // Make available for HTML onclick
window.syncRuleToInteractive = async () => {
    // Clear any pending input operations to prevent interference with committed rule analysis
    if (window.clearPendingInputOperations) {
        window.clearPendingInputOperations();
    }

    const aclRuleTextarea = document.getElementById('aclRule');
    if (aclRuleTextarea) {
        const newRule = aclRuleTextarea.value;

        // Validate the rule BEFORE saving it to localStorage
        try {
            const validation = await Utils.validateACLRule(Utils.normalizeACLRule(newRule));
            if (!validation.valid) {
                // Rule is invalid - don't save it, show error notification
                const firstError = validation.errors[0];
                Utils.showNotification(firstError, 'error', 5000);
                return; // Exit early without saving or updating button states
            }
        } catch (error) {
            // Validation failed - don't save the rule
            Utils.showNotification('Failed to validate ACL rule', 'error', 5000);
            return;
        }

        // Rule is valid - save it to localStorage
        Storage.addToHistory(newRule);
        Storage.saveAclRule(newRule);

        // Mark as programmatic update to prevent new timeout creation
        aclRuleTextarea.dataset.programmaticUpdate = 'true';

        // Trigger input event to notify SavedRules component AFTER rule is committed
        const inputEvent = new Event('input', { bubbles: true });
        aclRuleTextarea.dispatchEvent(inputEvent);
    }

    // Sync to interactive builder
    return InteractiveACLBuilder.syncFromRuleText();
};
window.getLastGeneratedRule = () => InteractiveACLBuilder.state?.lastGeneratedRule || '';
window.updateInteractiveBuilder = () => {
    if (InteractiveACLBuilder.state.isInitialized) {
        InteractiveACLBuilder.loadAllData().then(() => {
            InteractiveACLBuilder.scheduleRender();
        });
    }
};
window.copyACLRule = () => {
    const aclRuleTextarea = document.getElementById('aclRule');
    if (!aclRuleTextarea) {
        Utils.showNotification('Error: ACL rule text area not found! ❌', 'error');
        return;
    }

    let ruleText = aclRuleTextarea.value.trim();

    // If current text is empty, try to copy the committed rule instead
    if (!ruleText) {
        const committedRule = Storage.loadAclRule();
        if (committedRule && committedRule.trim().length > 0) {
            ruleText = committedRule.trim();
        } else {
            Utils.showNotification('Cannot copy empty ACL rule! ⚠️', 'warning');
            return;
        }
    }
    
    // Check if rule appears to be invalid (basic validation)
    const isInvalid = !ruleText.includes('+') && !ruleText.includes('-') && !ruleText.includes('~');
    
    navigator.clipboard.writeText(ruleText).then(() => {
        if (isInvalid) {
            Utils.showNotification('Warning: ACL rule may be invalid - copied anyway 📋⚠️', 'warning');
        } else {
            Utils.showNotification('ACL rule copied to clipboard! 📋', 'success');
        }
    }).catch(() => {
        try {
            // Fallback for older browsers
            aclRuleTextarea.select();
            const successful = document.execCommand('copy');
            if (successful) {
                if (isInvalid) {
                    Utils.showNotification('Warning: ACL rule may be invalid - copied anyway 📋⚠️', 'warning');
                } else {
                    Utils.showNotification('ACL rule copied to clipboard! 📋', 'success');
                }
            } else {
                Utils.showNotification('Failed to copy ACL rule! ❌', 'error');
            }
        } catch (error) {
            Utils.showNotification('Copy operation not supported by browser! ❌', 'error');
        }
    });
};
window.clearACLRule = () => {
    const aclRuleTextarea = document.getElementById('aclRule');
    if (!aclRuleTextarea) {
        Utils.showNotification('Error: ACL rule text area not found! ❌', 'error');
        return;
    }
    
    const currentRule = aclRuleTextarea.value.trim();
    const committedRule = Storage.loadAclRule();

    // Check if both current text and committed rule are empty AND no history exists
    const hasHistory = Storage.hasHistory();
    if (!currentRule && (!committedRule || committedRule.trim().length === 0) && !hasHistory) {
        Utils.showNotification('ACL rule is already empty! 📝', 'info');
        return;
    }
    
    try {
        // Clear the rule
        aclRuleTextarea.value = '';

        // Clear from localStorage and clear history FIRST
        Storage.saveAclRule('');
        Storage.saveLastGeneratedRule('');
        Storage.clearHistory();

        // Mark as programmatic update to prevent Submit Changes button flash
        aclRuleTextarea.dataset.programmaticUpdate = 'true';

        // Trigger input event to notify SavedRules component AFTER clearing localStorage
        const inputEvent = new Event('input', { bubbles: true });
        aclRuleTextarea.dispatchEvent(inputEvent);
        
        aclRuleTextarea.focus();
        
        // Auto-shrink textarea back to default height
        aclRuleTextarea.style.height = '';
        
        // Reset character counter to 0/500
        const characterCounter = document.getElementById('characterCounter');
        if (characterCounter) {
            characterCounter.textContent = '0/500';
            characterCounter.classList.remove('near-limit', 'at-limit');
        }
        
        // Button states will be updated by InteractiveACLBuilder.syncFromRuleText() below
        
        // Hide redundancy warnings
        RuleManager.hideRedundancyWarnings();
        
        // Parse the empty rule (skip redundancy analysis for empty rule)
        RuleManager.parseRule(true);
        
        // Sync to interactive builder to update command lists
        if (InteractiveACLBuilder.state.isInitialized) {
            InteractiveACLBuilder.syncFromRuleText();
        }
        
        // Show appropriate success message based on what was cleared
        const clearedCurrent = currentRule.length > 0;
        const clearedCommitted = committedRule && committedRule.trim().length > 0;

        let message = 'ACL rule and history cleared! 💣';
        if (!clearedCurrent && !clearedCommitted && hasHistory) {
            message = 'ACL rule history cleared! 💣';
        } else if (!clearedCurrent && clearedCommitted) {
            message = 'Committed ACL rule and history cleared! 💣';
        }

        Utils.showNotification(message, 'success');
    } catch (error) {
        console.error('Error clearing ACL rule:', error);
        Utils.showNotification('Error occurred while clearing ACL rule! ❌', 'error');
        // Restore the original rule if there was an error
        aclRuleTextarea.value = currentRule;
    }
};

// Function to check if ACL Presets need scrolling
function checkQuickExamplesScroll() {
    const content = document.querySelector('.presets-content');
    if (!content) {
        console.warn('ACL Presets content not found');
        return;
    }
    
    // Check if content height exceeds container height with tolerance
    const heightDiff = content.scrollHeight - content.clientHeight;
    const tolerance = 12; // Only show scrollbar if difference is > 12px
    
    if (heightDiff > tolerance) {
        content.classList.add('needs-scroll');
    } else {
        content.classList.remove('needs-scroll');
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Make App accessible globally for cross-module communication
    window.App = App;

    // Expose InteractiveACLBuilder and DragDropPanels for debugging
    window.InteractiveACLBuilder = InteractiveACLBuilder;
    window.DragDropPanels = DragDropPanels;

    App.init();
    // Check scroll need after layout settles
    setTimeout(checkQuickExamplesScroll, 100);
    
    // Monitor for layout changes that might affect scrolling
    const observer = new ResizeObserver(checkQuickExamplesScroll);
    const aclPanel = document.querySelector('.acl-config-panel');
    if (aclPanel) {
        observer.observe(aclPanel);
    }
    
    // Monitor textarea changes (resizing or content changes)
    const textarea = document.getElementById('aclRule');
    if (textarea) {
        textarea.addEventListener('input', checkQuickExamplesScroll);
        textarea.addEventListener('mouseup', checkQuickExamplesScroll); // Manual resize
        // Also observe the textarea itself for size changes
        observer.observe(textarea);
    }
    
    // Monitor submit changes button visibility
    const submitBtn = document.getElementById('submitChangesBtn');
    if (submitBtn) {
        // Watch for style changes (display: none/block)
        const submitObserver = new MutationObserver(checkQuickExamplesScroll);
        submitObserver.observe(submitBtn, { attributes: true, attributeFilter: ['style'] });
    }
    
    // Monitor redundancy warnings visibility
    const redundancyWarnings = document.getElementById('redundancyWarnings');
    if (redundancyWarnings) {
        const warningsObserver = new MutationObserver(checkQuickExamplesScroll);
        warningsObserver.observe(redundancyWarnings, { 
            attributes: true, 
            attributeFilter: ['style'],
            childList: true,
            subtree: true
        });
    }
});

// Function to manually dismiss redundancy warnings
window.dismissRedundancyWarnings = () => {
    const redundancyWarnings = document.getElementById('redundancyWarnings');
    if (redundancyWarnings) {
        redundancyWarnings.style.display = 'none';

        // Show a brief confirmation message
        Utils.showNotification('Redundancy warnings dismissed 👋', 'info');
    }
};

// Global function to reset panel layout to default
window.resetPanelLayout = () => {
    if (window.DragDropPanels && window.DragDropPanels.state.isInitialized) {
        DragDropPanels.resetToDefault();
    } else {
        Utils.showNotification('Panel system not initialized', 'error');
    }
};

// Export for potential module usage
// Expose scroll check function globally for SavedRules component
window.checkQuickExamplesScroll = checkQuickExamplesScroll;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        App,
        RuleManager,
        CommandTester,
        CategoryManager,
        InteractiveACLBuilder,
        Utils
    };
}