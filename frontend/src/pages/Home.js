import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Check,
  CheckCheck,
  ClipboardCheck,
  FileText,
  Github,
  LayoutDashboard,
  Linkedin,
  Menu,
  MessageSquare,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserRound,
  Workflow,
  X,
} from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Security', href: '#security' },
];

const COMMAND_LINES = [
  '$ talentai scan "senior product designer"',
  '> 48 resumes parsed in 2.4s',
  '> 12 candidates short-listed',
  '> interview kit generated',
  '> score confidence: 93%',
];

const METRICS = [
  { value: '7-stage', label: 'assessment pipeline' },
  { value: '93%', label: 'score confidence' },
  { value: '10x', label: 'faster shortlisting' },
  { value: '0$', label: 'candidate cost' },
];

const FEATURE_CARDS = [
  {
    icon: Brain,
    title: 'AI resume intelligence',
    desc: 'Parse, score, and summarize talent signals instantly with a clear explanation trail.',
  },
  {
    icon: Bot,
    title: 'Conversational screening',
    desc: 'Run structured interviews that adapt to role context without losing consistency.',
  },
  {
    icon: ClipboardCheck,
    title: 'Auto-graded assessments',
    desc: 'Combine objective quizzes with semantic evaluation for a fuller signal.',
  },
  {
    icon: LayoutDashboard,
    title: 'Recruiter command center',
    desc: 'See rankings, confidence, and notes in a layout built for fast decisions.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust by design',
    desc: 'Keep auditability, role separation, and clean permission boundaries in view.',
  },
  {
    icon: Sparkles,
    title: 'Candidate-first experience',
    desc: 'A polished journey that feels modern, fair, and surprisingly lightweight.',
  },
];

const WORKFLOW_STEPS = [
  {
    icon: UserRound,
    title: 'Create a profile',
    desc: 'Candidates land on a focused onboarding flow and start immediately.',
  },
  {
    icon: FileText,
    title: 'Ingest the resume',
    desc: 'The system extracts structured information and highlights relevant matches.',
  },
  {
    icon: MessageSquare,
    title: 'Run interviews',
    desc: 'Use guided prompts, scoring rubrics, and a clear transcript trail.',
  },
  {
    icon: BarChart3,
    title: 'Make the decision',
    desc: 'Review a clean ranking view with the evidence needed to move quickly.',
  },
];

const PRICING = [
  {
    name: 'Free',
    role: 'For candidates',
    price: '$0',
    note: 'Free forever',
    featured: false,
    cta: 'Start free',
    plan: null,
    features: ['Full assessment flow', 'AI feedback after each step', 'Interview readiness insights', 'No candidate fee'],
  },
  {
    name: 'Basic',
    role: 'For recruiters',
    price: '$29',
    note: 'Per month',
    featured: true,
    cta: 'Choose Basic',
    plan: 'basic',
    features: ['Up to 10 candidates', 'AI ranking and filtering', 'Interview review dashboard', 'Basic support'],
  },
  {
    name: 'Premium',
    role: 'For teams',
    price: '$79',
    note: 'Per month',
    featured: false,
    cta: 'Choose Premium',
    plan: 'premium',
    features: ['Up to 50 candidates', 'Advanced analytics suite', 'Priority support', 'Team workflows'],
  },
];

function Home({
  authState,
  logout,
  setUserType,
  setAuthMode,
  setShowAuthModal,
  setShowSubscriptionModal,
  setSelectedPlan,
  setAuthUserType,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const openAuth = (mode, intendedUserType = null, options = {}) => {
    const { clearPlan = true } = options;

    if (clearPlan) {
      setSelectedPlan(null);
    }

    setAuthMode(mode);
    setAuthUserType(intendedUserType);
    setShowAuthModal(true);
    setMenuOpen(false);
  };

  const startCandidate = () => {
    if (authState?.isAuthenticated) {
      setUserType('candidate');
      return;
    }

    openAuth('register', 'candidate');
  };

  const selectRecruiterPlan = (plan) => {
    setSelectedPlan(plan);

    if (authState?.isAuthenticated) {
      setShowSubscriptionModal(true);
      return;
    }

    openAuth('register', 'recruiter', { clearPlan: false });
  };

  const handlePlanClick = (plan) => {
    if (!plan.plan) {
      startCandidate();
      return;
    }

    selectRecruiterPlan(plan.plan);
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };

  return (
    <div className="landing-shell">
      <div className="landing-orbs" aria-hidden="true">
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
      </div>

      <header className="landing-header">
        <nav className="landing-nav">
          <button type="button" className="brand-mark" onClick={() => scrollToSection('top')}>
            <span className="brand-mark__icon">
              <Terminal size={18} />
            </span>
            <span>
              TalentAI
              <small>terminal-grade hiring</small>
            </span>
          </button>

          <div className="nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="nav-link">
                {link.label}
              </a>
            ))}
          </div>

          <div className="nav-actions nav-actions--desktop">
            {authState?.isAuthenticated ? (
              <button type="button" className="btn btn-secondary btn-secondary--compact" onClick={logout}>
                Log out
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-secondary btn-secondary--compact" onClick={() => openAuth('login', 'candidate')}>
                  Sign in
                </button>
                <button type="button" className="btn btn-primary btn-primary--compact" onClick={startCandidate}>
                  Start free
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="menu-button"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>

        {menuOpen && (
          <div className="mobile-panel">
            <div className="mobile-links">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="mobile-link" onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mobile-actions">
              {authState?.isAuthenticated ? (
                <button type="button" className="btn btn-secondary" onClick={logout}>
                  Log out
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => openAuth('login', 'candidate')}>
                    Sign in
                  </button>
                  <button type="button" className="btn btn-primary" onClick={startCandidate}>
                    Start free
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} />
              Terminal-inspired recruitment for modern teams
            </div>

            <h1 className="hero-title">Hire with the speed of a command line and the polish of a premium product.</h1>

            <p className="hero-text">
              TalentAI turns recruiting into a fast, readable workflow. Parse resumes, run assessments, and short-list candidates with a layout that feels crisp, modern, and serious.
            </p>

            <div className="hero-actions">
              <button type="button" className="btn btn-primary" onClick={startCandidate}>
                Get started free
                <ArrowRight size={16} />
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => scrollToSection('workflow')}>
                <PlayCircle size={16} />
                See the workflow
              </button>
            </div>

            <div className="hero-metrics">
              {METRICS.map((metric) => (
                <article key={metric.label} className="metric-card">
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="hero-visual surface-card surface-card--hero">
            <div className="terminal-shell">
              <div className="terminal-bar">
                <span />
                <span />
                <span />
              </div>

              <div className="terminal-body">
                <div className="terminal-title-row">
                  <span className="terminal-title">
                    <Terminal size={14} />
                    talentai / session
                  </span>
                  <span className="status-pill">live</span>
                </div>

                <div className="terminal-commands">
                  {COMMAND_LINES.map((line) => (
                    <div key={line} className={line.startsWith('>') ? 'terminal-line terminal-line--output' : 'terminal-line'}>
                      {line}
                    </div>
                  ))}
                </div>

                <div className="terminal-grid">
                  <article className="insight-card">
                    <span>Candidate signal</span>
                    <strong>92 / 100</strong>
                    <small>best fit</small>
                  </article>
                  <article className="insight-card">
                    <span>Time saved</span>
                    <strong>6.4 hrs</strong>
                    <small>this week</small>
                  </article>
                </div>
              </div>
            </div>

            <div className="surface-chip-row">
              <span className="surface-chip">Resume parsing</span>
              <span className="surface-chip">AI interview</span>
              <span className="surface-chip">Scorecards</span>
            </div>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <p className="section-kicker">What makes it feel expensive</p>
            <h2>Everything is framed around signal, rhythm, and clarity.</h2>
            <p>
              The page is intentionally bento-like, with a terminal core and supporting panels that give the product depth without clutter.
            </p>
          </div>

          <div id="features" className="feature-grid">
            {FEATURE_CARDS.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className={`surface-card feature-card feature-card--${index % 3}`}>
                  <div className="feature-icon">
                    <Icon size={18} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="section-block">
          <div className="section-heading section-heading--split">
            <div>
              <p className="section-kicker">Workflow</p>
              <h2>Designed like a clean terminal session, not a dashboard dump.</h2>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => scrollToSection('pricing')}>
              View pricing
              <Workflow size={16} />
            </button>
          </div>

          <div className="workflow-grid">
            {WORKFLOW_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="surface-card workflow-card">
                  <div className="workflow-card__top">
                    <span className="workflow-step-number">0{index + 1}</span>
                    <Icon size={18} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="security" className="section-block section-block--split">
          <article className="surface-card surface-card--accent">
            <p className="section-kicker">For candidates</p>
            <h2>Fast, fair, and confidence-building.</h2>
            <p>
              A focused journey that keeps the candidate experience smooth while still producing useful signals for the hiring team.
            </p>
            <ul className="feature-list">
              <li><Check size={16} /> Guided profile flow in minutes</li>
              <li><Check size={16} /> Feedback at every stage</li>
              <li><Check size={16} /> No candidate-side fee</li>
            </ul>
            <button type="button" className="btn btn-primary" onClick={startCandidate}>
              Start free
            </button>
          </article>

          <article className="surface-card">
            <p className="section-kicker">For recruiters</p>
            <h2>Objective scoring with a decision-ready layout.</h2>
            <p>
              Prioritize signal over noise with ranked cards, evidence summaries, and a visual hierarchy that makes the next action obvious.
            </p>
            <ul className="feature-list">
              <li><CheckCheck size={16} /> Ranked shortlists</li>
              <li><CheckCheck size={16} /> Interview context in one view</li>
              <li><CheckCheck size={16} /> Analytics for faster decisions</li>
            </ul>
            <button type="button" className="btn btn-secondary" onClick={() => scrollToSection('pricing')}>
              Explore plans
            </button>
          </article>
        </section>

        <section id="pricing" className="section-block">
          <div className="section-heading">
            <p className="section-kicker">Pricing</p>
            <h2>Simple pricing that keeps the story clear.</h2>
            <p>One free path for candidates, and two recruiter tiers that scale without making the page feel noisy.</p>
          </div>

          <div className="pricing-grid">
            {PRICING.map((plan) => (
              <article key={plan.name} className={`surface-card pricing-card ${plan.featured ? 'pricing-card--featured' : ''}`}>
                {plan.featured && <span className="featured-badge">Most popular</span>}
                <p className="pricing-role">{plan.role}</p>
                <h3>{plan.name}</h3>
                <div className="pricing-value">
                  <strong>{plan.price}</strong>
                  <span>{plan.note}</span>
                </div>
                <ul className="pricing-list">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <CheckCheck size={15} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button type="button" className={plan.featured ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => handlePlanClick(plan)}>
                  {plan.cta}
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <p className="footer-brand">TalentAI</p>
          <p className="footer-copy">A polished landing experience for a terminal-first recruitment product.</p>
        </div>

        <div className="footer-links">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>

        <div className="footer-social">
          <a href="https://github.com/anupmazumdar" target="_blank" rel="noreferrer" aria-label="GitHub">
            <Github size={18} />
          </a>
          <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
            <Linkedin size={18} />
          </a>
          {!authState?.isAuthenticated && (
            <button type="button" className="footer-admin" onClick={() => openAuth('login', 'superadmin')}>
              admin
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default Home;
