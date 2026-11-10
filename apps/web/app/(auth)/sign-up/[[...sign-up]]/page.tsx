"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense, useState } from "react";
import { ArrowRight, Sparkles, Copy, Check } from "lucide-react";

export default function SignUpPage() {
  const [demoCopied, setDemoCopied] = useState(false);

  const fillDemo = () => {
    const demoEmail = "demo@saucedemo.qa";
    navigator.clipboard?.writeText(demoEmail);
    setDemoCopied(true);

    const input = document.querySelector<HTMLInputElement>(
      'input[name="identifier"], input[name="emailAddress"], input[type="email"]',
    );
    if (input) {
      input.value = demoEmail;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.focus();
    }

    setTimeout(() => setDemoCopied(false), 2500);
  };

  return (
    <section className="auth-card" aria-live="polite">
      <h2>Create your account</h2>
      <p className="lead">Start autonomously testing your first application in minutes.</p>

      <Suspense
        fallback={
          <div className="h-64 w-full rounded-xl border border-[var(--tp-line)] bg-[var(--tp-panel)] animate-pulse" />
        }
      >
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "w-full bg-transparent border-none shadow-none p-0",
              headerTitle: "text-[15px] font-bold text-[var(--tp-ink)]",
              headerSubtitle: "text-[13px] text-[var(--tp-mute)]",
              socialButtonsBlockButton:
                "flex items-center justify-center gap-2 border border-[var(--tp-line)] rounded-[10px] bg-[var(--tp-panel)] hover:border-[var(--tp-acc)] p-[10px] font-semibold text-[14px] text-[var(--tp-ink)] transition-colors h-[42px] w-full",
              socialButtonsBlockButtonText:
                "text-[var(--tp-ink)] font-semibold text-[14px]",
              dividerRow: "my-[18px]",
              dividerLine: "bg-[var(--tp-soft)]",
              dividerText:
                "text-[var(--tp-mute)] text-[13px] bg-transparent px-2 font-normal",
              formFieldLabel:
                "text-[13px] font-semibold text-[var(--tp-ink)] mb-[6px] block",
              formFieldInput:
                "w-full border border-[var(--tp-line)] rounded-[10px] bg-[var(--tp-panel)] p-[11px_12px] text-[14px] text-[var(--tp-ink)] placeholder:text-[var(--tp-mute)]/70 hover:border-[var(--tp-mute)] focus:border-[var(--tp-acc)] focus:ring-0 focus:shadow-[0_0_0_3px_var(--tp-glow)] transition-all h-[42px]",
              formButtonPrimary:
                "w-full mt-[22px] bg-[var(--tp-btn)] text-[var(--tp-btntxt)] border border-white/20 rounded-[10px] p-[12px] font-bold text-[14px] shadow-[0_8px_24px_-8px_var(--tp-glow)] hover:brightness-110 transition-all h-[44px]",
              footer: "hidden",
              identityPreviewText: "text-[var(--tp-ink)] text-[14px]",
              identityPreviewEditButtonIcon: "text-[var(--tp-mute)]",
              formFieldAction:
                "text-[12px] text-[var(--tp-acc)] hover:underline font-semibold",
              alertText: "text-[var(--tp-red)] text-[12px]",
            },
            variables: {
              colorPrimary: "#8b5cf6",
            },
          }}
        />
      </Suspense>

      <div className="auth-demo">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--tp-acc)] shrink-0" />
          <span>{demoCopied ? "Demo email copied & filled!" : "Demo: demo@saucedemo.qa"}</span>
        </span>
        <button type="button" onClick={fillDemo} className="flex items-center gap-1">
          {demoCopied ? (
            <>
              <Check className="w-3 h-3 text-[var(--tp-teal)]" />
              <span>Filled</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Fill demo</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--tp-line)]/60 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--tp-mute)] hover:text-[var(--tp-acc)] font-medium transition-colors"
        >
          <span>Continue directly to Dashboard</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <p className="auth-swap">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </section>
  );
}
