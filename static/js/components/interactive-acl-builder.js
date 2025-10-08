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

// Refactored modules (v1.22.0-beta)
import ACLOptimizer from './acl-optimizer.js';
import ACLRuleParser from './acl-rule-parser.js';
import ACLCategoryManager from './acl-category-manager.js';
import ACLUIRenderer from './acl-ui-renderer.js';
import ACLStateManager from './acl-state-manager.js';

const InteractiveACLBuilder = {
    // State management
    state: {
        // Legacy Sets - kept for backward compatibility with existing UI logic
        grantedCommands: new Set(),
        grantedCategories: new Set(),
        blockedCommands: new Set(),
        blockedCategories: new Set(),
        keyPatterns: new Set(),          // Store key patterns like ~*, ~user:*, %R~*, etc.
        channelPatterns: new Set(),      // Store pub/sub channel patterns like &*, &channel:*

        // New ordered structure for rule generation
        orderedTerms: [],                // Array of {type: 'category|command|keypattern', operation: 'grant|block', value: string}

        // Rule Selectors (Redis 7.0+) - parentheses-based independent permission sets
        selectors: [],                   // Array of selector objects, each containing orderedTerms, keyPatterns, channelPatterns

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
        ACLStateManager.toggleCategoryState(this.state, category, 'grant');
        this.state.orderedTerms = ACLStateManager.removeTermsByCategory(this.state.orderedTerms, category);
        ACLStateManager.addTerm(this.state.orderedTerms, 'category', 'grant', category);

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
        ACLStateManager.toggleCategoryState(this.state, category, 'block');
        this.state.orderedTerms = ACLStateManager.removeTermsByCategory(this.state.orderedTerms, category);
        ACLStateManager.addTerm(this.state.orderedTerms, 'category', 'block', category);

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
        return ACLCategoryManager.grantCategoryAndRemoveConflictingCommands(
            this.state,
            category,
            (cat) => this.getCategoryCommandsCached(cat),
            () => this.updateRuleText(),
            () => this.scheduleRender(),
            ACLStateManager
        );
    },

    /**
     * Remove partial grants from a blocked category
     * Used for "partially implicitly granted" categories in granted panel like: +@all -@transaction +discard
     * Clicking the granted @transaction button should remove +discard but keep -@transaction
     */
    async removePartialGrantsFromBlockedCategory(category) {
        return ACLCategoryManager.removePartialGrantsFromBlockedCategory(
            this.state,
            category,
            (cat) => this.getCategoryCommandsCached(cat),
            () => this.scheduleRender()
        );
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
        // IMPORTANT: Check if textarea is empty FIRST before running detection functions
        // Detection functions use this.lastApiResponse which may contain stale data from previous rule
        // If textarea is empty, there's nothing to optimize - hide warnings and return immediately
        const ruleText = this.elements.aclRuleInput?.value?.trim() || '';
        if (!ruleText) {
            // Import RuleManager to hide warnings for empty rules
            import('../managers/rule-manager.js').then(({ default: RuleManager }) => {
                RuleManager.hideRedundancyWarnings();
            });
            return;
        }

        const redundantExclusions = await this.detectRedundantExclusions();
        const implicitCategories = await this.detectImplicitFullyGrantedCategories();
        const blockThenRegrantPatterns = await this.detectBlockThenRegrantPatterns();

        const hasOptimizations = redundantExclusions.length > 0 || implicitCategories.length > 0 || blockThenRegrantPatterns.length > 0;

        // If no frontend optimizations were detected, no need to show anything
        if (!hasOptimizations) {
            return;
        }

        if (hasOptimizations) {
            // Use the existing redundancy warning system to show optimization suggestions
            const warningsList = document.getElementById('warningsList');
            const suggestionsList = document.getElementById('suggestionsList');
            const warningsContainer = document.getElementById('redundancyWarnings');

            if (warningsList && suggestionsList && warningsContainer) {
                // IMPORTANT: Preserve any existing backend warnings and suggestions before clearing
                // Backend adds warnings like "Individual commands cover entire @hyperloglog category"
                // Backend suggestions include "Saves X terms" and are added by RuleManager.displayRedundancyWarnings()
                // We want to keep those and just ADD our frontend-detected optimizations
                const existingBackendWarnings = Array.from(warningsList.children);
                const existingBackendSuggestions = Array.from(suggestionsList.children).filter(child =>
                    child.querySelector('.simplified-rule') && child.textContent.includes('Saves ')
                );

                // If backend already has warnings, skip adding frontend warnings (they're less detailed)
                const backendHasWarnings = existingBackendWarnings.length > 0;

                // Clear existing content to avoid duplication
                warningsList.innerHTML = '';
                suggestionsList.innerHTML = '';

                // Re-add the preserved backend warnings and suggestions FIRST
                if (backendHasWarnings) {
                    // Backend already provided warnings, so we skip adding our own
                    existingBackendWarnings.forEach(warning => {
                        warningsList.appendChild(warning);
                    });
                }
                existingBackendSuggestions.forEach(suggestion => {
                    suggestionsList.appendChild(suggestion);
                });

                // Add optimization suggestions for redundant exclusions
                redundantExclusions.forEach(({ command }) => {
                    // Generate the optimized rule by temporarily removing the redundant exclusion
                    const optimizedTerms = this.state.orderedTerms.filter(term =>
                        !(term.type === 'command' && term.operation === 'block' && term.value === command)
                    );

                    // Build the optimized rule string
                    const optimizedRule = this.generateRuleFromTerms(optimizedTerms);

                    // Check if backend already provided this suggestion (or a version with key patterns)
                    // Backend may include key patterns like ~key*, so check if it starts with our rule
                    const backendAlreadyHasSuggestion = Array.from(suggestionsList.children).some(child => {
                        const ruleSpan = child.querySelector('.simplified-rule');
                        if (!ruleSpan) return false;
                        const backendRule = ruleSpan.textContent.trim();
                        const frontendRule = optimizedRule.trim();
                        // Exact match OR backend rule starts with frontend rule (has additional key patterns)
                        return backendRule === frontendRule || backendRule.startsWith(frontendRule + ' ');
                    });

                    // Only add frontend warning if backend hasn't already provided warnings
                    if (!backendHasWarnings) {
                        const warningDiv = document.createElement('div');
                        warningDiv.className = 'warning-item';
                        warningDiv.innerHTML = `Redundant exclusion "-${command}" is overridden by later category grant.`;
                        warningsList.appendChild(warningDiv);
                    }

                    // Skip the suggestion if backend already provided it (to avoid duplicates)
                    if (backendAlreadyHasSuggestion) {
                        return;
                    }

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

                    // Check if backend already provided this suggestion (or a version with key patterns)
                    // Backend may include key patterns like ~key*, so check if it starts with our rule
                    const backendAlreadyHasSuggestion = Array.from(suggestionsList.children).some(child => {
                        const ruleSpan = child.querySelector('.simplified-rule');
                        if (!ruleSpan) return false;
                        const backendRule = ruleSpan.textContent.trim();
                        const frontendRule = optimizedRule.trim();
                        // Exact match OR backend rule starts with frontend rule (has additional key patterns)
                        return backendRule === frontendRule || backendRule.startsWith(frontendRule + ' ');
                    });

                    // Only add frontend warning if backend hasn't already provided warnings
                    if (!backendHasWarnings) {
                        const warningDiv = document.createElement('div');
                        warningDiv.className = 'warning-item';
                        warningDiv.innerHTML = `Category "@${category}" is fully granted via ${commands.length} individual commands.`;
                        warningsList.appendChild(warningDiv);
                    }

                    // Skip the suggestion if backend already provided it (to avoid duplicates)
                    if (backendAlreadyHasSuggestion) {
                        return;
                    }

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

                    // Check if backend already provided this suggestion (or a version with key patterns)
                    // Backend may include key patterns like ~key*, so check if it starts with our rule
                    const backendAlreadyHasSuggestion = Array.from(suggestionsList.children).some(child => {
                        const ruleSpan = child.querySelector('.simplified-rule');
                        if (!ruleSpan) return false;
                        const backendRule = ruleSpan.textContent.trim();
                        const frontendRule = optimizedRule.trim();
                        // Exact match OR backend rule starts with frontend rule (has additional key patterns)
                        return backendRule === frontendRule || backendRule.startsWith(frontendRule + ' ');
                    });

                    // Only add frontend warning if backend hasn't already provided warnings
                    if (!backendHasWarnings) {
                        const warningDiv = document.createElement('div');
                        warningDiv.className = 'warning-item';
                        warningDiv.innerHTML = `Category "@${category}" is blocked then re-granted via ${commands.length} individual commands. This cancels out.`;
                        warningsList.appendChild(warningDiv);
                    }

                    // Skip the suggestion if backend already provided it (to avoid duplicates)
                    if (backendAlreadyHasSuggestion) {
                        return;
                    }

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
     * Remove all blocks when @all is partially blocked
     * This handles cases like "+@all -@admin" - clicking @all in blocked panel removes all blocks
     * Resulting rule: "+@all"
     */
    async removeAllBlocksForAllCategory() {
        // Remove all blocked categories and commands from the rule
        // Keep @all grant and any other grants, but remove all blocks
        this.state.blockedCategories.clear();
        this.state.blockedCommands.clear();

        // Filter out all block operations from orderedTerms
        this.state.orderedTerms = this.state.orderedTerms.filter(term => term.operation !== 'block');

        // Update the rule text and re-render
        await this.updateRuleText();
        this.scheduleRender();

        // Show notification about the change
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification('Removed all blocks - full @all access granted', 'success');
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

        // Hide optimization/redundancy warnings since rule is now empty
        import('../managers/rule-manager.js').then(({ default: RuleManager }) => {
            RuleManager.hideRedundancyWarnings();
        });

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
        return ACLCategoryManager.grantCategoryAndCleanup(
            this.state,
            category,
            (cat) => this.getCategoryCommandsCached(cat),
            () => this.updateRuleText(),
            () => this.scheduleRender(),
            (cat) => this.grantCategory(cat)
        );
    },

    /**
     * Remove all terms related to a category (both individual commands and category rules)
     * This is used when clicking a partially granted category in the granted column
     */
    async removeAllCategoryRelatedTerms(category) {
        return ACLCategoryManager.removeAllCategoryRelatedTerms(
            this.state,
            category,
            (cat) => this.getCategoryCommandsCached(cat),
            () => this.updateRuleText(),
            () => this.scheduleRender()
        );
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
     * Remove a category or command term from all selectors
     * If selector becomes empty after removal, remove the entire selector
     * @param {string} type - 'category' or 'command'
     * @param {string} value - Category or command name
     */
    removeFromSelectors(type, value) {
        // Filter selectors, removing the term and empty selectors
        this.state.selectors = this.state.selectors.filter(selector => {
            // Remove the term from this selector's orderedTerms
            selector.orderedTerms = selector.orderedTerms.filter(term =>
                !(term.type === type && term.value === value)
            );

            // Also update the selector's Sets
            if (type === 'category') {
                selector.grantedCategories.delete(value);
                selector.blockedCategories.delete(value);
            } else if (type === 'command') {
                selector.grantedCommands.delete(value);
                selector.blockedCommands.delete(value);
            }

            // Check if selector has any command/category terms left
            const hasCommandTerms = selector.orderedTerms.some(term =>
                term.type === 'category' || term.type === 'command'
            );

            // Keep selector only if it still has command/category terms
            // (key patterns alone don't make sense without permissions)
            return hasCommandTerms;
        });
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

        // Remove any existing entries for this category from root orderedTerms
        this.state.orderedTerms = this.state.orderedTerms.filter(term =>
            !(term.type === 'category' && term.value === category)
        );

        // Also remove from all selectors (and remove empty selectors)
        this.removeFromSelectors('category', category);

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

        // Mark that we should check for comprehensive optimization after render
        this.state.shouldComprehensiveOptimize = true;

        this.scheduleRender();
    },

    /**
     * Grant a command (add to granted)
     */
    async grantCommand(command) {
        // Update state and ordered terms
        ACLStateManager.toggleCommandState(this.state, command, 'grant');
        this.state.orderedTerms = ACLStateManager.removeTermsByCommand(this.state.orderedTerms, command);
        ACLStateManager.addTerm(this.state.orderedTerms, 'command', 'grant', command);

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

        // Remove any existing entries for this command from root orderedTerms
        this.state.orderedTerms = this.state.orderedTerms.filter(term =>
            !(term.type === 'command' && term.value === command)
        );

        // Also remove from all selectors (and remove empty selectors)
        this.removeFromSelectors('command', command);

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
     * @param {boolean} addToHistory - Whether to add to history when updating rule text (default: true)
     */
    scheduleRender(addToHistory = true) {
        if (this.debouncedRender) {
            clearTimeout(this.debouncedRender);
        }

        this.debouncedRender = setTimeout(() => {
            requestAnimationFrame(async () => {
                await this.smoothRender(true, addToHistory);
                // Note: SearchManager.refreshAllSearches() is now called from within smoothRender after DOM updates
            });
        }, 100); // 100ms debounce for smoother batching
    },

    /**
     * Smooth rendering with loading covers to prevent empty state flash
     * @param {boolean} shouldUpdateRuleText - Whether to update rule text (default: true)
     * @param {boolean} addToHistory - Whether to add to history when updating rule text (default: true)
     */
    async smoothRender(shouldUpdateRuleText = true, addToHistory = true) {
        // Apply loading covers instead of opacity fade to prevent empty state flash
        this.applyLoadingAnimation();

        // Brief delay to ensure loading covers are applied, then render content
        setTimeout(async () => {
            // Update rule text based on current state (skip during Submit Changes to preserve user input)
            if (shouldUpdateRuleText) {
                await this.updateRuleText(addToHistory);
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

            // After updating rule text, analyze for redundancy/optimization (this will hide warnings for empty rules)
            if (shouldUpdateRuleText) {
                try {
                    await import('../managers/rule-manager.js').then(({ default: RuleManager }) => {
                        RuleManager.analyzeRedundancy();
                    });

                    // Wait for redundancy analysis to complete, then add frontend optimization suggestions
                    setTimeout(async () => {
                        await this.displayOptimizationSuggestions();
                    }, 100);
                } catch (error) {
                    console.error('Error during post-render redundancy analysis:', error);
                }
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

            // Check if explicitly GRANTED category has some commands blocked (e.g., +@admin -acl|deluser)
            // This should show in blocked column as implicitly partial
            if (this.state.grantedCategories.has(category)) {
                const blockedAnalysis = await this.detectPartiallyBlockedCategory(category);
                if (blockedAnalysis[category] === 'partial') {
                    implicitPartialBlockedCategories.add(category);
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
                // When @all is explicitly granted, show categories in priority order:
                // 1. @all first (explicitly granted)
                // 2. Other explicitly granted categories (e.g., +@connection in "+@connection +@all")
                // 3. Implicitly partial categories (hollow - some commands blocked, need attention)
                // 4. Implicitly fully granted categories (solid - granted via @all only)

                effectivelyGrantedCategories.push('all');

                // Add other explicit grants, separating FULL from PARTIAL
                // Full grants appear before partial grants
                const explicitGrantsExceptAll = Array.from(this.state.grantedCategories)
                    .filter(cat => cat !== 'all');

                // Separate into full and partial based on whether they have blocked commands
                const explicitFullGrants = [];
                const explicitPartialGrants = [];

                for (const cat of explicitGrantsExceptAll) {
                    // Check if this category has any blocked commands (making it partial)
                    const categoryCommands = await this.getCategoryCommandsCached(cat);
                    const allGrantedCommands = new Set(this.lastApiResponse?.granted_commands || []);
                    const allBlockedCommands = new Set(this.lastApiResponse?.blocked_commands || []);

                    const grantedCount = categoryCommands.filter(cmd => allGrantedCommands.has(cmd)).length;
                    const blockedCount = categoryCommands.filter(cmd => allBlockedCommands.has(cmd)).length;

                    if (blockedCount > 0 && grantedCount > 0) {
                        explicitPartialGrants.push(cat);
                    } else {
                        explicitFullGrants.push(cat);
                    }
                }

                // Add full grants first (alphabetical), then partial grants (alphabetical)
                effectivelyGrantedCategories.push(...explicitFullGrants.sort());
                effectivelyGrantedCategories.push(...explicitPartialGrants.sort());

                // Add implicitly partial categories (they need user attention)
                const sortedImplicitPartials = Array.from(implicitPartialCategories)
                    .filter(cat => cat !== 'all' && !this.state.grantedCategories.has(cat))
                    .sort();
                effectivelyGrantedCategories.push(...sortedImplicitPartials);

                // Then add implicitly fully granted categories (granted via @all only)
                this.state.allCategories.forEach(category => {
                    if (category !== 'all' &&
                        effectiveCategoryStatus[category] === 'granted' &&
                        !implicitPartialCategories.has(category) &&
                        !this.state.grantedCategories.has(category)) {
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

                // Special @all handling: if there are any ACTUALLY GRANTED commands (per API) but @all is not explicitly granted,
                // show @all as implicitly partially granted
                // IMPORTANT: Use API response to check actual grants, not state (state may have terms that are ultimately blocked)
                const actuallyGrantedCommands = this.lastApiResponse?.granted_commands || [];
                const hasAnyActualGrants = actuallyGrantedCommands.length > 0;
                const hasAllCategory = explicitlyGrantedCategories.includes('all');
                const shouldShowAllAsPartial = hasAnyActualGrants && !hasAllCategory && !this.state.blockedCategories.has('all');

                let sortedExplicitCategories;

                if (hasAllCategory) {
                    // Remove @all, sort the rest, then put @all first
                    const explicitWithoutAll = explicitlyGrantedCategories.filter(cat => cat !== 'all').sort();
                    sortedExplicitCategories = ['all', ...explicitWithoutAll];
                } else {
                    // NEW: Separate explicit categories into FULL and PARTIAL
                    // Full grants (no blocked commands) appear before partial grants (some blocked commands)
                    const explicitFullGrants = [];
                    const explicitPartialGrants = [];

                    for (const cat of explicitlyGrantedCategories) {
                        // Check if this category has any blocked commands (making it partial)
                        const categoryCommands = await this.getCategoryCommandsCached(cat);
                        const allGrantedCommands = new Set(this.lastApiResponse?.granted_commands || []);
                        const allBlockedCommands = new Set(this.lastApiResponse?.blocked_commands || []);

                        const grantedCount = categoryCommands.filter(cmd => allGrantedCommands.has(cmd)).length;
                        const blockedCount = categoryCommands.filter(cmd => allBlockedCommands.has(cmd)).length;

                        if (blockedCount > 0 && grantedCount > 0) {
                            explicitPartialGrants.push(cat);
                        } else {
                            explicitFullGrants.push(cat);
                        }
                    }

                    // Combine: full grants first (sorted), then partial grants (sorted)
                    sortedExplicitCategories = [...explicitFullGrants.sort(), ...explicitPartialGrants.sort()];
                }

                // Add @all as implicit partial if needed
                if (shouldShowAllAsPartial && !implicitPartialCategoriesArray.includes('all')) {
                    implicitPartialCategoriesArray.unshift('all'); // Add @all at the beginning of implicit partials
                }

                // NEW ORDERING: Show categories in priority order for better UX
                // 1. Explicit categories first (user explicitly granted these)
                // 2. Implicitly fully granted categories (solid - all commands granted, important)
                // 3. Implicitly partial categories (hollow - some commands blocked, less common edge case)

                // Sort implicit categories alphabetically
                const sortedImplicitPartials = implicitPartialCategoriesArray.sort();
                const sortedImplicitFullyGranted = implicitFullyGrantedCategoriesArray.sort();

                // CORRECTED: Combine in priority order: explicit → implicit fully granted → implicit partial
                const combinedCategories = [...sortedExplicitCategories, ...sortedImplicitFullyGranted, ...sortedImplicitPartials];

                // SPECIAL POSITIONING: Always show @all category first (if present) for visibility
                // Visual distinction will be added via CSS styling to indicate its special nature
                const allIndex = combinedCategories.indexOf('all');
                if (allIndex !== -1) {
                    combinedCategories.splice(allIndex, 1); // Remove from current position
                    combinedCategories.unshift('all'); // Add to beginning
                }

                effectivelyGrantedCategories.push(...combinedCategories);
            }
            
            if (effectivelyGrantedCategories.length === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.style.width = '100%'; // Force full width in flex container
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

            // Update the granted categories header (exclude @all and partial categories from count)
            // Only count FULLY granted categories (explicit or implicit via @all)
            const fullyGrantedCategories = effectivelyGrantedCategories.filter(cat =>
                cat !== 'all' && !implicitPartialCategories.has(cat)
            );
            const totalCategories = this.state.allCategories.filter(cat => cat !== 'all').length;
            this.updateCategorySectionHeader('granted', fullyGrantedCategories.length, totalCategories);
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

                // IMPORTANT: Also add implicitly partial blocked categories that were detected earlier
                // These are categories that have some commands blocked (e.g., @dangerous when -@admin is present)
                implicitPartialBlockedCategories.forEach(category => {
                    if (category !== 'all' && !effectivelyBlockedCategories.includes(category) && !availableCategories.includes(category)) {
                        effectivelyBlockedCategories.push(category);
                    }
                });

                // IMPORTANT: Check if @all itself is also partially blocked
                // This happens when @all is explicitly granted but has blocked subcategories (e.g., +@all -@admin)
                // In this case, @all should appear in BOTH granted and blocked panels
                if (this.state.grantedCategories.has('all')) {
                    const allCategoryAnalysis = await this.detectPartialCategory('all');
                    if (allCategoryAnalysis['all'] === 'partial') {
                        // @all is partially granted (some commands/categories blocked)
                        // Add it to blocked panel as implicitly partially blocked
                        if (!effectivelyBlockedCategories.includes('all') && !availableCategories.includes('all')) {
                            implicitPartialBlockedCategories.add('all');
                        }
                    }
                }
            } else {
                // FIXED: Normal case - use effective category status for all categories (not just when @all is granted)
                // BUT exclude implicit partial categories that are shown in granted column

                // Use pre-calculated implicit partial categories (computed at the beginning of this method)
                this.state.allCategories.forEach(category => {
                    // Skip categories that are explicitly granted (but allow partial categories in both columns)
                    // EXCEPTION: If explicitly granted category has blocked commands, it should appear in blocked column too
                    if (this.state.grantedCategories.has(category)) {
                        // We'll check for partial blocks later - don't add to effectivelyBlockedCategories here
                        return;
                    }

                    if (effectiveCategoryStatus[category] === 'blocked') {
                        effectivelyBlockedCategories.push(category);
                    } else if (effectiveCategoryStatus[category] === 'available') {
                        availableCategories.push(category);
                    }
                    // Categories with 'granted' status are handled in the granted section above
                });

                // IMPORTANT: Add explicitly BLOCKED categories to effectivelyBlockedCategories
                // This allows us to check if they're partial (some commands granted back)
                this.state.blockedCategories.forEach(category => {
                    if (!effectivelyBlockedCategories.includes(category)) {
                        effectivelyBlockedCategories.push(category);
                    }
                });

                // IMPORTANT: Check explicitly GRANTED categories for partial blocks
                // These should appear in BOTH granted and blocked columns
                // We'll check this in the renderCategoryButtons loop below

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
                        // IMPORTANT: Remove from implicitPartialBlockedCategories to prevent duplicate @all buttons
                        implicitPartialBlockedCategories.delete('all');
                    }
                }
            }

            // Show blocked categories: Fully blocked (explicit + implicit) first, then partially blocked
            // This matches the granted panel ordering for visual consistency
            const blockedCategories = [];

            if (effectivelyBlockedCategories.length > 0) {
                for (const category of effectivelyBlockedCategories) {
                    const isExplicitlyBlocked = this.state.blockedCategories.has(category);
                    const isPartialBlocked = implicitPartialBlockedCategories.has(category);

                    if (isExplicitlyBlocked) {
                        // Check if explicitly blocked category is FULL or PARTIAL
                        // Partial means some commands are granted back (e.g., -@admin +acl|deluser)
                        const categoryCommands = await this.getCategoryCommandsCached(category);
                        const allGrantedCommands = new Set(this.lastApiResponse?.granted_commands || []);
                        const grantedCount = categoryCommands.filter(cmd => allGrantedCommands.has(cmd)).length;

                        if (grantedCount > 0) {
                            // Explicit PARTIAL block (some commands granted back)
                            // Priority 3: After implicit full (2), before implicit partial (4)
                            blockedCategories.push({ category, type: 'explicit-partial', priority: 3 });
                        } else {
                            // Explicit FULL block (all commands blocked)
                            // Priority 1: First (after @all)
                            blockedCategories.push({ category, type: 'explicit-full', priority: 1 });
                        }
                    } else if (isPartialBlocked) {
                        // Implicitly partial blocked category (e.g., @dangerous when +@all -@admin)
                        // Priority 4: Last
                        blockedCategories.push({ category, type: 'implicit-partial', priority: 4 });
                    } else {
                        // Implicitly fully blocked category (available but not granted)
                        // Priority 2: After explicit full (1), before explicit partial (3)
                        blockedCategories.push({ category, type: 'implicit-full', priority: 2 });
                    }
                }
            }

            // Add partially blocked categories (with individual command blocks)
            // NOTE: Most partial categories are already added above from effectivelyBlockedCategories
            // This loop only catches any that weren't in effectivelyBlockedCategories
            Array.from(implicitPartialBlockedCategories).forEach(category => {
                // Only add if not already in the list
                if (!blockedCategories.find(item => item.category === category)) {
                    // @all always gets priority 1, others get priority 4
                    const priority = category === 'all' ? 1 : 4;
                    blockedCategories.push({ category, type: 'implicit-partial', priority }); // After implicit full
                }
            });

            // Add fully available categories (not granted, not partial) so they can be sorted with partial categories
            availableCategories.forEach(category => {
                // Only add if not already in the list and not partial
                if (!blockedCategories.find(item => item.category === category) &&
                    !implicitPartialBlockedCategories.has(category)) {
                    blockedCategories.push({ category, type: 'implicit-full', priority: 2 }); // After explicit full
                }
            });

            // Special handling for explicitly blocked @all (e.g., rule "-@all")
            if (this.state.blockedCategories.has('all') && !blockedCategories.find(item => item.category === 'all')) {
                blockedCategories.push({ category: 'all', type: 'explicit', priority: 1 });
            }

            // NOTE: @all is now included in blockedCategories list above for proper sorting
            // This special rendering section is disabled to prevent duplicates
            const allIndexInAvailable = availableCategories.indexOf('all');
            if (false && allIndexInAvailable !== -1) {
                // Remove @all from available list
                availableCategories.splice(allIndexInAvailable, 1);

                // Render @all first
                const button = await this.createCategoryButton('all', 'available');
                button.dataset.stateInfo = `Click to grant @all category`;

                const isEmptyRule = this.state.grantedCategories.size === 0 &&
                                   this.state.grantedCommands.size === 0 &&
                                   this.state.blockedCategories.size === 0 &&
                                   this.state.blockedCommands.size === 0;

                if (isEmptyRule) {
                    button.style.opacity = '0.7';
                    button.dataset.stateInfo = `@all category (implicitly blocked - empty rule) - Click to grant`;
                }

                this.elements.blockedCategoriesButtons.appendChild(button);
            }

            // Check if we should show "No categories available" message
            // Show it if only @all is in the blocked list (no regular categories)
            const nonAllBlockedCategories = blockedCategories.filter(c => c.category !== 'all');
            if (blockedCategories.length > 0 && nonAllBlockedCategories.length === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.style.width = '100%'; // Force full width in flex container to push @all button to next line
                message.textContent = 'No categories available';
                this.elements.blockedCategoriesButtons.appendChild(message);
            }

            // Now render blockedCategories (if @all is in this list, it will be first due to sort)
            if (blockedCategories.length > 0) {

                // Sort by priority: fully blocked (priority 1) before partial (priority 2)
                // EXCEPTION: @all always comes first regardless of priority
                // Within same priority, maintain rule order for explicit blocks, then alphabetical
                blockedCategories.sort((a, b) => {
                    // ALWAYS put @all first
                    if (a.category === 'all') return -1;
                    if (b.category === 'all') return 1;

                    // Sort by priority (full before partial)
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

                // Note: @all is already first due to sort comparator
                // Process blocked categories with partial detection
                for (const { category, type } of blockedCategories) {
                    // Check if this category needs partial analysis
                    let categoryAnalysis = null;
                    if (type === 'explicit-full' || type === 'explicit-partial') {
                        // Explicitly blocked category - check if partially granted back
                        categoryAnalysis = await this.detectPartiallyExplicitlyBlockedCategory(category);
                    } else if (type === 'implicit-partial') {
                        // Implicitly partial blocked category (e.g., @dangerous when +@all -@admin)
                        // Create analysis showing partial state for hollow styling
                        categoryAnalysis = { [category]: 'partial' };
                    }

                    const button = await this.createCategoryButton(category, 'blocked', categoryAnalysis, type);
                    this.elements.blockedCategoriesButtons.appendChild(button);
                }
            }

            // NOTE: Available categories are now included in blockedCategories list above for proper sorting
            // This section is kept for backwards compatibility but should not render anything
            if (false && availableCategories.length > 0) {
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

            // The "No categories available" message is now shown earlier (before @all button)
            // This block is no longer needed

            // Update the blocked categories header (exclude @all and partial categories from count)
            // Only count FULLY blocked categories (explicit blocks + available/not granted)
            const fullyBlockedCategories = effectivelyBlockedCategories.filter(cat =>
                cat !== 'all' && !implicitPartialBlockedCategories.has(cat)
            );
            const fullyAvailableCategories = availableCategories.filter(cat =>
                cat !== 'all' && !implicitPartialBlockedCategories.has(cat)
            );
            const blockedCategoryCount = fullyBlockedCategories.length + fullyAvailableCategories.length;
            const totalCategories = this.state.allCategories.filter(cat => cat !== 'all').length;
            this.updateCategorySectionHeader('blocked', blockedCategoryCount, totalCategories);
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
    updateCategorySectionHeader(type, count, total) {
        const sectionId = type === 'granted' ? 'grantedCategories' : 'blockedCategories';
        const section = document.getElementById(sectionId);
        const header = section?.querySelector('h3');

        if (header) {
            // Show X/Y format with total denominator (total should always be defined)
            header.textContent = (total !== undefined && total !== null) ? `Categories (${count}/${total})` : `Categories`;
        }
    },

    /**
     * Get all commands that are granted via categories
     */
    async getCommandsGrantedByCategories() {
        return ACLCategoryManager.getCommandsGrantedByCategories(
            this.state.grantedCategories,
            AppState.currentVersion,
            API
        );
    },

    /**
     * Render command buttons in both columns
     */
    async renderCommandButtons() {
        // Render granted commands
        if (this.elements.grantedCommandsButtons) {
            // Clear any existing content (including initial placeholders from HTML)
            this.elements.grantedCommandsButtons.innerHTML = '';

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
                message.className = 'text-muted no-commands-message';
                message.style.padding = '10px';
                message.textContent = 'No individual commands granted';
                this.elements.grantedCommandsButtons.appendChild(message);
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
                    this.elements.grantedCommandsButtons.appendChild(button);
                });

                implicitlyGrantedCommands.sort().forEach(command => {
                    const isViaCategory = true; // Commands granted via category rules
                    const isIndividual = false; // Always false for this group
                    const button = this.createGrantedCommandButton(command, isViaCategory, isIndividual);
                    this.elements.grantedCommandsButtons.appendChild(button);
                });
            }
            
            // Update header with command count and total
            // Use this.state.allCommands.length as the total (all commands for current Redis version)
            const totalCommands = this.state.allCommands?.length || 0;
            this.updateCommandSectionHeader('granted', allGrantedCommands.size, totalCommands);
        }

        // Render blocked/available commands
        if (this.elements.blockedCommandsButtons) {
            // Clear any existing content (including initial placeholders from HTML)
            this.elements.blockedCommandsButtons.innerHTML = '';

            const isEmptyACL = this.state.grantedCategories.size === 0 &&
                               this.state.grantedCommands.size === 0 &&
                               this.state.blockedCategories.size === 0 &&
                               this.state.blockedCommands.size === 0;

            if (isEmptyACL && this.state.allCommands.length > 0) {
                // Show ALL available commands as clickable buttons to grant
                const allAvailableForEmptyACL = this.state.allCommands.filter(cmd =>
                    !this.state.grantedCommands.has(cmd) && !this.state.blockedCommands.has(cmd)
                );

                if (allAvailableForEmptyACL.length > 0) {
                    allAvailableForEmptyACL.sort().forEach(command => {
                        const button = this.createCommandButton(command, 'available');
                        button.dataset.stateInfo = `Click to grant ${command} command`;
                        this.elements.blockedCommandsButtons.appendChild(button);
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
                    this.elements.blockedCommandsButtons.appendChild(button);
                });
            } else {
                // Show message when there are no individual commands to show at all
                const message = document.createElement('div');
                message.className = 'text-muted no-commands-message';
                message.style.padding = '10px';
                message.textContent = 'No individual commands blocked';
                this.elements.blockedCommandsButtons.appendChild(message);
            }

            // Calculate total blocked command count for header using API response
            // This ensures accurate count based on actual blocked commands (not just what's displayed)
            const apiBlockedCommands = this.lastApiResponse?.blocked_commands || [];
            const blockedCount = apiBlockedCommands.length;
            // Use this.state.allCommands.length as the total (all commands for current Redis version)
            const totalCommands = this.state.allCommands?.length || 0;
            this.updateCommandSectionHeader('blocked', blockedCount, totalCommands);
        }
    },

    /**
     * Update command section header with count
     */
    updateCommandSectionHeader(type, count, total) {
        const sectionId = type === 'granted' ? 'grantedCommands' : 'blockedCommands';
        const section = document.getElementById(sectionId);
        const header = section?.querySelector('h3');

        if (header) {
            const text = 'Individual Commands';
            // Show X/Y format with total denominator (total should always be defined)
            header.textContent = (total !== undefined && total !== null) ? `${text} (${count}/${total})` : text;
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
        return ACLCategoryManager.getCategoryCommands(category, AppState.currentVersion, API);
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

            // Get all commands that are currently granted/blocked by the ACL rule (from API response)
            const allGrantedCommands = new Set();
            const allBlockedCommands = new Set();

            if (this.lastApiResponse) {
                if (this.lastApiResponse.granted_commands) {
                    this.lastApiResponse.granted_commands.forEach(cmd => allGrantedCommands.add(cmd));
                }
                if (this.lastApiResponse.blocked_commands) {
                    this.lastApiResponse.blocked_commands.forEach(cmd => allBlockedCommands.add(cmd));
                }
            } else {
                // If no API response, assume everything is blocked (default state)
                return { [category]: 'blocked' };
            }

            // Check how many commands in this category are granted vs blocked
            const categoryCommandSet = new Set(categoryCommands);
            const grantedInCategory = Array.from(categoryCommandSet).filter(cmd =>
                allGrantedCommands.has(cmd)
            ).length;
            const blockedInCategory = Array.from(categoryCommandSet).filter(cmd =>
                allBlockedCommands.has(cmd)
            ).length;

            // Category is partially blocked if SOME (but not all) commands are blocked
            if (blockedInCategory > 0 && grantedInCategory > 0) {
                return { [category]: 'partial' };
            } else if (blockedInCategory === categoryCommandSet.size) {
                return { [category]: 'blocked' };
            } else {
                // All commands granted or no commands
                return { [category]: 'granted' };
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
                // @all is considered "partially granted" when there are ACTUAL grants (per API) but @all is not explicitly granted
                // IMPORTANT: Use API response to check actual grants, not state (state may have terms that are ultimately blocked)
                const actuallyGrantedCommands = this.lastApiResponse?.granted_commands || [];
                const hasAnyActualGrants = actuallyGrantedCommands.length > 0;
                const isExplicitlyGranted = this.state.grantedCategories.has('all');

                if (hasAnyActualGrants && !isExplicitlyGranted) {
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

            // Check if this category is granted in root (global) vs selectors (scoped)
            // IMPORTANT: Only count as "granted" if the category was EXPLICITLY granted, not via +@all expansion
            // The backend expands +@all into individual category grants, but we need to distinguish them
            let grantedInRoot = false;
            let grantedInSelectors = false;

            // Check root_permissions.command_rules for global category grant
            if (this.lastApiResponse?.parsed_rule?.root_permissions?.command_rules) {
                grantedInRoot = this.lastApiResponse.parsed_rule.root_permissions.command_rules.some(rule =>
                    rule.target === 'category' &&
                    rule.type === 'allow' &&
                    rule.value === category &&
                    rule.original_token !== '+@all'  // Exclude +@all expansions
                );
            }

            // Check selectors for scoped category grants (also exclude +@all expansions)
            if (this.lastApiResponse?.parsed_rule?.selectors) {
                grantedInSelectors = this.lastApiResponse.parsed_rule.selectors.some(selector =>
                    selector.command_rules?.some(rule =>
                        rule.target === 'category' &&
                        rule.type === 'allow' &&
                        rule.value === category &&
                        rule.original_token !== '+@all'  // Exclude +@all expansions
                    )
                );
            }

            // If granted as a category (in root or selectors), check for exclusions
            if (grantedInRoot || grantedInSelectors) {
                // Check if there are any -command exclusions for this category
                let hasExclusions = false;

                // Check root_permissions for exclusions
                if (this.lastApiResponse?.parsed_rule?.root_permissions?.command_rules) {
                    hasExclusions = this.lastApiResponse.parsed_rule.root_permissions.command_rules.some(rule =>
                        rule.target === 'command' && rule.type === 'deny' &&
                        categoryCommands.includes(rule.value)
                    );
                }

                // Check selectors for exclusions
                if (!hasExclusions && this.lastApiResponse?.parsed_rule?.selectors) {
                    hasExclusions = this.lastApiResponse.parsed_rule.selectors.some(selector =>
                        selector.command_rules?.some(rule =>
                            rule.target === 'command' && rule.type === 'deny' &&
                            categoryCommands.includes(rule.value)
                        )
                    );
                }

                // If granted via +@category with no exclusions, it's fully granted
                // Even if scoped to specific keys via selectors
                if (!hasExclusions) {
                    return { [category]: 'fully-granted' };
                } else {
                    return { [category]: 'partial' };
                }
            }

            // Not granted as category - check actual command grant/block status
            const isExplicitlyGranted = this.state.grantedCategories.has(category);

            if (!isExplicitlyGranted) {
                // For implicitly granted categories (e.g., via +@all), check actual command status
                // Category is partial if SOME (but not all) of its commands are granted

                const categoryCommandSet = new Set(categoryCommands);

                // Count how many commands in this category are actually granted/blocked
                const grantedInCategory = Array.from(categoryCommandSet).filter(cmd =>
                    allGrantedCommands.has(cmd)
                ).length;

                if (grantedInCategory === 0) {
                    // No commands granted - category is blocked
                    return { [category]: 'blocked' };
                } else if (grantedInCategory === categoryCommands.length) {
                    // All commands granted - category is fully granted
                    return { [category]: 'fully-granted' };
                } else {
                    // Some commands granted, some blocked - category is partial
                    return { [category]: 'partial' };
                }
            } else {
                // Explicitly granted but checking further for partial status
                // This handles cases where category is granted but has exclusions
                const categoryCommandSet = new Set(categoryCommands);

                if (category === 'all') {
                    // Already handled above
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
                    // For other explicitly granted categories, check if there are individual command exclusions
                    const individuallyGrantedCommands = new Set();
                    const individuallyBlockedCommands = new Set();

                    // Get individual command grants and blocks from the parsed rule (root level)
                    if (this.lastApiResponse && this.lastApiResponse.parsed_rule && this.lastApiResponse.parsed_rule.command_rules) {
                        this.lastApiResponse.parsed_rule.command_rules.forEach(rule => {
                            if (rule.target === 'command' && rule.type === 'allow') {
                                individuallyGrantedCommands.add(rule.value);
                            } else if (rule.target === 'command' && rule.type === 'deny') {
                                individuallyBlockedCommands.add(rule.value);
                            }
                        });
                    }

                    // Also check selectors for individual command grants/blocks
                    if (this.lastApiResponse && this.lastApiResponse.parsed_rule && this.lastApiResponse.parsed_rule.selectors) {
                        this.lastApiResponse.parsed_rule.selectors.forEach(selector => {
                            if (selector.command_rules) {
                                selector.command_rules.forEach(rule => {
                                    if (rule.target === 'command' && rule.type === 'allow') {
                                        individuallyGrantedCommands.add(rule.value);
                                    } else if (rule.target === 'command' && rule.type === 'deny') {
                                        individuallyBlockedCommands.add(rule.value);
                                    }
                                });
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
                        // Check if this category is granted via a category rule in root or selectors
                        let grantedAsCategory = false;

                        // Check root command_rules for category grant
                        if (this.lastApiResponse?.parsed_rule?.command_rules) {
                            grantedAsCategory = this.lastApiResponse.parsed_rule.command_rules.some(rule =>
                                rule.target === 'category' && rule.type === 'allow' && rule.value === category
                            );
                        }

                        // Check selectors for category grant
                        if (!grantedAsCategory && this.lastApiResponse?.parsed_rule?.selectors) {
                            grantedAsCategory = this.lastApiResponse.parsed_rule.selectors.some(selector =>
                                selector.command_rules?.some(rule =>
                                    rule.target === 'category' && rule.type === 'allow' && rule.value === category
                                )
                            );
                        }

                        // If granted as category (+@foo) in root or selector, it's fully granted
                        if (grantedAsCategory) {
                            return { [category]: 'fully-granted' };
                        }

                        // All commands granted but not via direct category grant
                        // Show as fully-granted (implicitly) so user can see which categories are covered
                        return { [category]: 'fully-granted' };
                    }

                    // If only some commands are granted, show as partial regardless of how they're granted
                    // This handles cases like @dangerous being partially granted when @admin is granted
                    // (some dangerous commands are also admin commands)
                    return { [category]: 'partial' };
                }
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
        return ACLCategoryManager.getCategoryCommandsCached(
            category,
            AppState.currentVersion,
            this._categoryCommandsCache,
            (cat) => this.getCategoryCommands(cat)
        );
    },

    /**
     * Add enhanced tooltip functionality with relationship information
     */
    addEnhancedTooltip(button, type, name) {
        return ACLUIRenderer.addEnhancedTooltip(button, type, name, {
            API,
            AppState,
            getCategoryCommandsCached: (cat) => this.getCategoryCommandsCached(cat),
            createMultiColumnContent: (title, items, prefix) => this.createMultiColumnContent(title, items, prefix),
            lastApiResponse: this.lastApiResponse
        });
    },

    /**
     * Create multi-column content for large lists in tooltips
     */
    createMultiColumnContent(title, items, prefix = '') {
        return ACLUIRenderer.createMultiColumnContent(title, items, prefix);
    },

    /**
     * Create a category button element
     */
    async createCategoryButton(category, state, categoryAnalysis = null, blockType = null) {
        return ACLUIRenderer.createCategoryButton(
            category,
            state,
            categoryAnalysis,
            blockType,
            this.state,
            {
                toggleCategory: (cat) => this.toggleCategory(cat),
                clearAllCategory: () => this.clearAllCategory(),
                removePartialGrantsFromBlockedCategory: (cat) => this.removePartialGrantsFromBlockedCategory(cat),
                removeAllCategoryRelatedTerms: (cat) => this.removeAllCategoryRelatedTerms(cat),
                removeAllCategoryCommands: (cat) => this.removeAllCategoryCommands(cat),
                hasConflictingIndividualCommands: (cat) => this.hasConflictingIndividualCommands(cat),
                removeConflictingIndividualCommands: (cat) => this.removeConflictingIndividualCommands(cat),
                blockCategory: (cat) => this.blockCategory(cat),
                grantCategory: (cat) => this.grantCategory(cat),
                grantCategoryAndRemoveConflictingCommands: (cat) => this.grantCategoryAndRemoveConflictingCommands(cat),
                grantAllCategory: () => this.grantAllCategory(),
                grantCategoryAndCleanup: (cat) => this.grantCategoryAndCleanup(cat),
                removeAllBlocksForAllCategory: () => this.removeAllBlocksForAllCategory()
            },
            (btn, type, name) => this.addEnhancedTooltip(btn, type, name)
        );
    },

    /**
     * Create a command button element
     */
    createCommandButton(command, state, blockType = null) {
        return ACLUIRenderer.createCommandButton(
            command,
            state,
            blockType,
            this.state,
            {
                grantCommand: (cmd) => this.grantCommand(cmd),
                toggleCommand: (cmd) => this.toggleCommand(cmd)
            },
            (btn, type, name) => this.addEnhancedTooltip(btn, type, name)
        );
    },

    /**
     * Create a command button for granted commands (handles commands granted via categories)
     */
    createGrantedCommandButton(command, isViaCategory, isIndividual) {
        return ACLUIRenderer.createGrantedCommandButton(
            command,
            isViaCategory,
            isIndividual,
            {
                toggleCommand: (cmd) => this.toggleCommand(cmd),
                blockCommandFromCategory: (cmd) => this.blockCommandFromCategory(cmd)
            },
            (btn, type, name) => this.addEnhancedTooltip(btn, type, name)
        );
    },

    /**
     * Block a command that was granted via category
     */
    async blockCommandFromCategory(command) {
        return ACLCategoryManager.blockCommandFromCategory(
            this.state,
            command,
            () => this.finalizeStateChange()
        );
    },

    /**
     * Check if any categories are now fully granted/blocked via individual commands
     * and automatically simplify them to category grants/blocks
     * Delegated to ACLOptimizer module
     */
    async checkAndAutoSimplifyCategories() {
        return ACLOptimizer.checkAndAutoSimplifyCategories(this.state, {
            detectCancelledAllPattern: () => this.detectCancelledAllPattern(),
            detectAllCategoriesPattern: () => this.detectAllCategoriesPattern(),
            detectIndividualCategoryOptimizations: () => this.detectIndividualCategoryOptimizations()
        }, (opts) => this.applyOptimizations(opts));
    },

    /**
     * Detect cancelled @all pattern - @all granted but all other categories blocked = empty ACL
     */
    /**
     * Optimization detection methods - delegated to ACLOptimizer module
     */
    async detectCancelledAllPattern() {
        return ACLOptimizer.detectCancelledAllPattern(this.state);
    },

    async detectAllCategoriesPattern() {
        return ACLOptimizer.detectAllCategoriesPattern(this.state);
    },

    async detectIndividualCategoryOptimizations() {
        return ACLOptimizer.detectIndividualCategoryOptimizations(this.state, (cat) => this.getCategoryCommandsCached(cat));
    },

    async detectCancelledExclusion(category, categoryCommands) {
        return ACLOptimizer.detectCancelledExclusion(category, categoryCommands, this.state);
    },

    async detectNullCategory(category, categoryCommands) {
        return ACLOptimizer.detectNullCategory(category, categoryCommands, this.state);
    },

    async detectFullCategoryGrant(category, categoryCommands) {
        return ACLOptimizer.detectFullCategoryGrant(category, categoryCommands, this.state);
    },

    async detectFullCategoryBlock(category, categoryCommands) {
        return ACLOptimizer.detectFullCategoryBlock(category, categoryCommands, this.state);
    },

    /**
     * Apply the detected optimizations
     * Delegated to ACLOptimizer module
     */
    async applyOptimizations(optimizations) {
        return ACLOptimizer.applyOptimizations(optimizations, {
            applyCancelledAllOptimization: (count) => this.applyCancelledAllOptimization(count),
            applyAllCategoriesOptimization: (count) => this.applyAllCategoriesOptimization(count),
            applyCancelExclusionOptimization: (cat, cmds, cnt) => this.applyCancelExclusionOptimization(cat, cmds, cnt),
            applyNullCategoryOptimization: (cat, cmds, cnt) => this.applyNullCategoryOptimization(cat, cmds, cnt),
            applyCategoryGrantOptimization: (cat, cmds, cnt) => this.applyCategoryGrantOptimization(cat, cmds, cnt),
            applyCategoryBlockOptimization: (cat, cmds, cnt) => this.applyCategoryBlockOptimization(cat, cmds, cnt)
        }, () => this.updateRuleText());
    },

    /**
     * Individual optimization application methods
     * Delegated to ACLOptimizer module
     */
    applyCancelledAllOptimization(count) {
        return ACLOptimizer.applyCancelledAllOptimization(this.state, count, ACLStateManager);
    },

    applyAllCategoriesOptimization(count) {
        return ACLOptimizer.applyAllCategoriesOptimization(this.state, count, ACLStateManager);
    },

    applyCancelExclusionOptimization(category, commands, count) {
        return ACLOptimizer.applyCancelExclusionOptimization(this.state, category, commands, count, ACLStateManager);
    },

    applyNullCategoryOptimization(category, commands, count) {
        return ACLOptimizer.applyNullCategoryOptimization(this.state, category, commands, count, ACLStateManager);
    },

    applyCategoryGrantOptimization(category, commands, count) {
        return ACLOptimizer.applyCategoryGrantOptimization(this.state, category, commands, count, ACLStateManager);
    },

    applyCategoryBlockOptimization(category, commands, count) {
        return ACLOptimizer.applyCategoryBlockOptimization(this.state, category, commands, count, ACLStateManager);
    },

    /**
     * Check for comprehensive optimization opportunities and auto-apply
     * Only called when shouldComprehensiveOptimize flag is true (button clicks)
     * Delegated to ACLOptimizer module
     */
    async checkAndAutoOptimize() {
        const currentRule = this.elements.aclRuleInput.value.trim();

        return ACLOptimizer.checkAndAutoOptimize(currentRule, AppState.currentVersion, {
            updateRuleText: (optimizedRule) => {
                this.elements.aclRuleInput.value = optimizedRule;
            },
            updateLastGeneratedRule: (optimizedRule) => {
                this.state.lastGeneratedRule = optimizedRule;
            },
            syncFromRuleText: async () => {
                await this.syncFromRuleText();
            }
        });
    },

    /**
     * Helper method for showing optimization notifications
     * Delegated to ACLOptimizer module
     */
    showOptimizationNotification(message, type) {
        return ACLOptimizer.showOptimizationNotification(message, type);
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
     * Delegated to ACLOptimizer module
     */
    async simplifyToCategory(category) {
        return ACLOptimizer.simplifyToCategory(category, this.state, ACLStateManager, {
            getCategoryCommands: (cat) => this.getCategoryCommandsCached(cat),
            updateRuleText: () => this.updateRuleText(),
            scheduleRender: () => this.scheduleRender()
        });
    },

    /**
     * Remove all individual commands for a category (when clicking implicitly granted category)
     * This removes the individual commands without adding the category grant
     * Delegated to ACLOptimizer module
     */
    async removeAllCategoryCommands(category) {
        return ACLOptimizer.removeAllCategoryCommands(category, this.state, ACLStateManager, {
            getCategoryCommands: (cat) => this.getCategoryCommandsCached(cat),
            updateRuleText: () => this.updateRuleText(),
            scheduleRender: () => this.scheduleRender()
        });
    },

    /**
     * Update the ACL rule text based on current state
     * @param {boolean} addToHistory - Whether to add this rule to history (default: true)
     */
    async updateRuleText(addToHistory = true) {
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

        // Add the newly committed rule to history BEFORE saving it (only for user actions, not render refreshes)
        // Include empty rules from button clicks (e.g., clicking last category that auto-optimizes to empty)
        if (addToHistory) {
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
     * Delegated to ACLRuleParser module
     */
    async generateOptimizedRule() {
        return ACLRuleParser.generateOptimizedRule(this.state, {
            getCommandsGrantedByInclusions: () => this.getCommandsGrantedByInclusions(),
            categoryOverlapsWithGranted: (cat, cmds) => this.categoryOverlapsWithGranted(cat, cmds)
        });
    },

    /**
     * Get all commands that would be granted by current inclusion terms
     * Delegated to ACLRuleParser module
     */
    async getCommandsGrantedByInclusions() {
        return ACLRuleParser.getCommandsGrantedByInclusions(this.state, () => this.getCommandsGrantedByCategories());
    },

    /**
     * Get all commands that are blocked by excluded categories
     * Delegated to ACLRuleParser module
     */
    async getCommandsBlockedByCategories() {
        return ACLRuleParser.getCommandsBlockedByCategories(this.state, API, AppState);
    },

    /**
     * Check if a blocked category would actually exclude any granted commands
     * Delegated to ACLRuleParser module
     */
    categoryOverlapsWithGranted(_category, _grantedCommands) {
        return ACLRuleParser.categoryOverlapsWithGranted(_category, _grantedCommands);
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
     * Extract selectors from ACL rule (matches backend _extract_selectors logic)
     * @param {string} rule - Full ACL rule string
     * @returns {Object} - { rootRule: string, selectors: string[] }
     */
    extractSelectors(rule) {
        const selectors = [];
        let currentPos = 0;
        let rootParts = [];
        let depth = 0;
        let currentSelector = '';

        for (let i = 0; i < rule.length; i++) {
            const char = rule[i];

            if (char === '(') {
                if (depth === 0) {
                    // Start of new selector - save root part before this
                    rootParts.push(rule.substring(currentPos, i));
                    currentPos = i + 1;
                    currentSelector = '';
                }
                depth++;
            } else if (char === ')') {
                depth--;
                if (depth === 0) {
                    // End of selector
                    currentSelector = rule.substring(currentPos, i);
                    selectors.push(currentSelector.trim());
                    currentPos = i + 1;
                }
            }
        }

        // Add remaining root part
        if (currentPos < rule.length) {
            rootParts.push(rule.substring(currentPos));
        }

        const rootRule = rootParts.join(' ').trim();
        return { rootRule, selectors };
    },

    /**
     * Parse permission set (either root or selector) into orderedTerms structure
     * @param {string} permissionSet - Space-separated ACL terms
     * @returns {Object} - { orderedTerms: [], keyPatterns: Set, channelPatterns: Set, grantedCategories: Set, ... }
     */
    parsePermissionSet(permissionSet) {
        const tokens = permissionSet.split(/\s+/).filter(token => token.length > 0);
        const orderedTerms = [];
        const grantedCategories = new Set();
        const blockedCategories = new Set();
        const grantedCommands = new Set();
        const blockedCommands = new Set();
        const keyPatterns = new Set();
        const channelPatterns = new Set();

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
                grantedCommands.add(command);
                orderedTerms.push({ type: 'command', operation: 'grant', value: command });
            } else if (token.startsWith('-') && !token.startsWith('-@')) {
                // Blocked command
                const command = token.substring(1);
                blockedCommands.add(command);
                orderedTerms.push({ type: 'command', operation: 'block', value: command });
            } else if (token.startsWith('~') || token.startsWith('%')) {
                // Key pattern
                keyPatterns.add(token);
            } else if (token.startsWith('&')) {
                // Channel pattern
                channelPatterns.add(token);
            }
        }

        return {
            orderedTerms,
            grantedCategories,
            blockedCategories,
            grantedCommands,
            blockedCommands,
            keyPatterns,
            channelPatterns
        };
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
            this.state.channelPatterns.clear();
            this.state.orderedTerms = []; // Reset ordered terms
            this.state.selectors = []; // Reset selectors

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
                        // Extract selectors from the rule
                        const { rootRule, selectors: selectorStrings } = this.extractSelectors(ruleText);

                        // Parse root permissions
                        const rootPerms = this.parsePermissionSet(rootRule);

                        // Update root state
                        this.state.grantedCategories = rootPerms.grantedCategories;
                        this.state.grantedCommands = rootPerms.grantedCommands;
                        this.state.blockedCategories = rootPerms.blockedCategories;
                        this.state.blockedCommands = rootPerms.blockedCommands;
                        this.state.keyPatterns = rootPerms.keyPatterns;
                        this.state.channelPatterns = rootPerms.channelPatterns;
                        this.state.orderedTerms = rootPerms.orderedTerms;

                        // Parse each selector
                        this.state.selectors = [];
                        for (const selectorStr of selectorStrings) {
                            const selectorPerms = this.parsePermissionSet(selectorStr);
                            this.state.selectors.push({
                                orderedTerms: selectorPerms.orderedTerms,
                                grantedCategories: selectorPerms.grantedCategories,
                                grantedCommands: selectorPerms.grantedCommands,
                                blockedCategories: selectorPerms.blockedCategories,
                                blockedCommands: selectorPerms.blockedCommands,
                                keyPatterns: selectorPerms.keyPatterns,
                                channelPatterns: selectorPerms.channelPatterns
                            });
                        }

                        // Update legacy Sets to include selector content for category button detection
                        // Merge selector categories and commands into root state Sets for UI display
                        for (const selector of this.state.selectors) {
                            // Add granted categories from selector
                            selector.grantedCategories.forEach(cat => this.state.grantedCategories.add(cat));
                            // Add granted commands from selector
                            selector.grantedCommands.forEach(cmd => this.state.grantedCommands.add(cmd));
                            // Don't merge blocked items - we only want to show granted items from selectors
                        }
                    } else {
                        // Empty rule - clear all state
                        this.state.grantedCategories.clear();
                        this.state.grantedCommands.clear();
                        this.state.blockedCategories.clear();
                        this.state.blockedCommands.clear();
                        this.state.keyPatterns.clear();
                        this.state.channelPatterns.clear();
                        this.state.orderedTerms = [];
                        this.state.selectors = [];
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
            } else if (token.startsWith('&')) {
                // Channel pattern (&)
                this.state.channelPatterns.add(token);
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
            this.state.orderedTerms = ACLStateManager.removeTermsByCategory(this.state.orderedTerms, value);
        }
        if (this.StateManager?.addTerm) {
            ACLStateManager.addTerm(this.state.orderedTerms, type, operation, value);
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