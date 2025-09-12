/**
 * Interactive ACL Builder
 * Handles the three-column interactive interface for building ACL rules
 */

import AppState from '../core/app-state.js';
import Utils from '../core/utils.js';
import API from '../api/api-client.js';
import RuleManager from '../managers/rule-manager.js';

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
            console.log('❌ Three-column layout not found, skipping interactive initialization');
            return;
        }

        try {
            console.log('📡 Loading categories data...');
            await this.loadAllData();
            console.log('✅ Categories loaded:', this.state.allCategories.length);
            
            console.log('🔧 Initializing default state...');
            this.initializeDefaultState();
            
            console.log('🎨 Rendering columns...');
            await this.renderColumns();
            
            // Check if there's existing content in textarea (from localStorage restoration)
            const existingRule = this.elements.aclRuleInput.value.trim();
            if (existingRule) {
                console.log('📖 Found existing rule from localStorage, syncing from textarea...');
                await this.syncFromRuleText(true); // Pass true to indicate this is restoration
            } else {
                console.log('📝 No existing rule, generating default...');
                await this.updateRuleText();
            }
            
            // Add event listeners
            this.setupEventListeners();
            
            this.state.isInitialized = true;
            console.log('✅ Interactive ACL Builder initialized successfully');
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
            console.log('📡 Calling API.getCategories for version:', AppState.currentVersion);
            const response = await API.getCategories(AppState.currentVersion);
            console.log('📡 API response:', response);
            
            if (response && response.categories) {
                this.state.allCategories = response.categories.sort();
                console.log('✅ Loaded categories:', this.state.allCategories);
            } else {
                throw new Error('No categories in response');
            }

            // Also load all commands
            console.log('📡 Loading all available commands...');
            this.state.allCommands = await API.getAllCommands(AppState.currentVersion);
            console.log('✅ Loaded all commands:', this.state.allCommands.length);
        } catch (error) {
            console.error('❌ Failed to load categories data:', error);
            // Fallback: use some default categories
            this.state.allCategories = ['read', 'write', 'admin', 'dangerous', 'fast', 'slow', 'keyspace', 'string', 'list', 'hash', 'set', 'sortedset'];
            this.state.allCommands = ['get', 'set', 'del', 'exists', 'keys', 'hget', 'hset', 'lpush', 'sadd', 'zadd', 'flushdb', 'ping'];
            console.log('🔄 Using fallback categories and commands');
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
        
        this.renderCategoryButtons();
        await this.renderCommandButtons();
        
        // Remove loading cover after content is rendered (only on initial load)
        if (!this.state.isInitialized) {
            // Short delay to ensure content is fully rendered
            setTimeout(() => {
                this.removeLoadingAnimation();
            }, 120);
        }
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
            }, 150); // Match CSS transition duration
        });
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
            await this.renderColumns();
            await this.updateRuleText();

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
    renderCategoryButtons() {
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
                
                sortedCategories.forEach(category => {
                    const button = this.createCategoryButton(category, 'granted');
                    
                    // Special handling for @all case
                    if (hasAllCategory && !this.state.grantedCategories.has(category)) {
                        // This category is granted via @all, clicking should block it
                        button.style.opacity = '0.7';
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
            
            // Show blocked categories
            if (effectivelyBlockedCategories.length > 0) {
                // Sort blocked categories, but keep @all at the front if present
                const hasAllInBlockedList = effectivelyBlockedCategories.includes('all');
                let sortedBlockedCategories;
                
                if (hasAllInBlockedList) {
                    // Remove @all from the list, sort the rest, then add @all back at the front
                    const withoutAll = effectivelyBlockedCategories.filter(cat => cat !== 'all').sort();
                    sortedBlockedCategories = ['all', ...withoutAll];
                } else {
                    // Normal sorting when @all is not in the list
                    sortedBlockedCategories = effectivelyBlockedCategories.sort();
                }
                
                sortedBlockedCategories.forEach(category => {
                    const button = this.createCategoryButton(category, 'blocked');
                    
                    // Special handling for @all case
                    if (hasAllCategory && !this.state.blockedCategories.has(category)) {
                        // This category would be granted by @all but we're in the blocked column
                        button.style.opacity = '0.7';
                        button.title = `@${category} category (would be granted by @all) - Click to grant`;
                        button.onclick = () => this.grantCategory(category);
                    } else if (hasAllCategory && this.state.blockedCategories.has(category)) {
                        // This category is explicitly blocked despite @all
                        button.title = `@${category} category (explicitly blocked) - Click to toggle`;
                        // Keep default toggleCategory behavior
                    }
                    
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
            
            // Always show explicitly blocked commands
            if (this.state.blockedCommands.size > 0) {
                if (!isEmptyACL && wrapper.children.length > 0) {
                    const divider = document.createElement('div');
                    divider.style.borderTop = '1px solid #555';
                    divider.style.margin = '10px 0';
                    wrapper.appendChild(divider);
                }
                
                Array.from(this.state.blockedCommands).sort().forEach(command => {
                    const button = this.createCommandButton(command, 'blocked');
                    wrapper.appendChild(button);
                });
            }
            
            // Show available commands (truly available - not granted anywhere)
            if (this.state.allCommands.length > 0 && !isEmptyACL) {
                const grantedViaCategories = await this.getCommandsGrantedByCategories();
                const grantedViaCategoriesSet = new Set(grantedViaCategories);
                
                const availableCommands = this.state.allCommands.filter(cmd => 
                    !this.state.grantedCommands.has(cmd) && 
                    !this.state.blockedCommands.has(cmd) &&
                    !grantedViaCategoriesSet.has(cmd)
                );
                
                if (availableCommands.length > 0) {
                    if (this.state.blockedCommands.size > 0) {
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
            
            // Calculate total command count for header
            const totalCommandCount = wrapper.children.length === 1 && wrapper.children[0].className === 'text-muted' ? 0 : wrapper.children.length;
            this.updateCommandSectionHeader('blocked', totalCommandCount);
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
     * Create a category button element
     */
    createCategoryButton(category, state) {
        const button = document.createElement('button');
        button.className = `category-button ${state === 'available' ? 'blocked' : state}`;
        button.textContent = `@${category}`;
        
        if (state === 'available') {
            button.title = `Click to grant @${category} category`;
            button.onclick = () => this.grantCategory(category);
        } else {
            button.title = `Click to ${state === 'granted' ? 'revoke' : 'grant'} @${category} category`;
            button.onclick = () => this.toggleCategory(category);
        }
        
        return button;
    },

    /**
     * Create a command button element
     */
    createCommandButton(command, state) {
        const button = document.createElement('button');
        button.className = `command-button ${state === 'available' ? 'blocked' : state}`;
        button.textContent = command;
        
        if (state === 'available') {
            button.title = `Click to grant ${command} command`;
            button.onclick = () => this.grantCommand(command);
        } else {
            button.title = `Click to ${state === 'granted' ? 'revoke' : 'grant'} ${command} command`;
            button.onclick = () => this.toggleCommand(command);
        }
        
        return button;
    },

    /**
     * Create a command button for granted commands (handles commands granted via categories)
     */
    createGrantedCommandButton(command, isViaCategory, isIndividual) {
        const button = document.createElement('button');
        button.className = 'command-button granted';
        button.textContent = command;
        
        // Debug logging to understand the visual difference
        if (command === 'get' || command === 'set') {
            console.log(`Creating button for ${command}:`, {
                className: button.className,
                isViaCategory,
                isIndividual,
                hasAllCategory: this.state.grantedCategories.has('all')
            });
        }
        
        // Determine the behavior based on how the command is granted
        if (isIndividual) {
            // If granted individually (even if also via category), use normal toggle
            button.title = `${command} - Click to revoke`;
            button.onclick = () => this.toggleCommand(command);
        } else if (isViaCategory) {
            // If only granted via category, use exclusion behavior
            button.title = `${command} - Click to exclude (granted via category)`;
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
            console.log('❌ Cannot sync: not initialized or no rule input');
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
                Utils.showNotification(firstError, 'error', 5000);
                console.log('InteractiveACLBuilder sync validation failed:', firstError);
                return;
            }
            
            // Reset state
            this.state.grantedCategories.clear();
            this.state.grantedCommands.clear();
            this.state.blockedCategories.clear();
            this.state.blockedCommands.clear();
            
            this.state.keyPatterns.clear();
            this.state.orderedTerms = []; // Reset ordered terms

            // Parse the rule text to extract categories and commands
            if (ruleText) {
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
                        // Note: Key patterns are handled separately and always come last
                    }
                }
            }

            // Re-render the interactive display
            await this.renderColumns();
            
            // Update tracking state differently for restoration vs manual sync
            if (isRestoration) {
                // During restoration, don't update lastGeneratedRule to match the restored rule
                // This allows the submit button to appear if the restored rule differs from what would be generated
                console.log('📍 Restoration mode: keeping existing lastGeneratedRule for comparison');
                
                // Generate what the rule should be based on current interactive state to compare
                const generatedRule = await this.generateOptimizedRule();
                const hasChanges = ruleText !== generatedRule;
                this.state.hasManualChanges = hasChanges;
                
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
                
                // Shrink panels after successful sync since no manual changes remain
                const layout = document.querySelector('.three-column-layout');
                if (layout && layout.classList.contains('submit-button-visible')) {
                    layout.classList.remove('submit-button-visible');
                }
            }
            
            console.log('✅ Rule synced successfully');
            
            // Analyze for redundancy after successful sync
            try {
                console.log('Starting redundancy analysis after sync');
                RuleManager.analyzeRedundancy();
            } catch (error) {
                console.error('Error during post-sync redundancy analysis:', error);
            }
            
        } catch (error) {
            console.error('❌ Error syncing rule:', error);
            
            console.log('Error details:', error);
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