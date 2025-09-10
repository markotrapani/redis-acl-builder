/**
 * Main Application Entry Point
 * Modular version of the Redis ACL Builder application
 */

// Import all modules
import DOMElements from './core/dom-elements.js';
import Utils from './core/utils.js';
import RuleManager from './managers/rule-manager.js';
import CategoryManager from './managers/category-manager.js';
import CommandTester from './components/command-tester.js';
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
            
            console.log('Redis ACL Builder initialized successfully');
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
window.CategoryManager = CategoryManager; // Make available for HTML onclick
window.syncRuleToInteractive = () => InteractiveACLBuilder.syncFromRuleText();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);

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