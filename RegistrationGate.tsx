import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  LogIn, 
  UserPlus, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff
} from 'lucide-react';
import { translations, Language } from '../translations';
import { 
  loginWithGoogle, 
  loginWithEmail, 
  registerWithEmail, 
  resetPassword,
  auth,
  db
} from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, updateProfile } from 'firebase/auth';
import { cn } from '../lib/utils';

interface LoginPageProps {
  language: Language;
  onClose?: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';
type LoginMethod = 'email' | 'phone';

export function LoginPage({ language, onClose }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [method, setMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const t = translations[language];

  const setupRecaptcha = async (containerId: string) => {
    try {
      // Clear any existing verifier to prevent "already exists" errors
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing verifier:', e);
        }
        (window as any).recaptchaVerifier = null;
        // Also clear the container content to be extra safe
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = '';
      }

      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible'
      });
      
      (window as any).recaptchaVerifier = verifier;
      await verifier.render();
      return verifier;
    } catch (err) {
      console.error('Recaptcha Setup Error:', err);
      throw new Error(language === 'bn' ? 'সিকিউরিটি চেক ব্যর্থ হয়েছে' : 'Security check failed to initialize');
    }
  };

  const cleanPhoneNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10) return null;
    // Standardize to +91 (India) if it's a 10-digit number
    if (digits.length === 10) return `+91${digits}`;
    // If it already has 91 at the start, just add +
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    // Fallback: take last 10 digits
    return `+91${digits.slice(-10)}`;
  };

  const handlePhoneSubmit = async () => {
    const phoneNumber = cleanPhoneNumber(phone);
    if (!phoneNumber) {
      setError(t.invalidPhone as string);
      return;
    }
    
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    try {
      console.log('Attempting OTP for:', phoneNumber);
      auth.languageCode = language; // Set language for SMS and Recaptcha
      
      const verifier = await setupRecaptcha('recaptcha-container');
      const result = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(result);
      setSuccess(language === 'bn' ? 'কোড পাঠানো হয়েছে' : 'Verification code sent');
    } catch (err: any) {
      console.error('Phone Auth Detailed Error:', {
        code: err.code,
        message: err.message,
        stack: err.stack,
        full: err
      });
      
      if (err.code === 'auth/operation-not-allowed') {
        setError(t.operationNotAllowed as string);
      } else if (err.code === 'auth/too-many-requests') {
        setError(language === 'bn' ? 'অতিরিক্ত চেষ্টার জন্য সাময়িকভাবে বন্ধ। পরে চেষ্টা করুন।' : 'Too many attempts. Please try again later.');
      } else if (err.code === 'auth/quota-exceeded') {
        setError(language === 'bn' ? 'এসএমএস কোটা শেষ হয়ে গেছে। পরে চেষ্টা করুন।' : 'SMS quota exceeded. Please try again tomorrow.');
      } else {
        setError(`${err.message} (${err.code})` || t.authFailed as string);
      }
      
      // Cleanup on failure
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {}
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || !confirmationResult) return;
    const result = await confirmationResult.confirm(verificationCode);
    if (mode === 'signup' && fullName && result.user) {
      await updateProfile(result.user, { displayName: fullName });
    }
    onClose?.();
  };

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (confirmationResult) {
        await handleVerifyCode();
        return;
      }

      if (method === 'phone') {
        await handlePhoneSubmit();
        return;
      }

      if (mode === 'forgot') {
        if (!validateEmail(email)) throw new Error(t.invalidEmail as string);
        await resetPassword(email);
        setSuccess(t.resetEmailSent as string);
      } else if (mode === 'login') {
        // 1. Sheet-based credential verification
        const username = method === 'email' ? email : phone;
        const sheetRes = await fetch('/api/sheet-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const sheetData = await sheetRes.json();
        if (!sheetRes.ok) {
          throw new Error(sheetData.error || (language === 'bn' ? 'লগইন ব্যর্থ হয়েছে' : 'Sheet-based authentication failed'));
        }

        // 2. Original Firebase Logic
        if (method === 'email') {
          if (!validateEmail(email)) throw new Error(t.invalidEmail as string);
          const firebaseUser = await loginWithEmail(email, password);
          
          // Sync sheet data to Firestore as well!
          if (sheetData.success && sheetData.user && firebaseUser) {
            try {
              const userRef = doc(db, 'users', firebaseUser.uid);
              await setDoc(userRef, {
                orgName: sheetData.user.orgName || sheetData.user.name || '',
                employeeStrength: sheetData.user.employeeStrength || 'small',
                email: sheetData.user.email || email,
                contactNo: sheetData.user.contactNo || '',
                state: sheetData.user.state || 'West Bengal',
                district: sheetData.user.district || 'Kolkata',
                pinCode: sheetData.user.pinCode || sheetData.user.pincode || '',
                sheetUserId: sheetData.user.sheetUserId || '',
                password: sheetData.user.password || password,
                googleFormSubmitted: true,
                partnerOnboardingCompleted: true,
                updatedAt: new Date().toISOString()
              }, { merge: true });
              console.log('Firebase user document successfully synced with authenticated sheet credentials!');
            } catch (fsSyncErr) {
              console.error('Failed to sync sheet user details to Firestore:', fsSyncErr);
            }
          }
        } else {
          // Phone logic handles confirmation separately
          await handlePhoneSubmit();
          return;
        }
        onClose?.();
      } else {
        if (!validateEmail(email)) throw new Error(t.invalidEmail as string);
        if (password.length < 6) throw new Error(t.weakPassword as string);
        if (!fullName) throw new Error(language === 'bn' ? 'নাম লিখুন' : 'Enter your name');
        
        // Store password for RegistrationGate to use later
        (window as any)._lastSignupPassword = password;
        
        await registerWithEmail(email, password, fullName);
        onClose?.();
      }
    } catch (err: any) {
      console.error(err);
      let message = t.authFailed as string;
      
      if (err.code === 'auth/email-already-in-use') {
        message = t.emailInUse as string;
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = t.invalidCredentials as string;
      } else if (err.code === 'auth/weak-password') {
        message = t.weakPassword as string;
      } else if (err.code === 'auth/invalid-email') {
        message = t.invalidEmail as string;
      } else if (err.code === 'auth/invalid-verification-code') {
        message = t.invalidCode as string;
      } else if (err.code === 'auth/operation-not-allowed') {
        message = t.operationNotAllowed as string;
      } else if (err.message) {
        message = err.message;
      }
      
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(t.authFailed);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
      {/* Recaptcha Container (Hidden) */}
      <div id="recaptcha-container" className="fixed bottom-0 right-0 opacity-0 pointer-events-none"></div>

      {/* Background Overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm"
      />

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-gray-100/50 overflow-hidden relative z-10"
      >
        {/* Top Decorative Sun */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 blur-3xl -mr-12 -mt-12 rounded-full" />
        
        <div className="p-8 sm:p-12">
          {/* Header */}
          <div className="text-center space-y-3 mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-400 rounded-3xl shadow-xl shadow-amber-200 mb-4 transform -rotate-6">
              <Sun className="w-8 h-8 text-black fill-current" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">
              {mode === 'login' ? t.login : mode === 'signup' ? t.signup : t.forgotPassword}
            </h2>
            <p className="text-gray-500 font-medium text-lg leading-snug">
              {mode === 'login' 
                ? (language === 'bn' ? 'সৌর মিত্র পরিবারে আপনাকে স্বাগতম' : 'Welcome back to the solar family')
                : mode === 'signup'
                  ? (language === 'bn' ? 'নতুন অ্যাকাউন্ট তৈরি করুন' : 'Create your solar journey')
                  : (language === 'bn' ? 'পাসওয়ার্ড রিসেট করতে ইমেল দিন' : 'Enter email to reset password')
              }
            </p>
          </div>

          {/* Login Type Switcher */}
          {!confirmationResult && mode !== 'forgot' && (
            <div className="flex bg-gray-50 p-1.5 rounded-2xl mb-8 border border-gray-100">
              <button
                onClick={() => { setMethod('email'); setError(null); setSuccess(null); }}
                type="button"
                className={cn(
                  "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                  method === 'email' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                {t.emailId}
              </button>
              <button
                onClick={() => { setMethod('phone'); setError(null); setSuccess(null); }}
                type="button"
                className={cn(
                  "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                  method === 'phone' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}
              >
                {t.mobileNo}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {mode === 'signup' && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-6"
                >
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-gray-700 uppercase tracking-widest px-1">{t.fullName}</span>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-amber-500 transition-colors">
                        <User className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="block w-full pl-12 pr-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-medium placeholder-gray-400 focus:bg-white focus:border-amber-400 focus:ring-0 transition-all outline-none"
                        placeholder="John Doe"
                      />
                    </div>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {confirmationResult ? (
                <motion.div
                  key="otp-field"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-gray-700 uppercase tracking-widest px-1">{t.verificationCode}</span>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-amber-500 transition-colors">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="block w-full pl-12 pr-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-medium placeholder-gray-400 focus:bg-white focus:border-amber-400 focus:ring-0 transition-all outline-none"
                        placeholder="123456"
                      />
                    </div>
                  </label>
                </motion.div>
              ) : method === 'email' ? (
                <motion.div
                  key="email-field"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-gray-700 uppercase tracking-widest px-1">{t.emailId}</span>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-amber-500 transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-12 pr-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-medium placeholder-gray-400 focus:bg-white focus:border-amber-400 focus:ring-0 transition-all outline-none"
                        placeholder="john@example.com"
                      />
                    </div>
                  </label>
                </motion.div>
              ) : (
                <motion.div
                  key="phone-field"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <label className="block space-y-2">
                    <span className="text-sm font-bold text-gray-700 uppercase tracking-widest px-1">{t.mobileNo}</span>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-amber-500 transition-colors">
                        <div className="text-xs font-black">+91</div>
                      </div>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="block w-full pl-12 pr-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-medium placeholder-gray-400 focus:bg-white focus:border-amber-400 focus:ring-0 transition-all outline-none"
                        placeholder="98765 43210"
                      />
                    </div>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {mode !== 'forgot' && method === 'email' && !confirmationResult && (
              <label className="block space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-bold text-gray-700 uppercase tracking-widest">{t.password}</span>
                  {mode === 'login' && (
                    <button 
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs font-bold text-amber-600 hover:text-amber-700 transition"
                    >
                      {t.forgotPassword}
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-amber-500 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-medium placeholder-gray-400 focus:bg-white focus:border-amber-400 focus:ring-0 transition-all outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </label>
            )}

            {mode === 'login' && method === 'email' && !confirmationResult && (
              <div className="flex items-center gap-3 px-1">
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className={cn(
                    "w-5 h-5 rounded border-2 transition-all flex items-center justify-center",
                    rememberMe ? "bg-amber-400 border-amber-400 text-black" : "border-gray-200"
                  )}
                >
                  {rememberMe && <CheckCircle2 className="w-3.5 h-3.5 fill-current" />}
                </button>
                <span className="text-sm font-bold text-gray-500">{t.rememberMe}</span>
              </div>
            )}

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 text-red-600 px-5 py-4 rounded-2xl flex items-start gap-3 border border-red-100"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold leading-snug">{error}</p>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-green-50 text-green-600 px-5 py-4 rounded-2xl flex items-start gap-3 border border-green-100"
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-bold leading-snug">{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-zinc-900 border-b-4 border-black text-white rounded-2xl font-bold text-lg hover:bg-zinc-800 active:translate-y-1 active:border-b-0 transition-all shadow-xl shadow-zinc-200 flex items-center justify-center gap-3 relative overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
              {isLoading ? (
                <Sun className="w-6 h-6 animate-spin text-amber-400" />
              ) : (
                <>
                  {confirmationResult ? <CheckCircle2 className="w-5 h-5 text-amber-400" /> : <LogIn className="w-5 h-5 text-amber-400" />}
                  {mode === 'forgot' 
                    ? (language === 'bn' ? 'রিসেট লিঙ্ক পাঠান' : 'Send Reset Link') 
                    : confirmationResult 
                      ? t.verifyCode 
                      : method === 'phone' 
                        ? t.sendCode 
                        : mode === 'signup' 
                          ? t.createAccount 
                          : t.login
                  }
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-10 flex items-center gap-4 text-gray-300">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t.or}</span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          {/* Social Logins */}
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-4 px-6 py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-700 hover:border-amber-400 hover:bg-amber-50/30 transition-all group"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t.loginWithGoogle}
            </button>
          </div>

          <div className="mt-8 text-center">
            {mode === 'login' ? (
              <p className="text-gray-500 font-bold">
                {t.dontHaveAccount}{' '}
                <button
                  onClick={() => { setMode('signup'); setConfirmationResult(null); }}
                  className="text-amber-600 hover:text-amber-700 transition"
                >
                  {t.clickHere}
                </button>
              </p>
            ) : (
              <p className="text-gray-500 font-bold">
                {t.alreadyHaveAccount}{' '}
                <button
                  onClick={() => { setMode('login'); setConfirmationResult(null); }}
                  className="text-amber-600 hover:text-amber-700 transition"
                >
                  {t.clickHere}
                </button>
              </p>
            )
            }
          </div>
        </div>
      </motion.div>
    </div>
  );
}
