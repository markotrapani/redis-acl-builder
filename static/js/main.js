/**
 * Main Application Entry Point
 * Modular version of the Redis Enterprise ACL Builder application
 */

// Import all modules
import DOMElements from './core/dom-elements.js';
import Utils from './core/utils.js';
import Storage from './core/storage.js';
import RuleManager from './managers/rule-manager.js';
import CategoryManager from './managers/category-manager.js';
import CommandTester from './components/command-tester.js';
import KeyspaceTester from './components/keyspace-tester.js';
import InteractiveACLBuilder from './components/interactive-acl-builder.js';
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
            
            // Clean up deprecated localStorage keys
            Storage.cleanupDeprecatedKeys();
            
            // Restore saved user data from localStorage
            this.restoreUserData();
            
            // Set up event handlers (including storage persistence)
            EventHandlers.init();
            
            // Initialize interactive ACL builder (three-column layout)
            // Note: InteractiveACLBuilder.init() will handle parsing restored rules
            await InteractiveACLBuilder.init();
            
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
                DOMElements.aclRuleInput.value = savedRule;
                
                // Update character counter and button states
                EventHandlers.updateCharacterCounterProgrammatically(DOMElements.aclRuleInput);
                EventHandlers.updateActionButtonStates(savedRule);
                
                // Store the saved rule for later sync after InteractiveACLBuilder is initialized
                this.savedRuleToSync = savedRule;
            }

            
            // Update test button states for both inputs
            EventHandlers.updateTestButtonStates();

            // Restore Redis version if different from default
            const savedVersion = Storage.loadRedisVersion();
            if (savedVersion === 'redis8') {
                const versionToggle = document.getElementById('versionToggle');
                if (versionToggle && !versionToggle.checked) {
                    versionToggle.checked = true;
                    // Trigger version change event
                    versionToggle.dispatchEvent(new Event('change'));
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
    RuleManager.setRule(rule);
    RuleManager.parseRule();
    // Also sync to interactive builder (same as clicking Submit Changes)
    if (InteractiveACLBuilder.state.isInitialized) {
        InteractiveACLBuilder.syncFromRuleText();
    }
};
window.testCommand = () => CommandTester.testCommand();
window.testKeyspace = () => KeyspaceTester.testKeyspace();
window.CategoryManager = CategoryManager; // Make available for HTML onclick
window.syncRuleToInteractive = () => InteractiveACLBuilder.syncFromRuleText();
window.copyACLRule = () => {
    const aclRuleTextarea = document.getElementById('aclRule');
    if (!aclRuleTextarea) {
        Utils.showNotification('Error: ACL rule text area not found! ❌', 'error');
        return;
    }
    
    const ruleText = aclRuleTextarea.value.trim();
    
    // Check if rule is empty
    if (!ruleText) {
        Utils.showNotification('Cannot copy empty ACL rule! ⚠️', 'warning');
        return;
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
    
    // Check if rule is already empty
    if (!currentRule) {
        Utils.showNotification('ACL rule is already empty! 📝', 'info');
        return;
    }
    
    try {
        // Clear the rule
        aclRuleTextarea.value = '';
        
        // Clear from localStorage
        Storage.saveAclRule('');
        Storage.saveLastGeneratedRule('');
        
        aclRuleTextarea.focus();
        
        // Auto-shrink textarea back to default height
        aclRuleTextarea.style.height = '';
        
        // Reset character counter to 0/500
        const characterCounter = document.getElementById('characterCounter');
        if (characterCounter) {
            characterCounter.textContent = '0/500';
            characterCounter.classList.remove('near-limit', 'at-limit');
        }
        
        // Update button states (should be disabled when empty)
        import('./handlers/event-handlers.js').then(({ default: EventHandlers }) => {
            EventHandlers.updateActionButtonStates('');
        });
        
        // Hide redundancy warnings
        RuleManager.hideRedundancyWarnings();
        
        // Parse the empty rule (skip redundancy analysis for empty rule)
        RuleManager.parseRule(true);
        
        // Sync to interactive builder to update command lists
        if (InteractiveACLBuilder.state.isInitialized) {
            InteractiveACLBuilder.syncFromRuleText();
        }
        
        Utils.showNotification('ACL rule cleared and command lists updated! 💣', 'success');
    } catch (error) {
        console.error('Error clearing ACL rule:', error);
        Utils.showNotification('Error occurred while clearing ACL rule! ❌', 'error');
        // Restore the original rule if there was an error
        aclRuleTextarea.value = currentRule;
    }
};

// Function to check if Quick Examples need scrolling
function checkQuickExamplesScroll() {
    const content = document.querySelector('.rule-examples-content');
    if (!content) {
        console.warn('Quick Examples content not found');
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

// Export for potential module usage
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