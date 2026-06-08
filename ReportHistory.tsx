import React, { useState } from 'react';
import { Sun, Menu, MessageSquare, Languages, LogOut, MapPin, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, translations } from '../translations';
import { User } from 'firebase/auth';
import { loginWithGoogle, logout } from '../lib/firebase';
import { cn } from '../lib/utils';

interface HeaderProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  user: User | null;
  activeTab: string | null;
  setActiveTab: (tab: any) => void;
  onLoginClick: () => void;
}

function Logo() {
  return (
    <div className="relative w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center group select-none flex-shrink-0 max-w-[120px]">
      <svg viewBox="0 0 120 120" className="w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 drop-shadow-md select-none group-hover:scale-105 transition-transform duration-500">
        <defs>
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          
          <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="solarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>

          <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>

          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#166534" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
        </defs>

        {/* Outer Orange Border Ring */}
        <circle cx="60" cy="60" r="56" fill="none" stroke="#ea580c" strokeWidth="2.5" />
        <circle cx="60" cy="60" r="53" fill="none" stroke="#ffffff" strokeWidth="1" />

        <g clipPath="url(#logoCircleClip)">
          <clipPath id="logoCircleClip">
            <circle cx="60" cy="60" r="52" />
          </clipPath>
          
          {/* Sunset sky background */}
          <rect x="0" y="0" width="120" height="120" fill="url(#skyGrad)" />
          
          {/* Radial Sunrays */}
          <g opacity="0.3">
            <line x1="60" y1="5" x2="60" y2="115" stroke="#fef08a" strokeWidth="1" />
            <line x1="5" y1="60" x2="115" y2="60" stroke="#fef08a" strokeWidth="1" />
            <line x1="21" y1="21" x2="99" y2="99" stroke="#fef08a" strokeWidth="1" />
            <line x1="21" y1="99" x2="99" y2="21" stroke="#fef08a" strokeWidth="1" />
          </g>
          
          {/* Glowing central Sun */}
          <circle cx="60" cy="40" r="30" fill="url(#sunGrad)" opacity="0.9" />
          <circle cx="60" cy="40" r="14" fill="#ffffff" />

          {/* Background hills */}
          <path d="M5,75 Q30,62 60,68 T115,75 L115,120 L5,120 Z" fill="#15803d" opacity="0.35" />
          <path d="M5,82 Q30,72 60,78 T115,82 L115,120 L5,120 Z" fill="#14532d" />

          {/* Blue Solar Panel on the left */}
          <g transform="translate(1, -2)">
            {/* Struts */}
            <line x1="22" y1="82" x2="22" y2="102" stroke="#475569" strokeWidth="2" />
            <line x1="54" y1="85" x2="54" y2="104" stroke="#475569" strokeWidth="2" />
            <line x1="16" y1="92" x2="60" y2="92" stroke="#334155" strokeWidth="1.5" />
            
            {/* Tilted Blue Panel Board */}
            <polygon points="12,54 62,64 54,92 6,80" fill="url(#solarGrad)" stroke="#0f172a" strokeWidth="1.5" />
            
            {/* Grid details (Vertical column separators) */}
            <line x1="24" y1="56" x2="18" y2="83" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
            <line x1="37" y1="59" x2="31" y2="86" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
            <line x1="50" y1="62" x2="44" y2="89" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
            
            {/* Grid details (Horizontal row separators) */}
            <line x1="11" y1="62" x2="60" y2="72" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
            <line x1="9" y1="71" x2="57" y2="81" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
          </g>

          {/* Vibrant Green Sprout with Leaves growing on the right */}
          <g transform="translate(12, -4)">
            {/* Stem */}
            <path d="M68,85 Q78,74 80,58" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
            
            {/* Left Small Leaf */}
            <path d="M80,58 Q66,51 60,59 Q72,64 80,58 Z" fill="url(#leafGrad)" stroke="#166534" strokeWidth="0.5" />
            <path d="M80,58 Q70,55 60,59" fill="none" stroke="#14532d" strokeWidth="0.75" />

            {/* Right Main Leaf */}
            <path d="M80,58 Q95,51 101,59 Q89,64 80,58 Z" fill="url(#leafGrad)" stroke="#166534" strokeWidth="0.5" />
            <path d="M80,58 Q90,55 101,59" fill="none" stroke="#14532d" strokeWidth="0.75" />
          </g>

          {/* Green Protecting Circular Bowl clasping the bottom */}
          <path d="M5,62 A52,52 0 0 0 115,62 A52,53 0 0 1 5,62 Z" fill="url(#ringGrad)" />

          {/* Golden Handshake over the green bowl */}
          <g opacity="0.95">
            {/* Green Left Sleeve */}
            <path d="M18,68 Q38,62 55,73 Q58,75 55,78 Q38,68 16,80 T18,68 Z" fill="#22c55e" stroke="#14532d" strokeWidth="0.75" />
            {/* Green Right Sleeve */}
            <path d="M102,68 Q82,62 65,73 Q62,75 65,78 Q82,68 104,80 T102,68 Z" fill="#16a34a" stroke="#14532d" strokeWidth="0.75" />
            
            {/* Interlacing fingers details */}
            <path d="M46,72 C48,70 52,70 54,72 L58,76 M42,75 C44,73 48,73 50,75 L54,79 M38,78 C40,76 44,76 46,78 L49,81" fill="none" stroke="#ffffff" strokeWidth="1.25" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function Header({ language, setLanguage, user, activeTab, setActiveTab, onLoginClick }: HeaderProps) {
  const t = translations[language];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (tabId: string | null) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    if (tabId === null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setTimeout(() => {
        document.getElementById('tool-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 md:h-24 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 xs:gap-3 sm:gap-4 group cursor-pointer select-none max-w-[70%] md:max-w-none" 
          onClick={() => handleNavClick(null)}
        >
          <Logo />
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-lg xs:text-xl md:text-2xl font-black tracking-tight leading-none flex items-center justify-center select-none w-full">
              <span className="text-[#095132] font-black">Saurya</span>
              <span className="text-[#ea580c] ml-1.5 font-black">Mitra</span>
            </h1>
            <div className="flex items-center justify-center gap-1 mt-0.5 select-none w-full">
              <div className="h-[1px] md:h-[2px] w-1.5 xs:w-2 bg-[#ea580c] opacity-60 flex-shrink-0" />
              <p className="text-[7.5px] xs:text-[8.5px] md:text-[10px] font-extrabold text-[#095132] tracking-wider uppercase truncate text-center">
                Together for a Solar Future
              </p>
              <div className="h-[1px] md:h-[2px] w-1.5 xs:w-2 bg-[#ea580c] opacity-60 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-10">
          {[
            { id: null, label: t.home },
            { id: 'calculator', label: t.calculator },
            { id: 'guide', label: t.subsidy }
          ].map((item) => (
            <button
              key={item.id || 'home-nav'}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "relative py-8 text-sm font-bold transition-all duration-300",
                activeTab === item.id 
                  ? "text-amber-600 font-extrabold" 
                  : "text-gray-500 hover:text-gray-900"
              )}
            >
              {item.label}
              {activeTab === item.id && (
                <motion.div 
                  layoutId="header-active-tab"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-t-full"
                />
              )}
            </button>
          ))}
        </nav>

        {/* Desktop and Tablet Action Elements */}
        <div className="hidden md:flex items-center gap-4 lg:gap-6">
          <div className="flex items-center bg-gray-50 p-1 rounded-2xl border border-gray-100">
            <button 
              onClick={() => setLanguage('bn')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all",
                language === 'bn' ? "bg-white text-zinc-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              BN
            </button>
            <div className="w-px h-3 bg-gray-200 mx-1" />
            <button 
              onClick={() => setLanguage('en')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all",
                language === 'en' ? "bg-white text-zinc-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              EN
            </button>
          </div>
          
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="relative">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      className="w-9 h-9 lg:w-10 lg:h-10 rounded-full border-2 border-amber-400 p-0.5 shadow-md object-cover" 
                    />
                  ) : (
                    <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full border-2 border-amber-400 flex items-center justify-center bg-amber-50 text-amber-600 font-bold shadow-md">
                      {user.displayName?.charAt(0).toUpperCase() || <Sun className="w-5 h-5" />}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                </div>
                <span className="text-sm font-black text-slate-950 truncate max-w-[140px] lg:max-w-[180px] drop-shadow-sm">{user.displayName}</span>
              </div>
              
              <div className="w-px h-8 bg-gray-100" />
              
              <button 
                onClick={() => logout()}
                className="flex items-center gap-2 group px-2 lg:px-3 py-2 rounded-xl hover:bg-gray-50 transition-all-colors inline-block"
              >
                <LogOut className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors" />
                <span className="text-sm font-bold text-gray-900 group-hover:text-amber-500 transition-colors">{t.logout}</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={onLoginClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-[2rem] text-xs lg:text-sm font-bold hover:bg-zinc-800 transition shadow-xl shadow-zinc-200 group"
            >
              <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" /> {t.login}
            </button>
          )}
        </div>

        {/* Mobile menu toggle & quick items */}
        <div className="flex md:hidden items-center gap-2 xs:gap-3">
          {/* Language Toggle Quick Trigger for easy access */}
          <div className="flex items-center bg-gray-50 p-0.5 rounded-xl border border-gray-150 text-[9px] font-black">
            <button 
              onClick={() => setLanguage('bn')}
              className={cn(
                "px-2 py-1 rounded-lg transition-all",
                language === 'bn' ? "bg-white text-zinc-900 shadow-sm" : "text-gray-400"
              )}
            >
              BN
            </button>
            <button 
              onClick={() => setLanguage('en')}
              className={cn(
                "px-2 py-1 rounded-lg transition-all",
                language === 'en' ? "bg-white text-zinc-900 shadow-sm" : "text-gray-400"
              )}
            >
              EN
            </button>
          </div>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-amber-550 active:scale-95 flex items-center justify-center"
            aria-label="Toggle Mobile Navigation Drawer"
          >
            {mobileMenuOpen ? <X className="w-5.5 h-5.5" /> : <Menu className="w-5.5 h-5.5" />}
          </button>
        </div>
      </div>

      {/* Fully Functional Smooth Dropdown Navigation Drawer for Mobile viewports */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="md:hidden w-full bg-white border-b border-gray-100 shadow-2xl absolute left-0 right-0 top-20 z-40 overflow-hidden"
          >
            <div className="px-5 py-6 space-y-5 flex flex-col">
              <div className="flex flex-col gap-2.5">
                {[
                  { id: null, label: t.home },
                  { id: 'calculator', label: t.calculator },
                  { id: 'guide', label: t.subsidy }
                ].map((item) => (
                  <button
                    key={item.id || 'mobile-home'}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "w-full text-left py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-between",
                      activeTab === item.id
                        ? "bg-amber-50 text-amber-700 font-extrabold border-l-4 border-amber-500 plagiarism-free"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-gray-300">→</span>
                  </button>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-5">
                {user ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt={user.displayName || 'User'} 
                          className="w-10 h-10 rounded-full border-2 border-amber-400 p-0.5 object-cover" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-amber-400 flex items-center justify-center bg-amber-50 text-amber-600 font-bold">
                          {user.displayName?.charAt(0).toUpperCase() || <Sun className="w-5 h-5" />}
                        </div>
                      )}
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-black text-slate-950 truncate leading-tight">{user.displayName}</span>
                        <span className="text-[10px] text-gray-400 font-semibold truncate mt-0.5">{user.email}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-extrabold rounded-2xl border border-red-100 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t.logout}</span>
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLoginClick();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-zinc-950 text-white text-sm font-extrabold rounded-2xl shadow-xl shadow-zinc-200 transition"
                  >
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>{t.login}</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
