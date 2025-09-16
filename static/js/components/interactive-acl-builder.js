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
        lastValidRule: ''                // Track the last valid rule for testing purposes
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
    },

    /**
     * Grant a category (add to granted)
     */
    async grantCategory(category) {
        this.state.grantedCategories.add(category);
        this.state.blockedCategories.delete(category);
        
        // Update ordered terms - remove any existing entries for this category and add new grant
        this.state.orderedTerms = this.state.orderedTerms.filter(term => 
            !(term.type === 'category' && term.value === category)
        );
        this.state.orderedTerms.push({ type: 'category', operation: 'grant', value: category });
        
        this.scheduleRender();
    },

    /**
     * Block a category (add to blocked)
     */
    async blockCategory(category) {
        this.state.blockedCategories.add(category);
        this.state.grantedCategories.delete(category);
        
        // Update ordered terms - remove any existing entries for this category and add new block
        this.state.orderedTerms = this.state.orderedTerms.filter(term => 
            !(term.type === 'category' && term.value === category)
        );
        this.state.orderedTerms.push({ type: 'category', operation: 'block', value: category });
        
        this.scheduleRender();
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
                    console.log(`Cleaned up ${commandsToRemove.length} command exclusions for category ${category}:`, commandsToRemove);
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
        this.state.grantedCommands.add(command);
        this.state.blockedCommands.delete(command);
        
        // Update ordered terms - remove any existing entries for this command and add new grant
        this.state.orderedTerms = this.state.orderedTerms.filter(term => 
            !(term.type === 'command' && term.value === command)
        );
        this.state.orderedTerms.push({ type: 'command', operation: 'grant', value: command });
        
        this.scheduleRender();
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

        this.scheduleRender();
    },

    /**
     * Render the interactive columns
     */
    async renderColumns() {
        // Note: Loading class is already in HTML to prevent initial flash
        
        await this.renderCategoryButtons();
        await this.renderCommandButtons();
        
        // Note: Loading covers are removed after init completes in init() method
    },

    /**
     * Apply loading covers to hide empty state during updates
     */
    applyLoadingAnimation() {
        const containers = document.querySelectorAll('.command-categories-container');
        containers.forEach(container => {
            // Reset scroll position to ensure loading cover aligns properly
            container.scrollTop = 0;

            // Remove any existing fade-out state first
            container.classList.remove('loading-fadeout');
            // Apply loading cover
            container.classList.add('loading');
        });
    },

    /**
     * Remove loading covers after content is rendered (covers start in HTML)
     */
    removeLoadingAnimation() {
        const containers = document.querySelectorAll('.command-categories-container.loading');
        if (containers.length === 0) return; // Already removed or not found

        containers.forEach(container => {
            // Add fade-out class to trigger smooth opacity transition
            container.classList.add('loading-fadeout');

            // Remove both classes after fade animation completes
            setTimeout(() => {
                container.classList.remove('loading', 'loading-fadeout');
            }, 200); // Match CSS transition duration
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
        }, 200); // Match CSS transition duration
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

        // Small delay to ensure loading covers are visible, then render
        setTimeout(async () => {
            // Update rule text based on current state (skip during Submit Changes to preserve user input)
            if (shouldUpdateRuleText) {
                await this.updateRuleText();
            }
            
            // Then refresh API response data for partial category detection
            const currentRule = this.elements.aclRuleInput.value.trim();
            if (currentRule) {
                try {
                    const response = await API.parseRule(currentRule, AppState.currentVersion);
                    if (response && response.success) {
                        this.lastApiResponse = response;
                    }
                } catch (error) {
                    console.error('Error refreshing API response:', error);
                }
            }
            
            // Now render with fresh API data
            await this.renderColumns();

            // Apply search filters while containers are completely hidden
            SearchManager.refreshAllSearches();

            // Force a brief delay to ensure DOM updates and filters are fully applied
            await new Promise(resolve => setTimeout(resolve, 10));

            // Use multiple requestAnimationFrame cycles to ensure all DOM changes are complete
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Apply filters one more time to be absolutely sure
                        SearchManager.refreshAllSearches();

                        // Remove loading covers with smooth fade animation
                        this.removeLoadingAnimation();
                    });
                });
            });
        }, 80); // Slightly faster
    },

    /**
     * Render category buttons in both columns
     */
    async renderCategoryButtons() {
        // For now, let's simplify and not use the three-state analysis to fix the loading issue
        // We can re-enable it once we debug the problem
        const hasAllCategory = this.state.grantedCategories.has('all');
        
        // Determine effective status of all categories based on ACL rule precedence
        const effectiveCategoryStatus = this.getEffectiveCategoryStatus();
        
        // Render granted categories
        if (this.elements.grantedCategoriesButtons) {
            // Clear any existing content (including initial placeholders from HTML)
            this.elements.grantedCategoriesButtons.innerHTML = '';
            
            const effectivelyGrantedCategories = [];
            
            if (hasAllCategory) {
                // When @all is granted, show the @all category itself first
                effectivelyGrantedCategories.push('all');
                
                // Then show all other categories that are effectively granted
                this.state.allCategories.forEach(category => {
                    if (effectiveCategoryStatus[category] === 'granted') {
                        effectivelyGrantedCategories.push(category);
                    }
                });
            } else {
                // Normal case - only show explicitly granted categories
                effectivelyGrantedCategories.push(...Array.from(this.state.grantedCategories));
            }
            
            if (effectivelyGrantedCategories.length === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'No categories granted';
                this.elements.grantedCategoriesButtons.appendChild(message);
            } else {
                // Sort categories, but keep @all at the front if present
                const hasAllInGrantedList = effectivelyGrantedCategories.includes('all');
                let sortedCategories;
                
                if (hasAllInGrantedList) {
                    // Remove @all from the list, sort the rest, then add @all back at the front
                    const withoutAll = effectivelyGrantedCategories.filter(cat => cat !== 'all').sort();
                    sortedCategories = ['all', ...withoutAll];
                } else {
                    // Normal sorting when @all is not in the list
                    sortedCategories = effectivelyGrantedCategories.sort();
                }
                
                // First, we need to detect which granted categories are partial (have blocked subcommands)
                const categoryAnalysisPromises = sortedCategories.map(async (category) => {
                    const categoryAnalysis = await this.detectPartialCategory(category);
                    return { category, categoryAnalysis };
                });
                
                // Wait for all analyses to complete
                const analyses = await Promise.all(categoryAnalysisPromises);
                
                analyses.forEach(({ category, categoryAnalysis }) => {
                    const button = this.createCategoryButton(category, 'granted', categoryAnalysis);
                    
                    // Special handling for @all case - adjust tooltips and click behavior only
                    // (Visual styling is now handled by CSS classes in createCategoryButton)
                    if (hasAllCategory && !this.state.grantedCategories.has(category)) {
                        // This category is granted via @all, clicking should block it
                        button.dataset.stateInfo = `@${category} category (granted via @all) - Click to block`;
                        button.onclick = () => this.blockCategory(category);
                    } else if (hasAllCategory && this.state.grantedCategories.has(category)) {
                        // This category is explicitly granted in addition to @all
                        button.dataset.stateInfo = `@${category} category (explicitly granted) - Click to toggle`;
                        // Keep default toggleCategory behavior
                    }
                    
                    this.elements.grantedCategoriesButtons.appendChild(button);
                });
            }
            
            // Update the granted categories header
            this.updateCategorySectionHeader('granted', effectivelyGrantedCategories.length);
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
                this.state.allCategories.forEach(category => {
                    if (effectiveCategoryStatus[category] === 'blocked') {
                        effectivelyBlockedCategories.push(category);
                    } else if (effectiveCategoryStatus[category] === 'available') {
                        availableCategories.push(category);
                    }
                    // Categories with 'granted' status are handled in the granted section above
                });

                // Always show @all category as available when it's not granted and not blocked
                if (!this.state.grantedCategories.has('all') && !this.state.blockedCategories.has('all')) {
                    // Only add if not already added by effectiveCategoryStatus logic
                    if (!availableCategories.includes('all') && !effectivelyBlockedCategories.includes('all')) {
                        availableCategories.unshift('all'); // Add @all at the beginning
                    }
                }
            }

            // Show blocked categories: EXPLICITLY blocked first, then implicitly blocked
            if (effectivelyBlockedCategories.length > 0) {
                // Collect all blocked categories with their types for smart sorting
                const blockedCategories = [];

                effectivelyBlockedCategories.forEach(category => {
                    const isExplicitlyBlocked = this.state.blockedCategories.has(category);

                    if (isExplicitlyBlocked) {
                        // Explicitly blocked category (e.g., -@dangerous)
                        blockedCategories.push({ category, type: 'explicit', priority: 1 });
                    } else {
                        // Implicitly blocked category (available but not granted)
                        blockedCategories.push({ category, type: 'implicit', priority: 2 });
                    }
                });

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


                blockedCategories.forEach(({ category, type }) => {
                    const button = this.createCategoryButton(category, 'blocked', null, type);
                    this.elements.blockedCategoriesButtons.appendChild(button);
                });
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
                    
                    finalOrder.forEach(category => {
                        const button = this.createCategoryButton(category, 'available');
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
                    });
                } else {
                    // Normal sorting when @all is not in the list
                    sortedCategories.sort().forEach(category => {
                        const button = this.createCategoryButton(category, 'available');
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
                    });
                }
            }

            if (availableCategories.length === 0 && effectivelyBlockedCategories.length === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'No categories available';
                this.elements.blockedCategoriesButtons.appendChild(message);
            }
            
            // Update the blocked categories header
            const categoryCount = effectivelyBlockedCategories.length + availableCategories.length;
            this.updateCategorySectionHeader('blocked', categoryCount);
        }
    },

    /**
     * Determine effective status of all categories based on ACL rule precedence
     * This handles the @all category properly according to rule order
     */
    getEffectiveCategoryStatus() {
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
            
            // Get all commands granted via categories and individual grants
            const grantedViaCategories = await this.getCommandsGrantedByCategories();
            // Filter out explicitly blocked commands from the granted list
            const effectiveGrantedViaCategories = grantedViaCategories.filter(cmd => !this.state.blockedCommands.has(cmd));
            const allGrantedCommands = new Set([...this.state.grantedCommands, ...effectiveGrantedViaCategories]);
            
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
                    const isIndividual = this.state.grantedCommands.has(command);
                    if (isIndividual) {
                        explicitlyGrantedCommands.push(command);
                    } else {
                        implicitlyGrantedCommands.push(command);
                    }
                });

                // Show explicitly granted commands first (sorted), then implicitly granted (sorted)
                explicitlyGrantedCommands.sort().forEach(command => {
                    const isViaCategory = effectiveGrantedViaCategories.includes(command);
                    const isIndividual = true; // Always true for this group
                    const button = this.createGrantedCommandButton(command, isViaCategory, isIndividual);
                    wrapper.appendChild(button);
                });

                implicitlyGrantedCommands.sort().forEach(command => {
                    const isViaCategory = effectiveGrantedViaCategories.includes(command);
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
            Array.from(this.state.blockedCommands).forEach(command => {
                commandsToShow.push({ command, type: 'explicit', priority: 1, visual: 'highlighted' });
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
            this.updateCommandSectionHeader('blocked', commandsToShow.length);
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
     * Detect if a granted category is partial (has blocked subcommands)
     * Returns analysis object for use with createCategoryButton
     */
    async detectPartialCategory(category) {
        try {
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
            }
            
            // Check how many commands in this category are granted
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
            
            // Debug logging for partial category detection
            
            return { [category]: state };
        } catch (error) {
            console.error(`Error detecting partial category ${category}:`, error);
            return { [category]: 'fully-granted' }; // Default to fully-granted on error
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
    createCategoryButton(category, state, categoryAnalysis = null, blockType = null) {
        const button = document.createElement('button');
        
        // Determine visual state and styling
        let buttonClass, tooltipText, clickHandler;
        
        if (state === 'granted') {
            const analysisState = categoryAnalysis?.[category];
            
            if (analysisState === 'partial') {
                buttonClass = `category-button granted partial`;
                tooltipText = `@${category} category (partially granted) - Some commands in this category are excluded - Click to revoke`;
                clickHandler = () => this.toggleCategory(category);
            } else if (analysisState === 'fully-granted' && !this.state.grantedCategories.has(category)) {
                // Implicitly granted (all commands granted individually)
                buttonClass = `category-button granted implicit`;
                tooltipText = `@${category} category (implicitly granted) - All commands granted individually - Click to add category rule`;
                clickHandler = () => this.grantCategory(category);
            } else {
                // Explicitly granted
                buttonClass = `category-button granted explicit`;
                tooltipText = `@${category} category (explicitly granted) - Click to revoke`;
                clickHandler = () => this.toggleCategory(category);
            }
        } else if (state === 'available') {
            buttonClass = `category-button blocked implicit`; // Available = implicitly blocked (not granted)
            tooltipText = `Click to grant @${category} category`;
            clickHandler = () => this.grantCategory(category);
        } else if (state === 'blocked') {
            // Determine if explicitly or implicitly blocked
            if (blockType === 'explicit' || this.state.blockedCategories.has(category)) {
                buttonClass = `category-button blocked explicit`;
                tooltipText = `@${category} category (explicitly blocked) - Click to toggle`;
            } else {
                buttonClass = `category-button blocked implicit`;
                tooltipText = `@${category} category (implicitly blocked) - Click to grant`;
            }
            clickHandler = () => this.toggleCategory(category);
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
        
        this.scheduleRender();
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
        import('../handlers/event-handlers.js').then(({ default: EventHandlers }) => {
            EventHandlers.updateCharacterCounterProgrammatically(this.elements.aclRuleInput);
        });
        
        // Track the rule we just generated
        this.state.lastGeneratedRule = rule;
        this.state.lastValidRule = rule;     // This is a valid rule for testing
        this.state.hasManualChanges = false;
        this.hideSubmitButton();
        
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
    async syncFromRuleText(isRestoration = false, preserveUserInput = false) {
        if (!this.elements.aclRuleInput || !this.state.isInitialized) {
            return;
        }

        const rawRuleText = this.elements.aclRuleInput.value.trim();
        const ruleText = Utils.normalizeACLRule(rawRuleText);
        
        // Update the textarea with normalized rule if it changed
        if (ruleText !== rawRuleText) {
            // Mark as programmatic update to prevent panel expansion
            this.elements.aclRuleInput.dataset.programmaticUpdate = 'true';
            this.elements.aclRuleInput.value = ruleText;
            
            // Update character counter and button states
            import('../handlers/event-handlers.js').then(({ default: EventHandlers }) => {
                EventHandlers.updateCharacterCounterProgrammatically(this.elements.aclRuleInput);
                EventHandlers.updateActionButtonStates(ruleText);
            });
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
            if (ruleText) {
                try {
                    // Use the same API call that RuleManager uses for accurate parsing
                    const data = await API.parseRule(ruleText, AppState.currentVersion);
                    
                    if (data && data.success) {
                        // Store the API response for partial category detection
                        this.lastApiResponse = data;
                        
                        // Parse rule tokens to determine what was explicitly granted
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
                        
                        // Parse key patterns
                        this.state.keyPatterns.clear();
                        for (const token of tokens) {
                            if (token.startsWith('~')) {
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
                        // Fallback to simple text parsing if API fails
                        this.fallbackTextParsing(ruleText);
                    }
                } catch (error) {
                    console.error('Error parsing rule with API, falling back to text parsing:', error);
                    this.fallbackTextParsing(ruleText);
                }
            }

            // Re-render the interactive display with loading animation to prevent visual artifacts
            // Skip rule text regeneration during Submit Changes to preserve user input for redundancy analysis
            await this.smoothRender(!isRestoration);
            
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
            }

            // Always analyze for redundancy to show optimization suggestions (including during restoration)
            try {
                RuleManager.analyzeRedundancy();
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
            } else if (token.startsWith('~')) {
                // Key pattern
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
    }
};

export default InteractiveACLBuilder;