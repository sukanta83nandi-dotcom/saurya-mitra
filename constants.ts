import React from 'react';
import { Lock, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { translations, Language } from '../translations';
import { loginWithGoogle } from '../lib/firebase';

interface LoginRequiredProps {
  language: Language;
  titleKey?: keyof typeof translations['en'];
  descKey?: keyof typeof translations['en'];
  onLogin?: () => void;
}

export function LoginRequired({ 
  language, 
  titleKey = 'loginToContinue', 
  descKey = 'loginToContinueDesc',
  onLogin
}: LoginRequiredProps) {
  const t = translations[language];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 text-center space-y-6 shadow-sm">
        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
          <Lock className="w-10 h-10" />
        </div>
        <div className="max-w-md">
          <h3 className="text-2xl font-black text-gray-900 mb-3">
            {String(t[titleKey])}
          </h3>
          <p className="text-gray-500 leading-relaxed font-medium">
            {String(t[descKey])}
          </p>
        </div>
        <button 
          onClick={onLogin || loginWithGoogle}
          className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 group"
        >
          <Sun className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform" />
          {onLogin ? t.login : t.loginWithGoogle}
        </button>
      </div>
    </motion.div>
  );
}
