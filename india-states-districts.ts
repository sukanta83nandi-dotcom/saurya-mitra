export const SOLAR_CONSTANTS = {
  COST_PER_KW: {
    'on-grid': 65000,
    'off-grid': 95000,
    'hybrid': 125000,
  },
  ROOF_LIMITS: {
    'small': 3,
    'medium': 7,
    'large': 15,
  },
  SUBSIDY_UP_TO_2KW: 30000, // per kW
  SUBSIDY_3RD_KW: 18000,
  MAX_SUBSIDY: 78000, // For 3kW or more
  UNITS_SAVED_PER_KW_PER_MONTH: 120, // Approx 4 units/day * 30 days
  COST_PER_UNIT: 8.5, // Default/Average
  TARIFF_SLABS: {
    'West Bengal': {
      'CESC Kolkata': {
        'domestic': [
          { limit: 25, rate: 4.89 },
          { limit: 60, rate: 5.40 },
          { limit: 100, rate: 6.41 },
          { limit: 150, rate: 7.16 },
          { limit: 300, rate: 7.33 },
          { limit: Infinity, rate: 8.92 }
        ],
        'industrial': [{ limit: Infinity, rate: 10.0 }]
      },
      'WBSEDCL': {
        'domestic': [
          { limit: 102, rate: 5.30 },
          { limit: 180, rate: 6.30 },
          { limit: 300, rate: 7.20 },
          { limit: Infinity, rate: 8.50 }
        ],
        'industrial': [{ limit: Infinity, rate: 9.0 }]
      }
    },
    'Gujarat': {
      'DGVCL': { 'domestic': [{ limit: 50, rate: 3.05 }, { limit: 100, rate: 3.50 }, { limit: 250, rate: 4.15 }, { limit: Infinity, rate: 5.20 }], 'industrial': [{ limit: Infinity, rate: 4.50 }] },
      'MGVCL': { 'domestic': [{ limit: 50, rate: 3.05 }, { limit: 100, rate: 3.50 }, { limit: 250, rate: 4.15 }, { limit: Infinity, rate: 5.20 }], 'industrial': [{ limit: Infinity, rate: 4.50 }] },
      'PGVCL': { 'domestic': [{ limit: 50, rate: 3.05 }, { limit: 100, rate: 3.50 }, { limit: 250, rate: 4.15 }, { limit: Infinity, rate: 5.20 }], 'industrial': [{ limit: Infinity, rate: 4.50 }] },
      'UGVCL': { 'domestic': [{ limit: 50, rate: 3.05 }, { limit: 100, rate: 3.50 }, { limit: 250, rate: 4.15 }, { limit: Infinity, rate: 5.20 }], 'industrial': [{ limit: Infinity, rate: 4.50 }] },
      'Torrent Power': { 'domestic': [{ limit: 50, rate: 3.20 }, { limit: 200, rate: 3.90 }, { limit: 400, rate: 4.50 }, { limit: Infinity, rate: 5.50 }], 'industrial': [{ limit: Infinity, rate: 6.00 }] }
    },
    'Delhi': {
      'BSES Rajdhani': { 'domestic': [{ limit: 200, rate: 3.00 }, { limit: 400, rate: 4.50 }, { limit: 800, rate: 6.50 }, { limit: Infinity, rate: 8.00 }], 'industrial': [{ limit: Infinity, rate: 9.50 }] },
      'BSES Yamuna': { 'domestic': [{ limit: 200, rate: 3.00 }, { limit: 400, rate: 4.50 }, { limit: 800, rate: 6.50 }, { limit: Infinity, rate: 8.00 }], 'industrial': [{ limit: Infinity, rate: 9.50 }] },
      'Tata Power DDL': { 'domestic': [{ limit: 200, rate: 3.00 }, { limit: 400, rate: 4.50 }, { limit: 800, rate: 6.50 }, { limit: Infinity, rate: 8.00 }], 'industrial': [{ limit: Infinity, rate: 9.50 }] }
    },
    'Maharashtra': {
      'MSEDCL': { 'domestic': [{ limit: 100, rate: 4.41 }, { limit: 300, rate: 8.82 }, { limit: 500, rate: 11.72 }, { limit: Infinity, rate: 13.00 }], 'industrial': [{ limit: Infinity, rate: 14.00 }] },
      'Adani Electricity Mumbai': { 'domestic': [{ limit: 100, rate: 3.50 }, { limit: 300, rate: 7.50 }, { limit: 500, rate: 10.50 }, { limit: Infinity, rate: 12.50 }], 'industrial': [{ limit: Infinity, rate: 13.50 }] },
      'BEST': { 'domestic': [{ limit: 100, rate: 3.20 }, { limit: 300, rate: 6.90 }, { limit: 500, rate: 9.50 }, { limit: Infinity, rate: 11.50 }], 'industrial': [{ limit: Infinity, rate: 12.50 }] },
      'Tata Power Mumbai': { 'domestic': [{ limit: 100, rate: 3.40 }, { limit: 300, rate: 7.20 }, { limit: 500, rate: 10.20 }, { limit: Infinity, rate: 12.20 }], 'industrial': [{ limit: Infinity, rate: 13.20 }] }
    },
    'Karnataka': {
      'BESCOM': { 'domestic': [{ limit: 50, rate: 4.05 }, { limit: 100, rate: 5.55 }, { limit: 200, rate: 7.05 }, { limit: Infinity, rate: 8.05 }], 'industrial': [{ limit: Infinity, rate: 9.00 }] },
      'MESCOM': { 'domestic': [{ limit: 50, rate: 4.05 }, { limit: 100, rate: 5.55 }, { limit: 200, rate: 7.05 }, { limit: Infinity, rate: 8.05 }], 'industrial': [{ limit: Infinity, rate: 9.00 }] },
      'HESCOM': { 'domestic': [{ limit: 50, rate: 4.05 }, { limit: 100, rate: 5.55 }, { limit: 200, rate: 7.05 }, { limit: Infinity, rate: 8.05 }], 'industrial': [{ limit: Infinity, rate: 9.00 }] },
      'CESC Mysuru': { 'domestic': [{ limit: 50, rate: 4.05 }, { limit: 100, rate: 5.55 }, { limit: 200, rate: 7.05 }, { limit: Infinity, rate: 8.05 }], 'industrial': [{ limit: Infinity, rate: 9.00 }] },
      'GESCOM': { 'domestic': [{ limit: 50, rate: 4.05 }, { limit: 100, rate: 5.55 }, { limit: 200, rate: 7.05 }, { limit: Infinity, rate: 8.05 }], 'industrial': [{ limit: Infinity, rate: 9.00 }] }
    },
    'Andhra Pradesh': { 'APSPDCL': { 'domestic': [{ limit: 50, rate: 1.45 }, { limit: Infinity, rate: 6.00 }], 'industrial': [{ limit: Infinity, rate: 7.00 }] }, 'APEPDCL': { 'domestic': [{ limit: 50, rate: 1.45 }, { limit: Infinity, rate: 6.00 }], 'industrial': [{ limit: Infinity, rate: 7.00 }] }, 'APCPDCL': { 'domestic': [{ limit: 50, rate: 1.45 }, { limit: Infinity, rate: 6.00 }], 'industrial': [{ limit: Infinity, rate: 7.00 }] } },
    'Assam': { 'APDCL': { 'domestic': [{ limit: 120, rate: 5.35 }, { limit: Infinity, rate: 7.60 }], 'industrial': [{ limit: Infinity, rate: 8.50 }] } },
    'Bihar': { 'NBPDCL': { 'domestic': [{ limit: 100, rate: 6.05 }, { limit: Infinity, rate: 8.50 }], 'industrial': [{ limit: Infinity, rate: 9.00 }] }, 'SBPDCL': { 'domestic': [{ limit: 100, rate: 6.05 }, { limit: Infinity, rate: 8.50 }], 'industrial': [{ limit: Infinity, rate: 9.00 }] } },
    'Rajasthan': { 'JVVNL': { 'domestic': [{ limit: 50, rate: 4.75 }, { limit: 150, rate: 6.50 }, { limit: Infinity, rate: 7.95 }], 'industrial': [{ limit: Infinity, rate: 8.50 }] }, 'AVVNL': { 'domestic': [{ limit: 50, rate: 4.75 }, { limit: 150, rate: 6.50 }, { limit: Infinity, rate: 7.95 }], 'industrial': [{ limit: Infinity, rate: 8.50 }] }, 'JDVVNL': { 'domestic': [{ limit: 50, rate: 4.75 }, { limit: 150, rate: 6.50 }, { limit: Infinity, rate: 7.95 }], 'industrial': [{ limit: Infinity, rate: 8.50 }] } },
    'Tamil Nadu': { 'TANGEDCO': { 'domestic': [{ limit: 100, rate: 4.50 }, { limit: 400, rate: 6.00 }, { limit: Infinity, rate: 8.00 }], 'industrial': [{ limit: Infinity, rate: 9.00 }] } },
    'Telangana': { 'TGSPDCL': { 'domestic': [{ limit: 100, rate: 3.30 }, { limit: 200, rate: 4.30 }, { limit: Infinity, rate: 7.20 }], 'industrial': [{ limit: Infinity, rate: 8.50 }] }, 'TGNPDCL': { 'domestic': [{ limit: 100, rate: 3.30 }, { limit: 200, rate: 4.30 }, { limit: Infinity, rate: 7.20 }], 'industrial': [{ limit: Infinity, rate: 8.50 }] } },
    'Uttar Pradesh': { 'PVVNL': { 'domestic': [{ limit: 150, rate: 5.50 }, { limit: 300, rate: 6.00 }, { limit: Infinity, rate: 7.00 }], 'industrial': [{ limit: Infinity, rate: 8.50 }] }, 'MVVNL': { 'domestic': [{ limit: 150, rate: 5.50 }, { limit: 300, rate: 6.00 }, { limit: Infinity, rate: 7.00 }], 'industrial': [{ limit: Infinity, rate: 8.50 }] } },
    'Kerala': { 'KSEB': { 'domestic': [{ limit: 50, rate: 3.15 }, { limit: 100, rate: 3.70 }, { limit: 150, rate: 4.80 }, { limit: Infinity, rate: 7.50 }], 'industrial': [{ limit: Infinity, rate: 8.00 }] } },
    'Chhattisgarh': { 'CSPDCL': { 'domestic': [{ limit: 100, rate: 3.70 }, { limit: 200, rate: 3.90 }, { limit: Infinity, rate: 5.30 }], 'industrial': [{ limit: Infinity, rate: 6.50 }] } },
    'Madhya Pradesh': { 'MPPKVVCL': { 'domestic': [{ limit: 50, rate: 4.10 }, { limit: 100, rate: 5.00 }, { limit: Infinity, rate: 6.50 }], 'industrial': [{ limit: Infinity, rate: 7.50 }] }, 'MPMKVVCL': { 'domestic': [{ limit: 50, rate: 4.10 }, { limit: 100, rate: 5.00 }, { limit: Infinity, rate: 6.50 }], 'industrial': [{ limit: Infinity, rate: 7.50 }] }, 'MPPoKVVCL': { 'domestic': [{ limit: 50, rate: 4.10 }, { limit: 100, rate: 5.00 }, { limit: Infinity, rate: 6.50 }], 'industrial': [{ limit: Infinity, rate: 7.50 }] } },
    'Odisha': { 'TPCODL': { 'domestic': [{ limit: 50, rate: 3.00 }, { limit: 200, rate: 4.80 }, { limit: 400, rate: 5.80 }, { limit: Infinity, rate: 6.20 }], 'industrial': [{ limit: Infinity, rate: 7.00 }] }, 'TPNODL': { 'domestic': [{ limit: 50, rate: 3.00 }, { limit: 200, rate: 4.80 }, { limit: 400, rate: 5.80 }, { limit: Infinity, rate: 6.20 }], 'industrial': [{ limit: Infinity, rate: 7.00 }] }, 'TPWODL': { 'domestic': [{ limit: 50, rate: 3.00 }, { limit: 200, rate: 4.80 }, { limit: 400, rate: 5.80 }, { limit: Infinity, rate: 6.20 }], 'industrial': [{ limit: Infinity, rate: 7.00 }] }, 'TPSODL': { 'domestic': [{ limit: 50, rate: 3.00 }, { limit: 200, rate: 4.80 }, { limit: 400, rate: 5.80 }, { limit: Infinity, rate: 6.20 }], 'industrial': [{ limit: Infinity, rate: 7.00 }] } },
    'Punjab': { 'PSPCL': { 'domestic': [{ limit: 100, rate: 4.50 }, { limit: 300, rate: 6.50 }, { limit: Infinity, rate: 7.50 }], 'industrial': [{ limit: Infinity, rate: 8.00 }] } },
    'Haryana': { 'DHBVN': { 'domestic': [{ limit: 50, rate: 2.00 }, { limit: 150, rate: 4.50 }, { limit: 250, rate: 5.25 }, { limit: Infinity, rate: 6.30 }], 'industrial': [{ limit: Infinity, rate: 7.00 }] }, 'UHBVN': { 'domestic': [{ limit: 50, rate: 2.00 }, { limit: 150, rate: 4.50 }, { limit: 250, rate: 5.25 }, { limit: Infinity, rate: 6.30 }], 'industrial': [{ limit: Infinity, rate: 7.00 }] } },
    'Himachal Pradesh': { 'HPSEBL': { 'domestic': [{ limit: 60, rate: 3.30 }, { limit: 125, rate: 3.95 }, { limit: Infinity, rate: 5.00 }], 'industrial': [{ limit: Infinity, rate: 6.00 }] } },
    'Jharkhand': { 'JBVNL': { 'domestic': [{ limit: 100, rate: 6.25 }, { limit: Infinity, rate: 6.50 }], 'industrial': [{ limit: Infinity, rate: 7.50 }] } },
    'Uttarakhand': { 'UPCL': { 'domestic': [{ limit: 100, rate: 4.00 }, { limit: 200, rate: 5.00 }, { limit: Infinity, rate: 6.50 }], 'industrial': [{ limit: Infinity, rate: 7.50 }] } },
    'Jammu and Kashmir': { 'KPDCL': { 'domestic': [{ limit: 100, rate: 3.50 }, { limit: Infinity, rate: 5.00 }], 'industrial': [{ limit: Infinity, rate: 6.50 }] }, 'JPDCL': { 'domestic': [{ limit: 100, rate: 3.50 }, { limit: Infinity, rate: 5.00 }], 'industrial': [{ limit: Infinity, rate: 6.50 }] } },
    'Goa': { 'Electricity Department Goa': { 'domestic': [{ limit: 100, rate: 1.50 }, { limit: 200, rate: 2.10 }, { limit: Infinity, rate: 4.00 }], 'industrial': [{ limit: Infinity, rate: 5.50 }] } },
    'Chandigarh': { 'Electricity Department Chandigarh': { 'domestic': [{ limit: 150, rate: 2.50 }, { limit: 400, rate: 4.50 }, { limit: Infinity, rate: 5.00 }], 'industrial': [{ limit: Infinity, rate: 6.50 }] } },
    'Other': {
      'Standard Utility': {
        'domestic': [
          { limit: 200, rate: 5.50 },
          { limit: 500, rate: 7.50 },
          { limit: Infinity, rate: 9.00 }
        ],
        'industrial': [
          { limit: Infinity, rate: 10.00 }
        ]
      }
    }
  }
};

export const DEFAULT_APPLIANCES = [
  { id: 'app-computer', name: 'কম্পিউটার/ল্যাপটপ', translationKey: 'computer', power: 150, hours: 8, count: 1, enabled: false },
  { id: 'app-fan', name: 'সিলিং ফ্যান', translationKey: 'fan', power: 75, hours: 12, count: 3, enabled: false },
  { id: 'app-bulb', name: 'LED বাল্ব', translationKey: 'bulb', power: 12, hours: 6, count: 5, enabled: false },
  { id: 'app-ac', name: 'এসি (১.৫ টন)', translationKey: 'ac', power: 1500, hours: 4, count: 1, enabled: false },
  { id: 'app-fridge', name: 'ফ্রিজ', translationKey: 'fridge', power: 200, hours: 24, count: 1, enabled: false },
];
