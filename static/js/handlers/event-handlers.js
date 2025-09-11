/**
 * Event Handlers
 * Manages all application event listeners and interactions
 */

import AppState from '../core/app-state.js';
import DOMElements from '../core/dom-elements.js';
import RuleManager from '../managers/rule-manager.js';
import CategoryManager from '../managers/category-manager.js';
import CommandTester from '../components/command-tester.js';
import InteractiveACLBuilder from '../components/interactive-acl-builder.js';

const EventHandlers = {
    /**
     * Initialize all event listeners
     */
    init() {
        // ACL rule input with debounced parsing - REMOVED per user request
        // Parsing now only occurs on explicit actions: Submit Changes, button clicks, Quick Examples
        // DOMElements.aclRuleInput.addEventListener('input', 
        //     Utils.debounce(() => RuleManager.parseRule(), 300)
        // );
        
        // Hide optimization suggestions and expand panels when user starts typing manually
        let inputTimeout;
        let isResizing = false;
        let resizeTimeout;
        
        // Detect resize operations to temporarily disable input processing
        DOMElements.aclRuleInput.addEventListener('mousedown', function(e) {
            // Check if clicking on resize handle (bottom-right corner)
            const rect = this.getBoundingClientRect();
            const isNearBottomRight = (
                e.clientX > rect.right - 20 && 
                e.clientY > rect.bottom - 20
            );
            
            if (isNearBottomRight) {
                isResizing = true;
            }
        });
        
        // Re-enable input processing after resize
        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
            }
        });
        
        DOMElements.aclRuleInput.addEventListener('input', function(e) {
            // Update character counter
            EventHandlers.updateCharacterCounter(this);
            
            // Auto-expand textarea based on content (unless manually resized)
            EventHandlers.autoExpandTextarea(this);
            
            // Skip ALL processing during resize operations
            if (isResizing) {
                return;
            }
            
            // Track if this is a programmatic change
            const isProgrammaticUpdate = this.dataset.programmaticUpdate === 'true';
            if (isProgrammaticUpdate) {
                delete this.dataset.programmaticUpdate;
            }
            
            // Hide redundancy warnings immediately for responsive feedback
            RuleManager.hideRedundancyWarnings();
            
            // Debounce expensive operations
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => {
                // Only expand panels if there's actual content in the textarea and it's a manual change
                const hasContent = this.value.trim().length > 0;
                const layout = document.querySelector('.three-column-layout');
                
                if (!layout) return; // Early exit if layout not found
                
                // Check if current text matches the last generated rule (no manual changes)
                const currentText = this.value.trim();
                const lastGeneratedRule = InteractiveACLBuilder.state?.lastGeneratedRule || '';
                const isRevertedToGenerated = currentText === lastGeneratedRule;
                
                if (hasContent && !isRevertedToGenerated && !isProgrammaticUpdate && !layout.classList.contains('submit-button-visible')) {
                    layout.classList.add('submit-button-visible');
                } else if (!hasContent || isRevertedToGenerated) {
                    // Auto-sync when content becomes empty or reverted to generated rule
                    if (!hasContent && InteractiveACLBuilder.state?.isInitialized) {
                        // Auto-sync empty content without showing submit button
                        InteractiveACLBuilder.syncFromRuleText();
                    }
                    
                    // Hide submit button first, then shrink panels after content shifts up
                    const submitBtn = document.getElementById('submitChangesBtn');
                    if (submitBtn && submitBtn.style.display !== 'none') {
                        submitBtn.style.display = 'none';
                        
                        // Allow time for content to shift up before shrinking panels
                        setTimeout(() => {
                            layout.classList.remove('submit-button-visible');
                        }, 100); // Small delay for smooth transition
                    } else {
                        layout.classList.remove('submit-button-visible');
                    }
                }
                
                // Always trigger rule parsing and redundancy analysis for any content changes
                // This ensures optimization suggestions appear for interactive button clicks
                if (hasContent) {
                    RuleManager.parseRule();
                }
            }, 150); // Reduced debounce since we're not processing during resize
        });
        
        // Version toggle
        DOMElements.versionToggle.addEventListener('change', function() {
            const newVersion = this.checked ? 'redis8' : 'redis7';
            if (AppState.currentVersion !== newVersion) {
                const oldVersion = AppState.currentVersion;
                
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
                                        // Mark as programmatic update to prevent panel expansion
                                        DOMElements.aclRuleInput.dataset.programmaticUpdate = 'true';
                                        DOMElements.aclRuleInput.value = cleanedRule;
                                        
                                        // Proceed with version change
                                        this.performVersionSwitch(newVersion);
                                        
                                        // Show notification about cleaned items
                                        const itemCount = analysis.incompatibleItems.length;
                                        Utils.showNotification(
                                            `Removed ${itemCount} Redis 8-specific item${itemCount > 1 ? 's' : ''} from ACL rule`,
                                            'warning',
                                            4000
                                        );
                                    },
                                    () => {
                                        // User cancelled - revert toggle
                                        this.checked = true; // Stay on Redis 8
                                    }
                                );
                                return; // Don't proceed with immediate version change
                            }
                        });
                    }
                }
                
                // Proceed with normal version change (no Redis 8 content or upgrading to Redis 8)
                this.performVersionSwitch(newVersion);
            }
        });
        
        // Helper function to perform the actual version switch
        DOMElements.versionToggle.performVersionSwitch = function(newVersion) {
            AppState.currentVersion = newVersion;
            
            // Update version detail text
            const categoryCount = newVersion === 'redis8' ? '29' : '21';
            const commandCount = newVersion === 'redis8' ? '446' : '311';
            DOMElements.versionDetail.textContent = `Redis ${newVersion.slice(-1)} (${categoryCount} categories, ${commandCount} commands)`;
            
            RuleManager.parseRule(true); // Skip redundancy analysis during version changes
            // Also update interactive builder if initialized
            if (InteractiveACLBuilder.state.isInitialized) {
                InteractiveACLBuilder.loadAllData().then(async () => {
                    await InteractiveACLBuilder.renderColumns();
                });
            }
        };
        
        // Test command input
        DOMElements.testCommandInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                CommandTester.testCommand();
            }
        });
        
        // Auto-complete for test command input (basic implementation)
        DOMElements.testCommandInput.addEventListener('input', function() {
            const value = this.value.toLowerCase();
            if (value.length > 2) {
                // Future: Add autocomplete functionality
                this.title = `Type a Redis command like: GET, SET, HGET, ZADD, etc.`;
            }
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
    },
    
    /**
     * Initialize theme toggle functionality
     */
    initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return;
        
        // Load saved theme or default to system preference
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const currentTheme = savedTheme || (systemDark ? 'dark' : 'light');
        
        // Apply initial theme
        this.applyTheme(currentTheme);
        
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
        
        // Update toggle button appearance - show what it will switch TO
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
        
        const minHeight = 120; // From CSS min-height  
        const maxHeight = 540; // From CSS max-height
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
    }
};

export default EventHandlers;