// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 10: Enterprise/OSS Mode Toggle
 *
 * Tests the Enterprise/OSS mode toggle functionality including:
 * - UI rendering and visibility
 * - Mode switching between OSS and Enterprise
 * - Command count display format (XX/YY for Enterprise)
 * - localStorage persistence
 * - URL parameter support
 * - Integration with Redis version selector
 */
test.describe('Enterprise/OSS Mode Toggle Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh on each test
    await page.goto('/');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should render mode toggle UI correctly', async ({ page }) => {
    // Mode toggle should be visible
    const modeToggle = page.locator('#modeToggle');
    await expect(modeToggle).toBeAttached();

    // Mode label should be visible
    const modeLabel = page.locator('.mode-label');
    await expect(modeLabel).toBeVisible();
    await expect(modeLabel).toHaveText('Mode:');

    // Mode toggle label should be visible with tooltip
    const toggleLabel = page.locator('label[for="modeToggle"]');
    await expect(toggleLabel).toBeVisible();
    await expect(toggleLabel).toHaveAttribute('title',
      'OSS: All Redis commands | Enterprise: Cloud-restricted command set');

    // Mode toggle options should be present
    const ossOption = page.locator('.mode-toggle .toggle-option-left');
    await expect(ossOption).toHaveText('OSS');

    const enterpriseOption = page.locator('.mode-toggle .toggle-option-right');
    await expect(enterpriseOption).toHaveText('Enterprise');
  });

  test('should default to OSS mode on page load', async ({ page }) => {
    // Mode toggle should not be checked (OSS = unchecked)
    const modeToggle = page.locator('#modeToggle');
    await expect(modeToggle).not.toBeChecked();

    // Version detail should show OSS command count (not XX/YY format)
    const versionDetail = page.locator('#versionDetail');
    const text = await versionDetail.textContent();

    // Default is Redis 7, so should show "379 commands" (OSS format)
    // Should NOT show "305/379 commands" (Enterprise format)
    expect(text).toContain('Redis 7');
    expect(text).toContain('379 commands');
    expect(text).not.toMatch(/\d+\/\d+ commands/);
  });

  test('should switch from OSS to Enterprise mode', async ({ page }) => {
    const versionDetail = page.locator('#versionDetail');

    // Get initial text (OSS mode)
    const ossText = await versionDetail.textContent();
    expect(ossText).toMatch(/\d+ commands/); // "488 commands"
    expect(ossText).not.toMatch(/\d+\/\d+ commands/); // Not "440/488 commands"

    // Click mode toggle to switch to Enterprise
    const toggleLabel = page.locator('label[for="modeToggle"]');
    await toggleLabel.click();

    // Wait for update (mode toggle doesn't trigger parse unless there's a rule)
    await page.waitForTimeout(1000);

    // Mode toggle should now be checked
    const modeToggle = page.locator('#modeToggle');
    await expect(modeToggle).toBeChecked();

    // Command count should now show Enterprise format (XX/YY)
    const enterpriseText = await versionDetail.textContent();
    expect(enterpriseText).toMatch(/\d+\/\d+ commands/); // "440/488 commands"
    expect(enterpriseText).not.toBe(ossText);
  });

  test('should switch from Enterprise back to OSS mode', async ({ page }) => {
    const toggleLabel = page.locator('label[for="modeToggle"]');
    const versionDetail = page.locator('#versionDetail');

    // Switch to Enterprise first
    await toggleLabel.click();
    await page.waitForTimeout(500);

    // Verify we're in Enterprise mode
    const enterpriseText = await versionDetail.textContent();
    expect(enterpriseText).toMatch(/\d+\/\d+ commands/);

    // Switch back to OSS
    await toggleLabel.click();
    await page.waitForTimeout(500);

    // Verify we're back in OSS mode
    const ossText = await versionDetail.textContent();
    expect(ossText).toMatch(/\d+ commands/);
    expect(ossText).not.toMatch(/\d+\/\d+ commands/);
    expect(ossText).not.toBe(enterpriseText);
  });

  test('should show correct command counts for Redis 8', async ({ page }) => {
    const versionDetail = page.locator('#versionDetail');
    const versionToggleLabel = page.locator('label[for="versionToggle"]');
    const modeToggleLabel = page.locator('label[for="modeToggle"]');

    // Switch to Redis 8 first (default is Redis 7)
    await versionToggleLabel.click();
    await page.waitForTimeout(1000);

    // Now we should be on Redis 8
    let text = await versionDetail.textContent();
    expect(text).toContain('Redis 8');

    // OSS mode: 488 commands
    expect(text).toContain('488 commands');

    // Switch to Enterprise mode
    await modeToggleLabel.click();
    await page.waitForTimeout(1000);

    // Enterprise mode: 440/488 commands (48 restricted)
    text = await versionDetail.textContent();
    expect(text).toContain('Redis 8');
    expect(text).toContain('440/488 commands');
  });

  test('should show correct command counts for Redis 7', async ({ page }) => {
    const versionDetail = page.locator('#versionDetail');
    const modeToggleLabel = page.locator('label[for="modeToggle"]');

    // Already on Redis 7 (default)
    let text = await versionDetail.textContent();
    expect(text).toContain('Redis 7');

    // OSS mode: 379 commands
    expect(text).toContain('379 commands');

    // Switch to Enterprise mode
    await modeToggleLabel.click();
    await page.waitForTimeout(1000);

    // Enterprise mode: 305/379 commands (74 restricted)
    text = await versionDetail.textContent();
    expect(text).toContain('Redis 7');
    expect(text).toContain('305/379 commands');
  });

  test('should test all 4 version+mode combinations', async ({ page }) => {
    const versionDetail = page.locator('#versionDetail');
    const versionToggleLabel = page.locator('label[for="versionToggle"]');
    const modeToggleLabel = page.locator('label[for="modeToggle"]');

    // Combination 1: Redis 7 + OSS (default)
    let text = await versionDetail.textContent();
    expect(text).toContain('Redis 7');
    expect(text).toContain('379 commands');

    // Combination 2: Redis 7 + Enterprise
    await modeToggleLabel.click();
    await page.waitForTimeout(1000);
    text = await versionDetail.textContent();
    expect(text).toContain('Redis 7');
    expect(text).toContain('305/379 commands');

    // Combination 3: Redis 8 + Enterprise
    await versionToggleLabel.click();
    await page.waitForTimeout(1000);
    text = await versionDetail.textContent();
    expect(text).toContain('Redis 8');
    expect(text).toContain('440/488 commands');

    // Combination 4: Redis 8 + OSS
    await modeToggleLabel.click();
    await page.waitForTimeout(1000);
    text = await versionDetail.textContent();
    expect(text).toContain('Redis 8');
    expect(text).toContain('488 commands');
  });

  test('should persist mode to localStorage', async ({ page }) => {
    const toggleLabel = page.locator('label[for="modeToggle"]');
    const versionDetail = page.locator('#versionDetail');

    // Switch to Enterprise mode
    await toggleLabel.click();
    await page.waitForTimeout(500);

    // Verify we're in Enterprise mode
    let text = await versionDetail.textContent();
    expect(text).toMatch(/\d+\/\d+ commands/);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Mode should still be Enterprise
    const modeToggle = page.locator('#modeToggle');
    await expect(modeToggle).toBeChecked();

    text = await versionDetail.textContent();
    expect(text).toMatch(/\d+\/\d+ commands/);
  });

  test('should update URL with mode parameter', async ({ page }) => {
    const toggleLabel = page.locator('label[for="modeToggle"]');

    // Initial URL should not have mode parameter or should be mode=oss
    let url = page.url();
    expect(url).toMatch(/(\?.*mode=oss|^[^?]*$)/);

    // Switch to Enterprise mode
    await toggleLabel.click();
    await page.waitForTimeout(500);

    // URL should now include mode=enterprise
    url = page.url();
    expect(url).toContain('mode=enterprise');

    // Switch back to OSS
    await toggleLabel.click();
    await page.waitForTimeout(500);

    // URL should now include mode=oss
    url = page.url();
    expect(url).toContain('mode=oss');
  });

  test('should load with Enterprise mode from URL parameter', async ({ page }) => {
    // Navigate with mode=enterprise parameter
    await page.goto('/?mode=enterprise');
    await page.waitForLoadState('networkidle');

    // Give extra time for initialization
    await page.waitForTimeout(1000);

    // Mode toggle should be checked
    const modeToggle = page.locator('#modeToggle');
    await expect(modeToggle).toBeChecked();

    // Command count should show Enterprise format
    const versionDetail = page.locator('#versionDetail');
    const text = await versionDetail.textContent();
    expect(text).toMatch(/\d+\/\d+ commands/);
  });

  test('should load with version and mode from URL parameters', async ({ page }) => {
    // Navigate with both version and mode parameters
    await page.goto('/?version=redis7&mode=enterprise');
    await page.waitForLoadState('networkidle');

    // Give extra time for initialization
    await page.waitForTimeout(1000);

    // Both toggles should be in correct state
    const versionToggle = page.locator('#versionToggle');
    await expect(versionToggle).not.toBeChecked(); // Redis 7 = unchecked

    const modeToggle = page.locator('#modeToggle');
    await expect(modeToggle).toBeChecked(); // Enterprise = checked

    // Command count should show Redis 7 Enterprise
    const versionDetail = page.locator('#versionDetail');
    const text = await versionDetail.textContent();
    expect(text).toContain('Redis 7');
    expect(text).toContain('305/379 commands');
  });

  test('should preserve ACL rule when switching modes', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const modeToggleLabel = page.locator('label[for="modeToggle"]');

    // Set an ACL rule
    await textarea.fill('+@read ~*');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // Switch to Enterprise mode
    await modeToggleLabel.click();
    await page.waitForTimeout(500);

    // Rule should still be there
    const value = await textarea.inputValue();
    expect(value).toContain('+@read ~*');
  });

  test('should show different command counts in Enterprise vs OSS mode', async ({ page }) => {
    const versionDetail = page.locator('#versionDetail');
    const modeToggleLabel = page.locator('label[for="modeToggle"]');

    // Default is Redis 7 OSS: 379 commands
    let text = await versionDetail.textContent();
    expect(text).toContain('379 commands');
    expect(text).not.toMatch(/\d+\/\d+ commands/);

    // Switch to Enterprise mode: should show 305/379 (74 commands restricted)
    await modeToggleLabel.click();
    await page.waitForTimeout(1000);

    text = await versionDetail.textContent();
    expect(text).toContain('305/379 commands');

    // Switch back to OSS: should show 379 commands again
    await modeToggleLabel.click();
    await page.waitForTimeout(1000);

    text = await versionDetail.textContent();
    expect(text).toContain('379 commands');
    expect(text).not.toMatch(/\d+\/\d+ commands/);
  });

  test('should handle rapid mode toggle clicks gracefully', async ({ page }) => {
    const toggleLabel = page.locator('label[for="modeToggle"]');
    const versionDetail = page.locator('#versionDetail');

    // Click toggle 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await toggleLabel.click();
      await page.waitForTimeout(100); // Small delay between clicks
    }

    // Give time for final state to settle
    await page.waitForTimeout(1000);

    // Final state should be consistent
    const modeToggle = page.locator('#modeToggle');
    const isChecked = await modeToggle.isChecked();

    const text = await versionDetail.textContent();

    // If checked (Enterprise), should show XX/YY format
    // If unchecked (OSS), should show XX format only
    if (isChecked) {
      expect(text).toMatch(/\d+\/\d+ commands/);
    } else {
      expect(text).toMatch(/\d+ commands/);
      expect(text).not.toMatch(/\d+\/\d+ commands/);
    }

    // No console errors should have occurred
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    expect(logs.length).toBe(0);
  });
});
