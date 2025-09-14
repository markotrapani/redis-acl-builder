/**
 * Interactive ACL Builder
 * Handles the three-column interactive interface for building ACL rules
 */

import AppState from '../core/app-state.js';
import Utils from '../core/utils.js';
import API from '../api/api-client.js';
import RuleManager from '../managers/rule-manager.js';
import Storage from '../core/storage.js';

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
            await this.renderColumns();
            
            // Check if there's existing content in textarea (from localStorage restoration)
            const existingRule = this.elements.aclRuleInput.value.trim();
            
            // Set initialized to true before restoration so syncFromRuleText works
            this.state.isInitialized = true;
            
            if (existingRule) {
                // Restore lastGeneratedRule BEFORE restoration for proper change detection
                const savedLastGenerated = Storage.loadLastGeneratedRule();
                if (savedLastGenerated) {
                    this.state.lastGeneratedRule = savedLastGenerated;
                }
                
                await this.syncFromRuleText(true); // Pass true to indicate this is restoration
            } else {
                await this.updateRuleText();
            }
            
            // Add event listeners
            this.setupEventListeners();
            
            // Remove ALL loading covers after initialization and content updates are complete
            setTimeout(() => {
                this.removeTextareaLoadingCover();
                this.removeLoadingAnimation();
            }, 150); // Small delay to ensure all async operations complete
            
            // Final check for Submit Changes button visibility after initialization
            // This handles cases where restoration failed but button should still be shown
            setTimeout(() => {
                this.checkForManualChanges();
            }, 100);
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
        }, 150); // Match CSS transition duration
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
            });
        }, 100); // 100ms debounce for smoother batching
    },

    /**
     * Smooth rendering with fade transitions
     */
    async smoothRender() {
        const containers = [
            this.elements.grantedCategoriesButtons,
            this.elements.grantedCommandsButtons,
            this.elements.blockedCategoriesButtons, 
            this.elements.blockedCommandsButtons
        ].filter(Boolean);

        // Quick fade out only the button containers, not their parents
        containers.forEach(container => {
            container.style.transition = 'opacity 0.1s ease';
            container.style.opacity = '0.5';
        });

        // Wait for fade, then render
        setTimeout(async () => {
            // First update the rule text to get the current rule string
            await this.updateRuleText();
            
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

            // Fade back in and clean up inline styles
            requestAnimationFrame(() => {
                containers.forEach(container => {
                    container.style.opacity = '1';
                    // Clean up inline styles to avoid conflicts with CSS classes
                    setTimeout(() => {
                        container.style.transition = '';
                        container.style.opacity = '';
                    }, 150); // After fade completes
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
                        button.title = `@${category} category (granted via @all) - Click to block`;
                        button.onclick = () => this.blockCategory(category);
                    } else if (hasAllCategory && this.state.grantedCategories.has(category)) {
                        // This category is explicitly granted in addition to @all
                        button.title = `@${category} category (explicitly granted) - Click to toggle`;
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
                // Normal case - show available categories (not granted, not blocked)
                availableCategories.push(...this.state.allCategories.filter(cat => 
                    !this.state.grantedCategories.has(cat) && !this.state.blockedCategories.has(cat)
                ));
                
                // Always show @all category as available when it's not granted and not blocked
                if (!this.state.grantedCategories.has('all') && !this.state.blockedCategories.has('all')) {
                    availableCategories.unshift('all'); // Add @all at the beginning
                }
                
                // Show explicitly blocked categories
                effectivelyBlockedCategories.push(...Array.from(this.state.blockedCategories));
            }
            
            // Show available categories first
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
                        button.title = `Click to grant @${category} category`;
                        
                        // Special styling for @all when it's implicitly blocked (empty rule scenario)
                        if (category === 'all') {
                            const isEmptyRule = this.state.grantedCategories.size === 0 && 
                                               this.state.grantedCommands.size === 0 && 
                                               this.state.blockedCategories.size === 0 && 
                                               this.state.blockedCommands.size === 0;
                            
                            if (isEmptyRule) {
                                button.style.opacity = '0.7';
                                button.title = `@${category} category (implicitly blocked - empty rule) - Click to grant`;
                            }
                        }
                        
                        this.elements.blockedCategoriesButtons.appendChild(button);
                    });
                } else {
                    // Normal sorting when @all is not in the list
                    sortedCategories.sort().forEach(category => {
                        const button = this.createCategoryButton(category, 'available');
                        button.title = `Click to grant @${category} category`;
                        
                        // Special styling for @all when it's implicitly blocked (empty rule scenario)
                        if (category === 'all') {
                            const isEmptyRule = this.state.grantedCategories.size === 0 && 
                                               this.state.grantedCommands.size === 0 && 
                                               this.state.blockedCategories.size === 0 && 
                                               this.state.blockedCommands.size === 0;
                            
                            if (isEmptyRule) {
                                button.style.opacity = '0.7';
                                button.title = `@${category} category (implicitly blocked - empty rule) - Click to grant`;
                            }
                        }
                        
                        this.elements.blockedCategoriesButtons.appendChild(button);
                    });
                }
            }
            
            // Show blocked categories: EXPLICITLY blocked first, then implicitly blocked
            if (effectivelyBlockedCategories.length > 0) {
                // Collect all blocked categories with their types for smart sorting
                const blockedCategories = [];
                
                effectivelyBlockedCategories.forEach(category => {
                    if (this.state.blockedCategories.has(category)) {
                        // Explicitly blocked category (e.g., -@dangerous)
                        blockedCategories.push({ category, type: 'explicit', priority: 1 });
                    } else {
                        // Implicitly blocked category (available but not granted)
                        blockedCategories.push({ category, type: 'implicit', priority: 2 });
                    }
                });
                
                // Sort by priority first (explicit first), then alphabetically, but keep @all at front
                blockedCategories.sort((a, b) => {
                    // Always put @all first
                    if (a.category === 'all') return -1;
                    if (b.category === 'all') return 1;
                    
                    // Then sort by priority (explicit first)
                    if (a.priority !== b.priority) {
                        return a.priority - b.priority;
                    }
                    
                    // Finally alphabetically
                    return a.category.localeCompare(b.category);
                });
                
                blockedCategories.forEach(({ category, type }) => {
                    const button = this.createCategoryButton(category, 'blocked', null, type);
                    this.elements.blockedCategoriesButtons.appendChild(button);
                });
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
                // Show all granted commands together (sorted)
                Array.from(allGrantedCommands).sort().forEach(command => {
                    const isViaCategory = effectiveGrantedViaCategories.includes(command);
                    const isIndividual = this.state.grantedCommands.has(command);
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
                        button.title = `Click to grant ${command} command`;
                        wrapper.appendChild(button);
                    });
                }
            }
            
            // Show blocked commands: EXPLICITLY blocked first, then implicitly blocked by categories
            const commandsBlockedByCategories = await this.getCommandsBlockedByCategories();
            const categoryBlockedSet = new Set(commandsBlockedByCategories);
            
            // Filter out commands that are explicitly granted (individual commands override category blocks)
            const effectivelyBlockedByCategories = commandsBlockedByCategories.filter(cmd => 
                !this.state.grantedCommands.has(cmd)
            );
            
            // Collect all blocked commands with their types for smart sorting
            const blockedCommands = [];
            
            // Add explicitly blocked commands (higher priority)
            Array.from(this.state.blockedCommands).forEach(command => {
                if (!categoryBlockedSet.has(command)) {
                    blockedCommands.push({ command, type: 'explicit', priority: 1 });
                }
            });
            
            // Add commands blocked by categories (lower priority)
            effectivelyBlockedByCategories.forEach(command => {
                blockedCommands.push({ command, type: 'category', priority: 2 });
            });
            
            if (blockedCommands.length > 0) {
                console.log('DEBUG: blockedCommands array:', blockedCommands.map(c => c.command));
                // Sort by priority first (explicit first), then alphabetically
                blockedCommands.sort((a, b) => {
                    if (a.priority !== b.priority) {
                        return a.priority - b.priority; // Lower priority number = higher precedence
                    }
                    return a.command.localeCompare(b.command);
                });
                
                blockedCommands.forEach(({ command, type }) => {
                    const button = this.createCommandButton(command, 'blocked', type);
                    wrapper.appendChild(button);
                });
            }
            
            // Show available commands (truly available - not granted anywhere and not blocked by categories)
            if (this.state.allCommands.length > 0 && !isEmptyACL) {
                const grantedViaCategories = await this.getCommandsGrantedByCategories();
                const grantedViaCategoriesSet = new Set(grantedViaCategories);
                
                const availableCommands = this.state.allCommands.filter(cmd => 
                    !this.state.grantedCommands.has(cmd) && 
                    !this.state.blockedCommands.has(cmd) &&
                    !grantedViaCategoriesSet.has(cmd) &&
                    !categoryBlockedSet.has(cmd) // Exclude commands blocked by categories
                );
                
                if (availableCommands.length > 0) {
                    // Add divider only if we have blocked commands AND we're about to add available commands
                    if (blockedCommands.length > 0) {
                        console.log('DEBUG: Creating divider - blockedCommands.length:', blockedCommands.length, 'availableCommands.length:', availableCommands.length);
                        const divider = document.createElement('div');
                        divider.style.borderTop = '1px solid #555';
                        divider.style.margin = '10px 0';
                        wrapper.appendChild(divider);
                    }
                    
                    availableCommands.sort().forEach(command => {
                        const button = this.createCommandButton(command, 'available');
                        button.title = `Click to grant ${command} command`;
                        wrapper.appendChild(button);
                    });
                }
            }
            
            // Show message when there are no individual commands to show at all
            if (wrapper.children.length === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'No individual commands blocked';
                wrapper.appendChild(message);
            }
            
            wrapper.className = 'command-buttons';
            this.elements.blockedCommandsButtons.appendChild(wrapper);
            
            // Calculate total blocked command count for header
            this.updateCommandSectionHeader('blocked', blockedCommands.length);
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
        button.title = tooltipText;
        button.onclick = clickHandler;
        
        return button;
    },

    /**
     * Create a command button element
     */
    createCommandButton(command, state, blockType = null) {
        const button = document.createElement('button');
        
        if (state === 'available') {
            button.className = `command-button blocked implicit`; // Available = implicitly blocked
            button.title = `Click to grant ${command} command`;
            button.onclick = () => this.grantCommand(command);
        } else if (state === 'blocked') {
            // Determine if explicitly or implicitly blocked
            if (blockType === 'explicit' || this.state.blockedCommands.has(command)) {
                button.className = `command-button blocked explicit`;
                button.title = `${command} - EXPLICITLY BLOCKED\nThis command was individually blocked.\nClick to make it available.`;
            } else {
                button.className = `command-button blocked implicit`;
                button.title = `${command} - BLOCKED BY CATEGORY\nThis command is blocked by an excluded category.\nClick to explicitly grant it.`;
            }
            button.onclick = () => this.toggleCommand(command);
        } else {
            button.className = `command-button ${state}`;
            button.title = `Click to ${state === 'granted' ? 'revoke' : 'grant'} ${command} command`;
            button.onclick = () => this.toggleCommand(command);
        }
        
        button.textContent = command;
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
            button.title = `${command} - EXPLICITLY GRANTED\nThis command was directly added to your ACL rule.\nClick to revoke.`;
            button.onclick = () => this.toggleCommand(command);
        } else if (isViaCategory) {
            // If only granted via category, use exclusion behavior
            button.classList.add('implicit');
            button.title = `${command} - IMPLICITLY GRANTED\nThis command is granted through a category (e.g., @read, @write).\nClick to explicitly exclude it from the category.`;
            button.onclick = () => this.blockCommandFromCategory(command);
        }
        
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
        
        // Update character counter and button states
        import('../handlers/event-handlers.js').then(({ default: EventHandlers }) => {
            EventHandlers.updateCharacterCounterProgrammatically(this.elements.aclRuleInput);
            EventHandlers.updateActionButtonStates(rule);
        });
        
        // Track the rule we just generated
        this.state.lastGeneratedRule = rule;
        this.state.lastValidRule = rule;     // This is a valid rule for testing
        this.state.hasManualChanges = false;
        this.hideSubmitButton();
        
        // Save to localStorage for proper restoration
        Storage.saveLastGeneratedRule(rule);
        
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
                        // Use actual parsing results to determine what's granted
                        const grantedCommands = new Set(data.granted_commands || []);
                        
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
                        
                        // Get all available commands
                        const allCommands = new Set(this.state.allCommands);
                        
                        // Update state based on actual rule parsing and API results
                        this.state.grantedCategories = grantedCategories;
                        this.state.grantedCommands = explicitlyGrantedCommands;
                        
                        // Determine blocked categories: only explicitly blocked ones
                        this.state.blockedCategories = blockedCategories;
                        this.state.blockedCommands = new Set([...allCommands].filter(cmd => !grantedCommands.has(cmd)));
                        
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

            // Re-render the interactive display
            await this.renderColumns();
            
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
            
            
            // Analyze for redundancy after successful sync
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