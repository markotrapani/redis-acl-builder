/**
 * Storage utility for persisting user input across page loads
 * Uses localStorage with fallback graceful handling
 */

const Storage = {
    // Storage keys
    keys: {
        ACL_RULE: 'redis-acl-builder-rule',
        REDIS_VERSION: 'redis-acl-builder-version',
        LAST_GENERATED_RULE: 'redis-acl-builder-last-generated',
        ACL_RULE_HISTORY: 'redis-acl-builder-rule-history',
        ACL_RULE_HISTORY_POSITION: 'redis-acl-builder-rule-history-position'
    },

    /**
     * Check if localStorage is available
     */
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Save a value to localStorage
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     */
    save(key, value) {
        if (!this.isAvailable()) return;
        
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    },

    /**
     * Load a value from localStorage
     * @param {string} key - Storage key
     * @param {string} defaultValue - Default value if key doesn't exist
     * @returns {string} Stored value or default
     */
    load(key, defaultValue = '') {
        if (!this.isAvailable()) return defaultValue;
        
        try {
            const value = localStorage.getItem(key);
            return value !== null ? value : defaultValue;
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
            return defaultValue;
        }
    },

    /**
     * Remove a value from localStorage
     * @param {string} key - Storage key
     */
    remove(key) {
        if (!this.isAvailable()) return;
        
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('Failed to remove from localStorage:', e);
        }
    },

    /**
     * Clear all application data from localStorage
     */
    clearAll() {
        if (!this.isAvailable()) return;
        
        try {
            Object.values(this.keys).forEach(key => {
                localStorage.removeItem(key);
            });
        } catch (e) {
            console.warn('Failed to clear localStorage:', e);
        }
    },

    /**
     * Clean up deprecated storage keys (one-time cleanup)
     */
    cleanupDeprecatedKeys() {
        if (!this.isAvailable()) return;
        
        try {
            // Remove deprecated test input persistence
            localStorage.removeItem('redis-acl-builder-command-test');
            localStorage.removeItem('redis-acl-builder-keyspace-test');
        } catch (e) {
            console.warn('Failed to cleanup deprecated keys:', e);
        }
    },

    // Convenience methods for specific data
    
    /**
     * Save ACL rule text
     * @param {string} rule - ACL rule text
     */
    saveAclRule(rule) {
        this.save(this.keys.ACL_RULE, rule);
    },

    /**
     * Load ACL rule text
     * @returns {string} Saved ACL rule or empty string
     */
    loadAclRule() {
        return this.load(this.keys.ACL_RULE);
    },


    /**
     * Save Redis version
     * @param {string} version - Redis version (redis7 or redis8)
     */
    saveRedisVersion(version) {
        this.save(this.keys.REDIS_VERSION, version);
    },

    /**
     * Load Redis version
     * @returns {string} Saved Redis version or 'redis7'
     */
    loadRedisVersion() {
        return this.load(this.keys.REDIS_VERSION, 'redis7');
    },
    
    /**
     * Save last generated rule (for detecting manual changes after reload)
     * @param {string} rule - Last generated rule text
     */
    saveLastGeneratedRule(rule) {
        this.save(this.keys.LAST_GENERATED_RULE, rule);
    },

    /**
     * Load last generated rule
     * @returns {string} Saved last generated rule or empty string
     */
    loadLastGeneratedRule() {
        return this.load(this.keys.LAST_GENERATED_RULE);
    },

    /**
     * Add a new rule to history and update position
     * @param {string} newRule - New rule to add to history
     */
    addToHistory(newRule) {
        try {
            const historyJson = this.load(this.keys.ACL_RULE_HISTORY, '[]');
            const history = JSON.parse(historyJson);
            const position = parseInt(this.load(this.keys.ACL_RULE_HISTORY_POSITION, '-1'));

            // Initialize history with current committed rule if this is the first addition
            if (history.length === 0) {
                const currentCommitted = this.loadAclRule() || '';
                if (currentCommitted !== newRule) {
                    history.push(currentCommitted);
                }
            }

            // If we're not at the end of history, truncate everything after current position
            // This happens when user made changes after undoing
            if (position >= 0 && position < history.length - 1) {
                history.splice(position + 1);
            }

            // Don't add if it's the same as the last entry
            if (history.length > 0 && history[history.length - 1] === newRule) {
                return;
            }

            // Add new rule to history
            history.push(newRule);

            // Update position to point to the newly added rule
            const newPosition = history.length - 1;

            // Limit history to 20 entries (FIFO)
            if (history.length > 20) {
                history.shift();
                // Adjust position after removing first element
                const adjustedPosition = Math.max(0, newPosition - 1);
                this.save(this.keys.ACL_RULE_HISTORY_POSITION, adjustedPosition.toString());
            } else {
                this.save(this.keys.ACL_RULE_HISTORY_POSITION, newPosition.toString());
            }

            this.save(this.keys.ACL_RULE_HISTORY, JSON.stringify(history));
        } catch (e) {
            console.warn('Failed to add rule to history:', e);
        }
    },


    /**
     * Move backward in history (undo)
     * @returns {string|null} Previous rule or null if can't undo
     */
    undoFromHistory() {
        try {
            const historyJson = this.load(this.keys.ACL_RULE_HISTORY, '[]');
            const history = JSON.parse(historyJson);
            const position = parseInt(this.load(this.keys.ACL_RULE_HISTORY_POSITION, '-1'));

            // Can't undo if no history exists
            if (history.length === 0) {
                return { error: 'no_history' };
            }

            // Can't undo if already at the beginning
            if (position <= 0) {
                return { error: 'at_beginning' };
            }

            // Move to previous position
            const newPosition = position - 1;
            this.save(this.keys.ACL_RULE_HISTORY_POSITION, newPosition.toString());

            return { rule: history[newPosition] };
        } catch (e) {
            console.warn('Failed to undo from history:', e);
            return { error: 'system_error' };
        }
    },

    /**
     * Move forward in history (redo)
     * @returns {string|null} Next rule or null if can't redo
     */
    redoFromHistory() {
        try {
            const historyJson = this.load(this.keys.ACL_RULE_HISTORY, '[]');
            const history = JSON.parse(historyJson);
            const position = parseInt(this.load(this.keys.ACL_RULE_HISTORY_POSITION, '-1'));

            // Can't redo if no history exists
            if (history.length === 0) {
                return { error: 'no_history' };
            }

            // Can't redo if already at the end
            if (position >= history.length - 1) {
                return { error: 'at_end' };
            }

            // Move to next position
            const newPosition = position + 1;
            this.save(this.keys.ACL_RULE_HISTORY_POSITION, newPosition.toString());

            return { rule: history[newPosition] };
        } catch (e) {
            console.warn('Failed to redo from history:', e);
            return { error: 'system_error' };
        }
    },

    /**
     * Check if there is any history available
     * @returns {boolean} True if history exists
     */
    hasHistory() {
        try {
            const historyJson = this.load(this.keys.ACL_RULE_HISTORY, '[]');
            const history = JSON.parse(historyJson);
            return history.length > 0;
        } catch (e) {
            return false;
        }
    },

    /**
     * Clear ACL rule history and reset position
     */
    clearHistory() {
        this.save(this.keys.ACL_RULE_HISTORY, '[]');
        this.save(this.keys.ACL_RULE_HISTORY_POSITION, '-1');
    }
};

export default Storage;