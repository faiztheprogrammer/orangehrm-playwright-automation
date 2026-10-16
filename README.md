# OrangeHRM Playwright automation

A junior QA automation portfolio project using JavaScript, Playwright Test, Page Object Model, and Allure 2 reports against the public [OrangeHRM demo](https://opensource-demo.orangehrmlive.com/). This is a demonstration project, not a claim of production testing experience.

## Setup

Requirements: Node.js 22, npm, Java 17 on PATH (for Allure 2), and internet access.

```sh
git clone https://github.com/faiztheprogrammer/orangehrm-playwright-automation.git
cd orangehrm-playwright-automation
npm ci
npx playwright install chromium
```

On Linux, use `npx playwright install --with-deps chromium` to install browser system dependencies too. On Windows PowerShell, use `npm.cmd` and `npx.cmd` if execution policy blocks the PowerShell launchers.

## Run tests

```sh
npm test
npx playwright test --headed
npx playwright test tests/login.spec.js
npx playwright test tests/users.spec.js
npx playwright test tests/api.spec.js
npx playwright test --list
```

Run one suite at a time. Configuration uses Chromium, one worker, zero retries, a 60-second test timeout, and a 10-second assertion timeout. The lifecycle test creates and deletes its own account in the shared demo. Tests use only the demo's public Admin/admin123 credentials.

## Coverage: 10 tests

| Area | Coverage |
| --- | --- |
| Login (4) | Successful login, invalid password, both credentials required, logout |
| Users (3) | Missing-username search and Reset; create/search/edit/delete journey; empty Add User form validation |
| API (3) | Unauthenticated users request returns 401; authenticated Admin search; missing-user lookup returns 404 |

The authenticated API tests use UI login and `page.context().request` to share browser cookies. They test API responses but do not demonstrate API-only authentication. The missing-record test assumes its deliberately large ID does not exist in this demo.

## Project structure

```text
pages/LoginPage.js                  Login controls and actions
pages/AdminPage.js                  User search, form controls, edit and deletion
tests/login.spec.js                 Authentication scenarios
tests/users.spec.js                 User scenarios and lifecycle cleanup hook
tests/api.spec.js                   API response checks
playwright.config.js               Runner settings and Allure reporter
.github/workflows/playwright.yml    GitHub Actions execution and report artifacts
```

Tests express expected results; page objects hold locators and reusable actions. The employee autocomplete must select a suggestion, not just type a name. The selected name assertion normalizes whitespace because suggestion text and the input can format spaces differently.

## Allure reporting

```sh
npx allure generate allure-results --clean -o allure-report
npx allure open allure-report
```

`allure-results/` contains raw test data; `allure-report/` contains the generated HTML report. The generator's `--clean` replaces the generated report, not raw results. Before a new independent local run, remove or move aside the previous `allure-results/` directory; otherwise multiple runs can appear as retries/history. Preserve old results first if needed. Generated output and installed packages are Git-ignored.

Allure includes test actions and failure context. Inspect the failing assertion, expected/actual values, and call log. To investigate a failure with a browser trace, run a selected test with `--trace on` and open the resulting ZIP with `npx playwright show-trace <path-to-trace.zip>`. Traces are not enabled by default. Reports and traces may contain demo data and session information; inspect them before sharing.

## CI

GitHub Actions runs on pushes and pull requests to `main`, plus manual dispatch. It installs Node.js 22, Java 17, locked npm dependencies, and Chromium with Linux libraries, then runs `npm test`. Report generation and artifact upload can run after a test failure; they do not turn a failed test run green. Repository-wide concurrency prevents overlapping CI executions and does not cancel an active run during cleanup.

Open the repository's Actions tab, select a run, and download `allure-report-and-results` from Artifacts. Extract it, then serve its report directory with `npx allure open <path-to-allure-report>`. Artifacts have seven-day retention. This is CI validation of tests, not application deployment.

## Cleanup and shared-demo limitations

The lifecycle captures the created account's returned ID. Its `afterEach` hook checks that the ID and original/planned updated username match before API deletion, and verifies absence with GET 404. If UI deletion already succeeded, a 404 lookup means cleanup is complete. Hook teardown has a separate runner budget from the test body.

The demo's availability, language, employee names, and seeded records can change when other visitors use it. Employee selection uses the signed-in employee's display name as search text; ambiguous suggestions fail instead of choosing an arbitrary record. Browser isolation does not isolate the shared backend. A killed process, network failure, missing creation response, or failure before capturing the ID can prevent cleanup. The suite never deletes unrelated accounts or employees. Exact text expectations assume English, and only Chromium is covered.

## Verification

CI status and report artifacts are available in the [Actions tab](https://github.com/faiztheprogrammer/orangehrm-playwright-automation/actions). A successful local execution alone does not establish that Linux CI passes.
