/**
 * Main Application Entry Point
 * Modular version of the Redis Enterprise ACL Builder application
 */

// Import all modules
import DOMElements from './core/dom-elements.js';
import Utils from './core/utils.js';
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
            
            // Set up event handlers
            EventHandlers.init();
            
            // Parse initial rule (empty) - skip redundancy analysis on startup
            await RuleManager.parseRule(true);
            
            // Initialize interactive ACL builder (three-column layout)
            await InteractiveACLBuilder.init();
            
            console.log('Redis Enterprise ACL Builder initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            // Show user-friendly error message
            if (DOMElements.commandResults) {
                Utils.showMessage(DOMElements.commandResults, 
                    'Failed to initialize application. Please refresh the page.', 'error');
            }
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

// Quick Examples toggle functionality
window.toggleQuickExamples = () => {
    const header = document.querySelector('.examples-header');
    const content = document.getElementById('quickExamplesContent');
    
    if (!header || !content) return;
    
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    const newState = !isExpanded;
    
    // Update aria-expanded attribute
    header.setAttribute('aria-expanded', newState);
    
    // Toggle collapsed class
    if (newState) {
        content.classList.remove('collapsed');
    } else {
        content.classList.add('collapsed');
    }
    
    // Store preference in localStorage
    localStorage.setItem('quickExamplesExpanded', newState);
};

// Auto-collapse Quick Examples when pushed beyond container floor
const checkQuickExamplesPosition = () => {
    const examplesContainer = document.querySelector('.rule-examples');
    const aclConfigPanel = document.querySelector('.acl-config-panel');
    
    if (!examplesContainer || !aclConfigPanel) return;
    
    const panelRect = aclConfigPanel.getBoundingClientRect();
    const examplesRect = examplesContainer.getBoundingClientRect();
    const content = document.getElementById('quickExamplesContent');
    const header = document.querySelector('.examples-header');
    
    if (!content || !header) return;
    
    // Calculate if examples would be pushed beyond the panel's bottom
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    const panelBottom = panelRect.bottom;
    const examplesBottom = examplesRect.bottom;
    
    // If expanded and the examples extend beyond the panel, auto-collapse
    if (isExpanded && examplesBottom > panelBottom - 20) { // 20px buffer
        header.setAttribute('aria-expanded', 'false');
        content.classList.add('collapsed');
        localStorage.setItem('quickExamplesExpanded', 'false');
    }
};

// Initialize Quick Examples state and monitoring
const initQuickExamples = () => {
    const header = document.querySelector('.examples-header');
    const content = document.getElementById('quickExamplesContent');
    
    if (header && content) {
        // Start with expanded state always (ignore any old saved state for now)
        console.log('Initializing Quick Examples as expanded');
        header.setAttribute('aria-expanded', 'true');
        content.classList.remove('collapsed');
        
        // Clear any old state and set to expanded
        localStorage.setItem('quickExamplesExpanded', 'true');
    }
    
    // TODO: Re-enable auto-collapse feature after fixing overflow detection
    // For now, disabled to ensure basic expand/collapse works correctly
    console.log('Auto-collapse monitoring temporarily disabled');
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    initQuickExamples();
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