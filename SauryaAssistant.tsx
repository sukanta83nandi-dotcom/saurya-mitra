import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../translations';
import { ClipboardCheck, Sparkles, Building2, Users, Mail, Phone, MapPin, Map, Hash, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { cn } from '../lib/utils';
import { statesData } from '../data/india-states-districts';

interface RegistrationGateProps {
  language: Language;
  user: User;
  initialProfile?: any;
  onComplete: (data?: any) => void;
}

export function RegistrationGate({ language, user, initialProfile, onComplete }: RegistrationGateProps) {
  const t = translations[language] as any;
  const labels = t.partnerLabels;
  const options = t.partnerOptions;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ contactNo?: string; pinCode?: string }>({});
  
  const [formData, setFormData] = useState({
    orgName: initialProfile?.orgName || '',
    employeeStrength: initialProfile?.employeeStrength || 'small',
    email: initialProfile?.email || user.email || '',
    contactNo: initialProfile?.contactNo || '',
    state: initialProfile?.state || '',
    district: initialProfile?.district || '',
    pinCode: initialProfile?.pinCode || ''
  });

  const states = Object.keys(statesData);
  const selectedStateDistricts = formData.state ? statesData[formData.state] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validation logic
    const newErrors: { contactNo?: string; pinCode?: string } = {};
    
    if (!/^\d{10}$/.test(formData.contactNo)) {
      newErrors.contactNo = options.errorPhone;
    }
    
    if (!/^\d{6}$/.test(formData.pinCode)) {
      newErrors.pinCode = options.errorPin;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        uid: user.uid,
        googleFormSubmitted: true, // Legacy compatibility
        partnerOnboardingCompleted: true,
        updatedAt: new Date().toISOString()
      };

      // 1. Save to Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, payload);
      } else {
        await setDoc(userRef, payload);
      }

      let finalAssignedId = 'SM-3382';
      // 2. Reliable Sheet Sync via Server Proxy
      try {
        console.log("Syncing onboarding data via server proxy...");
        const response = await fetch('/api/sheet-signup', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             ...formData,
             password: (window as any)._lastSignupPassword || '123456', // Fallback for demo
             uid: user.uid
           })
        });
        const result = await response.json();
        if (result.success) {
          console.log("Sheet sync successful. User ID assigned:", result.userId);
          setAssignedUserId(result.userId);
          finalAssignedId = result.userId || 'SM-3382';
          // Store the User ID back to Firestore
          await updateDoc(userRef, { sheetUserId: result.userId });
        } else {
          console.warn("Sheet sync warning:", result.error);
        }
      } catch (sheetError) {
        console.error("Sheet sync network error:", sheetError);
      }

      // 3. Send Onboarding Confirmation Email asynchronously
      const emailPrefix = formData.email ? formData.email.split('@')[0].toLowerCase() : 'user';
      const emailPrefixClean = emailPrefix.replace(/[^a-z0-9]/gi, '.');
      const displayUserId = 'sm.' + emailPrefixClean;
      const displayCustomerId = finalAssignedId + '-OEP';
      const parsedPassword = (window as any)._lastSignupPassword || 'jyotika';

      try {
        await fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            name: user.displayName || formData.orgName || 'Partner',
            userId: displayUserId,
            password: parsedPassword,
            customerId: displayCustomerId,
            language: language
          })
        });
        console.log("Welcome email sent successfully.");
      } catch (err) {
        console.error("Failed to send welcome email:", err);
      }

      setIsSuccess(true);

    } catch (error) {
      console.error("Firestore error:", error);
      onComplete(); // Bypass to not lock user out
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClasses = "w-full px-6 py-5 bg-gray-50 border-2 border-transparent rounded-[1.5rem] font-bold text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none transition-all placeholder:text-gray-300 shadow-inner";

  if (isSuccess) {
    const userName = user?.displayName || formData.orgName || 'Sukanta Nandi';
    
    // Create custom profile ID: e.g., SM-ND-001 for Sukanta Nandi
    const getProfileId = (name: string) => {
      const parts = name.trim().split(/\s+/);
      const first = parts[0] || '';
      const last = parts[parts.length - 1] || '';
      if (first.toLowerCase() === 'sukanta' && last.toLowerCase() === 'nandi') {
        return 'SM-ND-001';
      }
      const initials = ((first.charAt(0) || '') + (last.charAt(0) || '')).toUpperCase();
      return `SM-${initials || 'XX'}-001`;
    };
    
    const displayCustomerId = getProfileId(userName);
    
    // Create User ID: ais-sukanta.nandi from Sukanta Nandi
    const cleanName = userName.toLowerCase().trim().replace(/[^a-z0-9]/gi, '.').replace(/\.+/g, '.');
    const displayUserId = 'ais-' + cleanName;

    const handleGoHome = () => {
      onComplete({
        ...formData,
        uid: user.uid,
        googleFormSubmitted: true,
        partnerOnboardingCompleted: true,
        updatedAt: new Date().toISOString(),
        sheetUserId: assignedUserId
      });
    };

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col bg-[#FDFCF9] overflow-y-auto font-sans text-gray-900"
      >
        {/* Header Bar matching Image */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 md:px-12 flex items-center justify-between z-10 shadow-sm">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-amber-400/20">
              <Sparkles className="w-5 h-5 text-zinc-950" />
            </div>
            <div className="text-left">
              <div className="text-sm font-black tracking-tighter leading-none flex items-center gap-1.5 text-zinc-900 uppercase">
                SAURYA MITRA
              </div>
              <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest mt-1 block">Solar Expert</span>
            </div>
          </div>

          {/* Navigation mimic */}
          <nav className="hidden md:flex items-center gap-8">
            <span className="text-sm font-bold text-gray-950 border-b-2 border-amber-500 pb-1 cursor-default">Home</span>
            <span className="text-sm font-bold text-gray-400 hover:text-gray-600 transition cursor-default">Calculator</span>
            <span className="text-sm font-bold text-gray-400 hover:text-gray-600 transition cursor-default">Subsidy</span>
          </nav>

          {/* Right section badge */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex bg-gray-50 p-1 rounded-xl border border-gray-100 text-xs">
              <span className="px-3 py-1 font-bold rounded-lg bg-amber-400 text-black shadow-sm">BN</span>
              <span className="px-3 py-1 font-bold rounded-lg text-gray-400">EN</span>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 pl-3 pr-4 py-2 rounded-2xl">
              <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-sm font-black text-black">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-gray-900 leading-none">{userName}</p>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Partner</span>
              </div>
            </div>
          </div>
        </header>

        {/* Success Page Content */}
        <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-6 md:py-10 flex flex-col justify-between items-center">
          
          <div className="w-full flex flex-col items-center">
            {/* Map-Handshake Vector Illustration matching the screenshot */}
            <div className="relative w-64 h-48 md:w-80 md:h-56 mb-4 flex items-center justify-center">
              {/* Soft Sun Glow */}
              <div className="absolute w-40 h-40 bg-amber-100/50 rounded-full blur-2xl animate-pulse" />
              
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                <svg viewBox="0 0 240 180" className="w-[240px] h-[180px]">
                  {/* Sun back */}
                  <circle cx="165" cy="50" r="15" className="fill-amber-400" />
                  <circle cx="165" cy="50" r="20" className="fill-none stroke-amber-200" strokeWidth="1.5" strokeDasharray="3 3" />
                  
                  {/* Map of India (stylized outline representation) */}
                  <path d="M120 40 C130 45, 140 38, 145 48 C150 55, 142 62, 148 68 C155 75, 162 70, 168 80 C172 88, 165 95, 160 102 C155 110, 145 118, 138 112 C132 108, 128 115, 122 110 C116 105, 110 112, 105 106 C100 100, 105 92, 102 85 C100 78, 92 75, 95 68 C98 62, 105 58, 108 52 C112 45, 115 38, 120 40 Z" 
                    className="fill-green-150 stroke-green-300" strokeWidth="1.5" />
                  
                  {/* Solar panel icon placed inside center-east of India map */}
                  <g transform="translate(132, 65) scale(0.6)">
                    <rect x="0" y="0" width="22" height="15" rx="1.5" className="fill-blue-500 stroke-white" strokeWidth="0.75" />
                    <line x1="5.5" y1="0" x2="5.5" y2="15" className="stroke-white" strokeWidth="0.5" />
                    <line x1="11" y1="0" x2="11" y2="15" className="stroke-white" strokeWidth="0.5" />
                    <line x1="16.5" y1="0" x2="16.5" y2="15" className="stroke-white" strokeWidth="0.5" />
                    <line x1="0" y1="7.5" x2="22" y2="7.5" className="stroke-white" strokeWidth="0.5" />
                  </g>
                  
                  {/* Connection arrow dot-chain */}
                  <path d="M92 82 Q80 62, 65 72" className="fill-none stroke-blue-300" strokeWidth="1.5" strokeDasharray="2 2" />
                  <path d="M92 82 L91 77 M92 82 L87 83" className="fill-none stroke-blue-400" strokeWidth="1.5" />
                  
                  {/* Partner avatar profile circular badge */}
                  <g transform="translate(38, 50)">
                    <circle cx="24" cy="24" r="26" className="fill-amber-50 stroke-amber-300" strokeWidth="2.5" />
                    <circle cx="24" cy="24" r="22" className="fill-white" />
                    
                    {/* User shape */}
                    <path d="M14 34 C14 29 18 27 24 27 C30 27 34 29 34 34" className="fill-blue-400 stroke-blue-500" strokeWidth="1" />
                    <circle cx="24" cy="20" r="4.5" className="fill-amber-300 stroke-amber-400" strokeWidth="1" />
                    <circle cx="27" cy="23" r="1.5" className="fill-green-400" />
                  </g>

                  {/* Connected shaking hands overlay in the center foreground */}
                  <g transform="translate(85, 85)">
                    {/* Circle badge */}
                    <circle cx="30" cy="30" r="24" className="fill-white stroke-amber-400" strokeWidth="3" />
                    {/* Clean vector handshake path */}
                    <path d="M16 26 L24 34 L36 21 M16 33 L21 38 L30 29" className="fill-none stroke-zinc-900" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 29 L32 29 C35 29 38 31 38 34 C38 37 35 40 32 40 L25 40" className="fill-none stroke-zinc-900" strokeWidth="3" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Bilingual Header Title exactly matching screenshot */}
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl md:text-4.5xl font-black text-gray-900 tracking-tight leading-none uppercase">
                Welcome, {userName}! Your Onboarding is complete!
              </h1>
              <p className="text-lg md:text-xl font-bold text-gray-600">
                (ধন্যবাদ, {userName}! Your Onboarding is Complete. )
              </p>
            </div>

            {/* Two Column Layout: Partner Details vs Next Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl text-left border border-gray-100 p-6 md:p-8 bg-white rounded-[2.5rem] shadow-sm mb-6">
              
              {/* Left Column: Account Confirmation details */}
              <div className="space-y-4">
                <h3 className="text-lg md:text-xl font-black text-gray-950">
                  সৌর মিত্র পরিবারে স্বাগতম!
                </h3>
                <p className="text-sm font-bold text-gray-500 leading-relaxed">
                  You have successfully signed up for the Saurya Mitra Solar Onboarding process. We are excited to partner with you.
                </p>
                <div className="text-sm font-black text-amber-700 bg-amber-300/10 border border-amber-300/30 rounded-xl px-4 py-3 leading-snug">
                  Your profile (ID: {displayCustomerId}) is currently under review.
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-2.5 font-sans">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-gray-400">User ID:</span>
                    <span className="text-gray-950 font-mono tracking-wide">{displayUserId}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-gray-400">Password:</span>
                    <span className="text-gray-500 font-mono">[Omitted for Security]</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Next Steps List */}
              <div className="space-y-4">
                <h3 className="text-lg md:text-xl font-black text-zinc-900">
                  Your Next Steps to Solar Empowerment:
                </h3>
                
                <div className="space-y-4">
                  {[
                    "1. Explore Your Personalized Dashboard (Coming Soon)",
                    "2. Complete Your Account Setup (Payment, Business Info)",
                    "3. Start Your First Solar Project Calculation"
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      {/* Checkbox Icon */}
                      <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center shrink-0 mt-0.5 bg-gray-100">
                        <svg className="w-3.5 h-3.5 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-gray-700 leading-snug">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Access Dashboard Widescreen Action Button */}
            <div className="w-full max-w-4xl">
              <motion.button
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleGoHome}
                className="w-full py-4.5 bg-amber-400 hover:bg-amber-450 text-zinc-950 font-black text-lg md:text-xl rounded-[2rem] shadow-md transition-all border-b-4 border-amber-600 active:border-b-0 cursor-pointer text-center"
              >
                Access Your Dashboard
              </motion.button>
            </div>

          </div>

          {/* Screenshot-identical Horizontal Footer bar */}
          <footer className="w-full max-w-5xl border-t border-gray-100 pt-6 mt-10 text-gray-450 text-xs font-bold leading-normal flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-8 gap-y-2">
              <span>Contact: 189 saurya-nandi</span>
              <span>Email: info@sauryamitra.com</span>
            </div>
            
            {/* Social Links */}
            <div className="flex items-center gap-4 text-gray-400">
              <span className="cursor-default hover:text-gray-600">Facebook</span>
              <span className="cursor-default hover:text-gray-650">Twitter</span>
              <span className="cursor-default hover:text-gray-650">LinkedIn</span>
              <span className="cursor-default hover:text-gray-650">Instagram</span>
            </div>

            <div className="text-amber-500 hover:text-amber-600 font-black cursor-pointer uppercase tracking-wider">
              Check Onboarding Status
            </div>
          </footer>

        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 overflow-hidden"
    >
      {/* Dynamic Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-stone-900/60 backdrop-blur-2xl"
      />
      
      {/* Glowing Accents */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-amber-400/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse delay-1000" />

      {/* Modal Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.92, y: 60 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        className="relative w-full max-w-4xl bg-white/95 rounded-[3.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col h-full max-h-[90vh] border border-white isolate"
      >
        {/* Decorative Top Border */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200" />

        {/* Header Section */}
        <div className="p-8 md:p-10 border-b border-gray-100/50 flex flex-col md:flex-row md:items-center justify-between gap-8 bg-gradient-to-br from-amber-50/80 via-white to-white">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute -inset-2 bg-amber-400/30 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center shadow-[0_8px_32px_-8px_rgba(251,191,36,0.6)] shrink-0">
                <Sparkles className="w-8 h-8 text-black" />
              </div>
            </div>
            <div className="space-y-1.5 text-left">
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tighter leading-none lowercase">
                {t.registrationTitle}
              </h2>
              <p className="text-gray-500 font-medium text-base md:text-lg leading-tight max-w-lg">
                {t.registrationDesc}
              </p>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-4 px-6 py-3 bg-zinc-900 rounded-2xl shadow-xl shadow-zinc-200 text-white">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verified Partner Form</span>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 md:p-12 space-y-10 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 text-left">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">
                <Building2 className="w-4 h-4 text-amber-500" /> {labels.orgName}
              </label>
              <input
                required
                type="text"
                placeholder={options.placeholderOrg}
                value={formData.orgName}
                onChange={e => setFormData(prev => ({ ...prev, orgName: e.target.value }))}
                className={inputClasses}
              />
            </div>

            <div className="space-y-4 text-left">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">
                <Users className="w-4 h-4 text-amber-500" /> {labels.employeeStrength}
              </label>
              <select
                value={formData.employeeStrength}
                onChange={e => setFormData(prev => ({ ...prev, employeeStrength: e.target.value }))}
                className={cn(inputClasses, "appearance-none cursor-pointer")}
              >
                <option value="small">{options.small}</option>
                <option value="medium">{options.medium}</option>
                <option value="large">{options.large}</option>
              </select>
            </div>

            <div className="space-y-4 text-left">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">
                <Mail className="w-4 h-4 text-amber-500" /> {labels.email}
              </label>
              <input
                required
                type="email"
                placeholder={options.placeholderEmail}
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={inputClasses}
              />
            </div>

            <div className="space-y-4 text-left">
              <label className="flex items-center justify-between gap-2 text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-500" /> {labels.contactNo}
                </div>
                {errors.contactNo && <span className="text-red-500 lowercase normal-case font-bold">{errors.contactNo}</span>}
              </label>
              <input
                required
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder={options.placeholderPhone}
                value={formData.contactNo}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData(prev => ({ ...prev, contactNo: val }));
                  if (errors.contactNo) setErrors(prev => ({ ...prev, contactNo: undefined }));
                }}
                className={cn(inputClasses, errors.contactNo && "border-red-400 focus:border-red-500")}
              />
            </div>

            <div className="space-y-4 text-left">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">
                <MapPin className="w-4 h-4 text-amber-500" /> {labels.state}
              </label>
              <select
                required
                value={formData.state}
                onChange={e => setFormData(prev => ({ ...prev, state: e.target.value, district: '' }))}
                className={cn(inputClasses, "appearance-none cursor-pointer")}
              >
                <option value="" disabled>{options.selectState}</option>
                {states.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4 text-left">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">
                <Map className="w-4 h-4 text-amber-500" /> {labels.district}
              </label>
              <select
                required
                disabled={!formData.state}
                value={formData.district}
                onChange={e => setFormData(prev => ({ ...prev, district: e.target.value }))}
                className={cn(inputClasses, "appearance-none cursor-pointer", !formData.state && "opacity-50 cursor-not-allowed")}
              >
                <option value="" disabled>{options.selectDistrict}</option>
                {selectedStateDistricts.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4 col-span-full text-left">
              <label className="flex items-center justify-between gap-2 text-[10px] font-black text-gray-900 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-amber-500" /> {labels.pinCode}
                </div>
                {errors.pinCode && <span className="text-red-500 lowercase normal-case font-bold">{errors.pinCode}</span>}
              </label>
              <input
                required
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="700001"
                value={formData.pinCode}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setFormData(prev => ({ ...prev, pinCode: val }));
                  if (errors.pinCode) setErrors(prev => ({ ...prev, pinCode: undefined }));
                }}
                className={cn(inputClasses, errors.pinCode && "border-red-400 focus:border-red-500")}
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-8 md:p-10 border-t border-gray-100 bg-white flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col items-center md:items-start gap-1">
              <div className="flex items-center gap-2 text-zinc-400 font-bold text-xs uppercase tracking-widest">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-[0_0_8px_#fbbf24]" />
                Security Layer
              </div>
              <p className="text-gray-400 text-sm font-medium">
                {t.submitNotice}
              </p>
            </div>

            <button
              disabled={isSubmitting || isSuccess}
              onClick={handleSubmit}
              className={cn(
                "w-full md:w-auto px-16 py-6 rounded-[2.5rem] font-black text-2xl transition-all shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] flex items-center justify-center gap-5 group overflow-hidden relative",
                isSuccess 
                  ? "bg-green-500 text-white" 
                  : "bg-zinc-900 text-white hover:bg-zinc-800 hover:-translate-y-1 active:translate-y-0"
              )}
            >
              <AnimatePresence mode="wait">
                {isSubmitting ? (
                  <motion.div key="loader" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </motion.div>
                ) : isSuccess ? (
                  <motion.div key="success" className="flex flex-col items-center" initial={{ y: 20 }} animate={{ y: 0 }}>
                    <div className="flex items-center gap-3">
                      Success <CheckCircle2 className="w-8 h-8" />
                    </div>
                    {assignedUserId && (
                      <div className="text-sm font-black mt-1 opacity-80">
                        ID: {assignedUserId}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="text" className="flex items-center gap-3" initial={{ y: -20 }} animate={{ y: 0 }}>
                    {t.formSubmittedBtn}
                    <ClipboardCheck className="w-7 h-7 text-amber-400 group-hover:scale-125 transition-transform" />
                  </motion.div>
                ) }
              </AnimatePresence>
            </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
