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
    },

    /**
     * Add enhanced tooltip functionality with relationship information
     * @param {HTMLButtonElement} button - Button element to add tooltip to
     * @param {string} type - Type of element ('command' or 'category')
     * @param {string} name - Name of command or category
     * @param {Object} dependencies - External dependencies
     */
    addEnhancedTooltip(button, type, name, dependencies) {
        const { API, AppState, getCategoryCommandsCached, createMultiColumnContent } = dependencies;

        let tooltipElement = null;
        let hideTimeout = null;
        let showTimeout = null;

        const cleanupTooltip = () => {
            // Clear all timeouts
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            if (showTimeout) {
                clearTimeout(showTimeout);
                showTimeout = null;
            }

            // Remove tooltip element
            if (tooltipElement) {
                tooltipElement.remove();
                tooltipElement = null;
            }
        };

        const showTooltip = async () => {

            // Clear any hide timeouts when mouse enters button
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;

                // If tooltip already exists, don't restart the show process
                if (tooltipElement) {
                    return;
                }
            }

            // Clear any existing timeouts and tooltips
            cleanupTooltip();

            // Add 1-second delay before showing tooltip
            showTimeout = setTimeout(async () => {
                // Double-check that we should still show tooltip
                if (!showTimeout) {
                    return;
                }

                try {
                    let content = '';

                    // Get state information from the button
                    const stateInfo = button.dataset.stateInfo || '';

                    // Determine color based on button location/state (red for blocked, green for granted)
                    let titleClass = 'tooltip-title';

                    // Check if button is in granted column by looking at its container
                    const isInGrantedColumn = button.closest('#grantedCategories, #grantedCommands');
                    const isInBlockedColumn = button.closest('#blockedCategories, #blockedCommands');


                    if (isInGrantedColumn) {
                        titleClass += ' granted'; // Green for granted
                    } else if (isInBlockedColumn) {
                        titleClass += ' blocked'; // Red for blocked
                    }

                    // Build tooltip content with state info and relationships
                    content = `<div class="${titleClass}">${type === 'category' ? '@' : ''}${name}</div>`;

                    // Add state information if available
                    if (stateInfo) {
                        content += `<div class="tooltip-state">${stateInfo.replace(/\n/g, '<br/>')}</div>`;
                    }

                    // Add relationship information
                    if (type === 'command') {
                        // Get categories for this command
                        const response = await API.getCommandInfo(name, AppState.currentVersion);
                        if (response.success && response.categories && response.categories.length > 0) {
                            const categories = response.categories.sort();
                            const displayCategories = categories.slice(0, 8);
                            const remaining = categories.length - displayCategories.length;

                            let relationshipContent = `Member of categories:<br/>• @${displayCategories.join('<br/>• @')}`;
                            if (remaining > 0) {
                                const linkColorClass = isInGrantedColumn ? 'granted' : (isInBlockedColumn ? 'blocked' : '');
                                relationshipContent += `<br/>• <span class="expandable-link ${linkColorClass}" data-type="categories" data-full-list="${categories.join(',')}" data-showing="${displayCategories.length}">... and ${remaining} more</span>`;
                            }
                            content += `<div class="tooltip-content">${relationshipContent}</div>`;
                        } else {
                            content += `<div class="tooltip-content">No category information available</div>`;
                        }
                    } else if (type === 'category') {
                        // Get commands for this category
                        const commands = await getCategoryCommandsCached(name);
                        if (commands && commands.length > 0) {
                            const sortedCommands = commands.sort();
                            const displayCommands = sortedCommands.slice(0, 8);
                            const remaining = sortedCommands.length - displayCommands.length;

                            let relationshipContent = `Contains ${sortedCommands.length} commands:<br/>• ${displayCommands.join('<br/>• ')}`;
                            if (remaining > 0) {
                                const linkColorClass = isInGrantedColumn ? 'granted' : (isInBlockedColumn ? 'blocked' : '');
                                relationshipContent += `<br/>• <span class="expandable-link ${linkColorClass}" data-type="commands" data-full-list="${sortedCommands.join(',')}" data-showing="${displayCommands.length}">... and ${remaining} more</span>`;
                            }
                            content += `<div class="tooltip-content">${relationshipContent}</div>`;
                        } else {
                            content += `<div class="tooltip-content">No commands found</div>`;
                        }
                    }

                    // Create tooltip element
                    tooltipElement = document.createElement('div');
                    tooltipElement.className = 'enhanced-tooltip';
                    tooltipElement.innerHTML = content;

                    // Get positioning info BEFORE adding to DOM
                    const rect = button.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                    // Validate positioning values
                    if (rect.width === 0 || rect.height === 0) {
                        console.warn('Invalid button rect for tooltip positioning');
                        cleanupTooltip();
                        return;
                    }

                    // Initial positioning (off-screen to measure)
                    tooltipElement.style.position = 'absolute';
                    tooltipElement.style.left = '-9999px';
                    tooltipElement.style.top = '-9999px';
                    tooltipElement.style.zIndex = '10000';
                    tooltipElement.style.visibility = 'hidden';

                    document.body.appendChild(tooltipElement);

                    // Get tooltip dimensions
                    const tooltipRect = tooltipElement.getBoundingClientRect();

                    // Calculate desired position
                    let left = rect.left + scrollLeft + rect.width / 2 - tooltipRect.width / 2;
                    let top = rect.bottom + scrollTop + 8;

                    // Adjust horizontal position if tooltip goes off screen
                    if (left < 10) {
                        left = 10 + scrollLeft;
                    } else if (left + tooltipRect.width > window.innerWidth - 10) {
                        left = window.innerWidth - tooltipRect.width - 10 + scrollLeft;
                    }

                    // Adjust vertical position if tooltip goes below viewport
                    if (top + tooltipRect.height > window.innerHeight + scrollTop - 10) {
                        top = rect.top + scrollTop - tooltipRect.height - 8;
                    }

                    // Ensure tooltip doesn't go above viewport
                    if (top < scrollTop + 10) {
                        top = rect.bottom + scrollTop + 8; // Default to below
                    }

                    // Apply final positioning
                    tooltipElement.style.left = `${left}px`;
                    tooltipElement.style.top = `${top}px`;
                    tooltipElement.style.visibility = 'visible';
                    tooltipElement.style.transform = 'none';

                    // Add event listeners to keep tooltip visible when hovering over it
                    tooltipElement.addEventListener('mouseenter', () => {
                        // Clear any hide timeouts when mouse enters tooltip
                        if (hideTimeout) {
                            clearTimeout(hideTimeout);
                            hideTimeout = null;
                        }
                        // Also clear show timeout to avoid conflicts
                        if (showTimeout) {
                            clearTimeout(showTimeout);
                            showTimeout = null;
                        }
                    });

                    tooltipElement.addEventListener('mouseleave', () => {
                        // Use same delay as button mouseleave for consistency
                        hideTimeout = setTimeout(() => {
                            cleanupTooltip();
                        }, 200);
                    });

                    // Add click handlers for expandable links
                    const expandableLinks = tooltipElement.querySelectorAll('.expandable-link');
                    expandableLinks.forEach(link => {
                        link.style.cursor = 'pointer';
                        link.style.color = 'var(--primary-color)';
                        link.style.textDecoration = 'underline';

                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const type = link.dataset.type;
                            const fullList = link.dataset.fullList.split(',');

                            // Replace the abbreviated list with the full list using multi-column layout for large lists
                            if (type === 'categories') {
                                const newContent = createMultiColumnContent('Member of categories:', fullList, '@');
                                link.parentNode.innerHTML = newContent;
                            } else if (type === 'commands') {
                                const newContent = createMultiColumnContent(`Contains ${fullList.length} commands:`, fullList);
                                link.parentNode.innerHTML = newContent;
                            }

                            // Mark tooltip as expanded for larger sizing
                            tooltipElement.classList.add('expanded');
                        });
                    });

                } catch (error) {
                    console.warn('Failed to load enhanced tooltip:', error);
                    cleanupTooltip();
                }
            }, 1000); // 1-second delay
        };

        const hideTooltip = () => {
            // Add a small delay to allow moving mouse to tooltip
            hideTimeout = setTimeout(() => {
                cleanupTooltip();
            }, 200); // 200ms delay
        };

        // Add event listeners
        button.addEventListener('mouseenter', showTooltip);
        button.addEventListener('mouseleave', hideTooltip);

        // CRITICAL: Hide tooltip when button is clicked
        button.addEventListener('click', cleanupTooltip);

        // Hide tooltip when button loses focus
        button.addEventListener('blur', cleanupTooltip);

        // Hide tooltip on scroll (prevents positioning issues)
        window.addEventListener('scroll', cleanupTooltip, { passive: true });

        // Hide tooltip on window resize
        window.addEventListener('resize', cleanupTooltip, { passive: true });
    }
};

export default ACLUIRenderer;
