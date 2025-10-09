// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 4: Command Testing
 *
 * Tests the command tester functionality for verifying ACL permissions.
 */
test.describe('Command Testing Tests', () => {
  test('should test allowed command successfully', async ({ page }) => {
    await page.goto('/');

    // Ensure integrated tester mode (in case localStorage has split mode)
    await page.evaluate(() => {
      localStorage.setItem('testerMode', 'integrated');
    });
    await page.reload();

    // Set ACL rule that allows GET
    const textarea = page.locator('#aclRule');
    await textarea.fill('+@read');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for API response
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // In integrated mode, use integrated tester inputs
    const commandInput = page.locator('#integratedCommand');
    const keyInput = page.locator('#integratedKey');

    // Fill in command and key
    await commandInput.fill('GET');
    await keyInput.fill('test:key');

    // Click integrated test button
    const testBtn = page.locator('button.integrated-test-button');
    await expect(testBtn).toBeEnabled();
    await testBtn.click();

    // Wait for test result API call (integrated mode calls /api/test-command-key)
    await page.waitForResponse(
      response => response.url().includes('/api/test-command-key') && response.status() === 200,
      { timeout: 10000 }
    );

    // Should show success (granted)
    const result = page.locator('#integratedTestResult');
    await expect(result).toContainText(/granted|allowed|✅/i, { timeout: 5000 });
  });

  test('should test denied command successfully', async ({ page }) => {
    await page.goto('/');

    // Ensure integrated tester mode (in case localStorage has split mode)
    await page.evaluate(() => {
      localStorage.setItem('testerMode', 'integrated');
    });
    await page.reload();

    // Set ACL rule that blocks SET
    const textarea = page.locator('#aclRule');
    await textarea.fill('+@read');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // In integrated mode, use integrated tester inputs
    const commandInput = page.locator('#integratedCommand');
    const keyInput = page.locator('#integratedKey');

    // Fill in write command and key
    await commandInput.fill('SET');
    await keyInput.fill('test:key');

    const testBtn = page.locator('button.integrated-test-button');
    await expect(testBtn).toBeEnabled();

    // Click and wait for result to appear
    await testBtn.click();

    // Should show denied (wait for result content, not API response)
    const result = page.locator('#integratedTestResult');
    await expect(result).toContainText(/denied|blocked|❌/i, { timeout: 10000 });
  });

  test('should show error for invalid command', async ({ page }) => {
    await page.goto('/');

    // Ensure integrated tester mode (in case localStorage has split mode)
    await page.evaluate(() => {
      localStorage.setItem('testerMode', 'integrated');
    });
    await page.reload();

    // First set up a valid ACL rule so the test has context
    const textarea = page.locator('#aclRule');
    await textarea.fill('+@all');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // In integrated mode, use integrated tester inputs
    const commandInput = page.locator('#integratedCommand');
    const keyInput = page.locator('#integratedKey');

    // Fill in invalid command and a test key
    await commandInput.fill('INVALID_COMMAND_XYZ');
    await keyInput.fill('test:key');

    const testBtn = page.locator('button.integrated-test-button');
    await expect(testBtn).toBeEnabled();
    await testBtn.click();

    // Wait for API response (integrated mode calls backend even for invalid commands)
    await page.waitForTimeout(1000);

    // Should show error or unknown command message
    const result = page.locator('#integratedTestResult');
    await expect(result).toContainText(/unknown|invalid|not found|error/i, { timeout: 5000 });
  });
});
