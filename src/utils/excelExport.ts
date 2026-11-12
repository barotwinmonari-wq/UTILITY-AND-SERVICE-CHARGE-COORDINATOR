import * as XLSX from 'xlsx';
import {
  WaterWeeklyReading,
  WaterDailyReading,
  ElectricityPostpaidReading,
  ElectricityPrepaidToken,
} from '../types';
import { METERS_CATALOG, DEFAULT_WATER_RATE_PER_M3 } from '../data/meterCatalog';

export function exportComprehensiveUtilityWorkbook(
  weeklyWater: WaterWeeklyReading[],
  dailyWater: WaterDailyReading[],
  postpaidPower: ElectricityPostpaidReading[],
  prepaidTokens: ElectricityPrepaidToken[]
) {
  const wb = XLSX.utils.book_new();

  const meterMap = new Map(METERS_CATALOG.map((m) => [m.id, m]));

  // --- Sheet 1: Executive Summary ---
  const totalWeeklyWater = weeklyWater.reduce(
    (sum, r) => sum + r.consumption,
    0
  );
  const totalDailyWater = dailyWater.reduce(
    (sum, r) => sum + r.totalConsumption,
    0
  );
  const grandTotalWaterM3 = totalWeeklyWater + totalDailyWater;
  const estimatedWaterBillKsh = grandTotalWaterM3 * DEFAULT_WATER_RATE_PER_M3;

  const totalPostpaidKwh = postpaidPower.reduce(
    (sum, r) => sum + r.consumption,
    0
  );
  const totalPostpaidKsh = postpaidPower.reduce(
    (sum, r) => sum + r.billAmountKsh,
    0
  );

  const totalPrepaidKwh = prepaidTokens.reduce(
    (sum, r) => sum + r.tokenUnitsKwh,
    0
  );
  const totalPrepaidKsh = prepaidTokens.reduce(
    (sum, r) => sum + r.grossAmountKsh,
    0
  );
  const grandTotalPowerKwh = totalPostpaidKwh + totalPrepaidKwh;
  const grandTotalPowerKsh = totalPostpaidKsh + totalPrepaidKsh;

  const summaryData = [
    ['GATHONI PARK FARM — UTILITY & SERVICE CHARGE REPORT'],
    ['Generated On', new Date().toISOString().slice(0, 10)],
    ['Status', 'Official Operational Ledger'],
    [''],
    ['CATEGORY', 'CONSUMPTION UNITS', 'ESTIMATED / BILLED COST (KSh)', 'NOTES'],
    [
      'Weekly Water Supply (6 Meters)',
      `${totalWeeklyWater.toFixed(2)} m³`,
      (totalWeeklyWater * DEFAULT_WATER_RATE_PER_M3).toFixed(2),
      'Monday weekly schedule',
    ],
    [
      'Special Daily Water (TTA & WRA)',
      `${totalDailyWater.toFixed(2)} m³`,
      (totalDailyWater * DEFAULT_WATER_RATE_PER_M3).toFixed(2),
      'Continuous river weir & statutory intake',
    ],
    [
      'Total Water Service',
      `${grandTotalWaterM3.toFixed(2)} m³`,
      estimatedWaterBillKsh.toFixed(2),
      `Tariff baseline @ KSh ${DEFAULT_WATER_RATE_PER_M3}/m³`,
    ],
    [''],
    [
      'Postpaid KPLC Electricity (3 Meters)',
      `${totalPostpaidKwh.toFixed(2)} kWh`,
      totalPostpaidKsh.toFixed(2),
      'Boreholes 1 & 2 + Naiposha Substation',
    ],
    [
      'Prepaid KPLC Tokens (7 Meters)',
      `${totalPrepaidKwh.toFixed(2)} kWh`,
      totalPrepaidKsh.toFixed(2),
      'Offices, grounds & staff quarters',
    ],
    [
      'Total Electricity Service',
      `${grandTotalPowerKwh.toFixed(2)} kWh`,
      grandTotalPowerKsh.toFixed(2),
      `Avg blended rate @ KSh ${(grandTotalPowerKsh / (grandTotalPowerKwh || 1)).toFixed(2)}/kWh`,
    ],
    [''],
    [
      'COMBINED UTILITY EXPENDITURE',
      '—',
      (estimatedWaterBillKsh + grandTotalPowerKsh).toFixed(2),
      'Gathoni Park Farm Operational Total',
    ],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 24 }, { wch: 30 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // --- Sheet 2: Weekly Water Meters ---
  const weeklyWaterRows = weeklyWater.map((r) => {
    const meter = meterMap.get(r.meterId);
    return {
      'Start Date': r.startDate || '',
      'End Date': r.endDate || r.date,
      'Meter Name': meter?.name || r.meterId,
      Location: meter?.location || '',
      'Start Reading (m³)': r.previousReading,
      'End Reading (m³)': r.endReading,
      'Consumption (m³)': r.consumption,
      'Est Cost (KSh)': Number(
        (r.consumption * DEFAULT_WATER_RATE_PER_M3).toFixed(2)
      ),
      'Meter Rollover': r.isRollover ? 'Yes' : 'No',
      Notes: r.notes || '',
      'Has Audit Photo': r.photoUrl ? 'Yes (Attached)' : 'No',
    };
  });
  const wsWeeklyWater = XLSX.utils.json_to_sheet(weeklyWaterRows);
  wsWeeklyWater['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 30 },
    { wch: 36 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 36 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsWeeklyWater, 'Weekly Water');

  // --- Sheet 3: Special Daily Water (TTA & WRA) ---
  const dailyWaterRows = dailyWater.map((r) => {
    const meter = meterMap.get(r.meterId);
    return {
      Date: r.displayDate || r.date,
      'Meter Name': meter?.name || r.meterId,
      'Start Time': r.startTime,
      'End Time': r.endTime,
      'Start Reading': r.startReading,
      'End Reading': r.endReading,
      'Day Consumption': r.dayConsumption,
      'Night Consumption': r.nightConsumption,
      '24hrs Total': r.totalConsumption,
      'Running Total': r.runningTotal ?? r.totalConsumption,
      Notes: r.notes || '',
      'Start Photo Attached': r.startPhotoUrl ? 'Yes' : 'No',
      'End Photo Attached': r.endPhotoUrl ? 'Yes' : 'No',
    };
  });
  const wsDailyWater = XLSX.utils.json_to_sheet(dailyWaterRows);
  wsDailyWater['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 32 },
    { wch: 20 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDailyWater, 'Special Daily Water');

  // --- Sheet 4: Postpaid Electricity ---
  const postpaidRows = postpaidPower.map((r) => {
    const meter = meterMap.get(r.meterId);
    return {
      'Reading Date': r.date,
      'Meter Name': meter?.name || r.meterId,
      'KPLC Meter #': meter?.meterNumber || '',
      Location: meter?.location || '',
      'Previous Reading (kWh)': r.previousReading,
      'End Reading (kWh)': r.endReading,
      'Consumption (kWh)': r.consumption,
      'Tariff Rate (KSh/kWh)': r.tariffRateKsh,
      'Bill Amount (KSh)': r.billAmountKsh,
      'Rollover Flag': r.isRollover ? 'Yes' : 'No',
      Notes: r.notes || '',
      'Bill/Photo Attached': r.photoUrl ? 'Yes' : 'No',
    };
  });
  const wsPostpaid = XLSX.utils.json_to_sheet(postpaidRows);
  wsPostpaid['!cols'] = [
    { wch: 14 },
    { wch: 34 },
    { wch: 22 },
    { wch: 36 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 20 },
    { wch: 16 },
    { wch: 34 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPostpaid, 'Postpaid Electricity');

  // --- Sheet 5: Prepaid Electricity Tokens ---
  const prepaidRows = prepaidTokens.map((r) => {
    const meter = meterMap.get(r.meterId);
    return {
      'Purchase Date': r.date,
      'Meter Name': meter?.name || r.meterId,
      'Meter Number': meter?.meterNumber || '',
      'Token Number (20-Digit)': r.tokenNumber,
      'Token Units (kWh)': r.tokenUnitsKwh,
      'Gross Amount Paid (KSh)': r.grossAmountKsh,
      'Net Token Amount (KSh)': r.netTokenAmountKsh,
      'Effective Rate (KSh/kWh)': r.effectiveRateKshPerKwh,
      Notes: r.notes || '',
      'Receipt Attached': r.receiptPhotoUrl ? 'Yes' : 'No',
    };
  });
  const wsPrepaid = XLSX.utils.json_to_sheet(prepaidRows);
  wsPrepaid['!cols'] = [
    { wch: 14 },
    { wch: 36 },
    { wch: 20 },
    { wch: 28 },
    { wch: 18 },
    { wch: 24 },
    { wch: 22 },
    { wch: 24 },
    { wch: 32 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPrepaid, 'Prepaid Electricity Tokens');

  // Generate and trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Gathoni_Park_Farm_Utility_Report_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}
