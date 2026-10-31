"use client";

import { useEffect, useState } from "react";

export function AuthHero() {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCycle((prev) => prev + 1);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className="auth-hero">
      <div>
        <div className="auth-brand">
          <span className="auth-logo">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
              <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
            </svg>
          </span>
          TestPilot <span className="auth-tag">AI QA</span>
        </div>
      </div>

      <div>
        <h1>Tests that repair themselves.</h1>
        <p className="auth-sub">
          TestPilot crawls your app, writes Playwright tests, runs them on every push, and opens a reviewable pull request when a locator breaks.
        </p>

        <div className="auth-stats" aria-label="Sample workspace">
          <div>
            Projects<b>1</b>
          </div>
          <div>
            Pass rate<b>100%</b>
          </div>
          <div>
            Healed<b>14</b>
          </div>
          <div>
            Open defects<b>0</b>
          </div>
        </div>

        <div className="auth-heal" key={cycle} role="img" aria-label="Example of a broken locator healed automatically">
          <header>
            <span>checkout.spec.ts</span>
            <span>auto-heal: suggest</span>
          </header>
          <div className="row r1">
            <span className="auth-rm">#login-button</span>
            <span>not found after deploy</span>
          </div>
          <div className="row r2">
            <span className="auth-ad">{'[data-test="login-button"]'}</span>
            <span>matched, 98% confidence</span>
          </div>
          <div className="row r3">
            <span className="auth-pr">PR #128 opened</span>
            <span>ready for review</span>
          </div>
        </div>
      </div>

      <div className="auth-foot">Works with GitHub Actions. Your code stays in your repo.</div>
    </aside>
  );
}
