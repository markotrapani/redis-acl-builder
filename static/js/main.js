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
    },

    /**
     * Show notification pop-up
     */
    showNotification(message, type = 'error', duration = 4000) {
        const container = document.getElementById('notificationContainer');
        if (!container) return;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Create message content
        const messageContent = document.createElement('span');
        messageContent.textContent = message;
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close notification');
        
        notification.appendChild(messageContent);
        notification.appendChild(closeBtn);
        
        // Add to container
        container.appendChild(notification);
        
        // Show with animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Auto-remove after duration
        const autoRemove = setTimeout(() => {
            this.removeNotification(notification);
        }, duration);
        
        // Manual close
        closeBtn.addEventListener('click', () => {
            clearTimeout(autoRemove);
            this.removeNotification(notification);
        });
    },

    /**
     * Remove notification with animation
     */
    removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    },

    /**
     * Validate ACL rule syntax according to Redis Enterprise rules
     */
    /**
     * Format version name for display (redis7 -> Redis 7)
     */
    formatVersionName(version) {
        return version.replace(/^redis(\d+)$/, 'Redis $1');
    },

    async validateACLRule(rule) {
        if (!rule || rule.trim() === '') {
            return { valid: true }; // Empty rule is valid
        }

        const trimmedRule = rule.trim();
        const tokens = trimmedRule.split(/\s+/);
        const errors = [];

        // Get valid categories and commands for the current Redis version
        let validCategories = new Set();
        let validCommands = new Set();
        
        try {
            const categoriesData = await API.getCategories(AppState.currentVersion);
            if (categoriesData && categoriesData.categories) {
                // categoriesData.categories is an array, not an object
                validCategories = new Set(categoriesData.categories);
            }
        } catch (error) {
            console.warn('Could not fetch categories for validation, skipping category validation');
        }

        try {
            const commandsArray = await API.getAllCommands(AppState.currentVersion);
            if (commandsArray && Array.isArray(commandsArray)) {
                validCommands = new Set(commandsArray.map(cmd => cmd.toLowerCase()));
            }
        } catch (error) {
            console.warn('Could not fetch commands for validation, skipping command validation');
        }

        for (const token of tokens) {
            if (token === '') continue;

            // Check if token starts with +, -, or ~
            if (token.startsWith('+') || token.startsWith('-')) {
                // Command/category rule: +@category, +command, -@category, -command
                const content = token.slice(1);
                if (content === '') {
                    errors.push(`Invalid operator token: "${token}"\nMissing content after operator`);
                    continue;
                }
                
                // Check for spaces within the token (should not happen after split, but safety check)
                if (content.includes(' ')) {
                    errors.push(`Invalid rule syntax: "${token}"\nNo spaces allowed within operator terms`);
                    continue;
                }
                
                // Validate category syntax (@category)
                if (content.startsWith('@')) {
                    const categoryName = content.slice(1);
                    if (categoryName === '') {
                        errors.push(`Invalid category syntax: "${token}"\nMissing category name after @`);
                    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(categoryName)) {
                        errors.push(`Invalid category syntax: "${token}"\nCategory name must be alphanumeric`);
                    } else if (validCategories.size > 0 && categoryName !== 'all' && !validCategories.has(categoryName)) {
                        errors.push(`Invalid category: "${token}"\nCategory "${categoryName}" does not exist in ${this.formatVersionName(AppState.currentVersion)}`);
                    }
                }
                // Validate command syntax (alphanumeric with special chars for Redis commands)
                else if (!/^[a-zA-Z][a-zA-Z0-9._|-]*$/.test(content)) {
                    errors.push(`Invalid command syntax: "${token}"\nCommand name contains invalid characters`);
                }
                // Check if command exists in Redis (if we have the commands list)
                else if (validCommands.size > 0 && !validCommands.has(content.toLowerCase())) {
                    errors.push(`Invalid command: "${token}"\nCommand "${content}" does not exist in ${this.formatVersionName(AppState.currentVersion)}`);
                }
            }
            else if (token.startsWith('~')) {
                // Keyspace rule: ~pattern
                const pattern = token.slice(1);
                if (pattern === '') {
                    errors.push(`Invalid keyspace token: "${token}"\nMissing pattern after ~`);
                    continue;
                }
                
                // Check for spaces within the pattern
                if (pattern.includes(' ')) {
                    errors.push(`Invalid keyspace syntax: "${token}"\nNo spaces allowed in keyspace patterns`);
                    continue;
                }
                
                // Basic pattern validation (allow alphanumeric, wildcards, colons, etc.)
                if (!/^[a-zA-Z0-9:*?[\]{}._-]+$/.test(pattern)) {
                    errors.push(`Invalid keyspace pattern: "${token}"\nPattern contains invalid characters`);
                }
            }
            else {
                // Invalid token - doesn't start with +, -, or ~
                errors.push(`Invalid rule syntax: "${token}"\nTerms must start with +, -, or ~ operators`);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
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
    },

    /**
     * Get categories for version
     */
    async getCategories(version) {
        const response = await fetch(`/api/categories?version=${version}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    },

    /**
     * Get all commands for version by parsing empty rule
     */
    async getAllCommands(version) {
        const fullRuleResponse = await this.parseRule('+@all', version);
        
        if (fullRuleResponse && fullRuleResponse.grouped_commands) {
            // Extract all commands from all categories
            const allCommands = new Set();
            Object.values(fullRuleResponse.grouped_commands).forEach(commands => {
                commands.forEach(cmd => allCommands.add(cmd));
            });
            return Array.from(allCommands).sort();
        }
        
        return [];
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
        
        // Validate ACL rule syntax first
        const validation = await Utils.validateACLRule(rule);
        console.log('ACL Validation:', rule, validation); // Debug log
        if (!validation.valid) {
            // Show first error in notification
            const firstError = validation.errors[0];
            console.log('Showing notification for:', firstError); // Debug log
            Utils.showNotification(firstError, 'error', 5000);
            
            // Still show in command results for detailed feedback
            if (DOMElements.commandResults) {
                Utils.showMessage(DOMElements.commandResults, `Invalid ACL syntax: ${firstError}`, 'error');
            }
            if (DOMElements.resultsSummary) {
                DOMElements.resultsSummary.style.display = 'none';
            }
            return;
        }
        
        if (DOMElements.commandResults) {
            Utils.showLoading(DOMElements.commandResults);
        }
        
        try {
            const data = await API.parseRule(rule, AppState.currentVersion);
            
            // Update summary
            this.updateResultsSummary(rule, data);
            
            // Display grouped commands
            this.displayGroupedCommands(data.grouped_commands || {});
            
        } catch (error) {
            // Show server error in notification
            Utils.showNotification(`Server error: ${error.message}`, 'error', 5000);
            
            if (DOMElements.commandResults) {
                Utils.showMessage(DOMElements.commandResults, `Error parsing rule: ${error.message}`, 'error');
            }
            if (DOMElements.resultsSummary) {
                DOMElements.resultsSummary.style.display = 'none';
            }
        } finally {
            if (DOMElements.commandResults) {
                Utils.hideLoading(DOMElements.commandResults);
            }
        }
    },

    /**
     * Update results summary display
     */
    updateResultsSummary(rule, data) {
        // Skip if no results summary element (three-column layout doesn't have one)
        if (!DOMElements.resultsSummary) {
            return;
        }
        
        if (rule === '') {
            DOMElements.resultsSummary.innerHTML = `<strong>No ACL rule specified</strong><br>All ${Utils.formatNumber(data.total_available)} commands are blocked by default`;
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
        // Skip if no command results element (three-column layout doesn't have one)
        if (!DOMElements.commandResults) {
            return;
        }
        
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
                    // Also update interactive builder if initialized
                    if (InteractiveACLBuilder.state.isInitialized) {
                        InteractiveACLBuilder.loadAllData().then(async () => {
                            await InteractiveACLBuilder.renderColumns();
                        });
                    }
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

// Interactive ACL Builder - Three Column Interface
const InteractiveACLBuilder = {
    // State management
    state: {
        grantedCommands: new Set(),
        grantedCategories: new Set(),
        blockedCommands: new Set(),
        blockedCategories: new Set(),
        allCategories: [],
        allCommands: [],
        isInitialized: false,
        grantedCommandsCollapsed: true,  // Start collapsed
        blockedCommandsCollapsed: true,  // Start collapsed
        lastGeneratedRule: '',           // Track the last rule we generated
        hasManualChanges: false          // Track if user made manual changes
    },

    // DOM elements for three-column layout
    elements: {
        grantedCategoriesButtons: null,
        grantedCommandsButtons: null,
        blockedCategoriesButtons: null,
        blockedCommandsButtons: null,
        grantedStats: null,
        blockedStats: null,
        ruleStats: null,
        aclRuleInput: null,
        submitChangesBtn: null
    },

    /**
     * Initialize the interactive ACL builder
     */
    async init() {
        console.log('🔧 Initializing Interactive ACL Builder...');
        
        // Initialize DOM elements
        this.elements.grantedCategoriesButtons = document.querySelector('#grantedCategories .category-buttons');
        this.elements.grantedCommandsButtons = document.querySelector('#grantedCommands .command-buttons');
        this.elements.blockedCategoriesButtons = document.querySelector('#blockedCategories .category-buttons');
        this.elements.blockedCommandsButtons = document.querySelector('#blockedCommands .command-buttons');
        this.elements.grantedStats = document.getElementById('grantedStats');
        this.elements.blockedStats = document.getElementById('blockedStats');
        this.elements.ruleStats = document.getElementById('ruleStats');
        this.elements.aclRuleInput = document.getElementById('aclRule');
        this.elements.submitChangesBtn = document.getElementById('submitChangesBtn');

        console.log('📍 DOM Elements found:', {
            grantedCategories: !!this.elements.grantedCategoriesButtons,
            grantedCommands: !!this.elements.grantedCommandsButtons,
            blockedCategories: !!this.elements.blockedCategoriesButtons,
            blockedCommands: !!this.elements.blockedCommandsButtons,
            stats: !!this.elements.grantedStats
        });

        // Check if we have the three-column layout
        if (!this.elements.grantedCategoriesButtons) {
            console.log('❌ Three-column layout not found, skipping interactive initialization');
            return;
        }

        try {
            console.log('📡 Loading categories data...');
            await this.loadAllData();
            console.log('✅ Categories loaded:', this.state.allCategories.length);
            
            console.log('🔧 Initializing default state...');
            this.initializeDefaultState();
            
            console.log('🎨 Rendering columns...');
            await this.renderColumns();
            this.updateRuleText();
            this.updateStats();
            
            // Add event listeners
            this.setupEventListeners();
            
            this.state.isInitialized = true;
            console.log('✅ Interactive ACL Builder initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Interactive ACL Builder:', error);
            // Show error in the UI
            if (this.elements.grantedStats) {
                this.elements.grantedStats.textContent = 'Error loading data';
            }
            if (this.elements.blockedStats) {
                this.elements.blockedStats.textContent = 'Error loading data';
            }
        }
    },

    /**
     * Load all categories and commands data
     */
    async loadAllData() {
        try {
            console.log('📡 Calling API.getCategories for version:', AppState.currentVersion);
            const response = await API.getCategories(AppState.currentVersion);
            console.log('📡 API response:', response);
            
            if (response && response.categories) {
                this.state.allCategories = response.categories.sort();
                console.log('✅ Loaded categories:', this.state.allCategories);
            } else {
                throw new Error('No categories in response');
            }

            // Also load all commands
            console.log('📡 Loading all available commands...');
            this.state.allCommands = await API.getAllCommands(AppState.currentVersion);
            console.log('✅ Loaded all commands:', this.state.allCommands.length);
        } catch (error) {
            console.error('❌ Failed to load categories data:', error);
            // Fallback: use some default categories
            this.state.allCategories = ['read', 'write', 'admin', 'dangerous', 'fast', 'slow', 'keyspace', 'string', 'list', 'hash', 'set', 'sortedset'];
            this.state.allCommands = ['get', 'set', 'del', 'exists', 'keys', 'hget', 'hset', 'lpush', 'sadd', 'zadd', 'flushdb', 'ping'];
            console.log('🔄 Using fallback categories and commands');
        }
    },

    /**
     * Initialize default state (all commands blocked by default)
     */
    initializeDefaultState() {
        // Start with secure default: all commands blocked (empty ACL)
        this.state.grantedCategories.clear();
        this.state.grantedCommands.clear();
        this.state.blockedCategories.clear();
        this.state.blockedCommands.clear();
    },

    /**
     * Grant a category (add to granted)
     */
    async grantCategory(category) {
        this.state.grantedCategories.add(category);
        this.state.blockedCategories.delete(category);
        
        this.scheduleRender();
    },

    /**
     * Toggle a category between granted and blocked
     */
    async toggleCategory(category) {
        const wasGranted = this.state.grantedCategories.has(category);
        
        if (wasGranted) {
            // Move from granted to available (remove from granted)
            this.state.grantedCategories.delete(category);
            this.state.blockedCategories.delete(category);
        } else {
            // Move from blocked to granted
            this.state.blockedCategories.delete(category);
            this.state.grantedCategories.add(category);
        }

        this.scheduleRender();
    },

    /**
     * Grant a command (add to granted)
     */
    async grantCommand(command) {
        this.state.grantedCommands.add(command);
        this.state.blockedCommands.delete(command);
        
        this.scheduleRender();
    },

    /**
     * Toggle a command between granted and blocked
     */
    async toggleCommand(command) {
        const wasGranted = this.state.grantedCommands.has(command);
        
        if (wasGranted) {
            // Move from granted to available (remove from granted)
            this.state.grantedCommands.delete(command);
            this.state.blockedCommands.delete(command);
        } else {
            // Move from blocked to granted
            this.state.blockedCommands.delete(command);
            this.state.grantedCommands.add(command);
        }

        this.scheduleRender();
    },

    /**
     * Render the interactive columns
     */
    async renderColumns() {
        this.renderCategoryButtons();
        await this.renderCommandButtons();
    },

    /**
     * Debounced render to reduce flashing
     */
    debouncedRender: null,
    
    /**
     * Schedule a render with debouncing to reduce visual flashing
     */
    scheduleRender() {
        if (this.debouncedRender) {
            clearTimeout(this.debouncedRender);
        }
        
        this.debouncedRender = setTimeout(() => {
            requestAnimationFrame(async () => {
                await this.smoothRender();
            });
        }, 100); // 100ms debounce for smoother batching
    },

    /**
     * Smooth rendering with fade transitions
     */
    async smoothRender() {
        const containers = [
            this.elements.grantedCategoriesButtons,
            this.elements.grantedCommandsButtons,
            this.elements.blockedCategoriesButtons, 
            this.elements.blockedCommandsButtons
        ].filter(Boolean);

        // Quick fade out only the button containers, not their parents
        containers.forEach(container => {
            container.style.transition = 'opacity 0.1s ease';
            container.style.opacity = '0.5';
        });

        // Wait for fade, then render
        setTimeout(async () => {
            await this.renderColumns();
            this.updateRuleText();
            this.updateStats();

            // Fade back in
            requestAnimationFrame(() => {
                containers.forEach(container => {
                    container.style.opacity = '1';
                });
            });
        }, 80); // Slightly faster
    },

    /**
     * Render category buttons in both columns
     */
    renderCategoryButtons() {
        // Render granted categories
        if (this.elements.grantedCategoriesButtons) {
            this.elements.grantedCategoriesButtons.innerHTML = '';
            if (this.state.grantedCategories.size === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.fontStyle = 'italic';
                message.style.padding = '10px';
                message.textContent = 'No categories granted';
                this.elements.grantedCategoriesButtons.appendChild(message);
            } else {
                Array.from(this.state.grantedCategories).sort().forEach(category => {
                    const button = this.createCategoryButton(category, 'granted');
                    this.elements.grantedCategoriesButtons.appendChild(button);
                });
            }
            
            // Update the granted categories header
            this.updateCategorySectionHeader('granted', this.state.grantedCategories.size);
        }

        // Render available categories as clickable buttons
        if (this.elements.blockedCategoriesButtons) {
            this.elements.blockedCategoriesButtons.innerHTML = '';
            
            // Show all available categories as clickable buttons to grant
            const availableCategories = this.state.allCategories.filter(cat => 
                !this.state.grantedCategories.has(cat) && !this.state.blockedCategories.has(cat)
            );
            
            if (availableCategories.length > 0) {
                availableCategories.sort().forEach(category => {
                    const button = this.createCategoryButton(category, 'available');
                    button.title = `Click to grant @${category} category`;
                    this.elements.blockedCategoriesButtons.appendChild(button);
                });
            }
            
            // Also show explicitly blocked categories
            if (this.state.blockedCategories.size > 0) {
                Array.from(this.state.blockedCategories).sort().forEach(category => {
                    const button = this.createCategoryButton(category, 'blocked');
                    this.elements.blockedCategoriesButtons.appendChild(button);
                });
            }
            
            if (availableCategories.length === 0 && this.state.blockedCategories.size === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.fontStyle = 'italic';
                message.style.padding = '10px';
                message.textContent = 'Click categories below to grant access';
                this.elements.blockedCategoriesButtons.appendChild(message);
            }
            
            // Update the blocked categories header
            const categoryCount = this.state.blockedCategories.size + availableCategories.length;
            this.updateCategorySectionHeader('blocked', categoryCount);
        }
    },

    /**
     * Update category section header with count
     */
    updateCategorySectionHeader(type, count) {
        const sectionId = type === 'granted' ? 'grantedCategories' : 'blockedCategories';
        const section = document.getElementById(sectionId);
        const header = section?.querySelector('h3');
        
        if (header) {
            header.textContent = `Categories ${count > 0 ? `(${count})` : ''}`;
        }
    },

    /**
     * Get all commands that are granted via categories
     */
    async getCommandsGrantedByCategories() {
        if (this.state.grantedCategories.size === 0) {
            return [];
        }
        
        try {
            // Build a rule with just the granted categories to see what commands they include
            const categoryRule = Array.from(this.state.grantedCategories)
                .map(cat => `+@${cat}`)
                .join(' ');
            
            const response = await API.parseRule(categoryRule, AppState.currentVersion);
            if (response && response.grouped_commands) {
                // Extract all commands from all categories
                const commands = new Set();
                Object.values(response.grouped_commands).forEach(categoryCommands => {
                    categoryCommands.forEach(cmd => commands.add(cmd));
                });
                return Array.from(commands);
            }
        } catch (error) {
            console.error('Error getting commands for categories:', error);
        }
        
        return [];
    },

    /**
     * Render command buttons in both columns
     */
    async renderCommandButtons() {
        // Render granted commands
        if (this.elements.grantedCommandsButtons) {
            this.elements.grantedCommandsButtons.innerHTML = '';
            
            // Create collapsible wrapper
            const wrapper = document.createElement('div');
            const isCollapsed = this.state.grantedCommandsCollapsed === true; // Default to collapsed
            
            // Get all commands granted via categories and individual grants
            const grantedViaCategories = await this.getCommandsGrantedByCategories();
            // Filter out explicitly blocked commands from the granted list
            const effectiveGrantedViaCategories = grantedViaCategories.filter(cmd => !this.state.blockedCommands.has(cmd));
            const allGrantedCommands = new Set([...this.state.grantedCommands, ...effectiveGrantedViaCategories]);
            
            if (allGrantedCommands.size === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.fontStyle = 'italic';
                message.style.padding = '10px';
                message.textContent = 'No individual commands granted';
                wrapper.appendChild(message);
            } else {
                // Show all granted commands together (sorted)
                Array.from(allGrantedCommands).sort().forEach(command => {
                    const isViaCategory = effectiveGrantedViaCategories.includes(command);
                    const isIndividual = this.state.grantedCommands.has(command);
                    const button = this.createGrantedCommandButton(command, isViaCategory, isIndividual);
                    wrapper.appendChild(button);
                });
            }
            
            wrapper.className = 'command-buttons-collapsible';
            wrapper.style.display = isCollapsed ? 'none' : 'flex';
            wrapper.style.flexWrap = 'wrap';
            wrapper.style.gap = '6px';
            
            // Create preview row that shows even when collapsed
            if (allGrantedCommands.size > 0) {
                const previewRow = document.createElement('div');
                previewRow.className = 'command-preview-row';
                previewRow.style.display = isCollapsed ? 'flex' : 'none';
                previewRow.style.flexWrap = 'wrap';
                previewRow.style.gap = '6px';
                
                // Show first 6-8 commands as preview
                const previewCommands = Array.from(allGrantedCommands).sort().slice(0, 8);
                previewCommands.forEach(command => {
                    const isViaCategory = effectiveGrantedViaCategories.includes(command);
                    const isIndividual = this.state.grantedCommands.has(command);
                    const button = this.createGrantedCommandButton(command, isViaCategory, isIndividual);
                    button.style.fontSize = '0.75em'; // Slightly smaller for preview
                    previewRow.appendChild(button);
                });
                
                // Add "..." indicator if there are more commands
                if (allGrantedCommands.size > 8) {
                    const moreIndicator = document.createElement('span');
                    moreIndicator.textContent = `+${allGrantedCommands.size - 8} more...`;
                    moreIndicator.style.color = '#666';
                    moreIndicator.style.fontSize = '0.75em';
                    moreIndicator.style.alignSelf = 'center';
                    moreIndicator.style.fontStyle = 'italic';
                    previewRow.appendChild(moreIndicator);
                }
                
                this.elements.grantedCommandsButtons.appendChild(previewRow);
            }
            
            this.elements.grantedCommandsButtons.appendChild(wrapper);
            
            // Update the header to be clickable
            this.updateCommandSectionHeader('granted', allGrantedCommands.size, isCollapsed);
        }

        // Render blocked/available commands
        if (this.elements.blockedCommandsButtons) {
            this.elements.blockedCommandsButtons.innerHTML = '';
            
            // Create collapsible wrapper
            const wrapper = document.createElement('div');
            const isEmptyACL = this.state.grantedCategories.size === 0 && this.state.grantedCommands.size === 0;
            const isCollapsed = this.state.blockedCommandsCollapsed === true; // Default to collapsed
            
            if (isEmptyACL && this.state.allCommands.length > 0) {
                // Show ALL available commands as clickable buttons to grant
                const availableCommands = this.state.allCommands.filter(cmd => 
                    !this.state.grantedCommands.has(cmd) && !this.state.blockedCommands.has(cmd)
                );
                
                if (availableCommands.length > 0) {
                    availableCommands.forEach(command => {
                        const button = this.createCommandButton(command, 'available');
                        button.title = `Click to grant ${command} command`;
                        wrapper.appendChild(button);
                    });
                }
            }
            
            // Always show explicitly blocked commands (in addition to available ones)
            if (this.state.blockedCommands.size > 0) {
                if (!isEmptyACL) {
                    // Add a divider if we're not showing available commands above
                    const divider = document.createElement('div');
                    divider.style.borderTop = '1px solid #555';
                    divider.style.margin = '10px 0';
                    wrapper.appendChild(divider);
                }
                
                Array.from(this.state.blockedCommands).sort().forEach(command => {
                    const button = this.createCommandButton(command, 'blocked');
                    wrapper.appendChild(button);
                });
            }
            
            // Show available commands (truly available - not granted anywhere)
            if (this.state.allCommands.length > 0 && !isEmptyACL) {
                const grantedViaCategories = await this.getCommandsGrantedByCategories();
                const grantedViaCategoriesSet = new Set(grantedViaCategories);
                
                // Only show commands that are NOT granted individually AND NOT granted via categories
                // BUT if a command is granted via categories AND explicitly blocked, don't show it here
                // (it will already be shown in the blocked commands section above)
                const availableCommands = this.state.allCommands.filter(cmd => 
                    !this.state.grantedCommands.has(cmd) && 
                    !this.state.blockedCommands.has(cmd) &&
                    !grantedViaCategoriesSet.has(cmd)
                );
                
                if (availableCommands.length > 0) {
                    if (this.state.blockedCommands.size > 0) {
                        // Add a divider if we have blocked commands above
                        const divider = document.createElement('div');
                        divider.style.borderTop = '1px solid #555';
                        divider.style.margin = '10px 0';
                        wrapper.appendChild(divider);
                    }
                    
                    availableCommands.forEach(command => {
                        const button = this.createCommandButton(command, 'available');
                        button.title = `Click to grant ${command} command`;
                        wrapper.appendChild(button);
                    });
                }
            }
            
            // Show fallback message only if nothing to show
            if (this.state.blockedCommands.size === 0 && 
                (!this.state.allCommands.length || 
                 this.state.allCommands.every(cmd => this.state.grantedCommands.has(cmd)))) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.fontStyle = 'italic';
                message.style.padding = '10px';
                message.textContent = 'No individual commands available';
                wrapper.appendChild(message);
            }
            
            wrapper.className = 'command-buttons-collapsible';
            wrapper.style.display = isCollapsed ? 'none' : 'flex';
            wrapper.style.flexWrap = 'wrap';
            wrapper.style.gap = '6px';
            
            // Create preview row that shows even when collapsed
            const allBlockedAndAvailable = new Set([...this.state.blockedCommands]);
            
            if (this.state.allCommands.length > 0) {
                if (isEmptyACL) {
                    // Empty ACL = all commands are effectively blocked/available for granting
                    this.state.allCommands.forEach(cmd => allBlockedAndAvailable.add(cmd));
                } else {
                    // Non-empty ACL = show truly available commands (not granted anywhere)
                    const grantedViaCategories = await this.getCommandsGrantedByCategories();
                    const grantedViaCategoriesSet = new Set(grantedViaCategories);
                    const availableCommands = this.state.allCommands.filter(cmd => 
                        !this.state.grantedCommands.has(cmd) && 
                        !this.state.blockedCommands.has(cmd) &&
                        !grantedViaCategoriesSet.has(cmd)
                    );
                    availableCommands.forEach(cmd => allBlockedAndAvailable.add(cmd));
                }
            }
            
            if (allBlockedAndAvailable.size > 0) {
                const previewRow = document.createElement('div');
                previewRow.className = 'command-preview-row';
                previewRow.style.display = isCollapsed ? 'flex' : 'none';
                previewRow.style.flexWrap = 'wrap';
                previewRow.style.gap = '6px';
                
                // Show first 8 commands as preview
                const previewCommands = Array.from(allBlockedAndAvailable).sort().slice(0, 8);
                previewCommands.forEach(command => {
                    const isBlocked = this.state.blockedCommands.has(command);
                    const button = this.createCommandButton(command, isBlocked ? 'blocked' : 'available');
                    button.style.fontSize = '0.75em'; // Slightly smaller for preview
                    previewRow.appendChild(button);
                });
                
                // Add "..." indicator if there are more commands
                if (allBlockedAndAvailable.size > 8) {
                    const moreIndicator = document.createElement('span');
                    moreIndicator.textContent = `+${allBlockedAndAvailable.size - 8} more...`;
                    moreIndicator.style.color = '#666';
                    moreIndicator.style.fontSize = '0.75em';
                    moreIndicator.style.alignSelf = 'center';
                    moreIndicator.style.fontStyle = 'italic';
                    previewRow.appendChild(moreIndicator);
                }
                
                this.elements.blockedCommandsButtons.appendChild(previewRow);
            }
            
            this.elements.blockedCommandsButtons.appendChild(wrapper);
            
            // Update the header to be clickable
            // Calculate command count for header - only count truly available commands in blocked section
            const grantedViaCategories = await this.getCommandsGrantedByCategories();
            const grantedViaCategoriesSet = new Set(grantedViaCategories);
            const availableCommands = this.state.allCommands.filter(cmd => 
                !this.state.grantedCommands.has(cmd) && 
                !this.state.blockedCommands.has(cmd) &&
                !grantedViaCategoriesSet.has(cmd)
            );
            const commandCount = this.state.blockedCommands.size + (isEmptyACL ? this.state.allCommands.length : availableCommands.length);
            this.updateCommandSectionHeader('blocked', commandCount, isCollapsed);
        }
    },

    /**
     * Update command section header to be clickable
     */
    updateCommandSectionHeader(type, count, isCollapsed) {
        const sectionId = type === 'granted' ? 'grantedCommands' : 'blockedCommands';
        const section = document.getElementById(sectionId);
        const header = section?.querySelector('h3');
        
        if (header) {
            const arrow = isCollapsed ? '+' : '−';
            const text = type === 'granted' ? 'Individual Commands' : 'Individual Commands';
            header.innerHTML = `${text} ${count > 0 ? `(${count})` : ''} <span style="float: right; font-size: 1.2em; font-weight: bold;">${arrow}</span>`;
            header.style.cursor = 'pointer';
            header.style.userSelect = 'none';
            header.onclick = () => this.toggleCommandSection(type);
        }
    },

    /**
     * Toggle command section visibility
     */
    async toggleCommandSection(type) {
        const isGranted = type === 'granted';
        const currentState = isGranted ? this.state.grantedCommandsCollapsed : this.state.blockedCommandsCollapsed;
        const newState = !currentState;
        
        if (isGranted) {
            this.state.grantedCommandsCollapsed = newState;
        } else {
            this.state.blockedCommandsCollapsed = newState;
        }
        
        // Re-render to update display
        await this.renderCommandButtons();
    },

    /**
     * Create a category button element
     */
    createCategoryButton(category, state) {
        const button = document.createElement('button');
        button.className = `category-button ${state === 'available' ? 'blocked' : state}`;
        button.textContent = `@${category}`;
        
        if (state === 'available') {
            button.title = `Click to grant @${category} category`;
            button.onclick = () => this.grantCategory(category);
        } else {
            button.title = `Click to ${state === 'granted' ? 'revoke' : 'grant'} @${category} category`;
            button.onclick = () => this.toggleCategory(category);
        }
        
        return button;
    },

    /**
     * Create a command button element
     */
    createCommandButton(command, state) {
        const button = document.createElement('button');
        button.className = `command-button ${state === 'available' ? 'blocked' : state}`;
        button.textContent = command;
        
        if (state === 'available') {
            button.title = `Click to grant ${command} command`;
            button.onclick = () => this.grantCommand(command);
        } else {
            button.title = `Click to ${state === 'granted' ? 'revoke' : 'grant'} ${command} command`;
            button.onclick = () => this.toggleCommand(command);
        }
        
        return button;
    },

    /**
     * Create a command button for granted commands (handles commands granted via categories)
     */
    createGrantedCommandButton(command, isViaCategory, isIndividual) {
        const button = document.createElement('button');
        button.className = 'command-button granted';
        button.textContent = command;
        
        // Determine the behavior based on how the command is granted
        if (isIndividual) {
            // If granted individually (even if also via category), use normal toggle
            button.title = `${command} - Click to revoke`;
            button.onclick = () => this.toggleCommand(command);
        } else if (isViaCategory) {
            // If only granted via category, use exclusion behavior
            button.title = `${command} - Click to exclude (granted via category)`;
            button.onclick = () => this.blockCommandFromCategory(command);
        }
        
        return button;
    },

    /**
     * Block a command that was granted via category
     */
    async blockCommandFromCategory(command) {
        // Add to blocked commands to explicitly exclude it
        this.state.blockedCommands.add(command);
        // Make sure it's not in granted commands
        this.state.grantedCommands.delete(command);
        
        this.scheduleRender();
    },

    /**
     * Update the ACL rule text based on current state
     */
    updateRuleText() {
        if (!this.elements.aclRuleInput) return;

        const rule = this.generateOptimizedRule();
        this.elements.aclRuleInput.value = rule;
        
        // Track the rule we just generated
        this.state.lastGeneratedRule = rule;
        this.state.hasManualChanges = false;
        this.hideSubmitButton();
        
        // Trigger change event to update other parts of the app
        this.elements.aclRuleInput.dispatchEvent(new Event('input'));
    },

    /**
     * Generate optimized ACL rule from current state
     */
    generateOptimizedRule() {
        const parts = [];

        // Add granted categories
        Array.from(this.state.grantedCategories).sort().forEach(category => {
            parts.push(`+@${category}`);
        });

        // Add blocked categories
        Array.from(this.state.blockedCategories).sort().forEach(category => {
            parts.push(`-@${category}`);
        });

        // Add granted individual commands
        Array.from(this.state.grantedCommands).sort().forEach(command => {
            parts.push(`+${command}`);
        });

        // Add blocked individual commands
        Array.from(this.state.blockedCommands).sort().forEach(command => {
            parts.push(`-${command}`);
        });

        return parts.join(' ');
    },

    /**
     * Update statistics displays
     */
    updateStats() {
        // Hide all bottom stats for a cleaner interface
        if (this.elements.grantedStats) {
            this.elements.grantedStats.style.display = 'none';
        }

        if (this.elements.blockedStats) {
            this.elements.blockedStats.style.display = 'none';
        }

        if (this.elements.ruleStats) {
            this.elements.ruleStats.style.display = 'none';
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Version changes are handled by the main EventHandlers.init()

        // Listen for manual rule text changes
        if (this.elements.aclRuleInput) {
            this.elements.aclRuleInput.addEventListener('input', 
                Utils.debounce(() => {
                    this.checkForManualChanges();
                }, 300)
            );
        }
    },

    /**
     * Sync manual rule text changes to the interactive display
     */
    async syncFromRuleText() {
        if (!this.elements.aclRuleInput || !this.state.isInitialized) {
            console.log('❌ Cannot sync: not initialized or no rule input');
            return;
        }

        const ruleText = this.elements.aclRuleInput.value.trim();
        console.log('🔄 Syncing rule text to interactive display:', ruleText);

        try {
            // Validate ACL rule syntax first
            const validation = await Utils.validateACLRule(ruleText);
            if (!validation.valid) {
                const firstError = validation.errors[0];
                Utils.showNotification(firstError, 'error', 5000);
                console.log('InteractiveACLBuilder sync validation failed:', firstError);
                return;
            }
            
            // Reset state
            this.state.grantedCategories.clear();
            this.state.grantedCommands.clear();
            this.state.blockedCategories.clear();
            this.state.blockedCommands.clear();

            // Parse the rule text to extract categories and commands
            if (ruleText) {
                const tokens = ruleText.split(/\s+/).filter(token => token.length > 0);
                
                for (const token of tokens) {
                    if (token.startsWith('+@')) {
                        // Granted category
                        const category = token.substring(2);
                        this.state.grantedCategories.add(category);
                    } else if (token.startsWith('-@')) {
                        // Blocked category  
                        const category = token.substring(2);
                        this.state.blockedCategories.add(category);
                    } else if (token.startsWith('+')) {
                        // Granted command
                        const command = token.substring(1);
                        this.state.grantedCommands.add(command);
                    } else if (token.startsWith('-')) {
                        // Blocked command
                        const command = token.substring(1);
                        this.state.blockedCommands.add(command);
                    }
                }
            }

            // Re-render the interactive display
            await this.renderColumns();
            this.updateStats();
            
            // Update tracking state
            this.state.lastGeneratedRule = ruleText;
            this.state.hasManualChanges = false;
            this.hideSubmitButton();
            
            console.log('✅ Rule synced successfully');
            
        } catch (error) {
            console.error('❌ Error syncing rule:', error);
            
            console.log('Error details:', error);
        }
    },

    /**
     * Check if user has made manual changes to the rule text
     */
    checkForManualChanges() {
        if (!this.elements.aclRuleInput) return;
        
        const currentText = this.elements.aclRuleInput.value.trim();
        const hasChanges = currentText !== this.state.lastGeneratedRule;
        
        if (hasChanges !== this.state.hasManualChanges) {
            this.state.hasManualChanges = hasChanges;
            
            if (hasChanges) {
                this.showSubmitButton();
            } else {
                this.hideSubmitButton();
            }
        }
    },

    /**
     * Show the submit changes button
     */
    showSubmitButton() {
        if (this.elements.submitChangesBtn) {
            this.elements.submitChangesBtn.style.display = 'block';
        }
    },

    /**
     * Hide the submit changes button
     */
    hideSubmitButton() {
        if (this.elements.submitChangesBtn) {
            this.elements.submitChangesBtn.style.display = 'none';
        }
    }
};

// Global functions (for onclick handlers in HTML)
window.setRule = (rule) => RuleManager.setRule(rule);
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
        API,
        Utils
    };
}