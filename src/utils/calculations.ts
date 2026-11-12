import {
  WaterWeeklyReading,
  WaterDailyReading,
  ElectricityPostpaidReading,
  ElectricityPrepaidToken,
  AnomalyAlert,
} from '../types';
import { METERS_CATALOG, DEFAULT_WATER_RATE_PER_M3 } from '../data/meterCatalog';

export function formatKsh(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace('KES', 'KSh');
}

export function formatNumber(val: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

// Outlier detection across all meter readings
export function detectAnomalies(
  weeklyWater: WaterWeeklyReading[],
  dailyWater: WaterDailyReading[],
  postpaidPower: ElectricityPostpaidReading[]
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  // 1. Water Weekly
  const weeklyByMeter = new Map<string, WaterWeeklyReading[]>();
  for (const r of weeklyWater) {
    if (!weeklyByMeter.has(r.meterId)) weeklyByMeter.set(r.meterId, []);
    weeklyByMeter.get(r.meterId)!.push(r);
  }

  weeklyByMeter.forEach((readings, meterId) => {
    const meter = METERS_CATALOG.find((m) => m.id === meterId);
    if (!meter) return;
    const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));

    // Calculate baseline
    const avg =
      sorted.reduce((acc, curr) => acc + curr.consumption, 0) /
      (sorted.length || 1);
    const baseline = meter.targetBaselineConsumption || avg;

    sorted.forEach((r) => {
      const diffPct = ((r.consumption - baseline) / baseline) * 100;
      if (diffPct > 28) {
        alerts.push({
          id: `alert-${r.id}`,
          meterId: r.meterId,
          meterName: meter.name,
          category: 'water_weekly',
          date: r.date,
          readingValue: r.consumption,
          baselineValue: baseline,
          percentageDiff: Math.round(diffPct),
          severity: diffPct > 50 ? 'high' : 'medium',
          message: `Spike detected: ${formatNumber(r.consumption)} m³ is ${Math.round(diffPct)}% above standard baseline (${formatNumber(baseline)} m³). Potential lateral leak or line break.`,
        });
      }
    });
  });

  // 2. Daily Water (TTA & WRA)
  const dailyByMeter = new Map<string, WaterDailyReading[]>();
  for (const r of dailyWater) {
    if (!dailyByMeter.has(r.meterId)) dailyByMeter.set(r.meterId, []);
    dailyByMeter.get(r.meterId)!.push(r);
  }

  dailyByMeter.forEach((readings, meterId) => {
    const meter = METERS_CATALOG.find((m) => m.id === meterId);
    if (!meter) return;
    const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
    const avg =
      sorted.reduce((acc, curr) => acc + curr.totalConsumption, 0) /
      (sorted.length || 1);
    const baseline = meter.targetBaselineConsumption || avg;

    sorted.forEach((r) => {
      const diffPct = ((r.totalConsumption - baseline) / baseline) * 100;
      if (diffPct > 25) {
        alerts.push({
          id: `alert-${r.id}`,
          meterId: r.meterId,
          meterName: meter.name,
          category: 'water_daily_special',
          date: r.date,
          readingValue: r.totalConsumption,
          baselineValue: baseline,
          percentageDiff: Math.round(diffPct),
          severity: diffPct > 40 ? 'high' : 'medium',
          message: `High abstraction: ${formatNumber(r.totalConsumption)} m³ total is ${Math.round(diffPct)}% above expected daily draw (${formatNumber(baseline)} m³). Verify gate valve.`,
        });
      }
    });
  });

  // 3. Postpaid Power
  const postpaidByMeter = new Map<string, ElectricityPostpaidReading[]>();
  for (const r of postpaidPower) {
    if (!postpaidByMeter.has(r.meterId)) postpaidByMeter.set(r.meterId, []);
    postpaidByMeter.get(r.meterId)!.push(r);
  }

  postpaidByMeter.forEach((readings, meterId) => {
    const meter = METERS_CATALOG.find((m) => m.id === meterId);
    if (!meter) return;
    const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
    const avg =
      sorted.reduce((acc, curr) => acc + curr.consumption, 0) /
      (sorted.length || 1);
    const baseline = meter.targetBaselineConsumption || avg;

    sorted.forEach((r) => {
      const diffPct = ((r.consumption - baseline) / baseline) * 100;
      if (diffPct > 20) {
        alerts.push({
          id: `alert-${r.id}`,
          meterId: r.meterId,
          meterName: meter.name,
          category: 'electricity_postpaid',
          date: r.date,
          readingValue: r.consumption,
          baselineValue: baseline,
          percentageDiff: Math.round(diffPct),
          severity: diffPct > 35 ? 'high' : 'medium',
          message: `Elevated motor consumption: ${formatNumber(r.consumption)} kWh is ${Math.round(diffPct)}% above normal run hours (${formatNumber(baseline)} kWh). Check pump phase balance.`,
        });
      }
    });
  });

  return alerts.sort((a, b) => b.date.localeCompare(a.date));
}

// Summary Metrics for the Executive Dashboard
export function computeUtilityTotals(
  weeklyWater: WaterWeeklyReading[],
  dailyWater: WaterDailyReading[],
  postpaidPower: ElectricityPostpaidReading[],
  prepaidTokens: ElectricityPrepaidToken[]
) {
  const totalWaterWeeklyM3 = weeklyWater.reduce(
    (acc, r) => acc + r.consumption,
    0
  );
  const totalWaterDailyM3 = dailyWater.reduce(
    (acc, r) => acc + r.totalConsumption,
    0
  );
  const totalWaterM3 = totalWaterWeeklyM3 + totalWaterDailyM3;
  const estimatedWaterCostKsh = totalWaterM3 * DEFAULT_WATER_RATE_PER_M3;

  const totalPostpaidKwh = postpaidPower.reduce(
    (acc, r) => acc + r.consumption,
    0
  );
  const totalPostpaidCostKsh = postpaidPower.reduce(
    (acc, r) => acc + r.billAmountKsh,
    0
  );

  const totalPrepaidUnitsKwh = prepaidTokens.reduce(
    (acc, r) => acc + r.tokenUnitsKwh,
    0
  );
  const totalPrepaidGrossKsh = prepaidTokens.reduce(
    (acc, r) => acc + r.grossAmountKsh,
    0
  );
  const totalPrepaidNetKsh = prepaidTokens.reduce(
    (acc, r) => acc + r.netTokenAmountKsh,
    0
  );

  const totalElectricityKwh = totalPostpaidKwh + totalPrepaidUnitsKwh;
  const totalElectricityCostKsh = totalPostpaidCostKsh + totalPrepaidGrossKsh;

  const effectiveElectCostPerKwh =
    totalElectricityKwh > 0 ? totalElectricityCostKsh / totalElectricityKwh : 0;
  const effectiveWaterCostPerM3 =
    totalWaterM3 > 0 ? estimatedWaterCostKsh / totalWaterM3 : 0;

  return {
    totalWaterM3,
    totalWaterWeeklyM3,
    totalWaterDailyM3,
    estimatedWaterCostKsh,
    effectiveWaterCostPerM3,
    totalElectricityKwh,
    totalPostpaidKwh,
    totalPrepaidUnitsKwh,
    totalElectricityCostKsh,
    totalPostpaidCostKsh,
    totalPrepaidGrossKsh,
    totalPrepaidNetKsh,
    effectiveElectCostPerKwh,
    combinedTotalCostKsh: estimatedWaterCostKsh + totalElectricityCostKsh,
  };
}

// Week-over-Week trend aggregator
export function computeWeeklyTrends(
  weeklyWater: WaterWeeklyReading[],
  postpaidPower: ElectricityPostpaidReading[]
) {
  // Group by date
  const dateMap = new Map<
    string,
    { waterM3: number; powerKwh: number; powerCost: number; waterCost: number }
  >();

  weeklyWater.forEach((r) => {
    if (!dateMap.has(r.date)) {
      dateMap.set(r.date, {
        waterM3: 0,
        powerKwh: 0,
        powerCost: 0,
        waterCost: 0,
      });
    }
    const cur = dateMap.get(r.date)!;
    cur.waterM3 += r.consumption;
    cur.waterCost += r.consumption * DEFAULT_WATER_RATE_PER_M3;
  });

  postpaidPower.forEach((r) => {
    if (!dateMap.has(r.date)) {
      dateMap.set(r.date, {
        waterM3: 0,
        powerKwh: 0,
        powerCost: 0,
        waterCost: 0,
      });
    }
    const cur = dateMap.get(r.date)!;
    cur.powerKwh += r.consumption;
    cur.powerCost += r.billAmountKsh;
  });

  const sortedDates = Array.from(dateMap.keys()).sort();

  return sortedDates.map((date, index) => {
    const data = dateMap.get(date)!;
    const prevDate = index > 0 ? sortedDates[index - 1] : null;
    const prevData = prevDate ? dateMap.get(prevDate)! : null;

    const waterWoWPct = prevData
      ? ((data.waterM3 - prevData.waterM3) / (prevData.waterM3 || 1)) * 100
      : 0;

    const powerWoWPct = prevData
      ? ((data.powerKwh - prevData.powerKwh) / (prevData.powerKwh || 1)) * 100
      : 0;

    return {
      date,
      waterM3: data.waterM3,
      waterCost: data.waterCost,
      waterWoWPct,
      powerKwh: data.powerKwh,
      powerCost: data.powerCost,
      powerWoWPct,
      totalCost: data.waterCost + data.powerCost,
    };
  });
}

// ---------------- Monthly Billing Summary for Farm Overheads ----------------

export interface MonthlyWaterMeterSummary {
  meterId: string;
  meterName: string;
  location: string;
  totalM3: number;
  estimatedCostKsh: number;
  readingsCount: number;
  sharePct: number;
}

export interface MonthlyPrepaidMeterSummary {
  meterId: string;
  meterName: string;
  meterNumber: string;
  location: string;
  tokenUnitsKwh: number;
  grossAmountKsh: number;
  netTokenAmountKsh: number;
  effectiveRateKshPerKwh: number;
  tokensCount: number;
  sharePct: number;
}

export interface MonthlyBillingSummaryData {
  monthKey: string; // e.g. "2026-11"
  monthLabel: string; // e.g. "November 2026"
  daysInMonth: number;
  // Water aggregations
  waterTotalM3: number;
  waterEstimatedCostKsh: number;
  waterReadingsCount: number;
  waterMetersSummary: MonthlyWaterMeterSummary[];
  // Prepaid token aggregations
  prepaidTotalUnitsKwh: number;
  prepaidTotalGrossKsh: number;
  prepaidTotalNetKsh: number;
  prepaidEffectiveRateKshPerKwh: number;
  prepaidTokensCount: number;
  prepaidMetersSummary: MonthlyPrepaidMeterSummary[];
  // Combined Farm Overhead Metrics
  totalFarmOverheadKsh: number;
  averageDailyOverheadKsh: number;
  waterOverheadSharePct: number;
  powerOverheadSharePct: number;
}

/**
 * Returns list of distinct month options (YYYY-MM) present in weekly water or prepaid tokens data
 */
export function getAvailableBillingMonths(
  weeklyWater: WaterWeeklyReading[],
  prepaidTokens: ElectricityPrepaidToken[]
): { key: string; label: string }[] {
  const monthsSet = new Set<string>();

  weeklyWater.forEach((r) => {
    if (r.date && r.date.length >= 7) {
      monthsSet.add(r.date.substring(0, 7));
    }
  });

  prepaidTokens.forEach((r) => {
    if (r.date && r.date.length >= 7) {
      monthsSet.add(r.date.substring(0, 7));
    }
  });

  // Always ensure current calendar month is included
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  monthsSet.add(currentMonthKey);
  // Also add 2026-11 and 2026-10 if not present
  monthsSet.add('2026-11');
  monthsSet.add('2026-10');

  const sorted = Array.from(monthsSet).sort().reverse();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return sorted.map((key) => {
    const [yearStr, monthStr] = key.split('-');
    const monthIndex = parseInt(monthStr, 10) - 1;
    const label = `${monthNames[monthIndex] || monthStr} ${yearStr}`;
    return { key, label };
  });
}

/**
 * Aggregates weekly water consumption/costs and prepaid electricity token purchases/costs
 * for a specific calendar month (YYYY-MM) to compute comprehensive farm overheads.
 */
export function computeMonthlyBillingSummary(
  weeklyWater: WaterWeeklyReading[],
  prepaidTokens: ElectricityPrepaidToken[],
  selectedMonth: string
): MonthlyBillingSummaryData {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  const monthLabel = `${monthNames[monthIndex] || monthStr} ${yearStr}`;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // 1. Filter weekly water for the selected month
  const monthWater = weeklyWater.filter((r) => r.date && r.date.startsWith(selectedMonth));
  const waterTotalM3 = monthWater.reduce((acc, r) => acc + (r.consumption || 0), 0);
  const waterEstimatedCostKsh = waterTotalM3 * DEFAULT_WATER_RATE_PER_M3;

  // Group water by meter
  const waterMeterGroups = new Map<string, { totalM3: number; count: number }>();
  monthWater.forEach((r) => {
    if (!waterMeterGroups.has(r.meterId)) {
      waterMeterGroups.set(r.meterId, { totalM3: 0, count: 0 });
    }
    const g = waterMeterGroups.get(r.meterId)!;
    g.totalM3 += r.consumption || 0;
    g.count += 1;
  });

  const waterMetersSummary: MonthlyWaterMeterSummary[] = [];
  // Include all catalog weekly water meters
  const weeklyMeters = METERS_CATALOG.filter((m) => m.category === 'water_weekly');
  weeklyMeters.forEach((meter) => {
    const data = waterMeterGroups.get(meter.id) || { totalM3: 0, count: 0 };
    const estCost = data.totalM3 * DEFAULT_WATER_RATE_PER_M3;
    const sharePct = waterEstimatedCostKsh > 0 ? (estCost / waterEstimatedCostKsh) * 100 : 0;
    waterMetersSummary.push({
      meterId: meter.id,
      meterName: meter.name,
      location: meter.location,
      totalM3: data.totalM3,
      estimatedCostKsh: estCost,
      readingsCount: data.count,
      sharePct,
    });
  });

  // Sort by cost descending
  waterMetersSummary.sort((a, b) => b.estimatedCostKsh - a.estimatedCostKsh);

  // 2. Filter prepaid electricity tokens for the selected month
  const monthTokens = prepaidTokens.filter((r) => r.date && r.date.startsWith(selectedMonth));
  const prepaidTotalUnitsKwh = monthTokens.reduce((acc, r) => acc + (r.tokenUnitsKwh || 0), 0);
  const prepaidTotalGrossKsh = monthTokens.reduce((acc, r) => acc + (r.grossAmountKsh || 0), 0);
  const prepaidTotalNetKsh = monthTokens.reduce((acc, r) => acc + (r.netTokenAmountKsh || 0), 0);
  const prepaidEffectiveRateKshPerKwh =
    prepaidTotalUnitsKwh > 0 ? prepaidTotalGrossKsh / prepaidTotalUnitsKwh : 0;

  // Group tokens by meter
  const tokenMeterGroups = new Map<
    string,
    { units: number; gross: number; net: number; count: number }
  >();
  monthTokens.forEach((r) => {
    if (!tokenMeterGroups.has(r.meterId)) {
      tokenMeterGroups.set(r.meterId, { units: 0, gross: 0, net: 0, count: 0 });
    }
    const g = tokenMeterGroups.get(r.meterId)!;
    g.units += r.tokenUnitsKwh || 0;
    g.gross += r.grossAmountKsh || 0;
    g.net += r.netTokenAmountKsh || 0;
    g.count += 1;
  });

  const prepaidMetersSummary: MonthlyPrepaidMeterSummary[] = [];
  const prepaidMetersCatalog = METERS_CATALOG.filter((m) => m.category === 'electricity_prepaid');
  prepaidMetersCatalog.forEach((meter) => {
    const data = tokenMeterGroups.get(meter.id) || { units: 0, gross: 0, net: 0, count: 0 };
    const effectiveRate = data.units > 0 ? data.gross / data.units : 0;
    const sharePct = prepaidTotalGrossKsh > 0 ? (data.gross / prepaidTotalGrossKsh) * 100 : 0;
    prepaidMetersSummary.push({
      meterId: meter.id,
      meterName: meter.name,
      meterNumber: meter.meterNumber || '',
      location: meter.location,
      tokenUnitsKwh: data.units,
      grossAmountKsh: data.gross,
      netTokenAmountKsh: data.net,
      effectiveRateKshPerKwh: effectiveRate,
      tokensCount: data.count,
      sharePct,
    });
  });

  // Sort by gross spend descending
  prepaidMetersSummary.sort((a, b) => b.grossAmountKsh - a.grossAmountKsh);

  // 3. Combined Farm Overhead
  const totalFarmOverheadKsh = waterEstimatedCostKsh + prepaidTotalGrossKsh;
  const averageDailyOverheadKsh = daysInMonth > 0 ? totalFarmOverheadKsh / daysInMonth : 0;
  const waterOverheadSharePct =
    totalFarmOverheadKsh > 0 ? (waterEstimatedCostKsh / totalFarmOverheadKsh) * 100 : 0;
  const powerOverheadSharePct =
    totalFarmOverheadKsh > 0 ? (prepaidTotalGrossKsh / totalFarmOverheadKsh) * 100 : 0;

  return {
    monthKey: selectedMonth,
    monthLabel,
    daysInMonth,
    waterTotalM3,
    waterEstimatedCostKsh,
    waterReadingsCount: monthWater.length,
    waterMetersSummary,
    prepaidTotalUnitsKwh,
    prepaidTotalGrossKsh,
    prepaidTotalNetKsh,
    prepaidEffectiveRateKshPerKwh,
    prepaidTokensCount: monthTokens.length,
    prepaidMetersSummary,
    totalFarmOverheadKsh,
    averageDailyOverheadKsh,
    waterOverheadSharePct,
    powerOverheadSharePct,
  };
}
