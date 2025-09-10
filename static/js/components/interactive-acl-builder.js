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
        grantedCommands: new Set(),
        grantedCategories: new Set(),
        blockedCommands: new Set(),
        blockedCategories: new Set(),
        keyPatterns: new Set(),          // Store key patterns like ~*, ~user:*, etc.
        allCategories: [],
        allCommands: [],
        isInitialized: false,
        grantedCommandsCollapsed: true,  // Start collapsed
        blockedCommandsCollapsed: true,  // Start collapsed
        lastGeneratedRule: '',           // Track the last rule we generated
        hasManualChanges: false          // Track if user made manual changes
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
        console.log('🔧 Initializing Interactive ACL Builder...');
        
        // Initialize DOM elements
        this.elements.grantedCategoriesButtons = document.querySelector('#grantedCategories .category-buttons');
        this.elements.grantedCommandsButtons = document.querySelector('#grantedCommands .command-buttons');
        this.elements.blockedCategoriesButtons = document.querySelector('#blockedCategories .category-buttons');
        this.elements.blockedCommandsButtons = document.querySelector('#blockedCommands .command-buttons');
        this.elements.ruleStats = document.getElementById('ruleStats');
        this.elements.aclRuleInput = document.getElementById('aclRule');
        this.elements.submitChangesBtn = document.getElementById('submitChangesBtn');

        console.log('📍 DOM Elements found:', {
            grantedCategories: !!this.elements.grantedCategoriesButtons,
            grantedCommands: !!this.elements.grantedCommandsButtons,
            blockedCategories: !!this.elements.blockedCategoriesButtons,
            blockedCommands: !!this.elements.blockedCommandsButtons,
            ruleStats: !!this.elements.ruleStats
        });

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
            await this.updateRuleText();
            
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
        
        this.scheduleRender();
    },

    /**
     * Toggle a category between granted and blocked
     */
    async toggleCategory(category) {
        const wasGranted = this.state.grantedCategories.has(category);
        
        if (wasGranted) {
            // Move from granted to available (remove from granted)
            this.state.grantedCategories.delete(category);
            this.state.blockedCategories.delete(category);
        } else {
            // Move from blocked to granted
            this.state.blockedCategories.delete(category);
            this.state.grantedCategories.add(category);
        }

        this.scheduleRender();
    },

    /**
     * Grant a command (add to granted)
     */
    async grantCommand(command) {
        this.state.grantedCommands.add(command);
        this.state.blockedCommands.delete(command);
        
        this.scheduleRender();
    },

    /**
     * Toggle a command between granted and blocked
     */
    async toggleCommand(command) {
        const wasGranted = this.state.grantedCommands.has(command);
        
        if (wasGranted) {
            // Move from granted to available (remove from granted)
            this.state.grantedCommands.delete(command);
            this.state.blockedCommands.delete(command);
        } else {
            // Move from blocked to granted
            this.state.blockedCommands.delete(command);
            this.state.grantedCommands.add(command);
        }

        this.scheduleRender();
    },

    /**
     * Render the interactive columns
     */
    async renderColumns() {
        this.renderCategoryButtons();
        await this.renderCommandButtons();
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
        // Render granted categories
        if (this.elements.grantedCategoriesButtons) {
            this.elements.grantedCategoriesButtons.innerHTML = '';
            if (this.state.grantedCategories.size === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'No categories granted';
                this.elements.grantedCategoriesButtons.appendChild(message);
            } else {
                Array.from(this.state.grantedCategories).sort().forEach(category => {
                    const button = this.createCategoryButton(category, 'granted');
                    this.elements.grantedCategoriesButtons.appendChild(button);
                });
            }
            
            // Update the granted categories header
            this.updateCategorySectionHeader('granted', this.state.grantedCategories.size);
        }

        // Render available categories as clickable buttons
        if (this.elements.blockedCategoriesButtons) {
            this.elements.blockedCategoriesButtons.innerHTML = '';
            
            // Show all available categories as clickable buttons to grant
            const availableCategories = this.state.allCategories.filter(cat => 
                !this.state.grantedCategories.has(cat) && !this.state.blockedCategories.has(cat)
            );
            
            if (availableCategories.length > 0) {
                availableCategories.sort().forEach(category => {
                    const button = this.createCategoryButton(category, 'available');
                    button.title = `Click to grant @${category} category`;
                    this.elements.blockedCategoriesButtons.appendChild(button);
                });
            }
            
            // Also show explicitly blocked categories
            if (this.state.blockedCategories.size > 0) {
                Array.from(this.state.blockedCategories).sort().forEach(category => {
                    const button = this.createCategoryButton(category, 'blocked');
                    this.elements.blockedCategoriesButtons.appendChild(button);
                });
            }
            
            if (availableCategories.length === 0 && this.state.blockedCategories.size === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'Click categories below to grant access';
                this.elements.blockedCategoriesButtons.appendChild(message);
            }
            
            // Update the blocked categories header
            const categoryCount = this.state.blockedCategories.size + availableCategories.length;
            this.updateCategorySectionHeader('blocked', categoryCount);
        }
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
            
            // Determine collapsed state: default to collapsed for many commands, expanded for few
            const shouldCollapse = allGrantedCommands.size > 3 ? 
                (this.state.grantedCommandsCollapsed === true) : // Only collapse if explicitly set for many commands
                false; // Always expanded for 3 or fewer commands
            
            wrapper.className = shouldCollapse ? 'command-buttons-collapsible collapsed' : 'command-buttons-collapsible';
            
            // Create preview row that shows even when collapsed
            if (allGrantedCommands.size > 0) {
                const previewRow = document.createElement('div');
                previewRow.className = shouldCollapse ? 'command-preview-row' : 'command-preview-row collapsed';
                
                // Show first 3 commands as preview
                const previewCommands = Array.from(allGrantedCommands).sort().slice(0, 3);
                previewCommands.forEach(command => {
                    const isViaCategory = effectiveGrantedViaCategories.includes(command);
                    const isIndividual = this.state.grantedCommands.has(command);
                    const button = this.createGrantedCommandButton(command, isViaCategory, isIndividual);
                    button.style.fontSize = '1.0em'; // Same size as regular buttons
                    previewRow.appendChild(button);
                });
                
                // Add "..." indicator if there are more commands
                if (allGrantedCommands.size > 3) {
                    const moreIndicator = document.createElement('span');
                    moreIndicator.textContent = `+${allGrantedCommands.size - 3} more...`;
                    moreIndicator.style.color = '#666';
                    moreIndicator.style.fontSize = '1.0em';
                    moreIndicator.style.alignSelf = 'center';
                    moreIndicator.style.cursor = 'pointer';
                    moreIndicator.style.textDecoration = 'underline';
                    moreIndicator.title = 'Click to expand and view all commands';
                    moreIndicator.onclick = () => this.toggleCommandSection('granted');
                    previewRow.appendChild(moreIndicator);
                }
                
                this.elements.grantedCommandsButtons.appendChild(previewRow);
            }
            
            this.elements.grantedCommandsButtons.appendChild(wrapper);
            
            // Update the header to be clickable
            this.updateCommandSectionHeader('granted', allGrantedCommands.size, shouldCollapse);
        }

        // Render blocked/available commands
        if (this.elements.blockedCommandsButtons) {
            this.elements.blockedCommandsButtons.innerHTML = '';
            
            // Create collapsible wrapper
            const wrapper = document.createElement('div');
            const isEmptyACL = this.state.grantedCategories.size === 0 && this.state.grantedCommands.size === 0;
            
            // Pre-calculate command count to determine collapse state early
            const grantedViaCategories = await this.getCommandsGrantedByCategories();
            const grantedViaCategoriesSet = new Set(grantedViaCategories);
            const availableCommands = this.state.allCommands.filter(cmd => 
                !this.state.grantedCommands.has(cmd) && 
                !this.state.blockedCommands.has(cmd) &&
                !grantedViaCategoriesSet.has(cmd)
            );
            const commandCount = this.state.blockedCommands.size + (isEmptyACL ? this.state.allCommands.length : availableCommands.length);
            
            // Determine collapsed state: default to collapsed for many commands, expanded for few
            const shouldCollapseBlocked = commandCount > 3 ? 
                (this.state.blockedCommandsCollapsed === true) : // Only collapse if explicitly set for many commands
                false; // Always expanded for 3 or fewer commands
            
            if (isEmptyACL && this.state.allCommands.length > 0) {
                // Show ALL available commands as clickable buttons to grant
                const allAvailableForEmptyACL = this.state.allCommands.filter(cmd => 
                    !this.state.grantedCommands.has(cmd) && !this.state.blockedCommands.has(cmd)
                );
                
                if (allAvailableForEmptyACL.length > 0) {
                    allAvailableForEmptyACL.forEach(command => {
                        const button = this.createCommandButton(command, 'available');
                        button.title = `Click to grant ${command} command`;
                        wrapper.appendChild(button);
                    });
                }
            }
            
            // Always show explicitly blocked commands (in addition to available ones)
            if (this.state.blockedCommands.size > 0) {
                if (!isEmptyACL) {
                    // Add a divider if we're not showing available commands above
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
                
                // Only show commands that are NOT granted individually AND NOT granted via categories
                // BUT if a command is granted via categories AND explicitly blocked, don't show it here
                // (it will already be shown in the blocked commands section above)
                const availableCommands = this.state.allCommands.filter(cmd => 
                    !this.state.grantedCommands.has(cmd) && 
                    !this.state.blockedCommands.has(cmd) &&
                    !grantedViaCategoriesSet.has(cmd)
                );
                
                if (availableCommands.length > 0) {
                    if (this.state.blockedCommands.size > 0) {
                        // Add a divider if we have blocked commands above
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
            
            // Calculate the total count to determine if we should show a "no commands" message
            const totalCommandsToShow = this.state.blockedCommands.size + 
                (isEmptyACL ? this.state.allCommands.length : availableCommands.length);
            
            // Show message when there are no individual commands to show at all
            if (totalCommandsToShow === 0) {
                const message = document.createElement('div');
                message.className = 'text-muted';
                message.style.padding = '10px';
                message.textContent = 'No individual commands blocked';
                wrapper.appendChild(message);
            }
            
            wrapper.className = shouldCollapseBlocked ? 'command-buttons-collapsible collapsed' : 'command-buttons-collapsible';
            
            // Create preview row that shows even when collapsed
            const allBlockedAndAvailable = new Set([...this.state.blockedCommands]);
            
            if (this.state.allCommands.length > 0) {
                if (isEmptyACL) {
                    // Empty ACL = all commands are effectively blocked/available for granting
                    this.state.allCommands.forEach(cmd => allBlockedAndAvailable.add(cmd));
                } else {
                    // Non-empty ACL = show truly available commands (not granted anywhere)
                    const grantedViaCategories = await this.getCommandsGrantedByCategories();
                    const grantedViaCategoriesSet = new Set(grantedViaCategories);
                    const availableCommands = this.state.allCommands.filter(cmd => 
                        !this.state.grantedCommands.has(cmd) && 
                        !this.state.blockedCommands.has(cmd) &&
                        !grantedViaCategoriesSet.has(cmd)
                    );
                    availableCommands.forEach(cmd => allBlockedAndAvailable.add(cmd));
                }
            }
            
            if (allBlockedAndAvailable.size > 0) {
                const previewRow = document.createElement('div');
                previewRow.className = shouldCollapseBlocked ? 'command-preview-row' : 'command-preview-row collapsed';
                
                // Show first 3 commands as preview
                const previewCommands = Array.from(allBlockedAndAvailable).sort().slice(0, 3);
                previewCommands.forEach(command => {
                    const isBlocked = this.state.blockedCommands.has(command);
                    const button = this.createCommandButton(command, isBlocked ? 'blocked' : 'available');
                    button.style.fontSize = '1.0em'; // Same size as regular buttons
                    previewRow.appendChild(button);
                });
                
                // Add "..." indicator if there are more commands
                if (allBlockedAndAvailable.size > 3) {
                    const moreIndicator = document.createElement('span');
                    moreIndicator.textContent = `+${allBlockedAndAvailable.size - 3} more...`;
                    moreIndicator.style.color = '#666';
                    moreIndicator.style.fontSize = '1.0em';
                    moreIndicator.style.alignSelf = 'center';
                    moreIndicator.style.cursor = 'pointer';
                    moreIndicator.style.textDecoration = 'underline';
                    moreIndicator.title = 'Click to expand and view all commands';
                    moreIndicator.onclick = () => this.toggleCommandSection('blocked');
                    previewRow.appendChild(moreIndicator);
                }
                
                this.elements.blockedCommandsButtons.appendChild(previewRow);
            }
            
            this.elements.blockedCommandsButtons.appendChild(wrapper);
            
            // Update the header to be clickable
            this.updateCommandSectionHeader('blocked', commandCount, shouldCollapseBlocked);
        }
    },

    /**
     * Update command section header to be clickable
     */
    updateCommandSectionHeader(type, count, isCollapsed) {
        const sectionId = type === 'granted' ? 'grantedCommands' : 'blockedCommands';
        const section = document.getElementById(sectionId);
        const header = section?.querySelector('h3');
        
        if (header) {
            const text = type === 'granted' ? 'Individual Commands' : 'Individual Commands';
            
            // Only show collapse/expand controls if there are more than 3 commands
            if (count > 3) {
                const arrow = isCollapsed ? '+' : '−';
                header.innerHTML = `${text} ${count > 0 ? `(${count})` : ''} <span style="float: right; font-size: 1.2em; font-weight: bold;">${arrow}</span>`;
                header.style.cursor = 'pointer';
                header.style.userSelect = 'none';
                header.onclick = () => this.toggleCommandSection(type);
            } else {
                // No collapse/expand controls for small lists
                header.innerHTML = `${text} ${count > 0 ? `(${count})` : ''}`;
                header.style.cursor = 'default';
                header.style.userSelect = 'auto';
                header.onclick = null;
            }
        }
    },

    /**
     * Toggle command section visibility
     */
    async toggleCommandSection(type) {
        const isGranted = type === 'granted';
        const currentState = isGranted ? this.state.grantedCommandsCollapsed : this.state.blockedCommandsCollapsed;
        const newState = !currentState;
        
        if (isGranted) {
            this.state.grantedCommandsCollapsed = newState;
        } else {
            this.state.blockedCommandsCollapsed = newState;
        }
        
        // Re-render to update display
        await this.renderCommandButtons();
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
        
        this.scheduleRender();
    },

    /**
     * Update the ACL rule text based on current state
     */
    async updateRuleText() {
        if (!this.elements.aclRuleInput) return;

        const rule = await this.generateOptimizedRule();
        this.elements.aclRuleInput.value = rule;
        
        // Track the rule we just generated
        this.state.lastGeneratedRule = rule;
        this.state.hasManualChanges = false;
        this.hideSubmitButton();
        
        // Trigger change event to update other parts of the app
        this.elements.aclRuleInput.dispatchEvent(new Event('input'));
    },

    /**
     * Generate optimized ACL rule from current state
     */
    async generateOptimizedRule() {
        const parts = [];

        // Add granted categories
        Array.from(this.state.grantedCategories).sort().forEach(category => {
            parts.push(`+@${category}`);
        });

        // Add granted individual commands
        Array.from(this.state.grantedCommands).sort().forEach(command => {
            parts.push(`+${command}`);
        });

        // Check if we have any inclusion terms (granted categories or commands)
        const hasInclusions = this.state.grantedCategories.size > 0 || this.state.grantedCommands.size > 0;

        // Only add exclusions if we have inclusions, and only meaningful exclusions
        if (hasInclusions) {
            // Get all commands that would be granted by the inclusion terms
            const grantedCommands = await this.getCommandsGrantedByInclusions();

            // Add blocked categories only if they would actually exclude granted commands
            Array.from(this.state.blockedCategories).sort().forEach(category => {
                if (this.categoryOverlapsWithGranted(category, grantedCommands)) {
                    parts.push(`-@${category}`);
                }
            });

            // Add blocked individual commands only if they would be granted by inclusions
            Array.from(this.state.blockedCommands).sort().forEach(command => {
                if (grantedCommands.has(command)) {
                    parts.push(`-${command}`);
                }
            });
        }

        // Add key patterns (preserve existing patterns)
        if (this.state.keyPatterns) {
            Array.from(this.state.keyPatterns).sort().forEach(pattern => {
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
     */
    async syncFromRuleText() {
        if (!this.elements.aclRuleInput || !this.state.isInitialized) {
            console.log('❌ Cannot sync: not initialized or no rule input');
            return;
        }

        const rawRuleText = this.elements.aclRuleInput.value.trim();
        const ruleText = Utils.normalizeACLRule(rawRuleText);
        
        // Update the textarea with normalized rule if it changed
        if (ruleText !== rawRuleText) {
            this.elements.aclRuleInput.value = ruleText;
        }
        
        console.log('🔄 Syncing rule text to interactive display:', ruleText);

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

            // Parse the rule text to extract categories and commands
            if (ruleText) {
                const tokens = ruleText.split(/\s+/).filter(token => token.length > 0);
                
                for (const token of tokens) {
                    if (token.startsWith('+@')) {
                        // Granted category
                        const category = token.substring(2);
                        this.state.grantedCategories.add(category);
                    } else if (token.startsWith('-@')) {
                        // Blocked category  
                        const category = token.substring(2);
                        this.state.blockedCategories.add(category);
                    } else if (token.startsWith('+')) {
                        // Granted command (normalize to lowercase)
                        const command = token.substring(1).toLowerCase();
                        this.state.grantedCommands.add(command);
                    } else if (token.startsWith('-')) {
                        // Blocked command (normalize to lowercase)
                        const command = token.substring(1).toLowerCase();
                        this.state.blockedCommands.add(command);
                    } else if (token.startsWith('~')) {
                        // Key pattern
                        this.state.keyPatterns.add(token);
                    }
                }
            }

            // Re-render the interactive display
            await this.renderColumns();
            
            // Update tracking state
            this.state.lastGeneratedRule = ruleText;
            this.state.hasManualChanges = false;
            this.hideSubmitButton();
            
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
        }
    },

    /**
     * Hide the submit changes button
     */
    hideSubmitButton() {
        if (this.elements.submitChangesBtn) {
            this.elements.submitChangesBtn.style.display = 'none';
        }
    }
};

export default InteractiveACLBuilder;