// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 9: Complete User Flow
 *
 * Integration test covering the complete user journey through the application.
 */
test.describe('Complete User Flow Tests', () => {
  test('should complete full ACL building workflow', async ({ page }) => {
    await page.goto('/');

    // Ensure integrated tester mode
    await page.evaluate(() => {
      localStorage.setItem('testerMode', 'integrated');
    });
    await page.reload();

    // Step 1: Load page
    await expect(page).toHaveTitle(/Redis Enterprise ACL Builder/);

    // Step 2: Wait for interactive builder to load, then click a category to grant it
    const blockedColumn = page.locator('#blockedCategories');
    await expect(blockedColumn.locator('button').first()).toBeVisible({ timeout: 5000 });

    const readBtn = blockedColumn.locator('button').filter({ hasText: '@read' }).first();
    await readBtn.click();

    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // Step 3: Verify it's in granted column
    const grantedColumn = page.locator('#grantedCategories');
    await expect(grantedColumn).toContainText('@read');

    // Step 4: Verify textarea updated
    const textarea = page.locator('#aclRule');
    let value = await textarea.inputValue();
    expect(value).toContain('@read');

    // Step 5: Test a command in integrated mode
    const commandInput = page.locator('#integratedCommand');
    const keyInput = page.locator('#integratedKey');

    await commandInput.fill('GET');
    await keyInput.fill('test:key');

    const testBtn = page.locator('button.integrated-test-button');
    await expect(testBtn).toBeEnabled();
    await testBtn.click();

    await page.waitForResponse(response =>
      response.url().includes('/api/test-command-key') && response.status() === 200
    );

    // Step 6: Verify command test result
    const result = page.locator('#integratedTestResult');
    await expect(result).toContainText(/granted|allowed|✅/i, { timeout: 5000 });

    // Step 7: Add a key pattern manually
    await textarea.fill('+@read ~user:*');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // Step 8: Test keyspace access in integrated mode
    await commandInput.fill('GET');
    await keyInput.fill('user:123');

    await expect(testBtn).toBeEnabled();
    await testBtn.click();

    // Wait for API response (integrated mode)
    await page.waitForResponse(response =>
      response.url().includes('/api/test-command-key') && response.status() === 200
    );

    // Should match the pattern
    await expect(result).toContainText(/granted|allowed|matched|✅/i, { timeout: 5000 });

    // Step 9: Clear the rule
    const clearBtn = page.locator('#clearRuleBtn');
    await expect(clearBtn).not.toBeDisabled();
    await clearBtn.click();

    // Step 10: Verify textarea is empty
    value = await textarea.inputValue();
    expect(value).toBe('');

    // Workflow complete - all critical features working
  });

  test('should handle complex ACL rule building', async ({ page }) => {
    await page.goto('/');

    // Build a complex rule: grant some, block some
    const textarea = page.locator('#aclRule');
    await textarea.fill('+@all -@dangerous -@admin ~user:* ~session:*');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // Verify dangerous category is in blocked column
    const blockedColumn = page.locator('#blockedCategories');
    await expect(blockedColumn).toContainText('@dangerous');

    // Verify other categories are granted
    const grantedColumn = page.locator('#grantedCategories');
    await expect(grantedColumn).toContainText('@read');

    // Test a dangerous command - should be denied
    const commandInput = page.locator('#testCommand');
    await commandInput.fill('FLUSHALL');

    const testBtn = page.locator('button.command-test-button');
    await expect(testBtn).toBeEnabled();
    await testBtn.click();

    await page.waitForResponse(response =>
      response.url().includes('/api/test-command') && response.status() === 200
    );

    const result = page.locator('#testResult');
    await expect(result).toContainText(/denied|blocked|❌/i, { timeout: 5000 });
  });
});
