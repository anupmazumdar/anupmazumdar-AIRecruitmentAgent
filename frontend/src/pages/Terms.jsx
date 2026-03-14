import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileCheck2 } from 'lucide-react';

function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-slate-100 md:px-6 md:py-12">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/25 md:p-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1D9E75]/20 text-[#1D9E75]">
              <FileCheck2 size={20} />
            </span>
            <h1 className="text-2xl font-bold tracking-tight md:text-4xl">Terms of Service</h1>
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
          These Terms govern your use of TalentAI, an AI-powered recruitment platform available at anupmazumdar-ai-recruitment-agent.vercel.app.
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-slate-200 md:text-base">
          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">Platform Purpose</h2>
            <p className="mt-2">
              TalentAI provides AI-assisted tools for candidate screening, recruitment workflow support, and hiring insights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">Eligibility</h2>
            <p className="mt-2">
              You must be 18 years or older to use this platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">Candidate Data Ownership</h2>
            <p className="mt-2">
              Candidates retain ownership of their personal data and resumes uploaded to TalentAI.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">Recruiter Responsibilities</h2>
            <p className="mt-2">
              Recruiters are responsible for the accuracy, legality, and completeness of job listings posted on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">AI Assistance Disclaimer</h2>
            <p className="mt-2">
              TalentAI uses artificial intelligence to assist decisions and recommendations, but does not guarantee interviews, offers, or job placement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">Service Availability</h2>
            <p className="mt-2">
              We may modify, suspend, or discontinue features or services at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#7de6c4] md:text-xl">Governing Law</h2>
            <p className="mt-2">
              These Terms are governed by the laws of India.
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

export default Terms;
