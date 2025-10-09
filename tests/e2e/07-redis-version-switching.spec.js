// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 7: Redis Version Switching
 *
 * Tests switching between Redis 7 and Redis 8 versions.
 */
test.describe('Redis Version Switching Tests', () => {
  test('should switch from Redis 7 to Redis 8', async ({ page }) => {
    await page.goto('/');

    // Find version detail display (not the toggle itself)
    const versionDetail = page.locator('#versionDetail');
    await expect(versionDetail).toBeVisible();

    // Get initial version - should be Redis 7 by default
    const initialText = await versionDetail.textContent();
    expect(initialText).toContain('Redis 7');

    // Click the toggle label to switch (checkbox itself is visually hidden)
    const versionToggleLabel = page.locator('label[for="versionToggle"]');
    await versionToggleLabel.click();

    // Wait for version to update
    await page.waitForTimeout(1000);

    // Text should have changed to Redis 8
    const newText = await versionDetail.textContent();
    expect(newText).toContain('Redis 8');
    expect(newText).not.toBe(initialText);
  });

  test('should preserve ACL rule when switching versions', async ({ page }) => {
    await page.goto('/');

    // Set an ACL rule
    const textarea = page.locator('#aclRule');
    await textarea.fill('+@read');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // Switch version using the toggle label
    const versionToggleLabel = page.locator('label[for="versionToggle"]');
    await versionToggleLabel.click();
    await page.waitForTimeout(1000);

    // Rule should still be there
    const value = await textarea.inputValue();
    expect(value).toContain('@read');
  });

  test('should show different command counts for different versions', async ({ page }) => {
    await page.goto('/');

    // Get command count for Redis 7
    const versionDetail = page.locator('#versionDetail');
    const version7Text = await versionDetail.textContent();
    expect(version7Text).toContain('Redis 7');
    expect(version7Text).toContain('311 commands');

    // Switch to Redis 8 using the toggle label
    const versionToggleLabel = page.locator('label[for="versionToggle"]');
    await versionToggleLabel.click();
    await page.waitForTimeout(1000);

    // Check version changed
    const version8Text = await versionDetail.textContent();
    expect(version8Text).toContain('Redis 8');
    expect(version8Text).toContain('446 commands');
    expect(version8Text).not.toBe(version7Text);
  });
});
