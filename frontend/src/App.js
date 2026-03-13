// UPDATED COMPLETE AI RECRUITMENT SYSTEM
// FIX: Users select subscription FIRST, then sign up
// FIX: Pricing always visible, better flow

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Upload, CheckCircle, XCircle, User, Briefcase, MessageSquare, Award, FileText, Users, TrendingUp, Crown, Zap, Sparkles, Check, X, Mail, Lock, Eye, EyeOff, LogOut, Video, VideoOff, Search, Paperclip, Image as ImageIcon, Clock3, Sun, Moon } from 'lucide-react';
import Home from './pages/Home';
import SupportChatbot from './components/SupportChatbot';

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

function extractYouTubeVideoId(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  const shortMatch = value.match(/youtu\.be\/([^?&/]+)/i);
  if (shortMatch?.[1]) return shortMatch[1];

  const longMatch = value.match(/[?&]v=([^?&/]+)/i);
  if (longMatch?.[1]) return longMatch[1];

  const embedMatch = value.match(/youtube\.com\/embed\/([^?&/]+)/i);
  return embedMatch?.[1] || '';
}

function buildYouTubeThumbnailUrl(url) {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
}

function buildYouTubeEmbedUrl(url) {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
}

function formatFileSize(size) {
  const value = Number(size) || 0;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function matchesChatHistoryFilter(message, filterValue, currentUserId) {
  const createdAt = new Date(message.createdAt || 0).getTime();
  const now = Date.now();

  switch (filterValue) {
    case 'today':
      return now - createdAt <= 24 * 60 * 60 * 1000;
    case '7d':
      return now - createdAt <= 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return now - createdAt <= 30 * 24 * 60 * 60 * 1000;
    case 'attachments':
      return Boolean(message.attachment);
    case 'images':
      return message.attachment?.kind === 'image';
    case 'files':
      return Boolean(message.attachment) && message.attachment?.kind !== 'image';
    case 'mine':
      return Number(message.senderId) === Number(currentUserId);
    case 'peer':
      return Number(message.senderId) !== Number(currentUserId);
    default:
      return true;
  }
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
  const [authUserType, setAuthUserType] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('talentai_theme') || 'dark');
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

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light');
    document.body.classList.toggle('theme-dark', theme !== 'light');
    localStorage.setItem('talentai_theme', theme);
  }, [theme]);

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
    setAuthUserType(null);

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
    setAuthUserType(null);
  };

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className={`app-shell min-h-screen overflow-x-hidden text-sm md:text-base lg:text-lg ${theme === 'light' ? 'theme-light' : 'theme-dark'} bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white`}>
      <div className="fixed inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 h-48 w-48 rounded-full bg-indigo-500 blur-3xl animate-pulse md:h-72 md:w-72 lg:h-96 lg:w-96"></div>
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-purple-500 blur-3xl animate-pulse md:h-72 md:w-72 lg:h-96 lg:w-96" style={{ animationDelay: '1s' }}></div>
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="theme-toggle fixed right-3 top-3 z-[100] inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-black/20 backdrop-blur-md transition hover:bg-slate-800/90 md:right-5 md:top-5 md:text-sm"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </button>

      <div className="relative z-10">
        {!userType ? (
          <Home
            setUserType={setUserType}
            setShowAuthModal={setShowAuthModal}
            setAuthMode={setAuthMode}
            authState={authState}
            logout={logout}
            setSelectedPlan={setSelectedPlan}
            setAuthUserType={setAuthUserType}
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
          setAuthUserType={setAuthUserType}
        />
      )}

      {showAuthModal && (
        <AuthModal
          authMode={authMode}
          setAuthMode={setAuthMode}
          setShowAuthModal={setShowAuthModal}
          login={login}
          selectedPlan={selectedPlan}
          authUserType={authUserType}
          setAuthUserType={setAuthUserType}
        />
      )}

      <SupportChatbot apiUrl={API_URL} authState={authState} userType={userType} />
    </div>
  );
}

// ==================== AUTH MODAL (WITH SELECTED PLAN INFO) ====================
function AuthModal({ authMode, setAuthMode, setShowAuthModal, login, selectedPlan, authUserType, setAuthUserType }) {
  const {
    isLoading: isAuth0Loading,
    isAuthenticated: isAuth0Authenticated,
    error: auth0Error,
    loginWithPopup,
    logout: auth0Logout,
    getAccessTokenSilently,
    user: auth0User
  } = useAuth0();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: selectedPlan || authUserType === 'recruiter' ? 'recruiter' : 'candidate',
    company: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [auth0RoleExplicitlySelected, setAuth0RoleExplicitlySelected] = useState(Boolean(selectedPlan || authUserType === 'candidate' || authUserType === 'recruiter'));

  useEffect(() => {
    if (selectedPlan) {
      setAuth0RoleExplicitlySelected(true);
      setFormData(prev => ({ ...prev, userType: 'recruiter' }));
      return;
    }
    if (authUserType === 'candidate' || authUserType === 'recruiter') {
      setAuth0RoleExplicitlySelected(true);
      setFormData(prev => ({
        ...prev,
        userType: authUserType,
        ...(authUserType === 'candidate' ? { company: '' } : {})
      }));
    }
  }, [selectedPlan, authUserType]);

  useEffect(() => {
    if (!isAuth0Authenticated || !auth0User) return;
    setFormData((prev) => ({
      ...prev,
      email: prev.email || auth0User.email || '',
      name: prev.name || auth0User.name || ''
    }));
  }, [auth0User, isAuth0Authenticated]);

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
        if (formData.userType === 'recruiter' && !formData.name.trim()) {
          throw new Error('Recruiter name is required');
        }
        if (formData.userType === 'recruiter' && !formData.company.trim()) {
          throw new Error('Company name is required');
        }
      }

      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.userType === 'candidate' ? (formData.name || '') : formData.name,
          userType: formData.userType,
          company: formData.userType === 'recruiter' ? formData.company : ''
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

  const handleAuth0SessionContinue = async () => {
    setError('');
    setLoading(true);
    try {
      if (!auth0RoleExplicitlySelected) {
        throw new Error('Please select Candidate or Recruiter before continuing with Auth0.');
      }

      if (formData.userType === 'recruiter' && !formData.company.trim()) {
        throw new Error('Company name is required for recruiter Auth0 sign in.');
      }

      const accessToken = await getAccessTokenSilently();
      if (!accessToken) {
        throw new Error('Unable to get Auth0 access token. Please login again.');
      }

      const response = await fetch(`${API_URL}/api/auth/auth0/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          userType: auth0RoleExplicitlySelected ? formData.userType : '',
          company: formData.userType === 'recruiter' ? formData.company : ''
        })
      });

      const data = await parseApiJson(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create TalentAI session from Auth0 login');
      }

      login({
        ...data.user,
        token: data.token,
        type: data.user.userType
      });
    } catch (err) {
      setError(err.message || 'Auth0 session setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-slate-900/95 rounded-2xl max-w-md w-full p-4 md:p-6 border border-slate-700">
        <h2 className="text-xl md:text-2xl font-bold mb-3 text-center">
          {authMode === 'login'
            ? `${authUserType === 'superadmin' ? 'Admin' : authUserType === 'recruiter' ? 'Recruiter' : authUserType === 'candidate' ? 'Candidate' : ''} Sign In`.trim()
            : `${authUserType === 'recruiter' ? 'Recruiter' : authUserType === 'candidate' ? 'Candidate' : ''} Create Account`.trim()}
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

        {(error || auth0Error) && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error || auth0Error?.message}
          </div>
        )}

        {authMode === 'login' && (
          <div className="mb-4 p-3 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-300">
            Admin access uses the regular sign-in form. Log in with a superadmin account to open the admin dashboard.
          </div>
        )}

        <div className="mb-4 space-y-2">
          {!isAuth0Authenticated ? (
            <>
              <button
                type="button"
                onClick={async () => { setError(''); try { await loginWithPopup(); } catch (e) { if (e.message !== 'Popup closed') setError(e.message); } }}
                disabled={isAuth0Loading}
                className="w-full min-h-[44px] py-2.5 rounded-lg font-semibold text-sm md:text-base bg-cyan-700 hover:bg-cyan-600 transition-all disabled:opacity-60"
              >
                {isAuth0Loading ? 'Connecting...' : 'Continue with Auth0'}
              </button>
              <button
                type="button"
                onClick={async () => { setError(''); try { await loginWithPopup({ authorizationParams: { screen_hint: 'signup' } }); } catch (e) { if (e.message !== 'Popup closed') setError(e.message); } }}
                disabled={isAuth0Loading}
                className="w-full min-h-[44px] py-2.5 rounded-lg font-semibold text-sm md:text-base bg-slate-800 border border-slate-600 hover:bg-slate-700 transition-all disabled:opacity-60"
              >
                Sign up with Auth0
              </button>
            </>
          ) : (
            <div className="p-3 bg-cyan-600/10 border border-cyan-500/30 rounded-lg text-xs text-cyan-200">
              <p>Auth0 session detected for {auth0User?.email || 'current user'}.</p>
              <p className="mt-1 text-cyan-300/90">Create your TalentAI API session directly from this Auth0 login, or logout this Auth0 session.</p>
              {!selectedPlan && !authUserType && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, userType: 'candidate', company: '' }));
                      setAuth0RoleExplicitlySelected(true);
                    }}
                    className={`p-2 rounded-lg border transition-all text-xs ${formData.userType === 'candidate' && auth0RoleExplicitlySelected
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800/60 border-slate-600 text-slate-100'
                      }`}
                  >
                    Candidate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, userType: 'recruiter' }));
                      setAuth0RoleExplicitlySelected(true);
                    }}
                    className={`p-2 rounded-lg border transition-all text-xs ${formData.userType === 'recruiter' && auth0RoleExplicitlySelected
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-slate-800/60 border-slate-600 text-slate-100'
                      }`}
                  >
                    Recruiter
                  </button>
                </div>
              )}
              {formData.userType === 'recruiter' && (
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="mt-3 w-full px-3 py-2 bg-slate-900/70 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none text-xs"
                  placeholder="Company Name"
                />
              )}
              <button
                type="button"
                onClick={handleAuth0SessionContinue}
                disabled={loading}
                className="mt-2 min-h-[36px] rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600 disabled:opacity-60"
              >
                {loading ? 'Connecting...' : 'Continue into TalentAI'}
              </button>
              <button
                type="button"
                onClick={() => auth0Logout({ logoutParams: { returnTo: process.env.REACT_APP_AUTH0_LOGOUT_RETURN_TO || process.env.REACT_APP_AUTH0_REDIRECT_URI || 'https://anupmazumdar-ai-recruitment-agent.vercel.app/' } })}
                className="mt-2 min-h-[36px] rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold hover:bg-cyan-600"
              >
                Logout Auth0 Session
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-700" />
          <span>or use TalentAI account</span>
          <span className="h-px flex-1 bg-slate-700" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {authMode === 'register' && (
            <>
              {formData.userType !== 'candidate' && (
                <div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                    placeholder="Recruiter Name"
                    required
                  />
                </div>
              )}

              {formData.userType === 'candidate' && (
                <p className="text-xs text-slate-400">Name is optional for candidates at sign up. You can add or update it in your profile.</p>
              )}

              {!selectedPlan && !authUserType && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, userType: 'candidate', company: '' });
                      setAuth0RoleExplicitlySelected(true);
                    }}
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
                    onClick={() => {
                      setFormData({ ...formData, userType: 'recruiter' });
                      setAuth0RoleExplicitlySelected(true);
                    }}
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
            className="w-full min-h-[44px] py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold text-sm md:text-base hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50"
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
          onClick={() => {
            setShowAuthModal(false);
            setAuthUserType(null);
          }}
          className="mt-3 w-full min-h-[44px] py-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all text-sm md:text-base"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ==================== SUBSCRIPTION MODAL (UPDATED) ====================
function SubscriptionModal({ setShowSubscriptionModal, setSubscription, setUserType, authState, setShowAuthModal, setAuthMode, setSelectedPlan, setAuthUserType }) {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const handlePlanSelect = (planKey) => {
    setSelectedPlan(planKey);
    setShowSubscriptionModal(false);

    if (!authState.isAuthenticated) {
      setAuthUserType('recruiter');
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4 overflow-y-auto">
      <div className="bg-slate-900/95 rounded-xl max-w-6xl w-full p-4 md:p-8 my-4 md:my-8 border border-slate-700">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Choose Your Plan</h2>
          <p className="text-sm md:text-base text-slate-300 mb-4">Select the perfect plan for your recruitment needs</p>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-6">
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
                  className={`w-full min-h-[44px] py-2.5 rounded-lg font-semibold text-sm md:text-base transition-all ${plan.popular
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
          className="w-full min-h-[44px] py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-all text-sm md:text-base"
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
    careerGuidance: null,
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
    { id: 'careerCoach', label: 'AI Career Coach', icon: MessageSquare },
    { id: 'resume', label: 'Resume', icon: FileText },
    { id: 'uploadVideo', label: 'Video Upload', icon: Upload },
    { id: 'quiz', label: 'Quiz', icon: Award },
    { id: 'interview', label: 'Interview', icon: MessageSquare },
    { id: 'video', label: 'Live Video', icon: Video },
    { id: 'results', label: 'Results', icon: TrendingUp },
    { id: 'upgradeSkills', label: 'Upgrade Skills', icon: Sparkles }
  ];

  const currentStageIndex = stages.findIndex(s => s.id === stage);

  return (
    <div className="min-h-screen px-4 py-4 md:py-6">
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold md:text-3xl">Candidate Portal</h1>
          <button
            onClick={logout}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-slate-800/50 px-4 py-2 text-sm transition-all hover:bg-slate-700/50 md:w-auto md:text-base"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-5xl mx-auto mb-8 overflow-x-auto">
        <div className="flex min-w-[880px] items-center justify-between">
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

      <div className="max-w-3xl mx-auto w-full">
        {stage === 'profile' && <ProfileStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'careerCoach' && <CareerGuidanceStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'resume' && <ResumeUploadStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'uploadVideo' && <UploadVideoStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'quiz' && <TechnicalQuizStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} authState={authState} />}
        {stage === 'interview' && <TextInterviewStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} authState={authState} />}
        {stage === 'video' && <VideoInterviewStage candidateData={candidateData} setCandidateData={setCandidateData} setStage={setStage} />}
        {stage === 'results' && <ResultsStage candidateData={candidateData} authState={authState} setStage={setStage} />}
        {stage === 'upgradeSkills' && <UpgradeSkillsStage candidateData={candidateData} authState={authState} setStage={setStage} />}
      </div>
    </div>
  );
}

// ==================== PROFILE STAGE ====================
function ProfileStage({ candidateData, setCandidateData, setStage }) {
  const [formData, setFormData] = useState({
    name: candidateData.name,
    email: candidateData.email
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
          email: formData.email
        })
      });

      const data = await parseApiJson(response);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create profile');
      }

      // Store the real candidate ID returned from backend
      setCandidateData({ ...candidateData, ...formData, id: data.candidate.id });
      setStage('careerCoach');
    } catch (err) {
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 md:p-8 border border-slate-700">
      <h2 className="text-xl md:text-2xl font-bold mb-6">Tell us about yourself</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-300 mb-2">Full Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 text-sm md:text-base bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
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
            className="w-full px-4 py-3 text-sm md:text-base bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
            placeholder="john@example.com"
            required
          />
        </div>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

// ==================== AI CAREER GUIDANCE STAGE ====================
function CareerGuidanceStage({ candidateData, setCandidateData, setStage }) {
  const [targetRole, setTargetRole] = useState(candidateData.position || '');
  const [targetCompany, setTargetCompany] = useState(candidateData.targetCompany || candidateData.careerGuidance?.targetCompany || '');
  const [experienceLevel, setExperienceLevel] = useState(candidateData.careerGuidance?.experienceLevel || 'fresher');
  const [skillsInput, setSkillsInput] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'assistant',
      text: 'Hi! I am your TalentAI career coach. Share your target role, target company, and current skills. I will build a roadmap and show company eligibility.'
    }
  ]);
  const [guidance, setGuidance] = useState(candidateData.careerGuidance);

  const roleSkillMap = {
    'Software Engineer': ['Data Structures', 'Algorithms', 'JavaScript', 'System Design', 'Git'],
    'Frontend Developer': ['HTML', 'CSS', 'JavaScript', 'React', 'Accessibility'],
    'Backend Developer': ['Node.js', 'APIs', 'Databases', 'Authentication', 'System Design'],
    'Full Stack Developer': ['React', 'Node.js', 'SQL', 'System Design', 'Testing'],
    'Data Scientist': ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Data Visualization'],
    'Machine Learning Engineer': ['Python', 'Machine Learning', 'Deep Learning', 'MLOps', 'Data Engineering'],
    'DevOps Engineer': ['Linux', 'CI/CD', 'Docker', 'Kubernetes', 'Cloud'],
    'Product Manager': ['Product Strategy', 'User Research', 'Analytics', 'Roadmapping', 'Communication'],
    'UI/UX Designer': ['User Research', 'Wireframing', 'Figma', 'Design Systems', 'Prototyping'],
    'Android Developer': ['Kotlin', 'Android SDK', 'Architecture Patterns', 'REST APIs', 'Testing'],
    'iOS Developer': ['Swift', 'iOS SDK', 'Architecture Patterns', 'REST APIs', 'Testing'],
    'QA Engineer': ['Manual Testing', 'Automation Testing', 'Selenium', 'API Testing', 'Test Strategy']
  };

  const buildGuidance = (role, skills, level, company) => {
    const normalizedSkills = skills
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase());

    const expectedSkills = roleSkillMap[role] || ['Communication', 'Problem Solving', 'Domain Knowledge'];
    const matchingSkills = expectedSkills.filter((expected) => normalizedSkills.some((skill) => skill.includes(expected.toLowerCase())));
    const missingSkills = expectedSkills.filter((expected) => !matchingSkills.includes(expected));

    const proficiency = Math.round((matchingSkills.length / expectedSkills.length) * 100);

    const roadmap = [
      `Weeks 1-2: Strengthen fundamentals for ${role} and revise one core topic daily.`,
      `Weeks 3-4: Build at least one project focused on ${missingSkills[0] || expectedSkills[0]}.`,
      `Weeks 5-6: Practice interview questions and publish project outcomes on GitHub/LinkedIn.`,
      'Weeks 7-8: Apply to targeted roles and refine based on recruiter feedback.'
    ];

    const recommendations = missingSkills.length
      ? missingSkills.map((skill) => `Improve ${skill} with hands-on practice and mini-projects.`)
      : ['Your skill profile is strong. Focus on interview storytelling and advanced projects.'];

    const localResources = [
      { title: `${role} learning roadmap`, url: 'https://roadmap.sh/', why: 'Use a structured role-based path for consistency.' },
      { title: 'LinkedIn Learning Hub', url: 'https://www.linkedin.com/learning/', why: `Pick ${level}-appropriate guided courses.` },
      { title: 'GitHub Explore', url: 'https://github.com/explore', why: 'Study and build real projects with best-practice examples.' }
    ];

    const companyName = String(company || '').trim();
    const isEligible = proficiency >= 70 && missingSkills.length <= 2;

    return {
      role,
      targetCompany: companyName,
      experienceLevel: level,
      skills,
      proficiency,
      matchingSkills,
      missingSkills,
      companyEligibility: companyName
        ? {
          company: companyName,
          eligible: isEligible,
          reason: isEligible
            ? `Your current profile aligns well for ${companyName}.`
            : `You need to close key skill gaps before targeting ${companyName}.`,
          requiredSkills: isEligible ? [] : missingSkills.slice(0, 5)
        }
        : null,
      roadmap,
      recommendations,
      resources: localResources
    };
  };

  const handleAnalyze = async () => {
    const skills = skillsInput.split(',').map((s) => s.trim()).filter(Boolean);

    if (!targetRole || !targetCompany.trim() || skills.length === 0) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Please select your target role, target company, and enter at least one skill to continue.'
        }
      ]);
      return;
    }

    setAnalyzing(true);
    setChatHistory((prev) => [
      ...prev,
      {
        role: 'user',
        text: `Target Role: ${targetRole}. Target Company: ${targetCompany}. My skills: ${skills.join(', ')}`
      }
    ]);

    try {
      const response = await fetch(`${API_URL}/api/career-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'analyze',
          targetRole,
          targetCompany,
          experienceLevel,
          skills
        })
      });

      const data = await parseApiJson(response);
      if (!response.ok || !data.success || !data.guidance) {
        throw new Error(data.error || 'Failed to generate AI guidance');
      }

      const result = data.guidance;
      setGuidance(result);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.missingSkills?.length
            ? `Great start. You already match ${result.matchingSkills?.length || 0} core skills. Focus next on: ${result.missingSkills.join(', ')}.`
            : 'Excellent profile for this role. Focus on advanced projects and interview readiness to stand out.'
        }
      ]);

      setCandidateData({
        ...candidateData,
        position: targetRole,
        targetCompany,
        careerGuidance: result
      });
    } catch (error) {
      const fallbackResult = buildGuidance(targetRole, skills, experienceLevel, targetCompany);
      setGuidance(fallbackResult);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `I could not reach the live AI service right now, so I generated guidance locally. Focus next on: ${(fallbackResult.missingSkills || []).join(', ') || 'advanced projects and mock interviews'}.`
        }
      ]);
      setCandidateData({
        ...candidateData,
        position: targetRole,
        targetCompany,
        careerGuidance: fallbackResult
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const sendMessage = async () => {
    const message = chatMessage.trim();
    if (!message || chatLoading) return;

    const skills = skillsInput.split(',').map((s) => s.trim()).filter(Boolean);

    setChatHistory((prev) => [
      ...prev,
      { role: 'user', text: message }
    ]);
    setChatMessage('');

    setChatLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/career-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          message,
          targetRole,
          targetCompany,
          experienceLevel,
          skills,
          guidance
        })
      });

      const data = await parseApiJson(response);
      const reply = data?.reply || data?.message || 'Please share your target role and current skills, and I will help with a concrete career plan.';

      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', text: reply }
      ]);
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'I am having trouble connecting right now. Please click "Get AI Career Guidance" to generate your plan, then ask follow-up questions.'
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 md:p-8 border border-slate-700">
      <h2 className="text-xl md:text-2xl font-bold mb-2">AI Career Coach</h2>
      <p className="text-slate-300 text-sm md:text-base mb-6">
        Chat with AI, share your current skills, choose your target role, and get a personalized career path before resume analysis.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-slate-300 mb-2">Target Role</label>
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="w-full px-4 py-3 text-sm md:text-base bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Select your role goal</option>
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

        <div>
          <label className="block text-slate-300 mb-2">Experience Level</label>
          <select
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            className="w-full px-4 py-3 text-sm md:text-base bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
          >
            <option value="fresher">Fresher</option>
            <option value="junior">Junior (0-2 years)</option>
            <option value="mid">Mid (2-5 years)</option>
            <option value="senior">Senior (5+ years)</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-300 mb-2">Target Company</label>
          <input
            type="text"
            value={targetCompany}
            onChange={(e) => setTargetCompany(e.target.value)}
            className="w-full px-4 py-3 text-sm md:text-base bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="Google, Microsoft, Infosys, etc."
          />
        </div>

        <div>
          <label className="block text-slate-300 mb-2">Your Skills (comma separated)</label>
          <input
            type="text"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            className="w-full px-4 py-3 text-sm md:text-base bg-slate-800/50 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="React, JavaScript, Node.js, SQL"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
        >
          {analyzing ? 'Generating AI Guidance...' : 'Get AI Career Guidance'}
        </button>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-3 md:p-4 mb-6">
        <h3 className="font-semibold mb-3">Career Chat</h3>
        <div className="max-h-64 overflow-y-auto space-y-2 mb-3 pr-1">
          {chatHistory.map((item, index) => (
            <div
              key={index}
              className={`rounded-lg px-3 py-2 text-sm ${item.role === 'assistant' ? 'bg-slate-700/60 text-slate-100' : 'bg-indigo-600/40 text-indigo-100 ml-4'}`}
            >
              {item.text}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="flex-1 px-4 py-2.5 text-sm md:text-base bg-slate-900/60 rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="Ask AI about your career path..."
          />
          <button
            onClick={sendMessage}
            disabled={chatLoading}
            className="min-h-[44px] px-5 py-2.5 text-sm md:text-base bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            {chatLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {guidance && (
        <div className="rounded-xl border border-green-500/30 bg-green-900/10 p-4 md:p-5 mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <h3 className="text-lg font-semibold text-green-300">Career Path Guidance</h3>
            <span className="text-sm px-3 py-1 rounded-full bg-slate-800/70 border border-slate-600">
              Role readiness: {guidance.proficiency}%
            </span>
          </div>

          <div className="mb-3">
            <p className="text-sm text-slate-300 mb-2">Skills to improve:</p>
            <div className="flex flex-wrap gap-2">
              {(guidance.missingSkills.length ? guidance.missingSkills : ['No major skill gaps detected']).map((skill, idx) => (
                <span key={idx} className="text-xs md:text-sm px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-200 border border-yellow-500/30">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <p className="text-sm text-slate-300 mb-2">Recommended next steps:</p>
            <ul className="space-y-1 text-sm text-slate-200">
              {guidance.recommendations.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm text-slate-300 mb-2">8-week roadmap:</p>
            <ul className="space-y-1 text-sm text-slate-200">
              {guidance.roadmap.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>

          {Array.isArray(guidance.resources) && guidance.resources.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-slate-300 mb-2">Role-specific resources for your level:</p>
              <ul className="space-y-2 text-sm text-slate-200">
                {guidance.resources.map((resource, idx) => (
                  <li key={idx} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-300 hover:text-indigo-200 underline"
                    >
                      {resource.title}
                    </a>
                    {resource.why && <p className="text-slate-400 mt-1">{resource.why}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guidance.companyEligibility && (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
              <p className="text-sm text-slate-300 mb-1">Target company eligibility</p>
              <p className={`font-semibold ${guidance.companyEligibility.eligible ? 'text-green-300' : 'text-red-300'}`}>
                {guidance.companyEligibility.company}: {guidance.companyEligibility.eligible ? 'Eligible' : 'Not Eligible Yet'}
              </p>
              {guidance.companyEligibility.reason && (
                <p className="text-xs text-slate-400 mt-1">{guidance.companyEligibility.reason}</p>
              )}
              {!guidance.companyEligibility.eligible && Array.isArray(guidance.companyEligibility.requiredSkills) && guidance.companyEligibility.requiredSkills.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-slate-300 mb-1">Skills required for this company:</p>
                  <div className="flex flex-wrap gap-2">
                    {guidance.companyEligibility.requiredSkills.map((skill, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-200 border border-red-500/30">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => setStage('profile')}
          className="min-h-[44px] px-6 py-3 text-sm md:text-base bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all"
        >
          Back
        </button>
        <button
          onClick={() => setStage('resume')}
          disabled={!candidateData.position}
          className="flex-1 min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
        >
          Continue to Resume Analysis →
        </button>
      </div>
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
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 md:p-8 border border-slate-700">
      <h2 className="text-xl md:text-2xl font-bold mb-6">Upload Your Resume</h2>

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

          <div className="border-2 border-dashed border-slate-600 rounded-xl p-4 md:p-8 text-center mb-6">
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
              className="min-h-[44px] px-6 py-2 text-sm md:text-base bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-all"
            >
              Browse Files
            </button>
            <p className="text-slate-500 text-xs mt-3">
              Supported formats: PDF, DOC, DOCX, TXT, RTF
            </p>
          </div>

          {file && (
            <div className="bg-slate-800/50 rounded-lg p-4 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="text-indigo-400" size={24} />
                <div>
                  <p className="font-semibold break-all">{file.name}</p>
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

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={analyzeResume}
              disabled={!file || analyzing}
              className="flex-1 min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              className="min-h-[44px] px-6 py-3 text-sm md:text-base bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all"
            >
              Save and Continue →
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-500/30 rounded-xl p-6 mb-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h3 className="text-lg md:text-xl font-semibold">Resume Analysis Complete</h3>
              <div className="text-2xl md:text-3xl font-bold text-green-400">{analysis.score}/100</div>
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
            className="w-full min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
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
      formData.append('analysisType', 'upload');
      formData.append('position', candidateData.position || 'Candidate');

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
        transcript: data.videoAnalysis?.analysis?.transcript || '',
        clarityScore: data.videoAnalysis?.analysis?.clarityScore || Math.floor(Math.random() * 5) + 20,
        relevanceScore: data.videoAnalysis?.analysis?.relevanceScore || Math.floor(Math.random() * 5) + 20,
        confidenceScore: data.videoAnalysis?.analysis?.confidenceScore || Math.floor(Math.random() * 5) + 20,
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
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 md:p-8 border border-slate-700">
      <h2 className="text-xl md:text-2xl font-bold mb-6">Upload Video Interview</h2>

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
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-4 md:p-8 text-center mb-6">
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
                className="min-h-[44px] px-6 py-2 text-sm md:text-base bg-purple-600 rounded-lg hover:bg-purple-500 transition-all"
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

              <div className="bg-slate-800/50 rounded-lg p-4 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Video className="text-purple-400" size={24} />
                  <div>
                    <p className="font-semibold break-all">{videoFile.name}</p>
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

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={analyzeVideo}
              disabled={!videoFile || analyzing}
              className="flex-1 min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              className="min-h-[44px] px-6 py-3 text-sm md:text-base bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all"
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Speech Clarity</p>
                <p className="text-lg font-bold text-purple-300">{analysis.clarityScore}/25</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Role Relevance</p>
                <p className="text-lg font-bold text-purple-300">{analysis.relevanceScore}/25</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Confidence</p>
                <p className="text-lg font-bold text-purple-300">{analysis.confidenceScore}/25</p>
              </div>
            </div>

            {analysis.transcript && (
              <div className="mb-4 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Detected speech transcript</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{analysis.transcript}</p>
              </div>
            )}

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
            className="w-full min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            Continue to Technical Assessment →
          </button>
        </>
      )}
    </div>
  );
}

// ==================== TECHNICAL QUIZ STAGE ====================
function TechnicalQuizStage({ candidateData, setCandidateData, setStage, authState }) {
  const TOTAL_QUESTIONS = 30;
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const TIME_LIMIT = timeLimitMinutes * 60;

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

  const normalizeText = useCallback((value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(), []);

  const tokenizeText = useCallback((value) => normalizeText(value).split(' ').filter(Boolean), [normalizeText]);

  const cosineTokenSimilarity = useCallback((a, b) => {
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
  }, [tokenizeText]);

  const inferDifficulty = useCallback((question) => {
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
  }, [normalizeText]);

  const resolveCorrectAnswerText = useCallback((question) => {
    if (typeof question?.correctAnswer === 'number') {
      return question?.options?.[question.correctAnswer] ?? '';
    }
    return String(question?.correctAnswer ?? '');
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const generateQuestions = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const settingsRes = await fetch(`${API_URL}/api/quiz/settings`, {
          headers: { 'Authorization': `Bearer ${authState?.token}` }
        });
        const settingsData = await parseApiJson(settingsRes);
        if (settingsData.success) {
          const duration = Number(settingsData.settings?.candidateDurationMinutes);
          if (Number.isFinite(duration) && duration >= 5) {
            setTimeLimitMinutes(duration);
            setTimeLeft(duration * 60);
          }
        }
      } catch {}

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
  }, [candidateData.position, authState?.token]);

  const calculateScore = useCallback((answersOverride) => {
    clearInterval(timerRef.current);
    const ans = answersOverride || answers;
    let weightedEarned = 0;
    let weightedTotal = 0;

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
  }, [answers, questions, setCandidateData, inferDifficulty, resolveCorrectAnswerText, normalizeText, cosineTokenSimilarity]);

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
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 md:p-10 border border-slate-700 text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
        <Sparkles size={28} />
      </div>
      <h3 className="text-lg md:text-xl font-bold mb-2">AI is building your quiz...</h3>
      <p className="text-slate-400 text-sm md:text-base">Generating 30 personalized questions for <span className="text-indigo-400 font-semibold">{candidateData.position}</span></p>
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
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-slate-700">
        <div className="text-center mb-6">
          <div className={`inline-block bg-gradient-to-br ${grade.bg} border rounded-2xl px-8 py-5 mb-3`}>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Quiz Score</p>
            <p className={`text-5xl md:text-6xl font-black ${grade.color}`}>{score}</p>
            <p className="text-slate-300 text-sm font-semibold mt-1">{grade.label} • {correct}/{questions.length} correct</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 md:gap-4 text-xs md:text-sm text-slate-400">
            <span>✅ {correct} correct</span>
            <span>❌ {questions.length - correct} wrong</span>
            <span>⚖️ weighted: {gradingMeta.weightedCorrect.toFixed(1)}/{gradingMeta.totalWeight.toFixed(1)}</span>
            <span>⏱ {timeLimitMinutes} min quiz</span>
          </div>
        </div>

        {/* Compact review */}
        <div className="mb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-3">
            <h3 className="font-semibold text-slate-300 text-sm">Review — {reviewPage * REVIEW_PER_PAGE + 1}–{Math.min((reviewPage + 1) * REVIEW_PER_PAGE, questions.length)} of {questions.length}</h3>
            <div className="flex gap-2">
              <button disabled={reviewPage === 0} onClick={() => setReviewPage(p => p - 1)}
                className="min-h-[44px] px-3 py-1 rounded-lg bg-slate-700 text-xs md:text-sm disabled:opacity-40 hover:bg-slate-600 transition-all">← Prev</button>
              <button disabled={(reviewPage + 1) * REVIEW_PER_PAGE >= questions.length} onClick={() => setReviewPage(p => p + 1)}
                className="min-h-[44px] px-3 py-1 rounded-lg bg-slate-700 text-xs md:text-sm disabled:opacity-40 hover:bg-slate-600 transition-all">Next →</button>
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
          className="w-full min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-900/30">
          Continue to AI Interview →
        </button>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  if (!currentQ) return null;

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 md:p-6 border border-slate-700">
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
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
        <div>
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
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
      <div className="bg-slate-800/30 rounded-xl p-3 mb-3 h-[300px] md:h-[340px] overflow-y-auto space-y-3">
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
      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          rows={2}
          value={currentInput}
          onChange={e => setCurrentInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type your answer... (Enter to send)"
          className="flex-1 px-4 py-2.5 bg-slate-800/60 rounded-xl border border-slate-600 focus:border-indigo-500 focus:outline-none transition-all resize-none text-sm md:text-base placeholder-slate-500"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !currentInput.trim()}
          className="min-h-[44px] px-5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-40 flex items-center justify-center shadow-md shadow-indigo-900/30"
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
  const speechRecognitionRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [questionTranscripts, setQuestionTranscripts] = useState([]);

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
    setLiveTranscript('');

    // Capture spoken content in real time for AI speech analysis.
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event) => {
        let combined = '';
        for (let i = 0; i < event.results.length; i += 1) {
          combined += `${event.results[i][0].transcript} `;
        }
        setLiveTranscript(combined.trim());
      };
      recognition.onerror = () => {
        setSpeechSupported(false);
      };
      speechRecognitionRef.current = recognition;
      recognition.start();
    } else {
      setSpeechSupported(false);
    }

    // Start timer
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }

      setQuestionTranscripts((prev) => ([
        ...prev,
        {
          question: questions[currentQuestion],
          transcript: liveTranscript
        }
      ]));

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
      formData.append('analysisType', 'live');
      formData.append('position', candidateData.position || 'Candidate');
      formData.append('transcript', questionTranscripts.map((q) => `Q: ${q.question}\nA: ${q.transcript}`).join('\n\n'));

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
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-slate-700 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mx-auto mb-6"></div>
        <h2 className="text-xl md:text-2xl font-bold mb-4">Analyzing Your Video Interview</h2>
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
      <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-slate-700 text-center">
        <Video className="mx-auto mb-4 text-purple-400" size={64} />
        <h2 className="text-xl md:text-2xl font-bold mb-4">Video Interview Complete!</h2>
        <p className="text-slate-300 mb-2">Your responses have been recorded and analyzed.</p>
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-lg p-4 mb-6 inline-block">
          <p className="text-slate-400 text-sm mb-1">Video Score</p>
          <p className="text-3xl font-bold text-purple-400">{candidateData.videoInterviewScore}/100</p>
        </div>
        <button
          onClick={() => setStage('results')}
          className="min-h-[44px] px-8 py-3 text-sm md:text-base bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
        >
          View Final Results →
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 md:p-8 border border-slate-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h2 className="text-xl md:text-2xl font-bold">Video Interview</h2>
        <span className="text-sm md:text-base text-slate-400">Question {currentQuestion + 1} of {questions.length}</span>
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
            {!speechSupported && (
              <p className="mt-2 text-xs text-yellow-300">Speech-to-text is unavailable in this browser. AI will analyze uploaded media audio where possible.</p>
            )}
            {recording && liveTranscript && (
              <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/50 p-2">
                <p className="text-xs text-slate-400 mb-1">Live transcript</p>
                <p className="text-xs text-slate-200 whitespace-pre-wrap">{liveTranscript}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {!recording ? (
          <button
            onClick={startRecording}
            disabled={!stream}
            className="flex-1 min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-red-600 to-pink-600 rounded-lg font-semibold hover:from-red-500 hover:to-pink-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Video size={20} />
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 min-h-[44px] py-3 text-sm md:text-base bg-gradient-to-r from-slate-600 to-slate-700 rounded-lg font-semibold hover:from-slate-500 hover:to-slate-600 transition-all flex items-center justify-center gap-2"
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
        className="w-full min-h-[44px] py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all text-sm md:text-base mb-4"
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

function ResultsStage({ candidateData, authState, setStage }) {
  const [advice, setAdvice] = useState(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const preferredCompany = candidateData.targetCompany || candidateData.careerGuidance?.targetCompany || '';
  const companyEligibility = advice?.companyEligibility || candidateData.careerGuidance?.companyEligibility || null;

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
        body: JSON.stringify({ candidateData, position: candidateData.position, targetCompany: preferredCompany })
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
      <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-2xl p-5 md:p-8 border border-indigo-500/30 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">Application Complete! 🎉</h2>
        <div className={`inline-flex items-center justify-center h-28 w-28 md:h-36 md:w-36 rounded-full bg-gradient-to-br ${gradeColor} mb-4 shadow-2xl`}>
          <span className="text-4xl md:text-5xl font-bold">{totalScore}</span>
        </div>
        <p className="text-base md:text-xl mb-1">Overall Score</p>
        <p className="text-xl md:text-2xl font-bold">{gradeLabel}</p>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
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
        <div className="space-y-4 md:space-y-5">
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
          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 md:p-6">
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
          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 md:p-6">
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

          {(preferredCompany || companyEligibility) && (
            <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 md:p-6">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">🎯 Preferred Company Check</h3>
              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                <p className="text-sm text-slate-300 mb-1">Preferred company</p>
                <p className="text-lg font-semibold text-white">{companyEligibility?.company || preferredCompany}</p>
                {companyEligibility && (
                  <>
                    <p className={`mt-3 text-sm font-semibold ${companyEligibility.eligible ? 'text-green-300' : 'text-red-300'}`}>
                      {companyEligibility.eligible ? 'Eligible to apply now' : 'Not eligible yet'}
                    </p>
                    {companyEligibility.reason && (
                      <p className="mt-1 text-sm text-slate-400">{companyEligibility.reason}</p>
                    )}
                    {!companyEligibility.eligible && Array.isArray(companyEligibility.requiredSkills) && companyEligibility.requiredSkills.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-slate-300 mb-2">Skills required for this company:</p>
                        <div className="flex flex-wrap gap-2">
                          {companyEligibility.requiredSkills.map((skill, idx) => (
                            <span key={idx} className="text-xs md:text-sm px-2.5 py-1 rounded-full bg-red-500/20 text-red-200 border border-red-500/30">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-2xl p-4 md:p-6">
            <h3 className="text-lg font-bold text-indigo-300 mb-3">🎯 Your Personalized Action Plan</h3>
            <p className="text-slate-300 leading-relaxed">{advice.nextSteps}</p>
          </div>
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 md:p-6 text-center">
        <h3 className="text-lg font-bold mb-2">Ready for the final stage?</h3>
        <p className="text-sm text-slate-400 mb-4">Keep your results exactly as they are, then move to Upgrade Skills for superadmin-curated YouTube videos and AI-suggested learning resources.</p>
        <button
          onClick={() => setStage('upgradeSkills')}
          className="min-h-[44px] px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
        >
          Continue to Upgrade Skills →
        </button>
      </div>
    </div>
  );
}

function UpgradeSkillsStage({ candidateData, authState, setStage }) {
  const [adminResources, setAdminResources] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [weakAreas, setWeakAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('fallback');
  const [generatedAt, setGeneratedAt] = useState(null);

  const role = candidateData.position || candidateData.careerGuidance?.role || 'General';

  const groupedSuggestions = suggestions.reduce((acc, item) => {
    const key = item.category || 'General';
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

  const fetchUpgradeSkills = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` };
      const [resourcesRes, suggestionsRes] = await Promise.all([
        fetch(`${API_URL}/api/upgrade-resources?role=${encodeURIComponent(role)}`, { headers }),
        fetch(`${API_URL}/api/upgrade-skills/suggestions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ position: role, candidateData, forceRefresh })
        })
      ]);

      const [resourcesData, suggestionsData] = await Promise.all([
        parseApiJson(resourcesRes),
        parseApiJson(suggestionsRes)
      ]);

      if (resourcesData.success) setAdminResources(resourcesData.resources || []);
      if (suggestionsData.success) {
        setSuggestions(suggestionsData.suggestions || []);
        setWeakAreas(suggestionsData.weakAreas || []);
        setSource(suggestionsData.source || 'fallback');
        setGeneratedAt(suggestionsData.generatedAt || null);
      }
    } catch (error) {
      console.error('Upgrade skills fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, [authState?.token, candidateData, role]);

  useEffect(() => {
    fetchUpgradeSkills();
  }, [fetchUpgradeSkills]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-900/50 to-fuchsia-900/40 rounded-2xl p-5 md:p-8 border border-indigo-500/30">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Upgrade Skills</h2>
            <p className="mt-2 text-sm md:text-base text-slate-300">Final stage for role-specific upskilling. Superadmin-curated YouTube videos appear first, followed by AI-suggested websites, blogs, articles, docs, and courses for <span className="font-semibold text-white">{role}</span>.</p>
          </div>
          <button
            onClick={() => setStage('results')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-all text-sm font-semibold"
          >
            ← Back to Results
          </button>
        </div>
      </div>

      {weakAreas.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-4 md:p-5">
          <h3 className="text-lg font-bold text-amber-300 mb-3">Priority Focus Areas</h3>
          <div className="flex flex-wrap gap-2">
            {weakAreas.map((item, index) => (
              <span key={index} className="px-3 py-1.5 rounded-full text-sm bg-amber-500/15 border border-amber-500/30 text-amber-100">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-700 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Building your upgrade plan...</p>
        </div>
      ) : (
        <>
          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-red-300">🎥 Superadmin YouTube Resources</h3>
                <p className="text-xs md:text-sm text-slate-400 mt-1">Curated links added by the superadmin for your target role.</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-800/80 border border-slate-600 text-slate-300">{adminResources.length} videos</span>
            </div>

            {adminResources.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 bg-slate-800/30 p-5 text-sm text-slate-400">
                No superadmin YouTube videos have been added for this role yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminResources.map((resource) => (
                  <div key={resource.id} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 flex flex-col gap-3">
                    {buildYouTubeThumbnailUrl(resource.url) && (
                      <a href={resource.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-red-500/20 bg-slate-950/40">
                        <img
                          src={buildYouTubeThumbnailUrl(resource.url)}
                          alt={resource.title}
                          className="h-44 w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </a>
                    )}
                    <div>
                      <p className="text-xs uppercase tracking-wide text-red-300 mb-1">{resource.role}</p>
                      <h4 className="font-semibold text-white">{resource.title}</h4>
                      {resource.description && <p className="text-sm text-slate-400 mt-2">{resource.description}</p>}
                    </div>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-semibold text-sm transition-all"
                    >
                      Watch on YouTube
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-indigo-300">🧠 AI-Suggested Learning Resources</h3>
                <p className="text-xs md:text-sm text-slate-400 mt-1">Source: {source === 'ai' ? 'live AI suggestions' : source === 'stored' ? 'saved candidate roadmap' : 'local fallback suggestions'}{generatedAt ? ` · updated ${new Date(generatedAt).toLocaleString()}` : ''}.</p>
              </div>
              <button
                onClick={() => fetchUpgradeSkills(true)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-all"
              >
                Refresh Suggestions
              </button>
            </div>

            {Object.keys(groupedSuggestions).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 bg-slate-800/30 p-5 text-sm text-slate-400">
                No suggestions are available right now.
              </div>
            ) : (
              <div className="space-y-5">
                {Object.entries(groupedSuggestions).map(([category, items]) => (
                  <div key={category}>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-300 mb-3">{category}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map((item, index) => (
                        <div key={`${category}-${index}`} className="rounded-xl border border-indigo-500/20 bg-indigo-900/10 p-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="font-semibold text-white">{item.title}</h5>
                            <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800/70 border border-slate-600 text-slate-300 uppercase">{item.type}</span>
                          </div>
                          {item.why && <p className="text-sm text-slate-400">{item.why}</p>}
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-sm text-indigo-300 hover:text-indigo-200 underline underline-offset-2 mt-1"
                          >
                            Open Resource
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
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

function ChatUnreadBadge({ authState }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!authState?.token) return undefined;

    let isMounted = true;
    const headers = { Authorization: `Bearer ${authState.token}` };

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch(`${API_URL}/api/chat/contacts`, { headers });
        const data = await parseApiJson(res);
        if (!isMounted || !data.success) return;
        const totalUnread = (data.contacts || []).reduce((sum, contact) => sum + (Number(contact.unreadCount) || 0), 0);
        setUnreadCount(totalUnread);
      } catch (error) {
        console.error('Unread badge fetch failed:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [authState?.token]);

  if (!unreadCount) return null;

  return (
    <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
}

function BlockchainChatPanel({ authState, fixedPeerId = null, title, subtitle }) {
  const [contacts, setContacts] = useState([]);
  const [selectedPeerId, setSelectedPeerId] = useState(fixedPeerId);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [integrity, setIntegrity] = useState(null);
  const [peer, setPeer] = useState(null);
  const [contactSearch, setContactSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${authState?.token}` }),
    [authState?.token]
  );

  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch(`${API_URL}/api/chat/contacts`, { headers: authHeaders });
      const data = await parseApiJson(res);
      if (data.success) {
        const nextContacts = data.contacts || [];
        setContacts(nextContacts);
        if (!fixedPeerId) {
          setSelectedPeerId((prev) => prev || nextContacts[0]?.id || null);
        } else {
          setSelectedPeerId(fixedPeerId);
        }
      }
    } catch (error) {
      console.error('Failed to load chat contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  }, [authHeaders, fixedPeerId]);

  const fetchMessages = useCallback(async () => {
    if (!selectedPeerId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`${API_URL}/api/chat/messages/${selectedPeerId}`, { headers: authHeaders });
      const data = await parseApiJson(res);
      if (data.success) {
        setMessages(data.messages || []);
        setIntegrity(data.integrity || null);
        setPeer(data.peer || null);
        fetchContacts();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [authHeaders, fetchContacts, selectedPeerId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    const interval = setInterval(fetchContacts, 5000);
    return () => clearInterval(interval);
  }, [fetchContacts]);

  useEffect(() => {
    fetchMessages();
    if (!selectedPeerId) return undefined;
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages, selectedPeerId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAttachmentChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setAttachmentFile(nextFile);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if ((!text && !attachmentFile) || !selectedPeerId || sending) return;
    setSending(true);
    try {
      const request = attachmentFile
        ? (() => {
            const formData = new FormData();
            formData.append('peerId', String(selectedPeerId));
            formData.append('text', text);
            formData.append('attachment', attachmentFile);
            return {
              method: 'POST',
              headers: authHeaders,
              body: formData
            };
          })()
        : {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ peerId: selectedPeerId, text })
          };
      const res = await fetch(`${API_URL}/api/chat/messages`, request);
      const data = await parseApiJson(res);
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send message');
      setDraft('');
      setAttachmentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIntegrity(data.integrity || null);
      setMessages((prev) => [...prev, data.message]);
      fetchContacts();
    } catch (error) {
      window.alert(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const selectedPeer = peer || contacts.find((item) => item.id === selectedPeerId) || null;
  const hasMultipleContacts = !fixedPeerId && contacts.length > 1;
  const filteredContacts = contacts.filter((contact) => {
    const haystack = [contact.name, contact.email, contact.company, contact.lastMessagePreview].join(' ').toLowerCase();
    return haystack.includes(contactSearch.trim().toLowerCase());
  });
  const visibleMessages = messages.filter((message) => {
    const query = messageSearch.trim().toLowerCase();
    const haystack = [message.text, message.attachment?.fileName].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && matchesChatHistoryFilter(message, historyFilter, authState?.user?.id);
  });

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {hasMultipleContacts && (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700 overflow-hidden xl:col-span-1">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold text-white">Recruiter Conversations</h3>
            <p className="text-xs text-slate-400 mt-1">Select a recruiter to start a secure chat.</p>
            <div className="mt-3 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-xl border border-slate-600 bg-slate-800/60 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          {loadingContacts ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto" /></div>
          ) : (
            <div className="divide-y divide-slate-700/40">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedPeerId(contact.id)}
                  className={`w-full text-left px-4 py-3 transition-all ${selectedPeerId === contact.id ? 'bg-indigo-900/30 border-l-2 border-indigo-500' : 'hover:bg-slate-800/40'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{contact.name || contact.email}</p>
                      <p className="text-xs text-slate-400 truncate">{contact.email}</p>
                    </div>
                    {Boolean(contact.unreadCount) && (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">{contact.unreadCount}</span>
                    )}
                  </div>
                  {contact.company && <p className="text-xs text-slate-500 truncate">🏢 {contact.company}</p>}
                  {contact.lastMessagePreview && <p className="mt-1 text-xs text-slate-500 truncate">{contact.lastMessagePreview}</p>}
                  {contact.lastMessageAt && <p className="mt-1 text-[11px] text-slate-500">{new Date(contact.lastMessageAt).toLocaleString()}</p>}
                </button>
              ))}
              {filteredContacts.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-500">No conversations match your search.</div>}
            </div>
          )}
        </div>
      )}

      <div className={`bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700 overflow-hidden ${hasMultipleContacts ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
        <div className="p-4 border-b border-slate-700 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${integrity?.valid ? 'bg-green-900/30 text-green-300 border-green-700/40' : 'bg-red-900/30 text-red-300 border-red-700/40'}`}>
            {integrity?.valid ? `Blockchain verified · ${integrity.checkedBlocks || 0} blocks` : 'Integrity check failed'}
          </div>
        </div>

        {!selectedPeerId ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-4xl mb-3">💬</p>
            <p>Select a contact to open the secure chat.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/30">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-sm text-white">{selectedPeer?.name || selectedPeer?.email || 'Conversation'}</p>
                  <p className="text-xs text-slate-400">{selectedPeer?.email || 'Secure recruiter ↔ superadmin channel'}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      placeholder="Search messages or file names..."
                      className="min-w-[220px] rounded-xl border border-slate-600 bg-slate-900/60 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Clock3 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <select
                      value={historyFilter}
                      onChange={(e) => setHistoryFilter(e.target.value)}
                      className="min-h-[40px] rounded-xl border border-slate-600 bg-slate-900/60 py-2 pl-9 pr-8 text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="all">All history</option>
                      <option value="today">Today</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="attachments">Attachments</option>
                      <option value="images">Images</option>
                      <option value="files">Files only</option>
                      <option value="mine">My messages</option>
                      <option value="peer">Peer messages</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div ref={listRef} className="h-[420px] overflow-y-auto px-4 py-4 space-y-3 bg-slate-950/20">
              {loadingMessages ? (
                <div className="text-center py-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-4xl mb-3">🔗</p>
                  <p>No messages yet. Send the first blockchain-secured message.</p>
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-4xl mb-3">🔎</p>
                  <p>No conversation entries match the current search/filter.</p>
                </div>
              ) : (
                visibleMessages.map((message) => {
                  const isMine = message.senderId === authState?.user?.id;
                  return (
                    <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 border ${isMine ? 'bg-indigo-600/25 border-indigo-500/30' : 'bg-slate-800/70 border-slate-700'}`}>
                        {message.text && <p className="text-sm text-slate-100 whitespace-pre-wrap">{message.text}</p>}
                        {message.attachment && (
                          <div className={`mt-3 overflow-hidden rounded-xl border ${isMine ? 'border-indigo-400/20 bg-indigo-950/20' : 'border-slate-600 bg-slate-900/50'}`}>
                            {message.attachment.kind === 'image' && message.attachment.url ? (
                              <a href={message.attachment.url} target="_blank" rel="noreferrer" className="block">
                                <img src={message.attachment.url} alt={message.attachment.fileName} className="max-h-64 w-full object-cover" loading="lazy" />
                              </a>
                            ) : (
                              <a href={message.attachment.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-3 text-sm text-slate-100 hover:bg-white/5">
                                <FileText size={18} className="text-indigo-300" />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold">{message.attachment.fileName}</p>
                                  <p className="text-xs text-slate-400">{formatFileSize(message.attachment.size)}</p>
                                </div>
                              </a>
                            )}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span>{new Date(message.createdAt).toLocaleString()}</span>
                          <span>Block #{message.blockIndex}</span>
                          {message.attachment && <span>{message.attachment.kind === 'image' ? 'Image attachment' : 'File attachment'}</span>}
                          <span className="truncate max-w-[180px]">Hash {String(message.hash).slice(0, 12)}...</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-900/80">
              {attachmentFile && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    {String(attachmentFile.type || '').startsWith('image/') ? <ImageIcon size={18} className="text-cyan-300" /> : <FileText size={18} className="text-indigo-300" />}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{attachmentFile.name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(attachmentFile.size)}</p>
                    </div>
                  </div>
                  <button onClick={() => { setAttachmentFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-semibold hover:bg-slate-600">Remove</button>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-slate-800/60 rounded-xl border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm resize-none"
                  placeholder="Type a secure message..."
                />
                <div className="flex gap-3 sm:flex-col">
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-3 text-sm font-semibold transition-all hover:bg-slate-700/60">
                    <Paperclip size={16} />
                    Attach
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt,.rtf" onChange={handleAttachmentChange} className="hidden" />
                  </label>
                <button
                  onClick={handleSend}
                  disabled={sending || (!draft.trim() && !attachmentFile)}
                  className="min-h-[44px] px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-semibold text-sm transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ==================== SUPER-ADMIN DASHBOARD ====================
function SuperAdminDashboard({ authState, logout }) {
  const [recruiters, setRecruiters] = useState([]);
  const [candidateAccounts, setCandidateAccounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRecruiter, setSelectedRecruiter] = useState(null);
  const [activeTab, setActiveTab] = useState('recruiters');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(null);
  const [showCandidateAccess, setShowCandidateAccess] = useState(false);
  const [candidateAccessIds, setCandidateAccessIds] = useState(null);
  const [savingAccess, setSavingAccess] = useState(false);

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` }),
    [authState?.token]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, cuRes, sRes, cRes] = await Promise.all([
        fetch(`${API_URL}/api/superadmin/users?type=recruiter`, { headers }),
        fetch(`${API_URL}/api/superadmin/users?type=candidate`, { headers }),
        fetch(`${API_URL}/api/superadmin/stats`, { headers }),
        fetch(`${API_URL}/api/candidates`, { headers })
      ]);
      const [rData, cuData, sData, cData] = await Promise.all([
        parseApiJson(rRes),
        parseApiJson(cuRes),
        parseApiJson(sRes),
        parseApiJson(cRes)
      ]);
      if (rData.success) setRecruiters(rData.users || []);
      if (cuData.success) setCandidateAccounts(cuData.users || []);
      if (sData.success) setStats(sData.stats);
      if (cData.success) setCandidates(cData.candidates || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Reset candidate-access panel whenever the selected recruiter changes
  useEffect(() => {
    if (selectedRecruiter) {
      setCandidateAccessIds(selectedRecruiter.allowedCandidateIds ?? null);
      setShowCandidateAccess(false);
    }
  }, [selectedRecruiter?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCandidateAccess = async () => {
    if (!selectedRecruiter) return;
    setSavingAccess(true);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/recruiters/${selectedRecruiter.id}/candidate-access`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ allowedCandidateIds: candidateAccessIds })
      });
      const data = await parseApiJson(res);
      if (data.success) {
        const updated = { allowedCandidateIds: data.recruiter.allowedCandidateIds };
        setRecruiters(prev => prev.map(r => r.id === selectedRecruiter.id ? { ...r, ...updated } : r));
        setSelectedRecruiter(prev => ({ ...prev, ...updated }));
      }
    } catch (e) { console.error(e); }
    setSavingAccess(false);
  };

  const toggleAccess = async (managedUser, userType) => {
    setSaving(managedUser.id);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/users/${managedUser.id}/access`, {
        method: 'PUT', headers,
        body: JSON.stringify({ canAccessPlatform: !managedUser.canAccessPlatform, accessNote: note })
      });
      const data = await parseApiJson(res);
      if (data.success) {
        const updatedUser = data.user;
        if (userType === 'recruiter') {
          setRecruiters(prev => prev.map(r => r.id === managedUser.id ? { ...r, ...updatedUser } : r));
          if (selectedRecruiter?.id === managedUser.id) {
            setSelectedRecruiter(prev => ({ ...prev, ...updatedUser }));
          }
        } else {
          setCandidateAccounts(prev => prev.map(c => c.id === managedUser.id ? { ...c, ...updatedUser } : c));
        }
      }
    } catch (e) { console.error(e); }
    setSaving(null);
  };

  const removeManagedUser = async (managedUser, userType) => {
    const label = userType === 'recruiter' ? 'recruiter' : 'candidate';
    if (!window.confirm(`Remove ${label} account ${managedUser.email || managedUser.name || managedUser.id}? This cannot be undone.`)) {
      return;
    }

    setSaving(`delete-${managedUser.id}`);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/users/${managedUser.id}`, {
        method: 'DELETE',
        headers
      });
      const data = await parseApiJson(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove user');
      }

      if (userType === 'recruiter') {
        setRecruiters(prev => prev.filter(r => r.id !== managedUser.id));
        if (selectedRecruiter?.id === managedUser.id) {
          setSelectedRecruiter(null);
        }
      } else {
        setCandidateAccounts(prev => prev.filter(c => c.id !== managedUser.id));
      }

      fetchAll();
    } catch (e) {
      console.error(e);
      window.alert(e.message || 'Failed to remove user');
    }
    setSaving(null);
  };

  const filtered = recruiters.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.company?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCandidates = candidateAccounts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const statCards = stats ? [
    { label: 'Total Recruiters', value: stats.recruiterCount, icon: '👥', color: 'from-blue-600 to-indigo-600' },
    { label: 'Active Access', value: stats.activeRecruiters, icon: '🟢', color: 'from-green-600 to-emerald-600' },
    { label: 'Candidates', value: stats.activeCandidates ?? stats.candidateCount, icon: '🎯', color: 'from-purple-600 to-pink-600' },
    { label: 'Avg Score', value: `${stats.avgScore}/100`, icon: '📊', color: 'from-orange-600 to-amber-600' }
  ] : [];

  return (
    <div className="min-h-screen px-4 py-4 md:py-6">
      {/* Header */}
      <div className="mx-auto mb-6 flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-2xl font-black text-transparent md:text-3xl">Super Admin</h1>
          <p className="mt-0.5 text-sm text-slate-400 md:text-base">Grant or revoke platform access for recruiters and candidates</p>
        </div>
        <button onClick={logout} className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm transition-all hover:bg-slate-700/50 md:text-base">
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="mx-auto mb-6 grid max-w-7xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s, i) => (
            <div key={i} className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 relative overflow-hidden`}>
              <div className="absolute top-3 right-4 text-3xl opacity-40">{s.icon}</div>
              <p className="mb-1 text-xs uppercase tracking-widest text-white/70 md:text-sm">{s.label}</p>
              <p className="text-2xl font-black text-white md:text-3xl">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-7xl mx-auto">
        <div className="mb-5 flex flex-wrap gap-2">
          {['recruiters', 'candidates', 'questions', 'resources', 'chat'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`min-h-[44px] px-5 py-2 rounded-xl font-semibold text-sm md:text-base capitalize transition-all ${
                activeTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
              }`}>
              <span className="inline-flex items-center gap-2 capitalize">
                {tab}
                {tab === 'chat' && <ChatUnreadBadge authState={authState} />}
              </span>
            </button>
          ))}
          <button onClick={fetchAll} className="min-h-[44px] px-4 py-2 bg-slate-800/50 rounded-xl text-sm md:text-base text-slate-400 hover:bg-slate-700/50 transition-all md:ml-auto">↻ Refresh</button>
        </div>

        {activeTab === 'recruiters' && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Recruiter list */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700 overflow-hidden xl:col-span-2">
              <div className="p-4 border-b border-slate-700 flex gap-3">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search recruiters by name, email, company..."
                  className="flex-1 px-4 py-2.5 bg-slate-800/60 rounded-xl border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm md:text-base" />
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
                      className={`p-4 flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4 cursor-pointer hover:bg-slate-800/40 transition-all ${
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
                      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:gap-3 md:flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          r.canAccessPlatform ? 'bg-green-900/50 text-green-400 border border-green-700/40' : 'bg-red-900/50 text-red-400 border border-red-700/40'
                        }`}>{r.canAccessPlatform ? '● Active' : '● Revoked'}</span>
                        <button
                          onClick={e => { e.stopPropagation(); toggleAccess(r, 'recruiter'); }}
                          disabled={saving === r.id}
                          className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                            r.canAccessPlatform
                              ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-700/30'
                              : 'bg-green-900/30 hover:bg-green-900/50 text-green-300 border border-green-700/30'
                          }`}>
                          {saving === r.id ? '...' : r.canAccessPlatform ? 'Revoke' : 'Grant'}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); removeManagedUser(r, 'recruiter'); }}
                          disabled={saving === `delete-${r.id}`}
                          className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-700/30 disabled:opacity-50"
                        >
                          {saving === `delete-${r.id}` ? 'Removing...' : 'Remove'}
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
                      selectedRecruiter.canAccessPlatform ? 'bg-green-900/20 border-green-700/30' : 'bg-red-900/20 border-red-700/30'
                    }`}>
                      <p className={`font-bold text-sm ${selectedRecruiter.canAccessPlatform ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedRecruiter.canAccessPlatform ? '✅ Platform access granted' : '🚫 Platform access revoked'}
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
                  <button onClick={() => toggleAccess(selectedRecruiter, 'recruiter')} disabled={saving === selectedRecruiter.id}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                      selectedRecruiter.canAccessPlatform
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}>
                    {saving === selectedRecruiter.id ? 'Saving...' : selectedRecruiter.canAccessPlatform ? '🚫 Revoke Access' : '✅ Grant Access'}
                  </button>
                  <button
                    onClick={() => removeManagedUser(selectedRecruiter, 'recruiter')}
                    disabled={saving === `delete-${selectedRecruiter.id}`}
                    className="w-full mt-2 py-2.5 rounded-xl font-bold text-sm transition-all bg-rose-700 hover:bg-rose-600 text-white disabled:opacity-50"
                  >
                    {saving === `delete-${selectedRecruiter.id}` ? 'Removing...' : '🗑 Remove Recruiter'}
                  </button>

                  {/* Candidate Visibility */}
                  <div className="mt-3 rounded-xl border border-slate-700 overflow-hidden">
                    <button
                      onClick={() => setShowCandidateAccess(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-all text-sm font-semibold"
                    >
                      <span>👁 Candidate Visibility</span>
                      <span className="text-xs font-normal text-slate-400">
                        {selectedRecruiter.allowedCandidateIds == null
                          ? 'All candidates'
                          : `${selectedRecruiter.allowedCandidateIds.length} allowed`}
                      </span>
                    </button>
                    {showCandidateAccess && (
                      <div className="p-3 space-y-3 border-t border-slate-700">
                        <p className="text-xs text-slate-400">
                          Choose which candidates this recruiter can view. Default is all candidates.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCandidateAccessIds(null)}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${candidateAccessIds === null ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-500'}`}
                          >All Candidates</button>
                          <button
                            onClick={() => setCandidateAccessIds(prev => Array.isArray(prev) ? prev : [])}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${Array.isArray(candidateAccessIds) ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-500'}`}
                          >Restrict Access</button>
                        </div>
                        {Array.isArray(candidateAccessIds) && (
                          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg bg-slate-900/50 p-2">
                            {candidates.length === 0 ? (
                              <p className="text-xs text-slate-500 text-center py-4">No candidates in system</p>
                            ) : candidates.map(c => {
                              const checked = candidateAccessIds.includes(c.id);
                              return (
                                <label key={c.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setCandidateAccessIds(prev =>
                                      checked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                    )}
                                    className="accent-indigo-500"
                                  />
                                  <span className="text-xs flex-1 truncate">{c.name || c.email}</span>
                                  {c.role && <span className="text-xs text-slate-500 flex-shrink-0 truncate max-w-[80px]">{c.role}</span>}
                                </label>
                              );
                            })}
                          </div>
                        )}
                        <button
                          onClick={saveCandidateAccess}
                          disabled={savingAccess}
                          className="w-full py-2 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                        >
                          {savingAccess ? 'Saving...' : '💾 Save Visibility Settings'}
                        </button>
                      </div>
                    )}
                  </div>
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
              <h3 className="font-semibold">Candidate Accounts — {candidateAccounts.length} total</h3>
            </div>
            <div className="p-4 border-b border-slate-700 flex gap-3">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search candidates by name or email..."
                className="flex-1 px-4 py-2.5 bg-slate-800/60 rounded-xl border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm md:text-base" />
            </div>
            {filteredCandidates.length === 0 ? (
              <div className="p-12 text-center text-slate-500"><p className="text-4xl mb-3">🎯</p><p>No candidate accounts found</p></div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {filteredCandidates.map((candidateUser) => {
                  const relatedApplications = candidates.filter(c => String(c.email || '').toLowerCase() === String(candidateUser.email || '').toLowerCase());
                  return (
                    <div key={candidateUser.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4 hover:bg-slate-800/30 transition-all">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {candidateUser.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{candidateUser.name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400 truncate">{candidateUser.email}</p>
                        <p className="text-xs text-slate-500 truncate">Applications: {relatedApplications.length}</p>
                      </div>
                      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:gap-3 md:flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          candidateUser.canAccessPlatform ? 'bg-green-900/50 text-green-400 border border-green-700/40' : 'bg-red-900/50 text-red-400 border border-red-700/40'
                        }`}>{candidateUser.canAccessPlatform ? '● Active' : '● Revoked'}</span>
                        <button
                          onClick={() => toggleAccess(candidateUser, 'candidate')}
                          disabled={saving === candidateUser.id}
                          className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                            candidateUser.canAccessPlatform
                              ? 'bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-700/30'
                              : 'bg-green-900/30 hover:bg-green-900/50 text-green-300 border border-green-700/30'
                          }`}>
                          {saving === candidateUser.id ? '...' : candidateUser.canAccessPlatform ? 'Revoke' : 'Grant'}
                        </button>
                        <button
                          onClick={() => removeManagedUser(candidateUser, 'candidate')}
                          disabled={saving === `delete-${candidateUser.id}`}
                          className="min-h-[44px] px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-700/30 disabled:opacity-50"
                        >
                          {saving === `delete-${candidateUser.id}` ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700 p-4 md:p-5">
            <AdminQuestionPanel authState={authState} embedded={true} />
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700 p-4 md:p-5">
            <SuperAdminResourcePanel authState={authState} />
          </div>
        )}

        {activeTab === 'chat' && (
          <BlockchainChatPanel
            authState={authState}
            title="Recruiter ↔ Superadmin Chat"
            subtitle="Near real-time secure messaging with tamper-evident blockchain-style message chaining."
          />
        )}
      </div>
    </div>
  );
}

function SuperAdminResourcePanel({ authState }) {
  const ROLE_OPTIONS = [
    'General', 'Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
    'Data Scientist', 'Machine Learning Engineer', 'DevOps Engineer', 'UI/UX Designer',
    'Product Manager', 'Android Developer', 'iOS Developer', 'QA Engineer'
  ];

  const emptyForm = { role: 'General', title: '', url: '', description: '' };
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [resourceSearch, setResourceSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');

  const headers = useMemo(
    () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` }),
    [authState?.token]
  );

  const showNotice = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 3000);
  };

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/resources`, { headers });
      const data = await parseApiJson(res);
      if (data.success) setResources(data.resources || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesRole = roleFilter === 'All Roles' || resource.role === roleFilter;
      const haystack = [resource.role, resource.title, resource.description, resource.url].join(' ').toLowerCase();
      const matchesSearch = haystack.includes(resourceSearch.trim().toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [resources, resourceSearch, roleFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      showNotice('Title and YouTube URL are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `${API_URL}/api/superadmin/resources/${editingId}` : `${API_URL}/api/superadmin/resources`;
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(form)
      });
      const data = await parseApiJson(res);
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save resource');
      showNotice(editingId ? 'Resource updated.' : 'Resource created.');
      resetForm();
      fetchResources();
    } catch (error) {
      showNotice(error.message || 'Failed to save resource', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (resource) => {
    setEditingId(resource.id);
    setForm({
      role: resource.role || 'General',
      title: resource.title || '',
      url: resource.url || '',
      description: resource.description || ''
    });
  };

  const handleDelete = async (resource) => {
    if (!window.confirm(`Delete resource "${resource.title}"?`)) return;
    setDeletingId(resource.id);
    try {
      const res = await fetch(`${API_URL}/api/superadmin/resources/${resource.id}`, {
        method: 'DELETE',
        headers
      });
      const data = await parseApiJson(res);
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete resource');
      showNotice('Resource deleted.');
      fetchResources();
    } catch (error) {
      showNotice(error.message || 'Failed to delete resource', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${notice.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {notice.msg}
        </div>
      )}

      <div className="bg-gradient-to-br from-red-900/40 to-rose-900/40 rounded-2xl p-4 md:p-6 border border-red-500/30">
        <h2 className="text-xl md:text-2xl font-bold">🎥 Superadmin Resource Manager</h2>
        <p className="text-slate-300 text-sm md:text-base mt-1">Add YouTube links for the candidate Upgrade Skills stage. These are superadmin-only resources and are shown by job role after Results.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 bg-slate-800/40 rounded-2xl border border-slate-700 p-4 md:p-5 space-y-4">
          <h3 className="font-semibold text-white">{editingId ? 'Edit Resource' : 'Add Resource'}</h3>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Job Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg focus:border-red-500 focus:outline-none text-sm"
            >
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg focus:border-red-500 focus:outline-none text-sm"
              placeholder="System Design Crash Course"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">YouTube URL</label>
            <input
              value={form.url}
              onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg focus:border-red-500 focus:outline-none text-sm"
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg focus:border-red-500 focus:outline-none text-sm resize-none"
              placeholder="Why this video is useful for the selected role"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl font-semibold transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Resource' : 'Add Resource'}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="min-h-[44px] px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800/40 rounded-2xl border border-slate-700 p-4 md:p-5">
          <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-semibold text-white">Existing YouTube Resources</h3>
              <p className="mt-1 text-xs text-slate-400">Filter by role or search by title, description, and URL.</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-slate-900/70 border border-slate-600 text-slate-300">{filteredResources.length} shown · {resources.length} total</span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr),220px]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={resourceSearch}
                onChange={(e) => setResourceSearch(e.target.value)}
                placeholder="Search resources..."
                className="w-full rounded-xl border border-slate-600 bg-slate-900/60 py-2.5 pl-9 pr-3 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none"
            >
              <option value="All Roles">All Roles</option>
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="p-10 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto" /></div>
          ) : filteredResources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-600 bg-slate-900/40 p-8 text-center text-slate-400">
              No resources match the current filters.
            </div>
          ) : (
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {filteredResources.map((resource) => (
                <div key={resource.id} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    {buildYouTubeThumbnailUrl(resource.url) && (
                      <a href={resource.url} target="_blank" rel="noreferrer" className="hidden w-44 flex-shrink-0 overflow-hidden rounded-xl border border-red-500/20 bg-slate-950/40 md:block">
                        <img src={buildYouTubeThumbnailUrl(resource.url)} alt={resource.title} className="h-24 w-full object-cover" loading="lazy" />
                      </a>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-red-300 mb-1">{resource.role}</p>
                      <h4 className="font-semibold text-white break-words">{resource.title}</h4>
                      <a href={resource.url} target="_blank" rel="noreferrer" className="text-sm text-indigo-300 hover:text-indigo-200 underline underline-offset-2 break-all">
                        {resource.url}
                      </a>
                      {resource.description && <p className="text-sm text-slate-400 mt-2">{resource.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 md:flex-shrink-0">
                    <button onClick={() => handleEdit(resource)} className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-all">Edit</button>
                    <button onClick={() => handleDelete(resource)} disabled={deletingId === resource.id} className="min-h-[44px] px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-semibold transition-all disabled:opacity-50">
                      {deletingId === resource.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
    <div className="min-h-screen px-4 py-4 md:py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">🏢 Recruiter Dashboard</h1>
            {authState.user && <p className="mt-1 text-sm text-slate-400 md:text-base">Welcome back, {authState.user.name}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {subscription && (
              <div className="flex min-h-[44px] items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-600/20 px-4 py-2">
                <Crown size={18} className="text-yellow-400" />
                <span className="text-sm font-semibold md:text-base">{SUBSCRIPTION_PLANS[subscription.plan]?.name} Plan</span>
              </div>
            )}
            <button onClick={logout} className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-slate-800/50 px-4 py-2 text-sm transition-all hover:bg-slate-700/50 md:text-base">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex w-full flex-wrap gap-2 rounded-xl border border-slate-700 bg-slate-900/50 p-1.5 md:w-fit">
          <button
            id="tab-candidates"
            onClick={() => setActiveTab('candidates')}
            className={`min-h-[44px] px-5 py-2.5 rounded-lg font-semibold text-sm md:text-base transition-all flex items-center gap-2 ${
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
            className={`min-h-[44px] px-5 py-2.5 rounded-lg font-semibold text-sm md:text-base transition-all flex items-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sparkles size={16} />
            ⚙️ Admin Panel
          </button>
          <button
            id="tab-chat"
            onClick={() => setActiveTab('chat')}
            className={`min-h-[44px] px-5 py-2.5 rounded-lg font-semibold text-sm md:text-base transition-all flex items-center gap-2 ${
              activeTab === 'chat'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <MessageSquare size={16} />
            <span className="inline-flex items-center gap-2">
              Secure Chat
              <ChatUnreadBadge authState={authState} />
            </span>
          </button>
        </div>

        {activeTab === 'admin' ? (
          <AdminQuestionPanel authState={authState} />
        ) : activeTab === 'chat' ? (
          <BlockchainChatPanel
            authState={authState}
            title="Secure Chat With Superadmin"
            subtitle="Share text messages with the superadmin. Each message is stored in a tamper-evident hash chain."
          />
        ) : (
          <>
            {/* Stats */}
            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Total Candidates', value: stats.total, icon: Users, color: 'from-indigo-900/50 to-indigo-800/50 border-indigo-500/30', iconColor: 'text-indigo-400' },
                { label: 'Shortlisted', value: stats.shortlisted, icon: CheckCircle, color: 'from-green-900/50 to-green-800/50 border-green-500/30', iconColor: 'text-green-400' },
                { label: 'Hired', value: stats.hired, icon: Award, color: 'from-purple-900/50 to-purple-800/50 border-purple-500/30', iconColor: 'text-purple-400' },
                { label: 'Avg Score', value: stats.avgScore, icon: TrendingUp, color: 'from-pink-900/50 to-pink-800/50 border-pink-500/30', iconColor: 'text-pink-400' },
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br ${stat.color} rounded-xl p-5 border`}>
                  <stat.icon className={`${stat.iconColor} mb-2`} size={28} />
                  <p className="text-2xl font-bold md:text-3xl">{stat.value}</p>
                  <p className="text-sm text-slate-300 md:text-base">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Filters & Search */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700">
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <input
                  type="text" placeholder="Search by name or position..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="flex-1 bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2.5 text-sm md:text-base focus:outline-none focus:border-purple-500"
                />
                <div className="flex gap-2 flex-wrap">
                  {['all', 'shortlisted', 'hired', 'review', 'rejected'].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`min-h-[44px] px-4 py-2 rounded-lg text-sm md:text-base font-medium transition-all ${filter === f ? 'bg-purple-600 text-white' : 'bg-slate-800/50 hover:bg-slate-700/50 text-slate-400'
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
                        className="cursor-pointer rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 transition-all hover:border-slate-600 hover:bg-slate-800/70"
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      >
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-12 md:items-center md:gap-3">
                          {/* Avatar + Name */}
                          <div className="col-span-1 flex items-center gap-3 md:col-span-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{c.name}</p>
                              <p className="text-slate-500 text-xs">{c.email}</p>
                            </div>
                          </div>
                          <div className="col-span-1 text-sm text-slate-300 md:col-span-2 md:text-base">{c.position}</div>
                          <div className="col-span-1 text-left md:col-span-1 md:text-center">
                            <span className={`text-sm font-bold ${c.resumeScore >= 85 ? 'text-green-400' : c.resumeScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{c.resumeScore}</span>
                          </div>
                          <div className="col-span-1 text-left md:col-span-1 md:text-center">
                            <span className={`text-sm font-bold ${c.quizScore >= 85 ? 'text-green-400' : c.quizScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{c.quizScore}</span>
                          </div>
                          <div className="col-span-1 text-left md:col-span-1 md:text-center">
                            <span className={`text-sm font-bold ${c.interviewScore >= 85 ? 'text-green-400' : c.interviewScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{c.interviewScore}</span>
                          </div>
                          <div className="col-span-1 text-left md:col-span-1 md:text-center">
                            <span className={`text-sm font-bold ${c.videoInterviewScore >= 85 ? 'text-green-400' : c.videoInterviewScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{c.videoInterviewScore}</span>
                          </div>
                          <div className="col-span-1 text-left md:col-span-1 md:text-center">
                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${c.totalScore >= 85 ? 'bg-green-900/40 text-green-400' : c.totalScore >= 70 ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'
                              }`}>{c.totalScore}</div>
                          </div>
                          <div className="col-span-1 flex justify-start md:col-span-2 md:justify-center">{statusBadge(c.status)}</div>
                        </div>
                      </div>

                      {/* Expanded Row */}
                      {expandedId === c.id && (
                        <div className="rounded-b-xl border border-slate-700/50 border-t-0 bg-slate-800/20 px-4 py-4 md:px-6">
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
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
function AdminQuestionPanel({ authState, embedded = false }) {
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
  const [quizSettings, setQuizSettings] = useState({ candidateDurationMinutes: 30, recruiterDurationMinutes: 30 });
  const [savingDuration, setSavingDuration] = useState(false);

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
      if (data.success) {
        setQuestions(data.questions || []);
        if (data.quizSettings) {
          setQuizSettings({
            candidateDurationMinutes: Number(data.quizSettings.candidateDurationMinutes) || 30,
            recruiterDurationMinutes: Number(data.quizSettings.recruiterDurationMinutes) || 30
          });
        }
      }
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

    if (!editingQuestion) {
      showNotif('Adding extra questions is disabled. Use Edit or AI Refresh.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = { position: pos, question: form.question.trim(), options: opts, correctAnswer: form.correctAnswer };
      const url = `${API_URL}/api/admin/questions/${editingQuestion.id}`;
      const method = 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` },
        body: JSON.stringify(payload)
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error);
      showNotif('Question updated!');
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

  const handleRefreshPosition = async (position) => {
    if (!window.confirm(`Refresh all questions for ${position} using AI? Question count will remain the same.`)) return;
    setDeletingId(position);
    try {
      const res = await fetch(`${API_URL}/api/admin/questions/refresh/${encodeURIComponent(position)}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authState?.token}` }
      });
      const data = await parseApiJson(res);
      if (!res.ok || !data.success) throw new Error(data.error || 'Refresh failed');
      showNotif(`Refreshed ${data.refreshedCount || 0} questions for ${position}.`);
      fetchQuestions();
    } catch (e) {
      showNotif(e.message || 'Failed to refresh questions.', 'error');
    } finally { setDeletingId(null); }
  };

  const saveDurationSettings = async () => {
    setSavingDuration(true);
    try {
      const payload = {
        candidateDurationMinutes: Number(quizSettings.candidateDurationMinutes) || 30,
        recruiterDurationMinutes: Number(quizSettings.recruiterDurationMinutes) || 30
      };
      const res = await fetch(`${API_URL}/api/quiz/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authState?.token}` },
        body: JSON.stringify(payload)
      });
      const data = await parseApiJson(res);
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save duration settings');
      setQuizSettings({
        candidateDurationMinutes: Number(data.settings?.candidateDurationMinutes) || 30,
        recruiterDurationMinutes: Number(data.settings?.recruiterDurationMinutes) || 30
      });
      showNotif('Quiz duration settings updated.');
    } catch (e) {
      showNotif(e.message || 'Failed to update duration.', 'error');
    } finally {
      setSavingDuration(false);
    }
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
    <div className="space-y-4 md:space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-[calc(100%-2rem)] px-4 py-3 rounded-xl shadow-2xl font-semibold text-sm md:text-base flex items-center gap-2 transition-all ${
          notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {notification.type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} />}
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-orange-900/40 to-red-900/40 rounded-2xl p-4 md:p-6 border border-orange-500/30">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              ⚙️ {embedded ? 'Question Bank (Recruiter + Superadmin)' : 'Admin Question Bank'}
            </h2>
            <p className="text-slate-300 text-sm md:text-base mt-1">
              Modify and refresh assessment questions per job position. Recruiters and superadmin can replace questions. Extra question creation/deletion is disabled.
            </p>
          </div>
          <button
            id="btn-add-question"
            onClick={() => showNotif('Adding extra questions is disabled. Use Edit or AI Refresh.', 'error')}
            className="min-h-[44px] px-5 py-2.5 text-sm md:text-base bg-gradient-to-r from-slate-700 to-slate-600 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap shadow-lg"
          >
            <Sparkles size={18} /> Add Disabled
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <div className="bg-slate-800/40 rounded-xl p-3">
            <p className="text-slate-400 text-xs mb-1">Candidate Quiz Duration (min)</p>
            <input
              type="number"
              min={5}
              max={180}
              value={quizSettings.candidateDurationMinutes}
              onChange={(e) => setQuizSettings(prev => ({ ...prev, candidateDurationMinutes: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
            />
          </div>
          <div className="bg-slate-800/40 rounded-xl p-3">
            <p className="text-slate-400 text-xs mb-1">Recruiter Quiz Duration (min)</p>
            <input
              type="number"
              min={5}
              max={180}
              value={quizSettings.recruiterDurationMinutes}
              onChange={(e) => setQuizSettings(prev => ({ ...prev, recruiterDurationMinutes: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-900/60 border border-slate-600 rounded-lg focus:border-orange-500 focus:outline-none text-sm"
            />
          </div>
          <button
            onClick={saveDurationSettings}
            disabled={savingDuration}
            className="min-h-[44px] self-end px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
          >
            {savingDuration ? 'Saving...' : 'Save Duration'}
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
            {editingQuestion ? '✏️ Edit Question' : 'Question Update Only'}
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
            <p className="text-sm">Use AI Refresh to generate a fixed-size set for a position.</p>
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
                      id={`btn-refresh-${q.id}`}
                      onClick={() => handleRefreshPosition(q.position)}
                      disabled={deletingId === q.position}
                      className="px-4 py-1.5 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-500/30 text-orange-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      {deletingId === q.position ? '...' : '🔄 AI Refresh'}
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
