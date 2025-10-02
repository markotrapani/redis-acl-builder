/**
 * ACL UI Renderer
 * Handles UI rendering for buttons, tooltips, and multi-column content
 */

const ACLUIRenderer = {
    /**
     * Create multi-column content for tooltips
     * @param {string} title - Title text
     * @param {Array<string>} items - Array of items to display
     * @param {string} prefix - Optional prefix for each item
     * @returns {string} HTML string for multi-column content
     */
    createMultiColumnContent(title, items, prefix = '') {
        const itemCount = items.length;

        // Use single column for small lists
        if (itemCount <= 12) {
            const itemsWithPrefix = items.map(item => `${prefix}${item}`);
            return `${title}<br/>• ${itemsWithPrefix.join('<br/>• ')}`;
        }

        // Determine number of columns based on item count
        let columns;
        if (itemCount <= 30) {
            columns = 2;
        } else if (itemCount <= 60) {
            columns = 3;
        } else {
            columns = 4;
        }

        // Calculate items per column
        const itemsPerColumn = Math.ceil(itemCount / columns);

        // Split items into columns
        const columnData = [];
        for (let i = 0; i < columns; i++) {
            const start = i * itemsPerColumn;
            const end = Math.min(start + itemsPerColumn, itemCount);
            columnData.push(items.slice(start, end));
        }

        // Build HTML with grid layout
        let html = `${title}<div class="tooltip-columns cols-${columns}">`;

        columnData.forEach(columnItems => {
            html += '<div class="tooltip-column"><ul>';
            columnItems.forEach(item => {
                html += `<li>${prefix}${item}</li>`;
            });
            html += '</ul></div>';
        });

        html += '</div>';
        return html;
    },

    /**
     * Create a command button element
     * @param {string} command - Command name
     * @param {string} state - Button state ('available', 'blocked', 'granted')
     * @param {string|null} blockType - Type of block ('explicit', 'category', 'implicit')
     * @param {Object} state - ACL builder state
     * @param {Object} handlers - Event handler functions
     * @param {Function} addEnhancedTooltip - Tooltip addition function
     * @returns {HTMLButtonElement} Command button element
     */
    createCommandButton(command, buttonState, blockType, state, handlers, addEnhancedTooltip) {
        const button = document.createElement('button');

        if (buttonState === 'available') {
            button.className = `command-button blocked implicit`; // Available = implicitly blocked
            button.dataset.stateInfo = `Click to grant ${command} command`;
            button.onclick = () => handlers.grantCommand(command);
        } else if (buttonState === 'blocked') {
            // Handle visual differentiation for blocked commands
            if (blockType === 'explicit') {
                // Explicitly blocked commands (highlighted - like -acl|deluser)
                button.className = `command-button blocked explicit`;
                button.dataset.stateInfo = `${command} - EXPLICITLY BLOCKED\nThis command was individually blocked.\nClick to make it available.`;
                button.onclick = () => handlers.toggleCommand(command);
            } else if (blockType === 'category') {
                // Commands blocked by category exclusions (darkened - like -@admin commands)
                button.className = `command-button blocked implicit`; // Use implicit styling (darkened)
                button.dataset.stateInfo = `${command} - BLOCKED BY CATEGORY\nThis command is blocked by an excluded category.\nClick to explicitly grant it.`;
                button.onclick = () => handlers.grantCommand(command);
            } else if (blockType === 'implicit') {
                // Implicitly blocked commands (darkened - not granted by any rule)
                button.className = `command-button blocked implicit`;
                button.dataset.stateInfo = `${command} - NOT GRANTED\nThis command is not granted by any rule.\nClick to grant it.`;
                button.onclick = () => handlers.grantCommand(command);
            } else {
                // Fallback - check if command is in blockedCommands set
                if (state.blockedCommands.has(command)) {
                    button.className = `command-button blocked explicit`;
                    button.dataset.stateInfo = `${command} - EXPLICITLY BLOCKED\nThis command was individually blocked.\nClick to make it available.`;
                    button.onclick = () => handlers.toggleCommand(command);
                } else {
                    button.className = `command-button blocked implicit`;
                    button.dataset.stateInfo = `${command} - BLOCKED BY CATEGORY\nThis command is blocked by an excluded category.\nClick to explicitly grant it.`;
                    button.onclick = () => handlers.toggleCommand(command);
                }
            }
        } else {
            button.className = `command-button ${buttonState}`;
            button.dataset.stateInfo = `Click to ${buttonState === 'granted' ? 'revoke' : 'grant'} ${command} command`;
            button.onclick = () => handlers.toggleCommand(command);
        }

        button.textContent = command;

        // Add enhanced tooltip on hover
        addEnhancedTooltip(button, 'command', command);

        return button;
    },

    /**
     * Create a command button for granted commands (handles commands granted via categories)
     * @param {string} command - Command name
     * @param {boolean} isViaCategory - Whether granted via category
     * @param {boolean} isIndividual - Whether granted individually
     * @param {Object} handlers - Event handler functions
     * @param {Function} addEnhancedTooltip - Tooltip addition function
     * @returns {HTMLButtonElement} Granted command button element
     */
    createGrantedCommandButton(command, isViaCategory, isIndividual, handlers, addEnhancedTooltip) {
        const button = document.createElement('button');
        button.className = 'command-button granted';
        button.textContent = command;

        // Determine the behavior based on how the command is granted
        if (isIndividual) {
            // If granted individually (even if also via category), use normal toggle
            button.classList.add('explicit');
            button.dataset.stateInfo = `${command} - EXPLICITLY GRANTED\nThis command was directly added to your ACL rule.\nClick to revoke.`;
            button.onclick = () => handlers.toggleCommand(command);
        } else if (isViaCategory) {
            // If only granted via category, use exclusion behavior
            button.classList.add('implicit');
            button.dataset.stateInfo = `${command} - IMPLICITLY GRANTED\nThis command is granted through a category.\nClick to explicitly exclude it from the category.`;
            button.onclick = () => handlers.blockCommandFromCategory(command);
        }

        // Add enhanced tooltip on hover
        addEnhancedTooltip(button, 'command', command);

        return button;
    }
};

export default ACLUIRenderer;
