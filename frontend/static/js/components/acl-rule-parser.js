/**
 * ACL Rule Parser
 * Handles ACL rule parsing, generation, and text synchronization
 */

const ACLRuleParser = {
    /**
     * Generate optimized ACL rule from current state
     * Terms are ordered: inclusions first, then exclusions, then key patterns (~), then selectors
     * Within each group, preserve insertion order rather than alphabetical sorting
     */
    async generateOptimizedRule(state, helpers) {
        const parts = [];

        // Check if we have any inclusion terms for optimization logic
        const hasInclusions = state.grantedCategories.size > 0 || state.grantedCommands.size > 0;
        let grantedCommands = null;

        if (hasInclusions) {
            // Get all commands that would be granted by the inclusion terms
            grantedCommands = await helpers.getCommandsGrantedByInclusions();
        }

        // Process terms in the exact order they were added/modified
        state.orderedTerms.forEach(term => {
            if (term.type === 'category') {
                if (term.operation === 'grant') {
                    parts.push(`+@${term.value}`);
                } else if (term.operation === 'block') {
                    // Always preserve explicit blocks, even without inclusions
                    // If there are inclusions, only add if it would exclude granted commands
                    if (!hasInclusions || helpers.categoryOverlapsWithGranted(term.value, grantedCommands)) {
                        parts.push(`-@${term.value}`);
                    }
                }
            } else if (term.type === 'command') {
                if (term.operation === 'grant') {
                    parts.push(`+${term.value}`);
                } else if (term.operation === 'block') {
                    // Always preserve explicit blocks, even without inclusions
                    // If there are inclusions, only add if it would be granted
                    if (!hasInclusions || (grantedCommands && grantedCommands.has(term.value))) {
                        parts.push(`-${term.value}`);
                    }
                }
            }
        });

        // Key patterns (~) - these should come after command/category terms
        if (state.keyPatterns) {
            Array.from(state.keyPatterns).forEach(pattern => {
                parts.push(pattern);
            });
        }

        // Channel patterns (&) - these come after key patterns
        if (state.channelPatterns) {
            Array.from(state.channelPatterns).forEach(pattern => {
                parts.push(pattern);
            });
        }

        // Selectors - these come last
        if (state.selectors && state.selectors.length > 0) {
            for (const selector of state.selectors) {
                const selectorParts = [];

                // Process selector's ordered terms
                selector.orderedTerms.forEach(term => {
                    if (term.type === 'category') {
                        selectorParts.push(term.operation === 'grant' ? `+@${term.value}` : `-@${term.value}`);
                    } else if (term.type === 'command') {
                        selectorParts.push(term.operation === 'grant' ? `+${term.value}` : `-${term.value}`);
                    }
                });

                // Add selector's key patterns
                if (selector.keyPatterns) {
                    Array.from(selector.keyPatterns).forEach(pattern => {
                        selectorParts.push(pattern);
                    });
                }

                // Add selector's channel patterns
                if (selector.channelPatterns) {
                    Array.from(selector.channelPatterns).forEach(pattern => {
                        selectorParts.push(pattern);
                    });
                }

                // Only add selector if it has content
                if (selectorParts.length > 0) {
                    parts.push(`(${selectorParts.join(' ')})`);
                }
            }
        }

        return parts.join(' ');
    },

    /**
     * Get all commands that would be granted by current inclusion terms
     */
    async getCommandsGrantedByInclusions(state, getCommandsGrantedByCategories) {
        const grantedCommands = new Set();

        // Add individual granted commands
        state.grantedCommands.forEach(command => {
            grantedCommands.add(command);
        });

        // Add commands from granted categories (if any)
        if (state.grantedCategories.size > 0) {
            try {
                const categoryCommands = await getCommandsGrantedByCategories();
                categoryCommands.forEach(command => {
                    grantedCommands.add(command);
                });
            } catch (error) {
                console.error('Error getting category commands:', error);
            }
        }

        return grantedCommands;
    },

    /**
     * Get all commands that are blocked by excluded categories
     */
    async getCommandsBlockedByCategories(state, API, AppState) {
        if (state.blockedCategories.size === 0) {
            return [];
        }

        const blockedCommands = new Set();

        for (const category of state.blockedCategories) {
            try {
                const result = await API.parseRule(`+@${category}`, AppState.currentVersion);
                if (result && result.success && result.granted_commands) {
                    result.granted_commands.forEach(cmd => blockedCommands.add(cmd));
                }
            } catch (error) {
                console.error(`Error getting commands for blocked category ${category}:`, error);
            }
        }

        return Array.from(blockedCommands);
    },

    /**
     * Check if a blocked category would actually exclude any granted commands
     * For now, always return true to be safe - we can optimize this later
     */
    categoryOverlapsWithGranted(_category, _grantedCommands) {
        // Conservative approach: assume all categories might overlap
        return true;
    }
};

export default ACLRuleParser;
