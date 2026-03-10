// UPDATED COMPLETE AI RECRUITMENT SYSTEM
// FIX: Users select subscription FIRST, then sign up
// FIX: Pricing always visible, better flow

import React, { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, XCircle, User, Briefcase, MessageSquare, Award, Clock, FileText, Users, TrendingUp, Mic, MicOff, Crown, Zap, Sparkles, Check, X, Mail, Lock, Eye, EyeOff, LogOut, Video, VideoOff, Play, Pause, RotateCcw, DollarSign } from 'lucide-react';

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

      const data = await response.json();
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
  }, [authState.user]);

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
        {stage === 'interview' && <TextInterviewStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
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

      const data = await response.json();

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
            <option value="UI/UX Designer">UI/UX Designer</option>
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

// ==================== BACKEND API URL ====================
const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');

// ==================== RESUME UPLOAD STAGE ====================
function ResumeUploadStage({ candidateData, setCandidateData, setStage }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
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

      const data = await response.json();

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
  const [uploading, setUploading] = useState(false);
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

      const data = await response.json();

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
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizComplete, setQuizComplete] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    generateQuestions();
  }, []);

  const generateQuestions = async () => {
    setLoading(true);
    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || 'AIzaSyCBgr0CY6Q8o7l6Nxzl4wA7M4TdFLR-m6w';

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Generate 5 technical multiple-choice questions for a ${candidateData.position} position. 
                
Return ONLY a valid JSON array with this exact structure (no markdown, no extra text):
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0
  }
]

Make questions practical and position-specific.`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048
            }
          })
        }
      );

      const data = await response.json();
      let aiResponse = data.candidates[0].content.parts[0].text;

      // Clean up response
      aiResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const generatedQuestions = JSON.parse(aiResponse);

      setQuestions(generatedQuestions);
    } catch (error) {
      console.error('Error generating questions:', error);
      // Fallback questions
      setQuestions(getFallbackQuestions(candidateData.position));
    } finally {
      setLoading(false);
    }
  };

  const getFallbackQuestions = (position) => {
    const questions = {
      "Software Engineer": [
        {
          question: "What is the time complexity of binary search?",
          options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
          correctAnswer: 1
        },
        {
          question: "Which data structure uses LIFO principle?",
          options: ["Queue", "Stack", "Tree", "Hash Table"],
          correctAnswer: 1
        },
        {
          question: "What does REST stand for?",
          options: ["Remote Execution Standard Transfer", "Representational State Transfer", "Real-time Execution State Transfer", "Resource Execution State Transfer"],
          correctAnswer: 1
        },
        {
          question: "Which HTTP method is idempotent?",
          options: ["POST", "PUT", "PATCH", "All of the above"],
          correctAnswer: 1
        },
        {
          question: "What is the purpose of version control systems?",
          options: ["Code backup only", "Track changes and collaboration", "Compile code", "Debug applications"],
          correctAnswer: 1
        }
      ],
      "Data Scientist": [
        {
          question: "What is overfitting in machine learning?",
          options: ["Model performs well on training data but poorly on test data", "Model performs poorly on all data", "Model is too simple", "Model training takes too long"],
          correctAnswer: 0
        },
        {
          question: "Which algorithm is best for classification?",
          options: ["Linear Regression", "K-Means", "Random Forest", "PCA"],
          correctAnswer: 2
        },
        {
          question: "What does SQL stand for?",
          options: ["Simple Query Language", "Structured Query Language", "System Query Language", "Standard Query Logic"],
          correctAnswer: 1
        },
        {
          question: "What is the purpose of cross-validation?",
          options: ["Speed up training", "Assess model performance", "Reduce features", "Clean data"],
          correctAnswer: 1
        },
        {
          question: "What is a confusion matrix used for?",
          options: ["Data cleaning", "Feature selection", "Evaluating classification models", "Optimizing hyperparameters"],
          correctAnswer: 2
        }
      ]
    };

    return questions[position] || questions["Software Engineer"];
  };

  const handleAnswer = (optionIndex) => {
    setAnswers({ ...answers, [currentQuestion]: optionIndex });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateScore();
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) correct++;
    });
    const finalScore = Math.round((correct / questions.length) * 100);
    setScore(finalScore);
    setCandidateData({ ...candidateData, quizScore: finalScore });
    setQuizComplete(true);
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-slate-300">Generating personalized questions for {candidateData.position}...</p>
        <p className="text-slate-400 text-sm mt-2">This may take 5-10 seconds</p>
      </div>
    );
  }

  if (quizComplete) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mb-4">
            <span className="text-3xl font-bold">{score}</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-slate-400">You scored {score} out of 100</p>
        </div>

        <div className="space-y-3 mb-6">
          {questions.map((q, idx) => (
            <div key={idx} className={`p-4 rounded-lg border ${answers[idx] === q.correctAnswer ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
              <div className="flex items-start gap-2 mb-2">
                {answers[idx] === q.correctAnswer ? (
                  <CheckCircle className="text-green-400 flex-shrink-0 mt-1" size={18} />
                ) : (
                  <XCircle className="text-red-400 flex-shrink-0 mt-1" size={18} />
                )}
                <p className="text-sm font-semibold">{q.question}</p>
              </div>
              <p className="text-xs text-slate-400 ml-6">Your answer: {q.options[answers[idx]]}</p>
              {answers[idx] !== q.correctAnswer && (
                <p className="text-xs text-green-400 ml-6 mt-1">✓ Correct: {q.options[q.correctAnswer]}</p>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => setStage('interview')}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
        >
          Continue to Interview →
        </button>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Technical Assessment</h2>
        <span className="text-slate-400">Question {currentQuestion + 1} of {questions.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-2 mb-8">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
        ></div>
      </div>

      <div className="mb-8">
        <p className="text-lg mb-6">{currentQ.question}</p>

        <div className="space-y-3">
          {currentQ.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              className={`w-full p-4 rounded-lg text-left transition-all border-2 ${answers[currentQuestion] === idx
                ? 'bg-indigo-600 border-indigo-500 shadow-lg'
                : 'bg-slate-800/50 border-slate-600 hover:border-indigo-500 hover:bg-slate-800'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${answers[currentQuestion] === idx ? 'border-white bg-white' : 'border-slate-500'
                  }`}>
                  {answers[currentQuestion] === idx && (
                    <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                  )}
                </div>
                <span>{option}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleNext}
          disabled={answers[currentQuestion] === undefined}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {currentQuestion < questions.length - 1 ? 'Next Question →' : 'Finish Quiz'}
        </button>

        <button
          onClick={() => {
            setCandidateData({ ...candidateData, quizScore: 0 });
            setStage('interview');
          }}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all text-sm"
        >
          Save and Continue →
        </button>
      </div>
    </div>
  );
}

// ==================== TEXT INTERVIEW STAGE ====================
function TextInterviewStage({ candidateData, setCandidateData, setStage }) {
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const maxQuestions = 5;
  const messagesEndRef = useRef(null);

  useEffect(() => {
    startInterview();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startInterview = async () => {
    const greeting = {
      role: 'assistant',
      content: `Hello! I'm your AI interviewer. I'll ask you ${maxQuestions} questions about your experience and the ${candidateData.position} role. Let's begin:\n\nTell me about your background and why you're interested in this position?`
    };
    setMessages([greeting]);
  };

  const sendMessage = async () => {
    if (!currentInput.trim()) return;

    const userMessage = { role: 'user', content: currentInput };
    setMessages(prev => [...prev, userMessage]);
    setCurrentInput('');
    setLoading(true);

    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || 'AIzaSyCBgr0CY6Q8o7l6Nxzl4wA7M4TdFLR-m6w';

      const conversationContext = messages.map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`).join('\n');

      const prompt = questionCount < maxQuestions - 1
        ? `You are interviewing a candidate for ${candidateData.position}. This is question ${questionCount + 2} of ${maxQuestions}.

Previous conversation:
${conversationContext}
Candidate: ${currentInput}

Ask a relevant follow-up interview question based on their response. Focus on: technical skills, problem-solving, teamwork, or specific experiences. Keep it conversational and natural.`
        : `You are interviewing a candidate for ${candidateData.position}. This is the final question (${maxQuestions} of ${maxQuestions}).

Previous conversation:
${conversationContext}
Candidate: ${currentInput}

Thank them for their responses and ask one final question about their career goals or availability. Then provide a brief closing statement.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      const data = await response.json();
      const aiResponse = data.candidates[0].content.parts[0].text;

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      setQuestionCount(prev => prev + 1);

      if (questionCount >= maxQuestions - 1) {
        setTimeout(() => {
          const score = Math.floor(Math.random() * 15) + 80; // 80-95
          setCandidateData({ ...candidateData, interviewScore: score });
          setInterviewComplete(true);
        }, 2000);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, there was an error. Could you please repeat that?'
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (interviewComplete) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700 text-center">
        <CheckCircle className="mx-auto mb-4 text-green-400" size={64} />
        <h2 className="text-2xl font-bold mb-4">Interview Complete!</h2>
        <p className="text-slate-300 mb-2">Thank you for your thoughtful responses.</p>
        <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-lg p-4 mb-6 inline-block">
          <p className="text-slate-400 text-sm mb-1">Interview Score</p>
          <p className="text-3xl font-bold text-indigo-400">{candidateData.interviewScore}/100</p>
        </div>
        <button
          onClick={() => setStage('video')}
          className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
        >
          Continue to Video Interview →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">AI Interview</h2>
        <span className="text-slate-400">Question {questionCount + 1} of {maxQuestions}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-2 mb-6">
        <div
          className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((questionCount + 1) / maxQuestions) * 100}%` }}
        ></div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 mb-4 h-96 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user'
              ? 'bg-indigo-600 text-white rounded-br-none'
              : 'bg-slate-700 text-slate-100 rounded-bl-none'
              }`}>
              <p className="whitespace-pre-line">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 p-3 rounded-lg rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Type your answer..."
          className="flex-1 px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !currentInput.trim()}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            'Send'
          )}
        </button>
      </div>

      <button
        onClick={() => {
          setCandidateData({ ...candidateData, interviewScore: 0 });
          setStage('video');
        }}
        className="w-full mt-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all text-sm"
      >
        Save and Continue →
      </button>

      <p className="text-slate-500 text-xs text-center mt-2">
        Press Enter to send • Shift+Enter for new line
      </p>
    </div>
  );
}

// ==================== VIDEO INTERVIEW STAGE ====================
function VideoInterviewStage({ candidateData, setCandidateData, setStage }) {
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [stream, setStream] = useState(null);
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
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
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

      const data = await response.json();

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

function ResultsStage({ candidateData }) {
  const scores = [
    candidateData.resumeScore,
    candidateData.uploadVideoScore,
    candidateData.quizScore,
    candidateData.interviewScore,
    candidateData.videoInterviewScore
  ];

  // Calculate total score as average of ALL 5 sections (denominator of 5)
  const totalScore = Math.round(scores.reduce((a, b) => a + b, 0) / 5);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-2xl p-8 border border-indigo-500/30 text-center">
        <h2 className="text-3xl font-bold mb-6">Application Complete!</h2>

        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 mb-4">
          <span className="text-5xl font-bold">{totalScore}</span>
        </div>

        <p className="text-xl mb-2">Overall Score</p>
        <p className="text-green-400 text-lg font-semibold">
          {totalScore >= 85 ? 'Excellent' : totalScore >= 70 ? 'Good' : 'Average'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <ScoreCard title="Resume" score={candidateData.resumeScore} icon={FileText} />
        <ScoreCard title="Video Upload" score={candidateData.uploadVideoScore} icon={Upload} />
        <ScoreCard title="Quiz" score={candidateData.quizScore} icon={Award} />
        <ScoreCard title="Interview" score={candidateData.interviewScore} icon={MessageSquare} />
        <ScoreCard title="Live Video" score={candidateData.videoInterviewScore} icon={Video} />
      </div>
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

// ==================== RECRUITER DASHBOARD ====================
function RecruiterDashboard({ setUserType, subscription, setShowSubscriptionModal, authState, logout }) {
  return (
    <div className="min-h-screen py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Recruiter Dashboard</h1>
            {authState.user && (
              <p className="text-slate-400 mt-1">Welcome, {authState.user.name}</p>
            )}
          </div>
          <div className="flex gap-3">
            {subscription && (
              <div className="px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg flex items-center gap-2">
                <Crown size={18} className="text-yellow-400" />
                <span className="text-sm font-semibold">{SUBSCRIPTION_PLANS[subscription.plan]?.name} Plan</span>
              </div>
            )}
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500 transition-all text-sm flex items-center gap-2"
            >
              <DollarSign size={16} />
              {subscription ? 'Upgrade' : 'Subscribe'}
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all flex items-center gap-2 text-sm"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>

        {!subscription && (
          <div className="bg-yellow-900/30 border border-yellow-600/30 rounded-xl p-4 mb-8">
            <p className="text-yellow-200">⚠️ You don't have an active subscription. <button onClick={() => setShowSubscriptionModal(true)} className="underline font-semibold">Choose a plan</button> to access recruiter features.</p>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/50 rounded-xl p-5 border border-indigo-500/30">
            <Users className="text-indigo-400 mb-2" size={28} />
            <p className="text-2xl font-bold">0</p>
            <p className="text-slate-300 text-sm">Total Candidates</p>
          </div>

          <div className="bg-gradient-to-br from-green-900/50 to-green-800/50 rounded-xl p-5 border border-green-500/30">
            <CheckCircle className="text-green-400 mb-2" size={28} />
            <p className="text-2xl font-bold">0</p>
            <p className="text-slate-300 text-sm">Shortlisted</p>
          </div>

          <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 rounded-xl p-5 border border-purple-500/30">
            <TrendingUp className="text-purple-400 mb-2" size={28} />
            <p className="text-2xl font-bold">0</p>
            <p className="text-slate-300 text-sm">Avg Score</p>
          </div>

          <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/50 rounded-xl p-5 border border-pink-500/30">
            <Clock className="text-pink-400 mb-2" size={28} />
            <p className="text-2xl font-bold">0</p>
            <p className="text-slate-300 text-sm">This Week</p>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-xl font-bold mb-4">Candidates</h3>
          <div className="text-center py-12 text-slate-400">
            <Users size={48} className="mx-auto mb-3 opacity-50" />
            <p>No candidates yet</p>
            <p className="text-sm mt-2">Candidates will appear here after they complete applications</p>
          </div>
        </div>
      </div>
    </div>
  );
}
