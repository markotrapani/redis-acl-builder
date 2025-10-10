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
    },

    /**
     * Create results summary for empty ACL rule
     * @param {number} totalAvailable - Total available commands
     * @returns {DocumentFragment}
     */
    createEmptyRuleSummary(totalAvailable) {
        const fragment = document.createDocumentFragment();

        const strong = document.createElement('strong');
        strong.textContent = 'No ACL rule specified';
        fragment.appendChild(strong);

        fragment.appendChild(document.createElement('br'));

        const formattedTotal = totalAvailable.toLocaleString();
        fragment.appendChild(document.createTextNode(`All ${formattedTotal} commands are blocked by default`));

        return fragment;
    },

    /**
     * Create results summary with granted commands count
     * @param {number} totalGranted - Total granted commands
     * @param {number} totalAvailable - Total available commands
     * @param {string} [percentage] - Optional percentage string (e.g., "42.5")
     * @returns {DocumentFragment}
     */
    createGrantedSummary(totalGranted, totalAvailable, percentage = null) {
        const fragment = document.createDocumentFragment();

        const strong = document.createElement('strong');
        strong.textContent = totalGranted.toLocaleString();
        fragment.appendChild(strong);

        const formattedTotal = totalAvailable.toLocaleString();
        fragment.appendChild(document.createTextNode(` of ${formattedTotal} commands granted`));

        if (percentage) {
            const span = document.createElement('span');
            span.className = 'text-muted';
            span.textContent = ` (${percentage}%)`;
            fragment.appendChild(span);
        }

        return fragment;
    },

    /**
     * Create a category section with commands for grouped display
     * @param {string} category - Category name
     * @param {Array<string>} commands - Array of command names
     * @param {Function} escapeHtml - HTML escaping function
     * @param {Function} formatNumber - Number formatting function
     * @returns {HTMLElement}
     */
    createCategorySection(category, commands, escapeHtml, formatNumber) {
        const safeCategoryId = category.replace(/[^a-zA-Z0-9]/g, '-');
        const categoryId = `category-${safeCategoryId}`;

        const section = document.createElement('div');
        section.className = 'category-section';

        // Create category header
        const header = document.createElement('div');
        header.className = 'category-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'true');
        header.setAttribute('data-category', safeCategoryId);
        header.onclick = () => {
            // Import CategoryManager and call toggle
            import('../managers/category-manager.js').then(({ default: CategoryManager }) => {
                CategoryManager.toggle(safeCategoryId);
            });
        };
        header.textContent = `${category} (${formatNumber(commands.length)})`;

        // Create commands container
        const commandsContainer = document.createElement('div');
        commandsContainer.className = 'category-commands';
        commandsContainer.id = categoryId;

        // Add command items
        commands.forEach(cmd => {
            const commandItem = document.createElement('div');
            commandItem.className = 'command-item';
            commandItem.setAttribute('title', `Command: ${escapeHtml(cmd.toUpperCase())}`);
            commandItem.textContent = cmd;
            commandsContainer.appendChild(commandItem);
        });

        section.appendChild(header);
        section.appendChild(commandsContainer);

        return section;
    },

    /**
     * Create "no commands" message
     * @returns {HTMLElement}
     */
    createNoCommandsMessage() {
        const p = document.createElement('p');
        p.className = 'text-muted';
        p.style.textAlign = 'center';
        p.style.padding = '20px';
        p.textContent = 'No commands granted by this rule';
        return p;
    }
};

export default DOMUtils;
