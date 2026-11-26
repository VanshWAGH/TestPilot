# TestPilot User Guide

Welcome to **TestPilot**, your AI-native self-healing Playwright QA platform.

---

## 1. Creating a Project & Connecting GitHub

1. Navigate to **Projects → New Project**.
2. Enter your application name, target **Base URL** (e.g. `https://staging.example.com`), and optional login credentials (encrypted at rest with AES-256-GCM).
3. In **Settings → GitHub App**, install the TestPilot GitHub App and link your test repository (`owner/repo`).

---

## 2. Crawling & Page Discovery

1. Open **Crawler** and click **Start Crawl**.
2. TestPilot discovers pages while respecting `robots.txt` `Crawl-delay`, extracts interactive elements with multi-attribute fingerprints, and captures PII-redacted HAR logs.
3. Review the **Page Model** table to verify discovered routes and locators.

---

## 3. Approving Scenarios & Committing Tests

1. Open **Scenarios** and click **Generate Scenarios** for a crawled project.
2. Review the AI-proposed test scenarios, edit steps if needed, and click **Approve**.
3. Click **Generate & Commit to GitHub** to compile Playwright TypeScript specs, Page Objects, and fixtures, then automatically open a Pull Request.

---

## 4. Executing Tests & Self-Healing

1. Go to **Runs** and trigger a run (or let GitHub PR/deployment webhooks trigger it automatically).
2. View live logs over WebSockets, Playwright trace viewers, screenshots, and failure classifications:
   - **`LOCATOR_DRIFT`:** Triggered when an element moved or changed attributes. Open **Healing** to inspect candidate locators, confidence scores, and one-click **Create Healing PR**.
   - **`PRODUCT_BUG`:** Triggered on assertion or server failures. Open **Defects** to view the auto-created GitHub Issue, evidence links, LLM-suggested severity (with human override), verification history, and optional Jira sync.
3. Adding the `ready-for-qa` label on GitHub triggers automated re-verification and closes the issue with `qa-passed` (or reopens with `qa-failed`).

---

## 5. Scheduling, Alerts & Governance

- **Schedules (`/schedules`):** Configure cron jobs for `nightly_regression`, `daily_crawl_refresh`, `weekly_baseline_refresh`, `weekly_orphan_cleanup`, and `nightly_flakiness_analysis`.
- **Settings (`/settings`):** Manage GitHub App, LLM API keys, project environments/secrets, Slack/Email/GitHub notification triggers, and team roles.
- **Security & Audit (`/settings?tab=security`, `/audit`):** Inspect the continuous security compliance checklist, approve production runs, and query the immutable audit trail.
- **Observability & Resilience (`/settings?tab=observability`):** Monitor GitHub/LLM circuit breakers, BullMQ DLQ events, OpenTelemetry tracing status, and Prometheus `/api/v1/metrics`.
