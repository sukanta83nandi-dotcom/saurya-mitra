import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { BillReader } from './components/BillReader';
import { SavingsCalculator } from './components/SavingsCalculator';
import { SubsidyGuide } from './components/SubsidyGuide';
import { BusinessBenefits } from './components/BusinessBenefits';
import { ReportHistory } from './components/ReportHistory';
import { VendorLookup } from './components/VendorLookup';
import { FeedbackForm } from './components/FeedbackForm';
import { SauryaAssistant } from './components/SauryaAssistant';
import { DigitalClock } from './components/DigitalClock';
import { MaintenanceGuide } from './components/MaintenanceGuide';
import { ClaimProcess } from './components/ClaimProcess';
import { WarrantyLocker } from './components/WarrantyLocker';
import { BillData } from './types';
import { FileScan, Calculator, Landmark, Sun, ArrowRight, Zap, History, Building2, MessageSquare, Wrench, ShieldCheck, FolderLock, Mail, Sparkles } from 'lucide-react';
import { cn } from './lib/utils';
import { Language, translations } from './translations';
import { auth, db, OperationType, handleFirestoreError, logout } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { RegistrationGate } from './components/RegistrationGate';
import { Loader2 } from 'lucide-react';
import { LoginPage } from './components/LoginPage';

type TabType = 'reader' | 'calculator' | 'guide' | 'vendors' | 'maintenance' | 'claim' | 'locker' | 'history' | 'feedback';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const [billData, setBillData] = useState<BillData | null>(null);
  const [language, setLanguage] = useState<Language>('bn');
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isFormSubmitted, setIsFormSubmitted] = useState<boolean | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setActiveTab(null);
      if (currentUser) {
        console.log('User logged in in App.tsx:', currentUser.uid);
        
        // Listen to the user document in real-time
        unsubscribeDoc = onSnapshot(doc(db, 'users', currentUser.uid), (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            const status = !!data.googleFormSubmitted;
            console.log('Real-time Google Form status from DB loaded:', status, data);
            setUserProfile(data);
            setIsFormSubmitted(status);
          } else {
            console.log('User document does not exist, setting status to false');
            setIsFormSubmitted(false);
            setUserProfile(null);
          }
        }, (error) => {
          console.error('Error listening to user document:', error);
          setIsFormSubmitted(false);
        });

      } else {
        console.log('No user logged in');
        setIsFormSubmitted(null);
        setUserProfile(null);
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  // Idle Auto Logout Hook (10 minutes)
  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // 10 minutes = 600,000 ms
      timeoutId = setTimeout(() => {
        console.log('User idle for 10 minutes, logging out...');
        logout().catch(err => console.error('Error auto-logging out:', err));
      }, 600000); // 10 minutes
    };

    // Set up listeners for active interactions
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => resetTimer();

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Initialize the timer on mount (when user logs in or is active)
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user]);

  const t = translations[language];

  const handleBillExtracted = (data: BillData) => {
    setBillData(data);
    setTimeout(() => setActiveTab('calculator'), 1500);
  };

  const handleRegistrationComplete = (data: any) => {
    setUserProfile(data);
    setIsFormSubmitted(true);
  };

  const tabs = [
    { id: 'calculator', label: t.tabCalculator, icon: Calculator },
    { id: 'guide', label: t.tabGuide, icon: Landmark },
    { id: 'vendors', label: t.tabVendors, icon: Building2 },
    { id: 'maintenance', label: t.tabMaintenance || (language === 'bn' ? 'রক্ষণাবেক্ষণ' : 'Maintenance'), icon: Wrench },
    { id: 'claim', label: t.tabClaim || (language === 'bn' ? 'ক্লেইম প্রসেস' : 'Claim Process'), icon: ShieldCheck },
    { id: 'locker', label: t.tabWarrantyLocker || (language === 'bn' ? 'ওয়ারেন্টি লকার' : 'Warranty Locker'), icon: FolderLock },
    { id: 'feedback', label: t.tabFeedback || (language === 'bn' ? 'ফিডব্যাক' : 'Feedback'), icon: MessageSquare },
  ];

  if (user) {
    tabs.push({ id: 'history', label: t.tabHistory || (language === 'bn' ? 'আগের রিপোর্ট' : 'History'), icon: History });
  }

  const getTabDesc = (tabId: string, isBn: boolean) => {
    switch (tabId) {
      case 'reader':
        return isBn ? 'আপনার বিদ্যুৎ বিল আপলোড করে তাত্ক্ষণিক সোলার প্রয়োজনীয়তা বুঝুন।' : 'Upload and extract instant solar consumption feasibility indicators.';
      case 'calculator':
        return isBn ? 'আপনার ছাদের সাইজ, খরচ, সরকারি সাবসিডি ও সঞ্চয় গণনা করুন।' : 'Calculate roof area, panel expenses, direct subsidies, and savings.';
      case 'guide':
        return isBn ? 'পিএম সূর্য ঘর যোজনার সরকারি নিয়মাবলী ও ধাপে ধাপে আপডেট নির্দেশিকা।' : 'PM Surya Ghar scheme guidelines, solar norms, and criteria.';
      case 'vendors':
        return isBn ? 'পশ্চিমবঙ্গের বিদ্যুৎ বন্টন কোম্পানি অনুমোদিত নিবন্ধিত সোলার ডিলার্স।' : 'Browse licensed solar installers under local state registries.';
      case 'maintenance':
        return isBn ? 'সোলার প্যানেলের সর্বোচ্চ সুরক্ষায় দিনভিত্তিক চেকলিস্ট ও রেকর্ডিং লগ।' : 'Interactive morning/night cleaning checklist and maintenance logging.';
      case 'claim':
        return isBn ? 'সাবসিডি ক্লেইম করার জন্য দরকারি ডকুমেন্টস ও সিকোয়েন্স নির্দেশিকা।' : 'Step-by-step government financial claim pipelines & checks.';
      case 'locker':
        return isBn ? 'প্যানেল সিরিয়াল ও ড্রাফট ইনভয়েস ফাইল অক্ষত রাখতে সুরক্ষিত মেঘলকার।' : 'Vault for active product warranty codes and scanned invoice drafts.';
      case 'history':
        return isBn ? 'আপনার আগের সংরক্ষিত রিপোর্ট, গণনা এবং ডাউনলোডের ইতিহাস।' : 'Review all previously stored energy evaluation reports and runs.';
      case 'feedback':
        return isBn ? 'সোলার ও সাবসিডি সংক্রান্ত যেকোনো সমস্যায় বিশেষজ্ঞ পরামর্শ ফর্ম।' : 'Submit questions directly to qualified West Bengal solar consultants.';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-gray-900 font-sans selection:bg-amber-200 relative">
      <Header language={language} setLanguage={setLanguage} user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLoginClick={() => setShowLogin(true)} />
      
      <AnimatePresence>
        {showLogin && !user && (
          <LoginPage language={language} onClose={() => setShowLogin(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {user && isFormSubmitted === false && (
          <RegistrationGate 
            language={language} 
            user={user} 
            initialProfile={userProfile}
            onComplete={handleRegistrationComplete} 
          />
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-20 lg:py-24">
        {user && isFormSubmitted === null ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm animate-pulse">
              {language === 'bn' ? 'লোড হচ্ছে...' : 'Verifying Profile...'}
            </p>
          </div>
        ) : (
          <>
            {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-16 md:mb-24">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6 md:space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-amber-100 rounded-full text-amber-700 text-xs md:text-sm font-bold uppercase tracking-wider w-fit max-w-full">
              <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" /> <span className="truncate">{t.heroBadge}</span>
            </div>
            <h2 
              className="font-black text-gray-900 tracking-tight text-left"
              style={{ fontSize: 'clamp(2rem, 7vw, 4.2rem)', lineHeight: '1.05' }}
            >
              {t.heroTitle.split(t.heroTitleHighlight).map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="text-amber-500">{t.heroTitleHighlight}</span>}
                </React.Fragment>
              ))}
            </h2>
            <p className="text-base md:text-xl text-gray-600 leading-relaxed max-w-lg">
              {t.heroDesc}
            </p>
            <div className="flex flex-wrap gap-3 md:gap-4 pt-2 md:pt-4">
              <button 
                onClick={() => {
                  setActiveTab('calculator');
                  document.getElementById('tool-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3.5 md:px-8 md:py-4 bg-zinc-900 text-white rounded-[2rem] font-bold text-base md:text-lg hover:bg-zinc-800 transition shadow-xl shadow-zinc-200 flex items-center gap-2.5 md:gap-3 group"
              >
                {t.startNow} <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => {
                  setActiveTab('guide');
                  document.getElementById('tool-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3.5 md:px-8 md:py-4 bg-white border-2 border-gray-100 text-gray-900 rounded-[2rem] font-bold text-base md:text-lg hover:border-amber-400 transition"
              >
                {t.checkSubsidy}
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-[4/3] bg-amber-400 rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl relative">
              <img 
                src="https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2072&auto=format&fit=crop" 
                alt="Solar Panels"
                className="w-full h-full object-cover mix-blend-overlay opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 p-5 md:p-8 bg-white/10 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] border border-white/20 text-white">
                <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Sun className="fill-current w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-base sm:text-lg md:text-xl leading-none tracking-tight">{t.pmSuryaGhar}</p>
                    <p className="text-white/70 text-[9px] md:text-xs font-bold uppercase tracking-widest mt-1">{t.govScheme}</p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-relaxed">{t.heroSmallPrint}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Business Section */}
        <BusinessBenefits language={language} />

        {/* Dynamic Section */}
        <div className="pt-24 border-t border-gray-100 scroll-mt-28" id="tool-section">
          {activeTab !== null && (
            <div className="mb-6 flex items-center justify-start max-w-5xl mx-auto">
              <button
                onClick={() => {
                  setActiveTab(null);
                  setTimeout(() => {
                    document.getElementById('tool-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 60);
                }}
                className="group inline-flex items-center gap-2 px-6 py-3 bg-amber-50/80 hover:bg-amber-100 text-sm font-bold text-amber-800 hover:text-amber-900 rounded-2xl border-2 border-amber-200/60 hover:border-amber-300/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] transition-all duration-300 cursor-pointer -translate-y-0.5 active:translate-y-0"
              >
                <span className="text-lg leading-none transition-transform duration-300 group-hover:-translate-x-1">←</span>
                <span>{language === 'bn' ? 'ড্যাশবোর্ডে ফিরে যান' : 'Back to Dashboard'}</span>
              </button>
            </div>
          )}

          <div className="mt-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab || 'welcome'}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                {activeTab === null ? (
                  <>
                    <div id="dashboard-welcome-deck" className="bg-white/80 backdrop-blur-3xl border border-amber-200/30 rounded-[3rem] p-8 md:p-14 max-w-5xl mx-auto shadow-2xl text-center space-y-12 relative overflow-hidden">
                    {/* Embedded Aurora Keyframes Style */}
                    <style dangerouslySetInnerHTML={{ __html: `
                      @keyframes aurora-flow-1 {
                        0% { transform: translate(-10%, -10%) rotate(0deg) scale(1); }
                        50% { transform: translate(15%, 15%) rotate(180deg) scale(1.25); }
                        100% { transform: translate(-10%, -10%) rotate(360deg) scale(1); }
                      }
                      @keyframes aurora-flow-2 {
                        0% { transform: translate(15%, 10%) rotate(0deg) scale(1.2); }
                        50% { transform: translate(-15%, -15%) rotate(-180deg) scale(0.85); }
                        100% { transform: translate(15%, 10%) rotate(-360deg) scale(1.2); }
                      }
                      @keyframes aurora-flow-3 {
                        0% { transform: translate(-15%, 15%) rotate(0deg) scale(0.9); }
                        50% { transform: translate(20%, -10%) rotate(120deg) scale(1.15); }
                        100% { transform: translate(-15%, 15%) rotate(360deg) scale(0.9); }
                      }
                      @keyframes aurora-flow-4 {
                        0% { transform: translate(10%, -15%) rotate(0deg) scale(1.05); }
                        50% { transform: translate(-20%, 10%) rotate(-120deg) scale(1.3); }
                        100% { transform: translate(10%, -15%) rotate(-360deg) scale(1.05); }
                      }
                      @keyframes mesh-pulse {
                        0%, 100% { opacity: 0.75; filter: blur(75px); }
                        50% { opacity: 0.95; filter: blur(95px); }
                      }
                      .aurora-container-mesh {
                        position: absolute;
                        inset: 0;
                        overflow: hidden;
                        z-index: 0;
                        pointer-events: none;
                        opacity: 0.85;
                        mix-blend-mode: normal;
                        filter: blur(80px);
                        animation: mesh-pulse 10s infinite ease-in-out;
                      }
                      .aurora-orb {
                        position: absolute;
                        border-radius: 50%;
                        mix-blend-mode: normal;
                      }
                      .aurora-orb-1 {
                        width: 380px;
                        height: 380px;
                        background: radial-gradient(circle, rgba(234,88,12,0.8) 0%, rgba(249,115,22,0.35) 55%, rgba(251,191,36,0.05) 80%, transparent 100%);
                        top: -10%;
                        left: -5%;
                        animation: aurora-flow-1 20s infinite ease-in-out;
                      }
                      .aurora-orb-2 {
                        width: 420px;
                        height: 420px;
                        background: radial-gradient(circle, rgba(9,81,50,0.8) 0%, rgba(16,185,129,0.3) 60%, rgba(52,211,153,0.05) 80%, transparent 100%);
                        bottom: -15%;
                        right: -5%;
                        animation: aurora-flow-2 24s infinite ease-in-out;
                      }
                      .aurora-orb-3 {
                        width: 390px;
                        height: 390px;
                        background: radial-gradient(circle, rgba(13,148,136,0.8) 0%, rgba(6,182,212,0.3) 55%, rgba(34,211,238,0.05) 80%, transparent 100%);
                        top: -10%;
                        right: -10%;
                        animation: aurora-flow-3 28s infinite ease-in-out;
                      }
                      .aurora-orb-4 {
                        width: 350px;
                        height: 350px;
                        background: radial-gradient(circle, rgba(79,70,229,0.75) 0%, rgba(129,140,248,0.25) 60%, rgba(165,180,252,0.05) 80%, transparent 100%);
                        bottom: -10%;
                        left: -10%;
                        animation: aurora-flow-4 16s infinite ease-in-out;
                      }
                      @keyframes reflex-sweep {
                        0% { transform: translateX(-150%) skewX(-20deg); }
                        18% { transform: translateX(150%) skewX(-20deg); }
                        100% { transform: translateX(150%) skewX(-20deg); }
                      }
                      @keyframes border-glow {
                        0%, 100% { 
                          border-color: rgba(5, 150, 105, 0.2); 
                          box-shadow: 0 4px 30px -10px rgba(5, 150, 105, 0.05), 0 0 16px 2px rgba(5, 150, 105, 0.04); 
                        }
                        50% { 
                          border-color: rgba(5, 150, 105, 0.5); 
                          box-shadow: 0 4px 40px -10px rgba(5, 150, 105, 0.1), 0 0 32px 6px rgba(5, 150, 105, 0.2), inset 0 0 6px rgba(5, 150, 105, 0.03); 
                        }
                      }
                      .reflex-glow-banner {
                        position: relative;
                        overflow: hidden;
                        animation: border-glow 7s infinite ease-in-out;
                        transition: all 0.5s ease-in-out;
                      }
                      .reflex-glow-banner::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: -50%;
                        width: 150%;
                        height: 100%;
                        background: linear-gradient(
                          90deg,
                          transparent,
                          rgba(255, 255, 255, 0) 25%,
                          rgba(255, 255, 255, 0.95) 50%,
                          rgba(5, 150, 105, 0.12) 58%,
                          rgba(255, 255, 255, 0) 80%,
                          transparent 100%
                        );
                        transform: translateX(-100%) skewX(-25deg);
                        animation: reflex-sweep 7s infinite cubic-bezier(0.25, 1, 0.5, 1);
                        pointer-events: none;
                        z-index: 10;
                      }
                    `}} />

                    {/* Dynamic High-End Aurora Mesh Layer */}
                    <div className="aurora-container-mesh">
                      <div className="aurora-orb aurora-orb-1" />
                      <div className="aurora-orb aurora-orb-2" />
                      <div className="aurora-orb aurora-orb-3" />
                      <div className="aurora-orb aurora-orb-4" />
                    </div>

                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 z-10" />
                    
                    <div className="space-y-5 max-w-3xl mx-auto relative z-10">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50/90 border border-amber-200/80 rounded-full text-amber-800 text-[10px] font-black tracking-widest uppercase shadow-sm"
                      >
                        <Sun className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
                        {language === 'bn' ? 'সোলার গাইড ড্যাশবোর্ড' : 'SOLAR PORTAL WORKSPACE'}
                      </motion.div>
                      
                      <motion.h3 
                        initial={{ opacity: 0, y: -15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="text-3xl md:text-4.5xl font-black text-slate-900 tracking-tight leading-tight uppercase font-sans drop-shadow-sm"
                      >
                        {language === 'bn' ? (
                          <>সৌর মিত্র ড্যাশবোর্ডে স্বাগতম!</>
                        ) : (
                          <>Welcome to Saurya Mitra Solar Dashboard!</>
                        )}
                      </motion.h3>
                      
                      <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="text-gray-500 text-sm md:text-base font-semibold leading-relaxed max-w-2xl mx-auto"
                      >
                        {user ? (
                          language === 'bn' 
                            ? `নমস্কার, ${user.displayName || 'সদস্য'}! আপনার সোলার পোর্টাল সেশন অ্যাক্টিভ রয়েছে। সোলার ক্যালকুলেটর, রক্ষণাবেক্ষণ চেকলিস্ট বা আমাদের যেকোনো একটি টুল ব্যবহার করতে নিচে আপনার পছন্দ অনুযায়ী সার্ভিসটি নির্বাচন করুন।`
                            : `Hello, ${user.displayName || 'Member'}! Your solar portal session is active. Please select any of our premium tools below to calculate feasibility, check empanelled installers, or record daily maintenance.`
                        ) : (
                          language === 'bn'
                            ? "সৌর বিদ্যুৎ স্থাপন ও সৌর মিত্র সুবিধা লাভের অনলাইন সহায়িকা হাব। আমাদের সার্ভিস ও নির্দেশিকাগুলো অ্যাক্সেস করতে নিচে যেকোনো একটি মডিউল বা সার্ভিস সিলেক্ট করুন।"
                            : "West Bengal's dynamic hub for residential solar adoption. Select a tool or resource below to analyze energy bills, compute capacity sizing, or find certified installer empanelment registries."
                        )}
                      </motion.p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 text-left relative z-10" style={{ perspective: 1200 }}>
                      {tabs.map((tab, idx) => {
                        const Icon = tab.icon;
                        const btnDesc = getTabDesc(tab.id, language === 'bn');
                        return (
                          <motion.div
                            id={`welcome-card-${tab.id}`}
                            key={tab.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ 
                              type: "spring", 
                              stiffness: 140, 
                              damping: 18, 
                              delay: idx * 0.05 
                            }}
                            style={{ transformStyle: "preserve-3d" }}
                            whileHover={{ 
                              scale: 1.05,
                              rotateY: 8,
                              rotateX: -6,
                              z: 30,
                              y: -8,
                              boxShadow: "0 35px 50px -15px rgba(245, 158, 11, 0.22), 0 15px 22px -10px rgba(245, 158, 11, 0.12)",
                              borderColor: "#f59e0b"
                            }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              setActiveTab(tab.id as TabType);
                              document.getElementById('tool-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="bg-white/80 backdrop-blur-md border border-gray-150 hover:border-amber-300 text-left p-7 rounded-[2rem] transition-colors duration-300 cursor-pointer flex flex-col justify-between h-56 group relative overflow-hidden shadow-md"
                          >
                            {/* Glassmorphism glaze shine effect which responds to hover */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-300/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            
                            {/* Decorative ambient glowing backdot */}
                            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-100/10 rounded-full group-hover:bg-amber-200/20 blur-xl transition-all duration-500" />

                            <div className="space-y-4" style={{ transform: "translateZ(40px)" }}>
                              <div className="w-12 h-12 rounded-2xl bg-amber-50 group-hover:bg-gradient-to-br group-hover:from-amber-400 group-hover:to-amber-500 group-hover:text-amber-950 text-amber-600 border border-amber-100 flex items-center justify-center transition-all duration-300 shadow-inner transform group-hover:scale-110 group-hover:-translate-y-1">
                                <Icon className="w-5.5 h-5.5 transition-transform group-hover:rotate-12 duration-305" />
                              </div>
                              <div>
                                <h4 className="font-extrabold text-slate-800 text-[13.5px] tracking-tight group-hover:text-amber-700 transition-colors uppercase leading-none">
                                  {tab.label}
                                </h4>
                                <p className="text-[11.5px] text-gray-500 font-semibold leading-relaxed mt-2.5 line-clamp-3">
                                  {btnDesc}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 opacity-85 group-hover:opacity-100 group-hover:text-amber-700 uppercase tracking-widest pt-2 mt-auto" style={{ transform: "translateZ(20px)" }}>
                              {language === 'bn' ? 'মডিউল খুলুন' : 'Open Tool'} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1.5" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Connect with us banner */}
                  <div 
                    id="contact-banner" 
                    className="reflex-glow-banner mt-12 max-w-5xl mx-auto bg-gradient-to-r from-emerald-50/10 via-white/95 to-emerald-50/10 backdrop-blur-md border border-emerald-500/20 rounded-[2.5rem] p-6 text-center flex flex-col md:flex-row items-center justify-between px-8 md:px-12 gap-4 select-none group shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-emerald-600 transition-transform duration-300 group-hover:scale-105 relative">
                        <Mail className="w-5 h-5 animate-pulse" />
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                      </div>
                      <div className="text-left">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 leading-none mb-1">
                          {language === 'bn' ? 'সরাসরি সোলার ওয়ার্কস্পেস সাপোর্ট' : 'Direct Workspace Support'}
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
                        </h4>
                        <p className="text-[11px] text-slate-400 font-medium leading-normal">
                          {language === 'bn' ? '২৪/৭ সোলার বিশেষজ্ঞ সহায়তা ও প্রতিক্রিয়া পোর্টাল' : '24/7 dedicated solar assistance & feedback channel'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 bg-emerald-50/45 border border-emerald-500/10 px-5 py-2.5 rounded-full shadow-inner">
                      <span className="text-xs md:text-sm font-semibold text-slate-600">
                        {language === 'bn' ? 'যোগাযোগ করুন: ' : 'Connect with us: '}
                      </span>
                      <a 
                        href="mailto:sukanta83.nandi@gmail.com" 
                        className="text-[#059669] font-bold underline hover:opacity-85 transition-all text-xs md:text-sm tracking-wide hover:scale-[1.02] flex items-center gap-1.5 focus:outline-none"
                      >
                        sukanta83.nandi@gmail.com
                      </a>
                    </div>
                  </div>
                  </>
                ) : !user ? (
                  <div id="secure-auth-gate" className="bg-[#FFFDFB] border border-amber-200/60 rounded-[2.5rem] p-8 md:p-14 max-w-2xl mx-auto shadow-2xl text-center space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
                    
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-amber-400/25 rounded-full blur-xl animate-pulse" />
                        <div className="relative bg-amber-50 border border-amber-200/80 p-5 rounded-full text-amber-600 shadow-inner">
                          {activeTab === 'reader' && <FileScan className="w-10 h-10" />}
                          {activeTab === 'calculator' && <Calculator className="w-10 h-10" />}
                          {activeTab === 'guide' && <Landmark className="w-10 h-10" />}
                          {activeTab === 'vendors' && <Building2 className="w-10 h-10" />}
                          {activeTab === 'maintenance' && <Wrench className="w-10 h-10" />}
                          {activeTab === 'claim' && <ShieldCheck className="w-10 h-10" />}
                          {activeTab === 'locker' && <FolderLock className="w-10 h-10" />}
                          {activeTab === 'feedback' && <MessageSquare className="w-10 h-10" />}
                          {activeTab === 'history' && <History className="w-10 h-10" />}
                        </div>
                      </div>

                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                        {language === 'bn' ? (
                          <>সুরক্ষিত সৌর পোর্টাল আনলক করুন</>
                        ) : (
                          <>Unlock the Secure Solar Portal</>
                        )}
                      </h3>

                      <div className="space-y-2">
                        <p className="text-gray-950 font-extrabold text-base md:text-lg">
                          {language === 'bn' ? (
                            <>অনুরোধ করা উইন্ডো: <span className="text-amber-655">"{tabs.find(t => t.id === activeTab)?.label}"</span></>
                          ) : (
                            <>Requested Tool: <span className="text-amber-630">"{tabs.find(t => t.id === activeTab)?.label}"</span></>
                          )}
                        </p>
                        
                        <p className="text-gray-500 text-xs md:text-sm max-w-md mx-auto leading-relaxed font-semibold">
                          {activeTab === 'reader' && (
                            language === 'bn' 
                              ? "আপনার বিদ্যুৎ বিল আপলোড করে স্মার্ট রিডিং পেতে আজই লগইন বা সাইন-আপ করুন।" 
                              : "Log in or sign up to upload your electricity bill and extract smart energy consumption insights instantly."
                          )}
                          {activeTab === 'calculator' && (
                            language === 'bn' 
                              ? "আপনার বাসাবাড়ির জন্য কাস্টম সোলার সাশ্রয় এবং সাবসিডি ক্যালকুলেটর আনলক করতে অনুগ্রহ করে লগইন করুন।" 
                              : "Log in or register to unlock customized solar plant sizing, dynamic solar financial metrics, and subsidies."
                          )}
                          {activeTab === 'guide' && (
                            language === 'bn' 
                              ? "পিএম সূর্য ঘর যোজনার সম্পূর্ণ সরকারি গাইড ও নিয়মাবলী দেখতে মেম্বার লগইন করুন।" 
                              : "Log in to view high-resolution subsidy guides, governmental schemes, and direct action plans."
                          )}
                          {activeTab === 'vendors' && (
                            language === 'bn' 
                              ? "পশ্চিমবঙ্গের অনুমোদিত ও সরকারি তালিকায় থাকা সোলার ভেন্ডর তালিকা ব্রাউজ করতে লগইন করুন।" 
                              : "Log in to browse, filter, or consult direct licensed installers is under empanelled registry."
                          )}
                          {activeTab === 'maintenance' && (
                            language === 'bn' 
                              ? "দিনভিত্তিক ইন্টারেক্টিভ রক্ষণাবেক্ষণ চেকলিস্ট ট্র্যাকার ও রেকর্ড লগ ইতিহাস অ্যাক্সেস করতে লগইন করুন।" 
                              : "Log in to access dynamic date-wise maintenance checklists, submit completed logs, and manage timestamps."
                          )}
                          {activeTab === 'claim' && (
                            language === 'bn' 
                              ? "ধাপ-ভিত্তিক লিনিয়ার সাবসিডি ক্লেইম প্রসেস ও প্রয়োজনীয় ডকুমেন্টস নির্দেশিকা পেতে লগইন বা সাইন-আপ করুন।" 
                              : "Log in to manage step-by-step government claims with checkoff forms to verify status securely."
                          )}
                          {activeTab === 'locker' && (
                            language === 'bn' 
                              ? "আপনার সোলার প্ল্যান্টের ওয়ারেন্টি ডকুমেন্টস ও প্যানেল সিরিয়াল সুরক্ষিত ক্লাউড লকারে লক রাখতে লগইন করুন।" 
                              : "Log in to access your secure personal cloud locker designed to store and track active product warranties."
                          )}
                          {activeTab === 'feedback' && (
                            language === 'bn' 
                              ? "সৌর মিত্র বিশেষজ্ঞদের কাছে সরাসরি আপনার মূল্যবান প্রতিক্রিয়া বা কোনো জিজ্ঞাসা পাঠাতে লগইন করুন।" 
                              : "Log in to open direct customer support lines or submit certified logs and feedback."
                          )}
                          {activeTab === 'history' && (
                            language === 'bn' 
                              ? "আপনার আগের সাবসিডি হিসেব নিকেশের ইতিহাস এবং সংরক্ষিত রিপোর্টের রেকর্ড অ্যাক্সেস করতে লগইন করুন।" 
                              : "Log in to view your cached solar evaluation reports and historic logs details."
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-100 rounded-[2rem] p-6 space-y-4 max-w-md mx-auto">
                      <p className="text-[10px] text-amber-800 font-extrabold tracking-widest uppercase">
                        {language === 'bn' ? "🔒 সুরক্ষিত ক্লাউড ডাটাবেস ও নিরাপত্তা দ্বারা এনক্রিপ্ট কৃত" : "🔒 SECURED WITH DEEP CLOUD ENCRYPTION & DATA COMPLIANCE"}
                      </p>
                      <button
                        id="gate-login-btn"
                        onClick={() => setShowLogin(true)}
                        className="w-full px-6 py-4 bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-sm rounded-[1.5rem] shadow-xl shadow-amber-200/50 transition-all duration-150 cursor-pointer active:scale-95 text-center select-none"
                      >
                        {language === 'bn' ? "লগইন / রেজিস্ট্রেশন করুন" : "LOG IN / REGISTER"}
                      </button>
                      <p className="text-[10.5px] text-gray-400 font-bold">
                        {language === 'bn' ? "কোনো অ্যাকাউন্ট নেই? এখনই সেকেন্ডে আপনার প্রোফাইল তৈরি করতে উপরে ক্লিক করুন।" : "No account yet? Register a cloud profile in seconds by clicking above."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {activeTab === 'reader' && <BillReader onDataExtracted={handleBillExtracted} language={language} user={user} onLogin={() => setShowLogin(true)} />}
                    {activeTab === 'calculator' && <SavingsCalculator initialBillData={billData} language={language} user={user} userProfile={userProfile} onLogin={() => setShowLogin(true)} />}
                    {activeTab === 'guide' && <SubsidyGuide language={language} user={user} onLogin={() => setShowLogin(true)} />}
                    {activeTab === 'vendors' && <VendorLookup language={language} userProfile={userProfile} />}
                    {activeTab === 'maintenance' && <MaintenanceGuide language={language} user={user} userProfile={userProfile} />}
                    {activeTab === 'claim' && <ClaimProcess language={language} />}
                    {activeTab === 'locker' && <WarrantyLocker language={language} user={user} onLogin={() => setShowLogin(true)} />}
                    {activeTab === 'history' && <ReportHistory language={language} user={user} onLogin={() => setShowLogin(true)} />}
                    {activeTab === 'feedback' && <FeedbackForm language={language} user={user} onLogin={() => setShowLogin(true)} />}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </>
    )}
  </main>

      {/* Footer */}
      <footer className="py-16 text-slate-800 bg-[#FDFCF9]/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="reflex-glow-banner bg-gradient-to-br from-[#E1F2EE]/50 via-[#F3FAF8]/90 to-[#E4F5F1]/60 backdrop-blur-xl border border-white/80 rounded-[3rem] shadow-[0_24px_50px_rgba(16,185,129,0.08),_inset_0_2px_8px_rgba(255,255,255,0.9)] relative overflow-hidden group p-6 md:p-8">
            {/* 3D Liquid Floating Refraction Blobs */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-300/20 rounded-full blur-[40px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
            <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-teal-300/15 rounded-full blur-[45px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-amber-200/15 rounded-full blur-[35px] pointer-events-none" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              
              {/* Column 1: Saurya Mitra Branding & Description */}
              <div className="relative overflow-hidden bg-white/70 backdrop-blur-md border border-white/60 rounded-[2.2rem] p-8 flex flex-col justify-between gap-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),_inset_0_-2px_4px_rgba(0,0,0,0.01),_0_12px_28px_rgba(16,185,129,0.04)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1),_inset_0_2px_4px_rgba(255,255,255,1)] hover:bg-white/80 transition-all duration-500 hover:-translate-y-1 group/card">
                {/* Shiny highlight reflection effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25 pointer-events-none transition-transform duration-1000 -translate-x-full group-hover/card:translate-x-full" />
                
                <div>
                  <div className="flex items-center gap-3 text-slate-900 mb-4">
                    <span className="font-extrabold text-2xl tracking-tighter drop-shadow-sm bg-gradient-to-r from-emerald-950 to-slate-900 bg-clip-text text-transparent">Saurya Mitra</span>
                  </div>
                  <p className="text-sm text-slate-700 font-semibold leading-relaxed max-w-sm">{t.footerDesc}</p>
                </div>
              </div>

              {/* Column 2: Quick Links */}
              <div className="relative overflow-hidden bg-white/70 backdrop-blur-md border border-white/60 rounded-[2.2rem] p-8 flex flex-col gap-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),_inset_0_-2px_4px_rgba(0,0,0,0.01),_0_12px_28px_rgba(16,185,129,0.04)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1),_inset_0_2px_4px_rgba(255,255,255,1)] hover:bg-white/80 transition-all duration-500 hover:-translate-y-1 group/card">
                {/* Shiny highlight reflection effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25 pointer-events-none transition-transform duration-1000 -translate-x-full group-hover/card:translate-x-full" />
                
                <h4 className="text-slate-950 font-black text-[16px] uppercase tracking-wider bg-gradient-to-r from-slate-950 to-emerald-900 bg-clip-text text-transparent">{t.quickLinks}</h4>
                <ul className="space-y-4 text-sm font-semibold">
                  <li>
                    <a 
                      href="https://www.cesc.co.in/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-slate-700 hover:text-emerald-700 transition underline underline-offset-4 decoration-emerald-200 hover:decoration-emerald-500 hover:scale-[1.02] inline-block"
                    >
                      {t.cescService}
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://www.wbsedcl.in/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-slate-700 hover:text-emerald-700 transition underline underline-offset-4 decoration-emerald-200 hover:decoration-emerald-500 hover:scale-[1.02] inline-block"
                    >
                      {t.wbsedclGuide}
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://solarrooftop.pmsuryaghar.gov.in/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-slate-700 hover:text-emerald-700 transition underline underline-offset-4 decoration-emerald-200 hover:decoration-emerald-500 hover:scale-[1.02] inline-block"
                    >
                      {language === 'bn' ? 'পিএম সূর্য ঘর (PM Surya Ghar)' : 'PM Surya Ghar'}
                    </a>
                  </li>
                </ul>
              </div>

              {/* Column 3: Office Address & Contact Info */}
              <div className="relative overflow-hidden bg-white/70 backdrop-blur-md border border-white/60 rounded-[2.2rem] p-8 flex flex-col justify-between gap-6 shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),_inset_0_-2px_4px_rgba(0,0,0,0.01),_0_12px_28px_rgba(16,185,129,0.04)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1),_inset_0_2px_4px_rgba(255,255,255,1)] hover:bg-white/80 transition-all duration-500 hover:-translate-y-1 group/card">
                {/* Shiny highlight reflection effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25 pointer-events-none transition-transform duration-1000 -translate-x-full group-hover/card:translate-x-full" />
                
                <div>
                  <h4 className="text-slate-950 font-black text-[16px] uppercase tracking-wider mb-4 bg-gradient-to-r from-slate-950 to-emerald-900 bg-clip-text text-transparent">{t.office}</h4>
                  <p className="text-sm text-slate-700 font-semibold leading-relaxed">{t.officeAddr}</p>
                </div>
                <p className="text-xs font-bold text-emerald-700 bg-white/90 px-4 py-2.5 rounded-xl border border-white self-start shadow-[0_4px_12px_rgba(16,185,129,0.04),_inset_0_1px_2px_rgba(255,255,255,0.9)] backdrop-blur-sm">{t.phone}</p>
              </div>

            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 mt-12 pt-6 border-t border-emerald-500/10 text-center text-[12px] md:text-[12.5px] text-slate-400 font-semibold leading-relaxed">
          Disclaimer: Saurya Mitra is an independent AI platform simulating solar analytics based on regional tariffs. Actual installation criteria and central subsidies are subject to technical surveys and MNRE guidelines.
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-8 pt-6 border-t border-emerald-500/10 text-center text-[11px] font-bold text-slate-500 tracking-widest uppercase font-mono">
          © 2026 Saurya Mitra - A Solar Consultancy | {language === 'bn' ? (
            <>
              ডিজাইন এবং ডেভেলপ করেছেন <span className="text-slate-900 font-extrabold text-[12px] normal-case tracking-normal">সুকান্ত নন্দী</span>
            </>
          ) : (
            <>
              Designed & Developed by <span className="text-slate-900 font-extrabold text-[12px] normal-case tracking-normal">Sukanta Nandi</span>
            </>
          )}
        </div>
      </footer>

      <SauryaAssistant language={language} />
      <DigitalClock language={language} />
    </div>
  );
}
