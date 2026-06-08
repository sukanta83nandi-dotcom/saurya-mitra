import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Calendar, Volume2, Sparkles, Minimize2, Maximize2 } from 'lucide-react';
import { Language } from '../translations';

interface DigitalClockProps {
  language: Language;
}

type ClockModel = 'solar' | 'cosmic' | 'nixie' | 'organic';

export function DigitalClock({ language }: DigitalClockProps) {
  const [time, setTime] = useState(new Date());
  const [model, setModel] = useState<ClockModel>('solar');
  const [use24h, setUse24h] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Parallax 3D tilt angles
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Speech Synth: vocalize current date and time
  const speakDateTime = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn("Speech Synthesis not supported in this browser");
      return;
    }
    
    // Play a touch feedback frequency
    playClickFeedback(750);
    
    // Reset/clear any ongoing stuck voices
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (err) {
      console.warn("Error managing speech synthesis cancel/resume:", err);
    }
    
    const now = new Date();
    const voices = window.speechSynthesis.getVoices();
    
    let speechText = '';
    let voiceLocale = 'en-US';
    let chosenVoice: SpeechSynthesisVoice | undefined = undefined;
    
    if (language === 'bn') {
      voiceLocale = 'bn-IN';
      const monthsBn = [
        'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
        'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
      ];
      
      const dayBn = formatNumber(now.getDate());
      const monthBn = monthsBn[now.getMonth()];
      const yearBn = formatNumber(now.getFullYear());
      
      let hours = now.getHours();
      const periodBn = hours >= 12 ? 'বিকেল' : 'সকাল';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      const hoursBn = formatNumber(hours);
      const minutesBn = formatNumber(now.getMinutes());
      
      speechText = `আজকের তারিখ ${dayBn}শে ${monthBn}, ${yearBn}। এবং বর্তমান সময় ${periodBn} ${hoursBn}টা বেজে ${minutesBn} মিনিট।`;
      
      chosenVoice = voices.find(v => 
        v.lang.toLowerCase().startsWith('bn') || 
        v.name.toLowerCase().includes('bengali') || 
        v.name.toLowerCase().includes('bangla')
      );
    } else {
      voiceLocale = 'en-US';
      const monthsEn = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const dayEn = now.getDate();
      const monthEn = monthsEn[now.getMonth()];
      const yearEn = now.getFullYear();
      
      let hours = now.getHours();
      const ampmStr = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      const minutes = now.getMinutes();
      
      speechText = `Today is ${monthEn} ${dayEn}, ${yearEn}. The current time is ${hours} ${minutes === 0 ? "o'clock" : minutes} ${ampmStr}.`;
      
      chosenVoice = voices.find(v => v.lang.toLowerCase().startsWith('en')) || voices[0];
    }
    
    // Defer playing by 120ms to allow Chrome Speech engine to complete cancellation and transition its lock
    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.lang = voiceLocale;
        utterance.rate = 0.95; // More natural playback rate
        
        // Retain reference on window object to prevent early garbage collection in Chrome
        (window as any)._currentUtterance = utterance;
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          (window as any)._currentUtterance = null;
        };
        utterance.onerror = (evt) => {
          console.error("Speech Synthesis Utterance Playback Error:", evt);
          setIsSpeaking(false);
          (window as any)._currentUtterance = null;
        };
        
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }
        
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error("Speech Synthesis Speak Threw Error:", err);
        setIsSpeaking(false);
      }
    }, 120);
  };

  // Soft click synth tone
  const playClickFeedback = (freq = 700) => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Ignored
    }
  };

  // System tick
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync vocal speech list
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Format helper supporting Bengali characters
  const formatNumber = (num: number, pad = 2): string => {
    const str = String(num).padStart(pad, '0');
    if (language === 'en') return str;
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return str.split('').map(char => {
      const parsed = parseInt(char, 10);
      return isNaN(parsed) ? char : bnDigits[parsed];
    }).join('');
  };

  // Time & date components
  const { hh, mm, ss, dateStr, ampm } = useMemo(() => {
    let hours = time.getHours();
    const ampmStr = hours >= 12 ? 'PM' : 'AM';
    
    if (!use24h) {
      hours = hours % 12;
      hours = hours ? hours : 12;
    }

    const day = time.getDate();
    const month = time.getMonth() + 1;
    const year = time.getFullYear();

    const formDay = formatNumber(day);
    const formMonth = formatNumber(month);
    const formYear = formatNumber(year, 4);
    
    return {
      hh: formatNumber(hours),
      mm: formatNumber(time.getMinutes()),
      ss: formatNumber(time.getSeconds()),
      dateStr: `${formDay}/${formMonth}/${formYear}`,
      ampm: ampmStr
    };
  }, [time, use24h, language]);

  // Parallax controls
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cX = rect.width / 2;
    const cY = rect.height / 2;
    setRotateY(((x - cX) / cX) * 14); // Elegant 14-deg rotation limit
    setRotateX(-((y - cY) / cY) * 14);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  // Soft high-grade pastel presets
  const modelPreset = {
    solar: {
      bg: "bg-[#FCFAF2]/95 text-[#7C2D12] border-[#EFE9DC] shadow-[0_20px_45px_rgba(139,92,26,0.06),inset_0_2px_5px_rgba(255,255,255,0.95)]",
      markedArea: "bg-[#F5EFE1]/35 border border-[#EBE3D3]/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]",
      panel: "bg-white border border-[#F3E7CE] shadow-[0_3px_8px_rgba(139,92,26,0.03)] rounded-2xl",
      text: "text-[#7C2D12] font-mono font-black drop-shadow-[0_1.5px_2.5px_rgba(124,45,18,0.09)] tracking-tight",
      textDark: "text-[#7C2D12] font-black",
      textAccent: "text-amber-600",
      glowColor: "rgba(245, 158, 11, 0.05)",
      flareColor: "from-amber-100/40 to-transparent",
      pillActive: "bg-[#F5A623] hover:bg-[#F5A623]/90 text-slate-950 font-black border border-[#E0901B] shadow-[0_3px_12px_rgba(245,166,35,0.25)]",
      name: language === 'bn' ? 'সৌরশক্তি মডেল' : 'SOLAR ECO RAY',
      subtitle: language === 'bn' ? 'উজ্বল স্বর্ণালী গ্লাস' : 'Gold Solar Cells',
      accentColor: "bg-amber-500",
      particleColor: "rgba(245,158,11,0.08)"
    },
    cosmic: {
      bg: "bg-[#F3FAFDF7]/95 text-cyan-900 border-[#DFECEF] shadow-[0_20px_45px_rgba(6,182,212,0.04),inset_0_2px_5px_rgba(255,255,255,0.95)]",
      markedArea: "bg-[#E4F2F7]/35 border border-[#DAECEF]/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]",
      panel: "bg-white border border-[#CDE5ED] shadow-[0_3px_8px_rgba(6,182,212,0.03)] rounded-2xl",
      text: "text-cyan-950 font-mono font-black drop-shadow-[0_1.5px_2.5px_rgba(8,145,178,0.09)] tracking-tight",
      textDark: "text-cyan-900 font-black",
      textAccent: "text-[#1e3a8a]",
      glowColor: "rgba(6, 182, 212, 0.05)",
      flareColor: "from-cyan-100/40 to-transparent",
      pillActive: "bg-cyan-500 hover:bg-cyan-500/90 text-white font-black border border-cyan-600 shadow-[0_3px_12px_rgba(6,182,212,0.25)]",
      name: language === 'bn' ? 'মহাকাশ গ্রিড' : 'COSMIC GRID',
      subtitle: language === 'bn' ? 'নীলকান্ত গ্লাস' : 'Frosted Ocean Glass',
      accentColor: "bg-cyan-500",
      particleColor: "rgba(6,182,212,0.08)"
    },
    nixie: {
      bg: "bg-[#FFF9F6]/95 text-orange-950 border-[#F5DCCE] shadow-[0_20px_45px_rgba(234,88,12,0.04),inset_0_2px_5px_rgba(255,255,255,0.95)]",
      markedArea: "bg-[#FBECE2]/35 border border-[#F2CBB5]/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]",
      panel: "bg-white border border-[#F2CBB5] shadow-[0_3px_8px_rgba(234,88,12,0.03)] rounded-2xl",
      text: "text-orange-950 font-serif italic font-black drop-shadow-[0_1.5px_2.5px_rgba(234,88,12,0.09)] tracking-wide",
      textDark: "text-[#7c2d12] font-black",
      textAccent: "text-orange-650",
      glowColor: "rgba(234, 88, 12, 0.05)",
      flareColor: "from-orange-100/40 to-transparent",
      pillActive: "bg-orange-500 hover:bg-orange-500/90 text-white font-black border border-orange-600 shadow-[0_3px_12px_rgba(234,88,12,0.25)]",
      name: language === 'bn' ? 'নিক্সি টিউব' : 'VINTAGE GLASS',
      subtitle: language === 'bn' ? 'উষ্ণ ফিলামেন্ট' : 'Warm Orange Glow',
      accentColor: "bg-orange-500",
      particleColor: "rgba(234,88,12,0.08)"
    },
    organic: {
      bg: "bg-[#F5FBF7]/95 text-emerald-950 border-[#D2ECD6] shadow-[0_20px_45px_rgba(16,185,129,0.04),inset_0_2px_5px_rgba(255,255,255,0.95)]",
      markedArea: "bg-[#E4ECE7]/35 border border-[#C0E7C5]/45 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]",
      panel: "bg-white border border-[#C0E7C5] shadow-[0_3px_8px_rgba(16,185,129,0.03)] rounded-2xl",
      text: "text-emerald-950 font-mono font-black drop-shadow-[0_1.5px_2.5px_rgba(16,185,129,0.09)] tracking-tight",
      textDark: "text-emerald-900 font-extrabold",
      textAccent: "text-emerald-650",
      glowColor: "rgba(16, 185, 129, 0.05)",
      flareColor: "from-emerald-100/40 to-transparent",
      pillActive: "bg-[#10B981] hover:bg-[#10B981]/90 text-white font-black border border-[#059669] shadow-[0_3px_12px_rgba(16,185,129,0.25)]",
      name: language === 'bn' ? 'সবুজ পাতা মডেল' : 'ORGANIC JADE',
      subtitle: language === 'bn' ? 'প্রকৃতি বান্ধব' : 'Moss Jade Unit',
      accentColor: "bg-emerald-500",
      particleColor: "rgba(16,185,129,0.08)"
    }
  }[model];

  return (
    <div className="lg:absolute lg:top-[112px] lg:right-12 xl:right-16 z-40 hidden lg:block select-none pointer-events-none">
      <AnimatePresence>
        {!isMinimized ? (
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.85, y: -20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              rotateX,
              rotateY,
              transformPerspective: 1000
            }}
            exit={{ opacity: 0, scale: 0.85, y: -20 }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`pointer-events-auto w-[360px] p-5 rounded-[2.5rem] border backdrop-blur-3xl transition-all duration-300 relative shadow-2xl overflow-hidden ${modelPreset.bg}`}
          >
            {/* Real 3D Glass Gloss Split from top (from user's screenshot) */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-transparent h-[48%] rounded-t-[2.5rem] pointer-events-none z-10 border-b border-white/5" />
            
            {/* Fine laser-bright edge glow highlights at the top rim (from user's screenshot) */}
            <div className="absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent blur-[0.3px] pointer-events-none z-10" />
            <div className="absolute top-[0.5px] left-8 w-[30%] h-[1.5px] bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none z-10" />
            
            {/* Dynamic ambient background glow that tints matching the active dial mode */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--glow-color),transparent_70%)] opacity-35 pointer-events-none -z-10" style={{ '--glow-color': modelPreset.glowColor } as React.CSSProperties} />

            {/* Soft decorative background circles */}
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none -z-10">
              <div className="absolute top-[-40%] left-[-40%] w-[120px] h-[120px] rounded-full bg-white/10 blur-xl" />
              <div className="absolute bottom-[-40%] right-[-40%] w-[120px] h-[120px] rounded-full bg-white/10 blur-xl" />
              
              {/* Slowly rising visual particle dots matching active model theme */}
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    background: modelPreset.particleColor,
                    width: Math.random() * 4 + 3,
                    height: Math.random() * 4 + 3,
                    left: `${Math.random() * 85 + 7}%`,
                    bottom: -15,
                  }}
                  animate={{
                    y: [-10, -220],
                    x: [0, (i % 2 === 0 ? 12 : -12) * Math.sin(i)],
                    opacity: [0, 0.6, 0]
                  }}
                  transition={{
                    duration: Math.random() * 3 + 4,
                    delay: i * 0.8,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>

            {/* Title & Controls Header */}
            <div className="flex justify-between items-center mb-3 relative z-20">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${modelPreset.accentColor} animate-ping`} />
                <div className="text-left">
                  <h4 className={`text-[12px] font-black tracking-wider uppercase leading-none ${modelPreset.textDark}`}>
                    {modelPreset.name}
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500 block mt-1">
                    {modelPreset.subtitle}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 pointer-events-auto">
                {/* 12h/24h Selector tab (styled as glass) */}
                <button
                  onClick={() => { setUse24h(!use24h); playClickFeedback(1000); }}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-250/80 text-slate-800 text-[10px] font-black border border-slate-200/50 shadow-xs transition duration-150 cursor-pointer"
                  title={language === 'bn' ? 'সময় ফরম্যাট পরিবর্তন' : 'Toggle 12h/24h'}
                >
                  {use24h ? '24H' : '12H'}
                </button>

                {/* Vocal TTS speaker button */}
                <button
                  onClick={speakDateTime}
                  className={`p-2 rounded-xl border transition flex items-center justify-center relative cursor-pointer ${
                    isSpeaking 
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 scale-105 font-black'
                      : 'bg-slate-100 hover:bg-slate-250/80 text-slate-700 border-slate-200/50 shadow-xs'
                  }`}
                  title={language === 'bn' ? 'সময় ও তারিখ শুনুন' : 'Click to hear Voice Announcement'}
                >
                  <Volume2 size={13} className={isSpeaking ? "animate-bounce" : ""} />
                  {isSpeaking && (
                    <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-slate-950 rounded animate-pulse" />
                  )}
                </button>

                {/* Hide Button */}
                <button
                  onClick={() => { setIsMinimized(true); playClickFeedback(500); }}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-250/80 text-slate-700 border border-slate-200/50 shadow-xs transition cursor-pointer"
                  title={language === 'bn' ? 'ছোট করুন' : 'Minimize Widget'}
                >
                  <Minimize2 size={13} />
                </button>
              </div>
            </div>

            {/* Gorgeous Eye-Soothing Giant Date Display (styled as translucent container) */}
            <div className={`mb-3 px-4 py-2.5 ${modelPreset.markedArea} rounded-2xl flex items-center gap-3 relative z-20`}>
              <Calendar size={18} className={`${modelPreset.textAccent} animate-pulse`} />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-black text-slate-500 tracking-wider leading-none uppercase">
                  {language === 'bn' ? 'আজকের তারিখ' : 'Calendar Date (DD/MM/YYYY)'}
                </span>
                <span className={`text-[15px] font-black tracking-wide ${modelPreset.textDark} leading-tight mt-1.5`}>
                  {dateStr}
                </span>
              </div>
            </div>

            {/* Main Segment Glass Window */}
            <div className={`py-4 px-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${modelPreset.markedArea} z-20`}>
              <div className="flex items-center justify-between w-full h-14 pointer-events-none select-none relative z-10">
                {/* Hours Frame */}
                <div className={`flex justify-center items-center w-[78px] h-full rounded-xl shadow-sm ${modelPreset.panel}`}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                       key={hh}
                      initial={{ y: -18, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 18, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 220, damping: 20 }}
                      className={`text-2xl md:text-3xl font-black ${modelPreset.text}`}
                    >
                      {hh}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Divider */}
                <span className={`text-xl font-bold ${modelPreset.text} animate-[pulse_1s_infinite] opacity-75`}>
                  :
                </span>

                {/* Minutes Frame */}
                <div className={`flex justify-center items-center w-[78px] h-full rounded-xl shadow-sm ${modelPreset.panel}`}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={mm}
                      initial={{ y: -18, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 18, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 220, damping: 20 }}
                      className={`text-2xl md:text-3xl font-black ${modelPreset.text}`}
                    >
                      {mm}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Divider */}
                <span className={`text-xl font-bold ${modelPreset.text} animate-[pulse_1s_infinite] opacity-75`}>
                  :
                </span>

                {/* Seconds Frame */}
                <div className={`flex justify-center items-center w-[65px] h-full rounded-xl shadow-sm ${modelPreset.panel}`}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={ss}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.2, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`text-xl md:text-2xl font-black ${modelPreset.text}`}
                    >
                      {ss}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>

              {/* AM/PM or Nixie feedback sync panel */}
              {!use24h && (
                <div className="w-full mt-2 pt-1.5 border-t border-slate-200/50 flex justify-end z-10 px-1">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase text-center ${modelPreset.textDark} bg-white border border-slate-205 shadow-xs`}>
                    {ampm}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Swapper row */}
            <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2 relative z-20">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                {language === 'bn' ? 'মডেল সংস্করণ:' : 'CLOCK MODELS:'}
              </span>
              <div className="flex gap-1.5 pointer-events-auto">
                {(['solar', 'cosmic', 'nixie', 'organic'] as ClockModel[]).map((styleId) => (
                  <button
                    key={styleId}
                    onClick={() => { setModel(styleId); playClickFeedback(850); }}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition duration-150 cursor-pointer ${
                      model === styleId
                        ? stylePresetActive(styleId)
                        : 'bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200/60 shadow-xs'
                    }`}
                  >
                    {styleId}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -10 }}
            className={`pointer-events-auto w-[260px] p-4.5 rounded-[1.8rem] border backdrop-blur-3xl transition-all duration-300 shadow-xl relative overflow-hidden ${modelPreset.bg}`}
          >
            {/* Gloss Reflection split for minimized (matches screenshot) */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent h-[45%] rounded-t-[1.8rem] pointer-events-none z-10 border-b border-white/5" />
            <div className="absolute top-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent blur-[0.3px] pointer-events-none z-10" />
            
            {/* Dynamic ambient backing tint glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--glow-color),transparent_65%)] opacity-35 pointer-events-none -z-10" style={{ '--glow-color': modelPreset.glowColor } as React.CSSProperties} />

            {/* Visual indicator & top small row */}
            <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-slate-200/60 relative z-20">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${modelPreset.accentColor} animate-ping`} />
                <span className={`text-[9px] font-black uppercase tracking-widest truncate ${modelPreset.textDark}`}>
                  {modelPreset.name}
                </span>
              </div>
              <div className="flex items-center gap-1 pointer-events-auto">
                {/* Voice Speaker Button */}
                <button
                  onClick={speakDateTime}
                  className={`p-1.5 rounded-lg border transition flex items-center justify-center relative cursor-pointer ${
                    isSpeaking 
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md scale-105'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/50 shadow-xs'
                  }`}
                  title={language === 'bn' ? 'সময় ও তারিখ শুনুন' : 'Voice Announcement'}
                >
                  <Volume2 size={11} className={isSpeaking ? "animate-bounce" : ""} />
                </button>
                
                {/* Expand / Maximize Button */}
                <button
                  onClick={() => { setIsMinimized(false); playClickFeedback(900); }}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/50 shadow-xs transition cursor-pointer"
                  title={language === 'bn' ? 'বড় করুন' : 'Expand Widget'}
                >
                  <Maximize2 size={11} />
                </button>
              </div>
            </div>

            {/* Time & Date Layout inside an elegant glassmorphic body */}
            <div className={`flex items-center justify-between gap-2 px-3.5 py-2.5 ${modelPreset.markedArea} rounded-2xl shadow-inner relative z-20`}>
              {/* Live Time */}
              <div className="flex flex-col text-left">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
                  {language === 'bn' ? 'সময়' : 'TIME'}
                </span>
                <div className="flex items-baseline gap-[1px] mt-1.5">
                  <span className={`text-[19px] font-black leading-none ${modelPreset.text}`}>
                    {hh}:{mm}
                  </span>
                  <span className={`text-[11px] font-extrabold leading-none ${modelPreset.text} opacity-90`}>
                    :{ss}
                  </span>
                  {!use24h && (
                    <span className={`text-[8.5px] font-black ml-1 uppercase leading-none ${modelPreset.textDark}`}>
                      {ampm}
                    </span>
                  )}
                </div>
              </div>

              {/* Live Date divided by stylish separator */}
              <div className="flex flex-col text-right border-l border-slate-200/60 pl-3">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
                  {language === 'bn' ? 'তারিখ' : 'DATE'}
                </span>
                <span className={`text-[13px] font-black tracking-wider leading-none mt-1.5 ${modelPreset.textDark}`}>
                  {dateStr}
                </span>
              </div>
            </div>


          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Return exact vibrant colors for the active button preset style
function stylePresetActive(m: ClockModel) {
  if (m === 'solar') return 'bg-amber-500 hover:bg-amber-500/90 text-slate-950 font-black border border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
  if (m === 'cosmic') return 'bg-cyan-500 hover:bg-cyan-500/90 text-slate-950 font-black border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.5)]';
  if (m === 'nixie') return 'bg-orange-500 hover:bg-orange-500/90 text-slate-950 font-black border border-orange-400 shadow-[0_0_12px_rgba(234,88,12,0.5)]';
  return 'bg-emerald-500 hover:bg-emerald-500/90 text-slate-950 font-black border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
}
