/**
 * Category Manager
 * Handles category expansion/collapse functionality
 */

const CategoryManager = {
    /**
     * Toggle category visibility
     */
    toggle(category) {
        // Sanitize the category for ID lookup
        const safeCategoryId = category.replace(/[^a-zA-Z0-9]/g, '-');
        const element = document.getElementById(`category-${safeCategoryId}`);
        const header = element?.previousElementSibling;
        
        if (element && header) {
            const isCollapsed = element.classList.contains('collapsed');
            element.classList.toggle('collapsed');
            header.classList.toggle('collapsed', !isCollapsed);
            header.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
        }
    },

    /**
     * Expand all categories
     */
    expandAll() {
        document.querySelectorAll('.category-commands.collapsed').forEach(element => {
            element.classList.remove('collapsed');
            const header = element.previousElementSibling;
            if (header) {
                header.classList.remove('collapsed');
                header.setAttribute('aria-expanded', 'true');
            }
        });
    },

    /**
     * Collapse all categories
     */
    collapseAll() {
        document.querySelectorAll('.category-commands:not(.collapsed)').forEach(element => {
            element.classList.add('collapsed');
            const header = element.previousElementSibling;
            if (header) {
                header.classList.add('collapsed');
                header.setAttribute('aria-expanded', 'false');
            }
        });
    }
};

export default CategoryManager;