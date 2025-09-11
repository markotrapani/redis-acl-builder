/**
 * Utility Functions
 * Common utility functions used throughout the application
 */

import AppState from './app-state.js';

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
     * Format version name for display (redis7 -> Redis 7)
     */
    formatVersionName(version) {
        return version.replace(/^redis(\d+)$/, 'Redis $1');
    },

    /**
     * Validate ACL rule syntax according to Redis Enterprise rules
     */
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
    }
};

export default Utils;