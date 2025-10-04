/**
 * ACL Category and Command Manager
 * Handles category and command state operations, lookups, and caching
 */

const ACLCategoryManager = {
    /**
     * Get commands that belong to a specific category
     * @param {string} category - The category name (without @ prefix)
     * @param {string} currentVersion - Redis version (e.g., 'redis7' or 'redis8')
     * @param {Object} API - API client for making requests
     * @returns {Promise<Array<string>>} - Array of command names
     */
    async getCategoryCommands(category, currentVersion, API) {
        try {
            const result = await API.parseRule(`+@${category}`, currentVersion);
            return result.granted_commands || [];
        } catch (error) {
            console.error(`Error getting commands for category ${category}:`, error);
            return [];
        }
    },

    /**
     * Get cached category commands (version-aware)
     * @param {string} category - The category name
     * @param {string} currentVersion - Redis version
     * @param {Map} cache - Category commands cache
     * @param {Function} getCategoryCommands - Function to fetch commands if not cached
     * @returns {Promise<Array<string>>} - Array of command names
     */
    async getCategoryCommandsCached(category, currentVersion, cache, getCategoryCommands) {
        const cacheKey = `${currentVersion}:${category}`;

        if (cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }

        const commands = await getCategoryCommands(category);
        cache.set(cacheKey, commands);
        return commands;
    },

    /**
     * Get all commands that would be granted by current category grants
     * @param {Set} grantedCategories - Set of granted categories
     * @param {string} currentVersion - Redis version
     * @param {Object} API - API client
     * @returns {Promise<Array<string>>} - Array of command names
     */
    async getCommandsGrantedByCategories(grantedCategories, currentVersion, API) {
        if (grantedCategories.size === 0) {
            return [];
        }

        try {
            // Build a rule with just the granted categories to see what commands they include
            const categoryRule = Array.from(grantedCategories)
                .map(cat => `+@${cat}`)
                .join(' ');

            const response = await API.parseRule(categoryRule, currentVersion);
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
     * Grant a category and remove conflicting individual command grants
     * Used when clicking a blocked category that has individual commands granted
     * @param {Object} state - The ACL builder state
     * @param {string} category - Category to grant
     * @param {Function} getCategoryCommandsCached - Function to get cached category commands
     * @param {Function} updateRuleText - Function to update rule text
     * @param {Function} scheduleRender - Function to trigger UI update
     * @returns {Promise<void>}
     */
    async grantCategoryAndRemoveConflictingCommands(state, category, getCategoryCommandsCached, updateRuleText, scheduleRender, ACLStateManager) {
        try {
            // Get all commands in this category
            const categoryCommands = await getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                console.warn(`No commands found for category ${category}`);
                return;
            }

            // Find individual command grants that belong to this category
            const conflictingCommands = categoryCommands.filter(cmd =>
                state.grantedCommands.has(cmd)
            );

            // Remove the category block
            state.blockedCategories.delete(category);

            // Remove conflicting individual command grants
            conflictingCommands.forEach(cmd => {
                state.grantedCommands.delete(cmd);
            });

            // Grant the category
            state.grantedCategories.add(category);

            // Update ordered terms - remove category block and conflicting command grants
            state.orderedTerms = state.orderedTerms.filter(term =>
                !(term.type === 'category' && term.operation === 'block' && term.value === category) &&
                !(term.type === 'command' && term.operation === 'grant' && conflictingCommands.includes(term.value))
            );

            // Add category grant
            ACLStateManager.addTerm(state.orderedTerms, 'category', 'grant', category);

            // Mark that we should check for comprehensive optimization after render
            // This handles cases like +@all -@admin +@connection -> clicking @admin -> +@all +@connection +@admin (redundant)
            // The optimization will simplify it to just +@all
            state.shouldComprehensiveOptimize = true;

            // Update the rule text and re-render
            await updateRuleText();
            scheduleRender();

            // Show notification about the optimization
            import('../core/utils.js').then(({ default: Utils }) => {
                Utils.showNotification(`Granted @${category} and removed ${conflictingCommands.length} conflicting command grants`, 'success');
            });
        } catch (error) {
            console.error(`Error granting category ${category} and removing conflicts:`, error);
        }
    },

    /**
     * Remove partial grants from a blocked category
     * Used for "partially implicitly granted" categories in granted panel
     * Example: +@all -@transaction +discard
     * Clicking the granted @transaction button should remove +discard but keep -@transaction
     * @param {Object} state - The ACL builder state
     * @param {string} category - Category to process
     * @param {Function} getCategoryCommandsCached - Function to get cached category commands
     * @param {Function} scheduleRender - Function to trigger UI update
     * @returns {Promise<void>}
     */
    async removePartialGrantsFromBlockedCategory(state, category, getCategoryCommandsCached, scheduleRender) {
        try {
            // Get all commands in this category
            const categoryCommands = await getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                console.warn(`No commands found for category ${category}`);
                return;
            }

            // Find individual command grants that belong to this category
            const grantedCommands = categoryCommands.filter(cmd =>
                state.grantedCommands.has(cmd)
            );

            if (grantedCommands.length === 0) {
                return;
            }

            // Remove individual command grants (but keep category block)
            grantedCommands.forEach(cmd => {
                state.grantedCommands.delete(cmd);
            });

            // Update ordered terms - remove individual command grants
            state.orderedTerms = state.orderedTerms.filter(term =>
                !(term.type === 'command' && term.operation === 'grant' && grantedCommands.includes(term.value))
            );

            // Show notification about the action
            import('../core/utils.js').then(({ default: Utils }) => {
                Utils.showNotification(`Removed ${grantedCommands.length} individual command grants from blocked @${category}`, 'success');
            });

            scheduleRender();
        } catch (error) {
            console.error(`Error removing partial grants from blocked category ${category}:`, error);
        }
    },

    /**
     * Grant a category and cleanup all related individual command entries
     * @param {Object} state - The ACL builder state
     * @param {string} category - Category to grant
     * @param {Function} getCategoryCommandsCached - Function to get cached category commands
     * @param {Function} updateRuleText - Function to update rule text
     * @param {Function} scheduleRender - Function to trigger UI update
     * @param {Function} grantCategory - Fallback function if error occurs
     * @returns {Promise<void>}
     */
    async grantCategoryAndCleanup(state, category, getCategoryCommandsCached, updateRuleText, scheduleRender, grantCategory) {
        try {
            // Get all commands in this category
            const categoryCommands = await getCategoryCommandsCached(category);
            const categoryCommandSet = new Set(categoryCommands);

            // Add the category to granted categories
            state.grantedCategories.add(category);
            state.blockedCategories.delete(category);

            // Remove any existing category entries for this category
            state.orderedTerms = state.orderedTerms.filter(term =>
                !(term.type === 'category' && term.value === category)
            );

            // Remove any individual command entries (both granted and blocked) that belong to this category
            const commandsToRemove = [];
            state.orderedTerms = state.orderedTerms.filter(term => {
                if (term.type === 'command' && categoryCommandSet.has(term.value)) {
                    commandsToRemove.push(term.value);
                    // Also remove from state sets
                    state.grantedCommands.delete(term.value);
                    state.blockedCommands.delete(term.value);
                    return false; // Remove this term
                }
                return true; // Keep other terms
            });

            // Add the category grant at the end
            state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });

            // Mark that we should check for comprehensive optimization after render
            // This handles cases like +@all -@admin +@connection -> clicking @admin -> +@all +@connection +@admin (redundant)
            // The optimization will simplify it to just +@all
            state.shouldComprehensiveOptimize = true;

            // Update the rule text and re-render
            await updateRuleText();
            scheduleRender();

            // Show notification about the change
            import('../core/utils.js').then(({ default: Utils }) => {
                const commandCount = commandsToRemove.length;
                if (commandCount > 0) {
                    Utils.showNotification(
                        `Granted @${category} category and removed ${commandCount} individual command${commandCount > 1 ? 's' : ''}`,
                        'success'
                    );
                } else {
                    Utils.showNotification(`Granted @${category} category`, 'success');
                }
            });

        } catch (error) {
            console.error('Error granting category and cleaning up:', error);
            // Fallback to simple category grant
            await grantCategory(category);
        }
    },

    /**
     * Remove all terms related to a category (both individual commands and category rules)
     * Used when clicking a partially granted category in the granted column
     * @param {Object} state - The ACL builder state
     * @param {string} category - Category to remove
     * @param {Function} getCategoryCommandsCached - Function to get cached category commands
     * @param {Function} updateRuleText - Function to update rule text
     * @param {Function} scheduleRender - Function to trigger UI update
     * @returns {Promise<void>}
     */
    async removeAllCategoryRelatedTerms(state, category, getCategoryCommandsCached, updateRuleText, scheduleRender) {
        try {
            // Get all commands in this category
            const categoryCommands = await getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                console.warn(`No commands found for category ${category}`);
                return;
            }

            // Remove any explicit category grant/block for this category
            state.grantedCategories.delete(category);
            state.blockedCategories.delete(category);

            // Remove individual command grants/blocks that belong to this category
            const categoryCommandsSet = new Set(categoryCommands);
            categoryCommandsSet.forEach(command => {
                state.grantedCommands.delete(command);
                state.blockedCommands.delete(command);
            });

            // Remove all terms from ordered list that relate to this category
            state.orderedTerms = state.orderedTerms.filter(term => {
                // Remove category rules for this category
                if (term.type === 'category' && term.value === category) {
                    return false;
                }
                // Remove individual command rules that belong to this category
                if (term.type === 'command' && categoryCommandsSet.has(term.value)) {
                    return false;
                }
                return true;
            });

            // Update the rule text and re-render
            await updateRuleText();
            scheduleRender();

            // Show notification about the change
            import('../core/utils.js').then(({ default: Utils }) => {
                Utils.showNotification(`Removed all terms related to @${category} category`, 'success');
            });

        } catch (error) {
            console.error(`Error removing all terms for category ${category}:`, error);
        }
    },

    /**
     * Block a command from a granted category
     * @param {Object} state - The ACL builder state
     * @param {string} command - Command to block
     * @param {Function} finalizeStateChange - Function to finalize state changes
     * @returns {Promise<void>}
     */
    async blockCommandFromCategory(state, command, finalizeStateChange) {
        // Add to blocked commands to explicitly exclude it
        state.blockedCommands.add(command);
        // Make sure it's not in granted commands
        state.grantedCommands.delete(command);

        // Update ordered terms - remove any existing entries for this command and add new block
        state.orderedTerms = state.orderedTerms.filter(term =>
            !(term.type === 'command' && term.value === command)
        );
        state.orderedTerms.push({ type: 'command', operation: 'block', value: command });

        // Mark that we should check for comprehensive optimization after render
        state.shouldComprehensiveOptimize = true;

        // Check if this command completes a category block and auto-simplify if so
        await finalizeStateChange();
    }
};

export default ACLCategoryManager;
