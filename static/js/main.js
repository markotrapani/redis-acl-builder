/**
 * Redis ACL Builder - Main JavaScript
 * Handles all client-side interactions and API communication
 */

// Application state
const AppState = {
    currentVersion: 'redis7',
    isLoading: false,
    debounceTimer: null
};

// DOM element references
const DOMElements = {
    aclRuleInput: null,
    resultsSummary: null,
    commandResults: null,
    testCommandInput: null,
    testResult: null,
    versionRadios: null,
    
    // Initialize DOM references
    init() {
        this.aclRuleInput = document.getElementById('aclRule');
        this.resultsSummary = document.getElementById('resultsSummary');
        this.commandResults = document.getElementById('commandResults');
        this.testCommandInput = document.getElementById('testCommand');
        this.testResult = document.getElementById('testResult');
        this.versionRadios = document.querySelectorAll('input[name="version"]');
    }
};

// Utility Functions
const Utils = {
    /**
     * Debounce function to limit API calls
     */
    debounce(func, wait) {
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(AppState.debounceTimer);
                func(...args);
            };
            clearTimeout(AppState.debounceTimer);
            AppState.debounceTimer = setTimeout(later, wait);
        };
    },

    /**
     * Show loading state on element
     */
    showLoading(element) {
        if (element) {
            element.classList.add('loading');
        }
        AppState.isLoading = true;
    },

    /**
     * Hide loading state on element
     */
    hideLoading(element) {
        if (element) {
            element.classList.remove('loading');
        }
        AppState.isLoading = false;
    },

    /**
     * Show message with specified type
     */
    showMessage(element, message, type = 'info') {
        if (!element) return;
        
        const messageClass = type === 'error' ? 'error-message' : 
                           type === 'success' ? 'success-message' :
                           type === 'warning' ? 'warning-message' : 'info-message';
        
        element.innerHTML = `<div class="${messageClass}">${message}</div>`;
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Format number with commas
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
};

// API Communication
const API = {
    /**
     * Make API call with error handling
     */
    async makeCall(endpoint, data) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // Check for API-level errors
            if (result.error) {
                throw new Error(result.message || 'API returned an error');
            }
            
            return result;
        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
    },

    /**
     * Parse ACL rule
     */
    async parseRule(rule, version) {
        return this.makeCall('/api/parse', { rule, version });
    },

    /**
     * Test specific command
     */
    async testCommand(rule, command, version) {
        return this.makeCall('/api/test-command', { rule, command, version });
    },

    /**
     * Validate rule syntax
     */
    async validateRule(rule, version) {
        return this.makeCall('/api/validate-rule', { rule, version });
    },

    /**
     * Search commands
     */
    async searchCommands(pattern, version, limit = 50) {
        return this.makeCall('/api/search-commands', { pattern, version, limit });
    },

    /**
     * Get command info
     */
    async getCommandInfo(command, version) {
        return this.makeCall('/api/command-info', { command, version });
    }
};

// Rule Management
const RuleManager = {
    /**
     * Set rule in textarea and trigger parsing
     */
    setRule(rule) {
        DOMElements.aclRuleInput.value = rule;
        this.parseRule();
    },

    /**
     * Parse current ACL rule
     */
    async parseRule() {
        if (AppState.isLoading) return;
        
        const rule = DOMElements.aclRuleInput.value.trim();
        
        Utils.showLoading(DOMElements.commandResults);
        
        try {
            const data = await API.parseRule(rule, AppState.currentVersion);
            
            // Update summary
            this.updateResultsSummary(rule, data);
            
            // Display grouped commands
            this.displayGroupedCommands(data.grouped_commands || {});
            
        } catch (error) {
            Utils.showMessage(DOMElements.commandResults, `Error parsing rule: ${error.message}`, 'error');
            DOMElements.resultsSummary.style.display = 'none';
        } finally {
            Utils.hideLoading(DOMElements.commandResults);
        }
    },

    /**
     * Update results summary display
     */
    updateResultsSummary(rule, data) {
        if (rule === '') {
            DOMElements.resultsSummary.innerHTML = `<strong>No ACL rule specified</strong><br>All ${Utils.formatNumber(data.total_available)} commands are granted by default (equivalent to +@all)`;
        } else {
            DOMElements.resultsSummary.innerHTML = `<strong>${Utils.formatNumber(data.total_granted)}</strong> of ${Utils.formatNumber(data.total_available)} commands granted`;
            
            if (data.impact_summary) {
                const percentage = data.impact_summary.overall_percentage;
                DOMElements.resultsSummary.innerHTML += ` <span class="text-muted">(${percentage}%)</span>`;
            }
        }
        DOMElements.resultsSummary.style.display = 'block';
    },

    /**
     * Display commands grouped by category
     */
    displayGroupedCommands(groupedCommands) {
        let html = '';
        
        const sortedCategories = Object.keys(groupedCommands).sort();
        
        if (sortedCategories.length === 0) {
            html = '<p class="text-muted" style="text-align: center; padding: 20px;">No commands granted by this rule</p>';
        } else {
            sortedCategories.forEach(category => {
                const commands = groupedCommands[category];
                // Sanitize category name for use as HTML ID
                const safeCategoryId = category.replace(/[^a-zA-Z0-9]/g, '-');
                const categoryId = `category-${safeCategoryId}`;
                const commandsHtml = commands.map(cmd => 
                    `<div class="command-item" title="Command: ${Utils.escapeHtml(cmd.toUpperCase())}">${Utils.escapeHtml(cmd)}</div>`
                ).join('');
                
                html += `
                    <div class="category-section">
                        <div class="category-header" onclick="CategoryManager.toggle('${safeCategoryId}')" role="button" tabindex="0" aria-expanded="true" data-category="${safeCategoryId}">
                            ${Utils.escapeHtml(category)} (${Utils.formatNumber(commands.length)})
                        </div>
                        <div class="category-commands" id="${categoryId}">
                            ${commandsHtml}
                        </div>
                    </div>
                `;
            });
        }
        
        DOMElements.commandResults.innerHTML = html;
    }
};

// Category Management
const CategoryManager = {
    /**
     * Toggle category visibility
     */
    toggle(category) {
        // Sanitize the category for ID lookup
        const safeCategoryId = category.replace(/[^a-zA-Z0-9]/g, '-');
        const element = document.getElementById(`category-${safeCategoryId}`);
        const header = element?.previousElementSibling;
        
        if (element && header) {
            const isCollapsed = element.classList.contains('collapsed');
            element.classList.toggle('collapsed');
            header.classList.toggle('collapsed', !isCollapsed);
            header.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
        }
    },

    /**
     * Expand all categories
     */
    expandAll() {
        document.querySelectorAll('.category-commands.collapsed').forEach(element => {
            element.classList.remove('collapsed');
            const header = element.previousElementSibling;
            if (header) {
                header.classList.remove('collapsed');
                header.setAttribute('aria-expanded', 'true');
            }
        });
    },

    /**
     * Collapse all categories
     */
    collapseAll() {
        document.querySelectorAll('.category-commands:not(.collapsed)').forEach(element => {
            element.classList.add('collapsed');
            const header = element.previousElementSibling;
            if (header) {
                header.classList.add('collapsed');
                header.setAttribute('aria-expanded', 'false');
            }
        });
    }
};

// Command Testing
const CommandTester = {
    /**
     * Test specific command against current rule
     */
    async testCommand() {
        const command = DOMElements.testCommandInput.value.trim();
        const rule = DOMElements.aclRuleInput.value.trim();
        
        if (!command) {
            Utils.showMessage(DOMElements.testResult, 'Please enter a command to test', 'warning');
            DOMElements.testCommandInput.focus();
            return;
        }
        
        if (AppState.isLoading) return;
        
        Utils.showLoading(DOMElements.testResult);
        
        try {
            const data = await API.testCommand(rule, command, AppState.currentVersion);
            
            this.displayTestResult(data);
            
        } catch (error) {
            Utils.showMessage(DOMElements.testResult, `Error testing command: ${error.message}`, 'error');
        } finally {
            Utils.hideLoading(DOMElements.testResult);
        }
    },

    /**
     * Display test result
     */
    displayTestResult(data) {
        const resultClass = data.is_granted ? 'granted' : 'denied';
        const statusIcon = data.is_granted ? '✅' : '❌';
        
        let html = `
            <div class="test-result ${resultClass}">
                <strong>${statusIcon} Command: ${Utils.escapeHtml(data.command)}</strong><br>
                ${Utils.escapeHtml(data.explanation)}
        `;
        
        if (data.categories && data.categories.length > 0) {
            const categoriesHtml = data.categories.map(cat => 
                `<span class="category-tag" title="Category: ${Utils.escapeHtml(cat)}">${Utils.escapeHtml(cat)}</span>`
            ).join('');
            
            html += `
                <div class="command-categories">
                    <strong>Categories:</strong>
                    ${categoriesHtml}
                </div>
            `;
        }
        
        html += '</div>';
        DOMElements.testResult.innerHTML = html;
    }
};

// Event Handlers
const EventHandlers = {
    /**
     * Initialize all event listeners
     */
    init() {
        // ACL rule input with debounced parsing
        DOMElements.aclRuleInput.addEventListener('input', 
            Utils.debounce(() => RuleManager.parseRule(), 300)
        );
        
        // Version selector
        DOMElements.versionRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (AppState.currentVersion !== this.value) {
                    AppState.currentVersion = this.value;
                    RuleManager.parseRule();
                }
            });
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
            RuleManager.parseRule();
        });
        
        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                // Tab became visible again, could refresh data if needed
            }
        });
    }
};

// Application Initialization
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
            
            // Parse initial rule (empty)
            await RuleManager.parseRule();
            
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
window.testCommand = () => CommandTester.testCommand();
window.CategoryManager = CategoryManager; // Make available for HTML onclick

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        App,
        RuleManager,
        CommandTester,
        CategoryManager,
        API,
        Utils
    };
}