import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test('user can login successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.navigate();
    await loginPage.login('Admin', 'admin123');

    const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
    await expect(dashboardHeading).toBeVisible();
});

test('cannot login with invalid password', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.navigate();
    await loginPage.login('Admin', 'wrongPassword');

    const invalidCredentials = page.getByText('Invalid credentials', { exact: true });
    await expect(invalidCredentials).toBeVisible();
});

test('username and password are required', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.navigate();
    await loginPage.login('', '');

    const requiredField = page.getByText('Required', { exact: true });
    await expect(requiredField).toHaveCount(2);
});

test('user can log out successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.navigate();
    await loginPage.login('Admin', 'admin123');

    const dashboardHeading = page.getByRole('heading', { name: 'Dashboard' });
    await expect(dashboardHeading).toBeVisible();

    const userDropdown = page.getByAltText('profile picture', { exact: true });
    await userDropdown.click();

    await page.getByRole('menuitem', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/auth\/login$/);

    const loginHeading = page.getByRole('heading', { name: 'Login' });
    await expect(loginHeading).toBeVisible();
});
