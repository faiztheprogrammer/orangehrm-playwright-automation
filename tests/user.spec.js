import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { LoginPage } from '../pages/LoginPage';
import { AdminPage } from '../pages/AdminPage';
import { getTestEmployee, withUserCleanup } from '../utils/apiAuth';

const test = base.extend({
    userCleanup: async ({ page }, use, testInfo) => {
        await withUserCleanup(page.context().request, use, testInfo);
    },
});

test('administrator creates a user, finds it, updates its username, and deletes it', async ({ page, userCleanup }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await expect(loginPage.usernameInput).toBeVisible();
    await loginPage.login('Admin', 'admin123');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const employee = await getTestEmployee(page.context().request);
    const fullName = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
    
    const adminPage = new AdminPage(page);
    await adminPage.navigateToAdmin();
    await adminPage.clickAddUser();
    await expect(adminPage.userRoleGroup).toBeVisible();
    
    await adminPage.selectUserRole('ESS');
    await adminPage.fillEmployeeName(employee.firstName, fullName);
    await adminPage.selectStatus('Enabled');
    
    const uniqueUsername = `qa_e2e_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const newUsername = uniqueUsername + '_upd';
    await adminPage.fillUsername(uniqueUsername);
    await adminPage.fillPasswords('Password!123');
    
    // Start listening before Save so the ID is registered even if later UI work fails.
    const createdUser = userCleanup.captureCreation(
        page.waitForResponse(response =>
            new URL(response.url()).pathname === '/web/index.php/api/v2/admin/users' &&
            response.request().method() === 'POST'),
        uniqueUsername,
        [uniqueUsername, newUsername],
    );
    const [createBody] = await Promise.all([createdUser, adminPage.clickSave()]);
    expect(createBody.data.userName).toBe(uniqueUsername);
    await expect(adminPage.systemUsersHeading).toBeVisible();
    
    await adminPage.searchByUsername(uniqueUsername);
    
    const row = adminPage.getUserRow(uniqueUsername);
    await expect(row).toBeVisible();

    await adminPage.clickEditUser(uniqueUsername);
    await expect(adminPage.editUserHeading).toBeVisible();

    await expect(adminPage.usernameGroup.locator('input')).toHaveValue(uniqueUsername);
    await adminPage.fillUsername(newUsername);
    const [updateResponse] = await Promise.all([
        page.waitForResponse(response =>
            new URL(response.url()).pathname === `/web/index.php/api/v2/admin/users/${createBody.data.id}` &&
            response.request().method() === 'PUT'),
        adminPage.clickSave(),
    ]);
    expect(updateResponse.status()).toBe(200);
    await expect(adminPage.systemUsersHeading).toBeVisible();

    await adminPage.searchByUsername(newUsername);
    const updatedRow = adminPage.getUserRow(newUsername);
    await expect(updatedRow).toBeVisible();

    await expect(adminPage.getUserCell(uniqueUsername)).toHaveCount(0);
    await adminPage.clickDeleteUser(newUsername);
    await expect(adminPage.successDeleteToast).toBeVisible();

    await adminPage.clickReset();
    const deletedSearch = await adminPage.searchByUsername(newUsername);
    expect(deletedSearch.data).toEqual([]);
    await expect(adminPage.getUserRow(newUsername)).toHaveCount(0);
    await expect(adminPage.noRecordsMessage).toBeVisible();
});

test('administrator searches with invalid username and verifies no results, then resets', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await expect(loginPage.usernameInput).toBeVisible();
    await loginPage.login('Admin', 'admin123');
    
    const adminPage = new AdminPage(page);
    await adminPage.navigateToAdmin();
    await expect(adminPage.systemUsersHeading).toBeVisible();
    
    const results = await adminPage.searchByUsername(`missing_${randomUUID().replace(/-/g, '').slice(0, 16)}`);
    
    expect(results.data).toEqual([]);
    await expect(adminPage.noRecordsMessage).toBeVisible();
    
    const resetResults = await adminPage.clickReset();
    await expect(adminPage.usernameGroup.locator('input')).toHaveValue('');
    expect(resetResults.data.length).toBeGreaterThan(0);
    await expect(adminPage.noRecordsMessage).toHaveCount(0);
});

test('administrator sees validation errors for required fields on Add User form', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await expect(loginPage.usernameInput).toBeVisible();
    await loginPage.login('Admin', 'admin123');
    
    const adminPage = new AdminPage(page);
    await adminPage.navigateToAdmin();
    await adminPage.clickAddUser();
    await expect(adminPage.userRoleGroup).toBeVisible();
    
    await adminPage.clickSave();
    
    const requiredMessage = 'Required';
    await expect(adminPage.userRoleGroup.getByText(requiredMessage)).toBeVisible();
    await expect(adminPage.employeeNameGroup.getByText(requiredMessage)).toBeVisible();
    await expect(adminPage.statusGroup.getByText(requiredMessage)).toBeVisible();
    await expect(adminPage.usernameGroup.getByText(requiredMessage)).toBeVisible();
    await expect(adminPage.passwordGroup.getByText(requiredMessage)).toBeVisible();
    await expect(adminPage.confirmPasswordGroup.getByText('Passwords do not match')).toBeVisible();
});

test('administrator filters a test-owned user by role and status and resets filters', async ({ page, userCleanup }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('Admin', 'admin123');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const request = page.context().request;
    const employee = await getTestEmployee(request);
    const username = `qa_filter_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const response = await request.post('/web/index.php/api/v2/admin/users', {
        data: { username, password: 'Password!123', status: true, userRoleId: 2, empNumber: employee.empNumber },
    });
    const created = await userCleanup.captureCreation(response, username);
    expect(response.status()).toBe(200);

    const adminPage = new AdminPage(page);
    await adminPage.navigateToAdmin();
    await adminPage.fillUsername(username);
    await adminPage.selectUserRole('ESS');
    await adminPage.selectStatus('Enabled');
    const matching = await adminPage.search();
    expect(matching.data.map(user => user.id)).toEqual([created.data.id]);
    const row = adminPage.getUserRow(username);
    await expect(row).toBeVisible();
    await expect(row.getByRole('cell', { name: 'ESS', exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: 'Enabled', exact: true })).toBeVisible();

    await adminPage.selectStatus('Disabled');
    expect((await adminPage.search()).data).toEqual([]);
    await expect(row).toHaveCount(0);
    await expect(adminPage.noRecordsMessage).toBeVisible();

    await adminPage.selectStatus('Enabled');
    await adminPage.selectUserRole('Admin');
    expect((await adminPage.search()).data).toEqual([]);
    await expect(row).toHaveCount(0);

    const reset = await adminPage.clickReset();
    await expect(adminPage.usernameGroup.locator('input')).toHaveValue('');
    await expect(adminPage.userRoleGroup.locator('.oxd-select-text-input')).toHaveText('-- Select --');
    await expect(adminPage.statusGroup.locator('.oxd-select-text-input')).toHaveText('-- Select --');
    await expect(adminPage.employeeNameGroup.locator('input')).toHaveValue('');
    expect(reset.data.length).toBeGreaterThan(0);
    await expect(adminPage.noRecordsMessage).toHaveCount(0);
});

test('administrator sees a password confirmation mismatch on Add User form', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('Admin', 'admin123');
    const adminPage = new AdminPage(page);
    await adminPage.navigateToAdmin();
    await adminPage.clickAddUser();
    await expect(adminPage.addUserHeading).toBeVisible();
    // Other required fields remain empty, so this validation scenario cannot
    // submit a valid account even if confirmation validation regresses.
    await adminPage.fillPasswords('Password!123', 'Different!123');
    await adminPage.clickSave();
    await expect(adminPage.confirmPasswordGroup.getByText('Passwords do not match', { exact: true })).toBeVisible();
    await expect(adminPage.addUserHeading).toBeVisible();
});
