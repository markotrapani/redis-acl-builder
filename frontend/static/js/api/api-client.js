/**
 * API Client
 * Handles all communication with the backend API
 */

/**
 * API Cache Implementation
 * Caches API responses with TTL (Time To Live)
 */
class APICache {
    constructor(ttl = 60000) { // 60 second default TTL
        this.cache = new Map();
        this.ttl = ttl;
    }

    generateKey(endpoint, params) {
        return `${endpoint}:${JSON.stringify(params)}`;
    }

    get(endpoint, params) {
        const key = this.generateKey(endpoint, params);
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.data;
        }

        this.cache.delete(key);
        return null;
    }

    set(endpoint, params, data) {
        const key = this.generateKey(endpoint, params);
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    invalidate(endpoint) {
        // Remove all entries matching endpoint
        for (const key of this.cache.keys()) {
            if (key.startsWith(endpoint + ':')) {
                this.cache.delete(key);
            }
        }
    }

    clear() {
        this.cache.clear();
    }

    getSize() {
        return this.cache.size;
    }
}

// Create cache instances with different TTLs
const staticDataCache = new APICache(3600000); // 1 hour for static data (categories, commands)
const parseCache = new APICache(300000); // 5 minutes for parsed rules
const testCache = new APICache(60000); // 1 minute for command tests

const API = {
    // Expose cache for testing/debugging
    _cache: {
        static: staticDataCache,
        parse: parseCache,
        test: testCache
    },
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
     * Parse ACL rule (with caching)
     */
    async parseRule(rule, version) {
        const cached = parseCache.get('/api/parse', { rule, version });
        if (cached) {
            return cached;
        }

        const result = await this.makeCall('/api/parse', { rule, version });
        parseCache.set('/api/parse', { rule, version }, result);
        return result;
    },

    /**
     * Test specific command (with caching)
     */
    async testCommand(rule, command, version) {
        const cached = testCache.get('/api/test-command', { rule, command, version });
        if (cached) {
            return cached;
        }

        const result = await this.makeCall('/api/test-command', { rule, command, version });
        testCache.set('/api/test-command', { rule, command, version }, result);
        return result;
    },

    /**
     * Validate rule syntax
     */
    async validateRule(rule, version) {
        return this.makeCall('/api/validate-rule', { rule, version });
    },
    
    /**
     * Analyze rule for redundancy and optimization opportunities
     */
    async analyzeRedundancy(rule, version) {
        return this.makeCall('/api/analyze-redundancy', { rule, version });
    },

    /**
     * Optimize ACL rule to find shortest equivalent representation
     */
    async optimizeRule(rule, version) {
        return this.makeCall('/api/optimize-rule', { rule, version });
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
     * Get categories for version (with caching - static data)
     */
    async getCategories(version) {
        const cached = staticDataCache.get('/api/categories', { version });
        if (cached) {
            return cached;
        }

        try {
            const response = await fetch(`/api/categories?version=${version}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result.error) {
                throw new Error(result.message || 'API returned an error');
            }

            // Cache for 1 hour (static data)
            staticDataCache.set('/api/categories', { version }, result);
            return result;
        } catch (error) {
            console.error('API call to /api/categories failed:', error);
            throw error;
        }
    },

    /**
     * Get all commands for version by parsing empty rule (with caching - static data)
     */
    async getAllCommands(version) {
        const cached = staticDataCache.get('/api/allcommands', { version });
        if (cached) {
            return cached;
        }

        const fullRuleResponse = await this.parseRule('+@all', version);

        if (fullRuleResponse && fullRuleResponse.grouped_commands) {
            // Extract all commands from all categories
            const allCommands = new Set();
            Object.values(fullRuleResponse.grouped_commands).forEach(commands => {
                commands.forEach(cmd => allCommands.add(cmd));
            });
            const result = Array.from(allCommands).sort();

            // Cache for 1 hour (static data)
            staticDataCache.set('/api/allcommands', { version }, result);
            return result;
        }

        return [];
    },

    /**
     * Test command+key access (integrated testing, with caching)
     */
    async testCommandKey(rule, command, key, version) {
        const cached = testCache.get('/api/test-command-key', { rule, command, key, version });
        if (cached) {
            return cached;
        }

        const result = await this.makeCall('/api/test-command-key', { rule, command, key, version });
        testCache.set('/api/test-command-key', { rule, command, key, version }, result);
        return result;
    },

    /**
     * Invalidate caches when ACL rule changes
     */
    invalidateCaches() {
        parseCache.clear();
        testCache.clear();
        // Keep staticDataCache (categories and commands don't change)
    }
};

export default API;