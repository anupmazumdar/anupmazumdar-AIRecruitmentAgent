import React from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';

function Terms() {
  return (
    <div className="min-h-screen bg-[#0f1221] px-4 py-10 text-white md:px-6">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-[#1a1f3c]/70 p-6 md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#7c3aed]/25 text-[#c4b5fd]">
            <FileCheck2 size={20} />
          </div>
          <h1 className="text-2xl font-bold md:text-4xl">Terms of Service</h1>
        </div>

        <p className="text-sm text-slate-300 md:text-base">
          By using TalentAI, you agree to use the platform for legitimate recruitment and candidate evaluation workflows.
        </p>

        <section className="mt-8 space-y-4 text-sm md:text-base text-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">Acceptable Use</h2>
            <p className="mt-1">Users must not upload harmful content, misuse interview tools, or attempt unauthorized access.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">Account Responsibility</h2>
            <p className="mt-1">You are responsible for maintaining account credential security and activity under your account.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">Platform Availability</h2>
            <p className="mt-1">We aim for reliable service but do not guarantee uninterrupted availability at all times.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">Intellectual Property</h2>
            <p className="mt-1">TalentAI product assets, workflows, and branding remain property of the platform owner.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">Limitation of Liability</h2>
            <p className="mt-1">TalentAI is provided as-is for educational and operational recruitment support purposes.</p>
          </div>
        </section>

        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-[#f97316] px-5 py-2.5 text-sm font-semibold transition hover:bg-orange-500 md:text-base"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Terms;
