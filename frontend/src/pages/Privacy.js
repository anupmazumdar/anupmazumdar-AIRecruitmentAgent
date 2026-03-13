import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

function Privacy() {
  return (
    <div className="min-h-screen bg-[#0f1221] px-4 py-10 text-white md:px-6">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-[#1a1f3c]/70 p-6 md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#f97316]/20 text-[#f97316]">
            <ShieldCheck size={20} />
          </div>
          <h1 className="text-2xl font-bold md:text-4xl">Privacy Policy</h1>
        </div>

        <p className="text-sm text-slate-300 md:text-base">
          TalentAI is committed to protecting user data for both candidates and recruiters. We collect only the information
          required to run assessments, deliver analytics, and improve hiring outcomes.
        </p>

        <section className="mt-8 space-y-4 text-sm md:text-base text-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">What We Collect</h2>
            <p className="mt-1">Profile details, resume uploads, assessment responses, interview recordings, and recruiter usage analytics.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">How We Use Data</h2>
            <p className="mt-1">To score candidates fairly, generate insights, and provide secure dashboard access for authorized users.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">Security</h2>
            <p className="mt-1">We apply JWT-based authentication, encrypted storage layers, and access controls for sensitive records.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">Data Retention</h2>
            <p className="mt-1">Data is retained only as long as required for product functionality, legal obligations, and account continuity.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white md:text-xl">Contact</h2>
            <p className="mt-1">For privacy concerns, contact the TalentAI team via the official project owner profile.</p>
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

export default Privacy;
