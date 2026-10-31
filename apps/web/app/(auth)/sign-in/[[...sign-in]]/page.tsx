"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense, useState } from "react";

export default function SignInPage() {
  const [demoCopied, setDemoCopied] = useState(false);

  const fillDemo = () => {
    navigator.clipboard?.writeText("demo@saucedemo.qa");
    setDemoCopied(true);
    setTimeout(() => setDemoCopied(false), 2500);
  };

  return (
    <section className="auth-card" aria-live="polite">
      <h2>Sign in to TestPilot</h2>
      <p className="lead">Welcome back. Sign in to open your dashboard.</p>

      <Suspense fallback={<div className="h-64 w-full rounded-xl border border-[var(--tp-line)] bg-[var(--tp-panel)] animate-pulse" />}>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "w-full bg-transparent border-none shadow-none p-0",
              header: "hidden",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "flex items-center justify-center gap-2 border border-[var(--tp-line)] rounded-[10px] bg-[var(--tp-panel)] hover:border-[var(--tp-acc)] p-[10px] font-semibold text-[14px] text-[var(--tp-ink)] transition-colors h-[42px] w-full",
              socialButtonsBlockButtonText: "text-[var(--tp-ink)] font-semibold text-[14px]",
              dividerRow: "my-[18px]",
              dividerLine: "bg-[var(--tp-soft)]",
              dividerText: "text-[var(--tp-mute)] text-[13px] bg-transparent px-2 font-normal",
              formFieldLabel: "text-[13px] font-semibold text-[var(--tp-ink)] mb-[6px] block",
              formFieldInput:
                "w-full border border-[var(--tp-line)] rounded-[10px] bg-[var(--tp-panel)] p-[11px_12px] text-[14px] text-[var(--tp-ink)] placeholder:text-[var(--tp-mute)]/70 hover:border-[var(--tp-mute)] focus:border-[var(--tp-acc)] focus:ring-0 focus:shadow-[0_0_0_3px_var(--tp-glow)] transition-all h-[42px]",
              formButtonPrimary:
                "w-full mt-[22px] bg-[var(--tp-btn)] text-[var(--tp-btntxt)] border border-white/20 rounded-[10px] p-[12px] font-bold text-[14px] shadow-[0_8px_24px_-8px_var(--tp-glow)] hover:brightness-110 transition-all h-[44px]",
              footer: "hidden",
              identityPreviewText: "text-[var(--tp-ink)] text-[14px]",
              identityPreviewEditButtonIcon: "text-[var(--tp-mute)]",
              formFieldAction: "text-[12px] text-[var(--tp-acc)] hover:underline font-semibold",
              alertText: "text-[var(--tp-red)] text-[12px]",
            },
            variables: {
              colorPrimary: "#8b5cf6",
            },
          }}
        />
      </Suspense>

      <div className="auth-demo">
        <span>{demoCopied ? "Demo email copied to clipboard!" : "Just looking around? Use the demo workspace."}</span>
        <button type="button" onClick={fillDemo}>
          {demoCopied ? "Copied!" : "Fill demo"}
        </button>
      </div>

      <p className="auth-swap">
        New to TestPilot?{" "}
        <Link href="/sign-up">Sign up</Link>
      </p>
    </section>
  );
}
