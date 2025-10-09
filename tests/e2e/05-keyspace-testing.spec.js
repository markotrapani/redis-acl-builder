// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 5: Keyspace Pattern Testing
 *
 * Tests the keyspace pattern tester for validating key permissions.
 */
test.describe('Keyspace Testing Tests', () => {
  test('should test matching key pattern', async ({ page }) => {
    await page.goto('/');

    // Ensure integrated tester mode (in case localStorage has split mode)
    await page.evaluate(() => {
      localStorage.setItem('testerMode', 'integrated');
    });
    await page.reload();

    // Set ACL rule with key pattern
    const textarea = page.locator('#aclRule');
    await textarea.fill('+@all ~user:*');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // In integrated mode, use integrated tester inputs
    const commandInput = page.locator('#integratedCommand');
    const keyInput = page.locator('#integratedKey');

    // Fill in command (needed for integrated test)
    await commandInput.fill('GET');
    await keyInput.fill('user:123');

    // Click integrated test button
    const testBtn = page.locator('button.integrated-test-button');
    await expect(testBtn).toBeEnabled();
    await testBtn.click();

    // Wait for API response (integrated mode calls the backend)
    await page.waitForResponse(response =>
      response.url().includes('/api/test-command-key') && response.status() === 200
    );

    // Should show granted/matched
    const result = page.locator('#integratedTestResult');
    await expect(result).toContainText(/granted|allowed|matched|✅/i, { timeout: 5000 });
  });

  test('should test non-matching key pattern', async ({ page }) => {
    await page.goto('/');

    // Ensure integrated tester mode (in case localStorage has split mode)
    await page.evaluate(() => {
      localStorage.setItem('testerMode', 'integrated');
    });
    await page.reload();

    // Set ACL rule with specific key pattern
    const textarea = page.locator('#aclRule');
    await textarea.fill('+@all ~user:*');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // In integrated mode, use integrated tester inputs
    const commandInput = page.locator('#integratedCommand');
    const keyInput = page.locator('#integratedKey');

    // Fill in command and test a key that doesn't match
    await commandInput.fill('GET');
    await keyInput.fill('product:456');

    // Click integrated test button
    const testBtn = page.locator('button.integrated-test-button');
    await expect(testBtn).toBeEnabled();
    await testBtn.click();

    // Wait for API response (integrated mode calls the backend)
    await page.waitForResponse(response =>
      response.url().includes('/api/test-command-key') && response.status() === 200
    );

    // Should show denied/not matched
    const result = page.locator('#integratedTestResult');
    await expect(result).toContainText(/denied|blocked|❌/i, { timeout: 5000 });
  });
});
