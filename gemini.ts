import React, { useState, useEffect } from 'react';
import { Search, MapPin, Building2, ExternalLink, ShieldCheck, ChevronDown, Phone, Star, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../translations';
import { cn } from '../lib/utils';
import { statesData as STATE_DISTRICTS } from '../data/india-states-districts';

interface VendorLookupProps {
  language: Language;
  userProfile?: any;
}

const STATES = Object.keys(STATE_DISTRICTS).sort();

interface Vendor {
  id: string;
  name: string;
  contact: string;
  address: string;
  rating: number;
  featured?: boolean;
  website: string;
  pincode?: string;
}

const SAMPLE_VENDORS: Vendor[] = [
  { id: '1', name: 'Vikram Solar Ltd', contact: '1800 200 3800', address: 'The Chambers, 8th Floor, 1865, Rajdanga Main Road, Kasba, Kolkata - 700107', rating: 4.8, featured: true, website: 'https://www.vikramsolar.com/', pincode: '700107' },
  { id: '2', name: 'Tata Power Solar (Partner)', contact: '1800 208 7446', address: 'Kankaria Estate, 5th Floor, 6 Little Russell Street, Kolkata - 700071', rating: 4.9, featured: true, website: 'https://www.tatapowersolar.com/', pincode: '700071' },
  { id: '3', name: 'Bengal Solar Solutions', contact: '+91 98300 12345', address: 'Barasat, North 24 Parganas, Kolkata - 700124', rating: 4.5, website: 'https://pmsuryaghar.gov.in/', pincode: '700124' },
  { id: '4', name: 'Green Tech Solar', contact: '+91 98765 43210', address: 'Salkia, Howrah - 711106', rating: 4.2, website: 'https://pmsuryaghar.gov.in/', pincode: '711106' },
  { id: '5', name: 'Sunways Solar', contact: '+91 94330 98765', address: 'Siliguri, Jalpaiguri - 734001', rating: 4.7, website: 'https://pmsuryaghar.gov.in/', pincode: '734001' },
  { id: '6', name: 'Sova Solar Limited', contact: '+91 33450 75609', address: 'DLF GALLERIA, Office No. DGK 917, 9th floor, Block No. BG-8, AA-IB, New Town, Kolkata - 700156', rating: 4.6, website: 'https://sovasolar.com/', pincode: '700156' },
  { id: '7', name: 'Luminous Solar Service', contact: '1800 103 3039', address: 'Ganesh Chandra Avenue, Kolkata - 700013', rating: 4.4, website: 'https://www.luminousindia.com/solar-solutions', pincode: '700013' },
  { id: '8', name: 'East Bengal Solar Corp', contact: '+91 98311 22334', address: 'Burdwan Road, Siliguri - 734005', rating: 4.3, website: 'https://pmsuryaghar.gov.in/', pincode: '734005' },
  { id: '9', name: 'Kolkata Sun Systems', contact: '033 4005 6678', address: 'Park Street, Kolkata - 700016', rating: 4.5, website: 'https://pmsuryaghar.gov.in/', pincode: '700016' }
];

export function VendorLookup({ language, userProfile }: VendorLookupProps) {
  const t = translations[language] as any;
  const [searchMethod, setSearchMethod] = useState<'district' | 'pin'>('district');
  const [selectedState, setSelectedState] = useState(userProfile?.state || '');
  const [selectedDistrict, setSelectedDistrict] = useState(userProfile?.district || '');
  const [pincode, setPincode] = useState(userProfile?.pinCode || '');
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Sync state if userProfile changes
  useEffect(() => {
    if (userProfile) {
      if (userProfile.state) setSelectedState(userProfile.state);
      if (userProfile.district) setSelectedDistrict(userProfile.district);
      if (userProfile.pinCode) setPincode(userProfile.pinCode);
    }
  }, [userProfile]);

  const districts = selectedState ? STATE_DISTRICTS[selectedState] : [];

  const handleSearch = () => {
    if (searchMethod === 'district' && !selectedDistrict) return;
    if (searchMethod === 'pin' && pincode.length < 6) return;

    setIsSearching(true);
    // Simulate search
    setTimeout(() => {
      setIsSearching(false);
      setShowResults(true);
    }, 800);
  };

  const filteredVendors = showResults 
    ? (searchMethod === 'district' 
        ? SAMPLE_VENDORS.map(v => {
            const isWestBengalVendors = ['3', '4', '5', '8', '9'].includes(v.id);
            const localizedAddress = (selectedState === 'West Bengal' && isWestBengalVendors)
              ? v.address 
              : `${selectedDistrict}, ${selectedState}`;
            
            return {
              ...v,
              address: localizedAddress
            };
          })
        : SAMPLE_VENDORS.filter(v => v.pincode?.startsWith(pincode.substring(0, 3))) // Mock: show vendors in same region
      )
    : [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-4"
    >
      <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-sm border border-gray-100">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 leading-tight">
            {t.vendorLookupTitle}
          </h2>
          <p className="text-gray-500 text-lg font-medium leading-relaxed">
            {t.vendorLookupDesc}
          </p>

          <div className="flex justify-center p-2 bg-gray-100 rounded-3xl w-fit mx-auto mb-10 shadow-inner">
            <div className="relative flex gap-2">
              <button
                onClick={() => {
                  setSearchMethod('district');
                  setShowResults(false);
                }}
                className={cn(
                  "relative z-10 px-8 py-3 rounded-2xl text-sm font-black transition-all duration-300 flex items-center gap-2",
                  searchMethod === 'district' 
                    ? "text-zinc-900" 
                    : "text-gray-500 hover:text-gray-700 hover:scale-105"
                )}
              >
                {searchMethod === 'district' && (
                  <motion.div
                    layoutId="tab-highlight"
                    className="absolute inset-0 bg-white rounded-2xl shadow-lg ring-1 ring-black/5 border-b-4 border-amber-400"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-20 flex items-center gap-2">
                  <MapPin className={cn("w-4 h-4", searchMethod === 'district' ? "text-amber-500" : "text-gray-400")} />
                  {t.searchByDistrict}
                </span>
              </button>
              
              <button
                onClick={() => {
                  setSearchMethod('pin');
                  setShowResults(false);
                }}
                className={cn(
                  "relative z-10 px-8 py-3 rounded-2xl text-sm font-black transition-all duration-300 flex items-center gap-2",
                  searchMethod === 'pin' 
                    ? "text-zinc-900" 
                    : "text-gray-500 hover:text-gray-700 hover:scale-105"
                )}
              >
                {searchMethod === 'pin' && (
                  <motion.div
                    layoutId="tab-highlight"
                    className="absolute inset-0 bg-white rounded-2xl shadow-lg ring-1 ring-black/5 border-b-4 border-amber-400"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-20 flex items-center gap-2">
                  <Search className={cn("w-4 h-4", searchMethod === 'pin' ? "text-amber-400" : "text-gray-400")} />
                  {t.searchByPin}
                </span>
              </button>
            </div>
          </div>

          {searchMethod === 'district' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 text-left">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 ml-2 uppercase tracking-wider">
                  {t.selectState}
                </label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                  <select 
                    className="w-full pl-12 pr-10 py-4 bg-gray-50 border-2 border-transparent focus:border-amber-400 rounded-2xl outline-none transition-all font-bold appearance-none cursor-pointer hover:bg-gray-100"
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedDistrict('');
                      setShowResults(false);
                    }}
                  >
                    <option value="">{language === 'bn' ? 'রাজ্য নির্বাচন করুন' : 'Select State'}</option>
                    {STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none group-hover:text-gray-600 transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-400 ml-2 uppercase tracking-wider">
                  {t.selectDistrict}
                </label>
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                  <select 
                    className="w-full pl-12 pr-10 py-4 bg-gray-50 border-2 border-transparent focus:border-amber-400 rounded-2xl outline-none transition-all font-bold appearance-none cursor-pointer hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={selectedDistrict}
                    disabled={!selectedState}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value);
                      setShowResults(false);
                    }}
                  >
                    <option value="">{language === 'bn' ? 'জেলা সিলেক্ট করুন' : 'Select District'}</option>
                    {districts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none group-hover:text-gray-600 transition-colors" />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-12 text-left max-w-md mx-auto space-y-2">
              <label className="text-sm font-bold text-gray-400 ml-2 uppercase tracking-wider">
                {t.enterPin}
              </label>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                <input 
                  type="text"
                  maxLength={6}
                  placeholder={t.pinPlaceholder}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-amber-400 rounded-2xl outline-none transition-all font-bold placeholder:text-gray-400"
                  value={pincode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPincode(val);
                    setShowResults(false);
                  }}
                />
              </div>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98, y: 0 }}
            onClick={handleSearch}
            disabled={(searchMethod === 'district' ? !selectedDistrict : pincode.length < 6) || isSearching}
            className={cn(
              "w-full md:w-auto px-16 py-5 rounded-[2rem] font-black flex items-center justify-center gap-3 transition-all mt-10 mx-auto shadow-2xl",
              (searchMethod === 'district' ? selectedDistrict : pincode.length >= 6)
                ? "bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-200 border-b-4 border-zinc-950 active:border-b-0" 
                : "bg-gray-100 text-gray-400 cursor-not-allowed border-b-4 border-gray-200"
            )}
          >
            {isSearching ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <Search className="w-5 h-5" />
              </motion.div>
            ) : (
              <Search className="w-5 h-5" />
            )}
            {t.searchVendors}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showResults && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between px-4">
              <h3 className="text-xl font-black text-gray-900">
                {searchMethod === 'district' 
                  ? (language === 'bn' ? `${selectedDistrict} এলাকায় নিবন্ধিত ভেন্ডর` : `Registered Vendors in ${selectedDistrict}`)
                  : (language === 'bn' ? `${pincode} পিন কোড এলাকার ভেন্ডর` : `Vendors near PIN ${pincode}`)}
              </h3>
              <span className="px-4 py-1 bg-amber-100 text-amber-700 text-xs font-black rounded-full uppercase tracking-tighter">
                {filteredVendors.length} {language === 'bn' ? 'ভেন্ডর পাওয়া গেছে' : 'Verified Vendors'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVendors.map((vendor, index) => (
                <motion.div
                  key={vendor.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-5 py-3 md:py-3.5 bg-white rounded-[1.5rem] border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.015)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-all duration-300 group flex items-center"
                >
                  <div className="flex flex-row items-center justify-between gap-4 w-full">
                    {/* Left content: Name, Meta/Badges, Location */}
                    <div className="space-y-1.5 flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-sm md:text-base tracking-tight leading-tight">
                          {vendor.name}
                        </h4>
                        {vendor.featured && (
                          <div className="bg-amber-100 text-amber-600 p-0.5 rounded-full" title="Top Rated">
                            <Star className="w-3 h-3 fill-current" />
                          </div>
                        )}
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-black border border-emerald-100/50 select-none">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          MNRE
                        </span>
                      </div>
                      
                      <div className="flex items-start gap-1 text-slate-500 text-xs font-semibold leading-relaxed">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                        <span>{vendor.address}</span>
                      </div>
                    </div>

                    {/* Right content: Action button */}
                    <div className="shrink-0 flex items-center">
                      <motion.button 
                        whileHover={{ scale: 1.03, y: -0.5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.open(vendor.website, '_blank')}
                        className="flex items-center gap-1.5 px-4.5 py-2.5 bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 rounded-xl text-xs tracking-wider transition-all border-b-2 border-amber-500 active:border-b-0 uppercase"
                      >
                        <span>{language === 'bn' ? 'আবেদন করুন' : 'APPLY NOW'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="px-6 py-4 bg-amber-50 border-2 border-amber-200 rounded-[2rem] flex items-center gap-4 text-amber-900 shadow-sm">
              <div className="bg-amber-400 p-2 rounded-xl text-zinc-900">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="font-black text-sm md:text-base leading-tight">
                {(t as any).vendorDisclaimer}
              </p>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-white via-[#F4FAF8] to-[#E9F5F2] rounded-[2.5rem] border border-[#A7F3D0]/60 p-8 md:p-10 shadow-[0_20px_45px_rgba(16,185,129,0.05),_inset_0_2px_8px_rgba(255,255,255,0.8)] flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10">
              {/* Gloss subtle background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/5 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
              <div className="absolute bottom-0 left-10 w-48 h-48 bg-teal-400/5 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
              
              <div className="flex items-center gap-5 text-left relative z-10">
                <div className="w-14 h-14 bg-emerald-100/80 text-emerald-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner border border-emerald-200/50">
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-slate-900 font-extrabold text-lg leading-tight uppercase tracking-wider">
                    {language === 'bn' ? 'অফিশিয়াল ভেন্ডর ডাটাবেস' : 'Official Empanelled Directory'}
                  </h4>
                  <p className="text-slate-600 font-semibold text-sm max-w-xl leading-relaxed">
                    {language === 'bn' 
                      ? 'সব ভেন্ডরের সম্পূর্ণ তালিকা পেতে এবং সরাসরি আবেদন করতে ভারত সরকারের অফিশিয়াল পোর্টালে যান।' 
                      : 'To see the complete list of all vendors and apply directly, visit the official Govt. of India portal.'}
                  </p>
                </div>
              </div>
              
              <motion.a 
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98, y: 0 }}
                href="https://pmsuryaghar.gov.in/vendor_list" 
                target="_blank" 
                rel="noopener noreferrer"
                className="relative z-10 inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 rounded-2xl font-black text-sm tracking-wide shadow-xl shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all border-b-4 border-emerald-800 active:border-b-0 min-w-fit w-full md:w-auto justify-center group"
              >
                <ExternalLink className="w-4 h-4 text-emerald-200 transition-transform group-hover:scale-110" />
                <span>{language === 'bn' ? 'অফিশিয়াল পোর্টাল দেখুন' : 'Visit Official Portal'}</span>
              </motion.a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Building2, title: language === 'bn' ? 'নিবন্ধিত ভেন্ডর' : 'Certified Vendors', desc: language === 'bn' ? 'সকল ভেন্ডর MNRE অনুমোদিত' : 'All vendors are MNRE approved' },
          { icon: ShieldCheck, title: language === 'bn' ? 'কোয়ালিটি গ্যারান্টি' : 'Quality Check', desc: language === 'bn' ? 'প্যানেলের মান সরকারি যাচাই করা' : 'Standardized solar panel quality' },
          { icon: MapPin, title: language === 'bn' ? 'লোকাল সাপোর্ট' : 'Local Support', desc: language === 'bn' ? 'আপনার জেলার কাছাকাছি সার্ভিস' : 'Service near your district' }
        ].map((item, i) => (
          <div key={i} className="p-8 bg-white border border-gray-100 rounded-[2.5rem] space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
              <item.icon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-gray-900">{item.title}</h4>
              <p className="text-gray-500 text-sm font-medium">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
