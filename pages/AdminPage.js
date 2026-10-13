export class AdminPage {
    constructor(page) {
        this.page = page;
        this.adminMenuLink = page.getByRole('link', { name: 'Admin', exact: true });
        this.addUserButton = page.getByRole('button', { name: 'Add' });
        
        // Add User Form Locators
        this.userRoleGroup = page.locator('.oxd-input-group', { hasText: 'User Role' });
        this.employeeNameGroup = page.locator('.oxd-input-group', { hasText: 'Employee Name' });
        this.statusGroup = page.locator('.oxd-input-group', { hasText: 'Status' });
        this.usernameGroup = page.locator('.oxd-input-group', { hasText: 'Username' });
        this.passwordGroup = page.locator('.oxd-input-group').filter({ has: page.getByText('Password', { exact: true }) });
        this.confirmPasswordGroup = page.locator('.oxd-input-group', { hasText: 'Confirm Password' });
        
        this.saveButton = page.getByRole('button', { name: 'Save' });
        this.searchButton = page.getByRole('button', { name: 'Search' });
        this.resetButton = page.getByRole('button', { name: 'Reset' });
        
        // Headers and Toasts
        this.systemUsersHeading = page.getByRole('heading', { name: 'System Users' });
        this.addUserHeading = page.getByRole('heading', { name: 'Add User' });
        this.editUserHeading = page.getByRole('heading', { name: 'Edit User' });
        this.successDeleteToast = page.getByText('Successfully Deleted').first();
        this.noRecordsMessage = page.locator('.orangehrm-paper-container').getByText('No Records Found', { exact: true });
    }

    async navigateToAdmin() {
        await this.waitForUsers(() => this.adminMenuLink.click());
    }

    async clickAddUser() {
        await this.addUserButton.click();
    }

    async selectUserRole(role) {
        await this.userRoleGroup.locator('.oxd-select-text-input').click();
        await this.page.getByRole('option', { name: role, exact: true }).click();
    }

    async fillEmployeeName(prefix, fullName) {
        await this.employeeNameGroup.getByPlaceholder('Type for hints...').fill(prefix);
        const specificEmployeeOption = this.page.getByRole('listbox').getByRole('option', { name: fullName, exact: true });
        await specificEmployeeOption.click();
    }

    async selectStatus(status) {
        await this.statusGroup.locator('.oxd-select-text-input').click();
        await this.page.getByRole('option', { name: status, exact: true }).click();
    }

    async fillUsername(username) {
        await this.usernameGroup.locator('input').fill(username);
    }

    async fillPasswords(password, confirmation = password) {
        await this.passwordGroup.locator('input').fill(password);
        await this.confirmPasswordGroup.locator('input').fill(confirmation);
    }

    async clickSave() {
        await this.saveButton.click();
    }

    async searchByUsername(username) {
        await this.usernameGroup.locator('input').fill(username);
        return this.search();
    }

    async search() {
        return this.waitForUsers(() => this.searchButton.click());
    }

    async waitForUsers(action) {
        const [response] = await Promise.all([
            this.page.waitForResponse(response =>
                new URL(response.url()).pathname === '/web/index.php/api/v2/admin/users' &&
                response.request().method() === 'GET'),
            action(),
        ]);
        if (response.status() !== 200) {
            throw new Error(`User search returned HTTP ${response.status()}.`);
        }
        const body = await response.json();
        if (!Array.isArray(body.data)) throw new Error('User search returned an invalid data array.');
        return body;
    }

    async clickReset() {
        return this.waitForUsers(() => this.resetButton.click());
    }

    getUserRow(username) {
        return this.page.getByRole('row').filter({ has: this.getUserCell(username) });
    }

    getUserCell(username) {
        return this.page.getByRole('cell', { name: username, exact: true });
    }

    async clickEditUser(username) {
        const row = this.getUserRow(username);
        // Using explicit CSS locator since icon buttons lack accessible text in this table
        await row.locator('.bi-pencil-fill').click();
    }

    async clickDeleteUser(username) {
        const row = this.getUserRow(username);
        await row.locator('.bi-trash').click();
        // Confirm delete dialog
        const [response] = await Promise.all([
            this.page.waitForResponse(response =>
                new URL(response.url()).pathname === '/web/index.php/api/v2/admin/users' &&
                response.request().method() === 'DELETE'),
            this.page.getByRole('button', { name: 'Yes, Delete' }).click(),
        ]);
        if (response.status() !== 200) throw new Error(`User deletion returned HTTP ${response.status()}.`);
    }
}
