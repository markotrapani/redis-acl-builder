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

        // Trigger input event to notify SavedRules component AFTER saving
        const inputEvent = new Event('input', { bubbles: true });
        DOMElements.aclRuleInput.dispatchEvent(inputEvent);

        // Update character counter and button states AFTER saving
        Utils.executeMultipleEventHandlers([
            { method: 'updateCharacterCounterProgrammatically', args: [DOMElements.aclRuleInput] },
            { method: 'updateActionButtonStates', args: [] }
        ]);

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

        // If rule is empty, clear results and return early (no error)
        if (!rule || rule.length === 0) {
            if (DOMElements.commandResults) {
                DOMElements.commandResults.innerHTML = '';
            }
            if (DOMElements.resultsSummary) {
                DOMElements.resultsSummary.style.display = 'none';
            }
            // Only hide optimization warnings if this is a committed empty rule (not during typing)
            // During typing (skipRedundancyAnalysis=true), keep the optimization visible
            if (!skipRedundancyAnalysis) {
                this.hideRedundancyWarnings();
            }
            return;
        }

        // Update the textarea with normalized rule if it changed
        if (rule !== rawRule) {
            // Preserve cursor position during normalization
            const cursorStart = DOMElements.aclRuleInput.selectionStart;
            const cursorEnd = DOMElements.aclRuleInput.selectionEnd;

            // Mark as programmatic update to prevent panel expansion
            DOMElements.aclRuleInput.dataset.programmaticUpdate = 'true';
            DOMElements.aclRuleInput.value = rule;

            // Restore cursor position after value update
            DOMElements.aclRuleInput.setSelectionRange(cursorStart, cursorEnd);

            // Update character counter
            Utils.executeEventHandler('updateCharacterCounterProgrammatically', DOMElements.aclRuleInput);
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
        
        // Analyze for redundancy after successful parsing (skip during version changes or manual typing)
        if (!skipRedundancyAnalysis) {
            try {
                this.analyzeRedundancy();
            } catch (error) {
                console.error('Error starting redundancy analysis:', error);
            }
        }
        // Note: When skipping redundancy analysis (during typing), we DON'T hide warnings
        // The optimization box should persist until user submits a new rule or clicks X
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
                // Check for optimization opportunities
                await this.checkForOptimization(rule, response.analysis);
            } else {
                this.hideRedundancyWarnings();
            }
        } catch (error) {
            console.error('Redundancy analysis failed:', error);
            this.hideRedundancyWarnings();
        }
    },

    /**
     * Check for optimization opportunities
     */
    async checkForOptimization(rule, redundancyAnalysis) {
        try {
            console.log('[DEBUG] checkForOptimization called with version:', AppState.currentVersion);
            const optimizeResponse = await API.optimizeRule(rule, AppState.currentVersion);
            console.log('[DEBUG] Optimization response:', optimizeResponse);

            if (optimizeResponse.success && optimizeResponse.savings > 0) {
                // Check if backend already has suggestions (empty rule or other simplifications)
                const hasBackendSuggestions = redundancyAnalysis.suggestions &&
                    redundancyAnalysis.suggestions.length > 0;

                // Check if backend already has "Rule results in no permissions" warning
                const hasNoPermissionsWarning = redundancyAnalysis.warnings &&
                    redundancyAnalysis.warnings.some(w => w.includes('Rule results in no permissions'));

                // Check if optimized rule is empty
                const optimizesToEmpty = !optimizeResponse.optimized_rule ||
                    optimizeResponse.optimized_rule.trim() === '' ||
                    optimizeResponse.optimized_rule === '(empty rule)';

                // If optimizing to empty rule, REPLACE redundancy suggestions with the optimization suggestion
                // The redundancy analysis might suggest partial optimizations (e.g., remove -@admin)
                // but the optimization endpoint correctly identifies that the entire rule should be empty
                if (optimizesToEmpty && hasBackendSuggestions) {
                    // Replace suggestions with the correct empty rule optimization
                    redundancyAnalysis.suggestions = [`Simplified rule: (empty rule)`];

                    // Replace warnings with just the optimization explanation (cleaner than showing all redundant terms)
                    if (optimizeResponse.explanation) {
                        redundancyAnalysis.warnings = [optimizeResponse.explanation];
                    }

                    this.displayRedundancyWarnings(redundancyAnalysis);
                    return;
                }

                // Skip frontend optimization if "Rule results in no permissions" warning exists
                if (hasNoPermissionsWarning) {
                    this.displayRedundancyWarnings(redundancyAnalysis);
                    return;
                }

                // Add optimization suggestion to the redundancy analysis
                const simplifiedRule = optimizeResponse.optimized_rule || '(empty rule)';
                const isEmptyRule = !optimizeResponse.optimized_rule || optimizeResponse.optimized_rule.trim() === '';

                console.log('[DEBUG] Building optimization suggestion:', {
                    simplifiedRule,
                    isEmptyRule,
                    savings: optimizeResponse.savings
                });

                // For empty rules, don't show "Saves X terms" - the warning already explains it
                // Put "Simplified rule" first (most important), then "Saves X terms" below
                let optimizationSuggestion;
                if (isEmptyRule) {
                    optimizationSuggestion = `Simplified rule: ${simplifiedRule}`;
                } else {
                    optimizationSuggestion = `Simplified rule: ${simplifiedRule}\nSaves ${optimizeResponse.savings} term${optimizeResponse.savings > 1 ? 's' : ''}`;
                }

                console.log('[DEBUG] Final optimization suggestion:', optimizationSuggestion);
                console.log('[DEBUG] Backend suggestions before replacement:', redundancyAnalysis.suggestions);

                if (!redundancyAnalysis.suggestions) {
                    redundancyAnalysis.suggestions = [];
                }
                if (!redundancyAnalysis.warnings) {
                    redundancyAnalysis.warnings = [];
                }

                // Show explanation as a warning (red box) when available
                // This provides context for why the optimization is possible
                // BUT: Skip if there are already redundancy or category completion warnings (to avoid duplication)
                const hasRedundancyWarnings = redundancyAnalysis.warnings &&
                    redundancyAnalysis.warnings.some(w =>
                        w.includes('Redundant inclusion') ||
                        w.includes('Redundant exclusion') ||
                        w.includes('Rule results in no permissions') ||
                        w.includes('Individual commands cover entire') || // Category completion warning
                        w.includes('Category') // Any other category-related warnings
                    );

                if (optimizeResponse.explanation && !hasRedundancyWarnings) {
                    redundancyAnalysis.warnings.push(optimizeResponse.explanation);
                }

                // Replace any existing optimization suggestions with the best one
                // The backend might return intermediate optimizations, but we only want to show the best
                redundancyAnalysis.suggestions = [optimizationSuggestion];
                redundancyAnalysis.has_redundancy = true;

                // Mark this as an optimization scenario (not true redundancy)
                // This affects the header text displayed to the user
                redundancyAnalysis.is_optimization = true;
            }

            // Display combined warnings and suggestions
            this.displayRedundancyWarnings(redundancyAnalysis);
        } catch (error) {
            console.error('Optimization check failed:', error);
            // Still display redundancy warnings even if optimization fails
            this.displayRedundancyWarnings(redundancyAnalysis);
        }
    },
    
    /**
     * Display redundancy warnings in the UI
     */
    displayRedundancyWarnings(analysis) {
        console.log('[DEBUG] displayRedundancyWarnings called with:', analysis);
        console.trace('[DEBUG] Call stack');
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

        // Determine if we have actual redundancy or just optimization
        const hasOptimization = analysis.suggestions && analysis.suggestions.some(s => s.startsWith('Saves ') && s.includes('term'));

        // Check if optimization simplifies to empty rule (covers redundant exclusions)
        const optimizesToEmpty = hasOptimization && analysis.suggestions.some(s =>
            s.includes('(empty rule)') || s.includes('Simplified rule: \n') || s.includes('Simplified rule:  ')
        );

        // Filter warnings: handle different scenarios appropriately
        let filteredWarnings = analysis.warnings || [];
        const hasNoPermissionsWarning = filteredWarnings.some(w => w.includes('Rule results in no permissions'));
        const hasEmptyRuleSuggestion = analysis.suggestions && analysis.suggestions.some(s => s.includes('(empty rule)'));

        // Get count of "Commands were not granted" warnings for deduplication
        const notGrantedWarnings = filteredWarnings.filter(w => w.includes('Commands were not granted by earlier rules'));

        if (hasNoPermissionsWarning) {
            // Only keep the "Rule results in no permissions" warning, suppress all others
            filteredWarnings = filteredWarnings.filter(warning =>
                warning.includes('Rule results in no permissions')
            );
        } else if (hasEmptyRuleSuggestion && notGrantedWarnings.length > 0) {
            // When we have empty rule suggestion, keep only ONE "not granted" warning as explanation
            // Filter out all "not granted" warnings first
            const otherWarnings = filteredWarnings.filter(w => !w.includes('Commands were not granted by earlier rules'));
            // Add back just the first one as the explanation
            filteredWarnings = [...otherWarnings, notGrantedWarnings[0]];
        }

        const hasRedundantTerms = filteredWarnings.length > 0;

        // Update header text based on what we're showing
        const headerElement = warningsContainer.querySelector('.redundancy-header h4');
        if (headerElement) {
            // Prioritize optimization header when it's an optimization scenario
            // (even if there are warnings/explanations)
            if (analysis.is_optimization || (hasOptimization && !hasRedundantTerms)) {
                headerElement.textContent = '💡 Rule Optimization Available:';
            } else if (hasRedundantTerms) {
                headerElement.textContent = '⚠️ Redundant Terms Detected:';
            } else if (hasOptimization) {
                headerElement.textContent = '💡 Rule Optimization Available:';
            } else {
                headerElement.textContent = '💡 Suggestions:';
            }
        }

        // Add warnings (using filtered list)
        if (filteredWarnings.length > 0) {
            filteredWarnings.forEach(warning => {
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
                    // Convert newlines to <br> tags in the first part
                    const formattedFirstPart = parts[0].replace(/\n/g, '<br>');

                    // Split the second part by newline to separate the rule from additional text (like "Saves X terms")
                    const afterRule = parts[1].split('\n');
                    const actualRule = afterRule[0]; // First line is the actual rule
                    const additionalText = afterRule.slice(1).join('<br>'); // Remaining lines

                    console.log('[DEBUG] Rendering suggestion:', {
                        suggestion,
                        parts,
                        afterRule,
                        actualRule,
                        additionalText,
                        additionalTextLength: additionalText.length
                    });

                    suggestionDiv.innerHTML = `${formattedFirstPart}Simplified rule: <span class="simplified-rule">${actualRule}</span>${additionalText ? '<br>' + additionalText : ''}`;

                    console.log('[DEBUG] suggestionDiv.innerHTML:', suggestionDiv.innerHTML);

                    // Make simplified rule clickable
                    const ruleSpan = suggestionDiv.querySelector('.simplified-rule');
                    if (ruleSpan) {
                        ruleSpan.style.cursor = 'pointer';
                        ruleSpan.title = 'Click to apply this simplified rule';
                        ruleSpan.onclick = () => {
                            const simplifiedRule = ruleSpan.textContent.replace(/'/g, '');
                            // Handle special case of "(empty rule)" or empty string - clear the text area completely
                            if (simplifiedRule === '(empty rule)' || simplifiedRule === '' || simplifiedRule === ' ') {
                                DOMElements.aclRuleInput.value = '';
                            } else {
                                DOMElements.aclRuleInput.value = simplifiedRule;
                            }

                            // Trigger input event to notify SavedRules component
                            const inputEvent = new Event('input', { bubbles: true });
                            DOMElements.aclRuleInput.dispatchEvent(inputEvent);

                            // Update character counter
                            Utils.executeEventHandler('updateCharacterCounterProgrammatically', DOMElements.aclRuleInput);

                            this.parseRule(); // Re-parse with simplified rule

                            // Sync to interactive builder (same as clicking Submit Changes)
                            import('../components/interactive-acl-builder.js').then(({ default: InteractiveACLBuilder }) => {
                                if (InteractiveACLBuilder.state.isInitialized) {
                                    InteractiveACLBuilder.syncFromRuleText();
                                }
                            });

                            // Update button states after applying simplified rule
                            import('../handlers/event-handlers.js').then(({ default: EventHandlers }) => {
                                EventHandlers.updateActionButtonStates();
                            });
                        };
                    }
                } else {
                    suggestionDiv.textContent = suggestion;
                }

                suggestionsList.appendChild(suggestionDiv);
                console.log('[DEBUG] Appended suggestion to DOM. suggestionsList.innerHTML:', suggestionsList.innerHTML);
            });
        }

        // Show the warnings container
        warningsContainer.style.display = 'block';

        console.log('[DEBUG] Final suggestionsList.innerHTML:', suggestionsList.innerHTML);
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