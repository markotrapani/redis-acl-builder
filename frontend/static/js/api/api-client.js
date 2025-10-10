/**
 * API Client
 * Handles all communication with the backend API
 */

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
     * Get categories for version
     */
    async getCategories(version) {
        try {
            const response = await fetch(`/api/categories?version=${version}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (result.error) {
                throw new Error(result.message || 'API returned an error');
            }
            return result;
        } catch (error) {
            console.error('API call to /api/categories failed:', error);
            throw error;
        }
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
    },

    /**
     * Test command+key access (integrated testing)
     */
    async testCommandKey(rule, command, key, version) {
        return this.makeCall('/api/test-command-key', { rule, command, key, version });
    }
};

export default API;