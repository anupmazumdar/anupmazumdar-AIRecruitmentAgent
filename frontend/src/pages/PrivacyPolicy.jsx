import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-slate-100 md:px-6 md:py-12">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/25 md:p-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1D9E75]/20 text-[#1D9E75]">
              <ShieldCheck size={20} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
          </div>

          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#1D9E75]/50 bg-[#1D9E75]/15 px-3 py-2 text-sm font-semibold text-[#7de6c4] transition hover:bg-[#1D9E75]/25"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
        </div>

        <p className="mb-8 text-sm leading-relaxed text-slate-300 md:text-base">
          TalentAI respects your privacy and is committed to protecting your personal information while you use our AI-powered recruitment platform.
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-slate-200 md:text-base">
          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">What Data We Collect</h2>
            <p className="mt-2">
              We may collect your name, email address, resume/CV content, and job preferences to deliver core platform features for candidates and recruiters.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">How We Use Your Data</h2>
            <p className="mt-2">
              Data is used to match candidates with job opportunities, generate AI-powered analysis, and improve recruitment workflows across the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">Authentication and Security</h2>
            <p className="mt-2">
              TalentAI uses Auth0 for authentication and account session management to help secure user access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">Third-Party Data Sharing</h2>
            <p className="mt-2">
              We do not sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">Data Deletion Requests</h2>
            <p className="mt-2">
              You may request deletion of your data by contacting TalentAI support.
            </p>
          </section>
        </div>

        <p className="mt-8 border-t border-white/10 pt-4 text-xs text-slate-400 md:text-sm">
          Last updated: March 2026
        </p>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
