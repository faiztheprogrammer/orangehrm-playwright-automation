# OrangeHRM Playwright automation

A QA automation portfolio project using JavaScript, Playwright Test, Page Object Model, UI tests, API tests, and the public [OrangeHRM demo](https://opensource-demo.orangehrmlive.com/).

The project demonstrates authentication, user management, API contracts, test-owned data, and failure diagnostics. It is a demo project, not production testing experience.

## Requirements and installation

- Node.js 20 or newer; GitHub Actions uses Node.js 22.
- npm, Git, and network access to the demo and Playwright browser downloads.
- Bundled Chromium; branded Google Chrome is not required.

```sh
git clone https://github.com/faiztheprogrammer/orangehrm-playwright-automation.git
cd orangehrm-playwright-automation
npm ci
npm run browsers:install
```

On Linux, install browser system libraries too:

```sh
npx playwright install --with-deps chromium
```

Use `npm ci` for the versions recorded in `package-lock.json`. The demo's published Admin credentials are used in tests; no private account or GitHub secret is required. Do not replace these with production credentials.

## Running tests

| Command | Scope |
| --- | --- |
| `npm run test:list` | Discover tests without executing them |
| `npm test` | All 18 tests, including account creation/edit/deletion |
| `npm run test:login` | Six non-mutating login tests |
| `npm run test:login:headed` | Login tests with a visible Chromium window |
| `npm run test:users` | Five System Users UI tests, including owned-account setup/CRUD |
| `npm run test:api` | Six API tests, including CRUD and cleanup regression |
| `npm run test:hybrid` | One API-setup/UI-verification test |
| `npm run report` | Explicitly open the latest HTML report |

Tests use one worker and zero retries. Do not launch multiple local suites concurrently against the shared demo. On Windows PowerShell, `npm.cmd` and `npx.cmd` can be used if execution policy blocks the `.ps1` shims. Prefer the dedicated scripts over forwarding extra npm arguments.

For one specific API test:

```sh
npx playwright test tests/api/users.api.spec.js --grep "crud lifecycle: create, read, update, and delete user via API$"
```

In PowerShell, use `npx.cmd` for that command. To debug one UI test, use Playwright's `--debug` option with its file and a narrow `--grep`. Confirm selection with `--list` first. Debugging or rerunning a mutating test creates a new account; allow teardown to complete before exiting.

## Structure and responsibilities

```text
.github/workflows/playwright.yml   GitHub Actions test execution and artifacts
pages/
  LoginPage.js                    Login controls, field errors, and actions
  AdminPage.js                    System Users list, filters, and user form actions
tests/
  login.spec.js                   Six login scenarios
  user.spec.js                    Five user-management UI scenarios
  api/users.api.spec.js           Six API scenarios and one hybrid scenario
utils/
  apiAuth.js                      API login, employee prerequisites, owned-user cleanup
playwright.config.js             Chromium, serial execution, timeouts, diagnostics
package.json                     Dependencies and supported run commands
package-lock.json                Reproducible dependency versions
README.md                        Current setup, scope, and limitations
```

Specs keep business assertions. Page objects keep application locators and actions. Small test-scoped cleanup fixtures remain in the specs; there is no generic base page or additional framework layer. The CommonJS config and Playwright-transformed JavaScript imports work through the Playwright runner.

`scratch/` and root HTML/screenshot investigation files are ignored development artifacts. They are not part of the suite and should not be used as run commands. `ANTIGRAVITY_HANDOVER_PLAYWRIGHT_ORANGEHRM.md` is historical development guidance, not the current setup documentation.

## Coverage

| Area | Scenarios |
| --- | --- |
| Login (6) | Success; wrong password; wrong username; missing username; missing password; both fields missing |
| System Users UI (5) | Create/search/edit/delete lifecycle; missing-user search and Reset; required fields; role/status matching and exclusion with Reset; password-confirmation mismatch |
| API (6) | Unauthenticated access; bounded paginated user list; missing record; empty creation payload validation; CRUD with a read after update; cleanup after a simulated post-creation failure |
| Hybrid (1) | API-created user verified in the UI by exact username, ESS role, and Enabled status; API teardown |

The full UI lifecycle is retained as a smoke journey. These are not exhaustive independent tests for every field or CRUD combination. The form's observed empty-confirmation message is `Passwords do not match`; the tests preserve the actual demo behavior.

## Reliability and cleanup

- Role/placeholder locators are preferred. Field groups are scoped by labels; CSS is used for custom controls and unnamed icon buttons.
- Table actions use rows containing an exact username cell, not a substring of the row's combined text.
- Search and Reset wait for the corresponding successful API response before inspecting results, reducing stale-state false positives.
- Login validates each field's own error. API login validates the CSRF prerequisite, Dashboard redirect, and authenticated users response without printing tokens.
- Employee setup selects a usable active employee from validated API data. The UI selects that employee's exact full autocomplete name. The suite never creates or deletes employees.
- Generated usernames include random suffixes. A creation response must contain a positive integer ID and the exact generated name before it is registered for cleanup.
- Teardown runs on success and failure before the dependent request context closes. A GET checks ownership by ID and original/planned updated name before deleting. DELETE must return 200 and a follow-up GET must return 404. Already absent records are accepted after a 404.
- Generated IDs and cleanup outcomes appear in report annotations. Cleanup errors are reported separately; they fail an otherwise passing test and preserve an existing workflow failure.
- The cleanup regression deliberately throws a local workflow error after creating an owned account, checks that the same error is preserved, and verifies the account is absent. An outer cleanup fixture provides a fallback. This test should pass normally; it is not an expected-failure or skipped test.

## Reports and debugging

The console prints test results. HTML output is written to `playwright-report/` and never opens automatically. `npm run report` serves the latest report. Each execution replaces the previous report/results; preserve a copy before another run if needed.

Failure screenshots and local retained failure traces are written under `test-results/`. Open a trace from the report, or run:

```sh
npx playwright show-trace path/to/trace.zip
```

Check the failing assertion and its call log, screenshot, request status, and `created-user`/`user-cleanup` annotations. Cleanup problems have a `user-cleanup-errors` attachment. No arbitrary sleeps or blanket retries are used.

Local traces can contain authentication cookies, CSRF tokens, and network payloads. Keep them local and inspect/redact them before sharing. Generated reports/results are Git-ignored. CI disables network traces and uploads HTML reports, failure screenshots, and cleanup diagnostics; it does not upload auth state or print credential/token dumps. Only the demo's public credentials are present in source.

## GitHub Actions

`.github/workflows/playwright.yml` runs on pushes/PRs to `main` or `master`, and manual dispatch. It uses Node.js 22, `npm ci`, and `npx playwright install --with-deps chromium`, then runs `npm test`. The workflow has read-only repository permissions, one test worker, no retries, and repository-wide concurrency with cancellation disabled so competing CI runs do not interrupt cleanup.

Report and test-result uploads run even when tests fail, with seven-day retention. Download the HTML report artifact, extract it, and serve it with `npx playwright show-report path/to/playwright-report`.

This is a CI validation pipeline; there is no application deployment because the application belongs to OrangeHRM. The workflow is prepared locally. A successful local run is not proof that the Linux/GitHub workflow passes; check the Actions tab after publishing.

## Shared-demo limitations

- Availability, response time, credentials, and seeded employees are outside this repository's control.
- Other visitors may rename/delete an employee or account during a run. Exact matching and ownership checks reduce risk, but cannot make a shared backend fully isolated.
- Duplicate employee display names can make UI autocomplete selection ambiguous; the test fails rather than picking an arbitrary option.
- Lost/malformed creation responses may leave an account without a safely captured ID. Cleanup refuses unidentified records or ownership mismatches; inspect diagnostics rather than deleting by prefix.
- Network outages, expired sessions, abrupt process termination, or CI job termination can prevent teardown. One worker and CI concurrency do not coordinate unrelated visitors or local runs.
- Only Chromium is configured. API behavior is checked against this demo's observed contract; status codes are not generalized to other applications.

## Verification record

Observed on **2026-10-13**, Windows, Node.js 22.14.0, Playwright 1.63.0, bundled Chromium, one worker, zero retries:

| Check | Actual result |
| --- | --- |
| `npm run test:list` | 18 tests discovered across three files |
| `npm run test:login` | 6 passed, 0 failed, 32.7 seconds |
| `npm test` | 18 passed, 0 failed/skipped/flaky, 193.6 seconds |
| Cleanup annotations | All five created account IDs confirmed absent; hybrid, filter, and simulated-failure teardown each verified DELETE 200 then GET 404 |
| `npm ci` | Locked installation succeeded; npm reported zero vulnerabilities at that time |
| Workflow YAML | Parsed and checked locally for install/test/artifact steps; not executed on GitHub |

No cleanup errors were reported. The simulated workflow error was intentionally caught and checked; the cleanup regression itself passed normally. The run verified fallback cleanup after that simulated error, not every failure mode such as a killed process or network outage. Failure screenshot/trace capture is configured, but the final run had no real test failures to exercise it.

These are observed local results, not a claim that the public demo will always be available or that Linux CI has passed. CI remains unexecuted until the workflow is pushed and run on GitHub.

## Publishing

The Git remote is already configured for this repository. Review `git status` and `git diff`, stage the intended source/configuration/documentation files (including `.github/workflows/playwright.yml`), commit, and push to `main`. Do not stage reports, traces, screenshots, `node_modules/`, or scratch files. If authentication is requested, sign in with GitHub's supported Git credential flow; do not put a token in a repository file or remote URL.

After pushing, open the repository's Actions tab, inspect the test run, and download its artifacts. Do not claim a green CI build until that run succeeds.
