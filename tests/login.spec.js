import { expect, test } from "@playwright/test";
import { LoginPage } from '../pages/LoginPage';

test('user can login successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();

    await loginPage.login('Admin', 'admin123');

    const dashboardPageHeading = page.getByRole('heading', { name: 'Dashboard' });
    await expect(dashboardPageHeading).toBeVisible();
});

test('user cannot login with incorrect password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();

    await loginPage.login('Admin', 'wrongPassword');

    await expect(loginPage.invalidCredsMessage).toBeVisible();
});

test('user cannot login with incorrect username', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();

    await loginPage.login('wrongusername', 'admin123');

    await expect(loginPage.invalidCredsMessage).toBeVisible();
});

test('username is required', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();

    await loginPage.login('', 'admin123');

    await expect(loginPage.usernameError).toBeVisible();
    await expect(loginPage.passwordError).toHaveCount(0);
});

test('password is required', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();

    await loginPage.login('Admin', '');

    await expect(loginPage.passwordError).toBeVisible();
    await expect(loginPage.usernameError).toHaveCount(0);
});

test('username and password are required', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();

    await loginPage.login('', '');

    await expect(loginPage.requiredMessage).toHaveCount(2);
    await expect(loginPage.usernameError).toBeVisible();
    await expect(loginPage.passwordError).toBeVisible();
});
