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
            Utils.showMessage(DOMElements.testResult, 'Please enter a command to test', 'warning');
            DOMElements.testCommandInput.focus();
            return;
        }
        
        if (AppState.isLoading) return;
        
        Utils.showLoading(DOMElements.testResult);
        
        try {
            const data = await API.testCommand(rule, command, AppState.currentVersion);
            
            this.displayTestResult(data);
            
        } catch (error) {
            Utils.showMessage(DOMElements.testResult, `Error testing command: ${error.message}`, 'error');
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
            <div class="test-result ${resultClass}">
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
        
        html += '</div>';
        DOMElements.testResult.innerHTML = html;
    }
};

export default CommandTester;