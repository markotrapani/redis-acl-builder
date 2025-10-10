/**
 * Utility Functions
 * Common utility functions used throughout the application
 */

import AppState from './app-state.js';

const Utils = {
    // Store timeout IDs per container to allow cleanup
    _dismissTimeouts: new WeakMap(),

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

        element.textContent = '';
        const div = document.createElement('div');
        div.className = messageClass;
        div.textContent = message;
        element.appendChild(div);
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
        
        // Create message content with token truncation
        const messageContent = document.createElement('span');
        
        // Truncate long tokens in error messages (tokens in quotes over 13 characters)
        let processedMessage = message.replace(/"([^"]{14,})"/g, (match, token) => {
            return `"${token.substring(0, 10)}..."`;
        });
        
        messageContent.textContent = processedMessage;
        
        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = '×';
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
     * Format version name for display (redis7 -> Redis 7)
     */
    formatVersionName(version) {
        return version.replace(/^redis(\d+)$/, 'Redis $1');
    },

    /**
     * Validate ACL rule syntax according to Redis Enterprise rules
     * Supports Redis 7.0+ selectors (parentheses grouping)
     */
    async validateACLRule(rule) {
        if (!rule || rule.trim() === '') {
            return { valid: true }; // Empty rule is valid
        }

        const trimmedRule = rule.trim();
        const errors = [];

        // Validate parentheses (for selectors) FIRST
        let depth = 0;
        let lastOpen = -1;

        for (let i = 0; i < trimmedRule.length; i++) {
            const char = trimmedRule[i];

            if (char === '(') {
                if (depth > 0) {
                    errors.push('Nested selectors are not allowed');
                    break;
                }
                depth++;
                lastOpen = i;
            } else if (char === ')') {
                depth--;
                if (depth < 0) {
                    errors.push(`Unmatched closing parenthesis at position ${i}`);
                    depth = 0; // Reset to continue checking
                }
                // Check for empty selector
                if (lastOpen >= 0 && i - lastOpen <= 1) {
                    errors.push('Empty selectors are not allowed');
                }
            }
        }

        if (depth > 0) {
            errors.push('Unmatched opening parenthesis');
        }

        // If parentheses errors exist, return early
        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // Tokenize by splitting on whitespace, but preserve parentheses as separate tokens
        const tokens = trimmedRule.split(/\s+/);

        // Get valid categories and commands for the current Redis version
        let validCategories = new Set();
        let validCommands = new Set();
        
        try {
            // Import API dynamically to avoid circular dependencies
            const { default: API } = await import('../api/api-client.js');
            const categoriesData = await API.getCategories(AppState.currentVersion);
            if (categoriesData && categoriesData.categories) {
                // categoriesData.categories is an array, not an object
                validCategories = new Set(categoriesData.categories);
            }
        } catch (error) {
            console.warn('Could not fetch categories for validation, skipping category validation');
        }

        try {
            // Import API dynamically to avoid circular dependencies
            const { default: API } = await import('../api/api-client.js');
            const commandsArray = await API.getAllCommands(AppState.currentVersion);
            if (commandsArray && Array.isArray(commandsArray)) {
                validCommands = new Set(commandsArray.map(cmd => cmd.toLowerCase()));
            }
        } catch (error) {
            console.warn('Could not fetch commands for validation, skipping command validation');
        }

        // Parse selectors and extract tokens for validation
        // Selectors are marked with parentheses: (+@read -get)
        let selectorNumber = 0;
        let inSelector = false;

        for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token === '') continue;

            // Track when we enter/exit selectors
            if (token === '(' || token.startsWith('(')) {
                selectorNumber++;
                inSelector = true;
                // Strip opening parenthesis and continue processing
                if (token === '(') continue;
                token = token.substring(1);
            }

            if (token === ')' || token.endsWith(')')) {
                inSelector = false;
                // Strip closing parenthesis and continue processing
                if (token === ')') continue;
                token = token.substring(0, token.length - 1);
            }

            // Now validate the token (with selector context)
            const contextPrefix = inSelector ? `Selector #${selectorNumber}: ` : '';

            if (token === '') continue;

            // Check if token starts with +, -, or ~
            if (token.startsWith('+') || token.startsWith('-')) {
                // Command/category rule: +@category, +command, -@category, -command
                const content = token.slice(1);
                if (content === '') {
                    errors.push(`${contextPrefix}Invalid operator token: "${token}" - Missing content after operator`);
                    continue;
                }

                // Check for spaces within the token (should not happen after split, but safety check)
                if (content.includes(' ')) {
                    errors.push(`${contextPrefix}Invalid rule syntax: "${token}" - No spaces allowed within operator terms`);
                    continue;
                }

                // Validate category syntax (@category)
                if (content.startsWith('@')) {
                    const categoryName = content.slice(1);
                    if (categoryName === '') {
                        errors.push(`${contextPrefix}Invalid category syntax: "${token}"- Missing category name after @`);
                    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(categoryName)) {
                        errors.push(`${contextPrefix}Invalid category syntax: "${token}"- Category name must be alphanumeric`);
                    } else if (validCategories.size > 0 && categoryName !== 'all' && !validCategories.has(categoryName)) {
                        errors.push(`${contextPrefix}Unknown category: ${categoryName}`);
                    }
                }
                // Validate command syntax (alphanumeric with special chars for Redis commands)
                else if (!/^[a-zA-Z][a-zA-Z0-9._|-]*$/.test(content)) {
                    errors.push(`${contextPrefix}Invalid command syntax: "${token}" - Command name contains invalid characters`);
                }
                // Check if command exists in Redis (if we have the commands list)
                else if (validCommands.size > 0 && !validCommands.has(content.toLowerCase())) {
                    errors.push(`${contextPrefix}Invalid command: "${token}" - Command "${content}" does not exist in ${this.formatVersionName(AppState.currentVersion)}`);
                }
            }
            else if (token.startsWith('~') || token.startsWith('%')) {
                // Keyspace rule: ~pattern, %R~pattern, %W~pattern, %RW~pattern
                let pattern;

                // Parse key permission prefix
                if (token.startsWith('%R~')) {
                    pattern = token.slice(3); // Read-only
                } else if (token.startsWith('%W~')) {
                    pattern = token.slice(3); // Write-only
                } else if (token.startsWith('%RW~')) {
                    pattern = token.slice(4); // Read-write
                } else if (token.startsWith('~')) {
                    pattern = token.slice(1); // Traditional read-write
                } else {
                    // Invalid % prefix (must be %R~, %W~, or %RW~)
                    errors.push(`${contextPrefix}Invalid key permission syntax: "${token}" - Use %R~, %W~, %RW~, or ~`);
                    continue;
                }

                if (pattern === '') {
                    errors.push(`${contextPrefix}Invalid keyspace syntax: "${token}" - Missing pattern after key permission prefix`);
                    continue;
                }

                // Check for spaces within the pattern
                if (pattern.includes(' ')) {
                    errors.push(`${contextPrefix}Invalid keyspace syntax: "${token}" - No spaces allowed in keyspace patterns`);
                    continue;
                }

                // Basic pattern validation (allow alphanumeric, wildcards, colons, etc.)
                if (!/^[a-zA-Z0-9:*?[\]{}._-]+$/.test(pattern)) {
                    errors.push(`${contextPrefix}Invalid keyspace pattern: "${token}" - Pattern contains invalid characters`);
                }
            }
            else if (token.startsWith('&')) {
                // Pub/Sub channel pattern: &pattern
                const pattern = token.slice(1);

                if (pattern === '') {
                    errors.push(`${contextPrefix}Invalid channel syntax: "${token}" - Missing pattern after &`);
                    continue;
                }

                // Check for spaces within the pattern
                if (pattern.includes(' ')) {
                    errors.push(`${contextPrefix}Invalid channel syntax: "${token}" - No spaces allowed in channel patterns`);
                    continue;
                }

                // Basic pattern validation (allow alphanumeric, wildcards, colons, etc.)
                if (!/^[a-zA-Z0-9:*?[\]{}._-]+$/.test(pattern)) {
                    errors.push(`${contextPrefix}Invalid channel pattern: "${token}" - Pattern contains invalid characters`);
                }

                // Note: Channel patterns are accepted but not validated for access
                // The app cannot test pub/sub channel permissions, only preserve them
            }
            else {
                // Invalid token - doesn't start with +, -, ~, %, or &
                errors.push(`${contextPrefix}Invalid rule syntax: "${token}" - Terms must start with +, -, ~, %, or & operators`);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Normalize ACL rule by converting commands to lowercase
     * @param {string} rule - The ACL rule string
     * @returns {string} - Normalized rule with lowercase commands
     */
    normalizeACLRule(rule) {
        if (!rule || typeof rule !== 'string') {
            return rule;
        }

        return rule.trim().split(/\s+/).map(token => {
            if (!token) return token;
            
            // Handle command tokens (+command, -command) but not categories (+@category, -@category)
            if ((token.startsWith('+') || token.startsWith('-')) && !token.includes('@')) {
                const operator = token[0];
                const command = token.substring(1);
                return operator + command.toLowerCase();
            }
            
            // Keep other tokens unchanged (categories, key patterns, etc.)
            return token;
        }).join(' ');
    },

    /**
     * Get Redis 8 module categories
     * @returns {Set} - Set of Redis 8-specific module categories
     */
    getRedis8ModuleCategories() {
        return new Set(['json', 'timeseries', 'search', 'bloom', 'cuckoo', 'cms', 'topk', 'tdigest']);
    },

    /**
     * Get Redis 8 module command prefixes
     * @returns {Set} - Set of Redis 8-specific command prefixes
     */
    getRedis8CommandPrefixes() {
        return new Set(['json.', 'ts.', 'ft.', 'bf.', 'cf.', 'cms.', 'topk.', 'tdigest.']);
    },

    /**
     * Check if an ACL rule contains Redis 8-specific content
     * @param {string} rule - The ACL rule to check
     * @returns {Object} - Analysis result with incompatible items
     */
    analyzeRedis8Content(rule) {
        if (!rule || typeof rule !== 'string') {
            return { hasRedis8Content: false, incompatibleItems: [] };
        }

        const redis8Categories = this.getRedis8ModuleCategories();
        const redis8Prefixes = this.getRedis8CommandPrefixes();
        const tokens = rule.trim().split(/\s+/);
        const incompatibleItems = [];

        for (const token of tokens) {
            if (!token) continue;

            // Check for Redis 8 module categories (@json, @search, etc.)
            if ((token.startsWith('+@') || token.startsWith('-@'))) {
                const category = token.slice(2); // Remove +@ or -@
                if (redis8Categories.has(category)) {
                    incompatibleItems.push({
                        type: 'category',
                        token: token,
                        name: category,
                        description: `Module category @${category}`
                    });
                }
            }
            // Check for Redis 8 module commands (json.get, ft.search, etc.)
            else if ((token.startsWith('+') || token.startsWith('-')) && !token.includes('@')) {
                const command = token.slice(1).toLowerCase();
                for (const prefix of redis8Prefixes) {
                    if (command.startsWith(prefix)) {
                        incompatibleItems.push({
                            type: 'command',
                            token: token,
                            name: command,
                            description: `Module command ${command}`
                        });
                        break;
                    }
                }
            }
        }

        return {
            hasRedis8Content: incompatibleItems.length > 0,
            incompatibleItems: incompatibleItems
        };
    },

    /**
     * Clean ACL rule by removing Redis 8-specific content
     * @param {string} rule - The ACL rule to clean
     * @returns {string} - Cleaned rule without Redis 8 content
     */
    cleanRedis8ContentFromRule(rule) {
        if (!rule || typeof rule !== 'string') {
            return rule;
        }

        const redis8Categories = this.getRedis8ModuleCategories();
        const redis8Prefixes = this.getRedis8CommandPrefixes();
        const tokens = rule.trim().split(/\s+/);
        const cleanedTokens = [];

        for (const token of tokens) {
            if (!token) continue;

            let shouldKeep = true;

            // Check for Redis 8 module categories
            if ((token.startsWith('+@') || token.startsWith('-@'))) {
                const category = token.slice(2);
                if (redis8Categories.has(category)) {
                    shouldKeep = false;
                }
            }
            // Check for Redis 8 module commands
            else if ((token.startsWith('+') || token.startsWith('-')) && !token.includes('@')) {
                const command = token.slice(1).toLowerCase();
                for (const prefix of redis8Prefixes) {
                    if (command.startsWith(prefix)) {
                        shouldKeep = false;
                        break;
                    }
                }
            }

            if (shouldKeep) {
                cleanedTokens.push(token);
            }
        }

        return cleanedTokens.join(' ');
    },

    /**
     * Show confirmation dialog for Redis version downgrade
     * @param {Array} incompatibleItems - List of incompatible items
     * @param {Function} onConfirm - Callback when user confirms
     * @param {Function} onCancel - Callback when user cancels
     */
    showVersionDowngradeConfirmation(incompatibleItems, onConfirm, onCancel) {
        const itemsList = incompatibleItems.map(item => 
            `• ${item.token} (${item.description})`
        ).join('\n');

        const message = `Switching to Redis 7 will remove the following Redis 8-specific items from your ACL rule:

${itemsList}

Do you want to continue and automatically clean the rule?`;

        if (confirm(message)) {
            onConfirm();
        } else {
            onCancel();
        }
    },

    /**
     * Show a dismissible test result with auto-dismiss and manual close
     * @param {HTMLElement} container - Container to show result in
     * @param {string} html - HTML content for the result
     * @param {string} resultClass - CSS class for styling (granted/denied)
     * @param {number} autoDismissMs - Auto-dismiss timeout in milliseconds (default: 5000)
     */
    showDismissibleTestResult(container, html, resultClass, autoDismissMs = 5000) {
        if (!container) return;

        // Clear any existing auto-dismiss timeout for this container
        if (this._dismissTimeouts.has(container)) {
            clearTimeout(this._dismissTimeouts.get(container));
            this._dismissTimeouts.delete(container);
        }

        // Clear container
        container.textContent = '';

        // Create result div with close button
        const resultDiv = document.createElement('div');
        resultDiv.className = `test-result ${resultClass}`;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'test-result-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close result');
        closeBtn.textContent = '×';

        resultDiv.appendChild(closeBtn);

        // Create a temporary container to parse the HTML content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Move all content from tempDiv to resultDiv
        while (tempDiv.firstChild) {
            resultDiv.appendChild(tempDiv.firstChild);
        }

        container.appendChild(resultDiv);

        // Function to smoothly dismiss the result
        const dismissResult = () => {
            if (resultDiv && !resultDiv.classList.contains('dismissing')) {
                // Clear the timeout when manually dismissing
                if (this._dismissTimeouts.has(container)) {
                    clearTimeout(this._dismissTimeouts.get(container));
                    this._dismissTimeouts.delete(container);
                }

                resultDiv.classList.add('dismissing');
                // Wait for animation to complete before removing
                setTimeout(() => {
                    container.textContent = '';
                }, 400); // Match 0.4s transition duration
            }
        };

        // Add click handler for close button
        const closeBtnElement = resultDiv.querySelector('.test-result-close');
        if (closeBtnElement) {
            closeBtnElement.addEventListener('click', dismissResult);
        }

        // Auto-dismiss after specified time
        if (autoDismissMs > 0) {
            const timeoutId = setTimeout(() => {
                dismissResult();
                this._dismissTimeouts.delete(container);
            }, autoDismissMs);

            // Store timeout ID for this container
            this._dismissTimeouts.set(container, timeoutId);
        }
    },

    /**
     * Execute EventHandlers method with dynamic import (shared utility)
     * Eliminates repeated dynamic import pattern across modules
     */
    async executeEventHandler(methodName, ...args) {
        try {
            const { default: EventHandlers } = await import('../handlers/event-handlers.js');
            if (EventHandlers[methodName]) {
                return EventHandlers[methodName](...args);
            } else {
                console.error(`EventHandler method ${methodName} not found`);
            }
        } catch (error) {
            console.error(`Failed to execute EventHandler ${methodName}:`, error);
        }
    },

    /**
     * Execute multiple EventHandler methods in sequence (shared utility)
     */
    async executeMultipleEventHandlers(calls) {
        try {
            const { default: EventHandlers } = await import('../handlers/event-handlers.js');
            for (const { method, args } of calls) {
                if (EventHandlers[method]) {
                    EventHandlers[method](...(args || []));
                } else {
                    console.error(`EventHandler method ${method} not found`);
                }
            }
        } catch (error) {
            console.error('Failed to execute multiple EventHandlers:', error);
        }
    }
};

export default Utils;