/**
 * DOM Utilities for Safe HTML Construction
 *
 * This module provides safe alternatives to innerHTML for XSS prevention.
 * All user-provided content should go through these utilities.
 */

export const DOMUtils = {
    /**
     * Safely create a text node with line breaks converted to <br> elements
     * @param {string} text - Text content (may contain \n characters)
     * @returns {DocumentFragment} - Fragment with text and <br> elements
     */
    createTextWithBreaks(text) {
        const fragment = document.createDocumentFragment();
        const lines = text.split('\n');

        lines.forEach((line, index) => {
            fragment.appendChild(document.createTextNode(line));
            if (index < lines.length - 1) {
                fragment.appendChild(document.createElement('br'));
            }
        });

        return fragment;
    },

    /**
     * Create a span element with safe text content
     * @param {string} text - Text content
     * @param {string} className - Optional CSS class
     * @returns {HTMLSpanElement}
     */
    createSpan(text, className = '') {
        const span = document.createElement('span');
        span.textContent = text;
        if (className) span.className = className;
        return span;
    },

    /**
     * Create a clickable simplified rule element
     * @param {string} rule - The ACL rule text
     * @param {Function} onClick - Click handler
     * @returns {HTMLSpanElement}
     */
    createClickableRule(rule, onClick) {
        const span = this.createSpan(rule, 'simplified-rule');
        span.style.cursor = 'pointer';
        span.title = 'Click to apply this simplified rule';
        span.addEventListener('click', onClick);
        return span;
    },

    /**
     * Build a suggestion element with "Simplified rule: <rule>" format
     * @param {string} beforeText - Text before "Simplified rule:"
     * @param {string} rule - The ACL rule
     * @param {string} afterText - Text after the rule (e.g., "Saves X terms")
     * @param {Function} onRuleClick - Click handler for the rule
     * @returns {DocumentFragment}
     */
    createSimplifiedRuleSuggestion(beforeText, rule, afterText, onRuleClick) {
        const fragment = document.createDocumentFragment();

        // Add text before rule
        if (beforeText) {
            fragment.appendChild(this.createTextWithBreaks(beforeText));
        }

        // Add "Simplified rule: " label
        fragment.appendChild(document.createTextNode('Simplified rule: '));

        // Add clickable rule
        const ruleSpan = this.createClickableRule(rule, onRuleClick);
        fragment.appendChild(ruleSpan);

        // Add text after rule (e.g., savings info)
        if (afterText) {
            fragment.appendChild(document.createElement('br'));
            fragment.appendChild(this.createTextWithBreaks(afterText));
        }

        return fragment;
    },

    /**
     * Create a warning message element
     * @param {string} message - Warning message text
     * @returns {DocumentFragment}
     */
    createWarning(message) {
        return this.createTextWithBreaks(message);
    },

    /**
     * Safely clear element content
     * @param {HTMLElement} element - Element to clear
     */
    clearElement(element) {
        // Using textContent = '' is safe and fast
        element.textContent = '';
    },

    /**
     * Create tooltip content with structured data
     * @param {string} title - Tooltip title
     * @param {Array<string>} items - List of items to display
     * @param {string} prefix - Optional prefix for each item (e.g., '@')
     * @param {number} columns - Number of columns (1-4)
     * @returns {HTMLDivElement}
     */
    createTooltipContent(title, items, prefix = '', columns = 1) {
        const container = document.createElement('div');
        container.className = `tooltip-content columns-${columns}`;

        // Add title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'tooltip-title';
        titleDiv.textContent = title;
        container.appendChild(titleDiv);

        // Add items
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'tooltip-items';

        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'tooltip-item';
            itemDiv.textContent = `${prefix}${item}`;
            itemsContainer.appendChild(itemDiv);
        });

        container.appendChild(itemsContainer);
        return container;
    },

    /**
     * Create a category button with warning icon
     * @param {string} category - Category name
     * @param {boolean} hasWarning - Whether to show warning icon
     * @returns {DocumentFragment}
     */
    createCategoryButtonContent(category, hasWarning) {
        const fragment = document.createDocumentFragment();
        fragment.appendChild(document.createTextNode(`@${category}`));

        if (hasWarning) {
            const icon = document.createElement('span');
            icon.className = 'warning-icon';
            icon.textContent = '⚠';
            fragment.appendChild(icon);
        }

        return fragment;
    }
};

export default DOMUtils;
