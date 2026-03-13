import React, { useState } from 'react';
import {
  Menu,
  X,
  Sparkles,
  PlayCircle,
  UserRound,
  FileText,
  Video,
  ClipboardCheck,
  MessageSquare,
  Camera,
  BarChart3,
  Brain,
  Bot,
  CheckCheck,
  LayoutDashboard,
  ShieldCheck,
  Briefcase,
  Check,
  Github,
  Linkedin,
} from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
];

const PIPELINE_STEPS = [
  { icon: UserRound, title: 'Profile Creation', desc: 'Candidates create a profile in minutes with role preferences.' },
  { icon: FileText, title: 'Resume Upload & Parsing', desc: 'AI extracts structured data and ranks relevance instantly.' },
  { icon: Video, title: 'Video Introduction', desc: 'Record a short intro so recruiters assess communication quickly.' },
  { icon: ClipboardCheck, title: 'Technical Quiz', desc: 'Adaptive quizzes score exact and semantic answers automatically.' },
  { icon: MessageSquare, title: 'AI Interview', desc: 'Conversational interview with rubric-based scoring and feedback.' },
  { icon: Camera, title: 'Live Video Recording', desc: 'Capture confidence, clarity, and presentation indicators.' },
  { icon: BarChart3, title: 'Results & Analytics', desc: 'Unified scorecards and rankings for faster shortlisting decisions.' },
];

const FEATURES = [
  {
    icon: Brain,
    title: 'AI Resume Scoring',
    desc: 'Gemini Pro analyzes and scores resumes instantly.',
  },
  {
    icon: Bot,
    title: 'Smart Interviews',
    desc: 'AI conducts natural language video interviews.',
  },
  {
    icon: ClipboardCheck,
    title: 'Technical Assessment',
    desc: 'Auto-graded quizzes with semantic scoring.',
  },
  {
    icon: LayoutDashboard,
    title: 'Recruiter Dashboard',
    desc: 'Real-time analytics and candidate rankings.',
  },
  {
    icon: Sparkles,
    title: '100% Free for Candidates',
    desc: 'No cost, no barrier for job seekers.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    desc: 'JWT auth, encrypted data, GCP storage.',
  },
];

const CANDIDATE_BENEFITS = [
  'Create profile and apply in minutes',
  'Get AI feedback after each stage',
  'Track strengths and growth areas',
  'Completely free assessment pipeline',
  'Improve interview readiness with insights',
];

const RECRUITER_BENEFITS = [
  'Rank candidates with objective AI scores',
  'Reduce manual screening time dramatically',
  'Review interview intelligence in one place',
  'Use analytics-driven shortlisting decisions',
  'Scale hiring without adding recruiter load',
];

const PRICING = [
  {
    name: 'Free',
    role: 'Candidate',
    price: '$0/mo',
    highlighted: false,
    cta: 'Get Started Free',
    features: [
      '7-stage AI assessment flow',
      'Resume parsing and scoring',
      'AI interview feedback',
      'Technical quiz access',
      'Career insights report',
    ],
  },
  {
    name: 'Starter',
    role: 'Recruiter',
    price: '$29/mo',
    highlighted: true,
    cta: 'Choose Starter',
    features: [
      'Up to 10 candidates/month',
      'Recruiter dashboard',
      'AI ranking and filtering',
      'Interview scoring visibility',
      'Basic support',
      'Export score summaries',
    ],
  },
  {
    name: 'Pro',
    role: 'Enterprise',
    price: '$79/mo',
    highlighted: false,
    cta: 'Choose Pro',
    features: [
      'Up to 50 candidates/month',
      'Advanced analytics suite',
      'Priority support',
      'Custom workflows',
      'Team collaboration controls',
      'API-ready integration options',
    ],
  },
];

function Home({
  authState,
  logout,
  setUserType,
  setAuthMode,
  setShowAuthModal,
  setSelectedPlan,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const openAuth = (mode) => {
    setAuthMode(mode);
    setShowAuthModal(true);
    setMenuOpen(false);
  };

  const startCandidate = () => {
    if (authState?.isAuthenticated) {
      setUserType('candidate');
      return;
    }
    openAuth('register');
  };

  const selectRecruiterPlan = (plan) => {
    setSelectedPlan(plan);
    if (authState?.isAuthenticated) {
      setUserType('recruiter');
      return;
    }
    openAuth('register');
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0f1221] text-[#ffffff] scroll-smooth">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#7c3aed]/30 blur-3xl" />
        <div className="absolute top-52 left-10 h-56 w-56 rounded-full bg-[#f97316]/20 blur-3xl" />
        <div className="absolute bottom-10 right-6 h-64 w-64 rounded-full bg-[#7c3aed]/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0f1221]/80 backdrop-blur-xl">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <button className="text-left" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="bg-gradient-to-r from-[#7c3aed] to-[#f97316] bg-clip-text text-xl font-extrabold text-transparent md:text-2xl">
              TalentAI
            </span>
          </button>

          <div className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-slate-300 transition-colors hover:text-white md:text-base">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {authState?.isAuthenticated ? (
              <button
                onClick={logout}
                className="min-h-[44px] rounded-lg border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Logout
              </button>
            ) : (
              <>
                <button
                  onClick={() => openAuth('login')}
                  className="min-h-[44px] rounded-lg px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuth('register')}
                  className="min-h-[44px] rounded-lg bg-[#f97316] px-4 text-sm font-semibold text-white transition hover:bg-orange-500"
                >
                  Sign Up
                </button>
                <button
                  onClick={() => openAuth('login')}
                  className="min-h-[44px] rounded-lg border border-[#f97316]/70 px-4 text-sm font-semibold text-orange-300 transition hover:bg-[#f97316]/10"
                >
                  Admin Login
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/15 bg-white/5 md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t border-white/10 bg-[#11152a] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="min-h-[44px] rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              {!authState?.isAuthenticated && (
                <>
                  <button onClick={() => openAuth('login')} className="min-h-[44px] rounded-md border border-white/15 px-3 py-2 text-left text-sm">
                    Sign In
                  </button>
                  <button onClick={() => openAuth('register')} className="min-h-[44px] rounded-md bg-[#f97316] px-3 py-2 text-left text-sm font-semibold">
                    Sign Up
                  </button>
                  <button onClick={() => openAuth('login')} className="min-h-[44px] rounded-md border border-[#f97316]/70 px-3 py-2 text-left text-sm text-orange-300">
                    Admin Login
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-4 pb-16 pt-12 text-center md:px-6 md:pb-24 md:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7c3aed]/40 bg-[#1a1f3c]/80 px-4 py-2 text-xs font-medium text-purple-200 md:text-sm">
            <Sparkles size={14} className="text-[#f97316]" />
            🚀 AI-Powered Recruitment Platform
          </div>

          <h1 className="mt-6 max-w-4xl bg-gradient-to-r from-[#7c3aed] to-[#f97316] bg-clip-text text-4xl font-black leading-tight text-transparent sm:text-5xl lg:text-6xl">
            Hire Smarter with AI-Driven Assessments
          </h1>

          <p className="mt-5 max-w-3xl text-sm text-slate-300 md:text-base lg:text-lg">
            Automate your entire recruitment pipeline — from resume screening to AI interviews. 100% free for candidates.
          </p>

          <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
            <button
              onClick={startCandidate}
              className="min-h-[44px] rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-orange-500 hover:shadow-lg hover:shadow-orange-900/40 md:text-base"
            >
              Get Started Free
            </button>
            <button
              onClick={() => window.alert('Demo coming soon')}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10 md:text-base"
            >
              <PlayCircle size={18} />
              Watch Demo
            </button>
          </div>

          <div className="mt-10 grid w-full grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-[#1a1f3c]/60 p-4 text-sm text-slate-200 sm:grid-cols-2 lg:grid-cols-4 lg:text-base">
            <p>500+ Candidates Assessed</p>
            <p>7-Stage AI Pipeline</p>
            <p>100% Free for Candidates</p>
            <p>98% Accuracy Rate</p>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-4xl">Your Complete Recruitment Pipeline</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PIPELINE_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className={`group relative rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    index % 2 === 0
                      ? 'border-[#7c3aed]/30 bg-[#1a1f3c]/80 hover:shadow-purple-900/30'
                      : 'border-[#f97316]/30 bg-[#151934] hover:shadow-orange-900/30'
                  }`}
                >
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#f97316]">
                    <Icon size={20} />
                  </div>
                  <p className="text-xs font-semibold text-slate-400">Step {index + 1}</p>
                  <h3 className="mt-1 text-lg font-bold md:text-xl">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-300 md:text-base">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-4xl">Everything You Need to Hire the Best</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-white/10 bg-[#1a1f3c]/70 p-6 transition duration-300 hover:-translate-y-1 hover:border-[#7c3aed]/50 hover:shadow-xl hover:shadow-purple-900/20"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#f97316]">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-bold md:text-xl">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-300 md:text-base">{feature.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[#1a1f3c] bg-[#1a1f3c] p-6 md:p-8">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#f97316]/20 text-[#f97316]">
                <UserRound size={24} />
              </div>
              <h3 className="text-2xl font-bold">For Candidates</h3>
              <p className="mt-2 text-sm text-slate-300 md:text-base">Take control of your job journey with AI-powered feedback and fair scoring.</p>
              <ul className="mt-5 space-y-2">
                {CANDIDATE_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-sm text-slate-200 md:text-base">
                    <Check size={16} className="mt-1 text-[#f97316]" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <button
                onClick={startCandidate}
                className="mt-6 min-h-[44px] rounded-lg bg-[#f97316] px-5 py-3 text-sm font-semibold transition hover:bg-orange-500 md:text-base"
              >
                Start Free
              </button>
            </div>

            <div className="rounded-2xl border border-purple-400/30 bg-gradient-to-br from-[#2b1f5f] to-[#7c3aed] p-6 md:p-8">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white">
                <Briefcase size={24} />
              </div>
              <h3 className="text-2xl font-bold">For Recruiters</h3>
              <p className="mt-2 text-sm text-purple-100 md:text-base">Cut hiring time with intelligent ranking, analytics, and interview insights.</p>
              <ul className="mt-5 space-y-2">
                {RECRUITER_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-sm text-white md:text-base">
                    <Check size={16} className="mt-1 text-orange-200" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-6 min-h-[44px] rounded-lg border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold transition hover:bg-white/20 md:text-base"
              >
                View Plans
              </button>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-4xl">Simple, Transparent Pricing</h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {PRICING.map((plan) => (
              <article
                key={plan.name}
                className={`relative rounded-2xl border p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  plan.highlighted
                    ? 'border-[#f97316]/70 bg-[#1a1f3c] shadow-lg shadow-orange-900/30'
                    : 'border-white/10 bg-[#151934] hover:border-[#7c3aed]/40'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#f97316] px-3 py-1 text-xs font-bold">
                    MOST POPULAR
                  </span>
                )}
                <p className="text-sm text-slate-300">{plan.role}</p>
                <h3 className="mt-1 text-2xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-3xl font-black">{plan.price}</p>

                <ul className="mt-5 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-200 md:text-base">
                      <CheckCheck size={16} className="mt-1 text-[#f97316]" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    if (plan.name === 'Free') startCandidate();
                    if (plan.name === 'Starter') selectRecruiterPlan('basic');
                    if (plan.name === 'Pro') selectRecruiterPlan('premium');
                  }}
                  className={`mt-6 w-full min-h-[44px] rounded-lg px-4 py-3 text-sm font-semibold transition md:text-base ${
                    plan.highlighted
                      ? 'bg-[#f97316] hover:bg-orange-500'
                      : 'border border-white/20 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {plan.cta}
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0c0f1c]">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
          <div>
            <h3 className="bg-gradient-to-r from-[#7c3aed] to-[#f97316] bg-clip-text text-2xl font-extrabold text-transparent">TalentAI</h3>
            <p className="mt-2 text-sm text-slate-300 md:text-base">AI-Powered Recruitment Made Simple</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Links</p>
            <div className="mt-2 flex flex-col gap-2 text-sm text-slate-300 md:text-base">
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#pricing" className="hover:text-white">Pricing</a>
              <a href="/privacy" className="hover:text-white">Privacy</a>
              <a href="/terms" className="hover:text-white">Terms</a>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Built by Anup Mazumdar | MCA Student | UEM Jaipur</p>
            <div className="mt-3 flex items-center gap-3">
              <a
                href="https://github.com/anupmazumdar"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/20 bg-white/5 transition hover:bg-white/10"
                aria-label="GitHub"
              >
                <Github size={18} />
              </a>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/20 bg-white/5 transition hover:bg-white/10"
                aria-label="LinkedIn"
              >
                <Linkedin size={18} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
