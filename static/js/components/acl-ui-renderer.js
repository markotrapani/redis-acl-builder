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
        const fragment = document.createDocumentFragment();

        // Add title
        fragment.appendChild(document.createTextNode(title));

        // Use single column for small lists
        if (itemCount <= 12) {
            fragment.appendChild(document.createElement('br'));
            items.forEach((item, index) => {
                fragment.appendChild(document.createTextNode(`• ${prefix}${item}`));
                if (index < items.length - 1) {
                    fragment.appendChild(document.createElement('br'));
                }
            });
            return fragment;
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

        // Build DOM with grid layout
        const columnsContainer = document.createElement('div');
        columnsContainer.className = `tooltip-columns cols-${columns}`;

        columnData.forEach(columnItems => {
            const columnDiv = document.createElement('div');
            columnDiv.className = 'tooltip-column';

            const ul = document.createElement('ul');
            columnItems.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${prefix}${item}`;
                ul.appendChild(li);
            });

            columnDiv.appendChild(ul);
            columnsContainer.appendChild(columnDiv);
        });

        fragment.appendChild(columnsContainer);
        return fragment;
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
        const { API, AppState, getCategoryCommandsCached, createMultiColumnContent, lastApiResponse } = dependencies;

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
                    // For categories, add (X/Y) count showing granted/blocked commands
                    let titleText = `${type === 'category' ? '@' : ''}${name}`;

                    if (type === 'category') {
                        // Get all commands for this category
                        const categoryCommands = await getCategoryCommandsCached(name);
                        if (categoryCommands && categoryCommands.length > 0) {
                            const totalCount = categoryCommands.length;

                            // If no API response (empty rule), all commands are blocked (0 granted)
                            if (!lastApiResponse) {
                                if (isInGrantedColumn) {
                                    titleText += ` (0/${totalCount})`;
                                } else if (isInBlockedColumn) {
                                    titleText += ` (${totalCount}/${totalCount})`;
                                }
                            } else {
                                const grantedCommands = new Set(lastApiResponse.granted_commands || []);
                                const blockedCommands = new Set(lastApiResponse.blocked_commands || []);

                                // Count how many commands in this category are granted/blocked
                                const grantedCount = categoryCommands.filter(cmd => grantedCommands.has(cmd)).length;
                                const blockedCount = categoryCommands.filter(cmd => blockedCommands.has(cmd)).length;

                                // Show count based on which column we're in
                                if (isInGrantedColumn) {
                                    titleText += ` (${grantedCount}/${totalCount})`;
                                } else if (isInBlockedColumn) {
                                    titleText += ` (${blockedCount}/${totalCount})`;
                                }
                            }
                        }
                    }

                    // Create tooltip element and build content with DOM
                    tooltipElement = document.createElement('div');
                    tooltipElement.className = 'enhanced-tooltip';

                    // Add title
                    const titleDiv = document.createElement('div');
                    titleDiv.className = titleClass;
                    titleDiv.textContent = titleText;
                    tooltipElement.appendChild(titleDiv);

                    // Add state information if available
                    if (stateInfo) {
                        const stateDiv = document.createElement('div');
                        stateDiv.className = 'tooltip-state';
                        // Replace newlines with <br> elements
                        const lines = stateInfo.split('\n');
                        lines.forEach((line, index) => {
                            stateDiv.appendChild(document.createTextNode(line));
                            if (index < lines.length - 1) {
                                stateDiv.appendChild(document.createElement('br'));
                            }
                        });
                        tooltipElement.appendChild(stateDiv);
                    }

                    // Add relationship information
                    if (type === 'command') {
                        // Get categories for this command
                        const response = await API.getCommandInfo(name, AppState.currentVersion);
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'tooltip-content';

                        if (response.success && response.categories && response.categories.length > 0) {
                            const categories = response.categories.sort();
                            const displayCategories = categories.slice(0, 8);
                            const remaining = categories.length - displayCategories.length;

                            contentDiv.appendChild(document.createTextNode('Member of categories:'));
                            contentDiv.appendChild(document.createElement('br'));

                            displayCategories.forEach((cat, index) => {
                                contentDiv.appendChild(document.createTextNode(`• @${cat}`));
                                if (index < displayCategories.length - 1 || remaining > 0) {
                                    contentDiv.appendChild(document.createElement('br'));
                                }
                            });

                            if (remaining > 0) {
                                contentDiv.appendChild(document.createTextNode('• '));
                                const linkColorClass = isInGrantedColumn ? 'granted' : (isInBlockedColumn ? 'blocked' : '');
                                const expandLink = document.createElement('span');
                                expandLink.className = `expandable-link ${linkColorClass}`;
                                expandLink.dataset.type = 'categories';
                                expandLink.dataset.fullList = categories.join(',');
                                expandLink.dataset.showing = displayCategories.length.toString();
                                expandLink.textContent = `... and ${remaining} more`;
                                contentDiv.appendChild(expandLink);
                            }
                        } else {
                            contentDiv.textContent = 'No category information available';
                        }

                        tooltipElement.appendChild(contentDiv);
                    } else if (type === 'category') {
                        // Get commands for this category
                        const commands = await getCategoryCommandsCached(name);
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'tooltip-content';

                        if (commands && commands.length > 0) {
                            const sortedCommands = commands.sort();
                            const displayCommands = sortedCommands.slice(0, 8);
                            const remaining = sortedCommands.length - displayCommands.length;

                            contentDiv.appendChild(document.createTextNode(`Contains ${sortedCommands.length} commands:`));
                            contentDiv.appendChild(document.createElement('br'));

                            displayCommands.forEach((cmd, index) => {
                                contentDiv.appendChild(document.createTextNode(`• ${cmd}`));
                                if (index < displayCommands.length - 1 || remaining > 0) {
                                    contentDiv.appendChild(document.createElement('br'));
                                }
                            });

                            if (remaining > 0) {
                                contentDiv.appendChild(document.createTextNode('• '));
                                const linkColorClass = isInGrantedColumn ? 'granted' : (isInBlockedColumn ? 'blocked' : '');
                                const expandLink = document.createElement('span');
                                expandLink.className = `expandable-link ${linkColorClass}`;
                                expandLink.dataset.type = 'commands';
                                expandLink.dataset.fullList = sortedCommands.join(',');
                                expandLink.dataset.showing = displayCommands.length.toString();
                                expandLink.textContent = `... and ${remaining} more`;
                                contentDiv.appendChild(expandLink);
                            }
                        } else {
                            contentDiv.textContent = 'No commands found';
                        }

                        tooltipElement.appendChild(contentDiv);
                    }

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
                                link.parentNode.textContent = '';
                                link.parentNode.appendChild(newContent);
                            } else if (type === 'commands') {
                                const newContent = createMultiColumnContent(`Contains ${fullList.length} commands:`, fullList);
                                link.parentNode.textContent = '';
                                link.parentNode.appendChild(newContent);
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
    },

    /**
     * Create a category button element with complex state logic
     * @param {string} category - Category name
     * @param {string} buttonState - Button state ('granted', 'available', 'blocked')
     * @param {Object|null} categoryAnalysis - Category analysis state
     * @param {string|null} blockType - Type of block
     * @param {Object} state - ACL builder state
     * @param {Object} handlers - Event handler functions
     * @param {Function} addEnhancedTooltip - Tooltip addition function
     * @returns {Promise<HTMLButtonElement>} Category button element
     */
    async createCategoryButton(category, buttonState, categoryAnalysis, blockType, state, handlers, addEnhancedTooltip) {
        const button = document.createElement('button');

        // Add special class for @all category to enable distinctive styling
        const isAllCategory = category === 'all';

        // Determine visual state and styling
        let buttonClass, tooltipText, clickHandler;

        if (buttonState === 'granted') {
            const analysisState = categoryAnalysis?.[category];
            const isExplicitlyGranted = state.grantedCategories.has(category);

            if (analysisState === 'partial') {
                if (isExplicitlyGranted) {
                    // Explicit partial category inclusion (user explicitly granted category but some commands are excluded)
                    buttonClass = `category-button granted partial explicit`;

                    if (category === 'all') {
                        // Special handling for @all - clicking should clear the entire rule
                        // (removing just +@all would leave orphaned blocks like -@admin)
                        tooltipText = `@${category} category (explicitly partial) - Some commands/categories blocked - Click to revoke ALL commands`;
                        clickHandler = () => handlers.clearAllCategory();
                    } else {
                        tooltipText = `@${category} category (explicitly partial) - Some commands in this category are excluded - Click to revoke`;
                        clickHandler = () => handlers.toggleCategory(category);
                    }
                } else {
                    // Implicit partial category inclusion (some commands granted individually)
                    buttonClass = `category-button granted partial implicit`;

                    if (category === 'all') {
                        // Special handling for @all - clicking should clear the entire rule to revoke all commands
                        tooltipText = `@${category} category (implicitly partial) - Some commands currently granted - Click to revoke ALL commands`;
                        clickHandler = () => handlers.clearAllCategory();
                    } else {
                        // Check if this is a partially explicitly blocked category showing in granted panel
                        if (state.blockedCategories.has(category)) {
                            tooltipText = `@${category} category (partially implicitly granted) - Category blocked but some commands granted back - Click to remove granted commands`;
                            clickHandler = () => handlers.removePartialGrantsFromBlockedCategory(category);
                        } else {
                            // Category is partially granted through other categories or individual commands
                            // Clicking should block the entire category to revoke those permissions
                            tooltipText = `@${category} category (implicitly partial) - Some commands granted via other categories - Click to block ALL @${category} commands`;
                            clickHandler = () => handlers.blockCategory(category);
                        }
                    }
                }
            } else if (analysisState === 'fully-granted' && !state.grantedCategories.has(category)) {
                // Implicitly granted (all commands granted individually)
                buttonClass = `category-button granted implicit`;
                tooltipText = `@${category} category (implicitly granted) - All commands granted individually - Click to remove all individual commands`;
                clickHandler = () => handlers.removeAllCategoryCommands(category);
            } else {
                // Check if this category is granted via @all (implicitly) or explicitly granted
                const isGrantedViaAll = state.grantedCategories.has('all') && !state.grantedCategories.has(category);

                if (isGrantedViaAll) {
                    // Check if this category has conflicting individual commands that make it partial
                    const hasConflictingCommands = await handlers.hasConflictingIndividualCommands(category);

                    if (hasConflictingCommands) {
                        // Category granted via @all but has conflicting individual commands
                        buttonClass = `category-button granted partial implicit`;
                        tooltipText = `@${category} category (partially granted via @all) - Has conflicting individual commands - Click to remove conflicting commands`;
                        clickHandler = () => handlers.removeConflictingIndividualCommands(category);

                    } else {
                        // Cleanly granted via @all
                        buttonClass = `category-button granted implicit`;
                        tooltipText = `@${category} category (granted via @all) - Click to block`;
                        clickHandler = () => handlers.blockCategory(category);

                    }
                } else {
                    // Explicitly granted
                    buttonClass = `category-button granted explicit`;
                    tooltipText = `@${category} category (explicitly granted) - Click to revoke`;
                    clickHandler = () => handlers.toggleCategory(category);
                }
            }
        } else if (buttonState === 'available') {
            buttonClass = `category-button blocked implicit`; // Available = implicitly blocked (not granted)
            tooltipText = `Click to grant @${category} category`;
            clickHandler = () => handlers.grantCategory(category);
        } else if (buttonState === 'blocked') {
            // Determine if explicitly, partially, or implicitly blocked
            const analysisState = categoryAnalysis?.[category];

            if (analysisState === 'partially-explicitly-blocked') {
                // Partially explicitly blocked (category blocked but some commands granted back)
                buttonClass = `category-button blocked partial explicit`;
                tooltipText = `@${category} category (partially explicitly blocked) - Category blocked but some commands granted back - Click to grant full category`;
                clickHandler = () => handlers.grantCategoryAndRemoveConflictingCommands(category);
            } else if (blockType === 'explicit-full' || (blockType === 'explicit' && state.blockedCategories.has(category))) {
                buttonClass = `category-button blocked explicit`;
                tooltipText = `@${category} category (explicitly blocked) - Click to toggle`;
                clickHandler = () => handlers.toggleCategory(category);
            } else if (blockType === 'implicit-partial' || blockType === 'partial') {
                // Implicitly partially blocked category (some commands blocked individually)
                // Use hollow yellow/orange styling with warning icon
                buttonClass = `category-button blocked partial implicit`;

                if (category === 'all') {
                    // Special handling for @all - two scenarios:
                    // 1. "+@all -@admin" (explicitly granted, some blocked) -> remove blocks
                    // 2. "+@admin" (implicitly partial) -> grant @all
                    const isAllExplicitlyGranted = state.grantedCategories.has('all');

                    if (isAllExplicitlyGranted) {
                        // Case 1: @all is explicitly granted but has blocks
                        tooltipText = `@${category} category (partially blocked) - Some commands/categories currently blocked - Click to remove all blocks and grant full @all access`;
                        clickHandler = () => handlers.removeAllBlocksForAllCategory();
                    } else {
                        // Case 2: @all is implicitly partially blocked (some other categories/commands granted)
                        tooltipText = `@${category} category (partially blocked) - Some commands currently granted - Click to grant full @all access`;
                        clickHandler = () => handlers.grantAllCategory();
                    }
                } else {
                    tooltipText = `@${category} category (partially blocked) - Some commands blocked individually - Click to grant full category`;
                    clickHandler = () => handlers.grantCategoryAndCleanup(category);
                }
            } else {
                buttonClass = `category-button blocked implicit`;
                tooltipText = `@${category} category (implicitly blocked) - Click to grant`;
                clickHandler = () => handlers.toggleCategory(category);
            }
        } else {
            buttonClass = `category-button ${buttonState}`;
            tooltipText = `Click to ${buttonState === 'granted' ? 'revoke' : 'grant'} @${category} category`;
            clickHandler = () => handlers.toggleCategory(category);
        }

        button.className = buttonClass;

        // Add special class for @all category to enable distinctive styling
        if (isAllCategory) {
            button.classList.add('all-category');
        }

        // Add visual debug indicator for partial categories
        button.textContent = '';
        if (buttonClass.includes('partial')) {
            const content = DOMUtils.createCategoryButtonContent(category, true);
            button.appendChild(content);
        } else {
            button.textContent = `@${category}`;
        }
        button.dataset.stateInfo = tooltipText;

        button.onclick = clickHandler;

        // Add enhanced tooltip on hover
        addEnhancedTooltip(button, 'category', category);

        return button;
    }
};

export default ACLUIRenderer;
