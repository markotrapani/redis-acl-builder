/**
 * Keyspace Tester Component
 * Handles testing key patterns against ACL rules with glob pattern matching
 */

import DOMElements from '../core/dom-elements.js';
import Utils from '../core/utils.js';
import API from '../api/api-client.js';

const KeyspaceTester = {
    /**
     * Test a keyspace pattern against the current ACL rule
     */
    async testKeyspace() {
        const keyspaceInput = document.getElementById('testKeyspace');
        const resultDiv = document.getElementById('testKeyspaceResult');
        
        if (!keyspaceInput || !resultDiv) {
            Utils.showNotification('Keyspace tester elements not found', 'error');
            return;
        }
        
        const keyPattern = keyspaceInput.value.trim();
        const aclRule = DOMElements.aclRuleInput?.value.trim() || '';
        
        if (!keyPattern) {
            const html = `
                <strong>❌ Error</strong><br>
                Please enter a key name to test!
            `;
            Utils.showDismissibleTestResult(resultDiv, html, 'denied', 5000);
            return;
        }
        
        if (!aclRule) {
            const html = `
                <strong>❌ Key: ${Utils.escapeHtml(keyPattern)}</strong><br>
                No ACL rule specified - all keys are blocked by default
            `;
            Utils.showDismissibleTestResult(resultDiv, html, 'denied', 5000);
            return;
        }
        
        Utils.showLoading(resultDiv);
        
        try {
            // Extract keyspace patterns from ACL rule
            const keyspacePatterns = this.extractKeyspacePatterns(aclRule);
            
            if (keyspacePatterns.length === 0) {
                const html = `
                    <strong>❌ Key: ${Utils.escapeHtml(keyPattern)}</strong><br>
                    No keyspace patterns (~) found in ACL rule
                `;
                Utils.showDismissibleTestResult(resultDiv, html, 'denied', 5000);
                return;
            }
            
            // Test the key against all patterns
            const matchResult = this.testKeyAgainstPatterns(keyPattern, keyspacePatterns);
            
            // Display result in same format as Command Tester
            const resultClass = matchResult.allowed ? 'granted' : 'denied';
            const statusIcon = matchResult.allowed ? '✅' : '❌';
            
            let html = `<strong>${statusIcon} Key: ${Utils.escapeHtml(keyPattern)}</strong><br>`;
            
            if (matchResult.allowed) {
                html += `Key "${Utils.escapeHtml(keyPattern)}" matches pattern: <code>${Utils.escapeHtml(matchResult.matchingPattern)}</code>`;
            } else {
                const patternsList = keyspacePatterns.map(p => `<code>${Utils.escapeHtml(p)}</code>`).join(', ');
                html += `Key "${Utils.escapeHtml(keyPattern)}" does not match any keyspace patterns:<br>${patternsList}`;
            }
            
            // Use dismissible result with 5-second auto-dismiss
            Utils.showDismissibleTestResult(resultDiv, html, resultClass, 5000);
            
        } catch (error) {
            console.error('Keyspace test error:', error);
            const html = `<strong>❌ Error</strong><br>Error testing keyspace: ${Utils.escapeHtml(error.message)}`;
            Utils.showDismissibleTestResult(resultDiv, html, 'denied', 5000);
        } finally {
            Utils.hideLoading(resultDiv);
        }
    },
    
    /**
     * Extract keyspace patterns (~) from ACL rule
     */
    extractKeyspacePatterns(aclRule) {
        const tokens = aclRule.split(/\s+/).filter(token => token.trim().length > 0);
        const keyspacePatterns = [];
        
        for (const token of tokens) {
            if (token.startsWith('~')) {
                keyspacePatterns.push(token.substring(1)); // Remove the ~ prefix
            }
        }
        
        return keyspacePatterns;
    },
    
    /**
     * Test a key against keyspace patterns with glob matching
     * Supports: *, ?, [abc], [a-z], [^abc]
     */
    testKeyAgainstPatterns(key, patterns) {
        for (const pattern of patterns) {
            if (this.matchesGlobPattern(key, pattern)) {
                return { allowed: true, matchingPattern: '~' + pattern };
            }
        }
        return { allowed: false };
    },
    
    /**
     * Check if a key matches a glob pattern
     * Supports: *, ?, [abc], [a-z], [^abc], escaped characters with \
     */
    matchesGlobPattern(key, pattern) {
        // Convert glob pattern to regex
        const regexPattern = this.globToRegex(pattern);
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(key);
    },
    
    /**
     * Convert glob pattern to regex pattern
     */
    globToRegex(pattern) {
        let regex = '';
        let i = 0;
        
        while (i < pattern.length) {
            const char = pattern[i];
            
            switch (char) {
                case '*':
                    regex += '.*';
                    break;
                case '?':
                    regex += '.';
                    break;
                case '[':
                    // Handle character class [abc], [a-z], [^abc]
                    const closingBracket = pattern.indexOf(']', i);
                    if (closingBracket === -1) {
                        // No closing bracket, treat [ as literal
                        regex += '\\[';
                    } else {
                        let charClass = pattern.substring(i + 1, closingBracket);
                        
                        // Handle negation [^...]
                        if (charClass.startsWith('^')) {
                            regex += '[^' + this.escapeRegexInCharClass(charClass.substring(1)) + ']';
                        } else {
                            regex += '[' + this.escapeRegexInCharClass(charClass) + ']';
                        }
                        i = closingBracket;
                    }
                    break;
                case '\\':
                    // Handle escaped characters
                    if (i + 1 < pattern.length) {
                        const nextChar = pattern[i + 1];
                        regex += '\\' + this.escapeRegexChar(nextChar);
                        i++; // Skip the escaped character
                    } else {
                        regex += '\\\\';
                    }
                    break;
                default:
                    // Escape regex special characters
                    regex += this.escapeRegexChar(char);
                    break;
            }
            i++;
        }
        
        return regex;
    },
    
    /**
     * Escape regex special characters for literal matching
     */
    escapeRegexChar(char) {
        const regexSpecialChars = '.^$+{}()|\\';
        return regexSpecialChars.includes(char) ? '\\' + char : char;
    },
    
    /**
     * Escape regex special characters within character classes
     */
    escapeRegexInCharClass(str) {
        // In character classes, only ] - ^ \ need escaping
        return str.replace(/[\]\\^-]/g, '\\$&');
    }
};

export default KeyspaceTester;