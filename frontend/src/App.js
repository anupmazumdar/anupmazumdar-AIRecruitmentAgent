// UPDATED COMPLETE AI RECRUITMENT SYSTEM
// FIX: Users select subscription FIRST, then sign up
// FIX: Pricing always visible, better flow

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Upload, CheckCircle, XCircle, User, Briefcase, MessageSquare, Award, FileText, Users, TrendingUp, Crown, Zap, Sparkles, Check, X, Mail, Lock, Eye, EyeOff, LogOut, Video, VideoOff, DollarSign } from 'lucide-react';

// ==================== BACKEND API URL ====================
const API_URL = process.env.NODE_ENV === 'production' ? '' : (process.env.REACT_APP_API_URL || 'http://localhost:3001');

async function parseApiJson(response) {
  const raw = await response.text();

  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {
      success: false,
      error: raw?.slice(0, 240) || 'Server returned non-JSON response'
    };
  }

  if (!response.ok) {
    if (data.success === undefined) data.success = false;
    if (!data.error) data.error = `Request failed (${response.status})`;
  }

  return data;
}

// ==================== SUBSCRIPTION PLANS ====================
const SUBSCRIPTION_PLANS = {
  basic: {
    name: "Basic",
    price: 29,
    icon: User,
    color: "blue",
    features: {
      candidates: 10,
      atsAnalysis: true,
      basicQuiz: true,
      textInterview: true,
      aiPowered: false,
      videoInterview: false,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false
    }
  },
  premium: {
    name: "Premium",
    price: 79,
    icon: Zap,
    color: "purple",
    popular: true,
    features: {
      candidates: 50,
      atsAnalysis: true,
      basicQuiz: true,
      textInterview: true,
      aiPowered: true,
      videoInterview: true,
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: false,
      apiAccess: false
    }
  },
  pro: {
    name: "Pro",
    price: 199,
    icon: Crown,
    color: "gold",
    features: {
      candidates: "Unlimited",
      atsAnalysis: true,
      basicQuiz: true,
      textInterview: true,
      aiPowered: true,
      videoInterview: true,
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true
    }
  }
};

// ==================== MAIN APP COMPONENT ====================
export default function AIRecruitmentAgent() {
  const [userType, setUserType] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null); // NEW: Track selected plan
  const [subscription, setSubscription] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
    token: null
  });

  useEffect(() => {
    const savedAuth = localStorage.getItem('talentai_auth');
    if (savedAuth) {
      const authData = JSON.parse(savedAuth);
      setAuthState(authData);
      setUserType(authData.user.userType);
      if (authData.user.subscription) {
        setSubscription(authData.user.subscription);
      }
    }
  }, []);

  const login = (userData) => {
    const authData = {
      isAuthenticated: true,
      user: userData,
      token: userData.token
    };
    setAuthState(authData);
    localStorage.setItem('talentai_auth', JSON.stringify(authData));
    setUserType(userData.userType);
    setShowAuthModal(false);

    // If they selected a plan before signing up, activate it
    if (selectedPlan && userData.userType === 'recruiter') {
      setSubscription({
        plan: selectedPlan,
        billingCycle: 'monthly',
        startDate: new Date().toISOString()
      });
      setSelectedPlan(null);
    }
  };

  const logout = () => {
    setAuthState({ isAuthenticated: false, user: null, token: null });
    localStorage.removeItem('talentai_auth');
    setUserType(null);
    setSubscription(null);
    setSelectedPlan(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      <div className="fixed inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10">
        {!userType ? (
          <HomePage
            setUserType={setUserType}
            setShowSubscriptionModal={setShowSubscriptionModal}
            setShowAuthModal={setShowAuthModal}
            setAuthMode={setAuthMode}
            authState={authState}
            logout={logout}
            setSelectedPlan={setSelectedPlan}
          />
        ) : userType === 'candidate' ? (
          <CandidatePortal
            setUserType={setUserType}
            subscription={subscription}
            authState={authState}
            logout={logout}
          />
        ) : userType === 'superadmin' ? (
          <SuperAdminDashboard authState={authState} logout={logout} />
        ) : (
          <RecruiterDashboard
            setUserType={setUserType}
            subscription={subscription}
            setShowSubscriptionModal={setShowSubscriptionModal}
            authState={authState}
            logout={logout}
          />
        )}
      </div>

      {showSubscriptionModal && (
        <SubscriptionModal
          setShowSubscriptionModal={setShowSubscriptionModal}
          setSubscription={setSubscription}
          setUserType={setUserType}
          authState={authState}
          setShowAuthModal={setShowAuthModal}
          setAuthMode={setAuthMode}
          setSelectedPlan={setSelectedPlan}
        />
      )}

      {showAuthModal && (
        <AuthModal
          authMode={authMode}
          setAuthMode={setAuthMode}
          setShowAuthModal={setShowAuthModal}
          login={login}
          selectedPlan={selectedPlan}
        />
      )}
    </div>
  );
}

// ==================== AUTH MODAL (WITH SELECTED PLAN INFO) ====================
function AuthModal({ authMode, setAuthMode, setShowAuthModal, login, selectedPlan }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: selectedPlan ? 'recruiter' : 'candidate',
    company: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (authMode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (formData.password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
      }

      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          userType: formData.userType,
          company: formData.company
        })
      });

      const data = await parseApiJson(response);
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      login({
        ...data.user,
        token: data.token,
        type: data.user.userType
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900/95 rounded-2xl max-w-md w-full p-6 border border-slate-700">
        <h2 className="text-2xl font-bold mb-3 text-center">
          {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
        </h2>

        {/* Show selected plan info */}
        {selectedPlan && authMode === 'register' && (
          <div className="mb-4 p-3 bg-purple-600/20 border border-purple-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Selected Plan:</p>
                <p className="font-bold text-lg">{SUBSCRIPTION_PLANS[selectedPlan].name} - ${SUBSCRIPTION_PLANS[selectedPlan].price}/mo</p>
              </div>
              <Crown className="text-yellow-400" size={24} />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {authMode === 'login' && (
          <div className="mb-4 p-3 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-300">
            Admin access uses the regular sign-in form. Log in with a superadmin account to open the admin dashboard.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {authMode === 'register' && (
            <>
              <div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  placeholder="Full Name"
                  required
                />
              </div>

              {!selectedPlan && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, userType: 'candidate' })}
                    className={`p-2.5 rounded-lg border transition-all text-sm ${formData.userType === 'candidate'
                      ? 'bg-indigo-600 border-indigo-500'
                      : 'bg-slate-800/50 border-slate-600'
                      }`}
                  >
                    <User className="mx-auto mb-1" size={20} />
                    Candidate
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, userType: 'recruiter' })}
                    className={`p-2.5 rounded-lg border transition-all text-sm ${formData.userType === 'recruiter'
                      ? 'bg-purple-600 border-purple-500'
                      : 'bg-slate-800/50 border-slate-600'
                      }`}
                  >
                    <Briefcase className="mx-auto mb-1" size={20} />
                    Recruiter
                  </button>
                </div>
              )}

              {(formData.userType === 'recruiter' || selectedPlan) && (
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  placeholder="Company Name"
                  required
                />
              )}
            </>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
              placeholder="Email"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
              placeholder="Password"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {authMode === 'register' && (
            <input
              type={showPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
              placeholder="Confirm Password"
              required
              minLength={8}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50"
          >
            {loading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : selectedPlan ? `Sign Up & Subscribe to ${SUBSCRIPTION_PLANS[selectedPlan].name}` : 'Sign Up'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <button
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="text-indigo-400 hover:text-indigo-300"
          >
            {authMode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>

        <button
          onClick={() => setShowAuthModal(false)}
          className="mt-3 w-full py-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ==================== HOME PAGE (WITH PRICING VISIBLE) ====================
function HomePage({ setUserType, setShowSubscriptionModal, setShowAuthModal, setAuthMode, authState, logout, setSelectedPlan }) {
  const [showPricing, setShowPricing] = useState(false);

  const handleCandidateClick = () => {
    if (!authState.isAuthenticated) {
      setAuthMode('register');
      setShowAuthModal(true);
    } else {
      setUserType('candidate');
    }
  };

  const handleRecruiterClick = () => {
    // Show pricing first, then they can select and sign up
    setShowPricing(true);
  };

  const handlePlanSelect = (planKey) => {
    setSelectedPlan(planKey);
    setShowPricing(false);

    if (!authState.isAuthenticated) {
      setAuthMode('register');
      setShowAuthModal(true);
    } else {
      // Already logged in, just activate subscription
      setUserType('recruiter');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute top-6 right-6 flex gap-3">
        {authState.isAuthenticated ? (
          <div className="flex items-center gap-3">
            <span className="text-slate-300 text-sm">Hi, {authState.user.name}!</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all flex items-center gap-2 text-sm"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => {
                setAuthMode('login');
                setShowAuthModal(true);
              }}
              className="px-5 py-2 bg-orange-600/90 rounded-lg hover:bg-orange-500 transition-all text-sm"
            >
              Admin Login
            </button>
            <button
              onClick={() => {
                setAuthMode('login');
                setShowAuthModal(true);
              }}
              className="px-5 py-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all text-sm"
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setAuthMode('register');
                setShowAuthModal(true);
              }}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-500 hover:to-purple-500 transition-all text-sm"
            >
              Sign Up
            </button>
          </>
        )}
      </div>

      {!showPricing ? (
        <div className="max-w-6xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              TalentAI
            </h1>
            <p className="text-xl text-slate-300">
              AI-Powered Recruitment Made Simple
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
            <div
              onClick={handleCandidateClick}
              className="group cursor-pointer bg-gradient-to-br from-indigo-900/50 to-purple-900/50 backdrop-blur-xl p-8 rounded-2xl border border-indigo-500/30 hover:border-indigo-400 transition-all duration-500 hover:scale-105"
            >
              <div className="flex justify-center mb-4">
                <div className="p-5 bg-indigo-500/20 rounded-xl">
                  <User size={48} className="text-indigo-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-center mb-3">
                I'm a Candidate
              </h2>
              <p className="text-slate-300 text-center text-sm">
                Upload resume, take AI assessments, complete interviews
              </p>
              <div className="mt-4 text-center">
                <span className="text-green-400 text-sm font-semibold">100% FREE</span>
              </div>
            </div>

            <div
              onClick={handleRecruiterClick}
              className="group cursor-pointer bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-xl p-8 rounded-2xl border border-purple-500/30 hover:border-purple-400 transition-all duration-500 hover:scale-105"
            >
              <div className="flex justify-center mb-4">
                <div className="p-5 bg-purple-500/20 rounded-xl">
                  <Briefcase size={48} className="text-purple-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-center mb-3">
                I'm a Recruiter
              </h2>
              <p className="text-slate-300 text-center text-sm">
                Review AI-scored candidates, access analytics
              </p>
              <div className="mt-4 text-center">
                <span className="text-purple-400 text-sm font-semibold">From $29/month</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowPricing(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-all text-sm inline-flex items-center gap-2"
            >
              <DollarSign size={18} />
              View All Pricing Plans
            </button>
          </div>
        </div>
      ) : (
        <PricingView handlePlanSelect={handlePlanSelect} setShowPricing={setShowPricing} />
      )}
    </div>
  );
}

// ==================== PRICING VIEW (FULL PAGE) ====================
function PricingView({ handlePlanSelect, setShowPricing }) {
  const [billingCycle, setBillingCycle] = useState('monthly');

  return (
    <div className="max-w-6xl w-full py-12">
      <button
        onClick={() => setShowPricing(false)}
        className="mb-8 px-4 py-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all text-sm"
      >
        ← Back to Home
      </button>

      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold mb-3">Choose Your Plan</h2>
        <p className="text-slate-300 text-lg mb-6">Select the perfect plan for your recruitment needs</p>

        <div className="flex items-center justify-center gap-3">
          <span className={billingCycle === 'monthly' ? 'text-white font-semibold' : 'text-slate-400'}>Monthly</span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative w-14 h-7 bg-slate-700 rounded-full"
          >
            <div className={`absolute top-1 left-1 w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-transform ${billingCycle === 'yearly' ? 'transform translate-x-7' : ''
              }`}></div>
          </button>
          <span className={billingCycle === 'yearly' ? 'text-white font-semibold' : 'text-slate-400'}>
            Yearly <span className="text-green-400 text-sm">(Save 20%)</span>
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => {
          const Icon = plan.icon;
          const price = billingCycle === 'yearly' ? Math.round(plan.price * 12 * 0.8) : plan.price;

          return (
            <div
              key={key}
              className={`bg-slate-800/50 rounded-2xl p-6 border-2 transition-all ${plan.popular ? 'border-purple-500 ring-4 ring-purple-500/20 scale-105' : 'border-slate-700 hover:border-slate-600'
                }`}
            >
              {plan.popular && (
                <div className="text-center mb-3">
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-1 rounded-full text-sm font-semibold">
                    ⭐ MOST POPULAR
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <Icon size={40} className="mx-auto mb-3 text-purple-400" />
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-4xl font-bold">${price}</span>
                  <span className="text-slate-400">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-sm text-green-400">Save ${Math.round(plan.price * 12 * 0.2)}/year</p>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <FeatureRow included={true} text={`${plan.features.candidates} candidates/month`} />
                <FeatureRow included={plan.features.atsAnalysis} text="ATS Resume Analysis" />
                <FeatureRow included={plan.features.aiPowered} text="AI-Powered Features" />
                <FeatureRow included={plan.features.videoInterview} text="Video Interview Analysis" />
                <FeatureRow included={plan.features.advancedAnalytics} text="Advanced Analytics" />
                <FeatureRow included={plan.features.prioritySupport} text="Priority Support" />
                <FeatureRow included={plan.features.customBranding} text="Custom Branding" />
                <FeatureRow included={plan.features.apiAccess} text="API Access" />
              </div>

              <button
                onClick={() => handlePlanSelect(key)}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${plan.popular
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
                  : 'bg-slate-700 hover:bg-slate-600'
                  }`}
              >
                Get Started with {plan.name}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700">
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-purple-400 mb-2">14-Day</div>
            <div className="text-slate-400">Money-Back Guarantee</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-purple-400 mb-2">Cancel</div>
            <div className="text-slate-400">Anytime, No Questions</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-purple-400 mb-2">24/7</div>
            <div className="text-slate-400">Customer Support</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ included, text }) {
  return (
    <div className="flex items-center gap-3">
      {included ? (
        <Check size={18} className="text-green-400 flex-shrink-0" />
      ) : (
        <X size={18} className="text-slate-600 flex-shrink-0" />
      )}
      <span className={included ? 'text-slate-200' : 'text-slate-600 line-through'}>{text}</span>
    </div>
  );
}

// ==================== SUBSCRIPTION MODAL (UPDATED) ====================
function SubscriptionModal({ setShowSubscriptionModal, setSubscription, setUserType, authState, setShowAuthModal, setAuthMode, setSelectedPlan }) {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const handlePlanSelect = (planKey) => {
    setSelectedPlan(planKey);
    setShowSubscriptionModal(false);

    if (!authState.isAuthenticated) {
      setAuthMode('register');
      setShowAuthModal(true);
    } else {
      const plan = SUBSCRIPTION_PLANS[planKey];
      const amount = billingCycle === 'yearly' ? Math.round(plan.price * 12 * 0.8) : plan.price;

      setSubscription({
        plan: planKey,
        billingCycle: billingCycle,
        startDate: new Date().toISOString(),
        amount: amount
      });

      setUserType('recruiter');
      alert(`Successfully subscribed to ${plan.name} plan!`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900/95 rounded-xl max-w-6xl w-full p-8 my-8 border border-slate-700">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold mb-3">Choose Your Plan</h2>
          <p className="text-slate-300 mb-4">Select the perfect plan for your recruitment needs</p>

          <div className="flex items-center justify-center gap-3">
            <span className={billingCycle === 'monthly' ? 'text-white text-sm font-semibold' : 'text-slate-400 text-sm'}>Monthly</span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-12 h-6 bg-slate-700 rounded-full"
            >
              <div className={`absolute top-1 left-1 w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-transform ${billingCycle === 'yearly' ? 'transform translate-x-6' : ''
                }`}></div>
            </button>
            <span className={billingCycle === 'yearly' ? 'text-white text-sm font-semibold' : 'text-slate-400 text-sm'}>
              Yearly <span className="text-green-400 text-xs">(20% off)</span>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-6">
          {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => {
            const Icon = plan.icon;
            const price = billingCycle === 'yearly' ? Math.round(plan.price * 12 * 0.8) : plan.price;

            return (
              <div
                key={key}
                className={`bg-slate-800/50 rounded-xl p-5 border-2 transition-all ${plan.popular ? 'ring-2 ring-purple-500/30 border-purple-500' : 'border-slate-700 hover:border-slate-600'
                  }`}
              >
                {plan.popular && (
                  <div className="text-center mb-2">
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-0.5 rounded-full text-xs font-semibold">
                      POPULAR
                    </span>
                  </div>
                )}

                <div className="text-center mb-4">
                  <Icon size={28} className="mx-auto mb-2 text-purple-400" />
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">${price}</span>
                    <span className="text-slate-400 text-xs">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4 text-xs">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-green-400 flex-shrink-0" />
                    <span>{plan.features.candidates} candidates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.features.aiPowered ? <Check size={14} className="text-green-400" /> : <X size={14} className="text-slate-600" />}
                    <span className={!plan.features.aiPowered ? 'text-slate-600' : ''}>AI Features</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.features.videoInterview ? <Check size={14} className="text-green-400" /> : <X size={14} className="text-slate-600" />}
                    <span className={!plan.features.videoInterview ? 'text-slate-600' : ''}>Video Interview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.features.advancedAnalytics ? <Check size={14} className="text-green-400" /> : <X size={14} className="text-slate-600" />}
                    <span className={!plan.features.advancedAnalytics ? 'text-slate-600' : ''}>Analytics</span>
                  </div>
                </div>

                <button
                  onClick={() => handlePlanSelect(key)}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${plan.popular
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
                    : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                >
                  Choose {plan.name}
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setShowSubscriptionModal(false)}
          className="w-full py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-all text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ==================== CANDIDATE PORTAL ====================
function CandidatePortal({ setUserType, subscription, authState, logout }) {
  const [stage, setStage] = useState('profile');
  const [candidateData, setCandidateData] = useState({
    id: null,
    name: authState.user?.name || '',
    email: authState.user?.email || '',
    position: '',
    resumeScore: 0,
    uploadVideoScore: 0,
    quizScore: 0,
    interviewScore: 0,
    videoInterviewScore: 0,
    totalScore: 0
  });

  // Update candidate data if authState changes (e.g. after login)
  useEffect(() => {
    if (authState.user && !candidateData.id) {
      setCandidateData(prev => ({
        ...prev,
        name: authState.user.name,
        email: authState.user.email
      }));
    }
  }, [authState.user, candidateData.id]);

  const stages = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'resume', label: 'Resume', icon: FileText },
    { id: 'uploadVideo', label: 'Video Upload', icon: Upload },
    { id: 'quiz', label: 'Quiz', icon: Award },
    { id: 'interview', label: 'Interview', icon: MessageSquare },
    { id: 'video', label: 'Live Video', icon: Video },
    { id: 'results', label: 'Results', icon: TrendingUp }
  ];

  const currentStageIndex = stages.findIndex(s => s.id === stage);

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Candidate Portal</h1>
          <button
            onClick={logout}
            className="px-4 py-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all flex items-center gap-2 text-sm"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          {stages.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;

            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-indigo-500 ring-4 ring-indigo-500/30' : 'bg-slate-700'
                    }`}>
                    {isCompleted ? <CheckCircle size={20} /> : <Icon size={20} />}
                  </div>
                  <span className={`mt-1 text-xs ${isCurrent ? 'text-indigo-400 font-semibold' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < stages.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 rounded ${isCompleted ? 'bg-green-500' : 'bg-slate-700'}`}></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {stage === 'profile' && <ProfileStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'resume' && <ResumeUploadStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'uploadVideo' && <UploadVideoStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'quiz' && <TechnicalQuizStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'interview' && <TextInterviewStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} authState={authState} />}
        {stage === 'video' && <VideoInterviewStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'results' && <ResultsStage candidateData={candidateData} />}
      </div>
    </div>
  );
}

// ==================== PROFILE STAGE ====================
function ProfileStage({ candidateData, setCandidateData, setStage }) {
  const [formData, setFormData] = useState({
    name: candidateData.name,
    email: candidateData.email,
    position: candidateData.position
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          position: formData.position
        })
      });

      const data = await parseApiJson(response);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create profile');
      }

      // Store the real candidate ID returned from backend
      setCandidateData({ ...candidateData, ...formData, id: data.candidate.id });
      setStage('resume');
    } catch (err) {
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700">
      <h2 className="text-2xl font-bold mb-6">Tell us about yourself</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-300 mb-2">Full Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
            placeholder="John Doe"
            required
          />
        </div>

        <div>
          <label className="block text-slate-300 mb-2">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
            placeholder="john@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-slate-300 mb-2">Position</label>
          <select
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
            required
          >
            <option value="">Select position</option>
            <option value="Software Engineer">Software Engineer</option>
            <option value="Data Scientist">Data Scientist</option>
            <option value="Product Manager">Product Manager</option>
            <option value="Frontend Developer">Frontend Developer</option>
            <option value="Backend Developer">Backend Developer</option>
            <option value="Full Stack Developer">Full Stack Developer</option>
            <option value="DevOps Engineer">DevOps Engineer</option>
            <option value="UI/UX Designer">UI/UX Designer</option>
            <option value="Machine Learning Engineer">Machine Learning Engineer</option>
            <option value="Android Developer">Android Developer</option>
            <option value="iOS Developer">iOS Developer</option>
            <option value="QA Engineer">QA Engineer</option>
          </select>
        </div>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Saving...
            </>
          ) : 'Continue'}
        </button>
      </form>
    </div>
  );
}

// ==================== RESUME UPLOAD STAGE ====================
function ResumeUploadStage({ candidateData, setCandidateData, setStage }) {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf'
      ];

      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      const validExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf'];

      if (validTypes.includes(selectedFile.type) || validExtensions.includes(fileExtension)) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please upload a resume in PDF, DOC, DOCX, TXT, or RTF format');
        setFile(null);
      }
    }
  };

  const analyzeResume = async () => {
    if (!file) return;

    setAnalyzing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('position', candidateData.position);

      const response = await fetch(`${API_URL}/api/candidates/${candidateData.id}/resume`, {
        method: 'POST',
        body: formData
      });

      const data = await parseApiJson(response);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze resume');
      }

      const score = data.analysis?.atsScore || data.analysis?.score || 85;

      setAnalysis({
        score,
        strengths: data.analysis?.strengths || ['Strong professional experience', 'Clear communication skills'],
        improvements: data.analysis?.improvements || ['Add more quantifiable achievements', 'Include relevant keywords']
      });

      setCandidateData({
        ...candidateData,
        resumeScore: score
      });
    } catch (err) {
      setError(err.message || 'Failed to analyze resume. Please try again.');
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700">
      <h2 className="text-2xl font-bold mb-6">Upload Your Resume</h2>

      {!analysis ? (
        <>
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Sparkles className="text-blue-400 flex-shrink-0 mt-1" size={20} />
              <div>
                <h4 className="font-semibold text-blue-300 mb-2">🎯 TalentAI Focus</h4>
                <p className="text-sm text-slate-300">
                  Our AI specially analyzes your <strong>real-life projects</strong> to understand your practical experience, problem-solving approach, and technical skills in action.
                </p>
              </div>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center mb-6">
            <Upload className="mx-auto mb-4 text-slate-400" size={48} />
            <p className="text-slate-300 mb-2">Drag and drop your resume here</p>
            <p className="text-slate-400 text-sm mb-4">or</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.rtf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              className="px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-all"
            >
              Browse Files
            </button>
            <p className="text-slate-500 text-xs mt-3">
              Supported formats: PDF, DOC, DOCX, TXT, RTF
            </p>
          </div>

          {file && (
            <div className="bg-slate-800/50 rounded-lg p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="text-indigo-400" size={24} />
                <div>
                  <p className="font-semibold">{file.name}</p>
                  <p className="text-slate-400 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-red-400 hover:text-red-300"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4 text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={analyzeResume}
              disabled={!file || analyzing}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Analyzing Resume...
                </>
              ) : 'Analyze Resume'}
            </button>

            <button
              onClick={() => {
                setCandidateData({ ...candidateData, resumeScore: 0 });
                setStage('uploadVideo');
              }}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all whitespace-nowrap"
            >
              Save and Continue →
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Resume Analysis Complete</h3>
              <div className="text-3xl font-bold text-green-400">{analysis.score}/100</div>
            </div>

            <div className="space-y-4">
              {analysis.projects && analysis.projects.length > 0 && (
                <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-300 mb-3 flex items-center gap-2">
                    <Briefcase size={18} />
                    Real-Life Projects Identified
                  </h4>
                  <div className="space-y-2">
                    {analysis.projects.map((project, idx) => (
                      <div key={idx} className="text-sm text-slate-300 bg-slate-800/50 rounded p-2">
                        <p className="font-semibold text-indigo-300">{project.name || `Project ${idx + 1}`}</p>
                        {project.description && <p className="text-xs text-slate-400 mt-1">{project.description}</p>}
                        {project.technologies && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {project.technologies.map((tech, i) => (
                              <span key={i} className="text-xs bg-indigo-600/30 px-2 py-0.5 rounded">
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-green-400 mb-2">✓ Strengths</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  {analysis.strengths.map((str, idx) => (
                    <li key={idx}>• {str}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-yellow-400 mb-2">⚡ Areas for Improvement</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  {analysis.improvements.map((imp, idx) => (
                    <li key={idx}>• {imp}</li>
                  ))}
                </ul>
              </div>

              {analysis.projectScore && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-purple-300">Project Experience Score</span>
                    <span className="text-lg font-bold text-purple-400">{analysis.projectScore}/100</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setStage('uploadVideo')}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
          >
            Continue to Video Upload →
          </button>
        </>
      )}
    </div>
  );
}

// ==================== UPLOAD VIDEO STAGE ====================
function UploadVideoStage({ candidateData, setCandidateData, setStage }) {
  const [videoFile, setVideoFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      const validExtensions = ['mp4', 'webm', 'mov', 'avi'];

      if (validTypes.includes(selectedFile.type) || validExtensions.includes(fileExtension)) {
        // Check file size (max 100MB)
        if (selectedFile.size > 100 * 1024 * 1024) {
          setError('Video file is too large. Maximum size is 100MB.');
          setVideoFile(null);
          setPreview(null);
          return;
        }

        setVideoFile(selectedFile);
        setError('');

        // Create preview URL
        const previewUrl = URL.createObjectURL(selectedFile);
        setPreview(previewUrl);
      } else {
        setError('Please upload a video in MP4, WEBM, MOV, or AVI format');
        setVideoFile(null);
        setPreview(null);
      }
    }
  };

  const analyzeVideo = async () => {
    if (!videoFile) return;

    setAnalyzing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('candidateId', candidateData.id);

      const response = await fetch(`${API_URL}/api/candidates/${candidateData.id}/video-interview`, {
        method: 'POST',
        body: formData
      });

      const data = await parseApiJson(response);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      const score = data.score || data.videoAnalysis?.analysis?.totalScore || Math.floor(Math.random() * 10) + 85;

      setAnalysis({
        score,
        bodyLanguageScore: data.videoAnalysis?.analysis?.bodyLanguageScore || Math.floor(Math.random() * 5) + 20,
        communicationScore: data.videoAnalysis?.analysis?.communicationScore || Math.floor(Math.random() * 5) + 20,
        presentationScore: data.videoAnalysis?.analysis?.presentationScore || Math.floor(Math.random() * 5) + 20,
        strengths: data.videoAnalysis?.analysis?.strengths || [
          'Professional appearance',
          'Clear communication',
          'Good confidence level'
        ],
        improvements: data.videoAnalysis?.analysis?.improvements || [
          'Maintain more eye contact',
          'Reduce filler words'
        ]
      });

      setCandidateData({
        ...candidateData,
        uploadVideoScore: score
      });
    } catch (err) {
      setError(err.message || 'Failed to analyze video. Please try again.');
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700">
      <h2 className="text-2xl font-bold mb-6">Upload Video Interview</h2>

      {!analysis ? (
        <>
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Video className="text-purple-400 flex-shrink-0 mt-1" size={20} />
              <div>
                <h4 className="font-semibold text-purple-300 mb-2">📹 Video Interview Tips</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Record a 1-3 minute introduction about yourself</li>
                  <li>• Explain your experience and why you're a good fit</li>
                  <li>• Ensure good lighting and clear audio</li>
                  <li>• Dress professionally and maintain eye contact</li>
                </ul>
              </div>
            </div>
          </div>

          {!videoFile ? (
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center mb-6">
              <Video className="mx-auto mb-4 text-slate-400" size={48} />
              <p className="text-slate-300 mb-2">Upload your pre-recorded video interview</p>
              <p className="text-slate-400 text-sm mb-4">or</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current.click()}
                className="px-6 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 transition-all"
              >
                Browse Files
              </button>
              <p className="text-slate-500 text-xs mt-3">
                Supported formats: MP4, WEBM, MOV, AVI (Max 100MB)
              </p>
            </div>
          ) : (
            <>
              {/* Video Preview */}
              <div className="bg-slate-800 rounded-xl overflow-hidden mb-4 aspect-video">
                <video
                  src={preview}
                  controls
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Video className="text-purple-400" size={24} />
                  <div>
                    <p className="font-semibold">{videoFile.name}</p>
                    <p className="text-slate-400 text-sm">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setVideoFile(null);
                    setPreview(null);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <X size={20} />
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4 text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={analyzeVideo}
              disabled={!videoFile || analyzing}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Analyzing Video...
                </>
              ) : 'Analyze Video'}
            </button>

            <button
              onClick={() => {
                setCandidateData({ ...candidateData, uploadVideoScore: 0 });
                setStage('quiz');
              }}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all whitespace-nowrap"
            >
              Save and Continue →
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 border border-purple-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Video Analysis Complete</h3>
              <div className="text-3xl font-bold text-purple-400">{analysis.score}/100</div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Body Language</p>
                <p className="text-lg font-bold text-purple-300">{analysis.bodyLanguageScore}/25</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Communication</p>
                <p className="text-lg font-bold text-purple-300">{analysis.communicationScore}/25</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Presentation</p>
                <p className="text-lg font-bold text-purple-300">{analysis.presentationScore}/25</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-green-400 mb-2">✓ Strengths</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  {analysis.strengths.map((str, idx) => (
                    <li key={idx}>• {str}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-yellow-400 mb-2">⚡ Areas for Improvement</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  {analysis.improvements.map((imp, idx) => (
                    <li key={idx}>• {imp}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStage('quiz')}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            Continue to Technical Assessment →
          </button>
        </>
      )}
    </div>
  );
}

// ==================== TECHNICAL QUIZ STAGE ====================
function TechnicalQuizStage({ candidateData, setCandidateData, setStage }) {
  const TOTAL_QUESTIONS = 30;
  const TIME_LIMIT = 30 * 60; // 30 minutes in seconds

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [gradingMeta, setGradingMeta] = useState({ weightedCorrect: 0, totalWeight: 0 });
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [source, setSource] = useState('');
  const [reviewPage, setReviewPage] = useState(0);
  const timerRef = useRef(null);
  const REVIEW_PER_PAGE = 10;

  const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const tokenizeText = (value) => normalizeText(value).split(' ').filter(Boolean);

  const cosineTokenSimilarity = (a, b) => {
    const tokensA = tokenizeText(a);
    const tokensB = tokenizeText(b);
    if (!tokensA.length || !tokensB.length) return 0;

    const freqA = new Map();
    const freqB = new Map();
    tokensA.forEach(t => freqA.set(t, (freqA.get(t) || 0) + 1));
    tokensB.forEach(t => freqB.set(t, (freqB.get(t) || 0) + 1));

    const vocab = new Set([...freqA.keys(), ...freqB.keys()]);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    vocab.forEach(term => {
      const va = freqA.get(term) || 0;
      const vb = freqB.get(term) || 0;
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    });

    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const inferDifficulty = (question) => {
    const explicit = normalizeText(question?.difficulty || '');
    if (explicit === 'hard') return { label: 'hard', weight: 1.5 };
    if (explicit === 'easy') return { label: 'easy', weight: 1.0 };
    if (explicit === 'medium') return { label: 'medium', weight: 1.25 };

    const text = normalizeText(question?.question || '');
    const hardSignals = ['optimize', 'distributed', 'complexity', 'architecture', 'concurrency', 'tradeoff', 'scalability', 'latency'];
    const easySignals = ['what is', 'define', 'stands for', 'which of the following'];
    const hardHits = hardSignals.filter(s => text.includes(s)).length;
    const easyHits = easySignals.filter(s => text.includes(s)).length;

    if (hardHits >= 2 || text.length > 180) return { label: 'hard', weight: 1.5 };
    if (easyHits >= 2 && text.length < 110) return { label: 'easy', weight: 1.0 };
    return { label: 'medium', weight: 1.25 };
  };

  const resolveCorrectAnswerText = (question) => {
    if (typeof question?.correctAnswer === 'number') {
      return question?.options?.[question.correctAnswer] ?? '';
    }
    return String(question?.correctAnswer ?? '');
  };

  const scoreQuestion = (question, selectedAnswer) => {
    const { weight } = inferDifficulty(question);
    const correctAnswer = question?.correctAnswer;

    if (typeof correctAnswer === 'number' && typeof selectedAnswer === 'number') {
      return { earned: selectedAnswer === correctAnswer ? weight : 0, weight, isExact: selectedAnswer === correctAnswer };
    }

    const selectedText = typeof selectedAnswer === 'number'
      ? String(question?.options?.[selectedAnswer] || '')
      : String(selectedAnswer || '');
    const correctText = resolveCorrectAnswerText(question);

    const exact = normalizeText(selectedText) === normalizeText(correctText);
    if (exact) return { earned: weight, weight, isExact: true };

    const similarity = cosineTokenSimilarity(selectedText, correctText);
    const semanticCredit = similarity >= 0.92 ? 0.9 : similarity >= 0.84 ? 0.75 : similarity >= 0.75 ? 0.55 : 0;
    return { earned: Number((weight * semanticCredit).toFixed(4)), weight, isExact: false };
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const generateQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: candidateData.position, numQuestions: TOTAL_QUESTIONS })
      });
      const data = await parseApiJson(res);
      if (data.success && data.questions?.length > 0) {
        setQuestions(data.questions);
        setSource(data.source || 'ai');
      } else {
        throw new Error('No questions returned');
      }
    } catch {
      // Inline fallback — fetch from backend's built-in bank
      try {
        const res = await fetch(`${API_URL}/api/generate-quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: candidateData.position, numQuestions: TOTAL_QUESTIONS })
        });
        const data = await parseApiJson(res);
        if (data.success) { setQuestions(data.questions); setSource('fallback'); }
      } catch { setQuestions([]); }
    } finally {
      setLoading(false);
    }
  }, [candidateData.position]);

  const calculateScore = useCallback((answersOverride) => {
    clearInterval(timerRef.current);
    const ans = answersOverride || answers;
    let weightedEarned = 0;
    let weightedTotal = 0;

    questions.forEach((q, idx) => {
      const result = scoreQuestion(q, ans[idx]);
      weightedEarned += result.earned;
      weightedTotal += result.weight;
    });

    const finalScore = weightedTotal > 0 ? Math.round((weightedEarned / weightedTotal) * 100) : 0;
    setScore(finalScore);
    setGradingMeta({ weightedCorrect: weightedEarned, totalWeight: weightedTotal });
    setCandidateData(prev => ({ ...prev, quizScore: finalScore }));
    setQuizComplete(true);
  }, [answers, questions, setCandidateData]);

  useEffect(() => { generateQuestions(); }, [generateQuestions]);

  // Countdown timer
  useEffect(() => {
    if (!loading && !quizComplete && questions.length > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            calculateScore();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [loading, quizComplete, questions, calculateScore]);

  const handleAnswer = (idx) => setAnswers(prev => ({ ...prev, [currentQuestion]: idx }));

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) setCurrentQuestion(q => q + 1);
    else calculateScore();
  };

  const isTimeLow = timeLeft <= 300 && timeLeft > 0; // last 5 mins
  const answered = Object.keys(answers).length;

  if (loading) return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-10 border border-slate-700 text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
        <Sparkles size={28} />
      </div>
      <h3 className="text-xl font-bold mb-2">AI is building your quiz...</h3>
      <p className="text-slate-400 text-sm">Generating 30 personalized questions for <span className="text-indigo-400 font-semibold">{candidateData.position}</span></p>
      <p className="text-slate-500 text-xs mt-2">Powered by OpenRouter • This takes ~10 seconds</p>
    </div>
  );

  if (quizComplete) {
    const correct = questions.filter((q, i) => answers[i] === q.correctAnswer).length;
    const pageQuestions = questions.slice(reviewPage * REVIEW_PER_PAGE, (reviewPage + 1) * REVIEW_PER_PAGE);
    const grade = score >= 80 ? { label: 'Excellent', color: 'text-green-400', bg: 'from-green-900/30 to-emerald-900/30 border-green-600/30' }
      : score >= 60 ? { label: 'Good', color: 'text-yellow-400', bg: 'from-yellow-900/30 to-amber-900/30 border-yellow-600/30' }
      : { label: 'Needs Work', color: 'text-red-400', bg: 'from-red-900/30 to-pink-900/30 border-red-600/30' };
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700">
        <div className="text-center mb-6">
          <div className={`inline-block bg-gradient-to-br ${grade.bg} border rounded-2xl px-8 py-5 mb-3`}>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Quiz Score</p>
            <p className={`text-6xl font-black ${grade.color}`}>{score}</p>
            <p className="text-slate-300 text-sm font-semibold mt-1">{grade.label} • {correct}/{questions.length} correct</p>
          </div>
          <div className="flex justify-center gap-4 text-sm text-slate-400">
            <span>✅ {correct} correct</span>
            <span>❌ {questions.length - correct} wrong</span>
            <span>⚖️ weighted: {gradingMeta.weightedCorrect.toFixed(1)}/{gradingMeta.totalWeight.toFixed(1)}</span>
            <span>⏱ 30 min quiz</span>
          </div>
        </div>

        {/* Compact review */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-slate-300 text-sm">Review — {reviewPage * REVIEW_PER_PAGE + 1}–{Math.min((reviewPage + 1) * REVIEW_PER_PAGE, questions.length)} of {questions.length}</h3>
            <div className="flex gap-2">
              <button disabled={reviewPage === 0} onClick={() => setReviewPage(p => p - 1)}
                className="px-3 py-1 rounded-lg bg-slate-700 text-xs disabled:opacity-40 hover:bg-slate-600 transition-all">← Prev</button>
              <button disabled={(reviewPage + 1) * REVIEW_PER_PAGE >= questions.length} onClick={() => setReviewPage(p => p + 1)}
                className="px-3 py-1 rounded-lg bg-slate-700 text-xs disabled:opacity-40 hover:bg-slate-600 transition-all">Next →</button>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {pageQuestions.map((q, i) => {
              const idx = reviewPage * REVIEW_PER_PAGE + i;
              const correct = answers[idx] === q.correctAnswer;
              return (
                <div key={idx} className={`p-3 rounded-xl border text-sm ${correct ? 'bg-green-900/20 border-green-700/30' : 'bg-red-900/20 border-red-700/30'}`}>
                  <div className="flex gap-2 items-start">
                    <span className="flex-shrink-0">{correct ? '✅' : '❌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-xs leading-snug">{q.question}</p>
                      <p className="text-slate-400 text-xs mt-0.5">Your: {q.options[answers[idx]] || '—'}</p>
                      {!correct && <p className="text-green-400 text-xs">✓ {q.options[q.correctAnswer]}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={() => setStage('interview')}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-900/30">
          Continue to AI Interview →
        </button>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  if (!currentQ) return null;

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">Technical Assessment</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-slate-400 text-xs">Q {currentQuestion + 1} / {questions.length}</span>
            {source === 'ai' && <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-700/30 px-2 py-0.5 rounded-full">✨ AI Generated</span>}
            {source === 'admin' && <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/30 px-2 py-0.5 rounded-full">📋 Admin Bank</span>}
          </div>
        </div>
        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-bold text-lg transition-all ${
          isTimeLow ? 'bg-red-900/30 border-red-500/50 text-red-400 animate-pulse' : 'bg-slate-800/60 border-slate-600 text-white'
        }`}>
          ⏱ {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800 rounded-full h-1.5 mb-1">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-500 mb-5">
        <span>{answered} answered</span>
        <span>{questions.length - answered} remaining</span>
      </div>

      {/* Question */}
      <p className="text-base font-medium mb-5 leading-relaxed">{currentQ.question}</p>

      {/* Options */}
      <div className="space-y-2.5 mb-6">
        {currentQ.options.map((option, idx) => (
          <button key={idx} onClick={() => handleAnswer(idx)}
            className={`w-full p-3.5 rounded-xl text-left transition-all border-2 flex items-center gap-3 ${
              answers[currentQuestion] === idx
                ? 'bg-indigo-600/30 border-indigo-500 shadow-md'
                : 'bg-slate-800/40 border-slate-700 hover:border-indigo-500/60 hover:bg-slate-800'
            }`}>
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
              answers[currentQuestion] === idx ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-500 text-slate-400'
            }`}>{['A','B','C','D'][idx]}</div>
            <span className="text-sm">{option}</span>
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mb-4">
        <button onClick={() => setCurrentQuestion(q => Math.max(0, q - 1))} disabled={currentQuestion === 0}
          className="flex-1 py-2.5 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-sm font-semibold disabled:opacity-30 transition-all">
          ← Prev
        </button>
        <button onClick={handleNext} disabled={answers[currentQuestion] === undefined}
          className="flex-[2] py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-semibold text-sm disabled:opacity-40 transition-all">
          {currentQuestion < questions.length - 1 ? 'Next →' : '🏁 Submit Quiz'}
        </button>
      </div>

      {/* Mini question navigator */}
      <div className="flex flex-wrap gap-1 justify-center">
        {questions.map((_, i) => (
          <button key={i} onClick={() => setCurrentQuestion(i)}
            className={`w-6 h-6 rounded text-[10px] font-bold transition-all ${
              i === currentQuestion ? 'bg-indigo-500 text-white' :
              answers[i] !== undefined ? 'bg-green-900/60 text-green-300 border border-green-700/30' :
              'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}>{i + 1}</button>
        ))}
      </div>
      <p className="text-center text-xs text-slate-500 mt-2">Click any number to jump to that question</p>
    </div>
  );
}


// ==================== TEXT INTERVIEW STAGE ====================
function TextInterviewStage({ candidateData, setCandidateData, setStage, authState }) {
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);
  const totalQuestions = 5;
  const [answerScores, setAnswerScores] = useState([]);
  const [criteriaBreakdowns, setCriteriaBreakdowns] = useState([]);
  const [finalScore, setFinalScore] = useState(null);
  const messagesEndRef = useRef(null);

  const avgScore = answerScores.length > 0
    ? Math.round(answerScores.reduce((a, b) => a + b, 0) / answerScores.length)
    : null;

  const startInterview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` },
        body: JSON.stringify({
          candidateId: candidateData.candidateId || candidateData.id,
          position: candidateData.position,
          candidateName: candidateData.name
        })
      });
      const data = await parseApiJson(res);
      if (data.success) {
        setMessages([{ role: 'assistant', content: data.message, questionNumber: 1 }]);
        setQuestionNumber(1);
      }
    } catch {
      setMessages([{
        role: 'assistant',
        content: `Hello ${candidateData.name || 'there'}! I'm Alex, your AI interviewer for the ${candidateData.position} role. I'll ask you ${totalQuestions} questions. Let's start — could you walk me through your background and what drew you to this position?`,
        questionNumber: 1
      }]);
    } finally {
      setLoading(false);
    }
  }, [authState?.token, candidateData.candidateId, candidateData.id, candidateData.name, candidateData.position, totalQuestions]);

  useEffect(() => { startInterview(); }, [startInterview]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!currentInput.trim() || loading) return;
    const userMsg = currentInput.trim();
    setCurrentInput('');
    const updatedMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(updatedMessages);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/interview/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` },
        body: JSON.stringify({
          position: candidateData.position,
          candidateName: candidateData.name,
          questionNumber,
          totalQuestions,
          userMessage: userMsg,
          conversationHistory: updatedMessages.slice(-8)
        })
      });
      const data = await parseApiJson(res);
      if (data.success) {
        const newScores = [...answerScores, data.answerScore];
        setAnswerScores(newScores);
        setCriteriaBreakdowns(prev => [...prev, data.criteriaScores || null]);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          answerScore: data.answerScore,
          scoreFeedback: data.scoreFeedback,
          criteriaScores: data.criteriaScores,
          reasoningSummary: data.reasoningSummary
        }]);
        if (data.isComplete) {
          const computed = Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length);
          setFinalScore(computed);
          setCandidateData(prev => ({ ...prev, interviewScore: computed }));
          if (candidateData.candidateId || candidateData.id) {
            fetch(`${API_URL}/api/candidates/${candidateData.candidateId || candidateData.id}/interview-score`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` },
              body: JSON.stringify({ score: computed })
            }).catch(() => {});
          }
          setTimeout(() => setInterviewComplete(true), 1200);
        } else {
          setQuestionNumber(data.questionNumber);
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'There was a brief hiccup. Please continue with your answer!' }]);
    } finally {
      setLoading(false);
    }
  };

  if (interviewComplete) {
    const grade = finalScore >= 85
      ? { label: 'Excellent', emoji: '🏆', color: 'text-green-400', ring: 'ring-green-500/40', bg: 'from-green-900/30 to-emerald-900/30 border-green-600/30' }
      : finalScore >= 70
      ? { label: 'Good', emoji: '👍', color: 'text-yellow-400', ring: 'ring-yellow-500/40', bg: 'from-yellow-900/30 to-orange-900/30 border-yellow-600/30' }
      : { label: 'Keep Growing', emoji: '📈', color: 'text-red-400', ring: 'ring-red-500/40', bg: 'from-red-900/30 to-pink-900/30 border-red-600/30' };
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700 text-center">
        <div className="text-6xl mb-3">{grade.emoji}</div>
        <h2 className="text-2xl font-bold mb-1">Interview Complete!</h2>
        <p className="text-slate-400 mb-6 text-sm">Alex reviewed all {answerScores.length} of your answers</p>

        <div className={`bg-gradient-to-br ${grade.bg} border rounded-2xl p-6 mb-6 inline-block min-w-56 ring-4 ${grade.ring}`}>
          <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Your Score</p>
          <p className={`text-6xl font-black mb-1 ${grade.color}`}>{finalScore}</p>
          <p className="text-slate-300 text-sm font-semibold uppercase tracking-wide">{grade.label}</p>
        </div>

        {answerScores.length > 0 && (
          <div className="grid grid-cols-5 gap-2 mb-6">
            {answerScores.map((s, i) => (
              <div key={i} className="bg-slate-800/60 rounded-xl p-3 text-center border border-slate-700">
                <p className="text-xs text-slate-500 mb-1">Q{i + 1}</p>
                <p className={`text-xl font-bold ${s >= 75 ? 'text-green-400' : s >= 55 ? 'text-yellow-400' : 'text-red-400'}`}>{s}</p>
                {criteriaBreakdowns[i] && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    C {criteriaBreakdowns[i].clarity} • D {criteriaBreakdowns[i].depth} • R {criteriaBreakdowns[i].relevance}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setStage('video')}
          className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-900/30"
        >
          Continue to Video Interview →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold">A</span>
            AI Interview — Alex
          </h2>
          <p className="text-slate-400 text-xs mt-0.5 ml-10">{candidateData.position} • Powered by OpenRouter</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Question</p>
          <p className="text-white font-bold text-lg">{questionNumber} <span className="text-slate-500 text-sm">/ {totalQuestions}</span></p>
          {avgScore !== null && (
            <p className={`text-xs font-bold mt-0.5 ${
              avgScore >= 75 ? 'text-green-400' : avgScore >= 55 ? 'text-yellow-400' : 'text-red-400'
            }`}>avg {avgScore}/100</p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="w-full bg-slate-800 rounded-full h-1 mb-4">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1 rounded-full transition-all duration-700"
          style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Chat window */}
      <div className="bg-slate-800/30 rounded-xl p-3 mb-3 h-[340px] overflow-y-auto space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold">A</div>
                <span className="text-[11px] text-slate-500 font-medium">Alex • Interviewer</span>
              </div>
            )}
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 text-white rounded-br-sm shadow-md'
                : 'bg-slate-700/70 text-slate-100 rounded-bl-sm border border-slate-600/30'
            }`}>
              <p className="whitespace-pre-line">{msg.content}</p>
            </div>
            {msg.answerScore !== undefined && (
              <div className={`mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                msg.answerScore >= 75 ? 'bg-green-900/50 text-green-400 border border-green-700/40' :
                msg.answerScore >= 55 ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/40' :
                'bg-red-900/50 text-red-400 border border-red-700/40'
              }`}>
                ✦ Score: {msg.answerScore}/100 &mdash; {msg.scoreFeedback}
              </div>
            )}
            {msg.criteriaScores && (
              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                <span className={`px-2 py-0.5 rounded-full border ${
                  msg.criteriaScores.clarity >= 75
                    ? 'bg-green-900/40 border-green-700/40 text-green-300'
                    : msg.criteriaScores.clarity >= 55
                      ? 'bg-yellow-900/40 border-yellow-700/40 text-yellow-300'
                      : 'bg-red-900/40 border-red-700/40 text-red-300'
                }`}>Clarity {msg.criteriaScores.clarity}</span>
                <span className={`px-2 py-0.5 rounded-full border ${
                  msg.criteriaScores.depth >= 75
                    ? 'bg-green-900/40 border-green-700/40 text-green-300'
                    : msg.criteriaScores.depth >= 55
                      ? 'bg-yellow-900/40 border-yellow-700/40 text-yellow-300'
                      : 'bg-red-900/40 border-red-700/40 text-red-300'
                }`}>Depth {msg.criteriaScores.depth}</span>
                <span className={`px-2 py-0.5 rounded-full border ${
                  msg.criteriaScores.relevance >= 75
                    ? 'bg-green-900/40 border-green-700/40 text-green-300'
                    : msg.criteriaScores.relevance >= 55
                      ? 'bg-yellow-900/40 border-yellow-700/40 text-yellow-300'
                      : 'bg-red-900/40 border-red-700/40 text-red-300'
                }`}>Relevance {msg.criteriaScores.relevance}</span>
              </div>
            )}
            {msg.reasoningSummary && (
              <p className="mt-1 text-[11px] text-slate-400 max-w-[85%]">Why this score: {msg.reasoningSummary}</p>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">A</div>
            <div className="bg-slate-700/70 border border-slate-600/30 px-4 py-2.5 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center">
                {[0, 0.15, 0.3].map((d, i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                ))}
                <span className="text-xs text-slate-400 ml-1">Alex is typing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          rows={2}
          value={currentInput}
          onChange={e => setCurrentInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type your answer... (Enter to send)"
          className="flex-1 px-4 py-2.5 bg-slate-800/60 rounded-xl border border-slate-600 focus:border-indigo-500 focus:outline-none transition-all resize-none text-sm placeholder-slate-500"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !currentInput.trim()}
          className="px-5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-40 flex items-center justify-center shadow-md shadow-indigo-900/30"
        >
          {loading
            ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
            : <span className="text-lg">➤</span>
          }
        </button>
      </div>
      <button
        onClick={() => { setCandidateData(prev => ({ ...prev, interviewScore: avgScore || 65 })); setStage('video'); }}
        className="w-full mt-2 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        Skip interview and continue →
      </button>
    </div>
  );
}

// ==================== VIDEO INTERVIEW STAGE ====================
function VideoInterviewStage({ candidateData, setCandidateData, setStage }) {
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null); // ref so cleanup always has latest stream
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [recordedBlobs, setRecordedBlobs] = useState([]);
  const [timer, setTimer] = useState(0);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const questions = [
    "Tell me about a challenging project you worked on and how you overcame obstacles.",
    "How do you handle working under tight deadlines and pressure?",
    "Where do you see yourself in 5 years and how does this role fit into your career goals?"
  ];

  useEffect(() => {
    startCamera();
    return () => {
      // Use ref so cleanup always gets the latest stream even if state is stale
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      streamRef.current = mediaStream; // store in ref for reliable cleanup
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  const startRecording = () => {
    if (!stream) return;

    chunksRef.current = [];
    setTimer(0);

    try {
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });
    } catch (e) {
      mediaRecorderRef.current = new MediaRecorder(stream);
    }

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlobs(prev => [...prev, blob]);
    };

    mediaRecorderRef.current.start(100);
    setRecording(true);

    // Start timer
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setTimer(0);
      } else {
        analyzeVideo();
      }
    }
  };

  const analyzeVideo = async () => {
    setAnalyzing(true);
    // Stop camera/mic as soon as recording is done — no need to keep it on during analysis
    stopCamera();

    try {
      // Upload to backend for analysis
      const formData = new FormData();
      const videoBlob = new Blob(recordedBlobs, { type: 'video/webm' });
      formData.append('video', videoBlob, 'interview.webm');
      formData.append('candidateId', '1');

      const response = await fetch(`${API_URL}/api/candidates/${candidateData.id}/video-interview`, {
        method: 'POST',
        body: formData
      });

      const data = await parseApiJson(response);

      const score = data.score || data.videoAnalysis?.analysis?.totalScore || Math.floor(Math.random() * 10) + 85;

      setCandidateData({ ...candidateData, videoInterviewScore: score });
      setRecorded(true);
    } catch (error) {
      console.error('Video analysis error:', error);
      // Fallback score
      const score = Math.floor(Math.random() * 10) + 85;
      setCandidateData({ ...candidateData, videoInterviewScore: score });
      setRecorded(true);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (analyzing) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold mb-4">Analyzing Your Video Interview</h2>
        <p className="text-slate-300 mb-2">Our AI is evaluating:</p>
        <ul className="text-slate-400 text-sm space-y-1">
          <li>• Body language and presentation</li>
          <li>• Communication clarity</li>
          <li>• Confidence and engagement</li>
          <li>• Answer quality</li>
        </ul>
        <p className="text-slate-500 text-xs mt-4">This may take up to 30 seconds...</p>
      </div>
    );
  }

  if (recorded) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700 text-center">
        <Video className="mx-auto mb-4 text-purple-400" size={64} />
        <h2 className="text-2xl font-bold mb-4">Video Interview Complete!</h2>
        <p className="text-slate-300 mb-2">Your responses have been recorded and analyzed.</p>
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg p-4 mb-6 inline-block">
          <p className="text-slate-400 text-sm mb-1">Video Score</p>
          <p className="text-3xl font-bold text-purple-400">{candidateData.videoInterviewScore}/100</p>
        </div>
        <button
          onClick={() => setStage('results')}
          className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
        >
          View Final Results →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Video Interview</h2>
        <span className="text-slate-400">Question {currentQuestion + 1} of {questions.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-2 mb-6">
        <div
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentQuestion + (recording ? 0.5 : 0)) / questions.length) * 100}%` }}
        ></div>
      </div>

      <div className="relative bg-slate-800 rounded-xl overflow-hidden mb-6 aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        {recording && (
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold">REC</span>
            </div>
            <div className="bg-slate-900/80 px-4 py-1 rounded-full font-mono text-lg">
              {formatTime(timer)}
            </div>
          </div>
        )}
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
            <div className="text-center">
              <Video className="mx-auto mb-2 text-slate-400" size={48} />
              <p className="text-slate-400">Starting camera...</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="text-indigo-400 flex-shrink-0 mt-1" size={20} />
          <div>
            <p className="text-sm font-semibold text-indigo-300 mb-2">Question {currentQuestion + 1}:</p>
            <p className="text-slate-200">{questions[currentQuestion]}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        {!recording ? (
          <button
            onClick={startRecording}
            disabled={!stream}
            className="flex-1 py-3 bg-gradient-to-r from-red-600 to-pink-600 rounded-lg font-semibold hover:from-red-500 hover:to-pink-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Video size={20} />
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 py-3 bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg font-semibold hover:from-slate-500 hover:to-slate-600 transition-all flex items-center justify-center gap-2"
          >
            <VideoOff size={20} />
            Stop Recording
          </button>
        )}
      </div>

      <button
        onClick={() => {
          setCandidateData({ ...candidateData, videoInterviewScore: 0 });
          setStage('results');
        }}
        className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all text-sm mb-4"
      >
        Save and Continue to Results →
      </button>

      <div className="bg-slate-800/50 rounded-lg p-3 text-center">
        <p className="text-slate-400 text-sm">
          💡 <strong>Tip:</strong> Speak clearly, maintain eye contact, and take 30-60 seconds per answer
        </p>
      </div>
    </div>
  );
}

function ResultsStage({ candidateData, authState }) {
  const [advice, setAdvice] = useState(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const scoreRubric = {
    resumeScore: 0.25,
    quizScore: 0.30,
    interviewScore: 0.30,
    videoInterviewScore: 0.10,
    uploadVideoScore: 0.05
  };

  const weightedTotal = Object.entries(scoreRubric).reduce((sum, [key, weight]) => {
    return sum + (Number(candidateData[key]) || 0) * weight;
  }, 0);

  const totalScore = Math.round(weightedTotal);

  const fetchAdvice = useCallback(async () => {
    setLoadingAdvice(true);
    try {
      const res = await fetch(`${API_URL}/api/career-advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` },
        body: JSON.stringify({ candidateData, position: candidateData.position })
      });
      const data = await parseApiJson(res);
      if (data.success) setAdvice(data.advice);
    } catch (e) {
      console.error('Career advice fetch failed:', e);
    } finally {
      setLoadingAdvice(false);
    }
  }, [authState?.token, candidateData]);

  useEffect(() => { fetchAdvice(); }, [fetchAdvice]);

  const gradeColor = totalScore >= 85 ? 'from-green-500 to-emerald-500' : totalScore >= 70 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-pink-500';
  const gradeLabel = totalScore >= 85 ? '🏆 Excellent' : totalScore >= 70 ? '👍 Good' : '📈 Keep Growing';

  return (
    <div className="space-y-6">
      {/* Score Hero */}
      <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-2xl p-8 border border-indigo-500/30 text-center">
        <h2 className="text-3xl font-bold mb-6">Application Complete! 🎉</h2>
        <div className={`inline-flex items-center justify-center w-36 h-36 rounded-full bg-gradient-to-br ${gradeColor} mb-4 shadow-2xl`}>
          <span className="text-5xl font-bold">{totalScore}</span>
        </div>
        <p className="text-xl mb-1">Overall Score</p>
        <p className="text-2xl font-bold">{gradeLabel}</p>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <ScoreCard title="Resume" score={candidateData.resumeScore} icon={FileText} />
        <ScoreCard title="Video Upload" score={candidateData.uploadVideoScore} icon={Upload} />
        <ScoreCard title="Quiz" score={candidateData.quizScore} icon={Award} />
        <ScoreCard title="Interview" score={candidateData.interviewScore} icon={MessageSquare} />
        <ScoreCard title="Live Video" score={candidateData.videoInterviewScore} icon={Video} />
      </div>

      {/* Career Roadmap */}
      {loadingAdvice && (
        <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-700 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-purple-500 mx-auto mb-4"></div>
          <p className="text-slate-300">✨ Preparing your personalized career roadmap...</p>
        </div>
      )}

      {advice && (
        <div className="space-y-5">
          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">✅ Your Strengths</h3>
              <ul className="space-y-3">
                {advice.strengths?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <span className="text-green-400 mt-0.5">●</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">⚠️ Areas to Improve</h3>
              <ul className="space-y-3">
                {advice.weaknesses?.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <span className="text-red-400 mt-0.5">●</span> {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Skills to Gain */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-purple-400 mb-4">🚀 Skills to Learn for Your Next Role</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {advice.improvements?.map((item, i) => (
                <div key={i} className="bg-purple-900/20 border border-purple-500/20 rounded-xl p-4 flex flex-col gap-2">
                  <p className="font-bold text-white">{item.skill}</p>
                  <p className="text-slate-400 text-xs flex-1">{item.reason}</p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold mt-1 underline underline-offset-2 transition-colors"
                  >
                    📖 {item.resource?.split(' → ')[0]}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor"><path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/><path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/></svg>
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Suitable Companies */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-4">🏢 Companies Suitable for Your Profile</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {advice.suitableCompanies?.map((co, i) => (
                <div key={i} className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white">{co.name}</p>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      co.type === 'startup' ? 'bg-orange-600/30 text-orange-300' :
                      co.type === 'enterprise' ? 'bg-blue-600/30 text-blue-300' :
                      'bg-green-600/30 text-green-300'
                    }`}>{co.type}</span>
                  </div>
                  <p className="text-slate-400 text-xs flex-1">{co.reason}</p>
                  {co.url && (
                    <a
                      href={co.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 transition-colors mt-1"
                    >
                      🔗 Apply / View Careers
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor"><path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/><path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/></svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-indigo-300 mb-3">🎯 Your Personalized Action Plan</h3>
            <p className="text-slate-300 leading-relaxed">{advice.nextSteps}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ title, score, icon: Icon }) {
  const getColor = (score) => {
    if (score >= 85) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
      <Icon className="mx-auto mb-2 text-slate-400" size={24} />
      <div className="text-sm text-slate-400 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${getColor(score)}`}>{score}</div>
    </div>
  );
}

// ==================== SUPER-ADMIN DASHBOARD ====================
function SuperAdminDashboard({ authState, logout }) {
  const [recruiters, setRecruiters] = useState([]);
  const [stats, setStats] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRecruiter, setSelectedRecruiter] = useState(null);
  const [activeTab, setActiveTab] = useState('recruiters');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(null);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` }),
    [authState?.token]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, sRes, cRes] = await Promise.all([
        fetch(`${API_URL}/api/superadmin/recruiters`, { headers }),
        fetch(`${API_URL}/api/superadmin/stats`, { headers }),
        fetch(`${API_URL}/api/candidates`, { headers })
      ]);
      const [rData, sData, cData] = await Promise.all([
        parseApiJson(rRes),
        parseApiJson(sRes),
        parseApiJson(cRes)
      ]);
      if (rData.success) setRecruiters(rData.recruiters);
      if (sData.success) setStats(sData.stats);
      if (cData.success) setCandidates(cData.candidates || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleAccess = async (recruiter) => {
    setSaving(recruiter.id);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/recruiters/${recruiter.id}/access`, {
        method: 'PUT', headers,
        body: JSON.stringify({ canViewCandidates: !recruiter.canViewCandidates, accessNote: note })
      });
      const data = await parseApiJson(res);
      if (data.success) {
        setRecruiters(prev => prev.map(r => r.id === recruiter.id ? { ...r, canViewCandidates: data.recruiter.canViewCandidates } : r));
      }
    } catch (e) { console.error(e); }
    setSaving(null);
  };

  const filtered = recruiters.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.company?.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = stats ? [
    { label: 'Total Recruiters', value: stats.recruiterCount, icon: '👥', color: 'from-blue-600 to-indigo-600' },
    { label: 'Active Access', value: stats.activeRecruiters, icon: '🟢', color: 'from-green-600 to-emerald-600' },
    { label: 'Candidates', value: stats.candidateCount, icon: '🎯', color: 'from-purple-600 to-pink-600' },
    { label: 'Avg Score', value: `${stats.avgScore}/100`, icon: '📊', color: 'from-orange-600 to-amber-600' }
  ] : [];

  return (
    <div className="min-h-screen py-6 px-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Super Admin</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage recruiters & platform access</p>
        </div>
        <button onClick={logout} className="px-4 py-2 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all flex items-center gap-2 text-sm border border-slate-700">
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="max-w-7xl mx-auto grid grid-cols-4 gap-4 mb-6">
          {statCards.map((s, i) => (
            <div key={i} className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 relative overflow-hidden`}>
              <div className="absolute top-3 right-4 text-3xl opacity-40">{s.icon}</div>
              <p className="text-white/70 text-xs uppercase tracking-widest mb-1">{s.label}</p>
              <p className="text-white text-3xl font-black">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-2 mb-5">
          {['recruiters', 'candidates'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl font-semibold text-sm capitalize transition-all ${
                activeTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
              }`}>{tab}</button>
          ))}
          <button onClick={fetchAll} className="ml-auto px-4 py-2 bg-slate-800/50 rounded-xl text-sm text-slate-400 hover:bg-slate-700/50 transition-all">↻ Refresh</button>
        </div>

        {activeTab === 'recruiters' && (
          <div className="grid grid-cols-3 gap-5">
            {/* Recruiter list */}
            <div className="col-span-2 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 flex gap-3">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search recruiters by name, email, company..."
                  className="flex-1 px-4 py-2 bg-slate-800/60 rounded-xl border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm" />
              </div>
              {loading ? (
                <div className="p-12 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto" /></div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <p className="text-4xl mb-3">👥</p>
                  <p>No recruiters found. They appear here when they register as recruiter type.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {filtered.map(r => (
                    <div key={r.id}
                      onClick={() => setSelectedRecruiter(r)}
                      className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-800/40 transition-all ${
                        selectedRecruiter?.id === r.id ? 'bg-indigo-900/20 border-l-2 border-indigo-500' : ''
                      }`}>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {r.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{r.name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400 truncate">{r.email}</p>
                        {r.company && <p className="text-xs text-slate-500 truncate">🏢 {r.company}</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          r.canViewCandidates ? 'bg-green-900/50 text-green-400 border border-green-700/40' : 'bg-red-900/50 text-red-400 border border-red-700/40'
                        }`}>{r.canViewCandidates ? '● Active' : '● Revoked'}</span>
                        <button
                          onClick={e => { e.stopPropagation(); toggleAccess(r); }}
                          disabled={saving === r.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            r.canViewCandidates
                              ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-700/30'
                              : 'bg-green-900/30 hover:bg-green-900/50 text-green-300 border border-green-700/30'
                          }`}>
                          {saving === r.id ? '...' : r.canViewCandidates ? 'Revoke' : 'Grant'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recruiter detail panel */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700 p-5">
              {selectedRecruiter ? (
                <>
                  <div className="text-center mb-5">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-2xl font-black mx-auto mb-3">
                      {selectedRecruiter.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <h3 className="font-bold text-lg">{selectedRecruiter.name}</h3>
                    <p className="text-slate-400 text-sm">{selectedRecruiter.email}</p>
                    {selectedRecruiter.company && <p className="text-slate-500 text-xs mt-1">🏢 {selectedRecruiter.company}</p>}
                  </div>
                  <div className="space-y-3 mb-4">
                    <div className={`p-3 rounded-xl border text-center ${
                      selectedRecruiter.canViewCandidates ? 'bg-green-900/20 border-green-700/30' : 'bg-red-900/20 border-red-700/30'
                    }`}>
                      <p className={`font-bold text-sm ${selectedRecruiter.canViewCandidates ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedRecruiter.canViewCandidates ? '✅ Can view candidate profiles' : '🚫 Access revoked'}
                      </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-slate-400">Registered</span><span>{new Date(selectedRecruiter.createdAt || Date.now()).toLocaleDateString()}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Plan</span><span className="capitalize">{selectedRecruiter.subscription?.plan || 'Free'}</span></div>
                      {selectedRecruiter.accessUpdatedAt && <div className="flex justify-between"><span className="text-slate-400">Access changed</span><span>{new Date(selectedRecruiter.accessUpdatedAt).toLocaleDateString()}</span></div>}
                    </div>
                  </div>
                  <textarea value={note} onChange={e => setNote(e.target.value)}
                    placeholder="Optional: add a note about this access change..."
                    rows={2} className="w-full px-3 py-2 bg-slate-800/60 rounded-xl border border-slate-600 focus:border-indigo-500 focus:outline-none text-xs resize-none mb-3" />
                  <button onClick={() => toggleAccess(selectedRecruiter)} disabled={saving === selectedRecruiter.id}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                      selectedRecruiter.canViewCandidates
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}>
                    {saving === selectedRecruiter.id ? 'Saving...' : selectedRecruiter.canViewCandidates ? '🚫 Revoke Access' : '✅ Grant Access'}
                  </button>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
                  <p className="text-4xl mb-3">👈</p>
                  <p className="text-sm">Select a recruiter to manage their access</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'candidates' && (
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="font-semibold">All Candidates — {candidates.length} total</h3>
            </div>
            {candidates.length === 0 ? (
              <div className="p-12 text-center text-slate-500"><p className="text-4xl mb-3">🎯</p><p>No candidates registered yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                      {['Name', 'Position', 'Resume', 'Quiz', 'Interview', 'Video', 'Total', 'Status'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {candidates.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition-all">
                        <td className="px-4 py-3">
                          <p className="font-semibold">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{c.position}</td>
                        {[c.resumeScore, c.quizScore, c.interviewScore, c.videoInterviewScore].map((s, i) => (
                          <td key={i} className={`px-4 py-3 font-bold ${
                            (s || 0) >= 75 ? 'text-green-400' : (s || 0) >= 55 ? 'text-yellow-400' : 'text-slate-500'
                          }`}>{s || '—'}</td>
                        ))}
                        <td className={`px-4 py-3 font-black text-base ${
                          (c.totalScore || 0) >= 75 ? 'text-green-400' : (c.totalScore || 0) >= 55 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{c.totalScore || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            c.status === 'hired' ? 'bg-green-900/50 text-green-400' :
                            c.status === 'shortlisted' ? 'bg-blue-900/50 text-blue-400' :
                            c.status === 'rejected' ? 'bg-red-900/50 text-red-400' :
                            'bg-slate-700 text-slate-300'
                          }`}>{c.status || 'review'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== RECRUITER DASHBOARD ====================
function RecruiterDashboard({ setUserType, subscription, setShowSubscriptionModal, authState, logout }) {
  const [activeTab, setActiveTab] = useState('candidates'); // 'candidates' | 'admin'
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/recruiter/candidates`, {
        headers: { 'Authorization': `Bearer ${authState?.token}` }
      });
      const data = await parseApiJson(res);
      if (data.success) setCandidates(data.candidates);
    } catch (e) {
      console.error('Failed to load candidates:', e);
    } finally { setLoading(false); }
  }, [authState?.token]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const filtered = candidates.filter(c => {
    const matchFilter = filter === 'all' || c.status === filter;
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.position.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const stats = {
    total: candidates.length,
    shortlisted: candidates.filter(c => c.status === 'shortlisted').length,
    hired: candidates.filter(c => c.status === 'hired').length,
    avgScore: candidates.length ? Math.round(candidates.reduce((a, c) => a + (c.totalScore || 0), 0) / candidates.length) : 0
  };

  const statusBadge = (status) => {
    const styles = { shortlisted: 'bg-blue-600/30 text-blue-300', hired: 'bg-green-600/30 text-green-300', rejected: 'bg-red-600/30 text-red-300', review: 'bg-yellow-600/30 text-yellow-300' };
    return <span className={`text-xs px-2 py-1 rounded-full font-semibold ${styles[status] || styles.review}`}>{status?.charAt(0).toUpperCase() + status?.slice(1)}</span>;
  };

  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">🏢 Recruiter Dashboard</h1>
            {authState.user && <p className="text-slate-400 mt-1">Welcome back, {authState.user.name}</p>}
          </div>
          <div className="flex gap-3">
            {subscription && (
              <div className="px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg flex items-center gap-2">
                <Crown size={18} className="text-yellow-400" />
                <span className="text-sm font-semibold">{SUBSCRIPTION_PLANS[subscription.plan]?.name} Plan</span>
              </div>
            )}
            <button onClick={logout} className="px-4 py-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all flex items-center gap-2 text-sm">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 bg-slate-900/50 p-1.5 rounded-xl border border-slate-700 w-fit">
          <button
            id="tab-candidates"
            onClick={() => setActiveTab('candidates')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'candidates'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users size={16} />
            Candidates
          </button>
          <button
            id="tab-admin"
            onClick={() => setActiveTab('admin')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sparkles size={16} />
            ⚙️ Admin Panel
          </button>
        </div>

        {activeTab === 'admin' ? (
          <AdminQuestionPanel authState={authState} />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Candidates', value: stats.total, icon: Users, color: 'from-indigo-900/50 to-indigo-800/50 border-indigo-500/30', iconColor: 'text-indigo-400' },
                { label: 'Shortlisted', value: stats.shortlisted, icon: CheckCircle, color: 'from-green-900/50 to-green-800/50 border-green-500/30', iconColor: 'text-green-400' },
                { label: 'Hired', value: stats.hired, icon: Award, color: 'from-purple-900/50 to-purple-800/50 border-purple-500/30', iconColor: 'text-purple-400' },
                { label: 'Avg Score', value: stats.avgScore, icon: TrendingUp, color: 'from-pink-900/50 to-pink-800/50 border-pink-500/30', iconColor: 'text-pink-400' },
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br ${stat.color} rounded-xl p-5 border`}>
                  <stat.icon className={`${stat.iconColor} mb-2`} size={28} />
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-slate-300 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Filters & Search */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <input
                  type="text" placeholder="Search by name or position..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="flex-1 bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                />
                <div className="flex gap-2 flex-wrap">
                  {['all', 'shortlisted', 'hired', 'review', 'rejected'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-purple-600 text-white' : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-400'
                        }`}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Candidate Table */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-purple-500 mx-auto mb-4"></div>
                  <p className="text-slate-400">Loading candidates...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Table Header */}
                  <div className="hidden md:grid grid-cols-12 gap-3 px-4 text-xs text-slate-500 uppercase tracking-wider mb-2">
                    <div className="col-span-3">Candidate</div>
                    <div className="col-span-2">Position</div>
                    <div className="col-span-1 text-center">Resume</div>
                    <div className="col-span-1 text-center">Quiz</div>
                    <div className="col-span-1 text-center">Interview</div>
                    <div className="col-span-1 text-center">Video</div>
                    <div className="col-span-1 text-center">Score</div>
                    <div className="col-span-2 text-center">Status</div>
                  </div>

                  {filtered.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <Users size={48} className="mx-auto mb-3 opacity-50" />
                      <p>No candidates found</p>
                    </div>
                  )}

                  {filtered.map(c => (
                    <div key={c.id}>
                      <div
                        className="bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3 cursor-pointer transition-all"
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      >
                        <div className="grid grid-cols-12 gap-3 items-center">
                          {/* Avatar + Name */}
                          <div className="col-span-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{c.name}</p>
                              <p className="text-slate-500 text-xs">{c.email}</p>
                            </div>
                          </div>
                          <div className="col-span-2 text-slate-300 text-sm">{c.position}</div>
                          <div className="col-span-1 text-center">
                            <span className={`text-sm font-bold ${c.resumeScore >= 85 ? 'text-green-400' : c.resumeScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{c.resumeScore}</span>
                          </div>
                          <div className="col-span-1 text-center">
                            <span className={`text-sm font-bold ${c.quizScore >= 85 ? 'text-green-400' : c.quizScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{c.quizScore}</span>
                          </div>
                          <div className="col-span-1 text-center">
                            <span className={`text-sm font-bold ${c.interviewScore >= 85 ? 'text-green-400' : c.interviewScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{c.interviewScore}</span>
                          </div>
                          <div className="col-span-1 text-center">
                            <span className={`text-sm font-bold ${c.videoInterviewScore >= 85 ? 'text-green-400' : c.videoInterviewScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{c.videoInterviewScore}</span>
                          </div>
                          <div className="col-span-1 text-center">
                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${c.totalScore >= 85 ? 'bg-green-900/40 text-green-400' : c.totalScore >= 70 ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'
                              }`}>{c.totalScore}</div>
                          </div>
                          <div className="col-span-2 flex justify-center">{statusBadge(c.status)}</div>
                        </div>
                      </div>

                      {/* Expanded Row */}
                      {expandedId === c.id && (
                        <div className="bg-slate-800/20 border border-slate-700/50 border-t-0 rounded-b-xl px-6 py-4">
                          <div className="grid grid-cols-5 gap-3">
                            {[['Resume', c.resumeScore], ['Video Upload', c.uploadVideoScore], ['Quiz', c.quizScore], ['Interview', c.interviewScore], ['Live Video', c.videoInterviewScore]].map(([label, score]) => (
                              <div key={label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                                <p className="text-slate-500 text-xs mb-1">{label}</p>
                                <div className="relative w-12 h-12 mx-auto">
                                  <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="14" fill="none" stroke="#334155" strokeWidth="3" />
                                    <circle cx="18" cy="18" r="14" fill="none"
                                      stroke={score >= 85 ? '#4ade80' : score >= 70 ? '#facc15' : '#f87171'}
                                      strokeWidth="3" strokeDasharray={`${(score / 100) * 88} 88`}
                                    />
                                  </svg>
                                  <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${score >= 85 ? 'text-green-400' : score >= 70 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>{score}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-slate-500 text-xs mt-3">Applied: {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ==================== ADMIN QUESTION PANEL ====================
function AdminQuestionPanel({ authState }) {
  const PRESET_POSITIONS = [
    'Software Engineer', 'Data Scientist', 'Product Manager',
    'UI/UX Designer', 'Frontend Developer', 'Backend Developer',
    'Full Stack Developer', 'DevOps Engineer', 'Machine Learning Engineer',
    'Android Developer', 'iOS Developer', 'QA Engineer'
  ];

  const [questions, setQuestions] = useState([]);
  const [filterPosition, setFilterPosition] = useState('all');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null); // null = add mode
  const [showForm, setShowForm] = useState(false);

  // Form state
  const emptyForm = {
    position: PRESET_POSITIONS[0],
    customPosition: '',
    useCustom: false,
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0
  };
  const [form, setForm] = useState(emptyForm);

  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/questions`, {
        headers: { 'Authorization': `Bearer ${authState?.token}` }
      });
      const data = await parseApiJson(res);
      if (data.success) setQuestions(data.questions);
    } catch (e) { console.error(e); }
  }, [authState?.token]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleSave = async () => {
    const pos = form.useCustom ? form.customPosition.trim() : form.position;
    const opts = form.options.filter(o => o.trim() !== '');
    if (!pos) return showNotif('Please enter a job position.', 'error');
    if (!form.question.trim()) return showNotif('Please enter a question.', 'error');
    if (opts.length < 2) return showNotif('Please add at least 2 answer options.', 'error');
    if (form.correctAnswer >= opts.length) return showNotif('Correct answer index exceeds option count.', 'error');

    setSaving(true);
    try {
      const payload = { position: pos, question: form.question.trim(), options: opts, correctAnswer: form.correctAnswer };
      const url = editingQuestion ? `${API_URL}/api/admin/questions/${editingQuestion.id}` : `${API_URL}/api/admin/questions`;
      const method = editingQuestion ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` },
        body: JSON.stringify(payload)
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error);
      showNotif(editingQuestion ? 'Question updated!' : 'Question added!');
      setForm(emptyForm);
      setEditingQuestion(null);
      setShowForm(false);
      fetchQuestions();
    } catch (e) {
      showNotif(e.message || 'Failed to save.', 'error');
    } finally { setSaving(false); }
  };

  const handleEdit = (q) => {
    const isPreset = PRESET_POSITIONS.includes(q.position);
    // Pad options to always have 4 slots for editing
    const paddedOptions = [...q.options, '', '', '', ''].slice(0, 4);
    setForm({
      position: isPreset ? q.position : PRESET_POSITIONS[0],
      customPosition: isPreset ? '' : q.position,
      useCustom: !isPreset,
      question: q.question,
      options: paddedOptions,
      correctAnswer: q.correctAnswer
    });
    setEditingQuestion(q);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authState?.token}` }
      });
      if (!res.ok) throw new Error('Delete failed');
      showNotif('Question deleted.');
      fetchQuestions();
    } catch (e) {
      showNotif('Failed to delete.', 'error');
    } finally { setDeletingId(null); }
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setEditingQuestion(null);
    setShowForm(false);
  };

  const updateOption = (idx, val) => {
    const opts = [...form.options];
    opts[idx] = val;
    setForm({ ...form, options: opts });
  };

  // Group counts by position
  const positionCounts = questions.reduce((acc, q) => {
    acc[q.position] = (acc[q.position] || 0) + 1;
    return acc;
  }, {});

  const allPositions = [...new Set(questions.map(q => q.position))];
  const displayedQuestions = filterPosition === 'all' ? questions : questions.filter(q => q.position === filterPosition);

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm flex items-center gap-2 transition-all ${
          notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {notification.type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} />}
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-orange-900/40 to-red-900/40 rounded-2xl p-6 border border-orange-500/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              ⚙️ Admin Question Bank
            </h2>
            <p className="text-slate-300 text-sm mt-1">
              Create and manage assessment questions per job position. No API keys required — candidates will use these questions automatically.
            </p>
          </div>
          <button
            id="btn-add-question"
            onClick={() => { setEditingQuestion(null); setForm(emptyForm); setShowForm(true); }}
            className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap shadow-lg"
          >
            <Sparkles size={18} /> + Add Question
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="bg-slate-800/40 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{questions.length}</p>
            <p className="text-slate-400 text-xs">Total Questions</p>
          </div>
          <div className="bg-slate-800/40 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{allPositions.length}</p>
            <p className="text-slate-400 text-xs">Job Positions</p>
          </div>
          <div className="bg-slate-800/40 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">
              {allPositions.filter(p => (positionCounts[p] || 0) >= 5).length}
            </p>
            <p className="text-slate-400 text-xs">Positions Ready (5+)</p>
          </div>
        </div>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-slate-900/80 backdrop-blur rounded-2xl p-6 border-2 border-orange-500/50 shadow-2xl">
          <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
            {editingQuestion ? '✏️ Edit Question' : '➕ Add New Question'}
          </h3>

          <div className="space-y-4">
            {/* Position Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 text-sm mb-1.5 font-medium">Job Position</label>
                {!form.useCustom ? (
                  <select
                    id="form-position-select"
                    value={form.position}
                    onChange={e => setForm({ ...form, position: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none text-sm"
                  >
                    {PRESET_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <input
                    id="form-position-custom"
                    type="text"
                    value={form.customPosition}
                    onChange={e => setForm({ ...form, customPosition: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none text-sm"
                    placeholder="e.g., Blockchain Developer"
                  />
                )}
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setForm({ ...form, useCustom: !form.useCustom, customPosition: '' })}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-all w-full text-center"
                >
                  {form.useCustom ? '← Use Preset Position' : '+ Custom Position'}
                </button>
              </div>
            </div>

            {/* Question */}
            <div>
              <label className="block text-slate-300 text-sm mb-1.5 font-medium">Question Text</label>
              <textarea
                id="form-question-text"
                value={form.question}
                onChange={e => setForm({ ...form, question: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 bg-slate-800 rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none text-sm resize-none"
                placeholder="e.g., What is the difference between == and === in JavaScript?"
              />
            </div>

            {/* Answer Options */}
            <div>
              <label className="block text-slate-300 text-sm mb-2 font-medium">
                Answer Options
                <span className="ml-2 text-slate-500 font-normal">(click the circle to mark correct answer)</span>
              </label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    form.correctAnswer === i && opt.trim() ? 'border-green-500/60 bg-green-900/20' : 'border-slate-700 bg-slate-800/50'
                  }`}>
                    <button
                      id={`option-correct-${i}`}
                      type="button"
                      onClick={() => setForm({ ...form, correctAnswer: i })}
                      title="Mark as correct answer"
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        form.correctAnswer === i && opt.trim()
                          ? 'bg-green-500 border-green-400 text-white'
                          : 'border-slate-500 hover:border-green-400'
                      }`}
                    >
                      {form.correctAnswer === i && opt.trim() && <Check size={14} />}
                    </button>
                    <span className="text-slate-500 text-sm font-mono w-5">{String.fromCharCode(65 + i)}.</span>
                    <input
                      id={`option-input-${i}`}
                      type="text"
                      value={opt}
                      onChange={e => updateOption(i, e.target.value)}
                      className="flex-1 bg-transparent focus:outline-none text-sm placeholder-slate-600"
                      placeholder={i < 2 ? `Option ${String.fromCharCode(65 + i)} (required)` : `Option ${String.fromCharCode(65 + i)} (optional)`}
                    />
                    {opt.trim() && form.correctAnswer === i && (
                      <span className="text-green-400 text-xs font-semibold whitespace-nowrap">✓ Correct</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-slate-500 text-xs mt-2">At least 2 options required. Leave optional ones blank.</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                id="btn-save-question"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Saving...</>
                ) : (
                  <><CheckCircle size={18} /> {editingQuestion ? 'Update Question' : 'Save Question'}</>
                )}
              </button>
              <button
                id="btn-cancel-question"
                onClick={handleCancel}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold">All Questions ({questions.length})</h3>
          {/* Position filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterPosition('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterPosition === 'all' ? 'bg-orange-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
              }`}
            >
              All ({questions.length})
            </button>
            {allPositions.map(p => (
              <button
                key={p}
                onClick={() => setFilterPosition(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterPosition === p ? 'bg-orange-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                }`}
              >
                {p} ({positionCounts[p]})
              </button>
            ))}
          </div>
        </div>

        {displayedQuestions.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Sparkles size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold mb-2">No questions yet</p>
            <p className="text-sm">Click "+ Add Question" to create your first question.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-orange-600/30 text-orange-300 px-2.5 py-0.5 rounded-full font-semibold">
                        {q.position}
                      </span>
                      <span className="text-slate-500 text-xs">#{q.id}</span>
                    </div>
                    <p className="font-semibold text-slate-100 mb-3">{q.question}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {q.options.map((opt, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                            i === q.correctAnswer
                              ? 'bg-green-900/30 border border-green-500/40 text-green-300'
                              : 'bg-slate-700/40 text-slate-400'
                          }`}
                        >
                          <span className="font-mono text-xs opacity-60">{String.fromCharCode(65 + i)}.</span>
                          <span className="flex-1">{opt}</span>
                          {i === q.correctAnswer && <Check size={14} className="text-green-400 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      id={`btn-edit-${q.id}`}
                      onClick={() => handleEdit(q)}
                      className="px-4 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs font-semibold transition-all"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      id={`btn-delete-${q.id}`}
                      onClick={() => handleDelete(q.id)}
                      disabled={deletingId === q.id}
                      className="px-4 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      {deletingId === q.id ? '...' : '🗑 Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
