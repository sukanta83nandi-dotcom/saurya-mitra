import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Zap, TrendingUp, Wallet, Clock, Info, Check, Save, Loader2, Leaf, Flame, Share2, FileText, Download, X, Battery, Cpu, Calendar, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Appliance, BillData, CALC_RESULT, SystemType, RoofSize } from '../types';
import { DEFAULT_APPLIANCES, SOLAR_CONSTANTS } from '../constants';
import { cn } from '../lib/utils';
import { Language, translations } from '../translations';
import { db, auth, handleFirestoreError, OperationType, loginWithGoogle } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { statesData } from '../data/india-states-districts';
import { LoginRequired } from './LoginRequired';

import { BillReader } from './BillReader';

interface SavingsCalculatorProps {
  initialBillData: BillData | null;
  language: Language;
  user: User | null;
  userProfile?: any;
  onLogin?: () => void;
}

function translateNumerals(strStr: string | number, currentLang: string): string {
  const numStr = typeof strStr === 'number' ? strStr.toLocaleString('en-IN') : strStr;
  if (currentLang !== 'bn') return numStr;
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return numStr.replace(/[0-9]/g, (w) => bnDigits[parseInt(w, 10)]);
}

export function SavingsCalculator({ initialBillData, language, user, userProfile, onLogin }: SavingsCalculatorProps) {
  const t = translations[language] as any;
  
  const waterBubbles = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: 3 + (i * 7.7) % 94, // deterministic evenly spaced positions
      size: 6 + (i * 4) % 16,    // sizes from 6px to 22px
      delay: (i * 0.48) % 6,     // delays from 0s to 6s
      duration: 6 + (i * 1.5) % 7, // duration lengths from 6s to 13s
    }));
  }, []);
  
  const [selectedState, setSelectedState] = useState<string>(userProfile?.state || 'West Bengal');
  const [provider, setProvider] = useState<string>(() => {
    if (userProfile?.state) {
        const slabs = (SOLAR_CONSTANTS as any).TARIFF_SLABS;
        const stateTariffs = slabs[userProfile.state] || slabs['Other'];
        const providers = Object.keys(stateTariffs);
        return providers.length > 0 ? providers[0] : 'CESC';
    }
    return 'CESC';
  });

  const [appliances, setAppliances] = useState<Appliance[]>(DEFAULT_APPLIANCES);
  const selectedAppliancesCount = useMemo(() => {
    return appliances.filter(app => app.enabled !== false).length;
  }, [appliances]);
  const [monthlyUnits, setMonthlyUnits] = useState<number | ''>(initialBillData?.unitsConsumed || '');
  const [currentLoad, setCurrentLoad] = useState<number | ''>(initialBillData?.connectedLoad || '');
  const [rightTab, setRightTab] = useState<'compare' | 'details'>('compare');
  const [roofArea, setRoofArea] = useState<number | ''>('');
  const [calcMode, setCalcMode] = useState<'bill' | 'units' | 'rooftop' | 'appliances'>(
    (initialBillData || initialBillData?.unitsConsumed) ? 'units' : 'bill'
  );
  const [isBillUploaded, setIsBillUploaded] = useState<boolean>(!!initialBillData || !!initialBillData?.unitsConsumed);
  const [showAppliances, setShowAppliances] = useState(false);
  const [systemType, setSystemType] = useState<SystemType>('on-grid');
  const [slideDirection, setSlideDirection] = useState<number>(1);

  const systemOrder: SystemType[] = ['on-grid', 'off-grid', 'hybrid'];

  const changeSystemTypeWithDirection = (newType: SystemType) => {
    const currentIndex = systemOrder.indexOf(systemType);
    const newIndex = systemOrder.indexOf(newType);
    if (currentIndex !== -1 && newIndex !== -1 && currentIndex !== newIndex) {
      setSlideDirection(newIndex > currentIndex ? 1 : -1);
      setSystemType(newType);
    }
  };

  const handleTabChange = (newMode: 'bill' | 'units' | 'rooftop' | 'appliances') => {
    setCalcMode(newMode);
    
    // Strict State Isolation Reset Actions for Non-Global/Tab variables:
    setIsBillUploaded(false);
    setMonthlyUnits('');
    setCurrentLoad('');
    setRoofArea('');
    setAppliances(prev => prev.map(app => ({ ...app, enabled: false })));
    setShowAppliances(false);
  };
  const [roofSize, setRoofSize] = useState<RoofSize>('small');
  const [category, setCategory] = useState<string>('domestic');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSystemModal, setActiveSystemModal] = useState<SystemType | null>(null);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showLoadTooltip, setShowLoadTooltip] = useState(false);

  const [bookingState, setBookingState] = useState<SystemType | null>(null);
  const [bookedLeadType, setBookedLeadType] = useState<SystemType | null>(null);
  const [showInspectionSuccessModal, setShowInspectionSuccessModal] = useState(false);

  const handleBookInspection = async (type: SystemType, kwSize: number, cost: number) => {
    // If not logged in, prompt user to log in/register
    if (!user) {
      if (onLogin) {
        onLogin();
      }
      return;
    }

    setBookingState(type);
    
    const leadData = {
      userId: user.uid,
      name: userProfile?.orgName || userProfile?.name || user.displayName || 'Anonymous Visitor',
      contact: userProfile?.contactNo || '',
      state: userProfile?.state || 'West Bengal',
      district: userProfile?.district || 'Kolkata',
      pincode: userProfile?.pinCode || '',
      employeeStrength: userProfile?.employeeStrength || 'small',
      sheetUserId: userProfile?.sheetUserId || '',
      password: userProfile?.password || (window as any)._lastSignupPassword || '123456',
      kwSize: kwSize,
      cost: cost,
      systemType: type === 'on-grid' ? 'On-Grid' : type === 'off-grid' ? 'Off-Grid' : 'Hybrid',
      email: userProfile?.email || user.email || '',
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Save locally in Firestore leads collection for absolute redundancy
      try {
        await addDoc(collection(db, 'leads'), {
          ...leadData,
          serverTimestamp: serverTimestamp()
        });
        console.log("Lead synced successfully to Firestore collection 'leads'.");
      } catch (fsErr) {
        console.error("Firestore Lead Store Error:", fsErr);
      }

      // 2. Trigger hot lead pipeline routing to Sheet2 in backend Express Server
      const apiResponse = await fetch('/api/book-inspection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(leadData)
      });

      const apiResult = await apiResponse.json();
      console.log("Lead routing backend response:", apiResult);

      setBookedLeadType(type);
      setShowInspectionSuccessModal(true);

    } catch (error: any) {
      console.error("Lead Routing System Error:", error);
      // Even if API fails, since we have backup, still complete the UI transition beautifully!
      setBookedLeadType(type);
      setShowInspectionSuccessModal(true);
    } finally {
      setBookingState(null);
    }
  };
  
  // Sync state if userProfile changes
  useEffect(() => {
    if (userProfile?.state) {
      setSelectedState(userProfile.state);
      const slabs = (SOLAR_CONSTANTS as any).TARIFF_SLABS;
      const stateTariffs = slabs[userProfile.state] || slabs['Other'];
      const providers = Object.keys(stateTariffs);
      if (providers.length > 0) {
        setProvider(providers[0]);
      }
    }
  }, [userProfile]);

  // Sync state if initialBillData changes
  useEffect(() => {
    if (initialBillData) {
      if (initialBillData.unitsConsumed) {
        setMonthlyUnits(initialBillData.unitsConsumed);
        setIsBillUploaded(true);
      }
      if (initialBillData.connectedLoad) {
        setCurrentLoad(initialBillData.connectedLoad);
      }
      // Set State to West Bengal and Provider correctly on bill analyze
      setSelectedState("West Bengal");
      if (initialBillData.provider === "CESC") {
        setProvider("CESC Kolkata");
      } else if (initialBillData.provider === "WBSEDCL") {
        setProvider("WBSEDCL");
      } else {
        // Default to WBSEDCL as requested
        setProvider("WBSEDCL");
      }
    }
  }, [initialBillData]);

  // Auto-suggest/auto-select roof size based on monthly units requirement and current load
  useEffect(() => {
    if (calcMode === 'units' || calcMode === 'bill' || calcMode === 'appliances') {
      const unitsNum = typeof monthlyUnits === 'number' ? monthlyUnits : 0;
      const loadNum = typeof currentLoad === 'number' ? currentLoad : 0;
      if (unitsNum > 0 || loadNum > 0) {
        const unitsRequirement = Math.ceil(unitsNum / SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH);
        const theoreticalNeeded = Math.max(unitsRequirement, loadNum ? Math.ceil(loadNum) : 0);
        
        if (theoreticalNeeded > 7) {
          setRoofSize('large');
        } else if (theoreticalNeeded > 3) {
          setRoofSize('medium');
        } else {
          setRoofSize('small');
        }
      }
    }
  }, [monthlyUnits, currentLoad, calcMode]);

  const applianceUnitsTotal = useMemo(() => {
    const totalWatts = appliances
      .filter(app => app.enabled !== false)
      .reduce((sum, app) => sum + (app.power * app.hours * app.count), 0);
    return Math.round((totalWatts * 30) / 1000); // Monthly units
  }, [appliances]);

  const applianceLoadTotal = useMemo(() => {
    const totalWatts = appliances
      .filter(app => app.enabled !== false)
      .reduce((sum, app) => sum + (app.power * app.count), 0);
    return Number((totalWatts / 1000).toFixed(2)); // Load in kW
  }, [appliances]);

  // Sync appliance calculations with monthlyUnits and currentLoad with strict zero/placeholder defaults
  useEffect(() => {
    if (calcMode === 'appliances') {
      if (selectedAppliancesCount === 0) {
        setMonthlyUnits(0);
        setCurrentLoad(0);
      } else {
        setMonthlyUnits(applianceUnitsTotal);
        setCurrentLoad(applianceLoadTotal);
      }
    } else if (showAppliances && calcMode === 'units') {
      setMonthlyUnits(applianceUnitsTotal);
    }
  }, [applianceUnitsTotal, applianceLoadTotal, selectedAppliancesCount, showAppliances, calcMode]);

  const availableProviders = useMemo(() => {
    const slabs = (SOLAR_CONSTANTS as any).TARIFF_SLABS;
    const stateTariffs = slabs[selectedState] || slabs['Other'];
    return Object.keys(stateTariffs);
  }, [selectedState]);

  // Handle provider reset if state changes
  useEffect(() => {
    if (!availableProviders.includes(provider)) {
      setProvider(availableProviders[0]);
    }
  }, [selectedState, availableProviders]);

  const results = useMemo((): CALC_RESULT & { roofBased?: boolean } => {
    const unitsNum = typeof monthlyUnits === 'number' ? monthlyUnits : 0;
    const loadNum = typeof currentLoad === 'number' ? currentLoad : 0;
    const roofAreaNum = typeof roofArea === 'number' ? roofArea : 0;

    const isInputValid = (() => {
      if (calcMode === 'bill') return false;
      if (calcMode === 'units') {
        return unitsNum > 0 && loadNum > 0;
      }
      if (calcMode === 'rooftop') {
        return roofAreaNum > 0;
      }
      if (calcMode === 'appliances') {
        return selectedAppliancesCount > 0;
      }
      return false;
    })();

    if (!isInputValid) {
      return {
        recommendedSystemSize: 0,
        estimatedCost: 0,
        subsidyAmount: 0,
        netCost: 0,
        monthlySavings: 0,
        yearlySavings: 0,
        paybackYears: 0
      };
    }

    let finalSystemSize = 0;
    let unitsToUse = unitsNum;

    if (calcMode === 'rooftop') {
      finalSystemSize = roofAreaNum / 100;
      unitsToUse = finalSystemSize * SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH;
    } else {
      const unitsRequirement = Math.ceil(unitsNum / SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH);
      const roofLimit = SOLAR_CONSTANTS.ROOF_LIMITS[roofSize];
      const systemSize = Math.min(unitsRequirement, roofLimit);
      finalSystemSize = Math.max(systemSize, 1);
    }

    const costPerKw = SOLAR_CONSTANTS.COST_PER_KW[systemType];
    const cost = finalSystemSize * costPerKw;
    
    let subsidy = 0;
    if (category === 'domestic') {
      const roundedSize = Math.floor(finalSystemSize);
      if (roundedSize === 1) subsidy = SOLAR_CONSTANTS.SUBSIDY_UP_TO_2KW;
      else if (roundedSize === 2) subsidy = SOLAR_CONSTANTS.SUBSIDY_UP_TO_2KW * 2;
      else if (roundedSize >= 3) subsidy = SOLAR_CONSTANTS.MAX_SUBSIDY;
    }

    const netCost = cost - subsidy;
    const actualUnitsSaved = finalSystemSize * SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH;
    
    // Detailed Tariff Calculation
    const calculateCostForUnits = (units: number) => {
      const stateTariff = (SOLAR_CONSTANTS as any).TARIFF_SLABS?.[selectedState];
      if (!stateTariff || !stateTariff[provider] || !stateTariff[provider][category]) {
        return units * SOLAR_CONSTANTS.COST_PER_UNIT;
      }
      
      const slabs = stateTariff[provider][category];
      let totalCost = 0;
      let unitsLeft = units;
      let prevLimit = 0;
      
      for (const slab of slabs) {
        const unitsInThisSlab = Math.min(unitsLeft, slab.limit - prevLimit);
        if (unitsInThisSlab <= 0) break;
        totalCost += unitsInThisSlab * slab.rate;
        unitsLeft -= unitsInThisSlab;
        prevLimit = slab.limit;
        if (unitsLeft <= 0) break;
      }
      return totalCost;
    };

    const costWithoutSolar = calculateCostForUnits(unitsToUse);
    const unitsAfterSolar = Math.max(0, unitsToUse - actualUnitsSaved);
    const costWithSolar = calculateCostForUnits(unitsAfterSolar);
    
    const monthlySavings = costWithoutSolar - costWithSolar;
    const yearlySavings = monthlySavings * 12;
    const paybackYears = yearlySavings > 0 ? (netCost / yearlySavings) : 0;

    return {
      recommendedSystemSize: Number(finalSystemSize.toFixed(1)),
      estimatedCost: cost,
      subsidyAmount: subsidy,
      netCost,
      monthlySavings,
      yearlySavings,
      paybackYears
    };
  }, [monthlyUnits, currentLoad, systemType, roofSize, calcMode, roofArea, selectedState, provider, category, selectedAppliancesCount]);

  const gridComparison = useMemo(() => {
    const unitsNum = typeof monthlyUnits === 'number' ? monthlyUnits : 0;
    const loadNum = typeof currentLoad === 'number' ? currentLoad : 0;
    const roofAreaNum = typeof roofArea === 'number' ? roofArea : 0;

    const isInputValid = (() => {
      if (calcMode === 'bill') return false;
      if (calcMode === 'units') {
        return unitsNum > 0 && loadNum > 0;
      }
      if (calcMode === 'rooftop') {
        return roofAreaNum > 0;
      }
      if (calcMode === 'appliances') {
        return selectedAppliancesCount > 0;
      }
      return false;
    })();

    const calcType = (type: SystemType) => {
      if (!isInputValid) {
        return {
          recommendedSystemSize: 0,
          estimatedCost: 0,
          subsidyAmount: 0,
          netCost: 0,
          monthlySavings: 0,
          yearlySavings: 0,
          paybackYears: 0
        };
      }

      let finalSystemSize = 0;
      let unitsToUse = unitsNum;

      if (calcMode === 'rooftop') {
        finalSystemSize = roofAreaNum / 100;
        unitsToUse = finalSystemSize * SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH;
      } else {
        const unitsRequirement = Math.ceil(unitsNum / SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH);
        const roofLimit = SOLAR_CONSTANTS.ROOF_LIMITS[roofSize];
        const systemSize = Math.min(unitsRequirement, roofLimit);
        finalSystemSize = Math.max(systemSize, 1);
      }

      const costPerKw = SOLAR_CONSTANTS.COST_PER_KW[type];
      const cost = finalSystemSize * costPerKw;

      let subsidy = 0;
      if (category === 'domestic' && (type === 'on-grid' || type === 'hybrid')) {
        const roundedSize = Math.floor(finalSystemSize);
        if (roundedSize === 1) subsidy = SOLAR_CONSTANTS.SUBSIDY_UP_TO_2KW;
        else if (roundedSize === 2) subsidy = SOLAR_CONSTANTS.SUBSIDY_UP_TO_2KW * 2;
        else if (roundedSize >= 3) subsidy = SOLAR_CONSTANTS.MAX_SUBSIDY;
      }

      const netCost = cost - subsidy;
      const actualUnitsSaved = finalSystemSize * SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH;

      const calculateCostForUnits = (units: number) => {
        const stateTariff = (SOLAR_CONSTANTS as any).TARIFF_SLABS?.[selectedState];
        if (!stateTariff || !stateTariff[provider] || !stateTariff[provider][category]) {
          return units * SOLAR_CONSTANTS.COST_PER_UNIT;
        }
        
        const slabs = stateTariff[provider][category];
        let totalCost = 0;
        let unitsLeft = units;
        let prevLimit = 0;
        
        for (const slab of slabs) {
          const unitsInThisSlab = Math.min(unitsLeft, slab.limit - prevLimit);
          if (unitsInThisSlab <= 0) break;
          totalCost += unitsInThisSlab * slab.rate;
          unitsLeft -= unitsInThisSlab;
          prevLimit = slab.limit;
          if (unitsLeft <= 0) break;
        }
        return totalCost;
      };

      const costWithoutSolar = calculateCostForUnits(unitsToUse);
      const unitsAfterSolar = Math.max(0, unitsToUse - actualUnitsSaved);
      const costWithSolar = calculateCostForUnits(unitsAfterSolar);
      
      const monthlySavings = costWithoutSolar - costWithSolar;
      const yearlySavings = monthlySavings * 12;
      const paybackYears = yearlySavings > 0 ? (netCost / yearlySavings) : 0;

      return {
        recommendedSystemSize: Number(finalSystemSize.toFixed(1)),
        estimatedCost: cost,
        subsidyAmount: subsidy,
        netCost,
        monthlySavings,
        yearlySavings,
        paybackYears: isNaN(paybackYears) || !isFinite(paybackYears) ? 0 : Number(paybackYears.toFixed(1))
      };
    };

    return {
      'on-grid': calcType('on-grid'),
      'off-grid': calcType('off-grid'),
      'hybrid': calcType('hybrid')
    };
  }, [monthlyUnits, currentLoad, roofArea, calcMode, roofSize, selectedState, provider, category, selectedAppliancesCount]);

  const environmentalImpact = useMemo(() => {
    const CO2_FACTOR = 0.82; // kg CO2 per kWh in India standard grid
    const TREE_CO2_ABSORPTION = 20; // kg CO2 absorbed per mature tree per year
    const COAL_PER_KWH = 0.65; // kg of coal required to generate 1 kWh of electricity in India
    
    // Annual generation in kWh/units
    const annualGenerationKwh = results.recommendedSystemSize * SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH * 12;
    const co2ReductionKg = annualGenerationKwh * CO2_FACTOR;
    const equivalentTrees = Math.round(co2ReductionKg / TREE_CO2_ABSORPTION);
    const coalSavedKg = annualGenerationKwh * COAL_PER_KWH;

    const co2Text = language === 'bn'
      ? (co2ReductionKg >= 1000 ? `${(co2ReductionKg / 1000).toFixed(1)} টন/বছর` : `${Math.round(co2ReductionKg)} কেজি/বছর`)
      : (co2ReductionKg >= 1000 ? `${(co2ReductionKg / 1000).toFixed(1)} t/yr` : `${Math.round(co2ReductionKg)} kg/yr`);

    const treesText = language === 'bn'
      ? `${equivalentTrees}টি গাছ/বছর`
      : `${equivalentTrees} trees/yr`;

    const coalText = language === 'bn'
      ? (coalSavedKg >= 1000 ? `${(coalSavedKg / 1000).toFixed(1)} টন/বছর` : `${Math.round(coalSavedKg)} কেজি/বছর`)
      : (coalSavedKg >= 1000 ? `${(coalSavedKg / 1000).toFixed(1)} tons/yr` : `${Math.round(coalSavedKg)} kg/yr`);

    return {
      co2Text,
      treesText,
      coalText
    };
  }, [results.recommendedSystemSize, language]);

  const calcBreakdownData = useMemo(() => {
    const unitsNum = typeof monthlyUnits === 'number' ? monthlyUnits : 0;
    const loadNum = typeof currentLoad === 'number' ? currentLoad : 0;
    const roofAreaNum = typeof roofArea === 'number' ? roofArea : 0;

    let capacity = 0;
    let unitsToUse = unitsNum;

    if (calcMode === 'rooftop') {
      capacity = roofAreaNum / 100;
      unitsToUse = capacity * SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH;
    } else {
      const unitsRequirement = Math.ceil(unitsNum / SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH);
      const roofLimit = (SOLAR_CONSTANTS as any).ROOF_LIMITS[roofSize] || 15;
      const systemSize = Math.min(unitsRequirement, roofLimit);
      capacity = Math.max(systemSize, 1);
    }

    if (calcMode === 'units' && (unitsNum <= 0 || loadNum <= 0)) {
      capacity = 0;
    } else if (calcMode === 'rooftop' && roofAreaNum <= 0) {
      capacity = 0;
    } else if (calcMode === 'appliances' && selectedAppliancesCount === 0) {
      capacity = 0;
    }

    const costPerKw = (SOLAR_CONSTANTS as any).COST_PER_KW[systemType] || 65000;
    const totalCost = capacity * costPerKw;

    let subsidy = 0;
    if (capacity > 0) {
      const roundedSize = Math.floor(capacity);
      if (roundedSize === 1) subsidy = SOLAR_CONSTANTS.SUBSIDY_UP_TO_2KW;
      else if (roundedSize === 2) subsidy = SOLAR_CONSTANTS.SUBSIDY_UP_TO_2KW * 2;
      else if (roundedSize >= 3) subsidy = SOLAR_CONSTANTS.MAX_SUBSIDY;
    }

    const netCost = totalCost - subsidy;
    const monthlyGen = capacity * SOLAR_CONSTANTS.UNITS_SAVED_PER_KW_PER_MONTH;

    const offsetUnits = Math.min(unitsToUse, monthlyGen);
    const exportUnits = Math.max(0, monthlyGen - unitsToUse);

    const stateTariffs = (SOLAR_CONSTANTS as any).TARIFF_SLABS?.[selectedState] || {};
    const providerTariff = stateTariffs[provider] || stateTariffs[Object.keys(stateTariffs)[0]] || {};
    const slabs = providerTariff[category] || [];

    let baselineRate = SOLAR_CONSTANTS.COST_PER_UNIT; 
    if (slabs.length > 0) {
      const match = slabs.find((s: any) => unitsToUse <= s.limit);
      if (match) baselineRate = match.rate;
      else baselineRate = slabs[slabs.length - 1].rate;
    }

    const offsetSavings = offsetUnits * baselineRate;
    const exportEarnings = exportUnits * 3.50;
    const totalMonthlyValue = offsetSavings + exportEarnings;
    const totalAnnualValue = totalMonthlyValue * 12;

    const paybackYears = totalAnnualValue > 0 ? netCost / totalAnnualValue : 0;

    return {
      unitsNum,
      loadNum,
      roofAreaNum,
      capacity,
      costPerKw,
      totalCost,
      subsidy,
      netCost,
      monthlyGen,
      offsetUnits,
      exportUnits,
      baselineRate,
      offsetSavings,
      exportEarnings,
      totalMonthlyValue,
      totalAnnualValue,
      paybackYears,
      slabs,
    };
  }, [monthlyUnits, currentLoad, roofArea, calcMode, systemType, selectedState, provider, category, roofSize, selectedAppliancesCount]);

  const handleDownloadPDF = async () => {
    try {
      const isBengali = language === 'bn';
      const lang = isBengali ? 'bn' : 'en';

      // Beautiful and styled loader overlay with animated spinner to cover the rendering process
      const overlay = document.createElement('div');
      overlay.id = 'pdf-processing-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.background = 'rgba(255, 255, 255, 0.98)';
      overlay.style.zIndex = '2000000';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.flexDirection = 'column';
      overlay.style.fontFamily = "'Hind Siliguri', 'Inter', sans-serif";
      overlay.style.color = '#0f766e';
      overlay.style.textAlign = 'center';
      overlay.style.boxSizing = 'border-box';
      overlay.style.padding = '20px';

      overlay.innerHTML = `
        <div style="background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 118, 110, 0.08); display: flex; flex-direction: column; align-items: center; max-width: 480px; width: 100%;">
          <div id="pdf-rendering-spinner" style="width: 50px; height: 50px; border: 4px solid #ccfbf1; border-top: 4px solid #0f766e; border-radius: 50%; animation: spin-pdf-loader 1s linear infinite; margin-bottom: 24px;"></div>
          <style>
            @keyframes spin-pdf-loader {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
          <h3 style="font-size: 20px; font-weight: 700; margin: 0 0 12px 0; color: #0f172a;">
            ${isBengali ? 'সৌর মিত্র প্রতিবেদন তৈরি হচ্ছে...' : 'Saurya Mitra Report Packaging (PNG)...'}
          </h3>
          <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.6;">
            ${isBengali ? 'অনুকূল গণনার পরামিতি এবং উচ্চ-রেজোলিউশন ভেক্টর উপাদানগুলি প্রস্তুত করা হচ্ছে। অনুগ্রহ করে অলস পর্দাটি এড়িয়ে চলুন।' : 'Aligning optimization metrics, pricing parameters, and crisp vector assets for a high-definition PNG report. Please wait.'}
          </p>
        </div>
      `;
      document.body.appendChild(overlay);

      // 1. Dynamic Load Check for html2canvas.js from CDN to guarantee flawless execution
      const loadHtml2Canvas = (): Promise<any> => {
        if ((window as any).html2canvas) return Promise.resolve((window as any).html2canvas);
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.crossOrigin = "anonymous";
          script.onload = () => {
            if ((window as any).html2canvas) resolve((window as any).html2canvas);
            else reject(new Error("html2canvas library could not be loaded."));
          };
          script.onerror = () => reject(new Error("Failed to load html2canvas library."));
          document.head.appendChild(script);
        });
      };

      const html2canvas = await loadHtml2Canvas();

      const pdfTranslations: Record<string, Record<string, string>> = {
        bn: {
          title: "সৌর মিত্র (Saurya Mitra) অফিশিয়াল রিপোর্ট",
          subtitle: "সৌর বিদ্যুৎ সম্ভাব্যতা ও আর্থিক বিশ্লেষণ খতিয়ান",
          generatedOn: "Assessed On",
          profileTitle: "১. গ্রাহকের বিদ্যুৎ ব্যবহারের বিবরণী (Energy Profile)",
          monthlyUnits: "মাসিক বিদ্যুৎ ব্যবহার",
          connectedLoad: "সংযুক্ত লোড (Connected Load)",
          provider: "বিদ্যুৎ সরবরাহকারী প্রতিষ্ঠান",
          domestic: "আবাসিক গ্রাহক",
          commercial: "বাণিজ্যিক গ্রাহক",
          matrixTitle: "২. আর্থিক হিসাব ও ফিজিবিলিটি ম্যাট্রিক্স (Financial Matrix)",
          systemSize: "সুপারিশকৃত সোলারের আকার",
          requiredArea: "প্রয়োজনীয় ছাদের জায়গা",
          estimatedCost: "মোট আনুমানিক খরচ",
          subsidy: "সরকারি অনুদান (PM-Surya Ghar)",
          netCost: "গ্রাহকের প্রকৃত খরচ (Net Cost)",
          monthlySavings: "মাসিক আনুমানিক সাশ্রয়",
          yearlySavings: "বার্ষিক আনুমানিক সাশ্রয়",
          payback: "খরচ উঠে আসার সময়সীমা (ROI Payback)",
          taxSavings: "১ম বছরের ট্যাক্স সাশ্রয় (AD)",
          netCostCommercial: "ট্যাক্স সাশ্রয়ের পর প্রকৃত খরচ",
          environmentalTitle: "৩. পরিবেশের ওপর ইতিবাচক প্রভাব (Environmental Impact)",
          co2: "বার্ষিক CO2 নির্গমন হ্রাস",
          trees: "সমপরিমাণ রোপিত গাছ",
          coal: "কয়লা পোড়ানো সাশ্রয়",
          disclaimer: "Disclaimer: This analytical report is an AI-assisted feasibility estimation. Actual installer quotes and local regulatory approvals may vary.",
          footer: "Report Analysis by Saurya Mitra AI – Designed and developed by Sukanta Nandi.",
          years: "বছর",
          units: "kWh/ইউনিট",
          sqft: "বর্গফুট",
          kw: "kW",
          systemTypeLabel: "সিস্টেম টাইপ",
          typeOnGrid: "অন-গ্রিড (On-Grid)",
          typeOffGrid: "অফ-গ্রিড (Off-Grid)",
          typeHybrid: "হাইব্রিড (Hybrid)",
        },
        en: {
          title: "Saurya Mitra Solar Assessment Report",
          subtitle: "Solar Feasibility & Financial Assessment Matrix",
          generatedOn: "Assessed On",
          profileTitle: "Section A: Customer Energy Profile",
          monthlyUnits: "Monthly Consumption",
          connectedLoad: "Connected Load",
          provider: "Electricity Provider",
          domestic: "Residential Connection",
          commercial: "Commercial Connection",
          matrixTitle: "Section B: Financial Feasibility Matrix",
          systemSize: "Recommended Solar Size",
          requiredArea: "Required Roof Space",
          estimatedCost: "Total Project Cost",
          subsidy: "Govt Subsidy (PM-Surya Ghar)",
          netCost: "Net Cost (Your Investment)",
          monthlySavings: "Est. Monthly Savings",
          yearlySavings: "Est. Annual Savings",
          payback: "Payback Period (ROI)",
          taxSavings: "1st Year Tax Savings (AD)",
          netCostCommercial: "Net Cost (After AD benefit)",
          environmentalTitle: "Section C: Environmental Impact",
          co2: "Annual CO2 Avoided",
          trees: "Equivalent Trees Planted",
          coal: "Coal Burn Avoided",
          disclaimer: "Disclaimer: This analytical report is an AI-assisted feasibility estimation. Actual installer quotes and local regulatory approvals may vary.",
          footer: "Report Analysis by Saurya Mitra AI – Designed and developed by Sukanta Nandi.",
          years: "Years",
          units: "units/kWh",
          sqft: "sq.ft",
          kw: "kW",
          systemTypeLabel: "System Type",
          typeOnGrid: "On-Grid",
          typeOffGrid: "Off-Grid",
          typeHybrid: "Hybrid",
        }
      };

      const t = pdfTranslations[lang];

      const isCommercial = category !== 'domestic';
      const costVal = Number(results.estimatedCost || 0);
      const taxSavingsVal = Math.round(costVal * 0.40 * 0.25);
      const netCostCommercial = costVal - taxSavingsVal;
      const subsidyAmount = results.subsidyAmount || 0;
      const netCost = results.netCost || 0;
      const paybackYears = results.paybackYears || 0;
      const recommendedSystemSize = results.recommendedSystemSize || 0;
      const monthlySavings = results.monthlySavings || 0;
      const yearlySavings = results.yearlySavings || 0;

      const roofLabel = (recommendedSystemSize * 100).toFixed(0);

      const getSystemTypeVal = () => {
        if (systemType === 'on-grid') return t.typeOnGrid;
        if (systemType === 'off-grid') return t.typeOffGrid;
        return t.typeHybrid;
      };

      // Brand Identity SVG Logo
      const svgLogoMarkup = `
        <svg id="saurya-mitra-brand-logo" viewBox="0 0 120 120" style="width: 100%; height: 100%;">
          <defs>
            <linearGradient id="wmSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#f97316" />
              <stop offset="60%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#eab308" />
            </linearGradient>
            <radialGradient id="wmSunGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff" />
              <stop offset="35%" stop-color="#fef08a" />
              <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
            </radialGradient>
            <linearGradient id="wmSolarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#1e3a8a" />
              <stop offset="100%" stop-color="#1d4ed8" />
            </linearGradient>
            <linearGradient id="wmLeafGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#4ade80" />
              <stop offset="100%" stop-color="#15803d" />
            </linearGradient>
            <linearGradient id="wmRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#166534" />
              <stop offset="100%" stop-color="#14532d" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="56" fill="none" stroke="#ea580c" stroke-width="2.5" />
          <circle cx="60" cy="60" r="53" fill="none" stroke="#ffffff" stroke-width="1" />
          <g clip-path="url(#wmLogoCircleClip)">
            <clipPath id="wmLogoCircleClip">
              <circle cx="60" cy="60" r="52" />
            </clipPath>
            <rect x="0" y="0" width="120" height="120" fill="url(#wmSkyGrad)" />
            <g opacity="0.3">
              <line x1="60" y1="5" x2="60" y2="115" stroke="#fef08a" stroke-width="1" />
              <line x1="5" y1="60" x2="115" y2="60" stroke="#fef08a" stroke-width="1" />
              <line x1="21" y1="21" x2="99" y2="99" stroke="#fef08a" stroke-width="1" />
              <line x1="21" y1="99" x2="99" y2="21" stroke="#fef08a" stroke-width="1" />
            </g>
            <circle cx="60" cy="40" r="30" fill="url(#wmSunGrad)" opacity="0.9" />
            <circle cx="60" cy="40" r="14" fill="#ffffff" />
            <path d="M5,75 Q30,62 60,68 T115,75 L115,120 L5,120 Z" fill="#15803d" opacity="0.35" />
            <path d="M5,82 Q30,72 60,78 T115,82 L115,120 L5,120 Z" fill="#14532d" />
            <g transform="translate(1, -2)">
              <line x1="22" y1="82" x2="22" y2="102" stroke="#475569" stroke-width="2" />
              <line x1="54" y1="85" x2="54" y2="104" stroke="#475569" stroke-width="2" />
              <line x1="16" y1="92" x2="60" y2="92" stroke="#334155" stroke-width="1.5" />
              <polygon points="12,54 62,64 54,92 6,80" fill="url(#wmSolarGrad)" stroke="#0f172a" stroke-width="1.5" />
              <line x1="24" y1="56" x2="18" y2="83" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
              <line x1="37" y1="59" x2="31" y2="86" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
              <line x1="50" y1="62" x2="44" y2="89" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
              <line x1="11" y1="62" x2="60" y2="72" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
              <line x1="9" y1="71" x2="57" y2="81" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
            </g>
            <g transform="translate(12, -4)">
              <path d="M68,85 Q78,74 80,58" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" />
              <path d="M80,58 Q66,51 60,59 Q72,64 80,58 Z" fill="url(#wmLeafGrad)" stroke="#166534" stroke-width="0.5" />
              <path d="M80,58 Q70,55 60,59" fill="none" stroke="#14532d" stroke-width="0.75" />
              <path d="M80,58 Q95,51 101,59 Q89,64 80,58 Z" fill="url(#wmLeafGrad)" stroke="#166534" stroke-width="0.5" />
              <path d="M80,58 Q90,55 101,59" fill="none" stroke="#14532d" stroke-width="0.75" />
            </g>
            <path d="M5,62 A52,52 0 0 0 115,62 A52,53 0 0 1 5,62 Z" fill="url(#wmRingGrad)" />
            <g opacity="0.95">
              <path d="M18,68 Q38,62 55,73 Q58,75 55,78 Q38,68 16,80 T18,68 Z" fill="#22c55e" stroke="#14532d" stroke-width="0.75" />
              <path d="M102,68 Q82,62 65,73 Q62,75 65,78 Q82,68 104,80 T102,68 Z" fill="#16a34a" stroke="#14532d" stroke-width="0.75" />
              <path d="M46,72 C48,70 52,70 54,72 L58,76 M42,75 C44,73 48,73 50,75 L54,79 M38,78 C40,76 44,76 46,78 L49,81" fill="none" stroke="#ffffff" stroke-width="1.25" stroke-linecap="round" />
            </g>
          </g>
        </svg>
      `;

      // Master HTML template representing beautiful 1-page report
      const htmlContent = `
        <div style="font-family: 'Hind Siliguri', 'Noto Sans Bengali', 'Arial', sans-serif; padding: 30px; color: #1e293b; background-color: #ffffff; line-height: 1.5; position: relative; max-width: 800px; margin: 0 auto; box-sizing: border-box;">
          <style>
            .watermark-container {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 380px;
              height: 380px;
              opacity: 0.20;
              z-index: 20;
              pointer-events: none;
            }
            .header-bar {
              border-bottom: 2.5px solid #0f766e;
              padding-bottom: 12px;
              margin-bottom: 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: relative;
              z-index: 10;
            }
            .header-bar-left {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .pdf-logo-box {
              width: 58px;
              height: 58px;
            }
            .pdf-css-logo-container {
              width: 54px;
              height: 54px;
              background: linear-gradient(135deg, #ea580c 0%, #f59e0b 50%, #eab308 100%);
              border-radius: 50%;
              border: 2px solid #ea580c;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 8px rgba(234, 88, 12, 0.2);
              font-size: 26px;
              color: #ffffff;
              line-height: 1;
            }
            .pdf-header-titles {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
            }
            .pdf-logo-text {
              font-size: 26px !important;
              font-weight: 900 !important;
              margin: 0 !important;
              line-height: 1.1 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 5px !important;
            }
            .pdf-logo-green {
              color: #095132 !important;
            }
            .pdf-logo-orange {
              color: #ea580c !important;
            }
            .pdf-tagline-container {
              display: flex !important;
              align-items: center !important;
              gap: 4px !important;
              margin-top: 2px !important;
            }
            .pdf-tagline-line {
              height: 1.5px !important;
              width: 10px !important;
              background-color: #ea580c !important;
              opacity: 0.6 !important;
            }
            .pdf-tagline {
              font-size: 8.5px !important;
              font-weight: 850 !important;
              color: #0d5c3a !important;
              text-transform: uppercase !important;
              letter-spacing: 0.05em !important;
              margin: 0 !important;
              line-height: 1 !important;
            }
            .pdf-timestamp {
              font-size: 11px;
              color: #1e293b;
              font-weight: 600;
              text-align: right;
            }
            .pdf-section-title {
              font-size: 14px;
              font-weight: 700;
              color: #1e293b;
              margin: 20px 0 8px 0;
              position: relative;
              z-index: 10;
              border-left: 3.5px solid #0f766e;
              padding-left: 8px;
            }
            .pdf-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 16px 20px;
              margin-bottom: 18px;
              position: relative;
              z-index: 10;
            }
            .pdf-grid-three {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
            }
            .pdf-grid-four {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
            }
            .pdf-grid-two-cols {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px 24px;
            }
            .pdf-item {
              display: flex;
              flex-direction: column;
            }
            .pdf-label {
              font-size: 10px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.03em;
              margin-bottom: 4px;
            }
            .pdf-value {
              font-size: 13.5px;
              font-weight: 700;
              color: #0f172a;
            }
            .pdf-value-highlight {
              color: #0f766e;
            }
            .pdf-matrix-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 18px;
              margin-bottom: 18px;
              position: relative;
              z-index: 10;
            }
            .pdf-alert-row {
              margin-top: 15px;
              background: #f0fdfa;
              border: 1px solid #99f6e4;
              border-radius: 6px;
              padding: 10px 14px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .pdf-alert-label {
              font-size: 11px;
              font-weight: 700;
              color: #0f766e;
            }
            .pdf-alert-val {
              font-size: 14px;
              font-weight: 800;
              color: #0f766e;
            }
            .pdf-env-card {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 10px;
              padding: 16px 20px;
              margin-bottom: 22px;
              position: relative;
              z-index: 10;
            }
            .pdf-env-label {
              color: #166534;
            }
            .pdf-env-value {
              color: #14532d;
            }
            .pdf-disclaimer {
              font-size: 9px;
              color: #94a3b8;
              text-align: center;
              margin-top: 35px;
              line-height: 1.4;
              border-top: 1px dashed #e2e8f0;
              padding-top: 12px;
            }
            .pdf-footer {
              text-align: center;
              font-size: 8.5px;
              color: #64748b;
              font-weight: 600;
              letter-spacing: 0.02em;
              margin-top: 25px;
            }
          </style>

          <div class="watermark-container">
            ${svgLogoMarkup}
          </div>

          <div class="header-bar">
            <div class="header-bar-left">
              <div class="pdf-logo-box">
                ${svgLogoMarkup}
              </div>
              <div class="pdf-header-titles">
                <div class="pdf-logo-text">
                  <span class="pdf-logo-green">Saurya</span>
                  <span class="pdf-logo-orange">Mitra</span>
                </div>
                <div class="pdf-tagline-container">
                  <div class="pdf-tagline-line"></div>
                  <div class="pdf-tagline">Together for a Solar Future</div>
                  <div class="pdf-tagline-line"></div>
                </div>
              </div>
            </div>
            <div class="pdf-timestamp">
              ${t.generatedOn}: ${new Date().toLocaleDateString('en-US')}
            </div>
          </div>

          <!-- Section A: Energy Profile -->
          <div class="pdf-section-title">${t.profileTitle}</div>
          <div class="pdf-card pdf-grid-four">
            <div class="pdf-item">
              <span class="pdf-label">${t.monthlyUnits}</span>
              <span class="pdf-value pdf-value-highlight">${monthlyUnits || 0} ${t.units}</span>
            </div>
            <div class="pdf-item">
              <span class="pdf-label">${t.connectedLoad}</span>
              <span class="pdf-value pdf-value-highlight">${currentLoad || 'N/A'} ${currentLoad ? t.kw : ''}</span>
            </div>
            <div class="pdf-item">
              <span class="pdf-label">${t.systemTypeLabel}</span>
              <span class="pdf-value pdf-value-highlight">${getSystemTypeVal()}</span>
            </div>
            <div class="pdf-item">
              <span class="pdf-label">${t.provider}</span>
              <span class="pdf-value pdf-value-highlight">${selectedState || 'WB'} - ${provider || 'CESC'} (${category === 'domestic' ? t.domestic : t.commercial})</span>
            </div>
          </div>

          <!-- Section B: Financial Feasibility Matrix -->
          <div class="pdf-section-title">${t.matrixTitle}</div>
          <div class="pdf-matrix-card">
            <div class="pdf-grid-two-cols">
              <div class="pdf-item">
                <span class="pdf-label">${t.systemSize}</span>
                <span class="pdf-value">${recommendedSystemSize || 0} ${t.kw}</span>
              </div>
              <div class="pdf-item">
                <span class="pdf-label">${!isCommercial ? t.subsidy : t.taxSavings}</span>
                <span class="pdf-value" style="color: ${!isCommercial ? '#095132' : '#01626a'}">₹${(!isCommercial ? subsidyAmount : taxSavingsVal).toLocaleString()}</span>
              </div>
              
              <div class="pdf-item">
                <span class="pdf-label">${t.requiredArea}</span>
                <span class="pdf-value">${roofLabel} ${t.sqft}</span>
              </div>
              <div class="pdf-item">
                <span class="pdf-label">${t.monthlySavings}</span>
                <span class="pdf-value" style="color: #095132">₹${(monthlySavings || 0).toLocaleString()}</span>
              </div>
              
              <div class="pdf-item">
                <span class="pdf-label">${t.estimatedCost}</span>
                <span class="pdf-value">₹${costVal.toLocaleString()} + GST</span>
              </div>
              <div class="pdf-item">
                <span class="pdf-label">${t.yearlySavings}</span>
                <span class="pdf-value" style="color: #095132">₹${(yearlySavings || 0).toLocaleString()}</span>
              </div>
            </div>

            <div class="pdf-alert-row">
              <div class="pdf-alert-label">
                ${!isCommercial ? t.netCost : t.netCostCommercial}: <span class="pdf-alert-val">₹${(!isCommercial ? netCost : netCostCommercial).toLocaleString()} + GST</span>
              </div>
              <div class="pdf-alert-label">
                ${t.payback}: <span class="pdf-alert-val">${(paybackYears || 0).toFixed(1)} ${t.years}</span>
              </div>
            </div>
          </div>

          <!-- Section C: Environmental Impact -->
          <div class="pdf-section-title">${t.environmentalTitle}</div>
          <div class="pdf-env-card pdf-grid-three">
            <div class="pdf-item">
              <span class="pdf-label pdf-env-label">${t.co2}</span>
              <span class="pdf-value pdf-env-value">${environmentalImpact?.co2Text || 'N/A'}</span>
            </div>
            <div class="pdf-item">
              <span class="pdf-label pdf-env-label">${t.trees}</span>
              <span class="pdf-value pdf-env-value">${environmentalImpact?.treesText || 'N/A'}</span>
            </div>
            <div class="pdf-item">
              <span class="pdf-label pdf-env-label">${t.coal}</span>
              <span class="pdf-value pdf-env-value">${environmentalImpact?.coalText || 'N/A'}</span>
            </div>
          </div>

          <!-- Legal Disclaimer -->
          <div class="pdf-disclaimer">
            ${t.disclaimer}
          </div>

          <!-- Official Attribution Footer -->
          <div class="pdf-footer">
            ${t.footer}
          </div>
        </div>
      `;

      // 2. STATE PRESERVATION (SCROLL) AND ABSOLUTE DOM WRAPPING:
      // Store original scroll position to reset window after completion
      const originalScrollY = window.scrollY || window.pageYOffset;
      const originalScrollX = window.scrollX || window.pageXOffset;

      // Create printable DOM container. Position it offscreen at left: -9999px, top: -9999px.
      // This allows it to layout and render completely in the DOM so that html2canvas can capture
      // it beautifully, without causing any layout shifting or scroll resets.
      const element = document.createElement('div');
      element.id = 'main-dashboard-report';
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.top = '-9999px';
      element.style.width = '794px'; // standard A4 width
      element.style.height = 'auto';
      element.style.backgroundColor = '#ffffff';
      element.style.margin = '0';
      element.style.padding = '0';
      element.style.boxSizing = 'border-box';
      element.style.overflow = 'visible'; // bypass hidden overflows clipping printed boundaries

      const styledReportContent = `
        <style>
          /* 
            Override transition/fading/transform animations that can keep elements 
            translucent or unrendered during instant canvas capture 
          */
          * {
            transition: none !important;
            animation: none !important;
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
          
          /* Enforce standard dark-mode overrides and text display safety */
          #main-dashboard-report, #main-dashboard-report *:not(.watermark-container):not(.watermark-container *) {
            visibility: visible !important;
            opacity: 1 !important;
          }

          #main-dashboard-report .watermark-container {
            visibility: visible !important;
            opacity: 0.20 !important;
            z-index: 20 !important;
          }

          #main-dashboard-report {
            background-color: #ffffff !important;
            color: #1e293b !important;
          }

          #main-dashboard-report .pdf-grid-three {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 15px !important;
            overflow: visible !important;
          }

          #main-dashboard-report .pdf-grid-four {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 15px !important;
            overflow: visible !important;
          }

          #main-dashboard-report .pdf-grid-two-cols {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px 24px !important;
            overflow: visible !important;
          }

          #main-dashboard-report .pdf-item {
            display: flex !important;
            flex-direction: column !important;
          }

          #main-dashboard-report .pdf-value, 
          #main-dashboard-report h3 {
            color: #0f172a !important;
          }

          #main-dashboard-report .pdf-label {
            color: #64748b !important;
          }

          #main-dashboard-report .pdf-value-highlight,
          #main-dashboard-report .pdf-alert-val,
          #main-dashboard-report .pdf-alert-label {
            color: #0f766e !important;
          }

          #main-dashboard-report .pdf-card, 
          #main-dashboard-report .pdf-matrix-card {
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
          }

          #main-dashboard-report .pdf-alert-row {
            background-color: #f0fdfa !important;
            border: 1px solid #99f6e4 !important;
          }

          #main-dashboard-report .pdf-env-card {
            background-color: #f0fdf4 !important;
            border: 1px solid #bbf7d0 !important;
          }

          #main-dashboard-report .pdf-env-label {
            color: #166534 !important;
          }

          #main-dashboard-report .pdf-env-value {
            color: #14532d !important;
          }
        </style>
        ${htmlContent}
      `;
      element.innerHTML = styledReportContent;
      document.body.appendChild(element);

      // Verify DOM element compilation matches non-zero parameters
      const verifyElement = document.getElementById('main-dashboard-report');
      if (!verifyElement || verifyElement.innerHTML.trim() === "") {
        console.warn("DOM validation failed. Activating immediate fallback layout selector.");
        const fallbackNode = document.querySelector('.main-calculator-card') as HTMLElement || document.getElementById('root') as HTMLElement;
        if (!fallbackNode) {
          throw new Error("Critical: detached target element detected and no fallbacks available.");
        }
        const fallbackCanvas = await html2canvas(fallbackNode, {
          scale: 2.0,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff'
        });
        const fallbackImgData = fallbackCanvas.toDataURL('image/png');
        const fallbackLink = document.createElement('a');
        fallbackLink.href = fallbackImgData;
        fallbackLink.download = isBengali ? 'Saurya_Mitra_Solar_Savings_Report_Fallback_bn.png' : 'Saurya_Mitra_Solar_Savings_Report_Fallback_en.png';
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
        
        // Restore scroll and clean up
        window.scrollTo(originalScrollX, originalScrollY);
        document.body.removeChild(overlay);
        return;
      }

      // FORCE SYNCHRONOUS RENDER-WAIT (1.5 seconds)
      // Allow fonts, static watermarks, dynamic matrices, and Bengali Hindu Siliguri typography to complete layout bounds
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Capture element with html2canvas and save as PNG format
      const canvasHeight = element.scrollHeight || element.offsetHeight || 1123;
      const canvas = await html2canvas(element, {
        scale: 2.2, // Super crisp high definition PNG output
        useCORS: true,
        allowTaint: false, // Prevents cross-origin media tracking/tainting canvas that leads to blank prints
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: canvasHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: canvasHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = imgData;
      downloadLink.download = isBengali ? 'Saurya_Mitra_Solar_Savings_Report_bn.png' : 'Saurya_Mitra_Solar_Savings_Report_en.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Restore original scroll viewport seamlessly for user comfort
      window.scrollTo(originalScrollX, originalScrollY);

      // Clean up injected DOM entries seamlessly
      if (document.body.contains(element)) document.body.removeChild(element);
      if (document.body.contains(overlay)) document.body.removeChild(overlay);

    } catch (err) {
      console.error('Error generating and downloading PNG client-side:', err);
      // Fallback: make sure overlays/templates are discarded and scroll is reset if error occurs
      const prevOverlay = document.getElementById('pdf-processing-overlay');
      if (prevOverlay) prevOverlay.remove();
      const prevReport = document.getElementById('main-dashboard-report');
      if (prevReport) prevReport.remove();
    }
  };

  const unused_oldDownload = () => {
    const timestamp = new Date().toLocaleString(language === 'bn' ? 'bn-IN' : 'en-US');
    const systemSizeVal = results.recommendedSystemSize;
    const costVal = results.estimatedCost;
    const subsidyVal = results.subsidyAmount;
    const netCostVal = results.netCost;
    const monthlySavingsVal = results.monthlySavings;
    const yearlySavingsVal = results.yearlySavings;
    const paybackVal = results.paybackYears;
    const loadVal = currentLoad ? `${currentLoad} kW` : 'N/A';
    const unitsVal = `${monthlyUnits} kWh`;
    
    let roofLabel = 'Big / 1500 sq.ft';
    if (roofSize === 'small') roofLabel = 'Small / 300 sq.ft';
    else if (roofSize === 'medium') roofLabel = 'Medium / 700 sq.ft';
    else {
      const maxLargeKw = Math.max(15, currentLoad ? Math.ceil(currentLoad) : 15);
      roofLabel = `Big / ${maxLargeKw * 100} sq.ft`;
    }

    const isDomestic = category === 'domestic';
    const taxSavingsVal = Math.round(costVal * 0.40 * 0.25);
    const netCostCommercial = costVal - taxSavingsVal;

    let sectionBMarkdown = '';
    if (isDomestic) {
      sectionBMarkdown = 
        `- **Recommended Solar System Size**: ${systemSizeVal} kW\n` +
        `- **Required Roof space**: ${roofLabel}\n` +
        `- **Total Estimated Cost**: ₹${costVal.toLocaleString()} + GST\n` +
        `- **Government Subsidy**: ₹${subsidyVal.toLocaleString()} (PM-Surya Ghar Yojana)\n` +
        `- **Net Cost**: ₹${netCostVal.toLocaleString()} + GST\n` +
        `- **Monthly Savings**: ₹${monthlySavingsVal.toLocaleString()}\n` +
        `- **Yearly Savings**: ₹${yearlySavingsVal.toLocaleString()}\n` +
        `- **Payback Period (ROI)**: ${paybackVal.toFixed(1)} Years\n\n`;
    } else {
      sectionBMarkdown = 
        `- **Recommended Solar System Size**: ${systemSizeVal} kW\n` +
        `- **Required Roof space**: ${roofLabel}\n` +
        `- **Total Project Cost**: ₹${costVal.toLocaleString()} + GST\n` +
        `- **1st Year Tax Savings (via Accelerated Depreciation)**: ₹${taxSavingsVal.toLocaleString()} (40% AD eligibility)\n` +
        `- **Net Investment (after Year 1 Tax benefit)**: ₹${netCostCommercial.toLocaleString()} + GST\n` +
        `- **Monthly Savings**: ₹${monthlySavingsVal.toLocaleString()}\n` +
        `- **Yearly Savings**: ₹${yearlySavingsVal.toLocaleString()}\n` +
        `- **Payback Period (ROI)**: ${paybackVal.toFixed(1)} Years (Faster ROI due to high commercial tariffs)\n\n`;
    }

    const mdContent = `# Saurya Mitra Official Assessment\n` +
      `Generated on: ${timestamp}\n` +
      `Assessment ID: SM-${Math.floor(100000 + Math.random() * 900000)}\n\n` +
      `## Section A: Customer Energy Profile\n` +
      `- **Monthly Consumption**: ${unitsVal}\n` +
      `- **Connected Load**: ${loadVal}\n` +
      `- **Electricity Provider**: ${selectedState} - ${provider} (${isDomestic ? 'Domestic' : 'Commercial'})\n\n` +
      `## Section B: Financial Feasibility Matrix\n` +
      sectionBMarkdown +
      `## Section C: Environmental Impact\n` +
      `- **Annual CO2 Reduction**: ${environmentalImpact.co2Text}\n` +
      `- **Equivalent Tree Planting**: ${environmentalImpact.treesText}\n` +
      `- **Coal Burn Avoided**: ${environmentalImpact.coalText}\n\n` +
      `---\n` +
      `**Disclaimer**: This is an AI-generated estimation based on regional tariffs. Actual vendor quotes may vary.\n`;

    // Download dynamic .md file as custom backup
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Saurya_Mitra_Solar_Savings_Report.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Trigger Print window matching standard layout perfectly
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dynamicSectionBHTML = isDomestic ? `
            <div class="item">
              <span class="label">Recommended Solar System Size</span>
              <span class="value">${systemSizeVal} kW</span>
            </div>
            <div class="item">
              <span class="label">Required Roof space</span>
              <span class="value">${roofLabel}</span>
            </div>
            <div class="item">
              <span class="label">Total Estimated Cost</span>
              <span class="value">₹${costVal.toLocaleString()} + GST</span>
            </div>
            <div class="item">
              <span class="label">Government Subsidy</span>
              <span class="value">₹${subsidyVal.toLocaleString()}</span>
            </div>
            <div class="item" style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; grid-column: span 2;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span class="label" style="color: #0f766e;">Net Cost</span>
                  <span class="value" style="color: #0f766e; font-size: 24px; font-weight: 800;">₹${netCostVal.toLocaleString()} + GST</span>
                </div>
                <div>
                  <span class="label" style="color: #047857;">Yearly Savings</span>
                  <span class="value" style="color: #047857; font-size: 24px; font-weight: 800;">₹${yearlySavingsVal.toLocaleString()}</span>
                </div>
              </div>
            </div>
    ` : `
            <div class="item">
              <span class="label">Recommended Solar System Size</span>
              <span class="value">${systemSizeVal} kW</span>
            </div>
            <div class="item">
              <span class="label">Required Roof space</span>
              <span class="value">${roofLabel}</span>
            </div>
            <div class="item">
              <span class="label">Total Project Cost</span>
              <span class="value">₹${costVal.toLocaleString()} + GST</span>
            </div>
            <div class="item">
              <span class="label" title="Corporate Tax Write-off via 40% Accelerated Depreciation">1st Year Tax Savings (AD)</span>
              <span class="value" style="color: #0f766e;">₹${taxSavingsVal.toLocaleString()}</span>
            </div>
            <div class="item" style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; grid-column: span 2;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span class="label" style="color: #01626a;">Net cost after tax savings</span>
                  <span class="value" style="color: #01626a; font-size: 24px; font-weight: 800;">₹${netCostCommercial.toLocaleString()} + GST</span>
                </div>
                <div>
                  <span class="label" style="color: #047857;">Yearly Savings</span>
                  <span class="value" style="color: #047857; font-size: 24px; font-weight: 800;">₹${yearlySavingsVal.toLocaleString()}</span>
                </div>
              </div>
            </div>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Saurya Mitra Solar Savings Report</title>
        <style>
          @page {
            margin: 20mm 15mm 25mm 15mm;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1e293b;
            margin: 40px;
            line-height: 1.6;
          }
          .header {
            border-bottom: 3.5px solid #2c7a7b;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .header-logo {
            height: 48px;
            width: auto;
            object-fit: contain;
          }
          .header-titles {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
          }
          .logo-text {
            font-size: 26px;
            font-weight: 800;
            color: #0f766e;
            line-height: 1.2;
            margin: 0;
          }
          .timestamp {
            font-size: 13px;
            color: #64748b;
            text-align: right;
          }
          h1, h2, h3 {
            color: #0f766e;
            margin-top: 0;
          }
          .section {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            position: relative;
            z-index: 10;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .item {
            margin-bottom: 12px;
          }
          .label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            display: block;
            margin-bottom: 6px;
            letter-spacing: 0.05em;
          }
          .value {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
          }
          .matrix-title {
            font-size: 15px;
            color: #0f766e;
            font-weight: 800;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
            margin-bottom: 18px;
            text-transform: uppercase;
            letter-spacing: 0.025em;
          }
          .disclaimer {
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
            margin-top: 40px;
            border-top: 1px solid #e2e8f0;
            padding-top: 16px;
            line-height: 1.5;
            position: relative;
            z-index: 10;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            height: 400px;
            opacity: 0.20;
            z-index: 9999;
            pointer-events: none;
          }
          .footer-signature {
            position: fixed;
            bottom: -15mm;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 10px;
            color: #64748b;
            border-top: 1px solid #e2e8f022;
            padding-top: 8px;
            font-weight: 600;
            letter-spacing: 0.025em;
            font-family: inherit;
          }
          .developer-profile {
            margin-top: 36px;
            background: #f0fdfa;
            border: 1.5px dashed #99f6e4;
            border-radius: 12px;
            padding: 16px 20px;
            page-break-inside: avoid;
            position: relative;
            z-index: 10;
          }
          .bio-title {
            font-size: 12px;
            font-weight: 800;
            color: #0f766e;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 6px;
          }
          .bio-text {
            font-size: 11px;
            color: #1e293b;
            margin: 0;
            line-height: 1.5;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div class="watermark">
          <svg viewBox="0 0 120 120" style="width: 100%; height: 100%;">
            <defs>
              <linearGradient id="wmSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#f97316" />
                <stop offset="60%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#eab308" />
              </linearGradient>
              <radialGradient id="wmSunGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="35%" stop-color="#fef08a" />
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
              </radialGradient>
              <linearGradient id="wmSolarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1e3a8a" />
                <stop offset="100%" stop-color="#1d4ed8" />
              </linearGradient>
              <linearGradient id="wmLeafGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#4ade80" />
                <stop offset="100%" stop-color="#15803d" />
              </linearGradient>
              <linearGradient id="wmRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#166534" />
                <stop offset="100%" stop-color="#14532d" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="56" fill="none" stroke="#ea580c" stroke-width="2.5" />
            <circle cx="60" cy="60" r="53" fill="none" stroke="#ffffff" stroke-width="1" />
            <g clip-path="url(#wmLogoCircleClip)">
              <clipPath id="wmLogoCircleClip">
                <circle cx="60" cy="60" r="52" />
              </clipPath>
              <rect x="0" y="0" width="120" height="120" fill="url(#wmSkyGrad)" />
              <g opacity="0.3">
                <line x1="60" y1="5" x2="60" y2="115" stroke="#fef08a" stroke-width="1" />
                <line x1="5" y1="60" x2="115" y2="60" stroke="#fef08a" stroke-width="1" />
                <line x1="21" y1="21" x2="99" y2="99" stroke="#fef08a" stroke-width="1" />
                <line x1="21" y1="99" x2="99" y2="21" stroke="#fef08a" stroke-width="1" />
              </g>
              <circle cx="60" cy="40" r="30" fill="url(#wmSunGrad)" opacity="0.9" />
              <circle cx="60" cy="40" r="14" fill="#ffffff" />
              <path d="M5,75 Q30,62 60,68 T115,75 L115,120 L5,120 Z" fill="#15803d" opacity="0.35" />
              <path d="M5,82 Q30,72 60,78 T115,82 L115,120 L5,120 Z" fill="#14532d" />
              <g transform="translate(1, -2)">
                <line x1="22" y1="82" x2="22" y2="102" stroke="#475569" stroke-width="2" />
                <line x1="54" y1="85" x2="54" y2="104" stroke="#475569" stroke-width="2" />
                <line x1="16" y1="92" x2="60" y2="92" stroke="#334155" stroke-width="1.5" />
                <polygon points="12,54 62,64 54,92 6,80" fill="url(#wmSolarGrad)" stroke="#0f172a" stroke-width="1.5" />
                <line x1="24" y1="56" x2="18" y2="83" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
                <line x1="37" y1="59" x2="31" y2="86" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
                <line x1="50" y1="62" x2="44" y2="89" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
                <line x1="11" y1="62" x2="60" y2="72" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
                <line x1="9" y1="71" x2="57" y2="81" stroke="#93c5fd" stroke-width="0.75" opacity="0.8" />
              </g>
              <g transform="translate(12, -4)">
                <path d="M68,85 Q78,74 80,58" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" />
                <path d="M80,58 Q66,51 60,59 Q72,64 80,58 Z" fill="url(#wmLeafGrad)" stroke="#166534" stroke-width="0.5" />
                <path d="M80,58 Q70,55 60,59" fill="none" stroke="#14532d" stroke-width="0.75" />
                <path d="M80,58 Q95,51 101,59 Q89,64 80,58 Z" fill="url(#wmLeafGrad)" stroke="#166534" stroke-width="0.5" />
                <path d="M80,58 Q90,55 101,59" fill="none" stroke="#14532d" stroke-width="0.75" />
              </g>
              <path d="M5,62 A52,52 0 0 0 115,62 A52,53 0 0 1 5,62 Z" fill="url(#wmRingGrad)" />
              <g opacity="0.95">
                <path d="M18,68 Q38,62 55,73 Q58,75 55,78 Q38,68 16,80 T18,68 Z" fill="#22c55e" stroke="#14532d" stroke-width="0.75" />
                <path d="M102,68 Q82,62 65,73 Q62,75 65,78 Q82,68 104,80 T102,68 Z" fill="#16a34a" stroke="#14532d" stroke-width="0.75" />
                <path d="M46,72 C48,70 52,70 54,72 L58,76 M42,75 C44,73 48,73 50,75 L54,79 M38,78 C40,76 44,76 46,78 L49,81" fill="none" stroke="#ffffff" stroke-width="1.25" stroke-linecap="round" />
              </g>
            </g>
          </svg>
        </div>
        <div class="footer-signature">Report Analysis by Saurya Mitra AI – Designed and developed by Sukanta Nandi.</div>

        <div class="header">
          <div class="header-left">
            <svg viewBox="0 0 120 120" class="header-logo" style="height: 54px; width: 54px; display: inline-block; vertical-align: middle;">
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
              <circle cx="60" cy="60" r="56" fill="none" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="60" cy="60" r="53" fill="none" stroke="#ffffff" strokeWidth="1" />
              <g clip-path="url(#logoCircleClip)">
                <clipPath id="logoCircleClip">
                  <circle cx="60" cy="60" r="52" />
                </clipPath>
                <rect x="0" y="0" width="120" height="120" fill="url(#skyGrad)" />
                <g opacity="0.3">
                  <line x1="60" y1="5" x2="60" y2="115" stroke="#fef08a" strokeWidth="1" />
                  <line x1="5" y1="60" x2="115" y2="60" stroke="#fef08a" strokeWidth="1" />
                  <line x1="21" y1="21" x2="99" y2="99" stroke="#fef08a" strokeWidth="1" />
                  <line x1="21" y1="99" x2="99" y2="21" stroke="#fef08a" strokeWidth="1" />
                </g>
                <circle cx="60" cy="40" r="30" fill="url(#sunGrad)" opacity="0.9" />
                <circle cx="60" cy="40" r="14" fill="#ffffff" />
                <path d="M5,75 Q30,62 60,68 T115,75 L115,120 L5,120 Z" fill="#15803d" opacity="0.35" />
                <path d="M5,82 Q30,72 60,78 T115,82 L115,120 L5,120 Z" fill="#14532d" />
                <g transform="translate(1, -2)">
                  <line x1="22" y1="82" x2="22" y2="102" stroke="#475569" strokeWidth="2" />
                  <line x1="54" y1="85" x2="54" y2="104" stroke="#475569" strokeWidth="2" />
                  <line x1="16" y1="92" x2="60" y2="92" stroke="#334155" strokeWidth="1.5" />
                  <polygon points="12,54 62,64 54,92 6,80" fill="url(#solarGrad)" stroke="#0f172a" strokeWidth="1.5" />
                  <line x1="24" y1="56" x2="18" y2="83" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
                  <line x1="37" y1="59" x2="31" y2="86" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
                  <line x1="50" y1="62" x2="44" y2="89" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
                  <line x1="11" y1="62" x2="60" y2="72" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
                  <line x1="9" y1="71" x2="57" y2="81" stroke="#93c5fd" strokeWidth="0.75" opacity="0.8" />
                </g>
                <g transform="translate(12, -4)">
                  <path d="M68,85 Q78,74 80,58" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
                  <path d="M80,58 Q66,51 60,59 Q72,64 80,58 Z" fill="url(#leafGrad)" stroke="#166534" strokeWidth="0.5" />
                  <path d="M80,58 Q70,55 60,59" fill="none" stroke="#14532d" strokeWidth="0.75" />
                  <path d="M80,58 Q95,51 101,59 Q89,64 80,58 Z" fill="url(#leafGrad)" stroke="#166534" strokeWidth="0.5" />
                  <path d="M80,58 Q90,55 101,59" fill="none" stroke="#14532d" strokeWidth="0.75" />
                </g>
                <path d="M5,62 A52,52 0 0 0 115,62 A52,53 0 0 1 5,62 Z" fill="url(#ringGrad)" />
                <g opacity="0.95">
                  <path d="M18,68 Q38,62 55,73 Q58,75 55,78 Q38,68 16,80 T18,68 Z" fill="#22c55e" stroke="#14532d" strokeWidth="0.75" />
                  <path d="M102,68 Q82,62 65,73 Q62,75 65,78 Q82,68 104,80 T102,68 Z" fill="#16a34a" stroke="#14532d" strokeWidth="0.75" />
                  <path d="M46,72 C48,70 52,70 54,72 L58,76 M42,75 C44,73 48,73 50,75 L54,79 M38,78 C40,76 44,76 46,78 L49,81" fill="none" stroke="#ffffff" strokeWidth="1.25" strokeLinecap="round" />
                </g>
              </g>
            </svg>
            <div class="header-titles" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
              <div class="logo-text" style="color: #0f5132; font-weight: 800; font-size: 26px; line-height: 1.2; margin: 0; display: flex; align-items: center; justify-content: center; gap: 4px;">Saurya <span style="color: #ea580c; font-weight: 900;">Mitra</span></div>
              <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 5px;">
                <div style="height: 2px; width: 12px; background-color: #ea580c; opacity: 0.6;"></div>
                <div style="font-size: 10px; font-weight: 800; color: #0f5132; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap;">Together for a Solar Future</div>
                <div style="height: 2px; width: 12px; background-color: #ea580c; opacity: 0.6;"></div>
              </div>
            </div>
          </div>
          <div class="timestamp">
            <strong>Generated At:</strong> ${timestamp}<br>
            <strong>Assessment ID:</strong> SM-${Math.floor(100000 + Math.random() * 900000)}
          </div>
        </div>

        <h2 style="font-size: 22px; margin-bottom: 25px; color: #0f172a;">Saurya Mitra Official Assessment Report</h2>

        <div class="section">
          <div class="matrix-title">Section A: Customer Energy Profile</div>
          <div class="grid">
            <div class="item">
              <span class="label">Monthly Consumption</span>
              <span class="value">${unitsVal}</span>
            </div>
            <div class="item">
              <span class="label">Connected Load</span>
              <span class="value">${loadVal}</span>
            </div>
            <div class="item" style="grid-column: span 2;">
              <span class="label">Electricity Provider & State</span>
              <span class="value">${selectedState} - ${provider} (${isDomestic ? 'Domestic' : 'Commercial'})</span>
            </div>
          </div>
        </div>

        <div class="section" style="border-left: 5px solid #0f766e;">
          <div class="matrix-title">Section B: Financial Feasibility Matrix</div>
          <div class="grid col">
            ${dynamicSectionBHTML}
            <div class="item">
              <span class="label">Monthly Savings</span>
              <span class="value" style="color: #047857;">₹${monthlySavingsVal.toLocaleString()}</span>
            </div>
            <div class="item">
              <span class="label">Payback Period (ROI)</span>
              <span class="value" style="color: #0f172a;">${paybackVal.toFixed(1)} Years ${!isDomestic ? '(Accelerated Commercial Payback)' : ''}</span>
            </div>
          </div>
        </div>

        <div class="section" style="border-left: 5px solid #10b981;">
          <div class="matrix-title">Section C: Environmental Impact</div>
          <div class="grid">
            <div class="item">
              <span class="label">Annual CO2 Reduction</span>
              <span class="value" style="color: #047857; font-size: 16px;">${environmentalImpact.co2Text}</span>
            </div>
            <div class="item">
              <span class="label">Equivalent Tree Planting</span>
              <span class="value" style="color: #047857; font-size: 16px;">${environmentalImpact.treesText}</span>
            </div>
            <div class="item" style="grid-column: span 2;">
              <span class="label">Coal Burn Avoided</span>
              <span class="value" style="color: #c2410c; font-size: 16px;">${environmentalImpact.coalText}</span>
            </div>
          </div>
        </div>

        <div class="developer-profile">
          <div class="bio-title">Developer Profile</div>
          <p class="bio-text">Developed by <strong>Sukanta Nandi</strong>. This complete solar estimation platform has been meticulously engineered to guarantee optimal power generation and maximized subsidies per WBERC & PM-Surya Ghar instructions.</p>
        </div>

        <div class="disclaimer">
          <strong>Disclaimer:</strong> This is an AI-generated estimation based on regional utility tariffs. Actual vendor quotes may vary.<br>
          Empowering West Bengal with Solar Savings! Designed with love by Saurya Mitra.
        </div>

        <script>
          window.focus();
          setTimeout(function() {
            window.print();
          }, 500);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShareWhatsApp = () => {
    const formattedLoad = currentLoad ? `${currentLoad} kW` : 'N/A';
    const formattedUnits = `${monthlyUnits} kWh`;
    
    let roofLabel = 'Big / 1500 sq.ft';
    if (roofSize === 'small') roofLabel = 'Small / 300 sq.ft';
    else if (roofSize === 'medium') roofLabel = 'Medium / 700 sq.ft';
    else {
      const maxLargeKw = Math.max(15, currentLoad ? Math.ceil(currentLoad) : 15);
      roofLabel = `Big / ${maxLargeKw * 100} sq.ft`;
    }

    const recSize = `${results.recommendedSystemSize} kW`;
    const instType = systemType === 'on-grid' ? 'On-Grid' : systemType === 'off-grid' ? 'Off-Grid' : 'Hybrid';
    const totalCost = `₹${results.estimatedCost.toLocaleString()}`;
    const payback = `${results.paybackYears.toFixed(1)} Years`;
    const subsidyText = results.subsidyAmount > 0 ? ` | Govt Subsidy: *₹${results.subsidyAmount.toLocaleString()}*` : '';
    const appLink = window.location.origin + window.location.pathname;

    const summaryStr = `*${recSize} ${instType} System* | Cost: *${totalCost}*${subsidyText} | Payback: *${payback}* | Savings: *₹${results.monthlySavings.toLocaleString()}/month*`;

    const message = `Check out my Solar Savings Report from Saurya Mitra! ☀️\n\n` +
      `${summaryStr}\n\n` +
      `Try this solar tool developed by Sukanta Nandi! 🎓: ${appLink}`;

    const whatsappPhone = userProfile?.contactNo || '';
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const recipient = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const whatsappUrl = recipient 
      ? `https://api.whatsapp.com/send?phone=${recipient}&text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
  };

  const handleSaveReport = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/reports`), {
        createdAt: serverTimestamp(),
        systemSize: results.recommendedSystemSize,
        systemType,
        cost: results.estimatedCost,
        subsidy: results.subsidyAmount,
        savings: results.monthlySavings,
        billUnits: monthlyUnits,
        solarPreferences: { systemType, roofSize, state: selectedState, provider, category }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    } finally {
      setSaving(false);
    }
  };

  const addAppliance = () => {
    const newApp: Appliance = {
      id: Math.random().toString(36).substr(2, 9),
      name: language === 'bn' ? 'নতুন অ্যাপ্লায়েন্স' : 'New Appliance',
      power: 100,
      hours: 4,
      count: 1,
      enabled: true
    };
    setAppliances([...appliances, newApp]);
  };

  const removeAppliance = (id: string) => {
    setAppliances(appliances.filter(a => a.id !== id));
  };

  const updateAppliance = (id: string, updates: Partial<Omit<Appliance, 'id'>>) => {
    setAppliances(appliances.map(a => a.id === id ? { ...a, ...updates } : a));
  };
  
  if (!user) {
    return <LoginRequired language={language} onLogin={onLogin} />;
  }

  const systemOptions = [
    { 
      id: 'on-grid', 
      label: t.onGrid, 
      price: '₹65k/kW',
      description: language === 'bn' ? 'বিদ্যুৎ গ্রিডের সাথে সংযুক্ত' : 'Connected with electricity grid'
    },
    { 
      id: 'off-grid', 
      label: t.offGrid, 
      price: '₹95k/kW',
      description: language === 'bn' ? 'ব্যাটারি ব্যবহার করে এবং স্বাধীনভাবে চলে' : 'Uses batteries and works independently'
    },
    { 
      id: 'hybrid', 
      label: t.hybrid, 
      price: '₹125k/kW',
      description: language === 'bn' ? 'গ্রিড এবং ব্যাটারি ব্যাকআপ' : 'Grid and battery backup'
    },
  ];

  const maxLargeKw = Math.max(15, currentLoad ? Math.ceil(currentLoad) : 15);
  const roofOptions = [
    { id: 'small', label: t.small, limit: '3kW Max' },
    { id: 'medium', label: t.medium, limit: '7kW Max' },
    { id: 'large', label: t.large, limit: `${maxLargeKw}kW Max` },
  ];
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-12">
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 mb-8 flex items-start gap-4">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-amber-900">{t.efficiencyTitle}</h3>
            <p className="text-amber-800/80 text-sm mt-1">
              {t.efficiencyDesc}
            </p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-12">
        {/* Four-Mode Selector for Strict Isolation */}
        <div className="flex flex-wrap p-1.5 bg-white/40 rounded-[2.2rem] w-full md:w-fit mb-6 gap-1 border border-white/50 backdrop-blur-xl shadow-[0_12px_30px_-10px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,0.6)]">
          <button
            type="button"
            onClick={() => handleTabChange('bill')}
            className={cn(
              "flex-1 md:flex-none px-6 py-2.5 rounded-[1.8rem] text-xs font-black transition-all cursor-pointer active:scale-95 duration-150 select-none",
              calcMode === 'bill' ? "bg-gradient-to-b from-white to-zinc-50 text-zinc-900 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.1),0_2px_6px_-2px_rgba(6,182,212,0.15)] border border-white scale-100" : "text-zinc-600 hover:text-teal-950 hover:bg-white/40"
            )}
          >
            {t.tabReader}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('units')}
            className={cn(
              "flex-1 md:flex-none px-6 py-2.5 rounded-[1.8rem] text-xs font-black transition-all cursor-pointer active:scale-95 duration-150 select-none",
              calcMode === 'units' ? "bg-gradient-to-b from-white to-zinc-50 text-zinc-900 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.1),0_2px_6px_-2px_rgba(6,182,212,0.15)] border border-white scale-100" : "text-zinc-600 hover:text-teal-950 hover:bg-white/40"
            )}
          >
            {language === 'bn' ? 'বিল ইউনিট অনুযায়ী' : 'By Bill Units'}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('rooftop')}
            className={cn(
              "flex-1 md:flex-none px-6 py-2.5 rounded-[1.8rem] text-xs font-black transition-all cursor-pointer active:scale-95 duration-150 select-none",
              calcMode === 'rooftop' ? "bg-gradient-to-b from-white to-zinc-50 text-zinc-900 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.1),0_2px_6px_-2px_rgba(6,182,212,0.15)] border border-white scale-100" : "text-zinc-600 hover:text-teal-950 hover:bg-white/40"
            )}
          >
            {t.rooftopCalculator}
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('appliances')}
            className={cn(
              "flex-1 md:flex-none px-6 py-2.5 rounded-[1.8rem] text-xs font-black transition-all cursor-pointer active:scale-95 duration-150 select-none",
              calcMode === 'appliances' ? "bg-gradient-to-b from-white to-zinc-50 text-zinc-900 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.1),0_2px_6px_-2px_rgba(6,182,212,0.15)] border border-white scale-100" : "text-zinc-600 hover:text-teal-950 hover:bg-white/40"
            )}
          >
            {t.tabAppliances}
          </button>
        </div>
      </div>

      <div className="lg:col-span-6 space-y-6">
        {calcMode === 'bill' && !isBillUploaded && (
          <div className="bg-white/80 p-2 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.06),inset_0_4px_30px_rgba(255,255,255,0.75),inset_0_-8px_30px_rgba(34,211,238,0.02)] border border-white/50 backdrop-blur-3xl overflow-hidden relative">
            {/* Specular Curved Gloss Reflection (Lens Flare / Glass boundary) */}
            <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-white/35 via-white/[0.02] to-transparent rounded-t-[2.5rem] pointer-events-none z-10" style={{ clipPath: 'ellipse(140% 70% at 50% 10%)' }} />
            
            <BillReader 
              language={language} 
              user={user} 
              onDataExtracted={(data) => {
                setMonthlyUnits(data.unitsConsumed);
                setCurrentLoad(data.connectedLoad);
                setIsBillUploaded(true);
                setCalcMode('units');
              }} 
            />
          </div>
        )}
        
        {calcMode !== 'bill' && (
          <div className="p-6 md:p-8 bg-white/70 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.06),inset_0_4px_30px_rgba(255,255,255,0.75),inset_0_-8px_30px_rgba(34,211,238,0.02)] border border-white/50 space-y-8 overflow-hidden relative">
            {/* Specular Curved Gloss Reflection (Lens Flare / Glass boundary) */}
            <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/35 via-white/[0.02] to-transparent rounded-t-[2.5rem] pointer-events-none z-10" style={{ clipPath: 'ellipse(140% 70% at 50% 10%)' }} />

            {/* Hyper-realistic 3D Liquid Glass Droplets inside Left Input Panel */}
            <div className="absolute top-[8%] left-[91%] w-[15px] h-[15px] rounded-full border border-white/30 bg-white/10 pointer-events-none select-none z-10 shadow-[1px_2px_3px_rgba(0,0,0,0.1),inset_1.5px_2px_3px_rgba(255,255,255,0.65),inset_-1.5px_-2px_3px_rgba(0,0,0,0.05)] backdrop-blur-[0.5px]">
              <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-90" />
            </div>
            <div className="absolute top-[45%] left-[3%] w-[12px] h-[12px] rounded-full border border-white/30 bg-white/10 pointer-events-none select-none z-10 shadow-[1px_2px_3px_rgba(0,0,0,0.1),inset_1.5px_2px_3px_rgba(255,255,255,0.65),inset_-1.5px_-2px_3px_rgba(0,0,0,0.05)] backdrop-blur-[0.5px]">
              <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-90" />
            </div>
            <div className="absolute top-[92%] left-[88%] w-[17px] h-[17px] rounded-full border border-white/30 bg-white/10 pointer-events-none select-none z-10 shadow-[1px_2px_3px_rgba(0,0,0,0.1),inset_1.5px_2px_3px_rgba(255,255,255,0.65),inset_-1.5px_-2px_3px_rgba(0,0,0,0.05)] backdrop-blur-[0.5px]">
              <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-90" />
            </div>
            {isBillUploaded && calcMode === 'units' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-5 bg-emerald-50 border border-emerald-150 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                    <Check className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950 leading-snug">
                      {language === 'bn' ? 'বিল সফলভাবে বিশ্লেষণ করা হয়েছে!' : 'Bill Analyzed Successfully!'}
                    </h4>
                    <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                      {language === 'bn' 
                        ? `ব্যবহৃত ইউনিট: ${monthlyUnits} kWh | লোড: ${currentLoad} kW` 
                        : `Consumption: ${monthlyUnits} kWh | Connected Load: ${currentLoad} kW`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleTabChange('bill');
                  }}
                  className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer shrink-0 border border-emerald-200"
                >
                  {language === 'bn' ? 'নতুন বিল আপলোড করুন' : 'Re-upload Bill'}
                </button>
              </div>
            )}
          {/* State, Provider & Category Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.partnerLabels.state}</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {Object.keys(statesData).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="Other">Other State</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.provider}</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {availableProviders.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.connectionType}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="domestic">{t.domestic}</option>
                <option value="industrial">{t.industrial}</option>
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">{t.systemType}</h3>
            <div className="grid grid-cols-3 gap-3">
              {systemOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => changeSystemTypeWithDirection(opt.id as SystemType)}
                  className={cn(
                    "relative p-4 rounded-2xl border-2 transition-all text-left overflow-hidden",
                    systemType === opt.id 
                      ? "bg-amber-100 border-amber-400 shadow-sm" 
                      : "bg-gray-50 border-transparent hover:border-gray-200"
                  )}
                >
                  <p className={cn("font-bold text-sm flex items-center justify-between gap-1.5", systemType === opt.id ? "text-amber-900" : "text-gray-600")}>
                    <span>{opt.label}</span>
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSystemModal(opt.id as SystemType);
                      }}
                      className="inline-flex items-center justify-center p-1 rounded-full bg-cyan-500 text-sky-950 hover:bg-cyan-300 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-sm ml-auto relative z-20"
                      title={
                        opt.id === 'on-grid'
                          ? (language === 'bn' ? 'অন-গ্রিড নির্দেশিকা ও নেট মিটারিং' : 'On-Grid & Net Metering Info')
                          : opt.id === 'off-grid'
                          ? (language === 'bn' ? 'অফ-গ্রিড ও ব্যাটারি নির্দেশিকা' : 'Off-Grid & Battery Guidelines')
                          : (language === 'bn' ? 'হাইব্রিড ও ইন্টেলিজেন্ট এনার্জি নির্দেশিকা' : 'Hybrid & Smart System Info')
                      }
                      id={`open-${opt.id}-popup`}
                    >
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </p>
                  <p className={cn("text-[10px] leading-snug font-medium mt-1 pr-1", systemType === opt.id ? "text-amber-800/80" : "text-gray-500")}>
                    {opt.description}
                  </p>
                  <p className={cn("text-[9px] mt-2 font-bold tracking-wider", systemType === opt.id ? "text-amber-700/90" : "text-gray-400")}>
                    {opt.price}
                  </p>
                  {systemType === opt.id && (
                    <div className="absolute top-2 right-2 p-0.5 bg-amber-400 rounded-full">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                {calcMode === 'rooftop' ? t.enterRoofArea : (language === 'bn' ? '১. ব্যবহৃত ইউনিট (Unit Consumed)' : '1. Unit Consumed (Units)')}
              </h3>
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div className="flex-1">
                  <input
                    type="number"
                    disabled={(calcMode === 'units' && showAppliances) || calcMode === 'appliances'}
                    value={calcMode === 'rooftop' ? (roofArea ?? '') : (monthlyUnits ?? '')}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      if (calcMode === 'rooftop') {
                        setRoofArea(val);
                      } else {
                        setMonthlyUnits(val);
                      }
                    }}
                    className={cn(
                      "w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-mono text-base focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all",
                      ((calcMode === 'units' && showAppliances) || calcMode === 'appliances') && "opacity-50 cursor-not-allowed bg-gray-100"
                    )}
                    placeholder={calcMode === 'rooftop' ? "e.g. 500" : "0"}
                  />
                </div>
                <span className="font-black text-gray-400 uppercase tracking-widest text-[10px]">
                  {calcMode === 'rooftop' ? t.sqft : t.units}
                </span>
              </div>
            </div>
 
            {calcMode !== 'rooftop' && (
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2 relative">
                  <span>{language === 'bn' ? '২. কানেক্টেড লোড (Current Load)' : '2. Connected Load (Current Load)'}</span>
                  
                  {/* Interactive Teal Tooltip Trigger */}
                  <span
                    onMouseEnter={() => setShowLoadTooltip(true)}
                    onMouseLeave={() => setShowLoadTooltip(false)}
                    onClick={() => setShowLoadTooltip(!showLoadTooltip)}
                    className="inline-flex items-center justify-center p-1 rounded-full bg-teal-500 text-sky-950 hover:bg-teal-300 hover:scale-115 active:scale-95 transition-all cursor-pointer shadow-sm relative z-20"
                    title={language === 'bn' ? 'কানেক্টেড লোড হিসেব পদ্ধতি' : 'Connected Load calculation factor info'}
                  >
                    <Info className="w-3.5 h-3.5 shrink-0" />
                  </span>

                  {/* Floating Action Tooltip Bubble with micro-transition */}
                  <AnimatePresence>
                    {showLoadTooltip && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 bottom-full mb-3 z-50 w-72 sm:w-80 p-4 bg-slate-900 border border-teal-500/35 text-white rounded-2xl shadow-xl leading-relaxed text-left normal-case"
                      >
                        {(() => {
                          const unitsVal = typeof monthlyUnits === 'number' ? monthlyUnits : (monthlyUnits ? Number(monthlyUnits) : 0);
                          if (unitsVal > 0) {
                            const dailyAvg = (unitsVal / 30).toFixed(1);
                            const calculatedLoadVal = (unitsVal * 0.01).toFixed(1);
                            return (
                              <div className="space-y-2">
                                <p className="font-extrabold text-teal-400 text-[11px] sm:text-xs tracking-wider uppercase">
                                  {language === 'bn' ? 'গাণিতিক লোড বিশ্লেষণ' : 'Dynamic Load Breakdown'}
                                </p>
                                <ul className="space-y-1.5 text-[11px] sm:text-xs font-semibold text-zinc-300">
                                  <li className="flex items-start gap-1">
                                    <span className="text-teal-400 font-bold">•</span>
                                    <span>
                                      {language === 'bn' 
                                        ? `আপনার মাসিক ব্যবহার: ${unitsVal} ইউনিট` 
                                        : `Your monthly usage: ${unitsVal} units`}
                                    </span>
                                  </li>
                                  <li className="flex items-start gap-1">
                                    <span className="text-teal-400 font-bold">•</span>
                                    <span>
                                      {language === 'bn' 
                                        ? `দৈনিক গড় ব্যবহার: ${dailyAvg} ইউনিট/দিন (${unitsVal} ÷ ৩০)` 
                                        : `Daily average usage: ${dailyAvg} units/day (${unitsVal} ÷ 30)`}
                                    </span>
                                  </li>
                                  <li className="flex items-start gap-1">
                                    <span className="text-teal-400 font-bold">•</span>
                                    <span>
                                      {language === 'bn' 
                                        ? `হিসাবের সূত্র: আবাসিক ক্ষেত্রে স্ট্যান্ডার্ড ১৫% লোড ফ্যাক্টর এবং পিক-ডিমান্ড সেফটি মার্জিন বিবেচনা করে আপনার সোলারের জন্য অনুমোদিত সংযুক্ত লোড নির্ধারণ করা হয়েছে ${calculatedLoadVal} kW।` 
                                        : `Calculation formula: Considering standard 15% load factor and peak-demand safety margin for residential connections, the suggested connected load is determined as ${calculatedLoadVal} kW.`}
                                    </span>
                                  </li>
                                </ul>
                              </div>
                            );
                          } else {
                            return (
                              <div className="space-y-2">
                                <p className="font-extrabold text-teal-400 text-[11px] sm:text-xs tracking-wider uppercase">
                                  {language === 'bn' ? 'কানেক্টেড লোড গাইড' : 'Connected Load Guide'}
                                </p>
                                <p className="text-[11px] sm:text-xs font-semibold text-zinc-300">
                                  {language === 'bn'
                                    ? 'আপনার মাসিক বিদ্যুৎ ব্যবহারের (Unit Consumed) ওপর ভিত্তি করে ১৫% লোড ফ্যাক্টর ও সেফটি মার্জিন সহ আপনার বাড়ির জন্য আদর্শ কানেক্টেড লোড (kW) এখানে হিসাব করা হয়।'
                                    : 'Specifies the ideal connected load (kW) for your home based on your monthly consumption (Unit Consumed), calculated with standard 15% load factor & smart demand buffers.'}
                                </p>
                              </div>
                            );
                          }
                        })()}
                        {/* Little pointer arrow */}
                        <div className="absolute left-4 top-full w-2 h-2 bg-slate-900 border-r border-b border-teal-500/35 transform rotate-45 -translate-y-1" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </h3>
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.1"
                      disabled={calcMode === 'appliances'}
                      value={currentLoad ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setCurrentLoad(val);
                      }}
                      className={cn(
                        "w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-mono text-base focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all",
                        calcMode === 'appliances' && "opacity-50 cursor-not-allowed bg-gray-100"
                      )}
                      placeholder="e.g. 5.1"
                    />
                  </div>
                  <span className="font-black text-gray-400 uppercase tracking-widest text-[10px]">
                    kW
                  </span>
                </div>
              </div>
            )}

            {calcMode === 'rooftop' && (
              <div className="col-span-1 md:col-span-2">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 ml-1">
                  {language === 'bn' 
                    ? '* প্রতি ১ কিলোওয়াটের জন্য প্রায় ১০০ বর্গফুট ছাদের প্রয়োজন হয়।'
                    : '* Approx. 100 sq ft per 1 kW system.'}
                </p>
              </div>
            )}
          </div>

          {calcMode === 'units' && (
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">{t.roofSize}</h3>
              <div className="grid grid-cols-3 gap-3">
                {roofOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setRoofSize(opt.id as RoofSize)}
                    className={cn(
                      "relative p-4 rounded-2xl border-2 transition-all text-left overflow-hidden",
                      roofSize === opt.id 
                        ? "bg-amber-100 border-amber-400 shadow-sm" 
                        : "bg-gray-50 border-transparent hover:border-gray-200"
                    )}
                  >
                    <p className={cn("font-bold text-sm", roofSize === opt.id ? "text-amber-900" : "text-gray-600")}>
                      {opt.label}
                    </p>
                    <p className={cn("text-[10px] mt-1 font-medium", roofSize === opt.id ? "text-amber-700" : "text-gray-400")}>
                      {opt.limit}
                    </p>
                    {roofSize === opt.id && (
                      <div className="absolute top-2 right-2 p-0.5 bg-amber-400 rounded-full">
                        <Check className="w-3 h-3 text-black" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
        )}

        {/* Appliance Calculator */}
        {((calcMode === 'units' && isBillUploaded) || calcMode === 'appliances') && (
          <div className={cn("space-y-4", (calcMode === 'units' && !showAppliances) && "hidden")}>
            {calcMode === 'units' && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <input
                  type="checkbox"
                  id="appliance-toggle"
                  checked={showAppliances}
                  onChange={(e) => {
                    setShowAppliances(e.target.checked);
                    if (!e.target.checked) {
                      setAppliances(prev => prev.map(app => ({ ...app, enabled: false })));
                      setMonthlyUnits('');
                    }
                  }}
                  className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="appliance-toggle" className="text-sm font-bold text-amber-900 cursor-pointer select-none">
                  {t.showAppliances}
                </label>
              </div>
            )}

            <AnimatePresence initial={false}>
              {(calcMode === 'appliances' || (calcMode === 'units' && showAppliances)) && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-8 space-y-4 border-t border-gray-100 mt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700">{t.applianceList}</h4>
                    <button 
                      onClick={addAppliance}
                      className="flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700 transition"
                    >
                      <Plus className="w-4 h-4" /> {t.addAppliance}
                    </button>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence>
                      {appliances.map((app) => (
                        <motion.div
                          key={app.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "flex flex-wrap items-center gap-3 p-3 rounded-2xl border transition-all group",
                            app.enabled !== false 
                              ? "bg-white border-amber-200 shadow-sm" 
                              : "bg-gray-50 border-gray-100 opacity-60"
                          )}
                        >
                          <div className="flex-1 min-w-[150px] flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={app.enabled !== false}
                              onChange={(e) => updateAppliance(app.id, { enabled: e.target.checked })}
                              className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={app.translationKey && t.appliances?.[app.translationKey] ? t.appliances[app.translationKey] : app.name}
                              onChange={(e) => updateAppliance(app.id, { name: e.target.value, translationKey: undefined })}
                              className="w-full bg-transparent font-bold text-gray-800 border-none focus:ring-0 px-1"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider transition-colors group-hover:text-amber-500">{t.powerWatt}</span>
                              <input
                                type="number"
                                value={app.power}
                                onChange={(e) => updateAppliance(app.id, { power: Number(e.target.value) })}
                                className="w-16 h-9 bg-white border border-gray-200 rounded-xl px-1 text-center font-mono text-sm shadow-inner focus:border-amber-400 focus:ring-0 transition-all"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider transition-colors group-hover:text-amber-500">{t.quantity || 'Qty'}</span>
                              <input
                                type="number"
                                value={app.count}
                                onChange={(e) => updateAppliance(app.id, { count: Number(e.target.value) })}
                                className="w-12 h-9 bg-white border border-gray-200 rounded-xl px-1 text-center font-mono text-sm shadow-inner focus:border-amber-400 focus:ring-0 transition-all"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider transition-colors group-hover:text-amber-500">{t.hoursShort}</span>
                              <input
                                type="number"
                                value={app.hours}
                                onChange={(e) => updateAppliance(app.id, { hours: Number(e.target.value) })}
                                className="w-12 h-9 bg-white border border-gray-200 rounded-xl px-1 text-center font-mono text-sm shadow-inner focus:border-amber-400 focus:ring-0 transition-all"
                              />
                            </div>
                            
                            <button 
                              onClick={() => removeAppliance(app.id)}
                              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>

      <div className="lg:col-span-6 space-y-6 sticky top-8">
        <div className="p-8 bg-gradient-to-b from-[#112d3e]/75 to-[#091d29]/85 text-white rounded-[2.5rem] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.6),inset_0_4px_30px_rgba(255,255,255,0.25),inset_0_-8px_30px_rgba(6,182,212,0.15),0_0_60px_rgba(6,182,212,0.15)] border border-cyan-400/30 backdrop-blur-3xl overflow-hidden relative min-h-[500px]">
          {/* Specular Curved Gloss Reflection (Lens Flare / Glass boundary) */}
          <div className="absolute top-0 left-0 right-0 h-[50%] bg-gradient-to-b from-white/18 via-white/[0.03] to-transparent rounded-t-[2.5rem] pointer-events-none z-10" style={{ clipPath: 'ellipse(140% 70% at 50% 10%)' }} />

          {/* Sleek Dynamic Glass Sheen Sweep */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent pointer-events-none z-10"
            style={{ skewX: -20 }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, repeatDelay: 6, duration: 2.2, ease: "easeInOut" }}
          />

          {/* Hyper-realistic 3D Liquid Glass Droplets */}
          <div className="absolute top-[12%] left-[88%] w-[18px] h-[18px] rounded-full border border-white/20 bg-white/5 pointer-events-none select-none z-10 shadow-[2px_3px_5px_rgba(0,0,0,0.25),inset_2px_3px_4px_rgba(255,255,255,0.5),inset_-2px_-3px_4px_rgba(0,0,0,0.15)] backdrop-blur-[0.5px]">
            <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-85" />
          </div>
          <div className="absolute top-[48%] left-[4%] w-[14px] h-[14px] rounded-full border border-white/20 bg-white/5 pointer-events-none select-none z-10 shadow-[2px_3px_5px_rgba(0,0,0,0.25),inset_2px_3px_4px_rgba(255,255,255,0.5),inset_-2px_-3px_4px_rgba(0,0,0,0.15)] backdrop-blur-[0.5px]">
            <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-85" />
          </div>
          <div className="absolute top-[82%] left-[91%] w-[22px] h-[22px] rounded-full border border-white/20 bg-white/5 pointer-events-none select-none z-10 shadow-[2px_3px_5px_rgba(0,0,0,0.25),inset_2px_3px_4px_rgba(255,255,255,0.5),inset_-2px_-3px_4px_rgba(0,0,0,0.15)] backdrop-blur-[0.5px]">
            <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-85" />
          </div>
          <div className="absolute top-[22%] left-[94%] w-[11px] h-[11px] rounded-full border border-white/25 bg-white/5 pointer-events-none select-none z-10 shadow-[1px_2px_3px_rgba(0,0,0,0.25),inset_1.5px_2px_3px_rgba(255,255,255,0.5),inset_-1.5px_-2px_3px_rgba(0,0,0,0.15)] backdrop-blur-[0.5px]">
            <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-85" />
          </div>
          <div className="absolute top-[89%] left-[12%] w-[16px] h-[16px] rounded-full border border-white/20 bg-white/5 pointer-events-none select-none z-10 shadow-[2px_3px_5px_rgba(0,0,0,0.25),inset_2px_3px_4px_rgba(255,255,255,0.5),inset_-2px_-3px_4px_rgba(0,0,0,0.15)] backdrop-blur-[0.5px]">
            <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-85" />
          </div>
          <div className="absolute top-[36%] left-[92%] w-[15px] h-[15px] rounded-full border border-white/20 bg-white/5 pointer-events-none select-none z-10 shadow-[2px_3px_5px_rgba(0,0,0,0.25),inset_2px_3px_4px_rgba(255,255,255,0.5),inset_-2px_-3px_4px_rgba(0,0,0,0.15)] backdrop-blur-[0.5px]">
            <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-85" />
          </div>
          <div className="absolute top-[64%] left-[95%] w-[13px] h-[13px] rounded-full border border-white/20 bg-white/5 pointer-events-none select-none z-10 shadow-[2px_3px_5px_rgba(0,0,0,0.25),inset_2px_3px_4px_rgba(255,255,255,0.5),inset_-2px_-3px_4px_rgba(0,0,0,0.15)] backdrop-blur-[0.5px]">
            <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] rounded-full bg-white opacity-85" />
          </div>

          {/* Transparent Water Backplane & Sparkly Reflections */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden -z-20 bg-gradient-to-b from-sky-950/40 via-cyan-950/25 to-blue-950/45">
            {/* Dynamic Water Highlight Glare */}
            <div className="absolute top-0 inset-x-0 h-[45%] bg-gradient-to-b from-cyan-400/20 via-sky-450/8 to-transparent filter blur-md" />
            
            {/* Soft Glowing Water Rays or Caustic pools */}
            <div className="absolute -top-[10%] -left-[10%] w-[90%] h-[90%] bg-gradient-radial from-cyan-400/15 via-blue-500/5 to-transparent blur-3xl rounded-full" />
            <div className="absolute -bottom-[20%] -right-[10%] w-[90%] h-[90%] bg-gradient-radial from-teal-500/10 via-sky-500/5 to-transparent blur-3xl rounded-full" />
            
            {/* Elegant wavy underlay overlays */}
            <svg className="absolute bottom-0 w-[200%] h-36 pointer-events-none opacity-20 filter blur-[0.5px]" viewBox="0 0 1200 120" preserveAspectRatio="none">
              <motion.path 
                d="M0,60 C150,100 350,20 500,60 C650,100 850,20 1000,60 C1150,100 1350,20 1500,60 L1500,120 L0,120 Z" 
                fill="url(#wave-gradient-1)"
                animate={{ x: [0, -600] }}
                transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
              />
              <motion.path 
                d="M0,50 C180,90 300,10 480,50 C660,90 780,10 960,50 C1140,90 1260,10 1440,50 L1440,120 L0,120 Z" 
                fill="url(#wave-gradient-2)"
                animate={{ x: [-600, 0] }}
                transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
              />
              <defs>
                <linearGradient id="wave-gradient-1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(34, 211, 238, 0.12)" />
                  <stop offset="100%" stopColor="rgba(6, 182, 212, 0.35)" />
                </linearGradient>
                <linearGradient id="wave-gradient-2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(14, 165, 233, 0.08)" />
                  <stop offset="100%" stopColor="rgba(8, 145, 178, 0.25)" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Dynamic Floating Water Bubbles (Bobbles) */}
          {waterBubbles.map((bubble) => (
            <motion.div
              key={bubble.id}
              className="absolute rounded-full pointer-events-none -z-10 border border-white/25 bg-gradient-to-tr from-white/10 to-white/25 backdrop-blur-[0.5px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.35),0_1px_3px_rgba(6,182,212,0.15)]"
              style={{
                left: `${bubble.left}%`,
                width: bubble.size,
                height: bubble.size,
                bottom: -40,
              }}
              animate={{
                y: [0, -620],
                x: [0, Math.sin(bubble.id) * 20, -Math.sin(bubble.id) * 20, 0],
                opacity: [0, 0.75, 0.75, 0],
                scale: [0.8, 1.15, 0.8],
              }}
              transition={{
                duration: bubble.duration,
                delay: bubble.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

          <div className="absolute top-0 right-0 p-8 opacity-15 pointer-events-none -z-10">
            <Zap className="w-32 h-32 text-cyan-400 filter drop-shadow-[0_0_20px_rgba(34,211,238,0.4)] animate-pulse" />
          </div>
          
          <motion.div 
            className="relative z-10 space-y-5"
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
          >
            {/* Added Calculation Logic Trigger Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4.5 rounded-3xl bg-slate-900/50 border border-cyan-500/25 shadow-lg backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                <span className="text-xs font-black tracking-widest text-emerald-400 font-sans uppercase">
                  {language === 'bn' ? 'সরাসরি হিসাব পর্যালোচনা' : 'Live Math System'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCalcModal(true)}
                className="flex items-center gap-2 px-4.5 py-2 rounded-2xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-400/40 text-emerald-300 hover:text-white hover:from-emerald-500 hover:to-teal-500 hover:border-emerald-450 cursor-pointer active:scale-101 duration-150 transition-all select-none shadow-[0_4px_15px_rgba(16,185,129,0.15)] shrink-0"
              >
                <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{language === 'bn' ? 'হিসাবের পদ্ধতি দেখুন' : "How It's Calculated?"}</span>
              </button>
            </div>

            {calcMode === 'bill' && !isBillUploaded ? (
              <div className="flex flex-col items-center justify-center text-center py-24 px-6 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-xl animate-pulse" />
                  <div className="relative bg-[#0c2331]/80 border border-cyan-500/30 p-5 rounded-3xl shadow-lg">
                    <FileText className="w-12 h-12 text-cyan-400 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-extrabold text-cyan-300 md:text-lg">
                    {language === 'bn' ? 'বিদ্যুৎ বিল আপলোড পেন্ডিং' : 'Bill Upload Pending'}
                  </h3>
                  <p className="text-xs text-zinc-350 max-w-sm leading-relaxed md:text-sm">
                    {language === 'bn' 
                      ? 'হিসাব দেখতে অনুগ্রহ করে আপনার বিদ্যুৎ বিলটি আপলোড করুন। বিল আপলোড করলেই সোলার সাইজ, সাবসিডি এবং বাৎসরিক সঞ্চয় দেখা যাবে।' 
                      : 'To see detailed solar recommended capacity, direct subsidies, and savings calculations, please upload your electricity bill.'}
                  </p>
                </div>
              </div>
            ) : calcMode === 'units' && (!monthlyUnits || !currentLoad || monthlyUnits <= 0 || currentLoad <= 0) ? (
              <div className="flex flex-col items-center justify-center text-center py-24 px-6 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-xl animate-pulse" />
                  <div className="relative bg-[#0c2331]/80 border border-cyan-500/30 p-5 rounded-3xl shadow-lg">
                    <Zap className="w-12 h-12 text-cyan-400 animate-pulse animate-bounce" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-extrabold text-cyan-300 md:text-lg">
                    {language === 'bn' ? 'বিল ইউনিট ও কানেক্টেড লোড প্রদান করুন' : 'Please enter your bill units and connected load to see calculation'}
                  </h3>
                  <p className="text-xs text-zinc-350 max-w-sm leading-relaxed md:text-sm">
                    {language === 'bn' 
                      ? 'সঠিক সোলার সাইজিং, সরকারি সাবসিডি এবং মাসিক সাশ্রয় দেখতে অনুগ্রহ করে আপনার ব্যবহৃত ইউনিট ও বিদ্যুৎ লোড লিখুন।' 
                      : 'To calculate your recommended solar size, regional grid subsidies, and monthly wallet savings, please input your monthly unit consumption and connected load.'}
                  </p>
                </div>
              </div>
            ) : calcMode === 'rooftop' && (!roofArea || roofArea <= 0) ? (
              <div className="flex flex-col items-center justify-center text-center py-24 px-6 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-xl animate-pulse" />
                  <div className="relative bg-[#0c2331]/80 border border-cyan-500/30 p-5 rounded-3xl shadow-lg">
                    <Leaf className="w-12 h-12 text-cyan-400 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-extrabold text-cyan-300 md:text-lg">
                    {language === 'bn' ? 'দয়া করে হিসাব দেখতে আপনার ছাদের ক্ষেত্রফল দিন' : 'Please enter your roof area to see calculation'}
                  </h3>
                  <p className="text-xs text-zinc-350 max-w-sm leading-relaxed md:text-sm">
                    {language === 'bn' 
                      ? 'ডায়েরী ও সোলার ব্যাকআপ হিসাব দেখতে অনুগ্রহ করে ছাদের ক্ষেত্রফল প্রদান করুন।' 
                      : 'To see detailed solar panel recommendations, PM-Surya subsidies, and savings calculation, please enter your roof area.'}
                  </p>
                </div>
              </div>
            ) : calcMode === 'appliances' && selectedAppliancesCount === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24 px-6 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-xl animate-pulse" />
                  <div className="relative bg-[#0c2331]/80 border border-cyan-500/30 p-5 rounded-3xl shadow-lg">
                    <Leaf className="w-12 h-12 text-cyan-400 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-extrabold text-cyan-300 md:text-lg">
                    {language === 'bn' ? 'দয়া করে হিসাব দেখতে অন্তত একটি অ্যাপ্লায়েন্স সিলেক্ট করুন' : 'Please select at least one appliance below to calculate your custom solar size.'}
                  </h3>
                  <p className="text-xs text-zinc-350 max-w-sm leading-relaxed md:text-sm">
                    {language === 'bn' 
                      ? 'অ্যাপ্লায়েন্স লোড হিসাব ও সোলার ডিজাইন দেখতে নিচে তালিকা থেকে আপনার পছন্দের যন্ত্র সিলেক্ট করুন।' 
                      : 'To calculate your custom solar size, please check/select at least one of the appliances below and enter power details.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Header tabs for Right Column Comparison selection */}
            <div className="flex bg-[#0c2331]/30 p-1.5 rounded-2xl mb-4 border border-cyan-500/15 backdrop-blur-md">
              <button
                onClick={() => setRightTab('compare')}
                className={cn(
                  "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all",
                  rightTab === 'compare' ? "bg-cyan-500 text-sky-950 shadow-md" : "text-cyan-300/70 hover:text-white"
                )}
              >
                {language === 'bn' ? '৩-সিস্টেম তুলনা (COMPARISON)' : '3-System Comparison'}
              </button>
              <button
                onClick={() => setRightTab('details')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all",
                  rightTab === 'details' ? "bg-cyan-500 text-sky-950 shadow-md" : "text-cyan-300/70 hover:text-white"
                )}
              >
                {language === 'bn' ? 'বিস্তারিত হিসাব (DETAILS)' : 'Detailed Specs'}
              </button>
            </div>
 
            {rightTab === 'compare' ? (
              <div className="space-y-6">
                {/* General overview box */}
                <div className="p-4 bg-sky-900/40 rounded-2xl border border-cyan-500/10">
                  <h4 className="text-[11px] font-black text-cyan-300 uppercase tracking-widest mb-3 flex items-center justify-between">
                    <span>
                      {calcMode === 'rooftop' 
                        ? (language === 'bn' ? 'ছাদের ক্ষেত্রফল ওভারভিউ' : 'Rooftop Space Overview')
                        : calcMode === 'appliances'
                        ? (language === 'bn' ? 'অ্যাপ্লায়েন্স লোড ওভারভিউ' : 'Appliance Load Overview')
                        : (language === 'bn' ? 'ব্যবহৃত বিলের ওভারভিউ' : 'Scanned Bill Overview')
                      }
                    </span>
                    <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded text-[9px] font-bold">LIVE</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {calcMode === 'rooftop' ? (
                      <>
                        <div className="space-y-0.5">
                          <span className="text-zinc-300 text-[10px] uppercase font-bold">{language === 'bn' ? '১. ছাদের ক্ষেত্রফল' : '1. Roof Area'}</span>
                          <p className="text-lg font-black text-white font-mono">{roofArea} Sq.Ft</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-zinc-300 text-[10px] uppercase font-bold">{language === 'bn' ? '২. প্রস্তাবিত ক্ষমতা' : '2. Est. Capacity'}</span>
                          <p className="text-lg font-black text-white font-mono">{(Number(roofArea) / 100).toFixed(1)} kW</p>
                        </div>
                      </>
                    ) : calcMode === 'appliances' ? (
                      <>
                        <div className="space-y-0.5">
                          <span className="text-zinc-300 text-[10px] uppercase font-bold">{language === 'bn' ? '১. মোট লোড' : '1. Total Connected Load'}</span>
                          <p className="text-lg font-black text-white font-mono">{currentLoad} kW</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-zinc-300 text-[10px] uppercase font-bold">{language === 'bn' ? '২. মাসিক ব্যবহৃত ইউনিট' : '2. Estimated Monthly Units'}</span>
                          <p className="text-lg font-black text-white font-mono">{monthlyUnits} kWh</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-0.5">
                          <span className="text-zinc-300 text-[10px] uppercase font-bold">{language === 'bn' ? '১. ব্যবহৃত ইউনিট' : '1. Unit Consumed'}</span>
                          <p className="text-lg font-black text-white font-mono">{monthlyUnits} kWh</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-zinc-300 text-[10px] uppercase font-bold">{language === 'bn' ? '২. কানেক্টেড লোড' : '2. Connected Load'}</span>
                          <p className="text-lg font-black text-white font-mono">{currentLoad} kW</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Slideshow showing only the selected system */}
                <div className="relative w-full min-h-[420px]">
                  <div className="relative overflow-hidden w-full h-full">
                    <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
                      {([systemType] as SystemType[]).map((type) => {
                        const data = gridComparison[type];
                        
                        // Label naming
                        const labelEn = type === 'on-grid' ? 'On-Grid System' : type === 'off-grid' ? 'Off-Grid System' : 'Hybrid System';
                        const labelBn = type === 'on-grid' ? 'অন-গ্রিড সিস্টেম' : type === 'off-grid' ? 'অফ-গ্রিড সিস্টেম' : 'হাইব্রিড সিস্টেম';
                        const descEn = type === 'on-grid' ? 'Sells extra back to government' : type === 'off-grid' ? 'Independent battery storage' : 'Combined solar & battery';
                        const descBn = type === 'on-grid' ? 'বিদ্যুৎ গ্রিডের সাথে যুক্ত' : type === 'off-grid' ? 'ব্যাটারি ব্যবহার করে স্বাধীন' : 'গ্রিড এবং ব্যাটারি ব্যাকআপ';

                        return (
                          <motion.div
                            key={type}
                            custom={slideDirection}
                            variants={{
                              enter: (direction: number) => ({
                                x: direction > 0 ? 120 : -120,
                                opacity: 0,
                                scale: 0.96
                              }),
                              center: {
                                x: 0,
                                opacity: 1,
                                scale: 1,
                                transition: {
                                  x: { type: "spring", stiffness: 350, damping: 28 },
                                  opacity: { duration: 0.2 }
                                }
                              },
                              exit: (direction: number) => ({
                                x: direction < 0 ? 120 : -120,
                                opacity: 0,
                                scale: 0.96,
                                transition: {
                                  x: { type: "spring", stiffness: 350, damping: 28 },
                                  opacity: { duration: 0.18 }
                                }
                              })
                            }}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            className="w-full text-left p-6 md:p-8 rounded-3xl border transition-all relative overflow-hidden flex flex-col gap-5 bg-[#0b1d29]/90 border-cyan-400/85 shadow-[0_0_24px_rgba(34,211,238,0.2)]"
                          >
                            <div className="flex justify-between items-start w-full gap-2">
                              <div>
                                <h4 className="font-extrabold text-base md:text-xl text-cyan-300">
                                  {language === 'bn' ? labelBn : labelEn}
                                </h4>
                                <p className="text-xs md:text-sm text-zinc-400 font-medium mt-1 leading-normal">
                                  {language === 'bn' ? descBn : descEn}
                                </p>
                              </div>
                              <div className="px-3 py-1 bg-cyan-400 text-slate-900 text-[11px] md:text-xs font-black uppercase tracking-wider rounded-md shrink-0">
                                {language === 'bn' ? 'সক্রিয়' : 'Active'}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-5 gap-x-6 border-t border-cyan-500/15 pt-5 text-xs md:text-sm">
                              {/* Point 3: Required solar panel (KW) & Roof Area */}
                              <div className="space-y-1">
                                <span className="text-[10px] md:text-[11px] font-black tracking-widest text-cyan-200/60 uppercase">
                                  {language === 'bn' ? '৩. সোলার প্যানেল ও ছাদ' : '3. Solar Panel & Roof'}
                                </span>
                                <p className="font-extrabold text-base md:text-lg text-amber-300 font-mono">
                                  {data.recommendedSystemSize} kW / {data.recommendedSystemSize * 100} sq.ft
                                </p>
                              </div>

                              {category === 'domestic' ? (
                                <>
                                  {/* Point 4 & 5 for Domestic */}
                                  <div className="space-y-1">
                                    <span className="text-[10px] md:text-[11px] font-black tracking-widest text-cyan-200/60 uppercase">
                                      {language === 'bn' ? '৪. সরকারি ভর্তুকি বা অনুদান' : '4. PM-Surya Subsidy'}
                                    </span>
                                    <p className="font-black text-base md:text-lg text-emerald-400 font-mono">
                                      ₹{data.subsidyAmount.toLocaleString('en-IN')}
                                    </p>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-[10px] md:text-[11px] font-black tracking-widest text-cyan-200/60 uppercase">
                                      {language === 'bn' ? '৫. ভর্তুকি বাদে আনুমানিক ব্যয়' : '5. Net Cost w/ Subsidy'}
                                    </span>
                                    <p className="font-black text-base md:text-lg text-zinc-100 font-mono">
                                      ₹{data.netCost.toLocaleString('en-IN')} + GST
                                    </p>
                                  </div>

                                  <div className="space-y-1.5 col-span-2">
                                    <span className="text-[10px] md:text-[11px] font-black tracking-widest text-cyan-200/60 uppercase">
                                      {language === 'bn' ? '৬. বিনিয়োগ ফেরতের সময়কাল' : '6. Payback Period'}
                                    </span>
                                    <div className="flex items-center gap-2 font-semibold">
                                      <Clock className="w-4.5 h-4.5 text-emerald-400" />
                                      <span className="text-emerald-400 font-black text-sm md:text-base font-mono">
                                        {data.paybackYears.toFixed(1)} {language === 'bn' ? 'বছর' : 'Years'}
                                      </span>
                                      {type === 'on-grid' && (
                                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-black uppercase tracking-widest ml-2">
                                          Fastest
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {/* Point 4 & 5 for Commercial/Industrial */}
                                  {type === 'on-grid' ? (
                                    <div className="col-span-2 space-y-2 bg-[#091e2b]/80 p-3 rounded-2xl border border-cyan-500/30">
                                      <div>
                                        <p className="text-xs font-bold text-zinc-300">
                                          {language === 'bn' 
                                            ? `৪. মোট প্রজেক্ট ব্যয় (Total Project Cost): ₹${translateNumerals(data.estimatedCost, language)} + GST`
                                            : `4. Total Project Cost: ₹${data.estimatedCost.toLocaleString('en-IN')} + GST`}
                                        </p>
                                      </div>
                                      <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                                        <p className="text-xs font-black text-amber-300 leading-snug">
                                          {language === 'bn'
                                            ? `⭐ ১ম বছরে সম্ভাব্য কর সাশ্রয় (AD): ₹${translateNumerals(Math.round(data.estimatedCost * 0.10), language)}`
                                            : `⭐ Potential 1st Year Tax Savings (AD): ₹${Math.round(data.estimatedCost * 0.10).toLocaleString('en-IN')}`}
                                        </p>
                                        <p className="text-[9px] text-zinc-400 mt-0.5 leading-normal">
                                          {language === 'bn'
                                            ? 'কমার্শিয়াল ও ইন্ডাস্ট্রিয়ালের জন্য কর সাশ্রয় প্রথম অর্থবর্ষেই কর্পোরেট ট্যাক্সের দায়বদ্ধতা কমায়।'
                                            : 'Slashes your company’s corporate tax liability starting from the very first fiscal year.'}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="space-y-1">
                                        <span className="text-[10px] md:text-[11px] font-black tracking-widest text-cyan-200/60 uppercase">
                                          {language === 'bn' ? '৪. মোট প্রজেক্ট ব্যয় (Total Project Cost)' : '4. Total Project Cost'}
                                        </span>
                                        <p className="font-extrabold text-base text-zinc-100 font-mono">
                                          ₹{translateNumerals(data.estimatedCost, language)} + GST
                                        </p>
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-[10px] md:text-[11px] font-black tracking-widest text-cyan-200/60 uppercase">
                                          {language === 'bn' ? '৫. ১ম বছরে কর সাশ্রয় (Accelerated Depreciation)' : '5. 1st Yr Tax Savings (via AD)'}
                                        </span>
                                        <p className="font-extrabold text-base text-cyan-300 font-mono" title="Accelerated Depreciation allows 40% write-off in Year 1. Estimated under typical 25% tax bracket.">
                                          ₹{translateNumerals(Math.round(data.estimatedCost * 0.40 * 0.25), language)}
                                        </p>
                                      </div>
                                    </>
                                  )}

                                  <div className="space-y-1 col-span-2">
                                    <span className="text-[10px] md:text-[11px] font-black tracking-widest text-cyan-200/60 uppercase">
                                      {language === 'bn' ? '৬. কমার্শিয়ালের কারণে দ্রুত ROI' : '6. ROI (Commercial Tariff)'}
                                    </span>
                                    <div className="flex items-center gap-2 font-semibold">
                                      <Clock className="w-4.5 h-4.5 text-emerald-400" />
                                      <span className="text-emerald-400 font-black text-sm md:text-base font-mono">
                                        {data.paybackYears.toFixed(1)} {language === 'bn' ? 'বছর (দ্রুততর)' : 'Years (Fast ROI)'}
                                      </span>
                                      <span className="text-[8px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest ml-1.5" title="Higher commercial electricity rates speed up payback">
                                        ~₹8.50-RoI
                                      </span>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Prominent, Glowing Call to Action Button right below the Payback Period row */}
                            <div className="w-full mt-4 pt-4 border-t border-cyan-500/15">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBookInspection(
                                    type, 
                                    data.recommendedSystemSize, 
                                    category === 'domestic' ? data.netCost : data.estimatedCost
                                  );
                                }}
                                className={cn(
                                  "w-full py-4 px-6 rounded-2xl text-[13px] md:text-sm font-black tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden",
                                  bookedLeadType === type 
                                    ? "bg-emerald-500 text-white shadow-emerald-500/20 hover:brightness-105 animate-none" 
                                    : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-sans font-bold shadow-lg hover:scale-[1.01] active:scale-98 animate-glow"
                                )}
                              >
                                {bookingState === type ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {language === 'bn' ? 'প্রক্রিয়া হচ্ছে...' : 'Processing...'}
                                  </>
                                ) : bookedLeadType === type ? (
                                  <>
                                    <Check className="w-4.5 h-4.5" />
                                    {language === 'bn' ? 'পরিদর্শন বুক করা হয়েছে' : 'Inspection Booked!'}
                                  </>
                                ) : (
                                  <>
                                    <Calendar className="w-4 h-4" />
                                    {language === 'bn' ? 'ফ্রি ছাদ পরিদর্শন বুক করুন' : 'Book Free Roof Inspection'}
                                  </>
                                )}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Box 1: Detailed specs statistics (Translucent Dark Slate Box with 35% background opacity) */}
                <div className="p-4.5 bg-slate-950/35 border border-cyan-500/20 rounded-2xl shadow-[0_8px_32px_rgba(6,182,212,0.06)] hover:scale-[1.01] transition-transform duration-200">
                  {category === 'domestic' ? (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1 overflow-visible animate-pulse-subtle">
                        <span className="text-cyan-200/80 text-[10px] font-bold uppercase tracking-wider">
                          {calcMode === 'rooftop' ? t.approxCostInstall : t.totalCost}
                        </span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2 py-0.5 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-sm">
                            ₹{(results.estimatedCost/100000).toFixed(2)}L + GST
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-emerald-300 text-[10px] font-bold uppercase tracking-wider">{t.govSubsidy}</span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2 py-0.5 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-sm">
                            -₹{results.subsidyAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                          {calcMode === 'rooftop' ? t.saveMoneyMonth : t.monthlySavings}
                        </span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2 py-0.5 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-sm">
                            ₹{results.monthlySavings.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-cyan-200/80 text-[10px] font-bold uppercase tracking-wider">
                          {calcMode === 'rooftop' ? t.timeToRecover : t.paybackPeriod}
                        </span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2 py-0.5 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-sm">
                            {results.paybackYears.toFixed(1)} {t.years}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <span className="text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                          {calcMode === 'rooftop' ? t.generationKwh : t.requiredArea}
                        </span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-sm">
                            {calcMode === 'rooftop' 
                              ? `${(results.recommendedSystemSize * 120).toFixed(0)} kWh`
                              : `${results.recommendedSystemSize * 100} sq.ft`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1 overflow-visible">
                        <span className="text-cyan-200/80 text-[10px] font-bold uppercase tracking-wider">
                          {language === 'bn' ? '৪. মোট প্রজেক্ট ব্যয়' : '4. Total Project Cost'}
                        </span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2 py-0.5 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-sm">
                            ₹{(results.estimatedCost/100000).toFixed(2)}L + GST
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[#22D3EE] text-[10px] font-bold uppercase tracking-wider">
                          {language === 'bn' ? '৫. ১ম বছরে কর সাশ্রয় (AD)' : '5. First Year Tax Savings (AD)'}
                        </span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2 py-0.5 rounded-lg text-xs sm:text-sm font-black text-black select-all inline-block shadow-sm" title="Indian Income tax act allows claiming 40% depreciation write-off on solar assets on first year. Calculated at typical 25% corporate tax bracket.">
                            ₹{Math.round(results.estimatedCost * 0.40 * 0.25).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                          {calcMode === 'rooftop' ? t.saveMoneyMonth : t.monthlySavings}
                        </span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2 py-0.5 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-sm">
                            ₹{results.monthlySavings.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-cyan-200/80 text-[10px] font-bold uppercase tracking-wider">
                          {calcMode === 'rooftop' ? t.timeToRecover : t.paybackPeriod}
                        </span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2 py-0.5 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-sm">
                            {results.paybackYears.toFixed(1)} {t.years}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <span className="text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                          {calcMode === 'rooftop' ? t.generationKwh : t.requiredArea}
                        </span>
                        <div className="mt-1">
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-sm">
                            {calcMode === 'rooftop' 
                              ? `${(results.recommendedSystemSize * 120).toFixed(0)} kWh`
                              : `${results.recommendedSystemSize * 100} sq.ft`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 space-y-3.5">
                  {/* Box 2: Financial Returns Spotlight Case (Translucent Dark Slate Box with 35% background opacity) */}
                  <div className="p-4.5 bg-slate-950/35 border border-cyan-500/30 rounded-2xl shadow-[0_8px_32px_rgba(6,182,212,0.12)] space-y-3.5 hover:scale-[1.01] transition-transform duration-200">
                    {category === 'domestic' ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-cyan-200 uppercase tracking-widest flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-cyan-400" /> 
                            {t.netInvestment}
                          </span>
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-3 py-1 rounded-lg text-base sm:text-xl font-black text-black select-all inline-block shadow-md">
                            ₹{results.netCost.toLocaleString()} + GST
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between bg-emerald-950/45 border border-emerald-500/20 rounded-xl px-3 py-2">
                          <span className="text-xs text-emerald-300 font-extrabold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" /> 
                            {t.yearlySavings}
                          </span>
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-md">
                            ₹{results.yearlySavings.toLocaleString()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-cyan-200 uppercase tracking-widest flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-cyan-400" /> 
                            {language === 'bn' ? '১ম বছর কর সাশ্রয় বাদে নেট ব্যয়' : 'Net Cost after Y1 tax savings'}
                          </span>
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-3 py-1 rounded-lg text-base sm:text-xl font-black text-black select-all inline-block shadow-md">
                            ₹{(results.estimatedCost - Math.round(results.estimatedCost * 0.40 * 0.25)).toLocaleString()} + GST
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between bg-emerald-950/45 border border-emerald-500/20 rounded-xl px-3 py-2">
                          <span className="text-xs text-emerald-300 font-extrabold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" /> 
                            {language === 'bn' ? 'বাৎসরিক বিদ্যুৎ বিল সাশ্রয়' : 'Annual Electricity Savings'}
                          </span>
                          <span style={{ color: '#000000', backgroundColor: '#ffffff' }} className="px-2.5 py-1 rounded-lg text-sm sm:text-base font-black text-black select-all inline-block shadow-md">
                            ₹{results.yearlySavings.toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Box 3: Dedicated Eco-Friendly Impact Showcase (Translucent Dark Slate Box with 35% background opacity) */}
                  <div className="p-4.5 bg-slate-950/35 border border-emerald-500/35 rounded-2xl shadow-[0_8px_32px_rgba(16,185,129,0.12)] space-y-3 hover:scale-[1.01] transition-transform duration-200">
                    <h5 className="text-[10px] font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-emerald-500/20 pb-2">
                      <Leaf className="w-3.5 h-3.5 text-emerald-400 inline" />
                      {language === 'bn' ? 'সবুজ শক্তির পরিবেশগত প্রভাব' : 'Green Power Eco Impact'}
                    </h5>
                    
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-300 font-bold">{t.annualCO2Reduction}</span>
                        <span className="text-[11px] font-black bg-emerald-400 text-emerald-950 border border-emerald-300/40 px-2.5 py-1 rounded-lg shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                          {environmentalImpact.co2Text}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-300 font-bold pl-2 border-l border-emerald-500/20">
                          {t.equivalentPlanting}
                        </span>
                        <span className="text-[11px] font-black bg-cyan-400 text-cyan-950 border border-cyan-300/40 px-2.5 py-1 rounded-lg shadow-[0_0_12px_rgba(34,211,238,0.3)]">
                          {environmentalImpact.treesText}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-300 font-bold flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-orange-400" /> 
                          {language === 'bn' ? 'কয়লা পোড়ানো লাঘব' : 'Coal Burn Avoided'}
                        </span>
                        <span className="text-[11px] font-black bg-orange-500 text-white border border-orange-400/40 px-2.5 py-1 rounded-lg shadow-[0_0_12px_rgba(249,115,22,0.3)]">
                          {environmentalImpact.coalText}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </motion.div>
        </div>

        {!(calcMode === 'rooftop' && (!roofArea || roofArea <= 0)) && !(calcMode === 'appliances' && selectedAppliancesCount === 0) && (
          <>
            <div className="flex flex-col gap-3 mb-4 mt-2">
              <div className="flex gap-3">
                <button 
                  onClick={handleDownloadPDF}
                  className="flex-1 py-3.5 rounded-[2rem] font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white hover:from-teal-700 hover:to-teal-800 transition-all shadow-md text-sm md:text-base border border-teal-500/20"
                >
                  <FileText className="w-5 h-5 text-teal-100" />
                  {language === 'bn' ? 'রিপোর্ট ডাউনলোড (PNG)' : 'Download Report (PNG)'}
                </button>

                <button 
                  onClick={handleShareWhatsApp}
                  className="flex-1 py-3.5 rounded-[2rem] font-bold flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba56] text-white transition-all shadow-md text-sm md:text-base"
                >
                  <Share2 className="w-5 h-5" />
                  {language === 'bn' ? 'হোয়াটসঅ্যাপে শেয়ার' : 'Share on WhatsApp'}
                </button>
              </div>
              <div className="mt-2 text-center text-[12px] md:text-[13px] text-gray-500 font-medium leading-relaxed pt-3 border-t border-gray-100">
                Disclaimer: Saurya Mitra is an independent AI platform simulating solar analytics based on regional tariffs. Actual installation criteria and central subsidies are subject to technical surveys and MNRE guidelines.
              </div>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-gray-100 flex items-center justify-between group cursor-help">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{t.lifetime}</p>
                  <p className="text-xs text-gray-500">{t.solarDuration}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {showCalcModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md"
            onClick={() => setShowCalcModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-stone-50 border border-stone-200 rounded-[2.5rem] p-6 md:p-10 text-stone-850 shadow-[0_30px_70px_rgba(0,0,0,0.3)] font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowCalcModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-stone-200/60 hover:bg-stone-300/80 text-stone-700 hover:text-stone-950 transition-all cursor-pointer border border-stone-300/50"
                title={language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              >
                <X className="w-4.5 h-4.5" />
              </button>

              <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-stone-200/80">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl border border-emerald-200/50">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-lg md:text-2xl leading-tight">
                    {language === 'bn' ? 'হিসাবের গাণিতিক পদ্ধতি ও স্বচ্ছতা' : 'Mathematical Transparency Breakdown'}
                  </h3>
                  <p className="text-xs md:text-sm text-stone-500 font-semibold uppercase tracking-wider mt-0.5">
                    {language === 'bn' ? 'সরাসরি লাইভ হিসাবের বিশদ বিবরণ' : 'Live Interactive Parameters & West Bengal Grid Math'}
                  </p>
                </div>
              </div>

              {/* Live Parameters Banner Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-stone-100 p-4.5 rounded-2xl border border-stone-200/60 mb-8 text-xs font-semibold text-stone-600">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-stone-400">{language === 'bn' ? 'সক্রিয় ক্যালকুলেটর ট্যাব' : 'Active Calculator Mode'}</span>
                  <p className="text-xs font-black text-stone-900 font-sans">
                    {calcMode === 'bill' && (language === 'bn' ? 'বিদ্যুৎ বিল স্ক্যানার' : 'AI Bill Reader')}
                    {calcMode === 'units' && (language === 'bn' ? 'বিল ইউনিট অনুযায়ী' : 'By Bill Units')}
                    {calcMode === 'rooftop' && (language === 'bn' ? 'ছাদের মাপে ক্যালকুলেটর' : 'Rooftop Area Calculator')}
                    {calcMode === 'appliances' && (language === 'bn' ? 'বৈদ্যুতিক সরঞ্জামাদি অনুযায়ী' : 'Calculate by Appliances')}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-stone-400">{language === 'bn' ? 'ছাদের ক্ষেত্রফল' : 'Live Rooftop Area'}</span>
                  <p className="text-xs font-black text-stone-900 font-mono">{calcBreakdownData.roofAreaNum || '0'} Sq.Ft</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-stone-400">{language === 'bn' ? 'মাসিক বিদ্যুৎ ব্যবহার' : 'Monthly Usage'}</span>
                  <p className="text-xs font-black text-stone-900 font-mono">{calcBreakdownData.unitsNum || '0'} kWh (Units)</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-stone-400">{language === 'bn' ? 'কানেক্টেড লোড' : 'Load Demand'}</span>
                  <p className="text-xs font-black text-stone-900 font-mono">{calcBreakdownData.loadNum || '0'} kW</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-8">
                  {/* Sizing Logic Block */}
                  <div className="bg-white p-6 rounded-3xl border border-stone-200/60 shadow-sm space-y-4">
                    <h4 className="flex items-center gap-2 font-black text-sm text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      {language === 'bn' ? '১. সোলার প্ল্যান্ট ক্যাপাসিটি সাইজিং' : '1. Solar Plant Capacity Sizing'}
                    </h4>
                    
                    {calcMode === 'rooftop' ? (
                      <div className="space-y-3 font-medium text-stone-700 text-xs sm:text-sm">
                        <p className="leading-relaxed">
                          {language === 'bn'
                            ? 'ছাদের ক্ষেত্রফলের ভিত্তিতে প্রতি ১০০ বর্গফুট সোলার স্থাপনের জন্য ১ কিলোওয়াট (kW) সিস্টেম সাইজ বরাদ্দ দেয় পশ্চিমবঙ্গ নবীকরণযোগ্য শক্তি উন্নয়ন সংস্থা (WBREDA)।'
                            : 'WBREDA assigns 1 kW of solar capacity for every 100 sq.ft of shadow-free rooftop space.'}
                        </p>
                        <div className="p-3 bg-stone-50 rounded-xl font-mono text-[11px] sm:text-xs text-stone-600 border border-stone-150 leading-loose">
                          <span className="font-bold text-stone-900 block border-b border-stone-200/50 pb-1 mb-1.5">{language === 'bn' ? 'গাণিতিক সূত্র:' : 'Mathematical Sizing Formula:'}</span>
                          Capacity = Rooftop Area / 100 Sq.Ft <br />
                          Live setup: {calcBreakdownData.roofAreaNum} sq.ft / 100 = <span className="text-emerald-600 font-black">{calcBreakdownData.capacity.toFixed(2)} kW</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 font-medium text-stone-700 text-xs sm:text-sm">
                        <p className="leading-relaxed">
                          {language === 'bn'
                            ? 'সঠিক সোলার সাইজিং আপনার বাৎসরিক ব্যবহৃত ইউনিটের সাথে সামঞ্জস্য রেখে নির্ধারণ করা হয়। ১ kW সোলার সাধারণত দিনে গড়ে ৪ ইউনিট বিদ্যুৎ উৎপন্ন করে, যা মাসে ১২০ ইউনিট হিসেবে গণনা করা হয়।'
                            : 'Recommended system capacity matches your annual usage. Standard solar plants produce roughly 4 units/day per kW, equivalent to 120 units/month.'}
                        </p>
                        <div className="p-3 bg-stone-50 rounded-xl font-mono text-[11px] sm:text-xs text-stone-600 border border-stone-150 leading-loose">
                          <span className="font-bold text-stone-900 block border-b border-stone-200/50 pb-1 mb-1.5">{language === 'bn' ? 'গাণিতিক সূত্র ও আপনার মানের হিসাব:' : 'Sizing Formula & Your Parameters:'}</span>
                          Estimated Size Required = Monthly Units / 120 units/kW <br />
                          Live demand: {calcBreakdownData.unitsNum} units / 120 = <span className="text-emerald-600 font-bold">{(calcBreakdownData.unitsNum / 120).toFixed(2)} kW</span>
                          <span className="block text-[10px] text-stone-400 mt-2 bg-stone-100 p-1 rounded font-sans leading-tight">
                            {language === 'bn'
                              ? `* সর্বোচ্চ ক্যাপাসিটি আপনার নির্বাচিত ছাদের সীমা (${(SOLAR_CONSTANTS as any).ROOF_LIMITS[roofSize]} kW - ${roofSize} সাইজ) দ্বারা সুরক্ষিত ও সীমাবদ্ধ।`
                              : `* Capped up to your structural roof size limits (${(SOLAR_CONSTANTS as any).ROOF_LIMITS[roofSize]} kW - ${roofSize} tier).`}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex bg-emerald-50 border border-emerald-150 rounded-xl p-3 items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <p className="text-xs font-bold text-emerald-950">
                        {language === 'bn'
                          ? `প্রস্তাবিত সোলার ক্ষমতা: ${calcBreakdownData.capacity.toFixed(1)} kW (কিলোওয়াট)`
                          : `Recommended Solar Capacity: ${calcBreakdownData.capacity.toFixed(1)} kW`}
                      </p>
                    </div>
                  </div>

                  {/* Subsidy structure */}
                  <div className="bg-white p-6 rounded-3xl border border-stone-200/60 shadow-sm space-y-4">
                    <h4 className="flex items-center gap-2 font-black text-sm text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2">
                      <Wallet className="w-4 h-4 text-emerald-500" />
                      {language === 'bn' ? '২. সরকারি সাবসিডি ও নেট প্রজেক্ট ব্যয়' : '2. Direct PM-Surya Subsidy & Net Cost'}
                    </h4>
                    <p className="text-xs sm:text-sm font-medium text-stone-700 leading-relaxed">
                      {language === 'bn'
                        ? 'কেন্দ্রীয় সরকারের PM-Surya Ghar প্রকল্প অনুযায়ী সরাসরি ব্যাঙ্ক অ্যাকাউন্টে প্রাপ্ত ফ্রি বিজলি ভর্তুকি নির্দেশিকা:'
                        : 'Under direct-to-bank-account PM-Surya Ghar: Muft Bijli Subsidy scheme guidelines:'}
                    </p>
                    
                    <div className="grid grid-cols-3 gap-2.5 text-[10px] sm:text-xs">
                      <div className="bg-stone-50 p-2 rounded-xl text-center border border-stone-150">
                        <p className="font-extrabold text-stone-900">1 kW</p>
                        <p className="text-emerald-600 font-black mt-0.5">₹30,000</p>
                      </div>
                      <div className="bg-stone-50 p-2 rounded-xl text-center border border-stone-150">
                        <p className="font-extrabold text-stone-900">2 kW</p>
                        <p className="text-emerald-600 font-black mt-0.5">₹60,000</p>
                      </div>
                      <div className="bg-stone-50 p-2 rounded-xl text-center border border-stone-150">
                        <p className="font-extrabold text-stone-900">3 kW or more</p>
                        <p className="text-emerald-600 font-black mt-0.5">₹78,000 max</p>
                      </div>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl font-mono text-[11px] sm:text-xs text-stone-600 border border-stone-150 leading-loose space-y-1.5">
                      <div className="flex justify-between border-b border-stone-200/40 pb-1">
                        <span>{language === 'bn' ? 'মোট সিস্টেম ক্রয়মূল্য:' : 'Gross System Investment:'}</span>
                        <span className="font-bold text-stone-900">₹{calcBreakdownData.totalCost.toLocaleString()} + GST</span>
                      </div>
                      <div className="flex justify-between border-b border-stone-200/40 pb-1 text-emerald-600">
                        <span>{language === 'bn' ? '(-) কেন্দ্রীয় সরকারি ভর্তুকি:' : '(-) PM-Surya Ghar Subsidy:'}</span>
                        <span className="font-black">- ₹{calcBreakdownData.subsidy.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between pt-1 text-stone-900 text-xs font-bold">
                        <span>{language === 'bn' ? 'আপনার পকেট থেকে নেট ব্যয়:' : 'Net Out-of-pocket Cost:'}</span>
                        <span className="font-black text-stone-900">₹{calcBreakdownData.netCost.toLocaleString()} + GST</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Grid tariffs & Net metering */}
                  <div className="bg-white p-6 rounded-3xl border border-stone-200/60 shadow-sm space-y-4">
                    <h4 className="flex items-center gap-2 font-black text-sm text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      {language === 'bn' ? '৩. পশ্চিমবঙ্গ বিদ্যুৎ ট্যারিফ ও নেট-মিটারিং' : '3. West Bengal Tariff Slabs & Net-Metering'}
                    </h4>
                    
                    <p className="text-xs sm:text-sm font-semibold text-stone-700">
                      {language === 'bn' ? `বর্তমান বিদ্যুৎ প্রদানকারী স্ল্যাব (${selectedState} - ${provider}):` : `Active Tariff Slabs (${selectedState} - ${provider}):`}
                    </p>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-150">
                      <div className="space-y-1">
                        {calcBreakdownData.slabs.length > 0 ? (
                          calcBreakdownData.slabs.map((slab: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-stone-200/40 last:border-0">
                              <span className="text-stone-500 font-semibold">
                                {slab.limit === Infinity ? (language === 'bn' ? '৩০০ ইউনিটের বেশি' : 'Above 300 units') : `${language === 'bn' ? 'অনূর্ধ্ব' : 'Up to'} ${slab.limit} units`}
                              </span>
                              <span className="font-mono font-bold text-amber-700">₹{slab.rate.toFixed(2)}/kWh</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex justify-between items-center text-xs py-1.5 font-bold">
                            <span>{language === 'bn' ? 'অ্যাভারেজ ফ্ল্যাট রেট' : 'Average Flat Tariff'}</span>
                            <span className="font-mono text-amber-700">₹{SOLAR_CONSTANTS.COST_PER_UNIT.toFixed(2)}/kWh</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-lime-50/60 border border-lime-200 rounded-2xl text-xs sm:text-sm text-lime-950 font-medium space-y-3">
                      <p className="font-bold border-b border-lime-300/40 pb-1.5 text-lime-900 uppercase tracking-wide text-[10px] sm:text-xs">
                        {language === 'bn' ? 'দ্বিমুখী নেট-মিটারিং ও অতিরিক্ত বিদ্যুৎ বিধি' : 'Bi-directional Net-Metering Calculus'}
                      </p>
                      
                      <div className="space-y-2">
                        <div className="flex items-start gap-1">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <p className="leading-snug">
                            <span className="font-bold text-stone-900 block">{language === 'bn' ? 'ক) ঘরের ব্যবহৃত অংশ সাশ্রয় (Fully Offset):' : 'A) Direct Savings (Fully Offset):'}</span>
                            {language === 'bn'
                              ? `সোলারের উৎপন্ন বিদ্যুৎ ঘরের ব্যবহারে খরচ হলে প্রতিটি ইউনিট পূর্ণ রিটেইল রেটে সাশ্রয় দেয়।`
                              : `Directly consumed units save 100% of the customer retail rate.`}
                            <span className="block font-mono text-xs text-stone-500 font-bold bg-white/60 p-1.5 rounded mt-1">
                              {calcBreakdownData.offsetUnits.toFixed(0)} kWh × ₹{calcBreakdownData.baselineRate.toFixed(2)} = ₹{calcBreakdownData.offsetSavings.toLocaleString(undefined, {maximumFractionDigits: 0})}/month
                            </span>
                          </p>
                        </div>

                        <div className="flex items-start gap-1">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <p className="leading-snug">
                            <span className="font-bold text-stone-900 block">{language === 'bn' ? 'খ) অতিরিক্ত উৎপন্ন সোলার বিদ্যুৎ বিক্রি (Grid Credit):' : 'B) Grid Export Credit (Excess Surplus):'}</span>
                            {language === 'bn'
                              ? `ছাদ থেকে উৎপন্ন আপনার ব্যবহৃত চাহিদার অতিরিক্ত বিদ্যুৎ স্বয়ংক্রিয়ভাবে সরকারী গ্রিডে যায়। WBERC নিয়মানুযায়ী প্রতি ইউনিট বিদ্যুৎ অতিরিক্ত রপ্তানি রেট ₹৩.৫০/kWh মূল্যে বিদ্যুৎ সংস্থা কিনে নেয়।`
                              : `Excess units flow outward to the utility grid, and are bought back with standard electricity board credit of ₹3.50/kWh.`}
                            <span className="block font-mono text-xs text-stone-500 font-bold bg-white/60 p-1.5 rounded mt-1">
                              {calcBreakdownData.exportUnits.toFixed(0)} kWh × ₹3.50 = ₹{calcBreakdownData.exportEarnings.toLocaleString(undefined, {maximumFractionDigits: 0})}/month
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payback period logic */}
                  <div className="bg-white p-6 rounded-3xl border border-stone-200/60 shadow-sm space-y-4">
                    <h4 className="flex items-center gap-2 font-black text-sm text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      {language === 'bn' ? '৪. বিনিয়োগ ফেরত প্রদানের সময়কাল (Payback Period)' : '4. Payback Period & Financial Yield'}
                    </h4>
                    
                    <p className="text-xs sm:text-sm font-medium text-stone-700 leading-relaxed">
                      {language === 'bn'
                        ? 'আপনার বিনিয়োগ কত দ্রুত ফেরত আসবে তা নিচে রিয়েল-টাইম সূত্রে দেখানো হলো:'
                        : 'See how rapidly your initial net project investment is returned through compiled savings:'}
                    </p>

                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/65 font-mono text-[11px] sm:text-xs text-stone-600 leading-loose">
                      <span className="font-bold text-stone-900 block border-b border-stone-200/40 pb-1 mb-2">{language === 'bn' ? 'পেব্যাক হিসেব সূত্র:' : 'Payback Period Equation:'}</span>
                      Payback Years = Net Cost / (Total Monthly Savings * 12) <br />
                      Live math: ₹{calcBreakdownData.netCost.toLocaleString(undefined, {maximumFractionDigits: 0})} / (₹{calcBreakdownData.totalMonthlyValue.toLocaleString(undefined, {maximumFractionDigits: 0})} * 12) = <span className="font-black text-emerald-600 text-sm sm:text-base">{calcBreakdownData.paybackYears.toFixed(1)} {language === 'bn' ? 'বছর' : 'Years'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special disclaimer or notes */}
              {calcMode === 'appliances' && (
                <div className="mt-8 bg-stone-100 p-5 rounded-3xl border border-stone-200/60 text-xs">
                  <h5 className="font-bold text-stone-900 mb-2 border-b border-stone-200/50 pb-1 block">
                    {language === 'bn' ? 'অ্যাপ্লায়েন্স লোড এগ্রিগেশন হিসেব' : 'Appliance Electrical Load Detailed Sum'}
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-300/40 font-bold text-stone-500">
                          <th className="pb-1">{language === 'bn' ? 'বৈদ্যুতিক সরঞ্জাম' : 'Appliance Name'}</th>
                          <th className="pb-1 text-center">{language === 'bn' ? 'সংখ্যা' : 'Count'}</th>
                          <th className="pb-1 text-right">{language === 'bn' ? 'ওয়াট' : 'Watts'}</th>
                          <th className="pb-1 text-right">{language === 'bn' ? 'ঘণ্টা/দিন' : 'Hours/Day'}</th>
                          <th className="pb-1 text-right">{language === 'bn' ? 'মাসিক ইউনিট (kWh)' : 'Monthly Consumption'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 font-semibold text-stone-700">
                        {appliances.filter(app => app.enabled).map((app) => {
                          const units = (app.power * app.hours * app.count * 30) / 1000;
                          return (
                            <tr key={app.id}>
                              <td className="py-2 text-stone-950">{app.name}</td>
                              <td className="py-2 text-center">{app.count}</td>
                              <td className="py-2 text-right">{app.power} W</td>
                              <td className="py-2 text-right">{app.hours} hrs</td>
                              <td className="py-2 text-right font-mono text-emerald-600 font-bold">{units.toFixed(1)} kWh</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex flex-col md:flex-row items-center justify-between pt-5 mt-6 border-t border-stone-200 text-stone-500 gap-4 text-xs">
                <p className="text-stone-400 font-medium">
                  {language === 'bn' ? 'তথ্য উৎস: WBERC পশ্চিমবঙ্গ সোলার মিশন ২০২৬' : 'Source: WBERC WB Solar guidelines 2026'}
                </p>
                <p className="font-bold text-emerald-600">
                  {language === 'bn' ? 'স্মার্ট ও পরিবেশ বান্ধব জীবন হোক আপনার।' : 'Powering West Bengal onwards with clear math.'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showInspectionSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
            onClick={() => setShowInspectionSuccessModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-md bg-[#0F2330] border border-cyan-500/20 rounded-[2rem] p-6 text-zinc-100 shadow-[0_30px_70px_rgba(0,18,30,0.8)] text-center font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setShowInspectionSuccessModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800/60 hover:bg-slate-700/80 text-zinc-400 hover:text-white transition-all cursor-pointer"
                title={language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400 border border-emerald-500/30">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>

              <h4 className="font-extrabold text-white text-lg mb-2">
                {language === 'bn' ? 'ফ্রি ছাদ পরিদর্শন বুকড্!' : 'Roof Inspection Booked!'}
              </h4>

              <p className="text-zinc-350 text-xs md:text-sm leading-relaxed mb-6 font-medium">
                {language === 'bn' 
                  ? '🎉 আপনার ফ্রি ছাদ পরিদর্শনের বুকিং সফলভাবে নথিবদ্ধ হয়েছে! আপনার জেলার সেরা ৩টি PM-Surya রেজিস্টার্ড ভেন্ডর খুব শীঘ্রই আপনার সাথে যোগাযোগ করবেন।'
                  : '🎉 Your Free Roof Inspection slot is successfully booked! Top 3 PM-Surya Ghar Registered solar partners in your district will call you shortly.'}
              </p>

              <button
                type="button"
                onClick={() => setShowInspectionSuccessModal(false)}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 hover:brightness-110 active:scale-98"
              >
                {language === 'bn' ? 'ঠিক আছে' : 'Awesome'}
              </button>
            </motion.div>
          </motion.div>
        )}

        {activeSystemModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md"
            onClick={() => setActiveSystemModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#FDFDFB] border border-stone-200 rounded-[2.5rem] p-6 md:p-10 text-stone-850 shadow-[0_30px_70px_rgba(43,38,20,0.18)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setActiveSystemModal(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-all cursor-pointer z-10"
                title={language === 'bn' ? 'বন্ধ করুন' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title Section */}
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-gradient-to-tr from-amber-500 to-amber-400 text-stone-900 rounded-2xl shadow-md">
                  {activeSystemModal === 'on-grid' ? (
                    <Zap className="w-6 h-6 text-white" />
                  ) : activeSystemModal === 'off-grid' ? (
                    <Battery className="w-6 h-6 text-white" />
                  ) : (
                    <Cpu className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider mb-1">
                    {activeSystemModal === 'on-grid' 
                      ? (language === 'bn' ? 'সৌর মিত্র স্মার্ট গাইড • গ্রিড-টাইড নিয়ম' : 'Saurya Mitra Smart Guide • Grid-Tied')
                      : activeSystemModal === 'off-grid'
                      ? (language === 'bn' ? 'সৌর মিত্র স্মার্ট গাইড • সম্পূর্ণ স্বাধীন' : 'Saurya Mitra Smart Guide • Off-Grid')
                      : (language === 'bn' ? 'saurya Mitra স্মার্ট গাইড • ব্যাকআপ এবং গ্রিড' : 'Saurya Mitra Smart Guide • Hybrid')}
                  </div>
                  <h4 className="font-extrabold text-stone-900 text-xl md:text-2xl tracking-tight leading-tight">
                    {activeSystemModal === 'on-grid' && (language === 'bn' ? 'নেট মিটারিং ও অন-গ্রিড গাইডলাইন' : 'Net Metering & On-Grid Guidelines')}
                    {activeSystemModal === 'off-grid' && (language === 'bn' ? 'অফ-গ্রিড ও ব্যাটারি ব্যাকআপ গাইডলাইন' : 'Off-Grid & Battery Backup Guidelines')}
                    {activeSystemModal === 'hybrid' && (language === 'bn' ? 'হাইব্রিড সোলার ও দ্বিমুখী স্মার্ট প্রবাহ গাইডলাইন' : 'Hybrid Solar & Smart Routing Guidelines')}
                  </h4>
                </div>
              </div>

              {/* Contents Frame */}
              <div className="space-y-8 font-sans text-stone-700 leading-relaxed">
                
                {/* 1. Core Value */}
                <div className="space-y-2">
                  <h5 className="font-bold text-stone-800 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">১</span>
                    {language === 'bn' ? 'সহজ ভাষায় মূল কথা (THE CORE VALUE)' : 'THE CORE VALUE'}
                  </h5>
                  <div className="bg-amber-50/40 border-l-4 border-amber-400 p-5 rounded-r-3xl text-stone-800 italic font-medium text-sm md:text-[15px] shadow-sm leading-relaxed">
                    {activeSystemModal === 'on-grid' && (
                      language === 'bn' 
                        ? `"অন-গ্রিড সোলারে সরকারি গ্রিড (CESC/WBSEDCL) আপনার জন্য একটি 'ব্যাঙ্ক'-এর মতো কাজ করে। দিনে আপনার প্যানেলের বাড়তি বিদ্যুৎ গ্রিডে জমা হবে, আর রাতে গ্রিড থেকে আপনি বিদ্যুৎ ফেরত নেবেন।"`
                        : `"In an on-grid system, the public electricity grid acts exactly like a 'bank' for you. Extra solar power generated by your panels is deposited in the grid during the day, and withdrawn back during the night."`
                    )}
                    {activeSystemModal === 'off-grid' && (
                      language === 'bn'
                        ? `"অফ-গ্রিড সোলার সম্পূর্ণ স্বাধীন। দিনে উৎপাদিত সৌরশক্তি একটি শক্তিশালী ব্যাটারি ব্যাঙ্ক চার্জ করে। রাতে বা লোডশেডিংয়ের সময় এই ব্যাটারি থেকেই বাড়ি চালানো হয়, কোনো সরকারি লাইনের প্রয়োজন পড়ে না।"`
                        : `"Off-grid solar operates 100% independently of the public grid. Daytime sunlight is stored directly inside a heavy-duty battery bank, which becomes your exclusive, uninterrupted power source throughout the night."`
                    )}
                    {activeSystemModal === 'hybrid' && (
                      language === 'bn'
                        ? `"হাইব্রিড সোলার হলো দুই জগতের সেরা মেলবন্ধন। এটি দিনে প্যানেলের বিদ্যুৎ দিয়ে একদিকে আপনার প্রয়োজনীয় ব্যাকআপ ব্যাটারি চার্জ রাখে এবং অতিরিক্ত অবশিষ্টাংশ সরকারি গ্রিডে পাঠিয়ে আপনার বিদ্যুৎ বিল একেবারেই কমিয়ে আনে।"`
                        : `"Hybrid solar combines the best of both worlds. The intelligent system automatically keeps your battery bank topped up for blackout backup, whilst feeding any further daytime surplus to the utility grid to drive your monthly bill down."`
                    )}
                  </div>
                </div>

                {/* TECHNOLOGY DIAGRAM - INTERACTIVE SVG */}
                <div className="space-y-2">
                  <h5 className="font-bold text-stone-800 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">২</span>
                    {language === 'bn' ? 'প্রযুক্তিগত ডায়াগ্রাম (TECHNOLOGY DIAGRAM)' : 'TECHNOLOGY DIAGRAM'}
                  </h5>
                  <div className="bg-stone-50 rounded-3xl p-4 md:p-6 border border-stone-200/80 overflow-hidden shadow-inner">
                    <div className="w-full overflow-x-auto select-none">
                      
                      {/* ON GRID DIAGRAM */}
                      {activeSystemModal === 'on-grid' && (
                        <svg viewBox="0 0 800 400" className="w-full min-w-[700px] h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="sunGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FFF1BE" stopOpacity="1" />
                              <stop offset="100%" stopColor="#F59E0B" stopOpacity="1" />
                            </linearGradient>
                            <linearGradient id="panelGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#7DD3FC" />
                              <stop offset="100%" stopColor="#0369A1" />
                            </linearGradient>
                            <linearGradient id="exportGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#34D399" />
                              <stop offset="100%" stopColor="#059669" />
                            </linearGradient>
                            <linearGradient id="importGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#60A5FA" />
                              <stop offset="100%" stopColor="#2563EB" />
                            </linearGradient>
                            <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="2.5" result="blur" />
                              <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                          </defs>

                          <g opacity="0.12">
                            <line x1="0" y1="100" x2="800" y2="100" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="0" y1="200" x2="800" y2="200" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="0" y1="300" x2="800" y2="300" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="200" y1="0" x2="200" y2="400" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="400" y1="0" x2="400" y2="400" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="600" y1="0" x2="600" y2="400" stroke="#78716C" strokeWidth="0.5" />
                          </g>

                          {/* Sun */}
                          <g transform="translate(80, 70)">
                            <circle cx="0" cy="0" r="22" fill="url(#sunGlow)" filter="url(#subtleGlow)" />
                            <line x1="0" y1="-28" x2="0" y2="-36" stroke="#F59E0B" strokeWidth="3" />
                            <line x1="0" y1="28" x2="0" y2="36" stroke="#F59E0B" strokeWidth="3" />
                            <line x1="-28" y1="0" x2="-36" y2="0" stroke="#F59E0B" strokeWidth="3" />
                            <line x1="28" y1="0" x2="36" y2="0" stroke="#F59E0B" strokeWidth="3" />
                          </g>
                          <text x="80" y="125" fill="#78716C" fontSize="10" fontWeight="bold" textAnchor="middle">SOLAR RAY</text>

                          {/* Power flow line */}
                          <path d="M 80,135 Q 85,155 85,175" stroke="#F59E0B" strokeWidth="3" markerEnd="url(#arrow-sun)" strokeDasharray="4 4" />

                          {/* Solar Panels */}
                          <g transform="translate(45, 180)">
                            <line x1="40" y1="60" x2="40" y2="85" stroke="#78716C" strokeWidth="4.5" />
                            <line x1="60" y1="60" x2="60" y2="85" stroke="#78716C" strokeWidth="4.5" />
                            <line x1="20" y1="85" x2="80" y2="85" stroke="#78716C" strokeWidth="4.5" />
                            <polygon points="10,60 90,60 75,10 25,10" fill="url(#panelGlow)" stroke="#0284C7" strokeWidth="2" />
                            <line x1="35" y1="10" x2="25" y2="60" stroke="#38BDF8" strokeWidth="1.2" />
                            <line x1="50" y1="10" x2="50" y2="60" stroke="#38BDF8" strokeWidth="1.2" />
                            <line x1="65" y1="10" x2="75" y2="60" stroke="#38BDF8" strokeWidth="1.2" />
                            <line x1="21" y1="23" x2="79" y2="23" stroke="#38BDF8" strokeWidth="1.2" />
                            <line x1="17" y1="36" x2="83" y2="36" stroke="#38BDF8" strokeWidth="1.2" />
                            <line x1="13" y1="48" x2="87" y2="48" stroke="#38BDF8" strokeWidth="1.2" />
                          </g>
                          <text x="92" y="285" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'সোলার প্যানেল' : 'SOLAR PANELS'}
                          </text>

                          {/* DC flow */}
                          <path d="M 95,240 C 120,240 120,315 152,315" stroke="#F59E0B" strokeWidth="3" fill="none" markerEnd="url(#arrow-generic)" />
                          <text x="135" y="278" fill="#D97706" fontSize="9" fontWeight="extrabold" textAnchor="middle">DC</text>

                          {/* Inverter */}
                          <g transform="translate(160, 280)">
                            <rect x="0" y="0" width="70" height="75" rx="14" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" />
                            <rect x="7" y="7" width="56" height="61" rx="10" fill="#F1F5F9" />
                            <path d="M 15,38 Q 23,20 31,38 T 47,38 T 55,38" stroke="#0EA5E9" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                            <circle cx="16" cy="18" r="3.5" fill="#22C55E" />
                            <circle cx="28" cy="18" r="3.5" fill="#3B82F6" />
                            <line x1="15" y1="52" x2="55" y2="52" stroke="#CBD5E1" strokeWidth="3" />
                            <line x1="15" y1="59" x2="55" y2="59" stroke="#CBD5E1" strokeWidth="3" />
                          </g>
                          <text x="195" y="372" fill="#334155" fontSize="10" fontWeight="extrabold" textAnchor="middle">
                            {language === 'bn' ? 'ইনভার্টার (Inverter)' : 'DC-AC INVERTER'}
                          </text>

                          {/* AC flow */}
                          <path d="M 230,318 C 255,318 255,255 285,255" stroke="#10B981" strokeWidth="3" fill="none" markerEnd="url(#arrow-generic)" />
                          <text x="255" y="295" fill="#059669" fontSize="9" fontWeight="extrabold" textAnchor="middle">AC</text>

                          {/* Cozy House */}
                          <g transform="translate(290, 150)">
                            <polygon points="10,45 80,5 150,45" fill="#E11D48" />
                            <rect x="20" y="45" width="120" height="110" rx="12" fill="#F8FAFC" stroke="#BAC1CC" strokeWidth="2.5" />
                            <rect x="35" y="65" width="28" height="32" rx="6" fill="#BAE6FD" opacity="0.9" />
                            <line x1="49" y1="65" x2="49" y2="97" stroke="#0284C7" strokeWidth="1.5" />
                            <line x1="35" y1="81" x2="63" y2="81" stroke="#0284C7" strokeWidth="1.5" />
                            <rect x="97" y="65" width="28" height="32" rx="6" fill="#BAE6FD" opacity="0.9" />
                            <line x1="111" y1="65" x2="111" y2="97" stroke="#0284C7" strokeWidth="1.5" />
                            <line x1="97" y1="81" x2="125" y2="81" stroke="#0284C7" strokeWidth="1.5" />
                            <rect x="66" y="105" width="28" height="50" rx="4" fill="#64748B" />
                            <circle cx="72" cy="130" r="2.5" fill="#F59E0B" />
                          </g>
                          <text x="370" y="325" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'ব্যবহারকারী বাড়ি (Home)' : 'ENERGY USED HOME'}
                          </text>

                          {/* Bi-Directional smart meter */}
                          <g transform="translate(515, 170)">
                            <circle cx="45" cy="45" r="44" fill="#F8FAFC" stroke="#64748B" strokeWidth="2.5" />
                            <circle cx="45" cy="45" r="38" fill="#0F172A" stroke="#1E293B" strokeWidth="2" />
                            <circle cx="45" cy="18" r="4" fill="#0EA5E9" filter="url(#subtleGlow)" />
                            <rect x="18" y="28" width="54" height="22" rx="4" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
                            <text x="45" y="43" fill="#10B981" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle" filter="url(#subtleGlow)">-120 kWh</text>
                            <path d="M 23,60 Q 33,54 45,54 T 67,60" stroke="#3B82F6" strokeWidth="2.2" fill="none" />
                            <path d="M 67,65 Q 57,71 45,71 T 23,65" stroke="#10B981" strokeWidth="2.2" fill="none" />
                            <polygon points="68,60 62,56 65,62" fill="#3B82F6" />
                            <polygon points="22,65 28,69 25,63" fill="#10B981" />
                          </g>
                          <text x="560" y="280" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'নেট মিটার (Net Meter)' : 'BI-DIRECTIONAL METER'}
                          </text>

                          {/* Electric Power Grid */}
                          <g transform="translate(700, 80)">
                            <line x1="20" y1="40" x2="20" y2="240" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
                            <line x1="-20" y1="65" x2="60" y2="65" stroke="#475569" strokeWidth="4" />
                            <line x1="-10" y1="85" x2="50" y2="85" stroke="#475569" strokeWidth="4" />
                            <rect x="-18" y="53" width="6" height="12" fill="#E11D48" rx="1.5" />
                            <rect x="17" y="53" width="6" height="12" fill="#E11D48" rx="1.5" />
                            <rect x="52" y="53" width="6" height="12" fill="#E11D48" rx="1.5" />
                            <rect x="-8" y="73" width="6" height="12" fill="#E11D48" rx="1.5" />
                            <rect x="42" y="73" width="6" height="12" fill="#E11D48" rx="1.5" />
                            <rect x="-5" y="110" width="30" height="45" rx="6" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
                          </g>
                          <text x="720" y="340" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'সরকারি গ্রিড (Grid)' : 'POWER GRID'}
                          </text>

                          {/* Export/Import Arrows */}
                          <g>
                            <path d="M 435,210 L 510,210" stroke="url(#exportGlow)" strokeWidth="3.5" markerEnd="url(#arrow-export)" />
                            <circle cx="475" cy="210" r="4.5" fill="#10B981" filter="url(#subtleGlow)" />
                            <path d="M 606,210 L 685,210" stroke="url(#exportGlow)" strokeWidth="3.5" markerEnd="url(#arrow-export)" />
                            <circle cx="645" cy="210" r="4.5" fill="#10B981" filter="url(#subtleGlow)" />
                            <rect x="524" y="112" width="72" height="18" rx="9" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="1" />
                            <text x="560" y="125" fill="#047857" fontSize="9" fontWeight="black" textAnchor="middle">
                              {language === 'bn' ? 'রপ্তানি (Export)' : 'Surplus Export'}
                            </text>
                          </g>

                          <g>
                            <path d="M 685,235 L 610,235" stroke="url(#importGlow)" strokeWidth="3.5" markerEnd="url(#arrow-import)" />
                            <circle cx="645" cy="235" r="4.5" fill="#3B82F6" filter="url(#subtleGlow)" />
                            <path d="M 510,235 L 435,235" stroke="url(#importGlow)" strokeWidth="3.5" markerEnd="url(#arrow-import)" />
                            <circle cx="475" cy="235" r="4.5" fill="#3B82F6" filter="url(#subtleGlow)" />
                            <rect x="524" y="136" width="72" height="18" rx="9" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1" />
                            <text x="560" y="149" fill="#1D4ED8" fontSize="9" fontWeight="black" textAnchor="middle">
                              {language === 'bn' ? 'আমদানি (Import)' : 'Grid Import'}
                            </text>
                          </g>

                          <defs>
                            <marker id="arrow-sun" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" />
                            </marker>
                            <marker id="arrow-generic" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
                            </marker>
                            <marker id="arrow-export" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
                            </marker>
                            <marker id="arrow-import" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                              <path d="M 10 1 L 0 5 L 10 9 z" fill="#2563EB" />
                            </marker>
                          </defs>
                        </svg>
                      )}

                      {/* OFF GRID DIAGRAM */}
                      {activeSystemModal === 'off-grid' && (
                        <svg viewBox="0 0 800 400" className="w-full min-w-[700px] h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="sunGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FFF1BE" />
                              <stop offset="100%" stopColor="#F59E0B" />
                            </linearGradient>
                            <linearGradient id="panelGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#7DD3FC" />
                              <stop offset="100%" stopColor="#0369A1" />
                            </linearGradient>
                            <linearGradient id="batteryFlowGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FB923C" />
                              <stop offset="100%" stopColor="#EA580C" />
                            </linearGradient>
                            <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="2.5" result="blur" />
                              <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                          </defs>

                          <g opacity="0.12">
                            <line x1="0" y1="100" x2="800" y2="100" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="0" y1="200" x2="800" y2="200" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="0" y1="300" x2="800" y2="300" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="200" y1="0" x2="200" y2="400" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="400" y1="0" x2="400" y2="400" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="600" y1="0" x2="600" y2="400" stroke="#78716C" strokeWidth="0.5" />
                          </g>

                          {/* Sun */}
                          <g transform="translate(80, 70)">
                            <circle cx="0" cy="0" r="22" fill="url(#sunGlow)" filter="url(#subtleGlow)" />
                            <line x1="0" y1="-28" x2="0" y2="-36" stroke="#F59E0B" strokeWidth="3" />
                            <line x1="0" y1="28" x2="0" y2="36" stroke="#F59E0B" strokeWidth="3" />
                          </g>
                          <text x="80" y="125" fill="#78716C" fontSize="10" fontWeight="bold" textAnchor="middle">SOLAR RAY</text>

                          {/* Power flow line */}
                          <path d="M 80,135 Q 85,155 85,175" stroke="#F59E0B" strokeWidth="3" markerEnd="url(#arrow-sun)" strokeDasharray="4 4" />

                          {/* Solar Panels */}
                          <g transform="translate(45, 180)">
                            <line x1="40" y1="60" x2="40" y2="85" stroke="#78716C" strokeWidth="4.5" />
                            <line x1="60" y1="60" x2="60" y2="85" stroke="#78716C" strokeWidth="4.5" />
                            <line x1="20" y1="85" x2="80" y2="85" stroke="#78716C" strokeWidth="4.5" />
                            <polygon points="10,60 90,60 75,10 25,10" fill="url(#panelGlow)" stroke="#0284C7" strokeWidth="2" />
                          </g>
                          <text x="92" y="285" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'সোলার প্যানেল' : 'SOLAR PANELS'}
                          </text>

                          {/* DC flow */}
                          <path d="M 95,240 C 120,240 120,285 152,285" stroke="#F59E0B" strokeWidth="3" fill="none" markerEnd="url(#arrow-off)" />
                          <text x="135" y="260" fill="#D97706" fontSize="9" fontWeight="extrabold" textAnchor="middle">DC SOLAR</text>

                          {/* MPPT Controller */}
                          <g transform="translate(160, 245)">
                            <rect x="0" y="0" width="85" height="90" rx="16" fill="#F8FAFC" stroke="#64748B" strokeWidth="2" />
                            <rect x="10" y="10" width="65" height="35" rx="6" fill="#0F172A" />
                            <text x="42" y="25" fill="#38BDF8" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle" filter="url(#subtleGlow)">48V MPPT</text>
                            <text x="42" y="38" fill="#10B981" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">CHARGING</text>
                            <circle cx="20" cy="65" r="4" fill="#10B981" />
                            <circle cx="42" cy="65" r="4" fill="#F59E0B" />
                            <circle cx="65" cy="65" r="4" fill="#64748B" />
                          </g>
                          <text x="202" y="355" fill="#334155" fontSize="10" fontWeight="extrabold" textAnchor="middle">
                            {language === 'bn' ? 'স্মার্ট চার্জ কন্ট্রোলার' : 'MPPT CHARGE HUB'}
                          </text>

                          {/* Battery flow */}
                          <path d="M 245,290 C 290,290 290,320 340,320" stroke="url(#batteryFlowGlow)" strokeWidth="3.5" fill="none" markerEnd="url(#arrow-off)" />
                          <text x="290" y="308" fill="#C2410C" fontSize="9" fontWeight="extrabold" textAnchor="middle">BATTERY FLOW</text>

                          {/* Battery Bank Storage */}
                          <g transform="translate(350, 270)">
                            <rect x="0" y="0" width="105" height="85" rx="14" fill="#1E293B" stroke="#475569" strokeWidth="2" />
                            <rect x="12" y="12" width="81" height="14" rx="4" fill="#0F172A" />
                            <rect x="12" y="32" width="81" height="14" rx="4" fill="#0F172A" />
                            <rect x="12" y="52" width="81" height="20" rx="4" fill="#0F172A" />
                            <text x="52" y="22" fill="#E2E8F0" fontSize="7" fontWeight="bold" textAnchor="middle">LITHIUM LiFePO4</text>
                            <text x="52" y="42" fill="#94A3B8" fontSize="7" fontWeight="bold" textAnchor="middle">VOLTAGE: 48.2 V</text>
                            <rect x="20" y="57" width="65" height="10" rx="2" fill="#1F2937" />
                            <rect x="20" y="57" width="55" height="10" rx="2" fill="#10B981" filter="url(#subtleGlow)" />
                            <text x="52" y="65" fill="#FFFFFF" fontSize="7" fontWeight="black" textAnchor="middle">91% STORED</text>
                            <circle cx="15" cy="-2" r="3" fill="#E11D48" />
                            <circle cx="90" cy="-2" r="3" fill="#2563EB" />
                          </g>
                          <text x="402" y="372" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'ব্যাটারি ব্যাংক (Storage)' : 'BATTERY BANK (LiFePO4)'}
                          </text>

                          {/* AC flow to house */}
                          <path d="M 245,260 C 275,260 275,190 325,190" stroke="#10B981" strokeWidth="3" fill="none" markerEnd="url(#arrow-off)" />
                          <text x="285" y="220" fill="#059669" fontSize="9" fontWeight="extrabold" textAnchor="middle">AC SAFE POWER</text>

                          {/* Cozy House */}
                          <g transform="translate(330, 80)">
                            <polygon points="10,45 80,5 150,45" fill="#0369A1" />
                            <rect x="20" y="45" width="120" height="110" rx="12" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2.5" />
                            <rect x="35" y="65" width="28" height="32" rx="6" fill="#F1F5F9" opacity="0.9" />
                            <rect x="66" y="105" width="28" height="50" rx="4" fill="#475569" />
                            <circle cx="72" cy="130" r="2.5" fill="#F59E0B" />
                          </g>
                          <text x="400" y="255" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'সম্পূর্ণ স্বাধীন বাড়ি' : 'INDEPENDENT LOADS'}
                          </text>

                          {/* Off Grid Notification Box */}
                          <g transform="translate(520, 160)">
                            <rect x="0" y="0" width="250" height="110" rx="20" fill="#FFF1F2" stroke="#FDA4AF" strokeWidth="1.5" />
                            <text x="125" y="30" fill="#9F1239" fontSize="11" fontWeight="black" textAnchor="middle">❌ NO PUBLIC GRID CONNECTION</text>
                            <text x="125" y="55" fill="#E11D48" fontSize="10" fontWeight="bold" textAnchor="middle">
                              {language === 'bn' ? '১০০% গ্রিড থেকে মুক্ত স্বতন্ত্র সোলার' : '100% Standalone Self-Sufficient'}
                            </text>
                            <text x="125" y="75" fill="#475569" fontSize="9" fontWeight="medium" textAnchor="middle">
                              {language === 'bn' ? 'বিদ্যুৎ বিপর্যয়েও আপনার পাওয়ার সচল' : 'Keeps lights on during blackouts'}
                            </text>
                            <text x="125" y="92" fill="#059669" fontSize="9" fontWeight="bold" textAnchor="middle">
                              {language === 'bn' ? 'ফিক্সড মিটার চার্জ শূন্য' : 'Zero Monthly Fixed Charges'}
                            </text>
                          </g>

                          <defs>
                            <marker id="arrow-sun" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" />
                            </marker>
                            <marker id="arrow-off" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
                            </marker>
                          </defs>
                        </svg>
                      )}

                      {/* HYBRID DIAGRAM */}
                      {activeSystemModal === 'hybrid' && (
                        <svg viewBox="0 0 800 400" className="w-full min-w-[700px] h-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="sunGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FFF1BE" />
                              <stop offset="100%" stopColor="#F59E0B" />
                            </linearGradient>
                            <linearGradient id="panelGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#7DD3FC" />
                              <stop offset="100%" stopColor="#0369A1" />
                            </linearGradient>
                            <linearGradient id="batteryFlowGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FB923C" />
                              <stop offset="100%" stopColor="#EA580C" />
                            </linearGradient>
                            <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
                              <feGaussianBlur stdDeviation="2.5" result="blur" />
                              <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                          </defs>

                          <g opacity="0.12">
                            <line x1="0" y1="100" x2="800" y2="100" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="0" y1="200" x2="800" y2="200" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="0" y1="300" x2="800" y2="300" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="200" y1="0" x2="200" y2="400" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="400" y1="0" x2="400" y2="400" stroke="#78716C" strokeWidth="0.5" />
                            <line x1="600" y1="0" x2="600" y2="400" stroke="#78716C" strokeWidth="0.5" />
                          </g>

                          {/* Sun */}
                          <g transform="translate(80, 70)">
                            <circle cx="0" cy="0" r="22" fill="url(#sunGlow)" filter="url(#subtleGlow)" />
                            <line x1="0" y1="-28" x2="0" y2="-36" stroke="#F59E0B" strokeWidth="3" />
                            <line x1="0" y1="28" x2="0" y2="36" stroke="#F59E0B" strokeWidth="3" />
                          </g>
                          <text x="80" y="125" fill="#78716C" fontSize="10" fontWeight="bold" textAnchor="middle">SOLAR RAY</text>

                          {/* Power flow line */}
                          <path d="M 80,135 Q 85,155 85,175" stroke="#F59E0B" strokeWidth="3" markerEnd="url(#arrow-sun)" strokeDasharray="4 4" />

                          {/* Solar Panels */}
                          <g transform="translate(45, 180)">
                            <line x1="40" y1="60" x2="40" y2="85" stroke="#78716C" strokeWidth="4.5" />
                            <polygon points="10,60 90,60 75,10 25,10" fill="url(#panelGlow)" stroke="#0284C7" strokeWidth="2" />
                          </g>
                          <text x="92" y="285" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'সোলার প্যানেল' : 'SOLAR PANELS'}
                          </text>

                          {/* DC flow */}
                          <path d="M 95,240 C 120,240 120,285 152,285" stroke="#F59E0B" strokeWidth="3" fill="none" markerEnd="url(#arrow-hybridb)" />

                          {/* Intelligent Hybrid Inverter */}
                          <g transform="translate(160, 245)">
                            <rect x="0" y="0" width="105" height="95" rx="18" fill="#F0F9FF" stroke="#0EA5E9" strokeWidth="2.5" />
                            <rect x="10" y="10" width="85" height="38" rx="6" fill="#0F172A" />
                            <text x="52" y="24" fill="#38BDF8" fontSize="8" fontWeight="black" fontFamily="monospace" textAnchor="middle" filter="url(#subtleGlow)">HYBRID BRAIN</text>
                            <text x="52" y="38" fill="#10B981" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">SMART FLOWS</text>
                            <circle cx="22" cy="65" r="4.5" fill="#22C55E" />
                            <circle cx="52" cy="65" r="4.5" fill="#3B82F6" />
                            <circle cx="82" cy="65" r="4.5" fill="#F59E0B" />
                          </g>
                          <text x="212" y="360" fill="#1E3A8A" fontSize="10" fontWeight="extrabold" textAnchor="middle">
                            {language === 'bn' ? 'হাইব্রিড ইনভার্টার' : 'SMART HYBRID INVERTER'}
                          </text>

                          {/* Battery storage link */}
                          <path d="M 212,342 L 212,375" stroke="url(#batteryFlowGlow)" strokeWidth="3" fill="none" />
                          <circle cx="212" cy="358" r="4" fill="#EA580C" filter="url(#subtleGlow)" />

                          {/* Battery slot */}
                          <g transform="translate(165, 378)">
                            <rect x="0" y="0" width="94" height="20" rx="4" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
                            <text x="47" y="12" fill="#34D399" fontSize="8" fontWeight="black" fontFamily="monospace" textAnchor="middle">🔋 BATTERY (81%)</text>
                          </g>

                          {/* AC flow to house */}
                          <path d="M 265,265 C 295,265 295,190 325,190" stroke="#10B981" strokeWidth="3" fill="none" markerEnd="url(#arrow-hybridb)" />

                          {/* Cozy House */}
                          <g transform="translate(330, 80)">
                            <polygon points="10,45 80,5 150,45" fill="#E11D48" />
                            <rect x="20" y="45" width="120" height="110" rx="12" fill="#F8FAFC" stroke="#BAC1CC" strokeWidth="2.5" />
                            <rect x="66" y="105" width="28" height="50" rx="4" fill="#64748B" />
                            <circle cx="72" cy="130" r="2.5" fill="#F59E0B" />
                          </g>
                          <text x="400" y="255" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'সুরক্ষিত এনার্জী বাড়ি' : 'SECURED LOADS'}
                          </text>

                          {/* Bi-Directional Net Meter */}
                          <g transform="translate(515, 170)">
                            <circle cx="45" cy="45" r="44" fill="#F8FAFC" stroke="#64748B" strokeWidth="2.5" />
                            <circle cx="45" cy="45" r="38" fill="#0F172A" stroke="#1E293B" strokeWidth="2" />
                            <rect x="18" y="28" width="54" height="22" rx="4" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
                            <text x="45" y="43" fill="#10B981" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle" filter="url(#subtleGlow)">HYB-MTR</text>
                            <path d="M 23,60 Q 33,54 45,54 T 67,60" stroke="#3B82F6" strokeWidth="2.2" fill="none" />
                            <path d="M 67,65 Q 57,71 45,71 T 23,65" stroke="#10B981" strokeWidth="2.2" fill="none" />
                          </g>
                          <text x="560" y="280" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'নেট মিটার (Net Meter)' : 'SMART METER LINK'}
                          </text>

                          {/* Grid */}
                          <g transform="translate(700, 80)">
                            <line x1="20" y1="40" x2="20" y2="240" stroke="#475569" strokeWidth="5.5" strokeLinecap="round" />
                          </g>
                          <text x="720" y="340" fill="#1E293B" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {language === 'bn' ? 'সরকারি গ্রিড (Grid)' : 'POWER GRID'}
                          </text>

                          {/* Interactive arrows */}
                          <g>
                            <path d="M 435,210 L 510,210" stroke="#059669" strokeWidth="2.5" markerEnd="url(#arrow-hybridb)" />
                            <path d="M 606,210 L 685,210" stroke="#059669" strokeWidth="2.5" markerEnd="url(#arrow-hybridb)" />
                            <path d="M 685,235 L 610,235" stroke="#2563EB" strokeWidth="2.5" markerEnd="url(#arrow-hybridm)" opacity="0.8" />
                            <path d="M 510,235 L 435,235" stroke="#2563EB" strokeWidth="2.5" markerEnd="url(#arrow-hybridm)" opacity="0.8" />
                            <rect x="522" y="125" width="76" height="24" rx="6" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1" />
                            <text x="560" y="140" fill="#15803D" fontSize="8" fontWeight="black" textAnchor="middle">
                              {language === 'bn' ? 'স্মার্ট এক্সপোর্ট' : 'Surplus Grid Transfer'}
                            </text>
                          </g>

                          <defs>
                            <marker id="arrow-sun" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" />
                            </marker>
                            <marker id="arrow-hybridb" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
                            </marker>
                            <marker id="arrow-hybridm" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                              <path d="M 10 1 L 0 5 L 10 9 z" fill="#2563EB" />
                            </marker>
                          </defs>
                        </svg>
                      )}

                    </div>

                    <div className="flex flex-wrap justify-center gap-6 mt-5 text-[11px] font-semibold border-t border-stone-200/55 pt-4">
                      {activeSystemModal === 'on-grid' && (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-400"></div>
                            <span className="text-emerald-700">{language === 'bn' ? 'রপ্তানি (Export): অতিরিক্ত সৌর বিদ্যুৎ গ্রিডে প্রেরণ' : 'EXPORT: Solar surplus sent to Grid'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-blue-400"></div>
                            <span className="text-blue-700">{language === 'bn' ? 'আমদানি (Import): গ্রিড থেকে বিদ্যুৎ গ্রহণ' : 'IMPORT: Drawn from public Grid'}</span>
                          </div>
                        </>
                      )}
                      {activeSystemModal === 'off-grid' && (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-orange-500 border border-orange-400"></div>
                            <span className="text-orange-700">{language === 'bn' ? 'সঞ্চয়: ব্যাটারি ব্যাঙ্ক চার্জ করা হচ্ছে' : 'STORAGE: Solar battery charger cycle'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-400"></div>
                            <span className="text-emerald-700">{language === 'bn' ? 'ডিসচার্জ: বাড়ি চালানোর জন্য ব্যাটারি ব্যবহার' : 'DISCHARGE: Drawing energy to support loads'}</span>
                          </div>
                        </>
                      )}
                      {activeSystemModal === 'hybrid' && (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-orange-500 border border-orange-400"></div>
                            <span className="text-orange-700">{language === 'bn' ? 'স্মার্ট দ্বিমুখী ব্যাটারি সেল (Backup Cycle)' : 'BATTERY PATH: Dynamic emergency backup cycle'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-400"></div>
                            <span className="text-emerald-700">{language === 'bn' ? 'স্মার্ট দ্বিমুখী মিটারিং (Balance Routing)' : 'NET METER PATH: Balanced export and grid support routing'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Visual Flow Chart */}
                <div className="space-y-3">
                  <h5 className="font-bold text-stone-800 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">৩</span>
                    {language === 'bn' ? 'গ্রাফিক্যাল চক্রপ্রবাহ (VISUAL FLOW CHART)' : 'VISUAL FLOW CHART'}
                  </h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* On Grid Flow Chart elements */}
                    {activeSystemModal === 'on-grid' && (
                      <>
                        {/* Day flow */}
                        <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-3xl space-y-3 flex flex-col justify-between shadow-sm">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">☀️</div>
                            <div>
                              <p className="font-extrabold text-amber-850 text-xs md:text-sm">
                                {language === 'bn' ? 'দিনে: রোদ যখন উজ্জ্বল' : 'Day Time: When Sunny'}
                              </p>
                              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                                {language === 'bn' ? 'বিদ্যুৎ রপ্তানি ও সঞ্চয়' : 'EXPORTING SURPLUS'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">1</span>
                              <span>
                                {language === 'bn'
                                  ? 'সোলার প্যানেলে বিদ্যুৎ তৈরি হয় এবং ঘরের ফ্যান-লাইট সরাসরি চলে।'
                                  : 'Solar panels capture sunlight to power your active lights, fans, and appliances directly.'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">2</span>
                              <span className="text-emerald-700 font-semibold">
                                {language === 'bn'
                                  ? 'অতিরিক্ত জমা কারেন্ট দ্বিমুখী নেট মিটার দিয়ে গ্রিডে পাঠানো হয়।'
                                  : 'Any surplus solar power is exported back to the grid via the bi-directional net meter.'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Night flow */}
                        <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl space-y-3 flex flex-col justify-between shadow-sm">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">🌙</div>
                            <div>
                              <p className="font-extrabold text-blue-900 text-xs md:text-sm">
                                {language === 'bn' ? 'রাতে: সূর্য যখন নেই' : 'Night Time: No Sunlight'}
                              </p>
                              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                                {language === 'bn' ? 'গ্রিড থেকে বিদ্যুৎ ব্যবহার' : 'IMPORTING FROM GRID'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">1</span>
                              <span>
                                {language === 'bn'
                                  ? 'সোলার শক্তি উৎপাদন বন্ধ থাকে এবং গ্রিড থেকে কারেন্ট চলে আসে।'
                                  : 'At night, solar generation goes to zero, and the home automatically draws power from the utility grid.'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">2</span>
                              <span className="text-blue-700 font-semibold">
                                {language === 'bn'
                                  ? 'পরিশেষে দিনের অতিরিক্ত জমার সাথে রাতের হিসাব বিয়োগ হয়ে যায়।'
                                  : 'The net bill is computed by subtracting exported daytime units from imported night units.'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Off Grid Flow Chart elements */}
                    {activeSystemModal === 'off-grid' && (
                      <>
                        {/* Day flow */}
                        <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-3xl space-y-3 flex flex-col justify-between shadow-sm">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">🔋</div>
                            <div>
                              <p className="font-extrabold text-stone-900 text-xs md:text-sm">
                                {language === 'bn' ? 'দিনে: ব্যাটারি স্টোরেজ সচ্ছলতা' : 'Day Time: Dynamic Battery Charge'}
                              </p>
                              <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">
                                {language === 'bn' ? '১০০% স্বনির্ভর চার্জিং' : 'BATTERY TO 100%'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">1</span>
                              <span>
                                {language === 'bn'
                                  ? 'উৎপাদিত সৌর বিদ্যুৎ দিয়ে স্মার্ট MPPT কন্ট্রোলার ব্যাটারি ব্যাঙ্ক চার্জ করে।'
                                  : 'An intelligent MPPT charge controller utilizes solar power to charge your battery bank to full.'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">2</span>
                              <span className="text-orange-700 font-semibold">
                                {language === 'bn'
                                  ? 'আপনার বাড়ির পাখা, লাইট, ফ্রিজ সরাসরি প্যানেল থেকে সচল থাকে।'
                                  : 'Active home appliances like fans, lights, and refrigerator are powered directly by solar energy.'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Night flow */}
                        <div className="p-5 bg-stone-150 border border-stone-200 rounded-3xl space-y-3 flex flex-col justify-between shadow-sm bg-[#FAF8F5]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-700 font-bold">🌙</div>
                            <div>
                              <p className="font-extrabold text-stone-900 text-xs md:text-sm">
                                {language === 'bn' ? 'রাতে: ব্যাটারি থেকে বাড়ি সচল' : 'Night Time: Deep discharge backup'}
                              </p>
                              <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                                {language === 'bn' ? 'গ্রিড ছাড়া নিরবিচ্ছিন্নতা' : 'BATTERY DISCHARGING'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">1</span>
                              <span>
                                {language === 'bn'
                                  ? 'সূর্যাস্তের পর প্যানেল বন্ধ হলে ইনভার্টার ব্যাটারির ডিসি পাওয়ার টেনে নেয়।'
                                  : 'After sunset, the off-grid inverter draws DC power from the battery bank and converts it to AC.'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">2</span>
                              <span className="text-amber-800 font-semibold">
                                {language === 'bn'
                                  ? 'কারেন্ট না থাকলেও কোনো লোডশেডিং ছাড়াই দীর্ঘ ব্যাকআপ নিশ্চিত করে।'
                                  : 'This delivers seamless, instant backup power during grid blackouts without interruptions.'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Hybrid Flow Chart elements */}
                    {activeSystemModal === 'hybrid' && (
                      <>
                        {/* Day flow */}
                        <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-3xl space-y-3 flex flex-col justify-between shadow-sm">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold">⛅</div>
                            <div>
                              <p className="font-extrabold text-stone-900 text-xs md:text-sm">
                                {language === 'bn' ? 'উজ্জ্বল রোদ: ৩-মুখী শক্তি বন্টন' : 'Sunny Hours: Quad Smart Routing'}
                              </p>
                              <p className="text-[10px] text-cyan-700 font-bold uppercase tracking-wider">
                                {language === 'bn' ? 'ব্যাকআপ চার্জ ও গ্রিড এক্সপোর্ট' : 'CHARGE & NET EXPORT'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">1</span>
                              <span>
                                {language === 'bn'
                                  ? 'বাড়ির সকল রানিং যন্ত্রপাতি এবং সোলার ব্যাকআপ ব্যাটারি চার্জকে অগ্রাধিকার দেয়।'
                                  : 'Powers currently running home appliances first, then prioritizes charging the backup battery.'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">2</span>
                              <span className="text-emerald-700 font-semibold">
                                {language === 'bn'
                                  ? 'সমস্ত চাহিদা মেটানোর পর উদ্বৃত্ত বিদ্যুৎ স্বয়ংক্রিয়ভাবে গ্রিডে পাঠিয়ে ক্রেডিট অর্জন করে।'
                                  : 'After meeting home loads and fully charging batteries, excess power is exported to the grid.'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Night/Blackout flow */}
                        <div className="p-5 bg-stone-150 border border-stone-200 rounded-3xl space-y-3 flex flex-col justify-between shadow-sm bg-[#FAF8F5]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold">⚡</div>
                            <div>
                              <p className="font-extrabold text-stone-900 text-xs md:text-sm">
                                {language === 'bn' ? 'লোডশেডিং বা রাতে: অটো স্যুইচিং' : 'Grid Blackout or Normal Nights'}
                              </p>
                              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                                {language === 'bn' ? 'অবিরাম অটো-ব্যাকআপ সিকিউরিটি' : 'SECURE AUTO BACKUP'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">1</span>
                              <span>
                                {language === 'bn'
                                  ? 'কারেন্ট চলে গেলে মাত্র ২০ মিলি-সেকেন্ডে গ্রিড অফ করে ব্যাটারিতে স্যুইচ করে।'
                                  : 'Upon grid failure, the hybrid system switches to battery power in under 20 milliseconds.'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-700">
                              <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-[10px]">2</span>
                              <span className="text-blue-700 font-semibold">
                                {language === 'bn'
                                  ? 'রাতে সোলার লাইট প্যানেল অফ থাকলে ব্যাটারি ও গ্রিড সম্মিলিত সমন্বয় বজায় রাখে।'
                                  : 'At night, the system utilizes stored battery power and transitions to grid as pre-configured.'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 4. The Math Section */}
                <div className="space-y-3">
                  <h5 className="font-bold text-stone-800 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">৪</span>
                    {activeSystemModal === 'on-grid' && (language === 'bn' ? 'হিসাবের খতিয়ান (THE NET MATH)' : 'THE NET MATH')}
                    {activeSystemModal === 'off-grid' && (language === 'bn' ? 'সঞ্চয় ও সাইজিং হিসাব (STORAGE MATH)' : 'STORAGE CYCLE MATH')}
                    {activeSystemModal === 'hybrid' && (language === 'bn' ? 'বুদ্ধিমান অগ্রাধিকার রুল (ROUTING PRIORITY LOGIC)' : 'SMART PRIORITY ROUTING')}
                  </h5>
                  
                  <div className="p-6 bg-stone-50 border border-stone-200 rounded-3xl space-y-5 shadow-sm">
                    {/* On Grid Equation */}
                    {activeSystemModal === 'on-grid' && (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center">
                        <div className="p-4 bg-white border border-stone-100 rounded-2xl shadow-xs">
                          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1">
                            {language === 'bn' ? 'গ্রিড থেকে আমদানি (Import)' : 'Import from Grid'}
                          </p>
                          <p className="text-xl font-black text-rose-600">
                            {language === 'bn' ? '৪০০' : '400'}{' '}
                            <span className="text-xs font-semibold text-stone-500">
                              {language === 'bn' ? 'ইউনিট' : 'Units'}
                            </span>
                          </p>
                          <p className="text-[9px] text-stone-400 mt-1">{language === 'bn' ? '(রাতে/মেঘলা দিনে)' : '(Night/Cloudy)'}</p>
                        </div>
                        <div className="font-black text-2xl text-stone-400 select-none">-</div>
                        <div className="p-4 bg-white border border-stone-100 rounded-2xl shadow-xs">
                          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1">
                            {language === 'bn' ? 'গ্রিডে রপ্তানি (Export)' : 'Export to Grid'}
                          </p>
                          <p className="text-xl font-black text-emerald-600">
                            {language === 'bn' ? '৩০০' : '300'}{' '}
                            <span className="text-xs font-semibold text-stone-500">
                              {language === 'bn' ? 'ইউনিট' : 'Units'}
                            </span>
                          </p>
                          <p className="text-[9px] text-stone-400 mt-1">{language === 'bn' ? '(দিনে সোলার থেকে)' : '(Solar Generation)'}</p>
                        </div>
                        <div className="font-black text-2xl text-stone-400 select-none">=</div>
                        <div className="p-4 bg-gradient-to-br from-emerald-600 to-emerald-500 border border-emerald-500 rounded-2xl text-white shadow-md">
                          <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider mb-1">
                            {language === 'bn' ? 'নেট পরিদেয় বিল (Net Bill)' : 'Net Billable'}
                          </p>
                          <p className="text-xl font-black">
                            {language === 'bn' ? '১০০' : '100'}{' '}
                            <span className="text-xs font-semibold text-emerald-100">
                              {language === 'bn' ? 'ইউনিট' : 'Units'}
                            </span>
                          </p>
                          <p className="text-[9px] text-emerald-100/90 mt-1">
                            {language === 'bn' ? '(৪০০ - ৩০০ = ১০০)' : '(400 - 300 = 100)'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Off Grid Equation */}
                    {activeSystemModal === 'off-grid' && (
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center">
                        <div className="p-4 bg-white border border-stone-100 rounded-2xl shadow-xs">
                          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1">
                            {language === 'bn' ? 'দৈনিক সৌর কারেন্ট' : 'Daily Solar Gen'}
                          </p>
                          <p className="text-lg font-black text-amber-600">
                            {language === 'bn' ? '২০' : '20'}{' '}
                            <span className="text-xs font-semibold text-stone-500">
                              {language === 'bn' ? 'ইউনিট' : 'Units'}
                            </span>
                          </p>
                          <p className="text-[9px] text-stone-400 mt-1">{language === 'bn' ? '(৫ কিলোওয়াট সোলার)' : '(5kW Solar System)'}</p>
                        </div>
                        <div className="font-black text-2xl text-stone-400 select-none">-</div>
                        <div className="p-4 bg-white border border-stone-100 rounded-2xl shadow-xs">
                          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1">
                            {language === 'bn' ? 'দিনে সরাসরি ঘর চলা' : 'Daytime Home Load'}
                          </p>
                          <p className="text-lg font-black text-stone-700">
                            {language === 'bn' ? '৮' : '8'}{' '}
                            <span className="text-xs font-semibold text-stone-500">
                              {language === 'bn' ? 'ইউনিট' : 'Units'}
                            </span>
                          </p>
                          <p className="text-[9px] text-stone-400 mt-1">{language === 'bn' ? '(ফ্যান, লাইট, এসি)' : '(Appliances & AC)'}</p>
                        </div>
                        <div className="font-black text-2xl text-stone-400 select-none">=</div>
                        <div className="p-4 bg-gradient-to-br from-orange-600 to-amber-500 border border-orange-500 rounded-2xl text-white shadow-md">
                          <p className="text-[10px] text-orange-100 font-bold uppercase tracking-wider mb-1">
                            {language === 'bn' ? 'ব্যাটারিতে জমা কারেন্ট' : 'Battery Net Storage'}
                          </p>
                          <p className="text-lg font-black">
                            {language === 'bn' ? '১২' : '12'}{' '}
                            <span className="text-xs font-semibold text-orange-100">
                              {language === 'bn' ? 'ইউনিট' : 'Units'}
                            </span>
                          </p>
                          <p className="text-[9px] text-orange-100/90 mt-1">{language === 'bn' ? '(১২ kWh = লিথিয়াম ব্যাকআপ)' : '(12 kWh LiFePO4 bank)'}</p>
                        </div>
                      </div>
                    )}

                    {/* Hybrid Router Logic */}
                    {activeSystemModal === 'hybrid' && (
                      <div className="space-y-4 text-xs md:text-sm">
                        <p className="font-bold text-stone-850 border-b border-stone-200/50 pb-2">
                          {language === 'bn' ? 'স্মার্ট এনার্জী ম্যানেজমেন্ট অগ্রাধিকার নিয়ম (Intelligent Energy Management Routing Rules)' : 'Four-Step Automatic Dynamic Power Routing'}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-stone-800">
                            <p className="font-extrabold text-emerald-800 text-[11px] uppercase tracking-wider mb-1">Priority #1</p>
                            <p className="font-bold text-xs">{language === 'bn' ? 'সরাসরি ঘর রানিং' : 'Direct Home Load'}</p>
                            <p className="text-[10px] text-stone-600 mt-1">{language === 'bn' ? 'রোদ থেকে উৎপন্ন অবশিষ্টাংশ বাড়ির প্রয়োজনে প্রথমে ব্যবহৃত হয়।' : 'All household loads run directly on solar first to avoid drawing grid.'}</p>
                          </div>
                          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-stone-800">
                            <p className="font-extrabold text-amber-800 text-[11px] uppercase tracking-wider mb-1">Priority #2</p>
                            <p className="font-bold text-xs">{language === 'bn' ? 'সুরক্ষা ব্যাটারি রিচার্জ' : 'Battery Charging'}</p>
                            <p className="text-[10px] text-stone-600 mt-1">{language === 'bn' ? 'এরপর ব্যাটারি ব্যাঙ্ককে ১০০% ফুল চার্জে নিয়ে যাওয়া হয়।' : 'Next, system charges the batteries dynamically for emergency readiness.'}</p>
                          </div>
                          <div className="p-4 bg-sky-50 border border-sky-100 rounded-2xl text-stone-800">
                            <p className="font-extrabold text-sky-850 text-[11px] uppercase tracking-wider mb-1">Priority #3</p>
                            <p className="font-bold text-xs">{language === 'bn' ? 'গ্রিডে উদ্বৃত্ত রপ্তানি' : 'Surplus Grid Export'}</p>
                            <p className="text-[10px] text-stone-600 mt-1">{language === 'bn' ? 'দুটি পূর্ণ হওয়ার পর বাড়তি টুকু গ্রিডে পাঠাবে বিল শুন্য করতে।' : 'Excess gets transferred instantly to Net Meter to accumulate credit.'}</p>
                          </div>
                          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-stone-800">
                            <p className="font-extrabold text-blue-800 text-[11px] uppercase tracking-wider mb-1">Priority #4</p>
                            <p className="font-bold text-xs">{language === 'bn' ? 'নিরাপদ গ্রিড ব্যাকআপ' : 'Grid Safety Backup'}</p>
                            <p className="text-[10px] text-stone-600 mt-1">{language === 'bn' ? 'সোলার ও ব্যাটারি দুটি না থাকলে গ্রিড থেকে কারেন্ট আনা হয়।' : 'Draws public power only when solar ends and batteries reach depletion.'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Regional Context Rules */}
                <div className="space-y-3">
                  <h5 className="font-bold text-stone-800 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">৫</span>
                    {language === 'bn' ? 'বিশেষজ্ঞ পরামর্শ ও পশ্চিমবঙ্গের নিয়মাবলী' : 'CRAFT ADVICE & WBERC REGULATORY RULES'}
                  </h5>
                  <div className="p-6 bg-stone-50 border border-stone-200 rounded-3xl shadow-sm space-y-4">
                    {activeSystemModal === 'on-grid' && (
                      <>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
                          <div>
                            <p className="font-bold text-stone-900 text-xs md:text-sm">
                              {language === 'bn' ? 'গ্রিড কম্প্লায়েন্স নিয়মাবলী (Compliance Sanction)' : 'Compliance & Sanction guidelines'}
                            </p>
                            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                              {language === 'bn'
                                ? 'পশ্চিমবঙ্গে নেট মিটারিং অনুমোদনের জন্য ন্যূনতম গ্রাহক চুক্তিভিত্তিক লোড (Minimum contract demand) অবশ্যই WBERC নির্দেশিকা অনুযায়ী হতে হবে (সাধারণত গার্হস্থ্য সংযোগের ক্ষেত্রে ১ কিলোওয়াট বা তার বেশি)।'
                                : 'West Bengal-এ নেট মিটারিং অনুমোদনের জন্য Minimum consumer contract demand must be compliant with WBERC guidelines (typically 1 kW or above for domestic loads).'}
                            </p>
                          </div>
                        </div>
                        <div className="border-t border-stone-200/60 my-2" />
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
                          <div>
                            <p className="font-bold text-stone-900 text-xs md:text-sm">
                              {language === 'bn' ? 'মিটার সংযোগ সিলমোহর (Official Inspection & Sealing)' : 'Official Installation & Meter Sealing'}
                            </p>
                            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                              {language === 'bn'
                                ? 'সফল নিরাপত্তা পরিদর্শনের পর আপনার পূর্ববর্তী লাইনে WBSEDCL অথবা CESC-এর দ্বারা অফিশিয়ালি স্মার্ট দ্বিমুখী নেট মিটার (Smart bi-directional meter) নতুন করে ইনস্টল ও সিলমোহর করা হবে।'
                                : 'The smart bi-directional meter will be officially installed and sealed by WBSEDCL or CESC on your pre-existing lines after successful safety inspection.'}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {activeSystemModal === 'off-grid' && (
                      <>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
                          <div>
                            <p className="font-bold text-stone-900 text-xs md:text-sm">
                              {language === 'bn' ? 'লিথিয়াম ব্যাটারি লাইফ প্যাকের অগ্রাধিকার' : 'Recommend Deep Cycle Lithium (LiFePO4)'}
                            </p>
                            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                              {language === 'bn'
                                ? 'অফ-গ্রিড স্টোরেজ ব্যবস্থার জন্য আধুনিক LiFePO4 (লিথিয়াম আয়রন ফসফেট) টেকনোলজি ব্যবহার করা শ্রেয়, যা কোন রক্ষণাবেক্ষণ ছাড়াই ১০-১৫ বছর (৩০০০-এর বেশি কমপ্লিট চার্জ-ডিসচার্জ সাইকেল) নিরাপদভাবে বিদ্যুৎ ব্যাকআপ প্রদান করে।'
                                : 'Off-grid storage systems should prefer modern LiFePO4 chemistry which operates safely over 10-15 years (3000+ full discharge cycles) without periodic maintenance.'}
                            </p>
                          </div>
                        </div>
                        <div className="border-t border-stone-200/60 my-2" />
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
                          <div>
                            <p className="font-bold text-stone-900 text-xs md:text-sm">
                              {language === 'bn' ? 'ভর্তুকিহীন স্বাধীন সংযোগ সীমানা' : 'Subsidy Exclusions for Autonomous Systems'}
                            </p>
                            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                              {language === 'bn'
                                ? 'দয়া করে মনে রাখবেন যে কেন্দ্রীয় ‘পিএম সূর্য ঘর’ প্রকল্প থেকে স্ট্যান্ড-অ্যালোন অফ-গ্রিড (Grid বিহীন) সোলার সিস্টেমের জন্য কোনও সরকারি ভর্তুকি বা সাবসিডি দেওয়া হয় না, কারণ এই বিদ্যুৎ রাজ্যের মূল সার্ভার গ্রিডে ফেরত পাঠানো যায় না।'
                                : 'Please note that the central PM Surya Ghar scheme does not extend any public capital subsidy for stand-alone Off-Grid configurations as they do not feed back into state utility networks.'}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {activeSystemModal === 'hybrid' && (
                      <>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
                          <div>
                            <p className="font-bold text-stone-900 text-xs md:text-sm">
                              {language === 'bn' ? 'সার্টিফাইড অ্যান্টি-আল্যান্ডিং প্রোটেকশন' : 'Certified Anti-Islanding Protection (IEEE 1547)'}
                            </p>
                            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                              {language === 'bn'
                                ? 'হাইব্রিড ইনভার্টারে অবশ্যই সার্টিফাইড স্বয়ংক্রিয় অ্যান্টি-আইল্যান্ডিং রিলে (anti-islanding relays) থাকতে হবে যা বিদ্যুৎহীন বা লোডশেডিংয়ের সময় গ্রিডের লাইনটিকে সাথে সাথে নিরাপদভাবে আলাদা করে দেয়, যাতে লাইনে কাজ করা বিদ্যুৎ কর্মীদের জীবন সুরক্ষিত থাকে।'
                                : 'The Hybrid Inverter must have certified automatic anti-islanding relays to safely isolate and disconnect from Grid lines instantly during blackouts, protecting electrical utility workmen.'}
                            </p>
                          </div>
                        </div>
                        <div className="border-t border-stone-200/60 my-2" />
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs mt-0.5">✓</div>
                          <div>
                            <p className="font-bold text-stone-900 text-xs md:text-sm">
                              {language === 'bn' ? 'নেট মিটারিং নিয়ম ও ক্যাপিটাল ভর্তুকি' : 'Bi-Directional Net-Metering & partial subsidy approval'}
                            </p>
                            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                              {language === 'bn'
                                ? 'WBERC হাইব্রিড সংযোগের উপরও দ্বিমুখী নেট-মিটারিং অনুমোদন করে। মূলত সোলার প্ল্যান্ট সেটআপের জন্য কেন্দ্রীয় সাবসিডি সফলভাবে পাওয়া গেলেও, ব্যাটারি ব্যাকআপ স্টোরেজ মডিউল ক্রয়ের খরচ এর আওতায় অন্তর্ভুক্ত থাকে না।'
                                : 'WBERC permits bi-directional net-metering on hybrid installations. The central subsidy is successfully availed for the solar capacity block, excluding private battery bank storage module expenditures.'}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col md:flex-row items-center justify-between pt-5 mt-6 border-t border-stone-200 text-stone-500 whitespace-nowrap gap-4 text-xs">
                  <p className="text-stone-400 font-medium">
                    {language === 'bn' ? 'তথ্য উৎস: WBERC অফিসিয়াল নির্দেশিকা ২০১৬-২০২৬' : 'Source: WBERC Consumer Guidelines 2016-2026'}
                  </p>
                  <p className="italic font-bold text-amber-600">
                    {activeSystemModal === 'on-grid' && (language === 'bn' ? '* একটি নিরাপদ ও লাভজনক ভবিষ্যতের জন্য আপনার অন-গ্রিড সংযোগ।' : '* Reassuring, secure, and highly profitable solar investment.')}
                    {activeSystemModal === 'off-grid' && (language === 'bn' ? '* গ্রিড বিদ্যুৎ ছাড়াই সম্পূর্ণ স্বাধীন ও সচল আবাস।' : '* 100% self-sufficient energy for absolute standalone peace of mind.')}
                    {activeSystemModal === 'hybrid' && (language === 'bn' ? '* নিখুঁত সঞ্চয়, ব্যাকআপ এবং পরম নিরাপত্তা।' : '* Smart savings, reliable battery backup, and ultimate green power security.')}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
