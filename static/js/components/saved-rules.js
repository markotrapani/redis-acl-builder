/**
 * Saved Rules Manager
 * Handles saving, loading, and managing custom ACL rule presets
 */

const SavedRules = {
    // Storage key for localStorage
    STORAGE_KEY: 'redis-acl-builder-saved-rules',

    // DOM elements
    elements: {
        saveButton: null,
        savedRulesSection: null,
        savedRulesContent: null,
        aclRule: null
    },

    /**
     * Initialize the saved rules system
     */
    init() {
        this.findElements();
        this.loadSavedRules();
        this.updateSaveButtonState();
        this.setupEventListeners();
    },

    /**
     * Find required DOM elements
     */
    findElements() {
        this.elements.saveButton = document.getElementById('saveRuleBtn');
        this.elements.savedRulesSection = document.getElementById('savedRulesSection');
        this.elements.savedRulesContent = document.getElementById('savedRulesContent');
        this.elements.aclRule = document.getElementById('aclRule');

        if (!this.elements.saveButton || !this.elements.savedRulesSection ||
            !this.elements.savedRulesContent || !this.elements.aclRule) {
            console.error('Required elements not found for saved rules');
            return false;
        }

        return true;
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for ACL rule changes to update save button state
        if (this.elements.aclRule) {
            this.elements.aclRule.addEventListener('input', (event) => {
                // Check if this is a programmatic update (should not affect save button immediately)
                const isProgrammaticUpdate = event.target.dataset.programmaticUpdate === 'true';

                if (!isProgrammaticUpdate) {
                    this.updateSaveButtonState();
                } else {
                    // For programmatic updates, delay the save button state update
                    // to allow the input event processing to complete first
                    setTimeout(() => {
                        this.updateSaveButtonState();
                    }, 100);
                }
            });
        }
    },

    /**
     * Update the save button enabled/disabled state
     */
    updateSaveButtonState() {
        if (!this.elements.saveButton) return;

        // Check committed rule from localStorage (same approach as event-handlers.js)
        const lastCommittedRule = this.getCommittedRule();
        const hasCommittedContent = lastCommittedRule && lastCommittedRule.trim().length > 0;

        // Save button: only enabled if there's a committed rule (not just pending text)
        this.elements.saveButton.disabled = !hasCommittedContent;
    },

    /**
     * Get the committed ACL rule from localStorage
     */
    getCommittedRule() {
        try {
            return localStorage.getItem('redis-acl-builder-rule') || '';
        } catch (error) {
            console.warn('Failed to load committed rule:', error);
            return '';
        }
    },

    /**
     * Save the current ACL rule as a preset
     */
    saveCurrentRule() {
        if (!this.elements.aclRule) return;

        const ruleText = this.elements.aclRule.value.trim();
        if (!ruleText) {
            this.showNotification('Cannot save empty ACL rule', 'error');
            return;
        }

        // Check if rule already exists
        const savedRules = this.getSavedRules();
        if (savedRules.includes(ruleText)) {
            this.showNotification('This ACL rule is already saved', 'warning');
            return;
        }

        // Add the new rule
        savedRules.push(ruleText);
        this.setSavedRules(savedRules);
        this.renderSavedRules();

        this.showNotification('ACL rule saved successfully', 'success');
    },

    /**
     * Load a saved rule into the ACL rule textarea
     */
    loadSavedRule(ruleText) {
        if (!this.elements.aclRule) return;

        this.elements.aclRule.value = ruleText;

        // Trigger input event to update other parts of the application
        const event = new Event('input', { bubbles: true });
        this.elements.aclRule.dispatchEvent(event);

        // Update save button state
        this.updateSaveButtonState();

        this.showNotification('ACL rule loaded', 'success');
    },

    /**
     * Delete a saved rule
     */
    deleteSavedRule(ruleText) {
        const savedRules = this.getSavedRules();
        const index = savedRules.indexOf(ruleText);

        if (index > -1) {
            savedRules.splice(index, 1);
            this.setSavedRules(savedRules);
            this.renderSavedRules();
            this.showNotification('ACL rule deleted', 'success');
        }
    },

    /**
     * Get saved rules from localStorage
     */
    getSavedRules() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.warn('Failed to load saved rules:', error);
            return [];
        }
    },

    /**
     * Save rules to localStorage
     */
    setSavedRules(rules) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rules));
        } catch (error) {
            console.warn('Failed to save rules:', error);
        }
    },

    /**
     * Load and render saved rules on page load
     */
    loadSavedRules() {
        this.renderSavedRules();
    },

    /**
     * Render the saved rules in the UI
     */
    renderSavedRules() {
        if (!this.elements.savedRulesSection || !this.elements.savedRulesContent) return;

        const savedRules = this.getSavedRules();

        // Show/hide the saved rules section based on whether we have any rules
        if (savedRules.length === 0) {
            this.elements.savedRulesSection.style.display = 'none';
            // Still trigger scroll check when section becomes empty
            this.triggerScrollCheck();
            return;
        }

        this.elements.savedRulesSection.style.display = 'block';

        // Clear existing content
        this.elements.savedRulesContent.innerHTML = '';

        // Create buttons for each saved rule
        savedRules.forEach(rule => {
            const ruleItem = document.createElement('div');
            ruleItem.className = 'saved-rule-item';

            const ruleButton = document.createElement('button');
            ruleButton.type = 'button';
            ruleButton.className = 'saved-rule-button';
            ruleButton.textContent = rule;
            ruleButton.title = `Load ACL rule: ${rule}`;
            ruleButton.addEventListener('click', () => {
                this.loadSavedRule(rule);
            });

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'saved-rule-delete';
            deleteButton.innerHTML = '✕';
            deleteButton.title = `Delete saved rule: ${rule}`;
            deleteButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.deleteSavedRule(rule);
            });

            ruleItem.appendChild(ruleButton);
            ruleItem.appendChild(deleteButton);
            this.elements.savedRulesContent.appendChild(ruleItem);
        });

        // Trigger scroll detection after custom rules section changes
        this.triggerScrollCheck();
    },

    /**
     * Trigger scroll detection for ACL presets container
     */
    triggerScrollCheck() {
        // Call the global scroll check function if available
        if (typeof window.checkQuickExamplesScroll === 'function') {
            // Use setTimeout to ensure DOM changes have been applied (especially display:none)
            setTimeout(() => {
                window.checkQuickExamplesScroll();
            }, 50);
        }
    },


    /**
     * Show a notification to the user
     */
    showNotification(message, type = 'info') {
        // Use the existing notification system if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback to console if notification system not available
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
};

// Global functions for HTML onclick handlers
window.saveACLRule = () => SavedRules.saveCurrentRule();

export default SavedRules;