export type MeterCategory =
  | 'water_weekly'
  | 'water_daily_special'
  | 'electricity_postpaid'
  | 'electricity_prepaid';

export interface MeterDefinition {
  id: string;
  name: string;
  category: MeterCategory;
  meterNumber?: string;
  location: string;
  unit: string; // m³ or kWh
  schedule: 'Monday Weekly' | 'Daily (Day/Night)' | 'On Token Purchase';
  notes?: string;
  targetBaselineConsumption?: number; // expected weekly or daily average
}

export interface WaterWeeklyReading {
  id: string;
  meterId: string;
  date: string; // YYYY-MM-DD (End Date)
  startDate?: string; // e.g. "5 Jan 2026"
  endDate?: string; // e.g. "2 Feb 2026"
  displayPeriod?: string;
  previousReading: number; // START m3
  endReading: number; // END m3
  consumption: number; // calculated: end - previous
  isRollover?: boolean;
  photoUrl?: string;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface WaterDailyReading {
  id: string;
  meterId: string; // TTA or WRA
  date: string; // YYYY-MM-DD
  displayDate?: string; // e.g., "02/10/2026"
  startTime: string; // e.g., "09:00:00"
  endTime: string; // e.g., "18:00:00"
  startReading: number;
  midReading?: number; // reading at changeover (evening)
  endReading: number; // reading at end of shift / next morning
  dayConsumption: number; // calculated or recorded Day Consumption
  nightConsumption: number; // calculated or recorded Night Consumption
  totalConsumption: number; // calculated 24hrs Total
  runningTotal?: number; // cumulative Running Total
  startPhotoUrl?: string;
  endPhotoUrl?: string;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ElectricityPostpaidReading {
  id: string;
  meterId: string;
  date: string; // YYYY-MM-DD
  previousReading: number;
  endReading: number;
  consumption: number; // calculated: end - previous
  tariffRateKsh: number; // e.g., 28.50 KSh/kWh
  billAmountKsh: number; // calculated or invoiced
  isRollover?: boolean;
  photoUrl?: string;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ElectricityPrepaidToken {
  id: string;
  meterId: string;
  date: string; // YYYY-MM-DD
  tokenNumber: string; // 20 digits e.g. 5440-3973-8341-2948-1294
  tokenUnitsKwh: number;
  grossAmountKsh: number; // Total paid
  netTokenAmountKsh: number; // Amount allocated to tokens after levies/taxes
  effectiveRateKshPerKwh: number; // gross / units
  receiptPhotoUrl?: string;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface AnomalyAlert {
  id: string;
  meterId: string;
  meterName: string;
  category: MeterCategory;
  date: string;
  readingValue: number;
  baselineValue: number;
  percentageDiff: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface WeeklyComparison {
  period: string; // e.g. "Week 43" or "2026-W43"
  waterConsumptionM3: number;
  electricityConsumptionKwh: number;
  electricityCostKsh: number;
  waterCostKsh: number;
  totalCostKsh: number;
}

export interface GoogleSheetsWorksheetMapping {
  water_weekly: string;
  water_daily_special: string;
  electricity_postpaid: string;
  electricity_prepaid: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl?: string;
  spreadsheetTitle?: string;
  autoSyncEnabled: boolean;
  worksheets: GoogleSheetsWorksheetMapping;
  lastSyncTimestamp?: number;
  lastSyncStatus?: 'idle' | 'success' | 'error' | 'syncing';
  lastSyncMessage?: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  category: MeterCategory | 'all';
  action: 'insert' | 'update' | 'bulk_sync' | 'delete';
  recordId?: string;
  meterName?: string;
  status: 'success' | 'failed';
  details: string;
  targetSheet: string;
}

export interface PendingSyncItem {
  id: string;
  category: MeterCategory;
  action: 'upsert' | 'delete';
  record: any;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}


