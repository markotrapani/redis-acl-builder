// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 2: ACL Rule Editing
 *
 * Tests the core functionality of editing and submitting ACL rules.
 */
test.describe('ACL Rule Editing Tests', () => {
  test('should edit ACL rule in textarea', async ({ page }) => {
    await page.goto('/');

    const textarea = page.locator('#aclRule');

    // Type a simple ACL rule
    await textarea.fill('+@read -@write');

    // Check that the value was set
    await expect(textarea).toHaveValue('+@read -@write');
  });

  test('should show Submit Changes button when editing', async ({ page }) => {
    await page.goto('/');

    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');

    // Type in textarea
    await textarea.fill('+@all');

    // Submit button should appear (it has display: none by default)
    await expect(submitBtn).toBeVisible();
  });

  test('should update columns when submitting valid ACL rule', async ({ page }) => {
    await page.goto('/');

    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');

    // Enter a simple ACL rule
    await textarea.fill('+@read');

    // Wait for submit button to appear
    await expect(submitBtn).toBeVisible();

    // Click submit
    await submitBtn.click();

    // Wait for API response and UI update using a more reliable wait
    await page.waitForResponse(response => response.url().includes('/api/parse') && response.status() === 200);

    // Check that granted column has @read category
    const grantedColumn = page.locator('#grantedCategories');
    await expect(grantedColumn).toContainText('@read');
  });

  test('should show error for invalid ACL syntax', async ({ page }) => {
    await page.goto('/');

    const textarea = page.locator('#aclRule');

    // Enter invalid ACL rule
    await textarea.fill('invalid syntax here');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for notification to appear
    const notification = page.locator('.notification');
    await expect(notification).toBeVisible({ timeout: 3000 });
    await expect(notification).toContainText(/Invalid|Error/i);
  });

  test('should clear ACL rule with clear button', async ({ page }) => {
    await page.goto('/');

    const textarea = page.locator('#aclRule');
    const clearBtn = page.locator('#clearRuleBtn');

    // Add some content and SUBMIT it (clear button only enables after submission)
    await textarea.fill('+@read +@write');

    const submitBtn = page.locator('#submitChangesBtn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for clear button to become enabled (indicates parse is complete and rule is committed)
    await expect(clearBtn).not.toBeDisabled({ timeout: 5000 });

    // Click clear button (bomb emoji 💣) - this will trigger another parse with empty rule
    await clearBtn.click();

    // Wait a moment for the clear operation to complete
    await page.waitForTimeout(500);

    // Textarea should be empty
    await expect(textarea).toHaveValue('');
  });
});
