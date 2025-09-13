/**
 * Storage utility for persisting user input across page loads
 * Uses localStorage with fallback graceful handling
 */

const Storage = {
    // Storage keys
    keys: {
        ACL_RULE: 'redis-acl-builder-rule',
        REDIS_VERSION: 'redis-acl-builder-version',
        LAST_GENERATED_RULE: 'redis-acl-builder-last-generated'
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
    }
};

export default Storage;