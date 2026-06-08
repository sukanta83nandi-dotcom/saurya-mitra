import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useConversation, ConversationProvider } from '@elevenlabs/react';
import { 
  MessageSquare, 
  Mic, 
  X, 
  Send, 
  Volume2, 
  Headphones, 
  Sparkles, 
  GripHorizontal, 
  AlertCircle,
  Radio,
  Loader2
} from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';
import { Language } from '../translations';

interface SauryaAssistantProps {
  language: Language;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export function SauryaAssistant({ language }: SauryaAssistantProps) {
  return (
    <ConversationProvider>
      <SauryaAssistantInner language={language} />
    </ConversationProvider>
  );
}

function SauryaAssistantInner({ language }: SauryaAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [inputText, setInputText] = useState('');
  const [isLoadingReply, setIsLoadingReply] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Native Web Speech Engine states
  const [voiceEngine, setVoiceEngine] = useState<'elevenlabs' | 'native'>('elevenlabs');
  const [isNativeVoiceActive, setIsNativeVoiceActive] = useState(false);
  const [nativeSpeechState, setNativeSpeechState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const recognitionRef = useRef<any>(null);
  
  // Position state for draggable launcher
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize ElevenLabs Conversation Voice Assistant
  const conversation = useConversation({
    onConnect: () => {
      console.log('ElevenLabs Conversation Connected');
      setSessionStartTime(Date.now());
      setVoiceError(null);
    },
    onDisconnect: () => {
      console.log('ElevenLabs Conversation Disconnected');
      const sessionDuration = sessionStartTime ? (Date.now() - sessionStartTime) : 0;
      if (sessionDuration > 0 && sessionDuration < 15000) {
        setVoiceError(prev => prev || (
          language === 'bn'
            ? 'অ্যাসিস্ট্যান্টটি দ্রুত ডিসকানেক্ট হয়ে গেছে। অনুগ্রহ করে নিশ্চিত করুন যে আপনার ELEVENLABS_API_KEY সিক্রেট প্যানেলে সঠিক দেওয়া আছে এবং আপনার প্ল্যান লিমিট শেষ হয়নি।'
            : 'Session disconnected quickly after greeting. Please ensure ELEVENLABS_API_KEY is correctly configured in your Secrets panel, or check your ElevenLabs quota.'
        ));
        // Auto fallback to Native voice engine for seamless UX
        console.log('ElevenLabs connection interrupted, switching to device voice backup...');
        setVoiceEngine('native');
      }
    },
    onMessage: (message: any) => {
      console.log('ElevenLabs Conversation Message received:', message);
    },
    onError: (err: any) => {
      console.error('ElevenLabs Conversation Error:', err);
      setVoiceError(err.message || String(err));
    },
  });

  const { status, isSpeaking } = conversation;

  // Derive dynamic speaking, thinking and connected states based on active engine
  const isCurrentlyConnected = voiceEngine === 'elevenlabs' ? status === 'connected' : isNativeVoiceActive;
  const isCurrentlySpeaking = voiceEngine === 'elevenlabs' ? isSpeaking : (nativeSpeechState === 'speaking');
  const isCurrentlyThinking = voiceEngine === 'elevenlabs' ? status === 'connecting' : (nativeSpeechState === 'thinking');

  // Cancel any active SpeechSynthesis utterance on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.error('Error aborting speech recognition:', e);
        }
      }
    };
  }, []);

  // Auto-scroll chat history
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isLoadingReply]);

  // Set up welcome message in chat list when text mode opens or component mounts
  useEffect(() => {
    if (chatHistory.length === 0) {
      const welcomeText = `নমস্কার! আমি সৌর মিত্র AI অ্যাসিস্ট্যান্ট। আমি মূলত পশ্চিমবঙ্গের সোলার সিস্টেম, সরকারি সাবসিডি (যেমন- PM Surya Ghar) এবং খরচ সংক্রান্ত বিষয়ে সাহায্য করতে পারি। আপনি আমাকে বাংলা অথবা ইংরেজি যেকোনো ভাষায় জিজ্ঞাসা করতে পারেন। আপনার প্রশ্নটি এখানে লিখুন!

***

Hello! I am your Saurya Mitra AI Assistant. I can help you with rooftop solar installations, cost calculations, registered vendors, and PM-Surya Ghar subsidy benefits in West Bengal. You can ask me in English or Bengali. Please enter your query below!`;
      
      setChatHistory([
        {
          id: 'welcome',
          role: 'model',
          text: welcomeText,
          timestamp: new Date(),
        }
      ]);
    }
  }, [language, chatHistory.length]);

  // Handle Drag Click logic
  const handleLauncherClick = () => {
    if (!isDraggingRef.current) {
      setIsOpen(!isOpen);
    }
  };

  // Close voice session when switching to text or closing assistant
  const handleClose = async () => {
    if (status === 'connected') {
      try {
        await conversation.endSession();
      } catch (err) {
        console.error('Failed to stop voice conversation:', err);
      }
    }
    stopNativeVoiceCall(); // stop device speech activities safely
    setIsOpen(false);
  };

  // Helper to Speak Text via Native speechSynthesis (Web Speech API)
  const speakNativeText = (text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onEnd?.();
      return;
    }
    
    // Stop any playing speech
    window.speechSynthesis.cancel();
    
    // Strip markdown formatting out for voice readout
    const cleanText = text
      .replace(/\*\*?/g, '')
      .replace(/#+/g, '')
      .replace(/-\s+/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'bn' ? 'bn-IN' : 'en-US';
    
    // Attempt to match system dialect
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(utterance.lang.toLowerCase()));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    
    utterance.onend = () => {
      onEnd?.();
    };
    utterance.onerror = () => {
      onEnd?.();
    };
    
    window.speechSynthesis.speak(utterance);
  };

  // Start Native Speech Recognition
  const startNativeListening = () => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(
        language === 'bn' 
          ? 'আপনার ব্রাউজারটি ভয়েস রেকগনিশন সাপোর্ট করে না। অনুগ্রহ করে গুগল ক্রোম ব্যবহার করুন।' 
          : 'Your browser does not support voice recognition. Please use Google Chrome.'
      );
      setIsNativeVoiceActive(false);
      setNativeSpeechState('idle');
      return;
    }

    setNativeSpeechState('listening');
    
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = language === 'bn' ? 'bn-IN' : 'en-US';
    recognitionRef.current = rec;

    rec.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (!transcript || !transcript.trim()) {
        startNativeListening();
        return;
      }

      console.log('Native Speech transcribed:', transcript);
      
      const newUserMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: transcript,
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, newUserMsg]);
      setNativeSpeechState('thinking');

      try {
        const formattedHistory = chatHistory
          .filter(msg => msg.id !== 'welcome')
          .map(msg => ({
            role: msg.role === 'model' ? 'model' : 'user',
            content: msg.text
          }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: transcript,
            history: formattedHistory,
          }),
        });

        const data = await res.json();

        if (data.success) {
          const botMsg: ChatMessage = {
            id: `bot-${Date.now()}`,
            role: 'model',
            text: data.reply,
            timestamp: new Date(),
          };
          setChatHistory(prev => [...prev, botMsg]);
          
          setNativeSpeechState('speaking');
          speakNativeText(data.reply, () => {
            startNativeListening();
          });
        } else {
          throw new Error(data.error || 'Failed to generate response');
        }
      } catch (err: any) {
        console.error('Native voice conversation thinking error:', err);
        setVoiceError(
          language === 'bn'
            ? 'সার্ভার থেকে উত্তর তৈরি করা সম্ভব হয়নি। সংযোগটি পুনরায় স্থাপন করা হচ্ছে...'
            : 'Failed to retrieve AI response. Restarting voice receiver...'
        );
        setNativeSpeechState('listening');
        setTimeout(() => {
          startNativeListening();
        }, 3000);
      }
    };

    rec.onerror = (event: any) => {
      console.warn('Speechrecognition context error:', event.error);
      if (event.error === 'no-speech') {
        startNativeListening();
      } else {
        setTimeout(() => {
          if (isNativeVoiceActive && nativeSpeechState === 'listening') {
            startNativeListening();
          }
        }, 1000);
      }
    };

    rec.onend = () => {
      if (isNativeVoiceActive && nativeSpeechState === 'listening') {
        try {
          rec.start();
        } catch (e) {
          console.warn('Auto-restart audio recognition failed:', e);
        }
      }
    };

    try {
      rec.start();
    } catch (e) {
      console.error('Error starting browser speech recognition:', e);
    }
  };

  // Start Device Voice Session
  const startNativeVoiceCall = async () => {
    setVoiceError(null);
    setIsNativeVoiceActive(true);
    setNativeSpeechState('speaking');
    
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const welcomeText = language === 'bn'
        ? 'নমস্কার! সৌর মিত্র ভয়েস অ্যাসিস্ট্যান্টে আপনাকে স্বাগত। আমি আপনাকে আপনার বাড়ির সোলার সিস্টেম, বিদ্যুৎ সাশ্রয় এবং সরকারি সাবসিডি সংক্রান্ত বিষয়ে সাহায্য করতে পারি। আপনি আমাকে বাংলা অথবা ইংরেজি যেকোনো ভাষায় জিজ্ঞাসা করুন!'
        : 'Hello! Welcome to Saurya Mitra Voice Assistant. I can help you with rooftop solar installations, savings projections, and PM Surya Ghar government subsidies. Please ask me anything in English or Bengali!';
        
      speakNativeText(welcomeText, () => {
        startNativeListening();
      });
    } catch (err) {
      console.error('Device microphone fetch failed:', err);
      setVoiceError(
        language === 'bn'
          ? 'মাইক্রোফোন চালু করতে সমস্যা হয়েছে। দয়া করে ব্রাউজারের মাইক্রোফোন ব্যবহারের অনুমতি দিন।'
          : 'Could not access device microphone. Please check permissions.'
      );
      setIsNativeVoiceActive(false);
      setNativeSpeechState('idle');
    }
  };

  // Stop Device Voice Session
  const stopNativeVoiceCall = () => {
    setIsNativeVoiceActive(false);
    setNativeSpeechState('idle');
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        console.warn('Error during SpeechRecognition end:', e);
      }
    }
  };

  // Start ElevenLabs Voice Session
  const startVoiceCall = async () => {
    setVoiceError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const agentId = 'agent_1801ks503x14ffvrgvw7zgbwxm0f';
      
      try {
        const res = await fetch('/api/elevenlabs/signed-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ agentId }),
        });

        const data = await res.json();
        
        if (data.success && data.signedUrl) {
          console.log('Starting session with secured signed URL');
          await conversation.startSession({
            signedUrl: data.signedUrl,
          });
        } else {
          if (data.noKey) {
            console.warn('ELEVENLABS_API_KEY is missing, starting session fallback');
            await conversation.startSession({ agentId });
          } else {
            throw new Error(data.error || 'Could not fetch secure session');
          }
        }
      } catch (authErr: any) {
        console.warn('Authentication fetch failed, trying public session fallback:', authErr);
        await conversation.startSession({ agentId });
      }
    } catch (err: any) {
      console.error('Microphone access or ElevenLabs connection failed:', err);
      setVoiceError(
        language === 'bn' 
          ? 'মাইক্রোফোন চালু করতে সমস্যা হয়েছে অথবা সংযোগ করতে ব্যর্থ হয়েছে। দয়া করে অনুমতি পরীক্ষা করুন।' 
          : 'Could not access microphone or server connection failed. Please check permissions.'
      );
    }
  };

  // Stop ElevenLabs Voice Session
  const stopVoiceCall = async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error('Error stopping session:', err);
    }
  };

  // Send Text Message to Gemini API
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoadingReply) return;

    const userMessage = inputText.trim();
    setInputText('');
    setChatError(null);

    // Create unique message
    const newUserMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userMessage,
      timestamp: new Date(),
    };

    setChatHistory(prev => [...prev, newUserMsg]);
    setIsLoadingReply(true);

    try {
      // Prepare correct history schema for server endpoint
      const formattedHistory = chatHistory
        .filter(msg => msg.id !== 'welcome')
        .map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          content: msg.text
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history: formattedHistory,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date(),
        };
        setChatHistory(prev => [...prev, botMsg]);
      } else {
        throw new Error(data.error || 'Failed to generate response');
      }
    } catch (err: any) {
      console.error('Chat API Error:', err);
      setChatError(language === 'bn'
        ? 'উত্তর তৈরি করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।'
        : 'Failed to retrieve response. Please check your internet connection and try again.'
      );
    } finally {
      setIsLoadingReply(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none select-none font-sans" id="saurya-assistant-root">
      {/* 2. Unified Expandable Card Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            id="saurya-assistant-panel"
            className="pointer-events-auto absolute bottom-20 right-0 w-[420px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-8rem)] rounded-[2rem] flex flex-col backdrop-blur-3xl bg-[#090b11]/85 border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_45px_rgba(245,158,11,0.12)] overflow-hidden text-white"
          >
            {/* Cosmic Backplane Glow and Orbiting Objects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 bg-[#06080d]">
              {/* Deep Space Nebulae with Gorgeous Radiant Orbs */}
              <div className="absolute -top-[10%] -left-[15%] w-[85%] h-[85%] bg-gradient-radial from-cyan-500/12 via-indigo-500/4 to-transparent blur-3xl rounded-full" />
              <div className="absolute -bottom-[20%] -right-[15%] w-[85%] h-[85%] bg-gradient-radial from-amber-600/12 via-rose-600/3 to-transparent blur-3xl rounded-full" />
              
              {/* Star Dust twinkles */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />
              
              {/* Holographic Circular Orbit and Rings */}
              <svg className="absolute top-[12%] left-[5%] w-[90%] h-[75%] opacity-20" viewBox="0 0 400 300">
                <motion.ellipse 
                  cx="200" cy="150" rx="180" ry="120" 
                  fill="none" stroke="rgba(255, 255, 255, 0.4)" 
                  strokeWidth="1" strokeDasharray="4 6"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                  style={{ transformOrigin: "200px 150px" }}
                />
                <motion.ellipse 
                  cx="200" cy="150" rx="140" ry="80" 
                  fill="none" stroke="rgba(14, 165, 233, 0.3)" 
                  strokeWidth="1.5"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  style={{ transformOrigin: "200px 150px" }}
                />
              </svg>
              
              {/* Top Giant Celestial Sphere (glowing planet) */}
              <div className="absolute top-[4%] right-[-10%] w-60 h-60 rounded-full bg-gradient-to-tr from-[#020617] via-[#0f172a] to-amber-500/20 border border-white/5 shadow-[0_0_50px_rgba(245,158,11,0.08)],inset_0_4px_30px_rgba(255,255,255,0.05)">
                {/* Planet Atmos Glow */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-cyan-400/10 to-transparent blur-md" />
              </div>
            </div>

            {/* Header */}
            <div className="p-4 border-b border-white/[0.08] bg-slate-950/40 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-400 to-yellow-400 flex items-center justify-center text-slate-950 shadow-[0_4px_12px_rgba(245,158,11,0.3)]">
                  <Headphones size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5 leading-none">
                    {language === 'bn' ? 'সৌর মিত্র অ্যাসিস্ট্যান্ট' : 'Saurya Mitra Assistant'}
                    <Sparkles size={13} className="text-amber-400 animate-bounce" />
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-mono tracking-wider block mt-1">
                    {isCurrentlyConnected ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        {language === 'bn' ? 'ভয়েস কল চলছে...' : 'Voice Connected...'}
                      </span>
                    ) : isCurrentlyThinking ? (
                      <span className="text-amber-400">
                        {language === 'bn' ? 'সংযোগ হচ্ছে...' : 'Connecting...'}
                      </span>
                    ) : (
                      <span>{language === 'bn' ? 'স্মার্ট সোলার অ্যাসিস্ট্যান্ট' : 'Smart Solar Assistant'}</span>
                    )}
                  </span>
                </div>
              </div>
              <button 
                onClick={handleClose}
                className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.15] flex items-center justify-center text-zinc-400 hover:text-white transition duration-250 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Toggle Switch Mode (Voice / Text) */}
            <div className="p-2 border-b border-white/[0.06] bg-slate-950/20 backdrop-blur-md">
              <div className="flex p-1 bg-white/[0.03] rounded-xl border border-white/[0.05] relative">
                <button
                  onClick={() => setMode('voice')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 relative z-10 transition duration-300 cursor-pointer overflow-hidden",
                    mode === 'voice' ? "text-slate-950 font-extrabold" : "text-slate-300 hover:text-white"
                  )}
                >
                  {mode === 'voice' && (
                    <motion.span
                      layoutId="activeTab3d"
                      className="absolute inset-0 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 rounded-lg shadow-[inset_0_2px_1px_rgba(255,255,255,0.45),0_3px_10px_rgba(245,158,11,0.25)] border-b-2 border-amber-600 -z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    />
                  )}
                  <Mic size={14} className={cn("transition-transform duration-300", mode === 'voice' && "scale-110")} />
                  <span>{language === 'bn' ? 'ভয়েস অ্যাসিস্ট্যান্ট' : 'Voice Assistant'}</span>
                </button>
                <button
                  onClick={() => setMode('text')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 relative z-10 transition duration-300 cursor-pointer overflow-hidden",
                    mode === 'text' ? "text-slate-950 font-extrabold" : "text-slate-300 hover:text-white"
                  )}
                >
                  {mode === 'text' && (
                    <motion.span
                      layoutId="activeTab3d"
                      className="absolute inset-0 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 rounded-lg shadow-[inset_0_2px_1px_rgba(255,255,255,0.45),0_3px_10px_rgba(245,158,11,0.25)] border-b-2 border-amber-600 -z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    />
                  )}
                  <MessageSquare size={14} className={cn("transition-transform duration-300", mode === 'text' && "scale-110")} />
                  <span>{language === 'bn' ? 'টেক্সট চ্যাট' : 'Smart Chat'}</span>
                </button>
              </div>
            </div>

            {/* Mode Screen Container */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              
              {/* --- VOICE SCREEN --- */}
              {mode === 'voice' && (
                <div className="flex-1 flex flex-col items-center justify-between p-6 bg-transparent overflow-y-auto animate-fade-in relative z-10">
                  
                  {/* Premium Status Pill Bar akin to screenshot 2 */}
                  <div className="flex justify-center mt-1 w-full">
                    <div className="px-3.5 py-1 rounded-full border border-white/10 bg-slate-950/60 backdrop-blur-md text-[9px] font-black tracking-[0.18em] text-cyan-400 uppercase flex items-center gap-2 shadow-[inset_0_1px_3px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.3)]">
                      <div className={`w-1.5 h-1.5 rounded-full ${isCurrentlyConnected ? 'bg-emerald-400 ring-4 ring-emerald-400/20 animate-pulse' : isCurrentlyThinking ? 'bg-amber-400 ring-4 ring-amber-400/20 animate-ping' : 'bg-slate-500 ring-2 ring-slate-500/20'}`} />
                      <span>{isCurrentlyConnected ? '✦ COMPANION VOICE SYNCED' : isCurrentlyThinking ? '✦ ESTABLISHING SYNAPSE' : '✦ SAURYA SYSTEM READY'}</span>
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className="text-center mt-1.5 max-w-xs space-y-2">
                    <p className="text-slate-300 text-xs leading-relaxed font-medium">
                      {language === 'bn' 
                        ? 'সরাসরি ভয়েস কলের মাধ্যমে সৌর মিত্র অ্যাসিস্ট্যান্টের সাথে বাংলা অথবা ইংরেজিতে কথা বলুন!'
                        : 'Have a direct bilingual voice call with Saurya Mitra Assistant in English or Bengali!'}
                    </p>
                  </div>

                  {/* Pulsing Swirl Graphic / Wave Sync indicator */}
                  <div className="relative flex items-center justify-center my-6">
                    {/* Floating Space Waves */}
                    {isCurrentlyConnected && !isCurrentlyThinking && (
                      <>
                        <motion.div 
                          animate={{ scale: [1, 1.8, 1], rotate: [0, 180, 360], opacity: [0.35, 0, 0.35] }}
                          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                          className="absolute w-52 h-52 rounded-full bg-gradient-to-tr from-amber-400/10 via-cyan-400/5 to-transparent border border-amber-400/25 filter blur-[1px]"
                        />
                        <motion.div 
                          animate={{ scale: [1.2, 2.2, 1.2], rotate: [360, 180, 0], opacity: [0.25, 0, 0.25] }}
                          transition={{ repeat: Infinity, duration: 5, delay: 0.8, ease: "linear" }}
                          className="absolute w-52 h-52 rounded-full bg-gradient-to-bl from-cyan-400/10 via-amber-400/5 to-transparent border border-cyan-400/20 filter blur-[1px]"
                        />
                      </>
                    )}

                    {/* Dotted Gyro Rings */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                        className="w-48 h-48 rounded-full border border-dashed border-white/10"
                      />
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
                        className="w-40 h-40 rounded-full border border-dotted border-cyan-500/20"
                      />
                    </div>

                    {/* Central Sphere */}
                    <div className={cn(
                      "w-36 h-36 rounded-full flex flex-col items-center justify-center border transition-all duration-700 relative z-10 overflow-hidden",
                      isCurrentlyConnected 
                        ? isCurrentlySpeaking 
                          ? "border-amber-400 bg-slate-900/90 shadow-[0_0_40px_rgba(245,158,11,0.45),inset_0_2px_15px_rgba(245,158,11,0.2)] scale-105" 
                          : "border-emerald-400 bg-slate-900/90 shadow-[0_0_35px_rgba(16,185,129,0.35),inset_0_2px_15px_rgba(16,185,129,0.2)]"
                        : isCurrentlyThinking
                          ? "border-yellow-400 bg-slate-900/90 shadow-[0_0_35px_rgba(234,179,8,0.25)] animate-pulse"
                          : "border-white/15 bg-slate-950/80 shadow-[inset_0_2px_10px_rgba(255,255,255,0.06),0_15px_35px_rgba(0,0,0,0.6)]"
                    )}>
                      {/* Inner atmosphere core layer */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.08] pointer-events-none" />
                      
                      {isCurrentlyConnected ? (
                        isCurrentlySpeaking ? (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/15 to-transparent" />
                            <Volume2 className="h-10 w-10 text-amber-400 filter drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-bounce relative z-10" />
                            <span className="text-[10px] font-black text-amber-400 mt-2 tracking-[0.16em] uppercase relative z-10">
                              {language === 'bn' ? 'কথা বলছে...' : 'Speaking...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/15 to-transparent" />
                            <Radio className="h-10 w-10 text-emerald-400 filter drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse relative z-10" />
                            <span className="text-[10px] font-black text-emerald-400 mt-2 tracking-[0.16em] uppercase animate-pulse relative z-10">
                              {language === 'bn' ? 'শুনছি...' : 'Listening...'}
                            </span>
                          </>
                        )
                      ) : isCurrentlyThinking ? (
                        <>
                          <Loader2 className="h-10 w-10 text-yellow-400 animate-spin" />
                          <span className="text-[10px] font-black text-yellow-500 mt-2 tracking-[0.12em] uppercase">
                            {language === 'bn' ? 'সংযোগ হচ্ছে...' : 'Connecting...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Mic className="h-10 w-10 text-zinc-400 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
                          <span className="text-[10px] font-black text-zinc-400 mt-2 tracking-[0.16em] uppercase">
                            {language === 'bn' ? 'অফলাইন' : 'Standby'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Voice Error Notice */}
                  {voiceError && (
                    <div className="mx-2 p-3 bg-red-950/25 border border-red-500/20 text-slate-300 rounded-2xl flex items-start gap-2.5 text-xs backdrop-blur-md relative z-20">
                      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5 animate-bounce" />
                      <div className="space-y-1">
                        <p className="font-semibold text-rose-200">
                          {language === 'bn' ? 'কানেকশন সমস্যা' : 'Voice Session Advisory'}
                        </p>
                        <p className="leading-relaxed text-zinc-400">
                          {voiceError}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Connect / Control Action Button */}
                  <div className="w-full px-2 mb-2 relative z-20">
                    {isCurrentlyConnected ? (
                      <button
                        onClick={voiceEngine === 'elevenlabs' ? stopVoiceCall : stopNativeVoiceCall}
                        className="w-full py-4 bg-rose-950/40 hover:bg-rose-900/60 active:scale-[0.98] text-rose-200 hover:text-white font-black rounded-xl border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)] flex items-center justify-center gap-3 transition cursor-pointer"
                      >
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        {language === 'bn' ? 'কল কেটে দিন' : 'Disconnect Assistant'}
                      </button>
                    ) : (
                      <button
                        onClick={voiceEngine === 'elevenlabs' ? startVoiceCall : startNativeVoiceCall}
                        disabled={isCurrentlyThinking}
                        className={cn(
                          "w-full py-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.25)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.4)] flex items-center justify-center gap-3 active:scale-[0.98] border border-amber-300/30 transition cursor-pointer",
                          isCurrentlyThinking && "opacity-80 pointer-events-none"
                        )}
                      >
                        <Mic size={18} />
                        {language === 'bn' ? 'ভয়েস অ্যাসিস্ট্যান্ট শুরু করুন' : 'Start Voice Call'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* --- TEXT SCREEN --- */}
              {mode === 'text' && (
                <div className="flex-1 flex flex-col overflow-hidden bg-transparent relative z-10 animate-fade-in">
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatHistory.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[85%] rounded-[1.2rem] p-4 text-sm leading-relaxed shadow-lg relative overflow-hidden",
                          msg.role === 'user'
                            ? "bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-500 text-slate-950 font-bold ml-auto rounded-tr-sm shadow-[0_4px_15px_rgba(245,158,11,0.25)]"
                            : "bg-white/[0.04] backdrop-blur-md text-zinc-100 border border-white/[0.08] mr-auto rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                        )}
                      >
                        {msg.role === 'model' && (
                          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
                        )}
                        {msg.role === 'model' ? (
                          <div className="markdown-body prose prose-invert prose-sm max-w-none text-zinc-100 break-words">
                            <Markdown>{msg.text}</Markdown>
                          </div>
                        ) : (
                          <p>{msg.text}</p>
                        )}
                        <span className={cn(
                          "text-[9px] font-mono mt-2 self-end block tracking-wide",
                          msg.role === 'user' ? "text-slate-900/70 font-bold" : "text-zinc-400/60"
                        )}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}

                    {/* Pending API Reply */}
                    {isLoadingReply && (
                      <div className="flex items-center gap-2.5 bg-white/[0.02] backdrop-blur-md text-slate-300 border border-white/[0.05] max-w-[85%] rounded-2xl rounded-tl-sm p-4 mr-auto shadow-md">
                        <Loader2 size={14} className="animate-spin text-amber-400" />
                        <span className="text-xs font-semibold tracking-wide text-zinc-300 animate-pulse">
                          {language === 'bn' ? 'সৌর মিত্র লিখছেন...' : 'Saurya Mitra is drafting...'}
                        </span>
                      </div>
                    )}

                    {/* Chat Error Notice */}
                    {chatError && (
                      <div className="flex items-start gap-2.5 bg-rose-950/20 border border-rose-500/20 text-rose-200 rounded-xl p-3.5 text-xs leading-relaxed backdrop-blur-sm">
                        <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                        <p>{chatError}</p>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Form */}
                  <form 
                    onSubmit={handleSendText}
                    className="p-3 border-t border-white/[0.06] bg-slate-950/40 backdrop-blur-md flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={language === 'bn' ? 'এখানে আপনার প্রশ্নটি লিখুন...' : 'Ask your question here...'}
                      className="flex-1 bg-white/[0.02] border border-white/10 hover:border-white/20 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition duration-200"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isLoadingReply}
                      className={cn(
                        "w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 active:scale-95 flex items-center justify-center text-slate-950 shadow-md transition shrink-0 cursor-pointer border border-amber-300/20",
                        (!inputText.trim() || isLoadingReply) && "opacity-40 pointer-events-none"
                      )}
                    >
                      <Send size={15} />
                    </button>
                  </form>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Unified Floating Interactive Launcher Button (Draggable) */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.15}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={() => {
          // Reset drag lock after a short delay so click is not registered instantly if heavily moved
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 100);
        }}
        className="pointer-events-auto cursor-grab active:cursor-grabbing absolute bottom-0 right-0 select-none shadow-2xl"
      >
        <button
          type="button"
          onClick={() => {
            if (!isDraggingRef.current) {
              setIsOpen(prev => !prev);
            }
          }}
          className={cn(
            "h-14 px-5 rounded-full flex items-center gap-3 select-none font-bold text-sm tracking-wide shadow-2xl border border-amber-400/40 select-none transition-all duration-300",
            isOpen 
              ? "bg-slate-900/80 backdrop-blur-md text-white border-slate-700/50" 
              : "bg-gradient-to-tr from-slate-950/90 to-slate-900/90 text-slate-100 backdrop-blur-md border border-slate-800/80 hover:border-amber-400 hover:scale-105 active:scale-95 cursor-pointer pb-[-2px] hover:shadow-amber-400/10"
          )}
        >
          {/* Draggable Icon Grid Grid Handle */}
          <GripHorizontal size={14} className="text-zinc-500 -ml-1 shrink-0" />
          
          {/* Status Glow Indicators */}
          <div className="relative">
            {status === 'connected' ? (
              <div className="relative flex h-5 w-5 items-center justify-center bg-emerald-500/10 border border-emerald-400 rounded-full">
                <Radio size={12} className="text-emerald-400 animate-pulse" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
            ) : (
              <div className="relative flex h-5 w-5 items-center justify-center bg-amber-400 rounded-full shadow-inner shadow-black/20 text-black">
                <Sparkles size={11} className="text-black" />
              </div>
            )}
          </div>

          {/* Label text */}
          <span className="whitespace-nowrap flex items-center gap-1">
            {language === 'bn' ? 'সৌর মিত্র অ্যাসিস্ট্যান্ট' : 'Saurya Mitra Assistant'}
          </span>
        </button>
      </motion.div>
    </div>
  );
}
