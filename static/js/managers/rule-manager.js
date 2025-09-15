/**
 * Rule Manager
 * Handles ACL rule parsing, validation, and display logic
 */

import AppState from '../core/app-state.js';
import DOMElements from '../core/dom-elements.js';
import Storage from '../core/storage.js';
import Utils from '../core/utils.js';
import API from '../api/api-client.js';

const RuleManager = {
    /**
     * Set rule in textarea and trigger parsing
     */
    setRule(rule) {

        // Mark as programmatic update to prevent panel expansion
        DOMElements.aclRuleInput.dataset.programmaticUpdate = 'true';
        DOMElements.aclRuleInput.value = rule;

        // Save to localStorage FIRST
        Storage.saveAclRule(rule);

        // Update character counter and button states AFTER saving
        import('../handlers/event-handlers.js').then(({ default: EventHandlers }) => {
            EventHandlers.updateCharacterCounterProgrammatically(DOMElements.aclRuleInput);
            EventHandlers.updateActionButtonStates(rule);
        });

        this.parseRule();
    },

    /**
     * Parse current ACL rule with full validation and error notifications
     * @param {boolean} skipRedundancyAnalysis - Skip redundancy analysis (for version changes)
     */
    async parseRule(skipRedundancyAnalysis = false) {
        return this.parseRuleInternal(skipRedundancyAnalysis, true);
    },

    /**
     * Parse current ACL rule silently (no error notifications) 
     * Used for real-time input processing to avoid annoying popup notifications
     * @param {boolean} skipRedundancyAnalysis - Skip redundancy analysis (for version changes)
     */
    async parseRuleSilent(skipRedundancyAnalysis = false) {
        return this.parseRuleInternal(skipRedundancyAnalysis, false);
    },

    /**
     * Internal rule parsing logic with configurable error notifications
     * @param {boolean} skipRedundancyAnalysis - Skip redundancy analysis (for version changes)
     * @param {boolean} showErrorNotifications - Whether to show popup error notifications
     */
    async parseRuleInternal(skipRedundancyAnalysis = false, showErrorNotifications = true) {
        if (AppState.isLoading) return;
        
        const rawRule = DOMElements.aclRuleInput.value.trim();
        const rule = Utils.normalizeACLRule(rawRule);
        
        // Update the textarea with normalized rule if it changed
        if (rule !== rawRule) {
            // Mark as programmatic update to prevent panel expansion
            DOMElements.aclRuleInput.dataset.programmaticUpdate = 'true';
            DOMElements.aclRuleInput.value = rule;
            
            // Update character counter
            import('../handlers/event-handlers.js').then(({ default: EventHandlers }) => {
                EventHandlers.updateCharacterCounterProgrammatically(DOMElements.aclRuleInput);
            });
        }
        
        // Validate ACL rule syntax first
        const validation = await Utils.validateACLRule(rule);
        if (!validation.valid) {
            const firstError = validation.errors[0];
            
            // Only show popup notifications if explicitly requested (e.g., Submit Changes button)
            if (showErrorNotifications) {
                Utils.showNotification(firstError, 'error', 5000);
            }
            
            // Still show in command results for detailed feedback (if available)
            if (DOMElements.commandResults) {
                Utils.showMessage(DOMElements.commandResults, `Invalid ACL syntax: ${firstError}`, 'error');
            }
            if (DOMElements.resultsSummary) {
                DOMElements.resultsSummary.style.display = 'none';
            }
            return;
        }
        
        if (DOMElements.commandResults) {
            Utils.showLoading(DOMElements.commandResults);
        }
        
        try {
            const data = await API.parseRule(rule, AppState.currentVersion);
            
            // Update summary
            this.updateResultsSummary(rule, data);
            
            // Display grouped commands
            this.displayGroupedCommands(data.grouped_commands || {});
            
        } catch (error) {
            // Only show popup notifications if explicitly requested
            if (showErrorNotifications) {
                Utils.showNotification(`Server error: ${error.message}`, 'error', 5000);
            }
            
            if (DOMElements.commandResults) {
                Utils.showMessage(DOMElements.commandResults, `Error parsing rule: ${error.message}`, 'error');
            }
            if (DOMElements.resultsSummary) {
                DOMElements.resultsSummary.style.display = 'none';
            }
        } finally {
            if (DOMElements.commandResults) {
                Utils.hideLoading(DOMElements.commandResults);
            }
        }
        
        // Analyze for redundancy after successful parsing (skip during version changes)
        if (!skipRedundancyAnalysis) {
            try {
                this.analyzeRedundancy();
            } catch (error) {
                console.error('Error starting redundancy analysis:', error);
            }
        } else {
            this.hideRedundancyWarnings(); // Hide any existing warnings
        }
    },
    
    /**
     * Analyze current rule for redundancy and show warnings
     */
    async analyzeRedundancy() {
        const rule = Utils.normalizeACLRule(DOMElements.aclRuleInput.value.trim());
        
        // Skip analysis for empty rules only
        if (!rule || rule.trim() === '') {
            this.hideRedundancyWarnings();
            return;
        }
        
        try {
            const response = await API.analyzeRedundancy(rule, AppState.currentVersion);
            
            if (response.success && response.analysis) {
                this.displayRedundancyWarnings(response.analysis);
            } else {
                this.hideRedundancyWarnings();
            }
        } catch (error) {
            console.error('Redundancy analysis failed:', error);
            this.hideRedundancyWarnings();
        }
    },
    
    /**
     * Display redundancy warnings in the UI
     */
    displayRedundancyWarnings(analysis) {
        const warningsContainer = document.getElementById('redundancyWarnings');
        const warningsList = document.getElementById('warningsList');
        const suggestionsList = document.getElementById('suggestionsList');

        if (!analysis.has_redundancy) {
            this.hideRedundancyWarnings();
            return;
        }

        // Clear existing content
        warningsList.innerHTML = '';
        suggestionsList.innerHTML = '';

        // Add warnings
        if (analysis.warnings && analysis.warnings.length > 0) {
            analysis.warnings.forEach(warning => {
                const warningDiv = document.createElement('div');
                warningDiv.className = 'warning-item';
                // Convert newlines to <br> tags for proper display
                warningDiv.innerHTML = warning.replace(/\n/g, '<br>');
                warningsList.appendChild(warningDiv);
            });
        }

        // Add suggestions
        if (analysis.suggestions && analysis.suggestions.length > 0) {
            analysis.suggestions.forEach(suggestion => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.className = 'suggestion-item';

                if (suggestion.includes('Simplified rule:')) {
                    const parts = suggestion.split('Simplified rule: ');
                    suggestionDiv.innerHTML = `${parts[0]}Simplified rule: <span class="simplified-rule">${parts[1]}</span>`;

                    // Make simplified rule clickable
                    const ruleSpan = suggestionDiv.querySelector('.simplified-rule');
                    if (ruleSpan) {
                        ruleSpan.style.cursor = 'pointer';
                        ruleSpan.title = 'Click to apply this simplified rule';
                        ruleSpan.onclick = () => {
                            const simplifiedRule = ruleSpan.textContent.replace(/'/g, '');
                            // Handle special case of "(empty rule)" - clear the text area completely
                            if (simplifiedRule === '(empty rule)') {
                                DOMElements.aclRuleInput.value = '';
                            } else {
                                DOMElements.aclRuleInput.value = simplifiedRule;
                            }

                            // Update character counter
                            import('../handlers/event-handlers.js').then(({ default: EventHandlers }) => {
                                EventHandlers.updateCharacterCounterProgrammatically(DOMElements.aclRuleInput);
                            });

                            this.parseRule(); // Re-parse with simplified rule

                            // Sync to interactive builder (same as clicking Submit Changes)
                            import('../components/interactive-acl-builder.js').then(({ default: InteractiveACLBuilder }) => {
                                if (InteractiveACLBuilder.state.isInitialized) {
                                    InteractiveACLBuilder.syncFromRuleText();
                                }
                            });
                        };
                    }
                } else {
                    suggestionDiv.textContent = suggestion;
                }

                suggestionsList.appendChild(suggestionDiv);
            });
        }

        // Show the warnings container
        warningsContainer.style.display = 'block';
    },
    
    /**
     * Hide redundancy warnings
     */
    hideRedundancyWarnings() {
        const warningsContainer = document.getElementById('redundancyWarnings');
        if (warningsContainer) {
            warningsContainer.style.display = 'none';
        }
    },

    /**
     * Update results summary display
     */
    updateResultsSummary(rule, data) {
        // Skip if no results summary element (three-column layout doesn't have one)
        if (!DOMElements.resultsSummary) {
            return;
        }
        
        if (rule === '') {
            DOMElements.resultsSummary.innerHTML = `<strong>No ACL rule specified</strong><br>All ${Utils.formatNumber(data.total_available)} commands are blocked by default`;
        } else {
            DOMElements.resultsSummary.innerHTML = `<strong>${Utils.formatNumber(data.total_granted)}</strong> of ${Utils.formatNumber(data.total_available)} commands granted`;
            
            if (data.impact_summary) {
                const percentage = data.impact_summary.overall_percentage;
                DOMElements.resultsSummary.innerHTML += ` <span class="text-muted">(${percentage}%)</span>`;
            }
        }
        DOMElements.resultsSummary.style.display = 'block';
    },

    /**
     * Display commands grouped by category
     */
    displayGroupedCommands(groupedCommands) {
        // Skip if no command results element (three-column layout doesn't have one)
        if (!DOMElements.commandResults) {
            return;
        }
        
        let html = '';
        
        const sortedCategories = Object.keys(groupedCommands).sort();
        
        if (sortedCategories.length === 0) {
            html = '<p class="text-muted" style="text-align: center; padding: 20px;">No commands granted by this rule</p>';
        } else {
            sortedCategories.forEach(category => {
                const commands = groupedCommands[category];
                // Sanitize category name for use as HTML ID
                const safeCategoryId = category.replace(/[^a-zA-Z0-9]/g, '-');
                const categoryId = `category-${safeCategoryId}`;
                const commandsHtml = commands.map(cmd => 
                    `<div class="command-item" title="Command: ${Utils.escapeHtml(cmd.toUpperCase())}">${Utils.escapeHtml(cmd)}</div>`
                ).join('');
                
                html += `
                    <div class="category-section">
                        <div class="category-header" onclick="CategoryManager.toggle('${safeCategoryId}')" role="button" tabindex="0" aria-expanded="true" data-category="${safeCategoryId}">
                            ${Utils.escapeHtml(category)} (${Utils.formatNumber(commands.length)})
                        </div>
                        <div class="category-commands" id="${categoryId}">
                            ${commandsHtml}
                        </div>
                    </div>
                `;
            });
        }
        
        DOMElements.commandResults.innerHTML = html;
    }
};

export default RuleManager;