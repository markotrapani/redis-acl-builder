/**
 * Test script for three-column layout functionality
 * Run this in browser console to test the interactive features
 */

function testThreeColumnLayout() {
    console.log('🧪 Testing Three-Column Layout Functionality...');
    
    // Check if elements exist
    const elements = {
        grantedCategoriesButtons: document.querySelector('#grantedCategories .category-buttons'),
        grantedCommandsButtons: document.querySelector('#grantedCommands .command-buttons'),
        blockedCategoriesButtons: document.querySelector('#blockedCategories .category-buttons'),
        blockedCommandsButtons: document.querySelector('#blockedCommands .command-buttons'),
        ruleStats: document.getElementById('ruleStats'),
        aclRuleInput: document.getElementById('aclRule')
    };
    
    let passed = 0;
    let total = 0;
    
    function test(name, condition) {
        total++;
        if (condition) {
            console.log(`✅ ${name}`);
            passed++;
        } else {
            console.log(`❌ ${name}`);
        }
    }
    
    // Test 1: DOM elements exist
    test('All required DOM elements exist', 
        Object.values(elements).every(el => el !== null));
    
    // Test 2: Interactive ACL Builder is initialized
    test('InteractiveACLBuilder is available', 
        typeof window.InteractiveACLBuilder !== 'undefined' || 
        typeof InteractiveACLBuilder !== 'undefined');
    
    // Test 3: Empty rule shows correct state
    test('Empty rule input shows empty value', 
        elements.aclRuleInput.value === '');
    
    
    // Test 5: Interactive builder state is accessible
    let builder = null;
    try {
        // Try to access the builder instance
        builder = window.InteractiveACLBuilder || InteractiveACLBuilder;
        test('InteractiveACLBuilder state is accessible', 
            builder && builder.state);
    } catch(e) {
        test('InteractiveACLBuilder state is accessible', false);
    }
    
    // Test 6: Check if categories are loaded
    if (builder && builder.state) {
        test('Categories are loaded', 
            builder.state.allCategories && builder.state.allCategories.length > 0);
        
        // Test 7: Default state is secure (nothing granted)
        test('Default state is secure (no categories granted)', 
            builder.state.grantedCategories.size === 0);
        
        test('Default state is secure (no commands granted)', 
            builder.state.grantedCommands.size === 0);
    }
    
    // Test 8: Check if buttons are clickable
    const categoryButtons = document.querySelectorAll('.category-button');
    test('Category buttons exist and are clickable', 
        categoryButtons.length > 0 && 
        Array.from(categoryButtons).every(btn => typeof btn.onclick === 'function'));
    
    console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All tests passed! Three-column layout is working correctly.');
        return true;
    } else {
        console.log('⚠️  Some tests failed. Check the console for details.');
        return false;
    }
}

// Auto-run test when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testThreeColumnLayout);
} else {
    // If already loaded, run immediately
    setTimeout(testThreeColumnLayout, 1000); // Give time for JS to initialize
}

// Also make it available globally for manual testing
window.testThreeColumnLayout = testThreeColumnLayout;