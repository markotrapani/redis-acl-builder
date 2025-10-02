/**
 * Interactive ACL Builder
 * Handles the three-column interactive interface for building ACL rules
 */

import AppState from '../core/app-state.js';
import Utils from '../core/utils.js';
import API from '../api/api-client.js';
import RuleManager from '../managers/rule-manager.js';
import Storage from '../core/storage.js';
import SearchManager from './search-manager.js';

const InteractiveACLBuilder = {
    // State management
    state: {
        // Legacy Sets - kept for backward compatibility with existing UI logic
        grantedCommands: new Set(),
        grantedCategories: new Set(),
        blockedCommands: new Set(),
        blockedCategories: new Set(),
        keyPatterns: new Set(),          // Store key patterns like ~*, ~user:*, etc.

        // New ordered structure for rule generation
        orderedTerms: [],                // Array of {type: 'category|command|keypattern', operation: 'grant|block', value: string}

        allCategories: [],
        allCommands: [],
        isInitialized: false,
        lastGeneratedRule: '',           // Track the last rule we generated
        hasManualChanges: false,         // Track if user made manual changes
        lastValidRule: '',               // Track the last valid rule for testing purposes
        shouldComprehensiveOptimize: false  // Track if comprehensive optimization should run after render
    },

    // DOM elements for three-column layout
    elements: {
        grantedCategoriesButtons: null,
        grantedCommandsButtons: null,
        blockedCategoriesButtons: null,
        blockedCommandsButtons: null,
        ruleStats: null,
        aclRuleInput: null,
        submitChangesBtn: null
    },

    /**
     * Initialize the interactive ACL builder
     */
    async init() {
        
        // Initialize DOM elements
        this.elements.grantedCategoriesButtons = document.querySelector('#grantedCategories .category-buttons');
        this.elements.grantedCommandsButtons = document.querySelector('#grantedCommands .command-buttons');
        this.elements.blockedCategoriesButtons = document.querySelector('#blockedCategories .category-buttons');
        this.elements.blockedCommandsButtons = document.querySelector('#blockedCommands .command-buttons');
        this.elements.ruleStats = document.getElementById('ruleStats');
        this.elements.aclRuleInput = document.getElementById('aclRule');
        this.elements.submitChangesBtn = document.getElementById('submitChangesBtn');

        // DOM elements initialized

        // Check if we have the three-column layout
        if (!this.elements.grantedCategoriesButtons) {
            return;
        }

        try {
            await this.loadAllData();
            this.initializeDefaultState();

            // Check if there's existing content in textarea (from localStorage restoration)
            const existingRule = this.elements.aclRuleInput.value.trim();

            // Set initialized to true before restoration so syncFromRuleText works
            this.state.isInitialized = true;

            let needsInitialRender = true;

            if (existingRule) {
                // Restore lastGeneratedRule BEFORE restoration for proper change detection
                const savedLastGenerated = Storage.loadLastGeneratedRule();
                if (savedLastGenerated) {
                    this.state.lastGeneratedRule = savedLastGenerated;
                }

                // Check if textarea content differs from last generated rule (indicating pending changes)
                const hasPendingChanges = existingRule !== savedLastGenerated;

                if (hasPendingChanges) {
                    // Don't auto-sync if there are pending changes, just show Submit Changes button
                    this.state.hasManualChanges = true;
                    this.showSubmitButton();

                    // Sync to the last committed state (lastGeneratedRule) to preserve interactive panel state
                    if (savedLastGenerated) {
                        // Temporarily set textarea to last generated rule for sync
                        const currentTextareaValue = this.elements.aclRuleInput.value;
                        this.elements.aclRuleInput.dataset.programmaticUpdate = 'true';
                        this.elements.aclRuleInput.value = savedLastGenerated;

                        // Sync panels to the committed state (without redundancy analysis since user has pending changes)
                        await this.syncFromRuleText(true); // Pass true to indicate this is restoration
                        needsInitialRender = false; // syncFromRuleText already rendered

                        // Restore the actual textarea content (with pending changes)
                        this.elements.aclRuleInput.dataset.programmaticUpdate = 'true';
                        this.elements.aclRuleInput.value = currentTextareaValue;
                    }
                    // If no savedLastGenerated, keep needsInitialRender = true for empty state
                } else {
                    // No pending changes, safe to auto-sync
                    await this.syncFromRuleText(true); // Pass true to indicate this is restoration
                    needsInitialRender = false; // syncFromRuleText already rendered
                }
            }

            // Only render if we haven't already rendered via syncFromRuleText
            if (needsInitialRender) {
                await this.renderColumns();
            }

            // Add event listeners
            this.setupEventListeners();

            // Final check for Submit Changes button visibility - no additional render needed
            setTimeout(() => {
                this.checkForManualChanges();
            }, 50);

            // Remove textarea loading cover after a brief delay
            setTimeout(() => {
                this.removeTextareaLoadingCover();
            }, 100);

            // Final check for Submit Changes button visibility after initialization
            setTimeout(() => {
                this.checkForManualChanges();
            }, 150);
        } catch (error) {
            console.error('❌ Failed to initialize Interactive ACL Builder:', error);
            // Show error in the UI
        }
    },

    /**
     * Load all categories and commands data
     */
    async loadAllData() {
        try {
            const response = await API.getCategories(AppState.currentVersion);
            
            if (response && response.categories) {
                this.state.allCategories = response.categories.sort();
            } else {
                throw new Error('No categories in response');
            }

            // Also load all commands
            this.state.allCommands = await API.getAllCommands(AppState.currentVersion);
        } catch (error) {
            console.error('❌ Failed to load categories data:', error);
            // Fallback: use some default categories
            this.state.allCategories = ['read', 'write', 'admin', 'dangerous', 'fast', 'slow', 'keyspace', 'string', 'list', 'hash', 'set', 'sortedset'];
            this.state.allCommands = ['get', 'set', 'del', 'exists', 'keys', 'hget', 'hset', 'lpush', 'sadd', 'zadd', 'flushdb', 'ping'];
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

        // Initialize scroll position storage
        this.scrollPositions = new Map();
    },

    /**
     * Grant a category (add to granted)
     */
    async grantCategory(category) {
        // Update state and ordered terms
        this.StateManager.toggleCategoryState(this.state, category, 'grant');
        this.state.orderedTerms = this.StateManager.removeTermsByCategory(this.state.orderedTerms, category);
        this.StateManager.addTerm(this.state.orderedTerms, 'category', 'grant', category);

        // Mark that we should check for comprehensive optimization after render
        this.state.shouldComprehensiveOptimize = true;

        // Check if granting this category triggers auto-simplification (like all categories -> @all)
        await this.finalizeStateChange();
    },

    /**
     * Block a category (add to blocked)
     */
    async blockCategory(category) {
        // Update state and ordered terms
        this.StateManager.toggleCategoryState(this.state, category, 'block');
        this.state.orderedTerms = this.StateManager.removeTermsByCategory(this.state.orderedTerms, category);
        this.StateManager.addTerm(this.state.orderedTerms, 'category', 'block', category);

        // Mark that we should check for comprehensive optimization after render
        this.state.shouldComprehensiveOptimize = true;

        // Check if blocking this category triggers auto-simplification (like cancelled @all)
        await this.finalizeStateChange();
    },

    /**
     * Grant a category and remove conflicting individual command grants
     * Used for "partially explicitly blocked" categories like: +@all -@transaction +discard
     * Clicking the blocked @transaction button should remove both -@transaction and +discard, granting full category
     */
    async grantCategoryAndRemoveConflictingCommands(category) {
        try {
            // Get all commands in this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                console.warn(`No commands found for category ${category}`);
                return;
            }

            // Find individual command grants that belong to this category
            const conflictingCommands = categoryCommands.filter(cmd =>
                this.state.grantedCommands.has(cmd)
            );


            // Remove the category block
            this.state.blockedCategories.delete(category);

            // Remove conflicting individual command grants
            conflictingCommands.forEach(cmd => {
                this.state.grantedCommands.delete(cmd);
            });

            // Grant the category
            this.state.grantedCategories.add(category);

            // Update ordered terms - remove category block and conflicting command grants
            this.state.orderedTerms = this.state.orderedTerms.filter(term =>
                !(term.type === 'category' && term.operation === 'block' && term.value === category) &&
                !(term.type === 'command' && term.operation === 'grant' && conflictingCommands.includes(term.value))
            );

            // Add category grant
            this.StateManager.addTerm(this.state.orderedTerms, 'category', 'grant', category);

            // Show notification about the optimization
            import('../core/utils.js').then(({ default: Utils }) => {
                Utils.showNotification(`Granted @${category} and removed ${conflictingCommands.length} conflicting command grants`, 'success');
            });

            this.scheduleRender();
        } catch (error) {
            console.error(`Error granting category ${category} and removing conflicts:`, error);
        }
    },

    /**
     * Remove partial grants from a blocked category
     * Used for "partially implicitly granted" categories in granted panel like: +@all -@transaction +discard
     * Clicking the granted @transaction button should remove +discard but keep -@transaction
     */
    async removePartialGrantsFromBlockedCategory(category) {
        try {

            // Get all commands in this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                console.warn(`No commands found for category ${category}`);
                return;
            }

            // Find individual command grants that belong to this category
            const grantedCommands = categoryCommands.filter(cmd =>
                this.state.grantedCommands.has(cmd)
            );

            if (grantedCommands.length === 0) {
                return;
            }


            // Remove individual command grants (but keep category block)
            grantedCommands.forEach(cmd => {
                this.state.grantedCommands.delete(cmd);
            });

            // Update ordered terms - remove individual command grants
            this.state.orderedTerms = this.state.orderedTerms.filter(term =>
                !(term.type === 'command' && term.operation === 'grant' && grantedCommands.includes(term.value))
            );


            // Show notification about the action
            import('../core/utils.js').then(({ default: Utils }) => {
                Utils.showNotification(`Removed ${grantedCommands.length} individual command grants from blocked @${category}`, 'success');
            });

            this.scheduleRender();
        } catch (error) {
            console.error(`Error removing partial grants from blocked category ${category}:`, error);
        }
    },

    /**
     * Detect redundant command exclusions that are later granted by categories
     * Returns array of redundant command exclusions with suggestions
     */
    async detectRedundantExclusions() {
        const redundantExclusions = [];

        // Get all commands that are effectively granted according to API
        const allGrantedCommands = new Set();
        if (this.lastApiResponse && this.lastApiResponse.granted_commands) {
            this.lastApiResponse.granted_commands.forEach(cmd => allGrantedCommands.add(cmd));
        }

        // Check each explicitly blocked command
        Array.from(this.state.blockedCommands).forEach(command => {
            // If this blocked command is actually granted (due to later category grants)
            if (allGrantedCommands.has(command)) {
                redundantExclusions.push({
                    command,
                    suggestion: `Remove redundant exclusion "-${command}" (granted by later category)`
                });
            }
        });

        return redundantExclusions;
    },

    /**
     * Detect implicit fully-granted categories (all commands individually granted)
     * Returns array of categories that can be simplified with suggestions
     */
    async detectImplicitFullyGrantedCategories() {
        const implicitCategories = [];

        // Skip detection if @all is granted - in this case, individual commands are likely part of a block-then-regrant pattern
        if (this.state.grantedCategories.has('all')) {
            return implicitCategories;
        }

        // Get all commands that are effectively granted according to API
        const allGrantedCommands = new Set();
        if (this.lastApiResponse && this.lastApiResponse.granted_commands) {
            this.lastApiResponse.granted_commands.forEach(cmd => allGrantedCommands.add(cmd));
        }

        // Get all available categories for current Redis version
        if (!this.state.allCategories || this.state.allCategories.length === 0) {
            console.warn('No available categories found for redundancy detection');
            return implicitCategories;
        }

        // Check each category to see if all its commands are individually granted
        for (const category of this.state.allCategories) {
            // Skip if category is already explicitly granted
            if (this.state.grantedCategories.has(category)) {
                continue;
            }

            // Get commands for this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                continue;
            }

            // Count how many of these commands are individually granted (not via other categories)
            const individuallyGrantedCommands = categoryCommands.filter(cmd =>
                this.state.grantedCommands.has(cmd)
            );

            // Only suggest optimization if at least 3 commands are individually granted
            // This ensures we only detect actual individual command redundancy, not cross-category grants
            if (individuallyGrantedCommands.length >= 3 && individuallyGrantedCommands.length === categoryCommands.length) {
                implicitCategories.push({
                    category,
                    commands: individuallyGrantedCommands,
                    suggestion: `Replace ${individuallyGrantedCommands.length} individual commands with "+@${category}"`
                });
            }
        }

        return implicitCategories;
    },

    /**
     * Detect block-then-regrant patterns (e.g., +@all -@geo +allGeoCommands)
     * These can be simplified by removing the block and individual grants
     */
    async detectBlockThenRegrantPatterns() {
        const patterns = [];

        // Only check this pattern if @all is granted
        if (!this.state.grantedCategories.has('all')) {
            return patterns;
        }

        // Check each blocked category to see if all its commands are individually granted
        for (const category of this.state.blockedCategories) {
            if (category === 'all') continue; // Skip @all itself

            // Get commands for this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                continue;
            }

            // Check if all commands in this blocked category are individually granted
            const individuallyGrantedCommands = categoryCommands.filter(cmd =>
                this.state.grantedCommands.has(cmd)
            );

            if (individuallyGrantedCommands.length === categoryCommands.length) {
                // This is a block-then-regrant pattern
                patterns.push({
                    category,
                    commands: individuallyGrantedCommands,
                    count: individuallyGrantedCommands.length
                });
            }
        }

        return patterns;
    },

    /**
     * Display optimization suggestions for manually typed redundant exclusions
     */
    async displayOptimizationSuggestions() {
        const redundantExclusions = await this.detectRedundantExclusions();
        const implicitCategories = await this.detectImplicitFullyGrantedCategories();
        const blockThenRegrantPatterns = await this.detectBlockThenRegrantPatterns();

        if (redundantExclusions.length > 0 || implicitCategories.length > 0 || blockThenRegrantPatterns.length > 0) {
            // Use the existing redundancy warning system to show optimization suggestions
            const warningsList = document.getElementById('warningsList');
            const suggestionsList = document.getElementById('suggestionsList');
            const warningsContainer = document.getElementById('redundancyWarnings');

            if (warningsList && suggestionsList && warningsContainer) {
                // Clear existing content first to avoid duplication (same as RuleManager does)
                // Note: Backend redundancy analysis will also clear these, but we need to clear
                // them here too since we might be called multiple times before backend analysis
                warningsList.innerHTML = '';
                suggestionsList.innerHTML = '';

                // Add optimization suggestions for redundant exclusions
                redundantExclusions.forEach(({ command }) => {
                    // Generate the optimized rule by temporarily removing the redundant exclusion
                    const optimizedTerms = this.state.orderedTerms.filter(term =>
                        !(term.type === 'command' && term.operation === 'block' && term.value === command)
                    );

                    // Build the optimized rule string
                    const optimizedRule = this.generateRuleFromTerms(optimizedTerms);

                    // Add warning (red box) explaining the redundancy
                    const warningDiv = document.createElement('div');
                    warningDiv.className = 'warning-item';
                    warningDiv.innerHTML = `Redundant exclusion "-${command}" is overridden by later category grant.`;
                    warningsList.appendChild(warningDiv);

                    // Add suggestion (blue box) with clickable simplified rule
                    const suggestionDiv = document.createElement('div');
                    suggestionDiv.className = 'suggestion-item';
                    suggestionDiv.innerHTML = `Simplified rule: <span class="simplified-rule">${optimizedRule}</span>`;

                    // Make simplified rule clickable (same pattern as existing simplifications)
                    const ruleSpan = suggestionDiv.querySelector('.simplified-rule');
                    if (ruleSpan) {
                        ruleSpan.style.cursor = 'pointer';
                        ruleSpan.title = 'Click to apply this simplified rule';
                        ruleSpan.addEventListener('click', async () => {
                            // Remove the redundant exclusion
                            this.state.blockedCommands.delete(command);
                            this.state.orderedTerms = this.state.orderedTerms.filter(term =>
                                !(term.type === 'command' && term.operation === 'block' && term.value === command)
                            );

                            // Update rule text and re-render
                            await this.updateRuleText();
                            this.scheduleRender();

                            // Trigger re-analysis which will clear the warnings/suggestions
                            // Import RuleManager to trigger redundancy analysis which will clear these warnings
                            import('../managers/rule-manager.js').then(({ default: RuleManager }) => {
                                // Parse rule with redundancy analysis to refresh warnings
                                RuleManager.parseRule();
                            });

                            // Show success notification
                            import('../core/utils.js').then(({ default: Utils }) => {
                                Utils.showNotification(`Applied optimization: removed "-${command}"`, 'success');
                            });
                        });
                    }

                    suggestionsList.appendChild(suggestionDiv);
                });

                // Add optimization suggestions for implicit fully-granted categories
                implicitCategories.forEach(({ category, commands }) => {
                    // Generate the optimized rule by replacing individual commands with category grant
                    const optimizedTerms = this.state.orderedTerms.filter(term =>
                        !(term.type === 'command' && term.operation === 'grant' && commands.includes(term.value))
                    );

                    // Add the category grant at the end (or find appropriate position)
                    optimizedTerms.push({ type: 'category', operation: 'grant', value: category });

                    // Build the optimized rule string
                    const optimizedRule = this.generateRuleFromTerms(optimizedTerms);

                    // Add warning (red box) explaining the redundancy
                    const warningDiv = document.createElement('div');
                    warningDiv.className = 'warning-item';
                    warningDiv.innerHTML = `Category "@${category}" is fully granted via ${commands.length} individual commands.`;
                    warningsList.appendChild(warningDiv);

                    // Add suggestion (blue box) with clickable simplified rule
                    const suggestionDiv = document.createElement('div');
                    suggestionDiv.className = 'suggestion-item';
                    suggestionDiv.innerHTML = `Simplified rule: <span class="simplified-rule">${optimizedRule}</span>`;

                    // Make simplified rule clickable
                    const ruleSpan = suggestionDiv.querySelector('.simplified-rule');
                    if (ruleSpan) {
                        ruleSpan.style.cursor = 'pointer';
                        ruleSpan.title = 'Click to apply this simplified rule';
                        ruleSpan.addEventListener('click', async () => {
                            // Remove the individual command grants
                            commands.forEach(command => {
                                this.state.grantedCommands.delete(command);
                            });

                            // Add the category grant
                            this.state.grantedCategories.add(category);

                            // Update ordered terms
                            this.state.orderedTerms = this.state.orderedTerms.filter(term =>
                                !(term.type === 'command' && term.operation === 'grant' && commands.includes(term.value))
                            );
                            this.state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });

                            // Update rule text and re-render
                            await this.updateRuleText();
                            this.scheduleRender();

                            // Trigger re-analysis which will clear the warnings/suggestions
                            import('../managers/rule-manager.js').then(({ default: RuleManager }) => {
                                // Parse rule with redundancy analysis to refresh warnings
                                RuleManager.parseRule();
                            });

                            // Show success notification
                            import('../core/utils.js').then(({ default: Utils }) => {
                                Utils.showNotification(`Applied optimization: replaced ${commands.length} commands with "+@${category}"`, 'success');
                            });
                        });
                    }

                    suggestionsList.appendChild(suggestionDiv);
                });

                // Add suggestions for block-then-regrant patterns
                blockThenRegrantPatterns.forEach(({ category, commands, count }) => {
                    // Generate the optimized rule by removing the block and individual grants
                    const optimizedTerms = this.state.orderedTerms.filter(term => {
                        // Remove the category block
                        if (term.type === 'category' && term.operation === 'block' && term.value === category) {
                            return false;
                        }
                        // Remove individual command grants for this category
                        if (term.type === 'command' && term.operation === 'grant' && commands.includes(term.value)) {
                            return false;
                        }
                        return true;
                    });

                    // Build the optimized rule string
                    const optimizedRule = this.generateRuleFromTerms(optimizedTerms);

                    // Add warning (red box) explaining the redundancy
                    const warningDiv = document.createElement('div');
                    warningDiv.className = 'warning-item';
                    warningDiv.innerHTML = `Category "@${category}" is blocked then re-granted via ${commands.length} individual commands. This cancels out.`;
                    warningsList.appendChild(warningDiv);

                    // Add suggestion (blue box) with clickable simplified rule
                    const suggestionDiv = document.createElement('div');
                    suggestionDiv.className = 'suggestion-item';
                    suggestionDiv.innerHTML = `Simplified rule: <span class="simplified-rule">${optimizedRule}</span>`;

                    // Make simplified rule clickable
                    const ruleSpan = suggestionDiv.querySelector('.simplified-rule');
                    if (ruleSpan) {
                        ruleSpan.style.cursor = 'pointer';
                        ruleSpan.title = 'Click to apply this simplified rule';
                        ruleSpan.addEventListener('click', async () => {
                            // Remove the category block
                            this.state.blockedCategories.delete(category);

                            // Remove the individual command grants
                            commands.forEach(command => {
                                this.state.grantedCommands.delete(command);
                            });

                            // Update ordered terms
                            this.state.orderedTerms = this.state.orderedTerms.filter(term => {
                                // Remove the category block
                                if (term.type === 'category' && term.operation === 'block' && term.value === category) {
                                    return false;
                                }
                                // Remove individual command grants for this category
                                if (term.type === 'command' && term.operation === 'grant' && commands.includes(term.value)) {
                                    return false;
                                }
                                return true;
                            });

                            // Update rule text and re-render
                            await this.updateRuleText();
                            this.scheduleRender();

                            // Trigger re-analysis which will clear the warnings/suggestions
                            import('../managers/rule-manager.js').then(({ default: RuleManager }) => {
                                // Parse rule with redundancy analysis to refresh warnings
                                RuleManager.parseRule();
                            });

                            // Show success notification
                            import('../core/utils.js').then(({ default: Utils }) => {
                                Utils.showNotification(`Applied optimization: removed redundant "-@${category}" and ${commands.length} individual commands`, 'success');
                            });
                        });
                    }

                    suggestionsList.appendChild(suggestionDiv);
                });

                // Show the warnings container if it's hidden
                warningsContainer.style.display = 'block';
            }
        }
    },

    /**
     * Generate ACL rule string from ordered terms (helper for optimization suggestions)
     */
    generateRuleFromTerms(orderedTerms) {
        const parts = [];

        orderedTerms.forEach(term => {
            if (term.type === 'category') {
                if (term.operation === 'grant') {
                    parts.push(`+@${term.value}`);
                } else if (term.operation === 'block') {
                    parts.push(`-@${term.value}`);
                }
            } else if (term.type === 'command') {
                if (term.operation === 'grant') {
                    parts.push(`+${term.value}`);
                } else if (term.operation === 'block') {
                    parts.push(`-${term.value}`);
                }
            }
        });

        return parts.join(' ') || '';
    },

    /**
     * Grant @all category by replacing entire rule with +@all
     * This is a special case where we clear everything and just grant all commands
     */
    async grantAllCategory() {
        // Clear all existing state
        this.state.grantedCategories.clear();
        this.state.blockedCategories.clear();
        this.state.grantedCommands.clear();
        this.state.blockedCommands.clear();
        this.state.orderedTerms = [];

        // Add @all as the only grant
        this.state.grantedCategories.add('all');
        this.state.orderedTerms.push({ type: 'category', operation: 'grant', value: 'all' });

        // Update the rule text and re-render
        await this.updateRuleText();
        this.scheduleRender();

        // Show notification about the change
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification('Granted ALL commands via @all category', 'success');
        });
    },

    /**
     * Clear ACL rule completely - for when implicitly partially granted @all is clicked
     * This revokes all commands by clearing the entire rule
     */
    async clearAllCategory() {
        // Clear all existing state
        this.state.grantedCategories.clear();
        this.state.blockedCategories.clear();
        this.state.grantedCommands.clear();
        this.state.blockedCommands.clear();
        this.state.orderedTerms = [];

        // Don't add anything - empty rule blocks all commands by default

        // Update the rule text and re-render
        await this.updateRuleText();
        this.scheduleRender();

        // Show notification about the change
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification('Cleared ACL rule - ALL commands now blocked', 'info');
        });
    },

    /**
     * Grant a category and clean up any individual command entries for that category
     * This is used when clicking a partially blocked category in the blocked column
     */
    async grantCategoryAndCleanup(category) {
        try {
            // Get all commands in this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            const categoryCommandSet = new Set(categoryCommands);

            // Add the category to granted categories
            this.state.grantedCategories.add(category);
            this.state.blockedCategories.delete(category);

            // Remove any existing category entries for this category
            this.state.orderedTerms = this.state.orderedTerms.filter(term =>
                !(term.type === 'category' && term.value === category)
            );

            // Remove any individual command entries (both granted and blocked) that belong to this category
            const commandsToRemove = [];
            this.state.orderedTerms = this.state.orderedTerms.filter(term => {
                if (term.type === 'command' && categoryCommandSet.has(term.value)) {
                    commandsToRemove.push(term.value);
                    // Also remove from state sets
                    this.state.grantedCommands.delete(term.value);
                    this.state.blockedCommands.delete(term.value);
                    return false; // Remove this term
                }
                return true; // Keep other terms
            });

            // Add the category grant at the end
            this.state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });

            // Update the rule text and re-render
            await this.updateRuleText();
            this.scheduleRender();

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
            await this.grantCategory(category);
        }
    },

    /**
     * Remove all terms related to a category (both individual commands and category rules)
     * This is used when clicking a partially granted category in the granted column
     */
    async removeAllCategoryRelatedTerms(category) {
        try {
            // Get all commands in this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                console.warn(`No commands found for category ${category}`);
                return;
            }

            // Remove any explicit category grant/block for this category
            this.state.grantedCategories.delete(category);
            this.state.blockedCategories.delete(category);

            // Remove individual command grants/blocks that belong to this category
            const categoryCommandsSet = new Set(categoryCommands);
            categoryCommandsSet.forEach(command => {
                this.state.grantedCommands.delete(command);
                this.state.blockedCommands.delete(command);
            });

            // Remove all terms from ordered list that relate to this category
            this.state.orderedTerms = this.state.orderedTerms.filter(term => {
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
            await this.updateRuleText();
            this.scheduleRender();

            // Show notification about the change
            import('../core/utils.js').then(({ default: Utils }) => {
                Utils.showNotification(`Removed all terms related to @${category} category`, 'success');
            });
        } catch (error) {
            console.error(`Error removing terms for category ${category}:`, error);
        }
    },

    /**
     * Convert implicit partial category to explicit full category grant
     * Removes individual command grants that belong to this category and adds the category grant
     */
    async convertImplicitToExplicitCategory(category) {
        try {
            // Get all commands in this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                console.warn(`No commands found for category ${category}`);
                return;
            }

            // Get individual command grants from the parsed rule
            const individuallyGrantedCommands = new Set();
            if (this.lastApiResponse && this.lastApiResponse.parsed_rule && this.lastApiResponse.parsed_rule.command_rules) {
                this.lastApiResponse.parsed_rule.command_rules.forEach(rule => {
                    if (rule.target === 'command' && rule.type === 'allow') {
                        individuallyGrantedCommands.add(rule.value);
                    }
                });
            }

            // Find which commands in this category are granted individually
            const categoryCommandSet = new Set(categoryCommands);
            const commandsToRemove = Array.from(categoryCommandSet).filter(cmd =>
                individuallyGrantedCommands.has(cmd)
            );


            // Remove individual command grants that belong to this category
            this.state.orderedTerms = this.state.orderedTerms.filter(term =>
                !(term.type === 'command' && term.operation === 'grant' && commandsToRemove.includes(term.value))
            );

            // Remove from granted commands state
            commandsToRemove.forEach(cmd => {
                this.state.grantedCommands.delete(cmd);
            });

            // Add the category grant
            this.state.grantedCategories.add(category);
            this.state.blockedCategories.delete(category);

            // Add to ordered terms (preserve order by adding at the end)
            this.state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });

            // Mark that we should auto-optimize after the next render
            this.state.shouldAutoOptimize = true;

            this.scheduleRender();
        } catch (error) {
            console.error(`Error converting implicit partial category ${category}:`, error);
            // Fallback to normal grant behavior
            await this.grantCategory(category);
        }
    },

    /**
     * Toggle a category between granted and blocked
     */
    async toggleCategory(category) {
        const wasExplicitlyGranted = this.state.grantedCategories.has(category);
        const wasBlocked = this.state.blockedCategories.has(category);
        
        // Check if category would be granted via @all (ignoring current blocks)
        const hasAllGrant = this.state.grantedCategories.has('all');
        const isGrantedViaAll = hasAllGrant && !wasExplicitlyGranted;
        
        // Remove any existing entries for this category first
        this.state.orderedTerms = this.state.orderedTerms.filter(term => 
            !(term.type === 'category' && term.value === category)
        );
        
        if (wasExplicitlyGranted) {
            // Move from explicitly granted to available (remove from granted)
            this.state.grantedCategories.delete(category);
            this.state.blockedCategories.delete(category);

            // Also remove any individual command exclusions that belong to this category
            // to prevent them from being "restored" when the category is re-added
            try {
                const categoryCommands = await this.getCategoryCommandsCached(category);
                const categoryCommandSet = new Set(categoryCommands);

                // Track commands that will be removed for debugging
                const commandsToRemove = [];

                // Remove command exclusions that belong to this category
                this.state.orderedTerms = this.state.orderedTerms.filter(term => {
                    if (term.type === 'command' && term.operation === 'block' && categoryCommandSet.has(term.value)) {
                        commandsToRemove.push(term.value);
                        // Also remove from blocked commands state
                        this.state.blockedCommands.delete(term.value);
                        return false; // Remove this term
                    }
                    return true; // Keep other terms
                });

                // Debug logging to verify cleanup
                if (commandsToRemove.length > 0) {
                }
            } catch (error) {
                console.warn('Could not clean up command exclusions for category:', category, error);
            }

            // Don't add to orderedTerms when removing
        } else if (wasBlocked) {
            // Category was blocked - remove the block
            this.state.blockedCategories.delete(category);
            // If it was originally granted via @all, don't add explicit grant
            if (!isGrantedViaAll) {
                // Only add explicit grant if it wouldn't be granted by @all anyway
                this.state.grantedCategories.add(category);
                this.state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });
            }
            // If it was granted via @all, just removing the block is enough
        } else {
            // Move from available to granted
            this.state.blockedCategories.delete(category);
            this.state.grantedCategories.add(category);
            // Add to orderedTerms
            this.state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });
        }

        this.scheduleRender();
    },

    /**
     * Grant a command (add to granted)
     */
    async grantCommand(command) {
        // Update state and ordered terms
        this.StateManager.toggleCommandState(this.state, command, 'grant');
        this.state.orderedTerms = this.StateManager.removeTermsByCommand(this.state.orderedTerms, command);
        this.StateManager.addTerm(this.state.orderedTerms, 'command', 'grant', command);

        // Mark that we should check for comprehensive optimization after render
        this.state.shouldComprehensiveOptimize = true;

        // Check if this command completes a category and auto-simplify if so
        await this.finalizeStateChange();
    },

    /**
     * Toggle a command between granted and blocked
     */
    async toggleCommand(command) {
        const wasExplicitlyGranted = this.state.grantedCommands.has(command);
        const wasBlocked = this.state.blockedCommands.has(command);
        
        // Check if command is granted via categories (like @all)
        const grantedViaCategories = await this.getCommandsGrantedByCategories();
        const isGrantedViaCategory = grantedViaCategories.includes(command);
        
        // Remove any existing entries for this command first
        this.state.orderedTerms = this.state.orderedTerms.filter(term => 
            !(term.type === 'command' && term.value === command)
        );
        
        if (wasExplicitlyGranted) {
            // Move from explicitly granted to available (remove from granted)
            this.state.grantedCommands.delete(command);
            this.state.blockedCommands.delete(command);
            // Don't add to orderedTerms when removing
        } else if (wasBlocked) {
            // Command was blocked - remove the block
            this.state.blockedCommands.delete(command);
            // If it was originally granted via category (like @all), don't add explicit grant
            if (!isGrantedViaCategory) {
                // Only add explicit grant if it wouldn't be granted by categories anyway
                this.state.grantedCommands.add(command);
                this.state.orderedTerms.push({ type: 'command', operation: 'grant', value: command });
            }
            // If it was granted via category, just removing the block is enough
        } else {
            // Move from available to granted
            this.state.blockedCommands.delete(command);
            this.state.grantedCommands.add(command);
            // Add to orderedTerms
            this.state.orderedTerms.push({ type: 'command', operation: 'grant', value: command });
        }

        // Check if this command completes a category and auto-simplify if so
        await this.finalizeStateChange();
    },

    /**
     * Render the interactive columns
     */
    async renderColumns() {
        // Note: Loading class is already in HTML to prevent initial flash

        await this.renderCategoryButtons();
        await this.renderCommandButtons();

        // Wait for the browser to complete the next paint cycle to ensure all DOM changes are rendered
        await new Promise(resolve => requestAnimationFrame(resolve));
        // Wait one more frame to ensure all layout calculations and positioning are complete
        await new Promise(resolve => requestAnimationFrame(resolve));

        this.removeLoadingAnimation();
    },

    /**
     * Apply loading covers to hide empty state during updates
     */
    applyLoadingAnimation() {
        const containers = document.querySelectorAll('.command-categories-container');

        // Clean up any existing overlays first
        if (this.loadingOverlays && this.loadingOverlays.length > 0) {
            this.loadingOverlays.forEach(overlay => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            });
        }

        // Store overlays for cleanup
        this.loadingOverlays = [];

        containers.forEach(container => {
            // Store current scroll position to restore later
            if (!this.scrollPositions) {
                this.scrollPositions = new Map();
            }
            this.scrollPositions.set(container, container.scrollTop);

            // Remove any existing fade-out state first
            container.classList.remove('loading-fadeout');

            // Create overlay positioned to cover the entire scrollable content
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';

            // Position overlay to cover the entire scrollable area
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = Math.max(container.scrollHeight, container.clientHeight) + 'px';

            // Ensure container has relative positioning to contain the overlay
            const originalPosition = getComputedStyle(container).position;
            if (originalPosition === 'static') {
                container.style.position = 'relative';
            }

            // Add overlay directly to the container
            container.appendChild(overlay);
            this.loadingOverlays.push(overlay);

            // Still add loading class for any other CSS that depends on it
            container.classList.add('loading');
        });
    },

    /**
     * Remove loading covers after content is rendered (covers start in HTML)
     */
    removeLoadingAnimation() {
        const containers = document.querySelectorAll('.command-categories-container.loading');

        // Check if there's anything to remove
        if (containers.length === 0 && (!this.loadingOverlays || this.loadingOverlays.length === 0)) {
            return; // Already removed or not found
        }

        // Remove and fade out the dynamic overlays
        if (this.loadingOverlays && this.loadingOverlays.length > 0) {
            this.loadingOverlays.forEach(overlay => {
                // Fade out overlay
                overlay.style.transition = 'opacity 0.15s ease';
                overlay.style.opacity = '0';

                // Remove from DOM after fade completes
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 150); // Match CSS transition duration (0.15s)
            });

            // Clear the overlay array
            this.loadingOverlays = [];
        }

        containers.forEach(container => {
            // Add fade-out class to trigger smooth opacity transition
            container.classList.add('loading-fadeout');

            // Remove both classes after fade animation completes
            setTimeout(() => {
                container.classList.remove('loading', 'loading-fadeout');

                // Restore scroll position if we have one stored
                if (this.scrollPositions && this.scrollPositions.has(container)) {
                    const savedScrollTop = this.scrollPositions.get(container);
                    const maxScrollTop = container.scrollHeight - container.clientHeight;

                    // Only restore if content is still scrollable and position is valid
                    if (maxScrollTop > 0) {
                        // Clamp scroll position to valid range
                        container.scrollTop = Math.min(savedScrollTop, maxScrollTop);
                    }
                    // If content no longer needs scrolling (maxScrollTop <= 0), leave at top (0)
                }
            }, 150); // Match CSS transition duration (0.15s)
        });
    },

    /**
     * Remove textarea loading cover with smooth fade animation
     */
    removeTextareaLoadingCover() {
        const textareaContainer = document.querySelector('.textarea-container');

        if (!textareaContainer || !textareaContainer.classList.contains('loading')) {
            return; // No loading cover to remove
        }


        // Add fade-out class to trigger smooth opacity transition
        textareaContainer.classList.add('loading-fadeout');

        // Remove both classes after fade animation completes
        setTimeout(() => {
            textareaContainer.classList.remove('loading', 'loading-fadeout');

            // Log final textarea styles
            setTimeout(() => {
            }, 50);
        }, 150); // Match CSS transition duration (0.15s)
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
                // Note: SearchManager.refreshAllSearches() is now called from within smoothRender after DOM updates
            });
        }, 100); // 100ms debounce for smoother batching
    },

    /**
     * Smooth rendering with loading covers to prevent empty state flash
     */
    async smoothRender(shouldUpdateRuleText = true) {
        // Apply loading covers instead of opacity fade to prevent empty state flash
        this.applyLoadingAnimation();

        // Brief delay to ensure loading covers are applied, then render content
        setTimeout(async () => {
            // Update rule text based on current state (skip during Submit Changes to preserve user input)
            if (shouldUpdateRuleText) {
                await this.updateRuleText();
            }
            
            // Then refresh API response data for partial category detection
            const currentRule = this.elements.aclRuleInput.value.trim();
            try {
                const response = await API.parseRule(currentRule, AppState.currentVersion);
                if (response && response.success) {
                    this.lastApiResponse = response;
                }
            } catch (error) {
                console.error('Error refreshing API response:', error);
            }

            // Auto-optimize redundant exclusions if requested (after API response is fresh)
            if (this.state.shouldAutoOptimize) {
                this.state.shouldAutoOptimize = false;
                const redundantExclusions = await this.detectRedundantExclusions();

                if (redundantExclusions.length > 0) {

                    // Remove redundant exclusions from state
                    redundantExclusions.forEach(({ command }) => {
                        this.state.blockedCommands.delete(command);

                        // Remove from ordered terms
                        this.state.orderedTerms = this.state.orderedTerms.filter(term =>
                            !(term.type === 'command' && term.operation === 'block' && term.value === command)
                        );
                    });

                    // Update rule text and refresh API response with optimized rule
                    if (shouldUpdateRuleText) {
                        await this.updateRuleText();
                    }
                    const optimizedRule = this.elements.aclRuleInput.value.trim();
                    try {
                        const optimizedResponse = await API.parseRule(optimizedRule, AppState.currentVersion);
                        if (optimizedResponse && optimizedResponse.success) {
                            this.lastApiResponse = optimizedResponse;
                        }
                    } catch (error) {
                        console.error('Error refreshing API response after optimization:', error);
                    }
                }
            }

            // Now render with fresh API data
            await this.renderColumns();

            // Apply search filters while containers are completely hidden
            SearchManager.refreshAllSearches();

            // Wait for browser to complete rendering all DOM changes
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => requestAnimationFrame(resolve));

            // Apply filters one more time to be absolutely sure
            SearchManager.refreshAllSearches();

            // Wait one more frame after search filters are applied
            await new Promise(resolve => requestAnimationFrame(resolve));

            // Additional wait to ensure all DOM mutations from search filters are truly complete
            // This prevents users from seeing button repopulation during the fade-out transition
            await new Promise(resolve => requestAnimationFrame(resolve));

            // Wait one final frame to be absolutely certain no more DOM changes are pending
            await new Promise(resolve => requestAnimationFrame(resolve));

            // Remove loading covers with smooth fade animation
            // Note: Scrollbar space is now always reserved via CSS overflow-y: scroll
            this.removeLoadingAnimation();

            // Check for comprehensive optimization if requested (after render completes)
            if (this.state.shouldComprehensiveOptimize) {
                this.state.shouldComprehensiveOptimize = false;
                await this.checkAndAutoOptimize();
            }
        }, 50); // Reduced since we now use proper frame timing for overlay removal
    },

    /**
     * Render category buttons in both columns
     */
    async renderCategoryButtons() {
        // For now, let's simplify and not use the three-state analysis to fix the loading issue
        // We can re-enable it once we debug the problem
        const hasAllCategory = this.state.grantedCategories.has('all');

        // Determine effective status of all categories based on ACL rule precedence
        const effectiveCategoryStatus = await this.getEffectiveCategoryStatus();

        // Detect implicit partial categories ONCE to ensure consistency between granted and blocked columns
        const implicitPartialCategories = new Set();
        const implicitFullyGrantedCategories = new Set();
        const implicitPartialBlockedCategories = new Set();

        for (const category of this.state.allCategories) {
            // Check if this category has partial grants (some commands granted individually)
            if (!this.state.grantedCategories.has(category)) {
                const categoryAnalysis = await this.detectPartialCategory(category);
                if (categoryAnalysis[category] === 'partial') {
                    implicitPartialCategories.add(category);
                } else if (categoryAnalysis[category] === 'fully-granted') {
                    implicitFullyGrantedCategories.add(category);
                }
            }

            // Check if this category has partial blocks (some commands blocked individually)
            if (!this.state.blockedCategories.has(category)) {
                const blockedAnalysis = await this.detectPartiallyBlockedCategory(category);
                if (blockedAnalysis[category] === 'partial') {
                    implicitPartialBlockedCategories.add(category);
                }
            } else {
                // Check if this explicitly blocked category is partially granted back
                const partialExplicitAnalysis = await this.detectPartiallyExplicitlyBlockedCategory(category);
                if (partialExplicitAnalysis[category] === 'partially-explicitly-blocked') {
                    // Add to granted panel as "partially implicitly granted" (some commands granted despite category block)
                    implicitPartialCategories.add(category);
                }
            }

            // IMPORTANT: If a category is partially granted, it's also partially blocked
            // This creates the dual-button behavior where users can act from either column
            if (implicitPartialCategories.has(category)) {
                implicitPartialBlockedCategories.add(category);
            }
        }

        // Check @all specifically since it might not be in allCategories
        if (!this.state.allCategories.includes('all')) {
            if (!this.state.grantedCategories.has('all')) {
                const categoryAnalysis = await this.detectPartialCategory('all');
                if (categoryAnalysis['all'] === 'partial') {
                    implicitPartialCategories.add('all');
                }
            }

            if (!this.state.blockedCategories.has('all')) {
                const blockedAnalysis = await this.detectPartiallyBlockedCategory('all');
                if (blockedAnalysis['all'] === 'partial') {
                    implicitPartialBlockedCategories.add('all');
                }
            }

            // Add @all to both if it's partial granted (means it's also partial blocked)
            // @all always gets dual-button behavior when partial
            if (implicitPartialCategories.has('all')) {
                implicitPartialBlockedCategories.add('all');
            }
        }

        // Render granted categories
        if (this.elements.grantedCategoriesButtons) {
            // Clear any existing content (including initial placeholders from HTML)
            this.elements.grantedCategoriesButtons.innerHTML = '';
            
            const effectivelyGrantedCategories = [];

            // Check if @all is explicitly granted
            const hasAllExplicitlyGranted = this.state.grantedCategories.has('all');

            if (hasAllExplicitlyGranted) {
                        // When @all is explicitly granted, show @all as explicitly granted first
                effectivelyGrantedCategories.push('all');

                // Then show all other categories as implicitly granted (not explicitly granted)
                this.state.allCategories.forEach(category => {
                    if (category !== 'all' && effectiveCategoryStatus[category] === 'granted') {
                        effectivelyGrantedCategories.push(category);
                    }
                });

                // IMPORTANT: Also check for partially explicitly blocked categories in the @all case
                // These should appear in the granted panel as "partially implicitly granted"
                for (const category of this.state.allCategories) {
                    if (category !== 'all' && this.state.blockedCategories.has(category)) {
                        const partialExplicitAnalysis = await this.detectPartiallyExplicitlyBlockedCategory(category);
                        if (partialExplicitAnalysis[category] === 'partially-explicitly-blocked') {
                            if (!effectivelyGrantedCategories.includes(category)) {
                                effectivelyGrantedCategories.push(category);
                            }
                        }
                    }
                }
            } else {
                // Normal case - show explicitly granted categories first, then implicit partial categories
                const explicitlyGrantedCategories = Array.from(this.state.grantedCategories);

                // Use pre-calculated implicit partial and fully granted categories (already computed above)
                const implicitPartialCategoriesArray = Array.from(implicitPartialCategories);
                const implicitFullyGrantedCategoriesArray = Array.from(implicitFullyGrantedCategories);

                // Special @all handling: if there are any inclusions but @all is not explicitly granted,
                // show @all as implicitly partially granted
                const hasAnyInclusions = this.state.grantedCategories.size > 0 || this.state.grantedCommands.size > 0;
                const hasAllCategory = explicitlyGrantedCategories.includes('all');
                const shouldShowAllAsPartial = hasAnyInclusions && !hasAllCategory && !this.state.blockedCategories.has('all');

                let sortedExplicitCategories;

                if (hasAllCategory) {
                    // Remove @all, sort the rest, then put @all first
                    const explicitWithoutAll = explicitlyGrantedCategories.filter(cat => cat !== 'all').sort();
                    sortedExplicitCategories = ['all', ...explicitWithoutAll];
                } else {
                    sortedExplicitCategories = explicitlyGrantedCategories.sort();
                }

                // Add @all as implicit partial if needed
                if (shouldShowAllAsPartial && !implicitPartialCategoriesArray.includes('all')) {
                    implicitPartialCategoriesArray.unshift('all'); // Add @all at the beginning of implicit partials
                }

                // Combine: explicit categories first (with @all at front), then implicit fully granted, then implicit partial categories (sorted, but @all first)
                const sortedImplicitPartials = implicitPartialCategoriesArray.includes('all')
                    ? ['all', ...implicitPartialCategoriesArray.filter(cat => cat !== 'all').sort()]
                    : implicitPartialCategoriesArray.sort();

                const sortedImplicitFullyGranted = implicitFullyGrantedCategoriesArray.includes('all')
                    ? ['all', ...implicitFullyGrantedCategoriesArray.filter(cat => cat !== 'all').sort()]
                    : implicitFullyGrantedCategoriesArray.sort();

                // Ensure @all is always first in the final list, regardless of whether it's explicit or implicit
                const combinedCategories = [...sortedExplicitCategories, ...sortedImplicitFullyGranted, ...sortedImplicitPartials];
                const hasAllInCombined = combinedCategories.includes('all');
                if (hasAllInCombined) {
                    // Remove @all from wherever it is and put it first
                    const withoutAll = combinedCategories.filter(cat => cat !== 'all');
                    effectivelyGrantedCategories.push('all', ...withoutAll);
                } else {
                    effectivelyGrantedCategories.push(...combinedCategories);
                }
            }
            
            if (effectivelyGrantedCategories.length === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'No categories granted';
                this.elements.grantedCategoriesButtons.appendChild(message);
            } else {
                // Categories are already properly ordered above (explicit first, then implicit)
                // No additional sorting needed here to preserve the explicit/implicit ordering

                // First, we need to detect which granted categories are partial (have blocked subcommands)
                // Also check for partially explicitly blocked categories in the @all case
                const categoryAnalysisPromises = effectivelyGrantedCategories.map(async (category) => {
                    let categoryAnalysis = await this.detectPartialCategory(category);

                    // For @all case, also check if this is a partially explicitly blocked category
                    if (hasAllExplicitlyGranted && this.state.blockedCategories.has(category)) {
                        const partialExplicitAnalysis = await this.detectPartiallyExplicitlyBlockedCategory(category);
                        if (partialExplicitAnalysis[category] === 'partially-explicitly-blocked') {
                            // Override with partial state to get the right button styling
                            categoryAnalysis = { [category]: 'partial' };
                        }
                    }

                    return { category, categoryAnalysis };
                });

                // Wait for all analyses to complete
                const analyses = await Promise.all(categoryAnalysisPromises);

                for (const { category, categoryAnalysis } of analyses) {
                    const button = await this.createCategoryButton(category, 'granted', categoryAnalysis);
                    
                    // Special handling for @all case - adjust tooltips and click behavior only
                    // (Visual styling is now handled by CSS classes in createCategoryButton)
                    if (hasAllCategory && !this.state.grantedCategories.has(category)) {
                        // Check if this is a partially explicitly blocked category - preserve its special handler
                        const isPartiallyBlocked = this.state.blockedCategories.has(category);

                        if (category === 'fast') {
                        }

                        if (!isPartiallyBlocked) {
                            // Check if this button already has a smart handler (e.g., removeAllCategoryRelatedTerms)
                            const hasSmartHandler = button.onclick?.toString().includes('removeAllCategoryRelatedTerms') ||
                                                   button.onclick?.toString().includes('removeConflictingIndividualCommands');

                            if (!hasSmartHandler) {
                                // Normal case: This category is granted via @all, clicking should block it
                                button.dataset.stateInfo = `@${category} category (granted via @all) - Click to block`;
                                button.onclick = () => this.blockCategory(category);

                            } else {
                                // Keep the smart handler that was set by createCategoryButton
                            }
                        }
                        // For partially blocked categories, keep the handler from createCategoryButton
                    } else if (hasAllCategory && this.state.grantedCategories.has(category)) {
                        // This category is explicitly granted in addition to @all
                        button.dataset.stateInfo = `@${category} category (explicitly granted) - Click to toggle`;
                        // Keep default toggleCategory behavior
                    }
                    
                    this.elements.grantedCategoriesButtons.appendChild(button);

                }
            }

            // Update the granted categories header (exclude @all from count as it's a pseudo-category)
            const grantedCategoryCount = effectivelyGrantedCategories.filter(cat => cat !== 'all').length;
            this.updateCategorySectionHeader('granted', grantedCategoryCount);
        }

        // Render available categories as clickable buttons
        if (this.elements.blockedCategoriesButtons) {
            // Clear any existing content (including initial placeholders from HTML)
            this.elements.blockedCategoriesButtons.innerHTML = '';
            
            const effectivelyBlockedCategories = [];
            const availableCategories = [];
            
            if (hasAllCategory) {
                // When @all is granted, separate categories by their effective status
                this.state.allCategories.forEach(category => {
                    if (effectiveCategoryStatus[category] === 'blocked') {
                        effectivelyBlockedCategories.push(category);
                    } else if (effectiveCategoryStatus[category] === 'available') {
                        availableCategories.push(category);
                    }
                });
            } else {
                // FIXED: Normal case - use effective category status for all categories (not just when @all is granted)
                // BUT exclude implicit partial categories that are shown in granted column

                // Use pre-calculated implicit partial categories (computed at the beginning of this method)
                this.state.allCategories.forEach(category => {
                    // Skip categories that are explicitly granted (but allow partial categories in both columns)
                    if (this.state.grantedCategories.has(category)) {
                        return;
                    }

                    if (effectiveCategoryStatus[category] === 'blocked') {
                        effectivelyBlockedCategories.push(category);
                    } else if (effectiveCategoryStatus[category] === 'available') {
                        availableCategories.push(category);
                    }
                    // Categories with 'granted' status are handled in the granted section above
                });

                // Special handling for @all category
                // Only show @all as available (blocked) when the rule is truly empty (no inclusions at all)
                const hasAnyInclusions = this.state.grantedCategories.size > 0 || this.state.grantedCommands.size > 0;

                if (!this.state.grantedCategories.has('all') &&
                    !this.state.blockedCategories.has('all') &&
                    !hasAnyInclusions &&
                    !implicitPartialCategories.has('all')) {
                    // Only add if not already added by effectiveCategoryStatus logic
                    if (!availableCategories.includes('all') && !effectivelyBlockedCategories.includes('all')) {
                        availableCategories.unshift('all'); // Add @all at the beginning
                    }
                }
            }

            // Show blocked categories: EXPLICITLY blocked first, then partially blocked, then implicitly blocked
            // Collect all blocked categories with their types for smart sorting
            const blockedCategories = [];

            if (effectivelyBlockedCategories.length > 0) {
                effectivelyBlockedCategories.forEach(category => {
                    const isExplicitlyBlocked = this.state.blockedCategories.has(category);

                    if (isExplicitlyBlocked) {
                        // Explicitly blocked category (e.g., -@dangerous)
                        blockedCategories.push({ category, type: 'explicit', priority: 1 });
                    } else {
                        // Implicitly blocked category (available but not granted)
                        blockedCategories.push({ category, type: 'implicit', priority: 3 });
                    }
                });
            }

            // Add partially blocked categories (with individual command blocks)
            Array.from(implicitPartialBlockedCategories).forEach(category => {
                // Only add if not already in the list
                if (!blockedCategories.find(item => item.category === category)) {
                    blockedCategories.push({ category, type: 'partial', priority: 2 });
                }
            });

            if (blockedCategories.length > 0) {

                // Sort by priority first (explicit first), then by rule order for explicit blocks, then alphabetically
                blockedCategories.sort((a, b) => {
                    // Always put @all first
                    if (a.category === 'all') return -1;
                    if (b.category === 'all') return 1;

                    // Then sort by priority (explicit first)
                    if (a.priority !== b.priority) {
                        return a.priority - b.priority;
                    }

                    // For categories with same priority:
                    if (a.priority === 1 && b.priority === 1) {
                        // Both are explicitly blocked - sort by order in original rule
                        const aIndex = this.state.orderedTerms.findIndex(term =>
                            term.type === 'category' && term.operation === 'block' && term.value === a.category);
                        const bIndex = this.state.orderedTerms.findIndex(term =>
                            term.type === 'category' && term.operation === 'block' && term.value === b.category);

                        if (aIndex !== -1 && bIndex !== -1) {
                            return aIndex - bIndex; // Maintain rule order
                        }
                    }

                    // Default to alphabetical for implicit blocks or when rule order not found
                    return a.category.localeCompare(b.category);
                });


                // Process blocked categories with partial detection
                for (const { category, type } of blockedCategories) {
                    // Check if this explicitly blocked category is partially granted back
                    let categoryAnalysis = null;
                    if (type === 'explicit') {
                        categoryAnalysis = await this.detectPartiallyExplicitlyBlockedCategory(category);
                    }

                    const button = await this.createCategoryButton(category, 'blocked', categoryAnalysis, type);
                    this.elements.blockedCategoriesButtons.appendChild(button);
                }
            }

            // Show available categories after explicitly blocked categories
            if (availableCategories.length > 0) {
                // Sort categories, but keep @all at the front if present
                const sortedCategories = [...availableCategories];
                const hasAllInList = sortedCategories.includes('all');
                
                if (hasAllInList) {
                    // Remove @all from the list, sort the rest, then add @all back at the front
                    const withoutAll = sortedCategories.filter(cat => cat !== 'all').sort();
                    const finalOrder = ['all', ...withoutAll];
                    
                    for (const category of finalOrder) {
                        const button = await this.createCategoryButton(category, 'available');
                        button.dataset.stateInfo = `Click to grant @${category} category`;

                        // Special styling for @all when it's implicitly blocked (empty rule scenario)
                        if (category === 'all') {
                            const isEmptyRule = this.state.grantedCategories.size === 0 &&
                                               this.state.grantedCommands.size === 0 &&
                                               this.state.blockedCategories.size === 0 &&
                                               this.state.blockedCommands.size === 0;

                            if (isEmptyRule) {
                                button.style.opacity = '0.7';
                                button.dataset.stateInfo = `@${category} category (implicitly blocked - empty rule) - Click to grant`;
                            }
                        }
                        
                        this.elements.blockedCategoriesButtons.appendChild(button);
                    }
                } else {
                    // Normal sorting when @all is not in the list
                    for (const category of sortedCategories.sort()) {
                        const button = await this.createCategoryButton(category, 'available');
                        button.dataset.stateInfo = `Click to grant @${category} category`;

                        // Special styling for @all when it's implicitly blocked (empty rule scenario)
                        if (category === 'all') {
                            const isEmptyRule = this.state.grantedCategories.size === 0 &&
                                               this.state.grantedCommands.size === 0 &&
                                               this.state.blockedCategories.size === 0 &&
                                               this.state.blockedCommands.size === 0;

                            if (isEmptyRule) {
                                button.style.opacity = '0.7';
                                button.dataset.stateInfo = `@${category} category (implicitly blocked - empty rule) - Click to grant`;
                            }
                        }
                        
                        this.elements.blockedCategoriesButtons.appendChild(button);
                    }
                }
            }

            if (availableCategories.length === 0 && effectivelyBlockedCategories.length === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'No categories available';
                this.elements.blockedCategoriesButtons.appendChild(message);
            }

            // Update the blocked categories header (exclude @all from count as it's a pseudo-category)
            const blockedCategoryCount = effectivelyBlockedCategories.filter(cat => cat !== 'all').length +
                                         availableCategories.filter(cat => cat !== 'all').length;
            this.updateCategorySectionHeader('blocked', blockedCategoryCount);
        }
    },

    /**
     * Determine effective status of all categories based on ACL rule precedence
     * This handles the @all category properly according to rule order
     */
    async getEffectiveCategoryStatus() {
        const status = {};

        // Initialize all categories as available
        this.state.allCategories.forEach(category => {
            status[category] = 'available';
        });

        // Process ordered terms to determine final status based on precedence (later rules override earlier ones)
        this.state.orderedTerms.forEach(term => {
            if (term.type === 'category') {
                if (term.value === 'all') {
                    // @all affects all categories
                    this.state.allCategories.forEach(category => {
                        if (category !== 'all') { // Don't affect @all itself
                            status[category] = term.operation === 'grant' ? 'granted' : 'blocked';
                        }
                    });
                    status['all'] = term.operation === 'grant' ? 'granted' : 'blocked';
                } else {
                    // Individual category
                    status[term.value] = term.operation === 'grant' ? 'granted' : 'blocked';
                }
            }
        });

        // Check for implicit fully-granted categories (all commands individually granted)
        // These should have 'granted' status to prevent showing in blocked column
        for (const category of this.state.allCategories) {
            if (status[category] === 'available' && !this.state.grantedCategories.has(category)) {
                const categoryAnalysis = await this.detectPartialCategory(category);
                if (categoryAnalysis[category] === 'fully-granted') {
                    status[category] = 'granted';
                }
            }
        }

        return status;
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
            // Clear any existing content (including initial placeholders from HTML)
            this.elements.grantedCommandsButtons.innerHTML = '';

            // Create collapsible wrapper
            const wrapper = document.createElement('div');

            // Use the API response for accurate granted commands (respects ACL precedence)
            const allGrantedCommands = new Set();
            if (this.lastApiResponse && this.lastApiResponse.granted_commands) {
                // Use API response - this correctly handles ACL rule precedence
                this.lastApiResponse.granted_commands.forEach(cmd => allGrantedCommands.add(cmd));
            } else {
                // Fallback to old logic if no API response available
                const grantedViaCategories = await this.getCommandsGrantedByCategories();
                const effectiveGrantedViaCategories = grantedViaCategories.filter(cmd => !this.state.blockedCommands.has(cmd));
                this.state.grantedCommands.forEach(cmd => allGrantedCommands.add(cmd));
                effectiveGrantedViaCategories.forEach(cmd => allGrantedCommands.add(cmd));
            }

            if (allGrantedCommands.size === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'No individual commands granted';
                wrapper.appendChild(message);
            } else {
                // Separate explicitly granted from implicitly granted commands
                const explicitlyGrantedCommands = [];
                const implicitlyGrantedCommands = [];

                Array.from(allGrantedCommands).forEach(command => {
                    // Check if this command was explicitly granted as an individual command
                    const isIndividuallyGranted = this.state.grantedCommands.has(command);
                    if (isIndividuallyGranted) {
                        explicitlyGrantedCommands.push(command);
                    } else {
                        // Command is granted via category rules
                        implicitlyGrantedCommands.push(command);
                    }
                });

                // Show explicitly granted commands first (sorted), then implicitly granted (sorted)
                explicitlyGrantedCommands.sort().forEach(command => {
                    const isViaCategory = false; // Individual commands are not via category
                    const isIndividual = true; // Always true for this group
                    const button = this.createGrantedCommandButton(command, isViaCategory, isIndividual);
                    wrapper.appendChild(button);
                });

                implicitlyGrantedCommands.sort().forEach(command => {
                    const isViaCategory = true; // Commands granted via category rules
                    const isIndividual = false; // Always false for this group
                    const button = this.createGrantedCommandButton(command, isViaCategory, isIndividual);
                    wrapper.appendChild(button);
                });
            }
            
            wrapper.className = 'command-buttons';
            this.elements.grantedCommandsButtons.appendChild(wrapper);
            
            // Update header with command count
            this.updateCommandSectionHeader('granted', allGrantedCommands.size);
        }

        // Render blocked/available commands
        if (this.elements.blockedCommandsButtons) {
            // Clear any existing content (including initial placeholders from HTML)
            this.elements.blockedCommandsButtons.innerHTML = '';
            
            const wrapper = document.createElement('div');
            const isEmptyACL = this.state.grantedCategories.size === 0 && this.state.grantedCommands.size === 0;
            
            if (isEmptyACL && this.state.allCommands.length > 0) {
                // Show ALL available commands as clickable buttons to grant
                const allAvailableForEmptyACL = this.state.allCommands.filter(cmd => 
                    !this.state.grantedCommands.has(cmd) && !this.state.blockedCommands.has(cmd)
                );
                
                if (allAvailableForEmptyACL.length > 0) {
                    allAvailableForEmptyACL.sort().forEach(command => {
                        const button = this.createCommandButton(command, 'available');
                        button.dataset.stateInfo = `Click to grant ${command} command`;
                        wrapper.appendChild(button);
                    });
                }
            }
            
            // Get all granted commands from the actual API response (most accurate)
            let allGrantedCommands = new Set();
            if (this.lastApiResponse && this.lastApiResponse.granted_commands) {
                this.lastApiResponse.granted_commands.forEach(cmd => allGrantedCommands.add(cmd));
            } else {
                // Fallback: Get granted commands via separate API calls
                const grantedViaCategories = await this.getCommandsGrantedByCategories();
                allGrantedCommands = new Set([...this.state.grantedCommands, ...grantedViaCategories]);
            }

            // Get commands blocked by categories (like -@dangerous commands)
            const commandsBlockedByCategories = await this.getCommandsBlockedByCategories();
            const categoryBlockedSet = new Set(commandsBlockedByCategories);

            // Classify all commands into proper buckets
            const commandsToShow = [];

            // 1. EXPLICITLY BLOCKED commands (highlighted) - commands with -command in rule
            // BUT only if they are not effectively granted by later rules
            Array.from(this.state.blockedCommands).forEach(command => {
                // Skip if this command is effectively granted (API says it's granted)
                if (!allGrantedCommands.has(command)) {
                    commandsToShow.push({ command, type: 'explicit', priority: 1, visual: 'highlighted' });
                }
            });

            // 2. BLOCKED BY CATEGORIES (highlighted) - commands blocked by -@category rules
            const effectivelyBlockedByCategories = commandsBlockedByCategories.filter(cmd =>
                !this.state.grantedCommands.has(cmd) && // Not overridden by explicit grant
                !this.state.blockedCommands.has(cmd)    // Not already in explicit blocked list
            );
            effectivelyBlockedByCategories.forEach(command => {
                commandsToShow.push({ command, type: 'category', priority: 2, visual: 'highlighted' });
            });

            // 3. IMPLICITLY BLOCKED commands (darkened) - commands not granted by any rule
            if (!isEmptyACL) {
                const implicitlyBlockedCommands = this.state.allCommands.filter(cmd =>
                    !allGrantedCommands.has(cmd) &&        // Not granted by any rule
                    !this.state.blockedCommands.has(cmd) && // Not explicitly blocked
                    !categoryBlockedSet.has(cmd)            // Not blocked by category
                );

                implicitlyBlockedCommands.forEach(command => {
                    commandsToShow.push({ command, type: 'implicit', priority: 3, visual: 'darkened' });
                });
            }

            if (commandsToShow.length > 0) {
                // Sort by priority first (explicit first), then alphabetically
                commandsToShow.sort((a, b) => {
                    if (a.priority !== b.priority) {
                        return a.priority - b.priority; // Lower priority number = higher precedence
                    }
                    return a.command.localeCompare(b.command);
                });

                commandsToShow.forEach(({ command, type }) => {
                    const button = this.createCommandButton(command, 'blocked', type);
                    wrapper.appendChild(button);
                });
            }

            // Show message when there are no individual commands to show at all
            if (commandsToShow.length === 0 && wrapper.children.length === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'No individual commands blocked';
                wrapper.appendChild(message);
            }
            
            wrapper.className = 'command-buttons';
            this.elements.blockedCommandsButtons.appendChild(wrapper);

            // Calculate total blocked command count for header
            // For empty ACL, show total available commands since they're all effectively blocked
            const blockedCount = isEmptyACL ? this.state.allCommands.length : commandsToShow.length;
            this.updateCommandSectionHeader('blocked', blockedCount);
        }
    },

    /**
     * Update command section header with count
     */
    updateCommandSectionHeader(type, count) {
        const sectionId = type === 'granted' ? 'grantedCommands' : 'blockedCommands';
        const section = document.getElementById(sectionId);
        const header = section?.querySelector('h3');
        
        if (header) {
            const text = 'Individual Commands';
            header.textContent = `${text}${count > 0 ? ` (${count})` : ''}`;
        }
    },

    /**
     * Analyze category states based on granted commands
     * Returns object with category states: 'blocked', 'partial', 'fully-granted'
     */
    async analyzeCategoryStates() {
        const categoryStates = {};
        
        // Process categories in parallel for better performance
        const categoryAnalysisPromises = this.state.allCategories.map(async (category) => {
            // Get commands for this category from backend
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                return { category, state: 'blocked' };
            }
            
            const categoryCommandSet = new Set(categoryCommands);
            
            // Count how many of this category's commands are granted
            const grantedInCategory = Array.from(categoryCommandSet).filter(cmd => 
                this.state.grantedCommands.has(cmd)
            ).length;
            
            const totalInCategory = categoryCommandSet.size;
            
            let state;
            if (grantedInCategory === 0) {
                state = 'blocked';
            } else if (grantedInCategory === totalInCategory) {
                state = 'fully-granted';
            } else {
                state = 'partial';
            }
            
            return { category, state };
        });
        
        // Wait for all analyses to complete
        const analyses = await Promise.all(categoryAnalysisPromises);
        
        // Convert to object format
        analyses.forEach(({ category, state }) => {
            categoryStates[category] = state;
        });
        
        return categoryStates;
    },

    /**
     * Get commands for a specific category
     */
    async getCategoryCommands(category) {
        try {
            // Use the API to parse a rule with just this category to get its commands
            const result = await API.parseRule(`+@${category}`, AppState.currentVersion);
            return result.granted_commands || [];
        } catch (error) {
            console.error(`Error getting commands for category ${category}:`, error);
            return [];
        }
    },
    
    /**
     * Detect if a category is partially blocked (has some commands blocked individually)
     * Returns analysis object for use with createCategoryButton
     */
    async detectPartiallyBlockedCategory(category) {
        try {
            // Special handling for @all category
            if (category === 'all') {
                const isExplicitlyBlocked = this.state.blockedCategories.has('all');
                const isExplicitlyGranted = this.state.grantedCategories.has('all');

                // If @all is explicitly granted or blocked, respect that
                if (isExplicitlyGranted) {
                    return { [category]: 'granted' };
                }
                if (isExplicitlyBlocked) {
                    return { [category]: 'blocked' };
                }

                // Check if all categories are explicitly granted (making @all implicitly granted)
                const allCategoriesExceptAll = this.state.allCategories.filter(cat => cat !== 'all');
                const explicitlyGrantedCategoriesExceptAll = Array.from(this.state.grantedCategories).filter(cat => cat !== 'all');
                const allCategoriesExplicitlyGranted = explicitlyGrantedCategoriesExceptAll.length === allCategoriesExceptAll.length &&
                                                     allCategoriesExceptAll.length > 0;

                if (allCategoriesExplicitlyGranted) {
                    // All categories are explicitly granted, so @all is implicitly granted
                    return { [category]: 'granted' };
                }

                // @all is considered "partially blocked" when there are any exclusions but @all is not explicitly blocked/granted
                const hasAnyExclusions = this.state.blockedCategories.size > 0 || this.state.blockedCommands.size > 0;

                if (hasAnyExclusions) {
                    return { [category]: 'partial' };
                } else {
                    return { [category]: 'blocked' };
                }
            }

            // Get all commands in this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                return { [category]: 'blocked' };
            }

            // Get all commands that are currently blocked by the ACL rule (from API response)
            const allBlockedCommands = new Set();
            if (this.lastApiResponse && this.lastApiResponse.blocked_commands) {
                this.lastApiResponse.blocked_commands.forEach(cmd => allBlockedCommands.add(cmd));
            } else {
                // If no API response, assume everything is blocked (default state)
                return { [category]: 'blocked' };
            }

            // Get individual command blocks from the parsed rule
            const individuallyBlockedCommands = new Set();
            if (this.lastApiResponse && this.lastApiResponse.parsed_rule && this.lastApiResponse.parsed_rule.command_rules) {
                this.lastApiResponse.parsed_rule.command_rules.forEach(rule => {
                    if (rule.target === 'command' && rule.type === 'deny') {
                        individuallyBlockedCommands.add(rule.value);
                    }
                });
            }

            // Check how many commands in this category are blocked through individual commands
            const categoryCommandSet = new Set(categoryCommands);
            const individuallyBlockedInCategory = Array.from(categoryCommandSet).filter(cmd =>
                individuallyBlockedCommands.has(cmd)
            ).length;

            if (individuallyBlockedInCategory > 0) {
                // Some commands blocked individually - this is a partially blocked category
                return { [category]: 'partial' };
            } else {
                return { [category]: 'blocked' };
            }
        } catch (error) {
            console.error(`Error detecting partially blocked category ${category}:`, error);
            return { [category]: 'blocked' };
        }
    },

    /**
     * Detect if a granted category is partial (has blocked subcommands)
     * For implicit partial categories, only show when commands are granted through individual command grants,
     * not through other category grants.
     * Returns analysis object for use with createCategoryButton
     */
    async detectPartialCategory(category) {
        try {
            // Special handling for @all category
            if (category === 'all') {
                // @all is considered "partially granted" when there are any inclusions but @all is not explicitly granted
                const hasAnyInclusions = this.state.grantedCategories.size > 0 || this.state.grantedCommands.size > 0;
                const isExplicitlyGranted = this.state.grantedCategories.has('all');
                if (hasAnyInclusions && !isExplicitlyGranted) {
                    return { [category]: 'partial' };
                } else if (isExplicitlyGranted) {
                    // @all is explicitly granted - check if it's partial due to exclusions
                    const hasExclusions = this.state.blockedCategories.size > 0 || this.state.blockedCommands.size > 0;
                    return { [category]: hasExclusions ? 'partial' : 'fully-granted' };
                } else {
                    return { [category]: 'blocked' };
                }
            }

            // Get all commands in this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                return { [category]: 'blocked' };
            }

            // Get all commands that are currently granted by the ACL rule (from API response)
            const allGrantedCommands = new Set();
            if (this.lastApiResponse && this.lastApiResponse.granted_commands) {
                this.lastApiResponse.granted_commands.forEach(cmd => allGrantedCommands.add(cmd));
            } else {
                return { [category]: 'blocked' };
            }

            // For implicit partial detection, we need to check if commands are granted through individual commands
            // vs through category grants
            const isExplicitlyGranted = this.state.grantedCategories.has(category);

            if (!isExplicitlyGranted) {
                // For implicit categories, only show as partial based on individual command grants/blocks
                // Exception: @all category can be partial based on other category grants/blocks

                const categoryCommandSet = new Set(categoryCommands);

                if (category === 'all') {
                    // Special handling for @all - can be partial due to any exclusions
                    const grantedInCategory = Array.from(categoryCommandSet).filter(cmd =>
                        allGrantedCommands.has(cmd)
                    ).length;

                    if (grantedInCategory === 0) {
                        return { [category]: 'blocked' };
                    } else if (grantedInCategory === categoryCommands.length) {
                        return { [category]: 'fully-granted' };
                    } else {
                        return { [category]: 'partial' };
                    }
                } else {
                    // For other categories, only show as partial if there are individual command grants
                    const individuallyGrantedCommands = new Set();
                    const individuallyBlockedCommands = new Set();

                    // Get individual command grants and blocks from the parsed rule
                    if (this.lastApiResponse && this.lastApiResponse.parsed_rule && this.lastApiResponse.parsed_rule.command_rules) {
                        this.lastApiResponse.parsed_rule.command_rules.forEach(rule => {
                            if (rule.target === 'command' && rule.type === 'allow') {
                                individuallyGrantedCommands.add(rule.value);
                            } else if (rule.target === 'command' && rule.type === 'deny') {
                                individuallyBlockedCommands.add(rule.value);
                            }
                        });
                    }

                    // Check how many commands in this category have individual grants/blocks
                    const individuallyGrantedInCategory = Array.from(categoryCommandSet).filter(cmd =>
                        individuallyGrantedCommands.has(cmd)
                    ).length;

                    const individuallyBlockedInCategory = Array.from(categoryCommandSet).filter(cmd =>
                        individuallyBlockedCommands.has(cmd)
                    ).length;

                    // Check how many commands in this category are actually granted (regardless of how)
                    const totalGranted = Array.from(categoryCommandSet).filter(cmd =>
                        allGrantedCommands.has(cmd)
                    ).length;

                    // If no commands are granted, it's blocked
                    if (totalGranted === 0) {
                        return { [category]: 'blocked' };
                    }

                    // If all commands are granted, check if they're granted individually or through categories
                    if (totalGranted === categoryCommands.length) {
                        // Only mark as fully-granted if there are individual command grants to work with
                        // Otherwise, they're granted through other categories and should not show as actionable
                        if (individuallyGrantedInCategory > 0) {
                            return { [category]: 'fully-granted' };
                        } else {
                            // All commands granted through other categories - not actionable
                            return { [category]: 'blocked' }; // Don't show in granted column
                        }
                    }

                    // If only some commands are granted, check if there are individual terms to show as partial
                    const hasIndividualTerms = individuallyGrantedInCategory > 0 || individuallyBlockedInCategory > 0;
                    if (hasIndividualTerms) {
                        return { [category]: 'partial' };
                    } else {
                        // Some granted but no individual terms - granted through other categories
                        return { [category]: 'blocked' };
                    }
                }
            } else {
                // For explicitly granted categories, use the original logic
                const categoryCommandSet = new Set(categoryCommands);
                const grantedInCategory = Array.from(categoryCommandSet).filter(cmd =>
                    allGrantedCommands.has(cmd)
                ).length;

                const totalInCategory = categoryCommandSet.size;

                // Determine the category state
                let state;
                if (grantedInCategory === 0) {
                    state = 'blocked';
                } else if (grantedInCategory === totalInCategory) {
                    state = 'fully-granted';
                } else {
                    state = 'partial';
                }

                return { [category]: state };
            }
        } catch (error) {
            console.error(`Error detecting partial category ${category}:`, error);
            return { [category]: 'fully-granted' }; // Default to fully-granted on error
        }
    },

    /**
     * Detect if a category is "partially explicitly blocked" - explicitly blocked but some commands granted back
     * For example: +@all -@transaction +discard
     * Returns analysis object for use with createCategoryButton
     */
    async detectPartiallyExplicitlyBlockedCategory(category) {
        try {
            // Only applies to explicitly blocked categories
            if (!this.state.blockedCategories.has(category)) {
                return { [category]: 'not-applicable' };
            }

            // Get all commands in this category
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) {
                return { [category]: 'not-applicable' };
            }

            // Get all commands that are currently granted by the ACL rule (from API response)
            const allGrantedCommands = new Set();
            if (this.lastApiResponse && this.lastApiResponse.granted_commands) {
                this.lastApiResponse.granted_commands.forEach(cmd => allGrantedCommands.add(cmd));
            } else {
                return { [category]: 'fully-blocked' };
            }

            // Check how many commands in this category are granted despite the category being blocked
            const categoryCommandSet = new Set(categoryCommands);
            const grantedInCategory = Array.from(categoryCommandSet).filter(cmd =>
                allGrantedCommands.has(cmd)
            ).length;

            if (grantedInCategory === 0) {
                return { [category]: 'fully-blocked' };
            } else if (grantedInCategory === categoryCommands.length) {
                // This shouldn't happen in a well-formed rule, but handle it
                return { [category]: 'fully-granted-despite-block' };
            } else {
                return { [category]: 'partially-explicitly-blocked' };
            }
        } catch (error) {
            console.error(`Error detecting partially explicitly blocked category ${category}:`, error);
            return { [category]: 'fully-blocked' }; // Default on error
        }
    },
    
    /**
     * Cache for category commands to avoid repeated API calls
     */
    _categoryCommandsCache: new Map(),
    
    /**
     * Get commands for a specific category with caching
     */
    async getCategoryCommandsCached(category) {
        const cacheKey = `${AppState.currentVersion}:${category}`;
        
        if (this._categoryCommandsCache.has(cacheKey)) {
            return this._categoryCommandsCache.get(cacheKey);
        }
        
        const commands = await this.getCategoryCommands(category);
        this._categoryCommandsCache.set(cacheKey, commands);
        return commands;
    },

    /**
     * Add enhanced tooltip functionality with relationship information
     */
    addEnhancedTooltip(button, type, name) {
        let tooltipElement = null;
        let hideTimeout = null;
        let showTimeout = null;

        const cleanupTooltip = () => {
            // Clear all timeouts
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            if (showTimeout) {
                clearTimeout(showTimeout);
                showTimeout = null;
            }

            // Remove tooltip element
            if (tooltipElement) {
                tooltipElement.remove();
                tooltipElement = null;
            }
        };

        const showTooltip = async () => {

            // Clear any hide timeouts when mouse enters button
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;

                // If tooltip already exists, don't restart the show process
                if (tooltipElement) {
                    return;
                }
            }

            // Clear any existing timeouts and tooltips
            cleanupTooltip();

            // Add 1-second delay before showing tooltip
            showTimeout = setTimeout(async () => {
                // Double-check that we should still show tooltip
                if (!showTimeout) {
                    return;
                }

                try {
                    let content = '';

                    // Get state information from the button
                    const stateInfo = button.dataset.stateInfo || '';

                    // Determine color based on button location/state (red for blocked, green for granted)
                    let titleClass = 'tooltip-title';

                    // Check if button is in granted column by looking at its container
                    const isInGrantedColumn = button.closest('#grantedCategories, #grantedCommands');
                    const isInBlockedColumn = button.closest('#blockedCategories, #blockedCommands');


                    if (isInGrantedColumn) {
                        titleClass += ' granted'; // Green for granted
                    } else if (isInBlockedColumn) {
                        titleClass += ' blocked'; // Red for blocked
                    }

                    // Build tooltip content with state info and relationships
                    content = `<div class="${titleClass}">${type === 'category' ? '@' : ''}${name}</div>`;

                    // Add state information if available
                    if (stateInfo) {
                        content += `<div class="tooltip-state">${stateInfo.replace(/\n/g, '<br/>')}</div>`;
                    }

                    // Add relationship information
                    if (type === 'command') {
                        // Get categories for this command
                        const response = await API.getCommandInfo(name, AppState.currentVersion);
                        if (response.success && response.categories && response.categories.length > 0) {
                            const categories = response.categories.sort();
                            const displayCategories = categories.slice(0, 8);
                            const remaining = categories.length - displayCategories.length;

                            let relationshipContent = `Member of categories:<br/>• @${displayCategories.join('<br/>• @')}`;
                            if (remaining > 0) {
                                const linkColorClass = isInGrantedColumn ? 'granted' : (isInBlockedColumn ? 'blocked' : '');
                                relationshipContent += `<br/>• <span class="expandable-link ${linkColorClass}" data-type="categories" data-full-list="${categories.join(',')}" data-showing="${displayCategories.length}">... and ${remaining} more</span>`;
                            }
                            content += `<div class="tooltip-content">${relationshipContent}</div>`;
                        } else {
                            content += `<div class="tooltip-content">No category information available</div>`;
                        }
                    } else if (type === 'category') {
                        // Get commands for this category
                        const commands = await this.getCategoryCommandsCached(name);
                        if (commands && commands.length > 0) {
                            const sortedCommands = commands.sort();
                            const displayCommands = sortedCommands.slice(0, 8);
                            const remaining = sortedCommands.length - displayCommands.length;

                            let relationshipContent = `Contains ${sortedCommands.length} commands:<br/>• ${displayCommands.join('<br/>• ')}`;
                            if (remaining > 0) {
                                const linkColorClass = isInGrantedColumn ? 'granted' : (isInBlockedColumn ? 'blocked' : '');
                                relationshipContent += `<br/>• <span class="expandable-link ${linkColorClass}" data-type="commands" data-full-list="${sortedCommands.join(',')}" data-showing="${displayCommands.length}">... and ${remaining} more</span>`;
                            }
                            content += `<div class="tooltip-content">${relationshipContent}</div>`;
                        } else {
                            content += `<div class="tooltip-content">No commands found</div>`;
                        }
                    }

                    // Create tooltip element
                    tooltipElement = document.createElement('div');
                    tooltipElement.className = 'enhanced-tooltip';
                    tooltipElement.innerHTML = content;

                    // Get positioning info BEFORE adding to DOM
                    const rect = button.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                    // Validate positioning values
                    if (rect.width === 0 || rect.height === 0) {
                        console.warn('Invalid button rect for tooltip positioning');
                        cleanupTooltip();
                        return;
                    }

                    // Initial positioning (off-screen to measure)
                    tooltipElement.style.position = 'absolute';
                    tooltipElement.style.left = '-9999px';
                    tooltipElement.style.top = '-9999px';
                    tooltipElement.style.zIndex = '10000';
                    tooltipElement.style.visibility = 'hidden';

                    document.body.appendChild(tooltipElement);

                    // Get tooltip dimensions
                    const tooltipRect = tooltipElement.getBoundingClientRect();

                    // Calculate desired position
                    let left = rect.left + scrollLeft + rect.width / 2 - tooltipRect.width / 2;
                    let top = rect.bottom + scrollTop + 8;

                    // Adjust horizontal position if tooltip goes off screen
                    if (left < 10) {
                        left = 10 + scrollLeft;
                    } else if (left + tooltipRect.width > window.innerWidth - 10) {
                        left = window.innerWidth - tooltipRect.width - 10 + scrollLeft;
                    }

                    // Adjust vertical position if tooltip goes below viewport
                    if (top + tooltipRect.height > window.innerHeight + scrollTop - 10) {
                        top = rect.top + scrollTop - tooltipRect.height - 8;
                    }

                    // Ensure tooltip doesn't go above viewport
                    if (top < scrollTop + 10) {
                        top = rect.bottom + scrollTop + 8; // Default to below
                    }

                    // Apply final positioning
                    tooltipElement.style.left = `${left}px`;
                    tooltipElement.style.top = `${top}px`;
                    tooltipElement.style.visibility = 'visible';
                    tooltipElement.style.transform = 'none';

                    // Add event listeners to keep tooltip visible when hovering over it
                    tooltipElement.addEventListener('mouseenter', () => {
                        // Clear any hide timeouts when mouse enters tooltip
                        if (hideTimeout) {
                            clearTimeout(hideTimeout);
                            hideTimeout = null;
                        }
                        // Also clear show timeout to avoid conflicts
                        if (showTimeout) {
                            clearTimeout(showTimeout);
                            showTimeout = null;
                        }
                    });

                    tooltipElement.addEventListener('mouseleave', () => {
                        // Use same delay as button mouseleave for consistency
                        hideTimeout = setTimeout(() => {
                            cleanupTooltip();
                        }, 200);
                    });

                    // Add click handlers for expandable links
                    const expandableLinks = tooltipElement.querySelectorAll('.expandable-link');
                    expandableLinks.forEach(link => {
                        link.style.cursor = 'pointer';
                        link.style.color = 'var(--primary-color)';
                        link.style.textDecoration = 'underline';

                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const type = link.dataset.type;
                            const fullList = link.dataset.fullList.split(',');

                            // Replace the abbreviated list with the full list using multi-column layout for large lists
                            if (type === 'categories') {
                                const newContent = this.createMultiColumnContent('Member of categories:', fullList, '@');
                                link.parentNode.innerHTML = newContent;
                            } else if (type === 'commands') {
                                const newContent = this.createMultiColumnContent(`Contains ${fullList.length} commands:`, fullList);
                                link.parentNode.innerHTML = newContent;
                            }

                            // Mark tooltip as expanded for larger sizing
                            tooltipElement.classList.add('expanded');
                        });
                    });

                } catch (error) {
                    console.warn('Failed to load enhanced tooltip:', error);
                    cleanupTooltip();
                }
            }, 1000); // 1-second delay
        };

        const hideTooltip = () => {
            // Add a small delay to allow moving mouse to tooltip
            hideTimeout = setTimeout(() => {
                cleanupTooltip();
            }, 200); // 200ms delay
        };

        // Add event listeners
        button.addEventListener('mouseenter', showTooltip);
        button.addEventListener('mouseleave', hideTooltip);

        // CRITICAL: Hide tooltip when button is clicked
        button.addEventListener('click', cleanupTooltip);

        // Hide tooltip when button loses focus
        button.addEventListener('blur', cleanupTooltip);

        // Hide tooltip on scroll (prevents positioning issues)
        window.addEventListener('scroll', cleanupTooltip, { passive: true });

        // Hide tooltip on window resize
        window.addEventListener('resize', cleanupTooltip, { passive: true });
    },

    /**
     * Create multi-column content for large lists in tooltips
     */
    createMultiColumnContent(title, items, prefix = '') {
        const itemCount = items.length;

        // Use single column for small lists
        if (itemCount <= 12) {
            const itemsWithPrefix = items.map(item => `${prefix}${item}`);
            return `${title}<br/>• ${itemsWithPrefix.join('<br/>• ')}`;
        }

        // Determine number of columns based on item count
        let columns;
        if (itemCount <= 30) {
            columns = 2;
        } else if (itemCount <= 60) {
            columns = 3;
        } else {
            columns = 4;
        }

        // Calculate items per column
        const itemsPerColumn = Math.ceil(itemCount / columns);

        // Split items into columns
        const columnData = [];
        for (let i = 0; i < columns; i++) {
            const start = i * itemsPerColumn;
            const end = Math.min(start + itemsPerColumn, itemCount);
            columnData.push(items.slice(start, end));
        }

        // Build HTML with grid layout
        let html = `${title}<div class="tooltip-columns cols-${columns}">`;

        columnData.forEach(columnItems => {
            html += '<div class="tooltip-column"><ul>';
            columnItems.forEach(item => {
                html += `<li>${prefix}${item}</li>`;
            });
            html += '</ul></div>';
        });

        html += '</div>';
        return html;
    },

    /**
     * Create a category button element
     */
    async createCategoryButton(category, state, categoryAnalysis = null, blockType = null) {
        const button = document.createElement('button');


        // Determine visual state and styling
        let buttonClass, tooltipText, clickHandler;
        
        if (state === 'granted') {
            const analysisState = categoryAnalysis?.[category];
            const isExplicitlyGranted = this.state.grantedCategories.has(category);


            if (analysisState === 'partial') {
                if (isExplicitlyGranted) {
                    // Explicit partial category inclusion (user explicitly granted category but some commands are excluded)
                    buttonClass = `category-button granted partial explicit`;
                    tooltipText = `@${category} category (explicitly partial) - Some commands in this category are excluded - Click to revoke`;
                    clickHandler = () => this.toggleCategory(category);
                } else {
                    // Implicit partial category inclusion (some commands granted individually)
                    buttonClass = `category-button granted partial implicit`;

                    if (category === 'all') {
                        // Special handling for @all - clicking should clear the entire rule to revoke all commands
                        tooltipText = `@${category} category (implicitly partial) - Some commands currently granted - Click to revoke ALL commands`;
                        clickHandler = () => this.clearAllCategory();
                    } else {
                        // Check if this is a partially explicitly blocked category showing in granted panel
                        if (this.state.blockedCategories.has(category)) {
                            tooltipText = `@${category} category (partially implicitly granted) - Category blocked but some commands granted back - Click to remove granted commands`;
                            clickHandler = () => this.removePartialGrantsFromBlockedCategory(category);
                        } else {
                            tooltipText = `@${category} category (implicitly partial) - Some commands granted individually - Click to remove all related terms`;
                            clickHandler = () => this.removeAllCategoryRelatedTerms(category);
                        }
                    }
                }
            } else if (analysisState === 'fully-granted' && !this.state.grantedCategories.has(category)) {
                // Implicitly granted (all commands granted individually)
                buttonClass = `category-button granted implicit`;
                tooltipText = `@${category} category (implicitly granted) - All commands granted individually - Click to remove all individual commands`;
                clickHandler = () => this.removeAllCategoryCommands(category);
            } else {
                // Check if this category is granted via @all (implicitly) or explicitly granted
                const isGrantedViaAll = this.state.grantedCategories.has('all') && !this.state.grantedCategories.has(category);

                if (isGrantedViaAll) {
                    // Check if this category has conflicting individual commands that make it partial
                    const hasConflictingCommands = await this.hasConflictingIndividualCommands(category);

                    if (category === 'fast') {
                    }

                    if (hasConflictingCommands) {
                        // Category granted via @all but has conflicting individual commands
                        buttonClass = `category-button granted partial implicit`;
                        tooltipText = `@${category} category (partially granted via @all) - Has conflicting individual commands - Click to remove conflicting commands`;
                        clickHandler = () => this.removeConflictingIndividualCommands(category);

                    } else {
                        // Cleanly granted via @all
                        buttonClass = `category-button granted implicit`;
                        tooltipText = `@${category} category (granted via @all) - Click to block`;
                        clickHandler = () => this.blockCategory(category);

                    }
                } else {
                    // Explicitly granted
                    buttonClass = `category-button granted explicit`;
                    tooltipText = `@${category} category (explicitly granted) - Click to revoke`;
                    clickHandler = () => this.toggleCategory(category);
                }
            }
        } else if (state === 'available') {
            buttonClass = `category-button blocked implicit`; // Available = implicitly blocked (not granted)
            tooltipText = `Click to grant @${category} category`;
            clickHandler = () => this.grantCategory(category);
        } else if (state === 'blocked') {
            // Determine if explicitly, partially, or implicitly blocked
            const analysisState = categoryAnalysis?.[category];

            if (analysisState === 'partially-explicitly-blocked') {
                // Partially explicitly blocked (category blocked but some commands granted back)
                buttonClass = `category-button blocked partial explicit`;
                tooltipText = `@${category} category (partially explicitly blocked) - Category blocked but some commands granted back - Click to grant full category`;
                clickHandler = () => this.grantCategoryAndRemoveConflictingCommands(category);
            } else if (blockType === 'explicit' || this.state.blockedCategories.has(category)) {
                buttonClass = `category-button blocked explicit`;
                tooltipText = `@${category} category (explicitly blocked) - Click to toggle`;
                clickHandler = () => this.toggleCategory(category);
            } else if (blockType === 'partial') {
                // Partially blocked category (some commands blocked individually)
                buttonClass = `category-button blocked partial implicit`;

                if (category === 'all') {
                    // Special handling for @all - clicking should grant all commands
                    tooltipText = `@${category} category (partially blocked) - Some commands currently blocked - Click to grant ALL commands`;
                    clickHandler = () => this.grantAllCategory();
                } else {
                    tooltipText = `@${category} category (partially blocked) - Some commands blocked individually - Click to grant full category`;
                    clickHandler = () => this.grantCategoryAndCleanup(category);
                }
            } else {
                buttonClass = `category-button blocked implicit`;
                tooltipText = `@${category} category (implicitly blocked) - Click to grant`;
                clickHandler = () => this.toggleCategory(category);
            }
        } else {
            buttonClass = `category-button ${state}`;
            tooltipText = `Click to ${state === 'granted' ? 'revoke' : 'grant'} @${category} category`;
            clickHandler = () => this.toggleCategory(category);
        }
        
        button.className = buttonClass;
        // Add visual debug indicator for partial categories
        if (buttonClass.includes('partial')) {
            button.textContent = `@${category} ⚠`;
        } else {
            button.textContent = `@${category}`;
        }
        button.dataset.stateInfo = tooltipText;

        button.onclick = clickHandler;

        // Add enhanced tooltip on hover
        this.addEnhancedTooltip(button, 'category', category);

        return button;
    },

    /**
     * Create a command button element
     */
    createCommandButton(command, state, blockType = null) {
        const button = document.createElement('button');

        if (state === 'available') {
            button.className = `command-button blocked implicit`; // Available = implicitly blocked
            button.dataset.stateInfo = `Click to grant ${command} command`;
            button.onclick = () => this.grantCommand(command);
        } else if (state === 'blocked') {
            // Handle visual differentiation for blocked commands
            if (blockType === 'explicit') {
                // Explicitly blocked commands (highlighted - like -acl|deluser)
                button.className = `command-button blocked explicit`;
                button.dataset.stateInfo = `${command} - EXPLICITLY BLOCKED\nThis command was individually blocked.\nClick to make it available.`;
                button.onclick = () => this.toggleCommand(command);
            } else if (blockType === 'category') {
                // Commands blocked by category exclusions (darkened - like -@admin commands)
                button.className = `command-button blocked implicit`; // Use implicit styling (darkened)
                button.dataset.stateInfo = `${command} - BLOCKED BY CATEGORY\nThis command is blocked by an excluded category.\nClick to explicitly grant it.`;
                button.onclick = () => this.grantCommand(command);
            } else if (blockType === 'implicit') {
                // Implicitly blocked commands (darkened - not granted by any rule)
                button.className = `command-button blocked implicit`;
                button.dataset.stateInfo = `${command} - NOT GRANTED\nThis command is not granted by any rule.\nClick to grant it.`;
                button.onclick = () => this.grantCommand(command);
            } else {
                // Fallback - check if command is in blockedCommands set
                if (this.state.blockedCommands.has(command)) {
                    button.className = `command-button blocked explicit`;
                    button.dataset.stateInfo = `${command} - EXPLICITLY BLOCKED\nThis command was individually blocked.\nClick to make it available.`;
                    button.onclick = () => this.toggleCommand(command);
                } else {
                    button.className = `command-button blocked implicit`;
                    button.dataset.stateInfo = `${command} - BLOCKED BY CATEGORY\nThis command is blocked by an excluded category.\nClick to explicitly grant it.`;
                    button.onclick = () => this.toggleCommand(command);
                }
            }
        } else {
            button.className = `command-button ${state}`;
            button.dataset.stateInfo = `Click to ${state === 'granted' ? 'revoke' : 'grant'} ${command} command`;
            button.onclick = () => this.toggleCommand(command);
        }

        button.textContent = command;

        // Add enhanced tooltip on hover
        this.addEnhancedTooltip(button, 'command', command);

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
            button.classList.add('explicit');
            button.dataset.stateInfo = `${command} - EXPLICITLY GRANTED\nThis command was directly added to your ACL rule.\nClick to revoke.`;
            button.onclick = () => this.toggleCommand(command);
        } else if (isViaCategory) {
            // If only granted via category, use exclusion behavior
            button.classList.add('implicit');
            button.dataset.stateInfo = `${command} - IMPLICITLY GRANTED\nThis command is granted through a category.\nClick to explicitly exclude it from the category.`;
            button.onclick = () => this.blockCommandFromCategory(command);
        }

        // Add enhanced tooltip on hover
        this.addEnhancedTooltip(button, 'command', command);

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

        // Update ordered terms - remove any existing entries for this command and add new block
        this.state.orderedTerms = this.state.orderedTerms.filter(term =>
            !(term.type === 'command' && term.value === command)
        );
        this.state.orderedTerms.push({ type: 'command', operation: 'block', value: command });

        // Mark that we should check for comprehensive optimization after render
        this.state.shouldComprehensiveOptimize = true;

        // Check if this command completes a category block and auto-simplify if so
        await this.finalizeStateChange();
    },

    /**
     * Check if any categories are now fully granted/blocked via individual commands
     * and automatically simplify them to category grants/blocks
     */
    async checkAndAutoSimplifyCategories() {
        // Get all categories for current Redis version
        if (!this.state.allCategories || this.state.allCategories.length === 0) {
            return;
        }

        const optimizations = [
            await this.detectCancelledAllPattern(),
            await this.detectAllCategoriesPattern(),
            await this.detectIndividualCategoryOptimizations()
        ].flat().filter(Boolean);

        await this.applyOptimizations(optimizations);
    },

    /**
     * Detect cancelled @all pattern - @all granted but all other categories blocked = empty ACL
     */
    async detectCancelledAllPattern() {
        const hasAllGranted = this.state.grantedCategories.has('all');
        if (!hasAllGranted) return null;

        const allCategoriesExceptAll = this.state.allCategories.filter(cat => cat !== 'all');
        const explicitlyBlockedCategoriesExceptAll = Array.from(this.state.blockedCategories).filter(cat => cat !== 'all');

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
    async detectAllCategoriesPattern() {
        const hasAllGranted = this.state.grantedCategories.has('all');
        if (hasAllGranted) return null;

        const allCategoriesExceptAll = this.state.allCategories.filter(cat => cat !== 'all');
        const explicitlyGrantedCategoriesExceptAll = Array.from(this.state.grantedCategories).filter(cat => cat !== 'all');

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
     * Detect individual category optimizations (cancelled exclusions, full grants, full blocks)
     */
    async detectIndividualCategoryOptimizations() {
        // Skip individual category checking if we have an all-categories pattern
        const allCategoriesPattern = await this.detectAllCategoriesPattern();
        if (allCategoriesPattern) return [];

        const optimizations = [];

        for (const category of this.state.allCategories) {
            const categoryCommands = await this.getCategoryCommandsCached(category);
            if (!categoryCommands || categoryCommands.length === 0) continue;

            // Check for cancelled-out exclusions (blocked category with all commands individually granted)
            if (this.state.blockedCategories.has(category)) {
                const cancelledExclusion = await this.detectCancelledExclusion(category, categoryCommands);
                if (cancelledExclusion) optimizations.push(cancelledExclusion);
                continue; // Skip further processing for blocked categories
            }

            // Check for null category pattern (granted category with all commands blocked)
            if (this.state.grantedCategories.has(category)) {
                const nullCategory = await this.detectNullCategory(category, categoryCommands);
                if (nullCategory) optimizations.push(nullCategory);
                continue; // Skip further processing for granted categories
            }

            // Check for full grant or block patterns
            const grantPattern = await this.detectFullCategoryGrant(category, categoryCommands);
            if (grantPattern) {
                optimizations.push(grantPattern);
            } else {
                const blockPattern = await this.detectFullCategoryBlock(category, categoryCommands);
                if (blockPattern) optimizations.push(blockPattern);
            }
        }

        return optimizations;
    },

    /**
     * Detect cancelled exclusion pattern - blocked category with all commands individually granted
     */
    async detectCancelledExclusion(category, categoryCommands) {
        const individuallyGrantedCommands = categoryCommands.filter(cmd =>
            this.state.grantedCommands.has(cmd)
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
    async detectNullCategory(category, categoryCommands) {
        const individuallyBlockedCommands = categoryCommands.filter(cmd =>
            this.state.blockedCommands.has(cmd)
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
    async detectFullCategoryGrant(category, categoryCommands) {
        const individuallyGrantedCommands = categoryCommands.filter(cmd =>
            this.state.grantedCommands.has(cmd)
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
    async detectFullCategoryBlock(category, categoryCommands) {
        const individuallyBlockedCommands = categoryCommands.filter(cmd =>
            this.state.blockedCommands.has(cmd)
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
     * Apply the detected optimizations
     */
    async applyOptimizations(optimizations) {
        if (optimizations.length === 0) return;

        // Apply optimizations
        for (const optimization of optimizations) {
            const { type, category, commands, count, categories, blockedCategories } = optimization;

            if (type === 'cancelled-all') {
                this.applyCancelledAllOptimization(count);
            } else if (type === 'all-categories') {
                this.applyAllCategoriesOptimization(count);
            } else if (type === 'cancel-exclusion') {
                this.applyCancelExclusionOptimization(category, commands, count);
            } else if (type === 'null-category') {
                this.applyNullCategoryOptimization(category, commands, count);
            } else if (type === 'grant') {
                this.applyCategoryGrantOptimization(category, commands, count);
            } else if (type === 'block') {
                this.applyCategoryBlockOptimization(category, commands, count);
            }
        }

        // Update rule text if any optimizations were applied
        if (optimizations.length > 0) {
            await this.updateRuleText();
        }
    },

    /**
     * Individual optimization application methods
     */
    applyCancelledAllOptimization(count) {
        // Clear all categories and commands - this results in empty ACL (only key patterns remain)
        this.state.grantedCategories.clear();
        this.state.blockedCategories.clear();
        this.state.grantedCommands.clear();
        this.state.blockedCommands.clear();

        // Remove all command and category terms from ordered list, keep only key patterns
        this.state.orderedTerms = this.StateManager.removeAllCommandAndCategoryTerms(this.state.orderedTerms);

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: cancelled @all pattern simplified to empty ACL (${count} blocked categories removed)`, 'success');
    },

    applyAllCategoriesOptimization(count) {
        // Clear all existing categories and replace with @all
        this.state.grantedCategories.clear();
        this.state.grantedCategories.add('all');

        // Remove all category grant terms from ordered list and replace with @all
        this.state.orderedTerms = this.state.orderedTerms.filter(term =>
            !(term.type === 'category' && term.operation === 'grant')
        );
        this.StateManager.addTerm(this.state.orderedTerms, 'category', 'grant', 'all');

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: replaced ${count} categories with "+@all"`, 'success');
    },

    applyCancelExclusionOptimization(category, commands, count) {
        // Remove the category block (since it's cancelled out)
        this.state.blockedCategories.delete(category);

        // Remove individual command grants (they're redundant now)
        commands.forEach(cmd => this.state.grantedCommands.delete(cmd));

        // Remove terms from ordered list
        this.state.orderedTerms = this.StateManager.removeTermsByCategory(this.state.orderedTerms, category, 'block');
        this.state.orderedTerms = this.StateManager.removeTermsByCommands(this.state.orderedTerms, commands, 'grant');

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: removed cancelled "-@${category}" and ${count} individual commands`, 'success');
    },

    applyNullCategoryOptimization(category, commands, count) {
        // Remove the category grant (since all its commands are blocked)
        this.state.grantedCategories.delete(category);

        // Remove individual command blocks (they're redundant now - category isn't granted)
        commands.forEach(cmd => this.state.blockedCommands.delete(cmd));

        // Remove terms from ordered list
        this.state.orderedTerms = this.StateManager.removeTermsByCategory(this.state.orderedTerms, category, 'grant');
        this.state.orderedTerms = this.StateManager.removeTermsByCommands(this.state.orderedTerms, commands, 'block');

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: null category "+@${category}" and ${count} individual command blocks cancelled out`, 'success');
    },

    applyCategoryGrantOptimization(category, commands, count) {
        // Remove individual command grants
        commands.forEach(cmd => this.state.grantedCommands.delete(cmd));

        // Remove individual command terms from ordered list
        this.state.orderedTerms = this.StateManager.removeTermsByCommands(this.state.orderedTerms, commands, 'grant');

        // Add category grant
        this.StateManager.toggleCategoryState(this.state, category, 'grant');
        this.StateManager.addTerm(this.state.orderedTerms, 'category', 'grant', category);

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: replaced ${count} commands with "+@${category}"`, 'success');
    },

    applyCategoryBlockOptimization(category, commands, count) {
        // Remove individual command blocks
        commands.forEach(cmd => this.state.blockedCommands.delete(cmd));

        // Remove individual command terms from ordered list
        this.state.orderedTerms = this.StateManager.removeTermsByCommands(this.state.orderedTerms, commands, 'block');

        // Add category block
        this.StateManager.toggleCategoryState(this.state, category, 'block');
        this.StateManager.addTerm(this.state.orderedTerms, 'category', 'block', category);

        // Show success notification
        this.showOptimizationNotification(`Auto-optimized: replaced ${count} command blocks with "-@${category}"`, 'success');
    },

    /**
     * Check for comprehensive optimization opportunities and auto-apply
     * Only called when shouldComprehensiveOptimize flag is true (button clicks)
     */
    async checkAndAutoOptimize() {
        const currentRule = this.elements.aclRuleInput.value.trim();

        // Skip optimization for empty rules
        if (!currentRule) {
            return;
        }

        try {
            const optimizeResponse = await API.optimizeRule(currentRule, AppState.currentVersion);

            if (optimizeResponse.success && optimizeResponse.savings > 0) {
                // Auto-apply the optimization for button clicks
                const optimizedRule = optimizeResponse.optimized_rule;

                // Update the textarea
                this.elements.aclRuleInput.value = optimizedRule;
                this.state.lastGeneratedRule = optimizedRule;

                // Show notification about the optimization
                this.showOptimizationNotification(
                    `Auto-optimized: Saved ${optimizeResponse.savings} term${optimizeResponse.savings > 1 ? 's' : ''} (${optimizeResponse.original_term_count} → ${optimizeResponse.optimized_term_count})`,
                    'success'
                );

                // Sync the optimized rule back to the builder state
                await this.syncFromRuleText();
            }
        } catch (error) {
            console.error('Auto-optimization check failed:', error);
            // Silently fail - don't disrupt user experience
        }
    },

    /**
     * Helper method for showing optimization notifications
     */
    showOptimizationNotification(message, type) {
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification(message, type);
        });
    },

    /**
     * State management utilities to reduce code duplication
     */
    StateManager: {
        /**
         * Remove terms by category from ordered terms array
         */
        removeTermsByCategory(orderedTerms, category, operation = null) {
            return orderedTerms.filter(term => {
                if (term.type !== 'category' || term.value !== category) return true;
                return operation ? term.operation !== operation : false;
            });
        },

        /**
         * Remove terms by command from ordered terms array
         */
        removeTermsByCommand(orderedTerms, command, operation = null) {
            return orderedTerms.filter(term => {
                if (term.type !== 'command' || term.value !== command) return true;
                return operation ? term.operation !== operation : false;
            });
        },

        /**
         * Remove terms by commands array from ordered terms array
         */
        removeTermsByCommands(orderedTerms, commands, operation = null) {
            return orderedTerms.filter(term => {
                if (term.type !== 'command' || !commands.includes(term.value)) return true;
                return operation ? term.operation !== operation : false;
            });
        },

        /**
         * Remove all command and category terms (keep only key patterns)
         */
        removeAllCommandAndCategoryTerms(orderedTerms) {
            return orderedTerms.filter(term =>
                !(term.type === 'category' || term.type === 'command')
            );
        },

        /**
         * Toggle category state between granted and blocked
         */
        toggleCategoryState(state, category, operation) {
            if (operation === 'grant') {
                state.grantedCategories.add(category);
                state.blockedCategories.delete(category);
            } else if (operation === 'block') {
                state.blockedCategories.add(category);
                state.grantedCategories.delete(category);
            }
        },

        /**
         * Toggle command state between granted and blocked
         */
        toggleCommandState(state, command, operation) {
            if (operation === 'grant') {
                state.grantedCommands.add(command);
                state.blockedCommands.delete(command);
            } else if (operation === 'block') {
                state.blockedCommands.add(command);
                state.grantedCommands.delete(command);
            }
        },

        /**
         * Add term to ordered terms if not already present
         */
        addTerm(orderedTerms, type, operation, value) {
            const existingIndex = orderedTerms.findIndex(term =>
                term.type === type && term.operation === operation && term.value === value
            );

            if (existingIndex === -1) {
                orderedTerms.push({ type, operation, value });
            }
        }
    },

    /**
     * DEBUG: Test function to simulate clicking all geo commands
     * Call this from browser console: window.ACLBuilder.testGeoAutoSimplify()
     */
    async testGeoAutoSimplify() {

        // Clear current state
        this.state.grantedCommands.clear();
        this.state.blockedCommands.clear();
        this.state.grantedCategories.clear();
        this.state.blockedCategories.clear();
        this.state.orderedTerms = [];

        // Get all geo commands for current Redis version
        const categoryCommands = await this.getCategoryCommandsCached('geo');

        // Grant each geo command one by one
        for (const command of categoryCommands) {
            await this.grantCommand(command);
        }

    },

    /**
     * Simplify individually granted commands to a category grant
     * This is called when clicking an implicitly granted category button
     */
    async simplifyToCategory(category) {
        // Get all commands for this category
        const categoryCommands = await this.getCategoryCommandsCached(category);
        if (!categoryCommands || categoryCommands.length === 0) {
            console.warn(`No commands found for category ${category}`);
            return;
        }

        // Remove all individual commands for this category from granted commands
        categoryCommands.forEach(cmd => {
            this.state.grantedCommands.delete(cmd);
        });

        // Remove individual command terms from ordered list
        this.state.orderedTerms = this.state.orderedTerms.filter(term =>
            !(term.type === 'command' && term.operation === 'grant' && categoryCommands.includes(term.value))
        );

        // Add category grant
        this.state.grantedCategories.add(category);
        this.state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });

        // Update rule text and re-render
        await this.updateRuleText();
        this.scheduleRender();

        // Show success notification
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification(`Simplified: replaced ${categoryCommands.length} commands with "+@${category}"`, 'success');
        });
    },

    /**
     * Remove all individual commands for a category (when clicking implicitly granted category)
     * This removes the individual commands without adding the category grant
     */
    async removeAllCategoryCommands(category) {
        // Get all commands for this category
        const categoryCommands = await this.getCategoryCommandsCached(category);
        if (!categoryCommands || categoryCommands.length === 0) {
            console.warn(`No commands found for category ${category}`);
            return;
        }

        // Remove all individual commands for this category from granted commands
        categoryCommands.forEach(cmd => this.state.grantedCommands.delete(cmd));

        // Remove individual command terms from ordered list
        this.state.orderedTerms = this.StateManager.removeTermsByCommands(this.state.orderedTerms, categoryCommands, 'grant');

        // Update rule text and re-render
        await this.updateRuleText();
        this.scheduleRender();

        // Show success notification
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification(`Removed ${categoryCommands.length} individual @${category} commands`, 'success');
        });
    },

    /**
     * Update the ACL rule text based on current state
     */
    async updateRuleText() {
        if (!this.elements.aclRuleInput) return;


        const rule = await this.generateOptimizedRule();
        // Mark as programmatic update to prevent panel expansion
        this.elements.aclRuleInput.dataset.programmaticUpdate = 'true';

        this.elements.aclRuleInput.value = rule;
        
        // Update character counter (button states will be updated by the input event below)
        this.executeEventHandler('updateCharacterCounterProgrammatically', this.elements.aclRuleInput);
        
        // Track the rule we just generated
        this.state.lastGeneratedRule = rule;
        this.state.lastValidRule = rule;     // This is a valid rule for testing
        this.state.hasManualChanges = false;
        this.hideSubmitButton();
        
        // Add the newly committed rule to history BEFORE saving it (skip empty rules)
        if (rule.trim() !== '') {
            Storage.addToHistory(rule);
        }

        // Save to localStorage for proper restoration
        Storage.saveLastGeneratedRule(rule);

        // Also save as the committed ACL rule so button states work correctly
        Storage.saveAclRule(rule);
        
        // Trigger change event to update other parts of the app
        this.elements.aclRuleInput.dispatchEvent(new Event('input'));
    },

    /**
     * Generate optimized ACL rule from current state
     * Terms are ordered: inclusions first, then exclusions, then key patterns (~)
     * Within each group, preserve insertion order rather than alphabetical sorting
     */
    async generateOptimizedRule() {
        const parts = [];

        // Check if we have any inclusion terms for optimization logic
        const hasInclusions = this.state.grantedCategories.size > 0 || this.state.grantedCommands.size > 0;
        let grantedCommands = null;
        
        if (hasInclusions) {
            // Get all commands that would be granted by the inclusion terms
            grantedCommands = await this.getCommandsGrantedByInclusions();
        }

        // Process terms in the exact order they were added/modified
        this.state.orderedTerms.forEach(term => {
            if (term.type === 'category') {
                if (term.operation === 'grant') {
                    parts.push(`+@${term.value}`);
                } else if (term.operation === 'block' && hasInclusions) {
                    // Only add blocked categories if they would actually exclude granted commands
                    if (this.categoryOverlapsWithGranted(term.value, grantedCommands)) {
                        parts.push(`-@${term.value}`);
                    }
                }
            } else if (term.type === 'command') {
                if (term.operation === 'grant') {
                    parts.push(`+${term.value}`);
                } else if (term.operation === 'block' && hasInclusions) {
                    // Only add blocked commands if they would be granted by inclusions
                    if (grantedCommands && grantedCommands.has(term.value)) {
                        parts.push(`-${term.value}`);
                    }
                }
            }
        });

        // Key patterns (~) - these should always come last
        if (this.state.keyPatterns) {
            Array.from(this.state.keyPatterns).forEach(pattern => {
                parts.push(pattern);
            });
        }

        return parts.join(' ');
    },

    /**
     * Get all commands that would be granted by current inclusion terms
     * Uses the same API call pattern as the existing getCommandsGrantedByCategories method
     */
    async getCommandsGrantedByInclusions() {
        const grantedCommands = new Set();

        // Add individual granted commands
        this.state.grantedCommands.forEach(command => {
            grantedCommands.add(command);
        });

        // Add commands from granted categories (if any)
        if (this.state.grantedCategories.size > 0) {
            try {
                const categoryCommands = await this.getCommandsGrantedByCategories();
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
     * For example, with +@all -@dangerous, this would return all @dangerous commands
     */
    async getCommandsBlockedByCategories() {
        if (this.state.blockedCategories.size === 0) {
            return [];
        }
        
        const blockedCommands = new Set();
        
        for (const category of this.state.blockedCategories) {
            try {
                // Use the same pattern as getCommandsGrantedByCategories
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
        // This prevents overly aggressive filtering while we implement proper category lookup
        return true;
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
     * @param {boolean} isRestoration - True if this is called during localStorage restoration
     */
    async syncFromRuleText(isRestoration = false) {
        if (!this.elements.aclRuleInput || !this.state.isInitialized) {
            return;
        }

        const rawRuleText = this.elements.aclRuleInput.value.trim();
        const ruleText = Utils.normalizeACLRule(rawRuleText);
        
        // Update the textarea with normalized rule if it changed
        if (ruleText !== rawRuleText) {
            // Preserve cursor position before updating textarea value
            const cursorStart = this.elements.aclRuleInput.selectionStart;
            const cursorEnd = this.elements.aclRuleInput.selectionEnd;

            // Mark as programmatic update to prevent panel expansion
            this.elements.aclRuleInput.dataset.programmaticUpdate = 'true';
            this.elements.aclRuleInput.value = ruleText;

            // Restore cursor position after value update
            // Adjust cursor position if the text was shortened by normalization
            const newCursorStart = Math.min(cursorStart, ruleText.length);
            const newCursorEnd = Math.min(cursorEnd, ruleText.length);
            this.elements.aclRuleInput.setSelectionRange(newCursorStart, newCursorEnd);

            // Update character counter and button states
            this.executeMultipleEventHandlers([
                { method: 'updateCharacterCounterProgrammatically', args: [this.elements.aclRuleInput] },
                { method: 'updateActionButtonStates', args: [] }
            ]);
        }
        
        // Syncing rule text to interactive display

        try {
            // Validate ACL rule syntax first
            const validation = await Utils.validateACLRule(ruleText);
            if (!validation.valid) {
                const firstError = validation.errors[0];
                
                // During restoration, don't show error notifications but show Submit Changes button
                if (isRestoration) {
                    // Show submit button since there's a mismatch between textarea and interactive builder
                    this.showSubmitButton();
                } else {
                    // Normal operation - show error notification
                    Utils.showNotification(firstError, 'error', 5000);
                    // Also show submit button since there's still a mismatch
                    this.showSubmitButton();
                }
                return;
            }
            
            // Reset state
            this.state.grantedCategories.clear();
            this.state.grantedCommands.clear();
            this.state.blockedCategories.clear();
            this.state.blockedCommands.clear();
            
            this.state.keyPatterns.clear();
            this.state.orderedTerms = []; // Reset ordered terms

            // Parse the rule using actual ACL logic to get real granted/blocked commands
            // Always make API call, even for empty rules, to get accurate granted commands
            try {
                // Use the same API call that RuleManager uses for accurate parsing
                const data = await API.parseRule(ruleText, AppState.currentVersion);

                if (data && data.success) {
                    // Store the API response for partial category detection
                    this.lastApiResponse = data;

                    // Parse rule tokens to determine what was explicitly granted
                    // Handle empty rules gracefully
                    if (ruleText) {
                        const tokens = ruleText.split(/\s+/).filter(token => token.length > 0);
                        const grantedCategories = new Set();
                        const blockedCategories = new Set();
                        const explicitlyGrantedCommands = new Set();
                        const orderedTerms = [];
                        
                        // Parse the rule to find explicitly granted/blocked categories and commands
                        // and build orderedTerms to preserve the rule structure
                        for (const token of tokens) {
                            if (token.startsWith('+@')) {
                                // Granted category
                                const category = token.substring(2);
                                grantedCategories.add(category);
                                orderedTerms.push({ type: 'category', operation: 'grant', value: category });
                            } else if (token.startsWith('-@')) {
                                // Blocked category
                                const category = token.substring(2);
                                blockedCategories.add(category);
                                orderedTerms.push({ type: 'category', operation: 'block', value: category });
                            } else if (token.startsWith('+') && !token.startsWith('+@')) {
                                // Granted command
                                const command = token.substring(1);
                                explicitlyGrantedCommands.add(command);
                                orderedTerms.push({ type: 'command', operation: 'grant', value: command });
                            } else if (token.startsWith('-') && !token.startsWith('-@')) {
                                // Blocked command
                                const command = token.substring(1);
                                orderedTerms.push({ type: 'command', operation: 'block', value: command });
                            }
                        }
                        
                        // Parse key patterns (~, %R~, %W~, %RW~)
                        this.state.keyPatterns.clear();
                        for (const token of tokens) {
                            if (token.startsWith('~') || token.startsWith('%')) {
                                this.state.keyPatterns.add(token);
                            }
                        }
                        
                        // Update state based on actual rule parsing and API results
                        this.state.grantedCategories = grantedCategories;
                        this.state.grantedCommands = explicitlyGrantedCommands;

                        // Only store explicitly blocked categories and commands (from rule tokens)
                        this.state.blockedCategories = blockedCategories;
                        // Parse explicitly blocked commands from rule tokens
                        const explicitlyBlockedCommands = new Set();
                        for (const token of tokens) {
                            if (token.startsWith('-') && !token.startsWith('-@')) {
                                const command = token.substring(1);
                                explicitlyBlockedCommands.add(command);
                            }
                        }
                        this.state.blockedCommands = explicitlyBlockedCommands;
                        
                        // Preserve the ordered terms from the original rule
                        this.state.orderedTerms = orderedTerms;
                    } else {
                        // Empty rule - clear all state
                        this.state.grantedCategories.clear();
                        this.state.grantedCommands.clear();
                        this.state.blockedCategories.clear();
                        this.state.blockedCommands.clear();
                        this.state.orderedTerms = [];
                    }
                } else {
                    // Fallback to simple text parsing if API fails
                    this.fallbackTextParsing(ruleText);
                }
            } catch (error) {
                console.error('Error parsing rule with API, falling back to text parsing:', error);
                this.fallbackTextParsing(ruleText);
            }

            // Re-render the interactive display with loading animation to prevent visual artifacts
            // Skip rule text regeneration during Submit Changes to preserve user input for redundancy analysis
            await this.smoothRender(isRestoration);
            
            // Update tracking state differently for restoration vs manual sync
            if (isRestoration) {
                // During restoration, compare against the saved lastGeneratedRule for proper change detection
                const hasChanges = ruleText !== this.state.lastGeneratedRule;
                this.state.hasManualChanges = hasChanges;
                this.state.lastValidRule = ruleText;
                
                if (hasChanges) {
                    this.showSubmitButton();
                } else {
                    this.hideSubmitButton();
                }
            } else {
                // Normal sync operation - user clicked "Submit Changes"
                // Preserve the original user input without automatic optimization
                this.state.lastGeneratedRule = ruleText;
                this.state.lastValidRule = ruleText;  // User successfully submitted this rule
                this.state.hasManualChanges = false;
                this.hideSubmitButton();

                // Save lastGeneratedRule to localStorage for proper restoration
                Storage.saveLastGeneratedRule(ruleText);

                // Shrink panels after successful sync since no manual changes remain
                const layout = document.querySelector('.three-column-layout');
                if (layout && layout.classList.contains('submit-button-visible')) {
                    layout.classList.remove('submit-button-visible');
                }

                // Update action button states after successful sync
                this.executeEventHandler('updateActionButtonStates');
            }

            // Always analyze for redundancy to show optimization suggestions (including during restoration)
            try {
                RuleManager.analyzeRedundancy();

                // Wait a bit for redundancy analysis to complete, then add optimization suggestions
                setTimeout(async () => {
                    await this.displayOptimizationSuggestions();
                }, 100);
            } catch (error) {
                console.error('Error during post-sync redundancy analysis:', error);
            }
            
        } catch (error) {
            console.error('❌ Error syncing rule:', error);
            
            // Show submit button since sync failed and there's likely a mismatch
            this.showSubmitButton();
            
            // During restoration, don't show error notifications
            if (!isRestoration) {
                Utils.showNotification('Error syncing rule changes. Please try again.', 'error', 5000);
            }
        }
    },

    /**
     * Fallback text parsing when API is unavailable
     */
    fallbackTextParsing(ruleText) {
        const tokens = ruleText.split(/\s+/).filter(token => token.length > 0);
        
        for (const token of tokens) {
            if (token.startsWith('+@')) {
                // Granted category
                const category = token.substring(2);
                this.state.grantedCategories.add(category);
                this.state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });
            } else if (token.startsWith('-@')) {
                // Blocked category
                const category = token.substring(2);
                this.state.blockedCategories.add(category);
                this.state.orderedTerms.push({ type: 'category', operation: 'block', value: category });
            } else if (token.startsWith('+')) {
                // Granted command (normalize to lowercase)
                const command = token.substring(1).toLowerCase();
                this.state.grantedCommands.add(command);
                this.state.orderedTerms.push({ type: 'command', operation: 'grant', value: command });
            } else if (token.startsWith('-')) {
                // Blocked command (normalize to lowercase)
                const command = token.substring(1).toLowerCase();
                this.state.blockedCommands.add(command);
                this.state.orderedTerms.push({ type: 'command', operation: 'block', value: command });
            } else if (token.startsWith('~') || token.startsWith('%')) {
                // Key pattern (~, %R~, %W~, %RW~)
                this.state.keyPatterns.add(token);
            }
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
            // Panel expansion is only controlled by manual textarea input in event-handlers.js
        }
    },

    /**
     * Hide the submit changes button
     */
    hideSubmitButton() {
        if (this.elements.submitChangesBtn) {
            this.elements.submitChangesBtn.style.display = 'none';
            // Panel expansion is only controlled by manual textarea input in event-handlers.js
        }
    },

    /**
     * Get the last valid ACL rule for testing purposes
     * @returns {string} The last valid ACL rule that was successfully processed
     */
    getLastValidRule() {
        return this.state.lastValidRule || '';
    },

    // ===============================================
    // UTILITY METHODS - Eliminate Common Patterns
    // ===============================================

    /**
     * Execute optimization and rendering cycle
     * Common pattern used throughout the codebase after state changes
     */
    async finalizeStateChange() {
        await this.checkAndAutoSimplifyCategories();
        this.scheduleRender();
    },

    /**
     * Update orderedTerms with proper cleanup and addition
     * Eliminates repeated patterns of removeTermsByCategory + addTerm
     */
    updateOrderedTerms(type, operation, value, replaceExisting = true) {
        if (replaceExisting && this.StateManager?.removeTermsByCategory) {
            this.state.orderedTerms = this.StateManager.removeTermsByCategory(this.state.orderedTerms, value);
        }
        if (this.StateManager?.addTerm) {
            this.StateManager.addTerm(this.state.orderedTerms, type, operation, value);
        }
    },

    /**
     * Determine which column type an element belongs to
     * Eliminates repeated DOM queries for column detection
     */
    getColumnType(element) {
        if (element.closest('#grantedCategories, #grantedCommands')) {
            return 'granted';
        }
        if (element.closest('#blockedCategories, #blockedCommands')) {
            return 'blocked';
        }
        return 'unknown';
    },

    /**
     * Batch DOM updates to improve performance
     * Replaces multiple individual appendChild calls
     */
    batchAppendElements(container, elements) {
        const fragment = document.createDocumentFragment();
        elements.forEach(element => fragment.appendChild(element));
        container.appendChild(fragment);
    },

    /**
     * Safe async operation wrapper with error handling
     * Standardizes error handling across async operations
     */
    async safeAsyncOperation(operation, errorContext = 'Operation') {
        try {
            return await operation();
        } catch (error) {
            console.error(`${errorContext} failed:`, error);
            return null;
        }
    },

    /**
     * Execute EventHandlers method with dynamic import
     * Eliminates repeated dynamic import pattern
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
     * Execute multiple EventHandler methods in sequence
     * For cases where multiple handlers need to be called together
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
    },

    /**
     * Check if a category has conflicting individual commands
     * (e.g., @fast granted via @all but +multi conflicts with -@transaction)
     */
    async hasConflictingIndividualCommands(category) {
        try {
            const categoryCommands = await this.getCategoryCommands(category);

            // Check for individual commands in this category that create conflicts
            for (const command of categoryCommands) {
                // Check if command is individually granted while category is implicitly blocked
                if (this.state.grantedCommands.has(command)) {
                    return true;
                }
                // Check if command is individually blocked while category is implicitly granted
                if (this.state.blockedCommands.has(command)) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error(`Error checking conflicting commands for ${category}:`, error);
            return false;
        }
    },

    /**
     * Remove conflicting individual commands for a category
     * Smart handler that removes individual grants/blocks that conflict with category state
     */
    async removeConflictingIndividualCommands(category) {
        try {
            const categoryCommands = await this.getCategoryCommands(category);
            let hasChanges = false;

            // Remove conflicting individual commands
            for (const command of categoryCommands) {
                if (this.state.grantedCommands.has(command)) {
                    this.state.grantedCommands.delete(command);
                    // Remove from orderedTerms
                    this.state.orderedTerms = this.state.orderedTerms.filter(term =>
                        !(term.type === 'command' && term.operation === 'grant' && term.value === command)
                    );
                    hasChanges = true;
                }
                if (this.state.blockedCommands.has(command)) {
                    this.state.blockedCommands.delete(command);
                    // Remove from orderedTerms
                    this.state.orderedTerms = this.state.orderedTerms.filter(term =>
                        !(term.type === 'command' && term.operation === 'block' && term.value === command)
                    );
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                await this.finalizeStateChange();
            }
        } catch (error) {
            console.error(`Error removing conflicting commands for ${category}:`, error);
        }
    }
};

export default InteractiveACLBuilder;