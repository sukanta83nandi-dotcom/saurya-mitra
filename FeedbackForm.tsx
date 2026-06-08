import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle, Lock, Sun, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { analyzeBill } from '../services/gemini';
import { BillData } from '../types';
import { cn } from '../lib/utils';
import { Language, translations } from '../translations';
import { User } from 'firebase/auth';
import { LoginRequired } from './LoginRequired';

interface BillReaderProps {
  onDataExtracted: (data: BillData) => void;
  language: Language;
  user: User | null;
  onLogin?: () => void;
}

export function BillReader({ onDataExtracted, language, user, onLogin }: BillReaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const t = translations[language];

  const compressImage = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 1200;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve({ base64: (event.target?.result as string).split(',')[1], mimeType: file.type });
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
            const base64 = compressedDataUrl.split(',')[1];
            resolve({ base64, mimeType: 'image/jpeg' });
          } catch (e) {
            resolve({ base64: (event.target?.result as string).split(',')[1], mimeType: file.type });
          }
        };
        img.onerror = () => {
          resolve({ base64: (event.target?.result as string).split(',')[1], mimeType: file.type });
        };
      };
      reader.onerror = () => {
        resolve({ base64: '', mimeType: file.type });
      };
    });
  };

  const readAsBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ base64, mimeType: file.type });
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let imageData: { base64: string; mimeType: string };
      if (file.type.startsWith('image/')) {
        imageData = await compressImage(file);
      } else {
        imageData = await readAsBase64(file);
      }

      if (!imageData.base64) {
        throw new Error('Could not read file data');
      }

      const result = await analyzeBill(imageData.base64, imageData.mimeType);
      onDataExtracted(result);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Error processing bill');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <LoginRequired language={language} titleKey="loginToUpload" descKey="loginToUploadDesc" onLogin={onLogin} />;
  }

  return (
    <div className="space-y-6">
      <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50 backdrop-blur-sm transition-all hover:border-amber-400">
        <input
          type="file"
          id="bill-upload"
          className="hidden"
          accept="image/*,application/pdf"
          onChange={handleFileUpload}
          disabled={loading}
        />
        <label htmlFor="bill-upload" className="cursor-pointer flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
            {loading ? <Loader2 className="animate-spin" /> : <Upload />}
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{t.uploadBill}</h3>
            <p className="text-sm text-gray-500 mt-1">{t.uploadFormat}</p>
          </div>
        </label>
      </div>

      {loading && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100"
        >
          <Loader2 className="animate-spin w-5 h-5" />
          <p className="text-sm font-medium">{t.analyzingBill}</p>
        </motion.div>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100"
        >
          <CheckCircle2 className="w-5 h-5" />
          <p className="text-sm font-medium">{t.billSuccess}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.howItWorks}</span>
          </div>
          <h4 className="font-medium text-gray-900 mb-2">{t.scannerTitle}</h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t.scannerDesc}
          </p>
        </div>
        <div className="p-6 bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex justify-end mb-3">
              {/* Official SSL/Data Privacy Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700/90 border border-emerald-100 rounded-full text-[9px] font-black tracking-wider uppercase select-none shadow-[inset_0_1px_2px_rgba(16,185,129,0.05)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                SSL SECURE
              </div>
            </div>
            <h4 className="font-semibold text-gray-900 mb-2.5 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-600" />
              {t.privacyTitle}
            </h4>
            <div className="text-sm text-gray-600 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="text-emerald-500 text-sm mt-0.5 flex-shrink-0">🔒</span>
                <div>
                  {language === 'bn' ? (
                    "আপলোড করা সমস্ত বিল এনক্রিপ্ট করা API-এর মাধ্যমে নিরাপদে প্রসেস করা হয় এবং কখনই পাবলিক সার্ভারে সংরক্ষণ করা হয় না।"
                  ) : (
                    "All uploaded bills are processed securely via encrypted APIs and never stored on public servers."
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
