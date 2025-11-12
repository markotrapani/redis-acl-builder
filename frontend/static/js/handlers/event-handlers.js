/**
 * Event Handlers
 * Manages all application event listeners and interactions
 */

import AppState from '../core/app-state.js';
import DOMElements from '../core/dom-elements.js';
import Storage from '../core/storage.js';
import RuleManager from '../managers/rule-manager.js';
import CategoryManager from '../managers/category-manager.js';
import CommandTester from '../components/command-tester.js';
// InteractiveACLBuilder imported dynamically to avoid circular dependency

const EventHandlers = {
    /**
     * Update the state of action buttons based on ACL rule content
     */
    updateActionButtonStates() {
        const lastCommittedRule = Storage.loadAclRule();

        // Button logic based on committed state, not pending text:
        // Clear button: enabled if there's committed content OR history exists (not just pending text)
        // Copy button: enabled if there's committed content (not just pending text)
        // Save button: handled separately - should only be enabled after Submit Changes commits a rule
        const hasCommittedContent = lastCommittedRule && lastCommittedRule.trim().length > 0;
        const hasHistory = Storage.hasHistory();

        const shouldEnableClearButton = hasCommittedContent || hasHistory;
        const shouldEnableCopyButton = hasCommittedContent;

        const clearBtn = document.getElementById('clearRuleBtn');
        const copyBtn = document.getElementById('copyRuleBtn');

        if (clearBtn) {
            clearBtn.disabled = !shouldEnableClearButton;
        }
        if (copyBtn) {
            copyBtn.disabled = !shouldEnableCopyButton;
        }
    },

    /**
     * Update the state of test buttons based on input content
     */
    updateTestButtonStates() {
        const commandInput = document.getElementById('testCommand');
        const keyspaceInput = document.getElementById('testKeyspace');
        const commandButton = document.querySelector('.command-test-section .test-button');
        const keyspaceButton = document.querySelector('.keyspace-test-section .test-button');
        
        if (commandInput && commandButton) {
            const hasCommandContent = commandInput.value.trim().length > 0;
            commandButton.disabled = !hasCommandContent;
        }
        
        if (keyspaceInput && keyspaceButton) {
            const hasKeyspaceContent = keyspaceInput.value.trim().length > 0;
            keyspaceButton.disabled = !hasKeyspaceContent;
        }
    },

    /**
     * Initialize all event listeners
     */
    init() {
        // Hide optimization suggestions and expand panels when user starts typing manually
        let inputTimeouts = []; // Track ALL timeouts, not just the latest

        // Global function to clear pending input operations (called by Submit Changes)
        window.clearPendingInputOperations = () => {
            inputTimeouts.forEach(timeout => clearTimeout(timeout));
            inputTimeouts = [];
        };
        
        DOMElements.aclRuleInput.addEventListener('input', function(e) {
            // Update character counter
            EventHandlers.updateCharacterCounter(this);

            // NOTE: We no longer save to localStorage on every keystroke
            // The rule is only saved when user clicks "Submit Changes"
            
            // Auto-expand textarea based on content
            EventHandlers.autoExpandTextarea(this);
            
            // Track if this is a programmatic change
            const isProgrammaticUpdate = this.dataset.programmaticUpdate === 'true';
            if (isProgrammaticUpdate) {
                delete this.dataset.programmaticUpdate;
            }

            // Let redundancy warnings persist during typing - they're about the committed rule
            // and will be naturally updated when user commits new changes

            // Update action button states based on committed content (not current text)
            EventHandlers.updateActionButtonStates();

            // Handle Submit Changes button visibility (only for user input, not programmatic updates)
            if (!isProgrammaticUpdate) {
                const layout = document.querySelector('.three-column-layout');
                if (layout) {
                    const currentText = this.value.trim();
                    const lastGeneratedRule = window.getLastGeneratedRule ? window.getLastGeneratedRule() : '';
                    const isRevertedToGenerated = currentText === lastGeneratedRule;
                    const submitBtn = document.getElementById('submitChangesBtn');

                    if (!isRevertedToGenerated) {
                        // Text differs from generated rule - ensure button is visible
                        layout.classList.add('submit-button-visible');
                        // Clear any inline display:none that might override CSS
                        if (submitBtn && submitBtn.style.display === 'none') {
                            submitBtn.style.display = '';
                        }
                    } else {
                        // Text matches generated rule - hide button
                        if (submitBtn) {
                            submitBtn.style.display = 'none';
                        }
                        layout.classList.remove('submit-button-visible');
                    }
                }
            }

            // Debounce expensive operations only (skip for programmatic updates)
            if (!isProgrammaticUpdate) {
                // Clear all existing timeouts and add new one
                inputTimeouts.forEach(timeout => clearTimeout(timeout));
                inputTimeouts = [];

                const newTimeout = setTimeout(() => {
                    // Only expand panels if there's actual content in the textarea and it's a manual change
                    const hasContent = this.value.trim().length > 0;

                    // Trigger rule parsing WITHOUT redundancy analysis during typing
                    // Redundancy analysis should only happen for committed rules
                    if (hasContent) {
                        RuleManager.parseRuleSilent(true); // Skip redundancy analysis during manual typing
                    }
                }, 150); // Reduced debounce for better responsiveness

                inputTimeouts.push(newTimeout);
            }
        });
        
        // Version toggle
        DOMElements.versionToggle.addEventListener('change', function() {
            const newVersion = this.checked ? 'redis8' : 'redis7';
            if (AppState.currentVersion !== newVersion) {
                const oldVersion = AppState.currentVersion;
                const toggleElement = this; // Store reference to toggle element

                // Check if we're downgrading from Redis 8 to Redis 7
                if (oldVersion === 'redis8' && newVersion === 'redis7') {
                    const currentRule = DOMElements.aclRuleInput.value.trim();

                    if (currentRule) {
                        // Import Utils dynamically to avoid circular dependencies
                        import('../core/utils.js').then(({ default: Utils }) => {
                            const analysis = Utils.analyzeRedis8Content(currentRule);

                            if (analysis.hasRedis8Content) {
                                // Show confirmation dialog
                                Utils.showVersionDowngradeConfirmation(
                                    analysis.incompatibleItems,
                                    () => {
                                        // User confirmed - clean the rule and proceed
                                        const cleanedRule = Utils.cleanRedis8ContentFromRule(currentRule);

                                        // Update textarea value
                                        DOMElements.aclRuleInput.dataset.programmaticUpdate = 'true';
                                        DOMElements.aclRuleInput.value = cleanedRule;

                                        // Sync the cleaned rule to Interactive ACL Builder's internal state
                                        // This is critical - we must update the builder's state BEFORE switching versions
                                        import('../components/interactive-acl-builder.js').then(({ default: InteractiveACLBuilder }) => {
                                            if (InteractiveACLBuilder.state.isInitialized) {
                                                // This will parse the textarea (which is now cleaned) and update internal state
                                                return InteractiveACLBuilder.syncFromRuleText();
                                            }
                                        }).then(() => {
                                            // Save the cleaned rule to localStorage (commit it)
                                            return import('../core/storage.js');
                                        }).then(({ default: Storage }) => {
                                            Storage.saveAclRule(cleanedRule);
                                            Storage.saveLastGeneratedRule(cleanedRule);

                                            // Hide Submit Changes button since we just committed the cleaned rule
                                            const submitBtn = document.getElementById('submitChangesBtn');
                                            if (submitBtn) {
                                                submitBtn.style.display = 'none';
                                            }

                                            // Now proceed with version change - use stored reference
                                            toggleElement.performVersionSwitch(newVersion);

                                            // Show notification about cleaned items
                                            const itemCount = analysis.incompatibleItems.length;
                                            Utils.showNotification(
                                                `Removed ${itemCount} Redis 8-specific item${itemCount > 1 ? 's' : ''} from ACL rule`,
                                                'warning',
                                                4000
                                            );
                                        });
                                    },
                                    () => {
                                        // User cancelled - revert toggle
                                        toggleElement.checked = true; // Stay on Redis 8
                                    }
                                );
                                return; // Don't proceed with immediate version change
                            } else {
                                // No Redis 8 content, proceed with downgrade
                                toggleElement.performVersionSwitch(newVersion);
                            }
                        });
                    } else {
                        // No rule content, proceed with downgrade
                        this.performVersionSwitch(newVersion);
                    }
                } else {
                    // Proceed with normal version change (no Redis 8 content or upgrading to Redis 8)
                    this.performVersionSwitch(newVersion);
                }
            }
        });
        
        // Helper function to update version detail text (considers both version and mode)
        const updateVersionDetail = function() {
            const version = AppState.currentVersion;
            const mode = AppState.currentMode;
            const versionNumber = version.slice(-1);
            const categoryCount = version === 'redis8' ? '29' : '21';

            // Command counts for OSS and Enterprise modes
            const commandCounts = {
                redis7: { oss: 379, enterprise: 305 },
                redis8: { oss: 488, enterprise: 440 }
            };

            const commandCount = mode === 'enterprise'
                ? commandCounts[version].enterprise
                : commandCounts[version].oss;

            const versionLabel = mode === 'enterprise'
                ? `Redis E. ${versionNumber}`
                : `Redis ${versionNumber}`;

            DOMElements.versionDetail.textContent = `${versionLabel} (${categoryCount} categories, ${commandCount} commands)`;
        };

        // Helper function to perform the actual version switch
        const self = this; // Capture EventHandlers context
        DOMElements.versionToggle.performVersionSwitch = function(newVersion, isRestoration = false) {
            AppState.currentVersion = newVersion;

            // Save version preference to localStorage
            Storage.saveRedisVersion(newVersion);

            // Update version detail text
            updateVersionDetail();

            // Check if there are unsaved changes (Submit Changes button is visible)
            const submitBtn = document.getElementById('submitChangesBtn');
            const hasUnsavedChanges = submitBtn && submitBtn.style.display !== 'none';

            // Only run redundancy analysis if there are NO unsaved changes
            // If there are unsaved changes, skip parsing to preserve the textarea content
            // This prevents clearing unsaved text when switching versions
            if (!hasUnsavedChanges) {
                // During restoration or version switch with saved changes, allow redundancy analysis
                RuleManager.parseRuleInternal(false, false); // Allow redundancy analysis, skip error notifications
            }

            // Update action button states after version switch
            // This ensures clear/copy buttons reflect correct state even with empty rules
            self.updateActionButtonStates();

            // IMPORTANT: Only update interactive builder if there are NO unsaved changes
            // If there are unsaved changes, skip the update to preserve textarea content
            // The interactive builder's updateRuleText() would overwrite the textarea with generated rule
            if (window.updateInteractiveBuilder) {
                if (!hasUnsavedChanges) {
                    window.updateInteractiveBuilder();
                } else {
                    // Even with unsaved changes, we need to refresh command/category lists for the new version
                    // But skip the render to preserve textarea content
                    import('../components/interactive-acl-builder.js').then(({ default: InteractiveACLBuilder }) => {
                        if (InteractiveACLBuilder.state.isInitialized) {
                            InteractiveACLBuilder.loadAllData(); // Update lists without rendering
                        }
                    });
                }
            }
        };

        // Mode toggle (OSS/Enterprise)
        DOMElements.modeToggle.addEventListener('change', function() {
            const newMode = this.checked ? 'enterprise' : 'oss';
            if (AppState.currentMode !== newMode) {
                this.performModeSwitch(newMode);
            }
        });

        // Helper function to perform the actual mode switch
        DOMElements.modeToggle.performModeSwitch = function(newMode) {
            const oldMode = AppState.currentMode;

            // Update app state and persist to localStorage + URL
            AppState.update({ currentMode: newMode });
            AppState.updateURL(AppState.currentVersion, newMode);

            console.log(`Mode switched from ${oldMode} to ${newMode}`);

            // Update version detail text to show Enterprise command count format
            updateVersionDetail();

            // Reload all data with new mode
            self.loadAllData();
        };

        // Test command input
        DOMElements.testCommandInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                CommandTester.testCommand();
            }
        });
        
        // Test keyspace input
        const testKeyspaceInput = document.getElementById('testKeyspace');
        if (testKeyspaceInput) {
            testKeyspaceInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    // Import KeyspaceTester dynamically to avoid circular dependencies
                    import('../components/keyspace-tester.js').then(({ default: KeyspaceTester }) => {
                        KeyspaceTester.testKeyspace();
                    });
                }
            });
            
            // Update button states on input
            testKeyspaceInput.addEventListener('input', function() {
                EventHandlers.updateTestButtonStates();
            });
        }
        
        // Auto-complete for test command input (basic implementation)
        DOMElements.testCommandInput.addEventListener('input', function() {
            const value = this.value.toLowerCase();
            if (value.length > 2) {
                // Future: Add autocomplete functionality
                this.title = `Type a Redis command like: GET, SET, HGET, ZADD, etc.`;
            }
            
            // Update test button states
            EventHandlers.updateTestButtonStates();
        });
        
        // Keyboard navigation for category headers
        document.addEventListener('keydown', function(e) {
            if (e.target.classList.contains('category-header') && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const category = e.target.dataset.category;
                if (category) {
                    CategoryManager.toggle(category);
                }
            }
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Undo/Redo shortcuts (global)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                e.stopImmediatePropagation();

                if (e.shiftKey) {
                    // Shift+Ctrl+Z / Shift+Cmd+Z - Redo
                    EventHandlers.redoRule();
                } else {
                    // Ctrl+Z / Cmd+Z - Undo
                    EventHandlers.undoRule();
                }
                return false;
            }

            // Only apply other shortcuts when ACL Rule textarea is focused or when no specific input is focused
            const aclRuleTextarea = document.getElementById('aclRule');
            const isAclRuleFocused = document.activeElement === aclRuleTextarea;
            const isBodyFocused = document.activeElement === document.body;

            if (!aclRuleTextarea || (!isAclRuleFocused && !isBodyFocused)) {
                return; // Don't interfere with other input fields
            }

            // ESC key - Clear pending changes in ACL Rule text area
            if (e.key === 'Escape') {
                e.preventDefault();
                EventHandlers.clearPendingChanges();
            }
        }, true);
        
        // Global error handler
        window.addEventListener('error', function(e) {
            console.error('Global error:', e.error);
            // Could show user-friendly error message here
        });
        
        // Handle browser back/forward
        window.addEventListener('popstate', function() {
            RuleManager.parseRule(true); // Skip redundancy analysis during navigation
        });
        
        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                // Tab became visible again, could refresh data if needed
            }
        });
        
        // Theme toggle functionality
        this.initThemeToggle();
        
        // Initialize character counter
        this.initCharacterCounter();
        
        // Initialize auto-expanding textarea
        this.initAutoExpandTextarea();
        
        // Initialize action button states (skip if already handled during restoration)
        if (!window.App?.buttonStatesInitialized) {
            this.updateActionButtonStates();
        }
        
        // Initialize test button states (should start disabled)
        this.updateTestButtonStates();

        // Initialize keyboard shortcuts
        this.initKeyboardShortcuts();
    },
    
    /**
     * Initialize theme toggle functionality
     */
    initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return;
        
        // Get current theme (already set by inline script in HTML head)
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        
        // Just update the toggle button appearance (theme already applied by inline script)
        this.updateThemeToggleAppearance(currentTheme);
        
        // Add click handler
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            this.applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                // Only follow system if user hasn't set a preference
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    },
    
    /**
     * Apply theme to the document
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeToggleAppearance(theme);
    },
    
    /**
     * Update theme toggle button appearance
     */
    updateThemeToggleAppearance(theme) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            if (theme === 'dark') {
                // Currently dark, show light appearance to switch to light
                themeToggle.setAttribute('data-emoji', '☀️');
                themeToggle.title = 'Switch to light mode';
            } else {
                // Currently light, show dark appearance to switch to dark
                themeToggle.setAttribute('data-emoji', '🌙');
                themeToggle.title = 'Switch to dark mode';
            }
        }
    },
    
    /**
     * Initialize character counter functionality
     */
    initCharacterCounter() {
        const textarea = DOMElements.aclRuleInput;
        if (textarea) {
            this.updateCharacterCounter(textarea);
        }
    },
    
    /**
     * Update character counter display
     */
    updateCharacterCounter(textarea) {
        const counter = document.getElementById('characterCounter');
        if (!counter) return;
        
        const currentLength = textarea.value.length;
        const maxLength = parseInt(textarea.getAttribute('maxlength')) || 500;
        
        counter.textContent = `${currentLength}/${maxLength}`;
        
        // Remove previous state classes
        counter.classList.remove('near-limit', 'at-limit');
        
        // Add appropriate state class
        if (currentLength >= maxLength) {
            counter.classList.add('at-limit');
        } else if (currentLength >= maxLength * 0.9) { // 90% of limit
            counter.classList.add('near-limit');
        }
    },
    
    /**
     * Initialize auto-expanding textarea functionality
     */
    initAutoExpandTextarea() {
        const textarea = DOMElements.aclRuleInput;
        if (!textarea) return;
        
        // Reset any inline height to use CSS defaults
        textarea.style.height = '';
        
        // Only auto-expand if there's existing content
        if (textarea.value.trim().length > 0) {
            this.autoExpandTextarea(textarea);
        }
    },
    
    /**
     * Auto-expand textarea when content overflows
     */
    autoExpandTextarea(textarea) {
        // If textarea is empty, reset to CSS default
        if (textarea.value.trim().length === 0) {
            textarea.style.height = '';
            return;
        }
        
        // Get current height before any changes
        const currentHeight = textarea.offsetHeight;
        
        // Temporarily measure content height
        const originalHeight = textarea.style.height;
        textarea.style.height = '1px';
        const scrollHeight = textarea.scrollHeight;
        textarea.style.height = originalHeight; // Restore immediately
        
        const minHeight = 80; // From CSS min-height
        const maxHeight = 256; // From CSS max-height
        const requiredHeight = scrollHeight + 4;
        
        // Only change height if there's a significant difference (prevent jumping)
        const threshold = 10; // pixels
        const significantOverflow = requiredHeight > currentHeight + threshold;
        const significantUnderflow = requiredHeight < currentHeight - threshold && currentHeight > minHeight;
        
        if (significantOverflow) {
            // Content definitely overflows - expand to exactly what's needed
            const newHeight = Math.min(requiredHeight, maxHeight);
            textarea.style.setProperty('height', newHeight + 'px', 'important');
        } else if (significantUnderflow) {
            // Content is much smaller - shrink
            const newHeight = Math.max(requiredHeight, minHeight);
            if (newHeight <= minHeight) {
                textarea.style.removeProperty('height');
            } else {
                textarea.style.setProperty('height', newHeight + 'px', 'important');
            }
        }
        // Else: no significant change needed - don't modify height
    },
    
    /**
     * Update character counter programmatically (for use when other code modifies textarea)
     */
    updateCharacterCounterProgrammatically(textarea) {
        if (!textarea) {
            textarea = DOMElements.aclRuleInput;
        }
        if (textarea) {
            this.updateCharacterCounter(textarea);
        }
    },

    /**
     * Clear pending changes in ACL Rule text area (ESC key functionality)
     * Reverts textarea to the last committed state and hides Submit Changes button
     */
    clearPendingChanges() {
        const aclRuleTextarea = document.getElementById('aclRule');
        if (!aclRuleTextarea) {
            return;
        }

        // Get the last committed rule from localStorage
        const lastCommittedRule = Storage.loadAclRule() || '';

        // Check if there are actually pending changes
        const currentText = aclRuleTextarea.value.trim();
        if (currentText === lastCommittedRule.trim()) {
            // No pending changes to clear
            import('../core/utils.js').then(({ default: Utils }) => {
                Utils.showNotification('No pending changes to clear', 'info', 2000);
            });
            return;
        }

        // Mark as programmatic update to prevent hiding redundancy warnings
        aclRuleTextarea.dataset.programmaticUpdate = 'true';
        aclRuleTextarea.value = lastCommittedRule;

        // Update character counter and button states
        this.updateCharacterCounterProgrammatically(aclRuleTextarea);
        this.updateActionButtonStates();

        // Auto-expand textarea based on content
        this.autoExpandTextarea(aclRuleTextarea);

        // Hide Submit Changes button since changes are cleared
        const layout = document.querySelector('.three-column-layout');
        const submitBtn = document.getElementById('submitChangesBtn');
        if (layout && submitBtn) {
            layout.classList.remove('submit-button-visible');
            submitBtn.style.display = 'none';
        }

        // Sync to interactive builder
        if (window.updateInteractiveBuilder) {
            window.updateInteractiveBuilder();
        }

        // Show notification
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification('Pending changes cleared (ESC)', 'info', 2000);
        });

        // Focus back on textarea
        aclRuleTextarea.focus();
    },

    /**
     * Undo to previous rule in history (Ctrl+Z/Cmd+Z functionality)
     * Moves backward in the undo/redo history
     */
    undoRule() {
        const aclRuleTextarea = document.getElementById('aclRule');
        if (!aclRuleTextarea) {
            return;
        }

        // Get the previous rule from history
        const result = Storage.undoFromHistory();

        // Handle different error scenarios
        if (result.error) {
            import('../core/utils.js').then(({ default: Utils }) => {
                switch (result.error) {
                    case 'no_history':
                        Utils.showNotification('No undo history available', 'warning', 2000);
                        break;
                    case 'at_beginning':
                        Utils.showNotification('Already at oldest change', 'warning', 2000);
                        break;
                    default:
                        Utils.showNotification('Undo failed', 'error', 2000);
                }
            });
            return;
        }

        this.applyHistoryRule(result.rule, 'Undo');
    },

    /**
     * Redo to next rule in history (Shift+Ctrl+Z/Shift+Cmd+Z functionality)
     * Moves forward in the undo/redo history
     */
    redoRule() {
        const aclRuleTextarea = document.getElementById('aclRule');
        if (!aclRuleTextarea) {
            return;
        }

        // Get the next rule from history
        const result = Storage.redoFromHistory();

        // Handle different error scenarios
        if (result.error) {
            import('../core/utils.js').then(({ default: Utils }) => {
                switch (result.error) {
                    case 'no_history':
                        Utils.showNotification('No redo history available', 'warning', 2000);
                        break;
                    case 'at_end':
                        Utils.showNotification('Already at newest change', 'warning', 2000);
                        break;
                    default:
                        Utils.showNotification('Cannot redo', 'warning', 2000);
                        break;
                }
            });
            return;
        }

        this.applyHistoryRule(result.rule, 'Redo');
    },

    /**
     * Apply a rule from history and update the UI
     * @param {string} rule - The rule to apply
     * @param {string} action - 'Undo' or 'Redo' for notification
     */
    applyHistoryRule(rule, action) {
        const aclRuleTextarea = document.getElementById('aclRule');
        if (!aclRuleTextarea) {
            return;
        }

        // Mark as programmatic update to prevent hiding redundancy warnings
        aclRuleTextarea.dataset.programmaticUpdate = 'true';
        aclRuleTextarea.value = rule;

        // Update character counter and button states
        this.updateCharacterCounterProgrammatically(aclRuleTextarea);
        this.updateActionButtonStates();

        // Auto-expand textarea based on content
        this.autoExpandTextarea(aclRuleTextarea);

        // Commit the restored rule immediately (like clicking Submit Changes)
        Storage.saveAclRule(rule);

        // Trigger input event to notify SavedRules component AFTER rule is committed
        const inputEvent = new Event('input', { bubbles: true });
        aclRuleTextarea.dispatchEvent(inputEvent);

        // Hide Submit Changes button since we're now in committed state
        const layout = document.querySelector('.three-column-layout');
        const submitBtn = document.getElementById('submitChangesBtn');
        if (layout && submitBtn) {
            layout.classList.remove('submit-button-visible');
            submitBtn.style.display = 'none';
        }

        // Parse the restored rule but DON'T sync back to interactive builder
        // (that would regenerate the rule and overwrite our undo)
        RuleManager.parseRule();

        // Instead, sync FROM the text TO the interactive builder
        import('../components/interactive-acl-builder.js').then(({ default: InteractiveACLBuilder }) => {
            if (InteractiveACLBuilder.state.isInitialized) {
                InteractiveACLBuilder.syncFromRuleText();
            }
        });

        // Show notification
        import('../core/utils.js').then(({ default: Utils }) => {
            Utils.showNotification(`${action} successful`, 'success', 2000);
        });

        // Focus back on textarea
        aclRuleTextarea.focus();
    },

    /**
     * Initialize keyboard shortcuts for the application
     */
    initKeyboardShortcuts() {
        const aclRuleTextarea = document.getElementById('aclRule');
        if (!aclRuleTextarea) return;

        aclRuleTextarea.addEventListener('keydown', (event) => {
            // Check if Enter key was pressed
            if (event.key === 'Enter') {
                // Prevent all newlines in ACL rule textarea
                event.preventDefault();

                // Check if Submit Changes button is visible
                const submitButton = document.getElementById('submitChangesBtn');
                if (submitButton && submitButton.style.display !== 'none' && !submitButton.hidden) {
                    // Trigger the sync function (now async)
                    if (window.syncRuleToInteractive) {
                        window.syncRuleToInteractive().catch(error => {
                            console.error('Failed to sync rule:', error);
                        });
                    }
                }
            }
        });
    }
};

export default EventHandlers;