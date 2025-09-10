/**
 * Event Handlers
 * Manages all application event listeners and interactions
 */

import AppState from '../core/app-state.js';
import DOMElements from '../core/dom-elements.js';
import RuleManager from '../managers/rule-manager.js';
import CategoryManager from '../managers/category-manager.js';
import CommandTester from '../components/command-tester.js';
import InteractiveACLBuilder from '../components/interactive-acl-builder.js';

const EventHandlers = {
    /**
     * Initialize all event listeners
     */
    init() {
        // ACL rule input with debounced parsing - REMOVED per user request
        // Parsing now only occurs on explicit actions: Submit Changes, button clicks, Quick Examples
        // DOMElements.aclRuleInput.addEventListener('input', 
        //     Utils.debounce(() => RuleManager.parseRule(), 300)
        // );
        
        // Hide optimization suggestions when user starts typing
        DOMElements.aclRuleInput.addEventListener('input', function() {
            RuleManager.hideRedundancyWarnings();
        });
        
        // Version toggle
        DOMElements.versionToggle.addEventListener('change', function() {
            const newVersion = this.checked ? 'redis8' : 'redis7';
            if (AppState.currentVersion !== newVersion) {
                AppState.currentVersion = newVersion;
                
                // Update version detail text
                const commandCount = newVersion === 'redis8' ? '446' : '311';
                DOMElements.versionDetail.textContent = `Redis ${newVersion.slice(-1)} (${commandCount} commands)`;
                
                RuleManager.parseRule(true); // Skip redundancy analysis during version changes
                // Also update interactive builder if initialized
                if (InteractiveACLBuilder.state.isInitialized) {
                    InteractiveACLBuilder.loadAllData().then(async () => {
                        await InteractiveACLBuilder.renderColumns();
                    });
                }
            }
        });
        
        // Test command input
        DOMElements.testCommandInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                CommandTester.testCommand();
            }
        });
        
        // Auto-complete for test command input (basic implementation)
        DOMElements.testCommandInput.addEventListener('input', function() {
            const value = this.value.toLowerCase();
            if (value.length > 2) {
                // Future: Add autocomplete functionality
                this.title = `Type a Redis command like: GET, SET, HGET, ZADD, etc.`;
            }
        });
        
        // Keyboard navigation for category headers
        document.addEventListener('keydown', function(e) {
            if (e.target.classList.contains('category-header') && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const category = e.target.dataset.category;
                if (category) {
                    CategoryManager.toggle(category);
                }
            }
        });
        
        // Global error handler
        window.addEventListener('error', function(e) {
            console.error('Global error:', e.error);
            // Could show user-friendly error message here
        });
        
        // Handle browser back/forward
        window.addEventListener('popstate', function() {
            RuleManager.parseRule(true); // Skip redundancy analysis during navigation
        });
        
        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                // Tab became visible again, could refresh data if needed
            }
        });
    }
};

export default EventHandlers;