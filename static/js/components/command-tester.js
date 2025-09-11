/**
 * Command Tester
 * Handles testing specific commands against ACL rules
 */

import AppState from '../core/app-state.js';
import DOMElements from '../core/dom-elements.js';
import Utils from '../core/utils.js';
import API from '../api/api-client.js';

const CommandTester = {
    /**
     * Test specific command against current rule
     */
    async testCommand() {
        const command = DOMElements.testCommandInput.value.trim();
        const rule = DOMElements.aclRuleInput.value.trim();
        
        if (!command) {
            const html = `
                <strong>❌ Error</strong><br>
                Please enter a command to test!
            `;
            Utils.showDismissibleTestResult(DOMElements.testResult, html, 'denied', 5000);
            DOMElements.testCommandInput.focus();
            return;
        }
        
        if (AppState.isLoading) return;
        
        Utils.showLoading(DOMElements.testResult);
        
        try {
            const data = await API.testCommand(rule, command, AppState.currentVersion);
            
            this.displayTestResult(data);
            
        } catch (error) {
            // Clean up error messages to be more user-friendly
            let errorMessage = error.message;
            
            // Handle "Command 'X' not found in REDIS8" type errors
            if (errorMessage.includes('not found in REDIS')) {
                const commandMatch = errorMessage.match(/Command '([^']+)'/);
                const versionMatch = errorMessage.match(/REDIS(\d+)/);
                const commandName = commandMatch ? commandMatch[1] : 'command';
                const version = versionMatch ? versionMatch[1] : '8';
                errorMessage = `❌ Command '${commandName}' not found in Redis ${version}. Please check the command spelling.`;
            } else {
                errorMessage = `Error testing command: ${errorMessage}`;
            }
            
            Utils.showDismissibleTestResult(DOMElements.testResult, errorMessage, 'denied', 5000);
        } finally {
            Utils.hideLoading(DOMElements.testResult);
        }
    },

    /**
     * Display test result
     */
    displayTestResult(data) {
        const resultClass = data.is_granted ? 'granted' : 'denied';
        const statusIcon = data.is_granted ? '✅' : '❌';
        
        let html = `
            <strong>${statusIcon} Command: ${Utils.escapeHtml(data.command)}</strong><br>
            ${Utils.escapeHtml(data.explanation)}
        `;
        
        if (data.categories && data.categories.length > 0) {
            const categoriesHtml = data.categories.map(cat => 
                `<span class="category-tag" title="Category: ${Utils.escapeHtml(cat)}">${Utils.escapeHtml(cat)}</span>`
            ).join('');
            
            html += `
                <div class="command-categories">
                    <strong>Categories:</strong>
                    ${categoriesHtml}
                </div>
            `;
        }
        
        // Use dismissible result with 5-second auto-dismiss
        Utils.showDismissibleTestResult(DOMElements.testResult, html, resultClass, 5000);
    }
};

export default CommandTester;