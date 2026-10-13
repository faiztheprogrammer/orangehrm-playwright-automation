export class LoginPage {
    constructor(page) {
        this.page = page;
        this.usernameInput = page.getByPlaceholder('Username');
        this.passwordInput = page.getByPlaceholder('Password');
        this.loginButton = page.getByRole('button', { name: 'login' });
        this.companyBranding = page.getByAltText('company-branding');
        this.invalidCredsMessage = page.getByText('Invalid credentials');
        this.requiredMessage = page.getByText('Required');
        this.usernameError = page.locator('.oxd-input-group').filter({ has: this.usernameInput }).getByText('Required', { exact: true });
        this.passwordError = page.locator('.oxd-input-group').filter({ has: this.passwordInput }).getByText('Required', { exact: true });
    }

    async navigate() {
        await this.page.goto('/web/index.php/auth/login', { waitUntil: 'domcontentloaded' });
    }

    async login(username, password) {
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);
        await this.loginButton.click();
    }
}
