import React, { useState } from 'react';
import { motion } from 'motion/react';
import { translations, Language } from '../translations';
import { MessageSquare, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { LoginRequired } from './LoginRequired';

interface FeedbackFormProps {
  language: Language;
  user: User | null;
  onLogin?: () => void;
}

export function FeedbackForm({ language, user, onLogin }: FeedbackFormProps) {
  const t = translations[language] as any;
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!user) {
    return <LoginRequired language={language} onLogin={onLogin} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    try {
      // 1. Save to Firestore (as backup)
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        feedback: feedback.trim(),
        createdAt: serverTimestamp(),
        language
      });

      // 2. Save to Google Docs via our server API
      // We wrap this in a separate try/catch so to ensure the user gets a success message 
      // even if the sync fails (as long as it's saved in Firestore)
      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedback: feedback.trim(),
            userId: user.uid,
            userEmail: user.email,
            userName: user.displayName || 'User',
            language
          })
        });
        
        if (!response.ok) {
          const result = await response.json();
          console.warn('Sync warning:', result.message || result.error);
        }
      } catch (syncError) {
        console.error('External sync failed:', syncError);
      }

      setIsSuccess(true);
      setFeedback('');
    } catch (error: any) {
      console.error('Feedback Error:', error);
      alert(error.message || 'An error occurred while sending feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[3rem] p-12 text-center space-y-6 shadow-2xl shadow-green-100/50 border border-green-100"
        >
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">
              {language === 'bn' ? 'ধন্যবাদ!' : 'Thank You!'}
            </h2>
            <p className="text-xl font-bold text-gray-600 max-w-md mx-auto">
              {t.feedbackSuccess}
            </p>
          </div>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSuccess(false)}
            className="px-10 py-4 bg-zinc-900 text-white rounded-[1.5rem] font-black text-lg hover:bg-zinc-800 transition shadow-xl"
          >
            {language === 'bn' ? 'আরেকটি মতামত দিন' : 'Send Another Feedback'}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
        {/* Info Column */}
        <div className="md:col-span-2 space-y-6">
          <div className="p-8 bg-amber-400 rounded-[2.5rem] shadow-xl shadow-amber-200 border-b-4 border-amber-600">
            <MessageSquare className="w-10 h-10 text-zinc-900 mb-6" />
            <h2 className="text-3xl font-black text-zinc-900 leading-tight mb-4 lowercase">
              {t.feedbackTitle}
            </h2>
            <p className="text-zinc-800 font-bold leading-relaxed">
              {t.feedbackDesc}
            </p>
          </div>
          
          <div className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 text-gray-400">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-black text-lg border border-amber-100">
                {user.displayName?.[0] || user.email?.[0] || '?'}
              </div>
              <div className="text-sm font-bold">
                <p className="text-gray-900">{user.displayName || 'Solar Enthusiast'}</p>
                <p className="text-gray-500 truncate max-w-[150px]">{user.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Column */}
        <div className="md:col-span-3">
          <motion.form 
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl shadow-gray-100 border border-gray-100 space-y-8"
          >
            <div className="space-y-4">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">
                {language === 'bn' ? 'আপনার বার্তা' : 'Your Message'}
              </label>
              <textarea 
                required
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={t.writeYourFeedback}
                className="w-full min-h-[250px] p-8 bg-gray-50 border-2 border-transparent focus:border-amber-400 rounded-[2rem] outline-none transition-all font-bold text-lg resize-none placeholder:text-gray-400"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98, y: 0 }}
              disabled={isSubmitting || !feedback.trim()}
              className="w-full py-5 bg-zinc-900 text-white rounded-[2rem] font-black text-xl hover:bg-zinc-800 transition shadow-2xl shadow-zinc-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {t.submitFeedback}
                  <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </motion.button>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
