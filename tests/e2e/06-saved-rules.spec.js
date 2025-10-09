// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 6: Saved Rules
 *
 * Tests saving and loading ACL rules functionality.
 */
test.describe('Saved Rules Tests', () => {
  test('should save custom ACL rule', async ({ page }) => {
    await page.goto('/');

    // Enter a custom ACL rule and SUBMIT it (save button only enables after submission)
    const textarea = page.locator('#aclRule');
    await textarea.fill('+@read +@write');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for API response
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // NOW find save button (💾 emoji) - should be enabled after submission
    const saveBtn = page.locator('#saveRuleBtn');
    await expect(saveBtn).not.toBeDisabled({ timeout: 2000 });
    await saveBtn.click();

    // Wait for save to localStorage
    await page.waitForTimeout(300);

    // Check for saved rules section to become visible
    const savedRulesSection = page.locator('#savedRulesSection');
    await expect(savedRulesSection).toBeVisible({ timeout: 2000 });

    // Saved rule content should be visible
    const savedRulesContent = page.locator('#savedRulesContent');
    await expect(savedRulesContent).toContainText('+@read +@write');
  });

  test('should load preset ACL rule', async ({ page }) => {
    await page.goto('/');

    // Find one of the quick example preset buttons
    const presetBtn = page.locator('button.example').filter({ hasText: '+@read ~*' }).first();
    await expect(presetBtn).toBeVisible();

    // Click the preset
    await presetBtn.click();

    // Wait for the rule to be set and parsed
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // Textarea should have the preset content
    const textarea = page.locator('#aclRule');
    const value = await textarea.inputValue();
    expect(value).toContain('+@read');
    expect(value).toContain('~*');
  });
});
