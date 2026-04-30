import { test, expect } from '@playwright/test';

// Each test gets a fresh BrowserContext, so localStorage starts empty.
// The home tab loads first; HomeController.loadProfileToHome may overwrite
// #profileName from kv_profile, so for signed-out checks we look at the
// auth modal panel visibility (logical state) rather than specific text.

test.describe('AuthController extraction smoke test', () => {
  test('profile button opens auth modal in signed-out state', async ({ page }) => {
    await page.goto('/');
    await page.click('#profileBtn');
    await expect(page.locator('#authModal')).toBeVisible();
    await expect(page.locator('#authSignedOutView')).toBeVisible();
    await expect(page.locator('#authSignedInView')).toBeHidden();
  });

  test('switching between Sign In and Sign Up tabs toggles panels', async ({ page }) => {
    await page.goto('/');
    await page.click('#profileBtn');
    await page.click('#authTabSignUp');
    await expect(page.locator('#authPanelSignUp')).toBeVisible();
    await expect(page.locator('#authPanelSignIn')).toBeHidden();
    await page.click('#authTabSignIn');
    await expect(page.locator('#authPanelSignIn')).toBeVisible();
    await expect(page.locator('#authPanelSignUp')).toBeHidden();
  });

  test('email signup transitions to signed-in state', async ({ page }) => {
    await page.goto('/');
    await page.click('#profileBtn');
    await page.click('#authTabSignUp');

    const email = `smoke_${Date.now()}@example.com`;
    await page.fill('#authSignUpName', 'Smoke User');
    await page.fill('#authSignUpEmail', email);
    await page.fill('#authSignUpPassword', 'pass1234');
    await page.click('#authEmailSignUpBtn');

    await expect(page.locator('#authModal')).toBeHidden();
    await expect(page.locator('#profileName')).toHaveText('Smoke User', { timeout: 5000 });

    await page.click('#profileBtn');
    await expect(page.locator('#authSignedInView')).toBeVisible();
    await expect(page.locator('#authSignedOutView')).toBeHidden();
    await expect(page.locator('#authSessionEmail')).toHaveText(email);
  });

  test('sign-out returns to signed-out state', async ({ page }) => {
    await page.goto('/');
    await page.click('#profileBtn');
    await page.click('#authTabSignUp');
    const email = `out_${Date.now()}@example.com`;
    await page.fill('#authSignUpName', 'Out User');
    await page.fill('#authSignUpEmail', email);
    await page.fill('#authSignUpPassword', 'pass1234');
    await page.click('#authEmailSignUpBtn');
    await expect(page.locator('#profileName')).toHaveText('Out User', { timeout: 5000 });

    await page.click('#profileBtn');
    await expect(page.locator('#authSignedInView')).toBeVisible();
    await page.click('#authSignOutBtn');

    await page.click('#profileBtn');
    await expect(page.locator('#authSignedOutView')).toBeVisible();
    await expect(page.locator('#authSignedInView')).toBeHidden();
  });

  test('signup validation rejects bad email', async ({ page }) => {
    await page.goto('/');
    await page.click('#profileBtn');
    await page.click('#authTabSignUp');
    await page.fill('#authSignUpEmail', 'not-an-email');
    await page.fill('#authSignUpPassword', 'pass1234');
    await page.click('#authEmailSignUpBtn');
    await expect(page.locator('#authStatusMessage')).toContainText(/valid email/i);
    await expect(page.locator('#authModal')).toBeVisible();
  });

  test('signup validation rejects short password', async ({ page }) => {
    await page.goto('/');
    await page.click('#profileBtn');
    await page.click('#authTabSignUp');
    await page.fill('#authSignUpEmail', `pwtest_${Date.now()}@example.com`);
    await page.fill('#authSignUpPassword', '123');
    await page.click('#authEmailSignUpBtn');
    await expect(page.locator('#authStatusMessage')).toContainText(/at least 6/i);
  });

  test('persisted session is restored on reload', async ({ page }) => {
    await page.goto('/');
    await page.click('#profileBtn');
    await page.click('#authTabSignUp');
    const email = `persist_${Date.now()}@example.com`;
    await page.fill('#authSignUpName', 'Persisted User');
    await page.fill('#authSignUpEmail', email);
    await page.fill('#authSignUpPassword', 'pass1234');
    await page.click('#authEmailSignUpBtn');
    await expect(page.locator('#profileName')).toHaveText('Persisted User', { timeout: 5000 });

    await page.reload();
    await expect(page.locator('#profileName')).toHaveText('Persisted User', { timeout: 5000 });
    await page.click('#profileBtn');
    await expect(page.locator('#authSignedInView')).toBeVisible();
    await expect(page.locator('#authSessionEmail')).toHaveText(email);
  });

  test('sign-in with email/password works after signup', async ({ page }) => {
    const email = `signin_${Date.now()}@example.com`;
    await page.goto('/');
    await page.click('#profileBtn');
    await page.click('#authTabSignUp');
    await page.fill('#authSignUpName', 'SignIn User');
    await page.fill('#authSignUpEmail', email);
    await page.fill('#authSignUpPassword', 'pass1234');
    await page.click('#authEmailSignUpBtn');
    await expect(page.locator('#profileName')).toHaveText('SignIn User', { timeout: 5000 });

    await page.click('#profileBtn');
    await page.click('#authSignOutBtn');

    await page.click('#profileBtn');
    await page.click('#authTabSignIn');
    await page.fill('#authSignInEmail', email);
    await page.fill('#authSignInPassword', 'pass1234');
    await page.click('#authEmailSignInBtn');
    await expect(page.locator('#authModal')).toBeHidden();
    await expect(page.locator('#profileName')).toHaveText('SignIn User', { timeout: 5000 });
  });
});
