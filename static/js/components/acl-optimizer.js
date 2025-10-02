/**
 * ACL Rule Optimizer
 * Handles rule optimization, auto-simplification, and redundancy detection
 */

const ACLOptimizer = {
    /**
     * Helper method for showing optimization notifications
     */
    showOptimizationNotification(message, type) {
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification(message, type);
        });
    },

    /**
     * Check for comprehensive optimization opportunities and auto-apply
     * Only called when shouldComprehensiveOptimize flag is true (button clicks)
     *
     * @param {string} currentRule - The current ACL rule text
     * @param {string} currentVersion - The Redis version (e.g., 'redis7' or 'redis8')
     * @param {Object} callbacks - Object containing callbacks: { updateRuleText, syncFromRuleText, updateLastGeneratedRule }
     * @returns {Promise<void>}
     */
    async checkAndAutoOptimize(currentRule, currentVersion, callbacks) {
        // Skip optimization for empty rules
        if (!currentRule || !currentRule.trim()) {
            return;
        }

        try {
            const API = await import('../api/api-client.js').then(m => m.default);
            const optimizeResponse = await API.optimizeRule(currentRule, currentVersion);

            if (optimizeResponse.success && optimizeResponse.savings > 0) {
                // Auto-apply the optimization for button clicks
                const optimizedRule = optimizeResponse.optimized_rule;

                // Update via callbacks
                if (callbacks.updateRuleText) {
                    callbacks.updateRuleText(optimizedRule);
                }
                if (callbacks.updateLastGeneratedRule) {
                    callbacks.updateLastGeneratedRule(optimizedRule);
                }

                // Show notification about the optimization
                this.showOptimizationNotification(
                    `Auto-optimized: Saved ${optimizeResponse.savings} term${optimizeResponse.savings > 1 ? 's' : ''} (${optimizeResponse.original_term_count} → ${optimizeResponse.optimized_term_count})`,
                    'success'
                );

                // Sync the optimized rule back to the builder state
                if (callbacks.syncFromRuleText) {
                    await callbacks.syncFromRuleText();
                }
            }
        } catch (error) {
            console.error('Auto-optimization check failed:', error);
            // Silently fail - don't disrupt user experience
        }
    },

    /**
     * Individual optimization application methods
     * These methods modify state directly via the passed state object
     */

    /**
     * Apply cancelled @all pattern optimization
     */
    applyCancelledAllOptimization(state, count, StateManager) {
        // Clear all categories and commands - this results in empty ACL (only key patterns remain)
        state.grantedCategories.clear();
        state.blockedCategories.clear();
        state.grantedCommands.clear();
        state.blockedCommands.clear();

        // Remove all command and category terms from ordered list, keep only key patterns
        state.orderedTerms = StateManager.removeAllCommandAndCategoryTerms(state.orderedTerms);

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: cancelled @all pattern simplified to empty ACL (${count} blocked categories removed)`, 'success');
    },

    /**
     * Apply all categories optimization
     */
    applyAllCategoriesOptimization(state, count, StateManager) {
        // Clear all existing categories and replace with @all
        state.grantedCategories.clear();
        state.grantedCategories.add('all');

        // Remove all category grant terms from ordered list and replace with @all
        state.orderedTerms = state.orderedTerms.filter(term =>
            !(term.type === 'category' && term.operation === 'grant')
        );
        StateManager.addTerm(state.orderedTerms, 'category', 'grant', 'all');

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: replaced ${count} categories with "+@all"`, 'success');
    },

    /**
     * Apply cancel exclusion optimization
     */
    applyCancelExclusionOptimization(state, category, commands, count, StateManager) {
        // Remove the category block (since it's cancelled out)
        state.blockedCategories.delete(category);

        // Remove individual command grants (they're redundant now)
        commands.forEach(cmd => state.grantedCommands.delete(cmd));

        // Remove terms from ordered list
        state.orderedTerms = StateManager.removeTermsByCategory(state.orderedTerms, category, 'block');
        state.orderedTerms = StateManager.removeTermsByCommands(state.orderedTerms, commands, 'grant');

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: removed cancelled "-@${category}" and ${count} individual commands`, 'success');
    },

    /**
     * Apply null category optimization
     */
    applyNullCategoryOptimization(state, category, commands, count, StateManager) {
        // Remove the category grant (since all its commands are blocked)
        state.grantedCategories.delete(category);

        // Remove individual command blocks (they're redundant now - category isn't granted)
        commands.forEach(cmd => state.blockedCommands.delete(cmd));

        // Remove terms from ordered list
        state.orderedTerms = StateManager.removeTermsByCategory(state.orderedTerms, category, 'grant');
        state.orderedTerms = StateManager.removeTermsByCommands(state.orderedTerms, commands, 'block');

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: null category "+@${category}" and ${count} individual command blocks cancelled out`, 'success');
    },

    /**
     * Apply category grant optimization
     */
    applyCategoryGrantOptimization(state, category, commands, count, StateManager) {
        // Remove individual command grants
        commands.forEach(cmd => state.grantedCommands.delete(cmd));

        // Remove individual command terms from ordered list
        state.orderedTerms = StateManager.removeTermsByCommands(state.orderedTerms, commands, 'grant');

        // Add category grant
        StateManager.toggleCategoryState(state, category, 'grant');
        StateManager.addTerm(state.orderedTerms, 'category', 'grant', category);

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: replaced ${count} commands with "+@${category}"`, 'success');
    },

    /**
     * Apply category block optimization
     */
    applyCategoryBlockOptimization(state, category, commands, count, StateManager) {
        // Remove individual command blocks
        commands.forEach(cmd => state.blockedCommands.delete(cmd));

        // Remove individual command terms from ordered list
        state.orderedTerms = StateManager.removeTermsByCommands(state.orderedTerms, commands, 'block');

        // Add category block
        StateManager.toggleCategoryState(state, category, 'block');
        StateManager.addTerm(state.orderedTerms, 'category', 'block', category);

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: replaced ${count} command blocks with "-@${category}"`, 'success');
    },

    /**
     * Simplify individually granted commands to a category grant
     * This is called when clicking an implicitly granted category button
     */
    async simplifyToCategory(category, state, StateManager, callbacks) {
        // Get all commands for this category
        const categoryCommands = await callbacks.getCategoryCommands(category);
        if (!categoryCommands || categoryCommands.length === 0) {
            console.warn(`No commands found for category ${category}`);
            return;
        }

        // Remove all individual commands for this category from granted commands
        categoryCommands.forEach(cmd => {
            state.grantedCommands.delete(cmd);
        });

        // Remove individual command terms from ordered list
        state.orderedTerms = state.orderedTerms.filter(term =>
            !(term.type === 'command' && term.operation === 'grant' && categoryCommands.includes(term.value))
        );

        // Add category grant
        state.grantedCategories.add(category);
        state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });

        // Update rule text and re-render
        await callbacks.updateRuleText();
        callbacks.scheduleRender();

        // Show success notification
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification(`Simplified: replaced ${categoryCommands.length} commands with "+@${category}"`, 'success');
        });
    },

    /**
     * Remove all individual commands for a category (when clicking implicitly granted category)
     * This removes the individual commands without adding the category grant
     */
    async removeAllCategoryCommands(category, state, StateManager, callbacks) {
        // Get all commands for this category
        const categoryCommands = await callbacks.getCategoryCommands(category);
        if (!categoryCommands || categoryCommands.length === 0) {
            console.warn(`No commands found for category ${category}`);
            return;
        }

        // Remove all individual commands for this category from granted commands
        categoryCommands.forEach(cmd => state.grantedCommands.delete(cmd));

        // Remove individual command terms from ordered list
        state.orderedTerms = StateManager.removeTermsByCommands(state.orderedTerms, categoryCommands, 'grant');

        // Update rule text and re-render
        await callbacks.updateRuleText();
        callbacks.scheduleRender();

        // Show success notification
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification(`Removed ${categoryCommands.length} individual @${category} commands`, 'success');
        });
    },

    /**
     * Optimization detection methods
     */

    /**
     * Detect cancelled @all pattern - @all granted with all other categories blocked
     */
    async detectCancelledAllPattern(state) {
        const hasAllGranted = state.grantedCategories.has('all');
        if (!hasAllGranted) return null;

        const allCategoriesExceptAll = state.allCategories.filter(cat => cat !== 'all');
        const explicitlyBlockedCategoriesExceptAll = Array.from(state.blockedCategories).filter(cat => cat !== 'all');

        if (explicitlyBlockedCategoriesExceptAll.length === allCategoriesExceptAll.length &&
            explicitlyBlockedCategoriesExceptAll.length >= 10) {

            return {
                type: 'cancelled-all',
                grantedCategory: 'all',
                blockedCategories: explicitlyBlockedCategoriesExceptAll,
                count: explicitlyBlockedCategoriesExceptAll.length
            };
        }
        return null;
    },

    /**
     * Detect all-categories pattern - all categories explicitly granted should become @all
     */
    async detectAllCategoriesPattern(state) {
        const hasAllGranted = state.grantedCategories.has('all');
        if (hasAllGranted) return null;

        const allCategoriesExceptAll = state.allCategories.filter(cat => cat !== 'all');
        const explicitlyGrantedCategoriesExceptAll = Array.from(state.grantedCategories).filter(cat => cat !== 'all');

        if (explicitlyGrantedCategoriesExceptAll.length === allCategoriesExceptAll.length &&
            explicitlyGrantedCategoriesExceptAll.length >= 10) {

            return {
                type: 'all-categories',
                categories: explicitlyGrantedCategoriesExceptAll,
                count: explicitlyGrantedCategoriesExceptAll.length
            };
        }
        return null;
    },

    /**
     * Detect cancelled exclusion pattern - blocked category with all commands individually granted
     */
    async detectCancelledExclusion(category, categoryCommands, state) {
        const individuallyGrantedCommands = categoryCommands.filter(cmd =>
            state.grantedCommands.has(cmd)
        );

        if (individuallyGrantedCommands.length === categoryCommands.length &&
            individuallyGrantedCommands.length >= 3) {
            return {
                type: 'cancel-exclusion',
                category,
                commands: individuallyGrantedCommands,
                count: individuallyGrantedCommands.length
            };
        }
        return null;
    },

    /**
     * Detect null category pattern - granted category with all commands individually blocked
     */
    async detectNullCategory(category, categoryCommands, state) {
        const individuallyBlockedCommands = categoryCommands.filter(cmd =>
            state.blockedCommands.has(cmd)
        );

        if (individuallyBlockedCommands.length === categoryCommands.length &&
            individuallyBlockedCommands.length >= 3) {
            return {
                type: 'null-category',
                category,
                commands: individuallyBlockedCommands,
                count: individuallyBlockedCommands.length
            };
        }
        return null;
    },

    /**
     * Detect full category grant pattern - all commands individually granted
     */
    async detectFullCategoryGrant(category, categoryCommands, state) {
        const individuallyGrantedCommands = categoryCommands.filter(cmd =>
            state.grantedCommands.has(cmd)
        );

        if (individuallyGrantedCommands.length === categoryCommands.length &&
            individuallyGrantedCommands.length >= 3) {
            return {
                type: 'grant',
                category,
                commands: individuallyGrantedCommands,
                count: individuallyGrantedCommands.length
            };
        }
        return null;
    },

    /**
     * Detect full category block pattern - all commands individually blocked
     */
    async detectFullCategoryBlock(category, categoryCommands, state) {
        const individuallyBlockedCommands = categoryCommands.filter(cmd =>
            state.blockedCommands.has(cmd)
        );

        if (individuallyBlockedCommands.length === categoryCommands.length &&
            individuallyBlockedCommands.length >= 3) {
            return {
                type: 'block',
                category,
                commands: individuallyBlockedCommands,
                count: individuallyBlockedCommands.length
            };
        }
        return null;
    },

    /**
     * Detect individual category optimizations (cancelled exclusions, full grants, full blocks)
     */
    async detectIndividualCategoryOptimizations(state, getCategoryCommands) {
        // Skip individual category checking if we have an all-categories pattern
        const allCategoriesPattern = await this.detectAllCategoriesPattern(state);
        if (allCategoriesPattern) return [];

        const optimizations = [];

        for (const category of state.allCategories) {
            const categoryCommands = await getCategoryCommands(category);
            if (!categoryCommands || categoryCommands.length === 0) continue;

            // Check for cancelled-out exclusions (blocked category with all commands individually granted)
            if (state.blockedCategories.has(category)) {
                const cancelledExclusion = await this.detectCancelledExclusion(category, categoryCommands, state);
                if (cancelledExclusion) optimizations.push(cancelledExclusion);
                continue; // Skip further processing for blocked categories
            }

            // Check for null category pattern (granted category with all commands blocked)
            if (state.grantedCategories.has(category)) {
                const nullCategory = await this.detectNullCategory(category, categoryCommands, state);
                if (nullCategory) optimizations.push(nullCategory);
                continue; // Skip further processing for granted categories
            }

            // Check for full grant or block patterns
            const grantPattern = await this.detectFullCategoryGrant(category, categoryCommands, state);
            if (grantPattern) {
                optimizations.push(grantPattern);
            } else {
                const blockPattern = await this.detectFullCategoryBlock(category, categoryCommands, state);
                if (blockPattern) optimizations.push(blockPattern);
            }
        }

        return optimizations;
    },

    /**
     * Check if any categories are now fully granted/blocked via individual commands
     * and automatically simplify them to category grants/blocks
     */
    async checkAndAutoSimplifyCategories(state, detectMethods, applyMethod) {
        // Get all categories for current Redis version
        if (!state.allCategories || state.allCategories.length === 0) {
            return;
        }

        const optimizations = [
            await detectMethods.detectCancelledAllPattern(),
            await detectMethods.detectAllCategoriesPattern(),
            await detectMethods.detectIndividualCategoryOptimizations()
        ].flat().filter(Boolean);

        await applyMethod(optimizations);
    },

    /**
     * Apply the detected optimizations
     */
    async applyOptimizations(optimizations, applyMethods, updateRuleText) {
        if (optimizations.length === 0) return;

        // Apply optimizations
        for (const optimization of optimizations) {
            const { type, category, commands, count } = optimization;

            if (type === 'cancelled-all') {
                applyMethods.applyCancelledAllOptimization(count);
            } else if (type === 'all-categories') {
                applyMethods.applyAllCategoriesOptimization(count);
            } else if (type === 'cancel-exclusion') {
                applyMethods.applyCancelExclusionOptimization(category, commands, count);
            } else if (type === 'null-category') {
                applyMethods.applyNullCategoryOptimization(category, commands, count);
            } else if (type === 'grant') {
                applyMethods.applyCategoryGrantOptimization(category, commands, count);
            } else if (type === 'block') {
                applyMethods.applyCategoryBlockOptimization(category, commands, count);
            }
        }

        // Update rule text if any optimizations were applied
        if (optimizations.length > 0) {
            await updateRuleText();
        }
    }

    // TODO: Extract remaining optimization methods from interactive-acl-builder.js
    // Methods: detectRedundantExclusions, detectImplicitFullyGrantedCategories,
    // detectBlockThenRegrantPatterns, displayOptimizationSuggestions,
    // checkAndAutoSimplifyCategories,
    // detectCancelledAllPattern, detectAllCategoriesPattern,
    // detectIndividualCategoryOptimizations, detectCancelledExclusion,
    // detectNullCategory, detectFullCategoryGrant, detectFullCategoryBlock,
    // applyOptimizations, simplifyToCategory, removeAllCategoryCommands
};

export default ACLOptimizer;
