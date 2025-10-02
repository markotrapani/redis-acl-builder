/**
 * ACL State Manager
 * Utilities for managing ACL builder state (ordered terms, categories, commands)
 */

const ACLStateManager = {
    /**
     * Remove terms by category from ordered terms array
     */
    removeTermsByCategory(orderedTerms, category, operation = null) {
        return orderedTerms.filter(term => {
            if (term.type !== 'category' || term.value !== category) return true;
            return operation ? term.operation !== operation : false;
        });
    },

    /**
     * Remove terms by command from ordered terms array
     */
    removeTermsByCommand(orderedTerms, command, operation = null) {
        return orderedTerms.filter(term => {
            if (term.type !== 'command' || term.value !== command) return true;
            return operation ? term.operation !== operation : false;
        });
    },

    /**
     * Remove terms by commands array from ordered terms array
     */
    removeTermsByCommands(orderedTerms, commands, operation = null) {
        return orderedTerms.filter(term => {
            if (term.type !== 'command' || !commands.includes(term.value)) return true;
            return operation ? term.operation !== operation : false;
        });
    },

    /**
     * Remove all command and category terms (keep only key patterns)
     */
    removeAllCommandAndCategoryTerms(orderedTerms) {
        return orderedTerms.filter(term =>
            !(term.type === 'category' || term.type === 'command')
        );
    },

    /**
     * Toggle category state between granted and blocked
     */
    toggleCategoryState(state, category, operation) {
        if (operation === 'grant') {
            state.grantedCategories.add(category);
            state.blockedCategories.delete(category);
        } else if (operation === 'block') {
            state.blockedCategories.add(category);
            state.grantedCategories.delete(category);
        }
    },

    /**
     * Toggle command state between granted and blocked
     */
    toggleCommandState(state, command, operation) {
        if (operation === 'grant') {
            state.grantedCommands.add(command);
            state.blockedCommands.delete(command);
        } else if (operation === 'block') {
            state.blockedCommands.add(command);
            state.grantedCommands.delete(command);
        }
    },

    /**
     * Add term to ordered terms if not already present
     */
    addTerm(orderedTerms, type, operation, value) {
        const existingIndex = orderedTerms.findIndex(term =>
            term.type === type && term.operation === operation && term.value === value
        );

        if (existingIndex === -1) {
            orderedTerms.push({ type, operation, value });
        }
    }
};

export default ACLStateManager;
