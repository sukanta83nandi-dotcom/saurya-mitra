import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Language, translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Download, ChevronRight, FileText } from 'lucide-react';
import { User } from 'firebase/auth';
import { LoginRequired } from './LoginRequired';

interface Report {
  id: string;
  createdAt: Timestamp;
  systemSize: number;
  cost: number;
  savings: number;
  billUnits: number;
}

interface ReportHistoryProps {
  language: Language;
  user: User | null;
  onLogin?: () => void;
}

export function ReportHistory({ language, user, onLogin }: ReportHistoryProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const t = translations[language];

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `users/${user.uid}/reports`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Report[];
      setReports(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reports');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return <LoginRequired language={language} onLogin={onLogin} />;
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (reports.length === 0) return (
    <div className="text-center py-12 bg-white rounded-[2.5rem] border border-gray-100 italic text-gray-400">
      {t.noHistory}
    </div>
  );

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
        <Clock className="text-amber-500" /> {t.historyTitle}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {reports.map((report) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 bg-white rounded-3xl shadow-sm border border-gray-100 hover:border-amber-400 transition-colors group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-gray-50 text-gray-400 rounded-lg group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-gray-400 tracking-wider">
                  {report.createdAt.toDate().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-gray-400">সিস্টেম</span>
                  <span className="text-sm font-bold">{report.systemSize} kW</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-gray-400">সাশ্রয়</span>
                  <span className="text-sm font-bold text-emerald-600">₹{report.savings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-gray-400">ইউনিট</span>
                  <span className="text-sm font-bold">{report.billUnits}</span>
                </div>
              </div>

              <button className="w-full mt-6 py-3 bg-gray-50 text-gray-600 text-xs font-bold rounded-2xl group-hover:bg-amber-400 group-hover:text-black transition-colors flex items-center justify-center gap-2">
                {t.viewReport} <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
