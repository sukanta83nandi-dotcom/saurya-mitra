export type SystemType = 'on-grid' | 'off-grid' | 'hybrid';
export type RoofSize = 'small' | 'medium' | 'large';

export interface BillData {
  connectedLoad: number; // in kW
  unitsConsumed: number; // monthly units
  monthlyBill: number;   // estimated or extracted bill amount
  provider: 'CESC' | 'WBSEDCL' | 'Unknown';
}

export interface Appliance {
  id: string;
  name: string;
  translationKey?: string;
  power: number; // in Watts
  hours: number; // daily usage
  count: number;
  enabled?: boolean;
}

export interface CALC_RESULT {
  recommendedSystemSize: number; // in kW
  estimatedCost: number;
  subsidyAmount: number;
  netCost: number;
  monthlySavings: number;
  yearlySavings: number;
  paybackYears: number;
}
