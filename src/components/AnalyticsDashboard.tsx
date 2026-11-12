import React, { useState, useMemo } from 'react';
import {
  Droplet,
  Zap,
  TrendingUp,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  FileSpreadsheet,
  Receipt,
  Coins,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PieChart,
  Filter,
} from 'lucide-react';
import {
  WaterWeeklyReading,
  WaterDailyReading,
  ElectricityPostpaidReading,
  ElectricityPrepaidToken,
  MeterCategory,
} from '../types';
import { METERS_CATALOG, DEFAULT_WATER_RATE_PER_M3 } from '../data/meterCatalog';
import {
  formatKsh,
  formatNumber,
  computeUtilityTotals,
  computeWeeklyTrends,
  detectAnomalies,
  computeMonthlyBillingSummary,
  getAvailableBillingMonths,
} from '../utils/calculations';

interface AnalyticsDashboardProps {
  weeklyWater: WaterWeeklyReading[];
  dailyWater: WaterDailyReading[];
  postpaidPower: ElectricityPostpaidReading[];
  prepaidTokens: ElectricityPrepaidToken[];
  onOpenQuickEntry: (category?: MeterCategory, meterId?: string) => void;
  onNavigateTab: (tab: any) => void;
  onExportExcel: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  weeklyWater,
  dailyWater,
  postpaidPower,
  prepaidTokens,
  onOpenQuickEntry,
  onNavigateTab,
  onExportExcel,
}) => {
  const totals = computeUtilityTotals(
    weeklyWater,
    dailyWater,
    postpaidPower,
    prepaidTokens
  );
  const weeklyTrends = computeWeeklyTrends(weeklyWater, postpaidPower);
  const anomalies = detectAnomalies(weeklyWater, dailyWater, postpaidPower);

  // Check Monday schedule compliance (for the most recent Monday)
  // Let's find latest date in weekly records
  const latestMondayWater = [...weeklyWater].sort((a, b) =>
    b.date.localeCompare(a.date)
  )[0]?.date || '2026-11-02';

  const mondayWaterMeters = METERS_CATALOG.filter(
    (m) => m.category === 'water_weekly'
  );
  const mondayPowerMeters = METERS_CATALOG.filter(
    (m) => m.category === 'electricity_postpaid'
  );

  const completedWaterMeters = new Set(
    weeklyWater
      .filter((r) => r.date === latestMondayWater)
      .map((r) => r.meterId)
  );
  const completedPowerMeters = new Set(
    postpaidPower
      .filter((r) => r.date === latestMondayWater)
      .map((r) => r.meterId)
  );

  // Available Months for Monthly Billing Summary
  const availableMonths = useMemo(
    () => getAvailableBillingMonths(weeklyWater, prepaidTokens),
    [weeklyWater, prepaidTokens]
  );

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return availableMonths[0]?.key || '2026-11';
  });

  const [breakdownView, setBreakdownView] = useState<'all' | 'water' | 'prepaid'>('all');

  const monthlyBilling = useMemo(
    () => computeMonthlyBillingSummary(weeklyWater, prepaidTokens, selectedMonth),
    [weeklyWater, prepaidTokens, selectedMonth]
  );

  // Helper to switch to previous/next month
  const currentMonthIdx = availableMonths.findIndex((m) => m.key === selectedMonth);
  const handlePrevMonth = () => {
    if (currentMonthIdx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentMonthIdx + 1].key);
    }
  };
  const handleNextMonth = () => {
    if (currentMonthIdx > 0) {
      setSelectedMonth(availableMonths[currentMonthIdx - 1].key);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner with Gathoni Park Farm Aerial */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-900 text-white">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/gathoni_park_farm_aerial_1794225033079.jpg"
            alt="Gathoni Park Farm Aerial Estate"
            className="w-full h-full object-cover object-center opacity-30"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
        </div>

        <div className="relative px-6 py-7 sm:px-8 sm:py-8 max-w-3xl">
          <div className="text-xs font-semibold text-emerald-400 tracking-wider uppercase mb-1">
            Gathoni Park Farm · Utility & Service Charge Infrastructure
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Automated Utility Ledger & Consumption Intelligence
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed mb-5">
            Centralized tracking across 18 operational meters: municipal Kanjo & river weir water extraction, deep borehole pumping, and commercial postpaid/prepaid power distribution.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onOpenQuickEntry('water_weekly')}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-xs"
            >
              + Log Monday Reading
            </button>
            <button
              onClick={() => onOpenQuickEntry('electricity_prepaid')}
              className="px-4 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur-xs transition-colors border border-white/20"
            >
              + Record Token Purchase
            </button>
            <button
              onClick={() => onNavigateTab('google_sheets')}
              className="px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 rounded-lg backdrop-blur-xs transition-colors border border-emerald-500/30 flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>⚡ Google Sheets Sync &amp; Push</span>
            </button>
            <button
              onClick={onExportExcel}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              Download Full Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Water */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Total Water Recorded
            </span>
            <span className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400">
              <Droplet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-slate-100">
            {formatNumber(totals.totalWaterM3, 1)}{' '}
            <span className="text-sm font-normal text-slate-500">m³</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
            <span>Weekly: {formatNumber(totals.totalWaterWeeklyM3, 0)} m³</span>
            <span>·</span>
            <span>Daily: {formatNumber(totals.totalWaterDailyM3, 0)} m³</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-cyan-700 dark:text-cyan-400 font-medium">
            Est. Water Value: {formatKsh(totals.estimatedWaterCostKsh)}
          </div>
        </div>

        {/* Total Electricity */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Total Power Consumed
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-slate-100">
            {formatNumber(totals.totalElectricityKwh, 1)}{' '}
            <span className="text-sm font-normal text-slate-500">kWh</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
            <span>Postpaid: {formatNumber(totals.totalPostpaidKwh, 0)}</span>
            <span>·</span>
            <span>Prepaid: {formatNumber(totals.totalPrepaidUnitsKwh, 0)}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            Blended Rate: KSh {formatNumber(totals.effectiveElectCostPerKwh, 2)} / kWh
          </div>
        </div>

        {/* Total Utility Expenditure */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Total Utility Spend
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-slate-100">
            {formatKsh(totals.combinedTotalCostKsh)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
            <span>Power: {formatKsh(totals.totalElectricityCostKsh)}</span>
            <span>·</span>
            <span>Water: {formatKsh(totals.estimatedWaterCostKsh)}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
            Cumulative across recorded period
          </div>
        </div>

        {/* Active Meters */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Meter Fleet Status
            </span>
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-slate-100">
            18 / 18{' '}
            <span className="text-sm font-normal text-slate-500">Active</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between">
            <span>8 Water Meters</span>
            <span>·</span>
            <span>10 Power Meters</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 font-medium flex items-center justify-between">
            <span>100% Operational Grid</span>
            <button
              onClick={() => onNavigateTab('meter_registry')}
              className="text-emerald-600 hover:underline"
            >
              View Fleet →
            </button>
          </div>
        </div>
      </div>

      {/* Outlier Alerts Banner (if anomalies detected) */}
      {anomalies.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-lg text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                  Statistical Outlier & Leak Detection ({anomalies.length} Flagged Events)
                </h3>
                <span className="text-xs font-mono font-medium text-amber-700 dark:text-amber-400">
                  Threshold: &gt; 25% deviation from baseline
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-1">
                The automated system analyzed historical moving averages and flagged unexpected spikes in consumption.
              </p>

              <div className="mt-3 space-y-2">
                {anomalies.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-amber-200/80 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {a.meterName}
                      </span>
                      <span className="text-slate-500 ml-2">({a.date})</span>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                        {a.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-400 px-2 py-0.5 bg-amber-50 dark:bg-amber-950 rounded">
                        +{a.percentageDiff}% spike
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Billing Summary for Farm Overheads */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        {/* Section Header with Month Selector */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                <Receipt className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Monthly Billing Summary</span>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Farm Overheads
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Aggregating Monday weekly water draw and prepaid electricity tokens for {monthlyBilling.monthLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Month Selector Controls */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handlePrevMonth}
              disabled={currentMonthIdx >= availableMonths.length - 1}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="appearance-none pl-8 pr-8 py-1.5 text-xs font-semibold font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} {m.key === '2026-11' ? '(Current Month)' : ''}
                  </option>
                ))}
              </select>
              <CalendarDays className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <ChevronRight className="w-3 h-3 text-slate-400 rotate-90 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <button
              onClick={handleNextMonth}
              disabled={currentMonthIdx <= 0}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Executive Monthly Overhead KPI Cards */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-200 dark:border-slate-800">
          {/* Card 1: Total Farm Overhead Expenditure */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-emerald-400">
                Combined Farm Overhead
              </span>
              <span className="p-1 rounded bg-slate-800 text-emerald-400">
                <Coins className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
              {formatKsh(monthlyBilling.totalFarmOverheadKsh)}
            </div>
            <div className="text-xs text-slate-300 mt-2 flex items-center justify-between font-mono">
              <span>Avg. Daily Burn:</span>
              <span className="font-bold text-emerald-300">
                {formatKsh(monthlyBilling.averageDailyOverheadKsh)} / day
              </span>
            </div>

            {/* Split Progress Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                <span>Power: {monthlyBilling.powerOverheadSharePct.toFixed(0)}%</span>
                <span>Water: {monthlyBilling.waterOverheadSharePct.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden flex">
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{ width: `${monthlyBilling.powerOverheadSharePct}%` }}
                  title={`Prepaid Power: ${monthlyBilling.powerOverheadSharePct.toFixed(1)}%`}
                />
                <div
                  className="bg-cyan-400 h-full transition-all"
                  style={{ width: `${monthlyBilling.waterOverheadSharePct}%` }}
                  title={`Water: ${monthlyBilling.waterOverheadSharePct.toFixed(1)}%`}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Weekly Water Utility Overhead */}
          <div className="p-4 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-900/60 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-cyan-800 dark:text-cyan-300 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Weekly Water Utility Overhead
              </span>
              <span className="p-1 rounded bg-cyan-100 dark:bg-cyan-900/70 text-cyan-700 dark:text-cyan-300">
                <Droplet className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-cyan-950 dark:text-cyan-100">
              {formatNumber(monthlyBilling.waterTotalM3, 1)}{' '}
              <span className="text-sm font-normal text-slate-500">m³</span>
            </div>
            <div className="text-xs text-cyan-900 dark:text-cyan-300 mt-2 font-mono flex items-center justify-between font-semibold">
              <span>Estimated Cost:</span>
              <span className="text-sm font-bold text-cyan-800 dark:text-cyan-200">
                {formatKsh(monthlyBilling.waterEstimatedCostKsh)}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-cyan-200/60 dark:border-cyan-900/40 text-[11px] text-cyan-700 dark:text-cyan-400 flex items-center justify-between">
              <span>{monthlyBilling.waterReadingsCount} weekly reading logs</span>
              <span>Tariff: KSh {DEFAULT_WATER_RATE_PER_M3.toFixed(2)} / m³</span>
            </div>
          </div>

          {/* Card 3: Prepaid Electricity Tokens Overhead */}
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Prepaid Electricity Overhead
              </span>
              <span className="p-1 rounded bg-amber-100 dark:bg-amber-900/70 text-amber-700 dark:text-amber-300">
                <Zap className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl font-mono font-extrabold text-amber-950 dark:text-amber-100">
              {formatNumber(monthlyBilling.prepaidTotalUnitsKwh, 1)}{' '}
              <span className="text-sm font-normal text-slate-500">kWh</span>
            </div>
            <div className="text-xs text-amber-900 dark:text-amber-300 mt-2 font-mono flex items-center justify-between font-semibold">
              <span>Gross Tokens Paid:</span>
              <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                {formatKsh(monthlyBilling.prepaidTotalGrossKsh)}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span>{monthlyBilling.prepaidTokensCount} tokens purchased</span>
              <span>Rate: KSh {formatNumber(monthlyBilling.prepaidEffectiveRateKshPerKwh, 2)} / kWh</span>
            </div>
          </div>
        </div>

        {/* View Tabs & Actions */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => setBreakdownView('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                breakdownView === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Combined Overhead Fleet
            </button>
            <button
              onClick={() => setBreakdownView('water')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                breakdownView === 'water'
                  ? 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Droplet className="w-3.5 h-3.5" />
              <span>Weekly Water Meters (6)</span>
            </button>
            <button
              onClick={() => setBreakdownView('prepaid')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                breakdownView === 'prepaid'
                  ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Prepaid Power Meters (7)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenQuickEntry('water_weekly')}
              className="px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 rounded-md border border-cyan-200 dark:border-cyan-800 transition-colors"
            >
              + Log Water Reading
            </button>
            <button
              onClick={() => onOpenQuickEntry('electricity_prepaid')}
              className="px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 rounded-md border border-amber-200 dark:border-amber-800 transition-colors"
            >
              + Record Token
            </button>
          </div>
        </div>

        {/* View 1: Combined Side-by-Side Overview */}
        {breakdownView === 'all' && (
          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Water Fleet Summary List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                  <Droplet className="w-4 h-4 text-cyan-600" />
                  <span>Weekly Water Fleet Allocation</span>
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatKsh(monthlyBilling.waterEstimatedCostKsh)}
                </span>
              </div>

              <div className="space-y-2">
                {monthlyBilling.waterMetersSummary.map((m) => (
                  <div
                    key={m.meterId}
                    className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {m.meterName}
                      </span>
                      <span className="font-mono font-bold text-cyan-800 dark:text-cyan-300">
                        {formatKsh(m.estimatedCostKsh)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span className="truncate pr-2">{m.location}</span>
                      <span className="font-mono shrink-0">
                        {formatNumber(m.totalM3, 1)} m³ ({m.readingsCount} logs)
                      </span>
                    </div>
                    {/* Share bar */}
                    <div className="mt-2 w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(3, m.sharePct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prepaid Fleet Summary List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>Prepaid Electricity Allocation</span>
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                  {formatKsh(monthlyBilling.prepaidTotalGrossKsh)}
                </span>
              </div>

              <div className="space-y-2">
                {monthlyBilling.prepaidMetersSummary.map((m) => (
                  <div
                    key={m.meterId}
                    className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate pr-2">
                        {m.meterName}
                      </span>
                      <span className="font-mono font-bold text-amber-800 dark:text-amber-300 shrink-0">
                        {formatKsh(m.grossAmountKsh)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span className="truncate pr-2">{m.location}</span>
                      <span className="font-mono shrink-0">
                        {formatNumber(m.tokenUnitsKwh, 1)} kWh ({m.tokensCount} tokens)
                      </span>
                    </div>
                    {/* Share bar */}
                    <div className="mt-2 w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(3, m.sharePct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* View 2: Detailed Table for Weekly Water Meters */}
        {breakdownView === 'water' && (
          <div>
            <div className="md:hidden px-4 py-1.5 bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>↔ Scroll table horizontally to view full metrics</span>
              <span className="font-mono text-[10px] text-cyan-600 font-semibold">8 columns</span>
            </div>
            <div className="overflow-x-auto w-full overscroll-x-contain">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold font-mono">
                    <th className="py-3 px-4 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Water Meter Name</th>
                  <th className="py-3 px-4">Farm Sector Location</th>
                  <th className="py-3 px-4 text-center">Cycles Logged</th>
                  <th className="py-3 px-4 text-right">Consumption (m³)</th>
                  <th className="py-3 px-4 text-right">Standard Tariff</th>
                  <th className="py-3 px-4 text-right">Estimated Cost (KSh)</th>
                  <th className="py-3 px-4 text-right">Water Overhead Share</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {monthlyBilling.waterMetersSummary.map((m) => (
                  <tr
                    key={m.meterId}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-sans sticky left-0 bg-white dark:bg-slate-900 shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)] z-10">
                      {m.meterName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-sans">
                      {m.location}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">
                      {m.readingsCount}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-cyan-800 dark:text-cyan-300">
                      {formatNumber(m.totalM3, 1)} m³
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500">
                      KSh {DEFAULT_WATER_RATE_PER_M3.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatKsh(m.estimatedCostKsh)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 font-bold">
                        {m.sharePct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onOpenQuickEntry('water_weekly', m.meterId)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-sans font-bold hover:underline"
                      >
                        + Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* View 3: Detailed Table for Prepaid Power Tokens */}
        {breakdownView === 'prepaid' && (
          <div>
            <div className="md:hidden px-4 py-1.5 bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>↔ Scroll table horizontally to view full metrics</span>
              <span className="font-mono text-[10px] text-amber-600 font-semibold">9 columns</span>
            </div>
            <div className="overflow-x-auto w-full overscroll-x-contain">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold font-mono">
                    <th className="py-3 px-4 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Prepaid Meter Name</th>
                    <th className="py-3 px-4">KPLC Meter Number</th>
                    <th className="py-3 px-4">Location Sector</th>
                    <th className="py-3 px-4 text-center">Tokens Recorded</th>
                    <th className="py-3 px-4 text-right">Total Units (kWh)</th>
                    <th className="py-3 px-4 text-right">Effective Rate</th>
                    <th className="py-3 px-4 text-right">Gross Amount Paid (KSh)</th>
                    <th className="py-3 px-4 text-right">Power Overhead Share</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {monthlyBilling.prepaidMetersSummary.map((m) => (
                    <tr
                      key={m.meterId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-sans sticky left-0 bg-white dark:bg-slate-900 shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)] z-10">
                        {m.meterName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                        {m.meterNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-sans">
                        {m.location}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">
                        {m.tokensCount}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-800 dark:text-amber-300">
                        {formatNumber(m.tokenUnitsKwh, 1)} kWh
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                        KSh {formatNumber(m.effectiveRateKshPerKwh, 2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatKsh(m.grossAmountKsh)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold">
                          {m.sharePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onOpenQuickEntry('electricity_prepaid', m.meterId)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-sans font-bold hover:underline"
                        >
                          + Token
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Informative Footer Note */}
        <div className="p-3.5 sm:px-6 bg-slate-50/80 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Farm Overhead Calculation Basis:
            </span>
            <span>
              Monday weekly water cycles ending in {monthlyBilling.monthLabel} + all prepaid token purchases recorded in the period.
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300 shrink-0">
            {monthlyBilling.daysInMonth} calendar days in period
          </div>
        </div>
      </div>

      {/* Week-over-Week (WoW) Comparative Analysis Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-150 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Week-over-Week (WoW) Consumption & Financial Comparison
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aggregated Monday weekly cycles across water and commercial electricity
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {weeklyTrends.length} Cycles Evaluated
          </span>
        </div>

        {/* Mobile Horizontal Scroll Indicator Hint */}
        <div className="md:hidden px-4 py-1.5 bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span>↔ Scroll table horizontally to view all weekly metrics</span>
          <span className="font-mono text-[10px] text-emerald-600 font-semibold">8 columns</span>
        </div>

        <div className="overflow-x-auto w-full overscroll-x-contain">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold font-mono">
                <th className="py-2.5 px-4 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Cycle Date</th>
                <th className="py-2.5 px-4 text-right">Water Draw (m³)</th>
                <th className="py-2.5 px-4 text-right">Water WoW Trend</th>
                <th className="py-2.5 px-4 text-right">Power Draw (kWh)</th>
                <th className="py-2.5 px-4 text-right">Power WoW Trend</th>
                <th className="py-2.5 px-4 text-right">Weekly Power Bill (KSh)</th>
                <th className="py-2.5 px-4 text-right">Est. Water Value (KSh)</th>
                <th className="py-2.5 px-4 text-right">Cycle Total (KSh)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {weeklyTrends.map((cycle, i) => (
                <tr
                  key={cycle.date}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100 font-sans sticky left-0 bg-white dark:bg-slate-900 shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)] z-10">
                    {cycle.date}
                  </td>
                  <td className="py-2.5 px-4 text-right text-cyan-800 dark:text-cyan-300 font-medium">
                    {formatNumber(cycle.waterM3, 1)} m³
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {i === 0 ? (
                      <span className="text-slate-400">Baseline</span>
                    ) : cycle.waterWoWPct > 0 ? (
                      <span className="inline-flex items-center text-red-600 dark:text-red-400 font-bold">
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                        +{cycle.waterWoWPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold">
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                        {cycle.waterWoWPct.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right text-amber-800 dark:text-amber-300 font-medium">
                    {formatNumber(cycle.powerKwh, 1)} kWh
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {i === 0 ? (
                      <span className="text-slate-400">Baseline</span>
                    ) : cycle.powerWoWPct > 0 ? (
                      <span className="inline-flex items-center text-red-600 dark:text-red-400 font-bold">
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                        +{cycle.powerWoWPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold">
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                        {cycle.powerWoWPct.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium">
                    {formatKsh(cycle.powerCost)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-400">
                    {formatKsh(cycle.waterCost)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                    {formatKsh(cycle.totalCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monday Schedule Compliance & Operational Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monday Routine Checklist */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Monday Routine Recording Status ({latestMondayWater})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                9 meters required every Monday (6 Water + 3 Postpaid Power)
              </p>
            </div>
            <button
              onClick={() => onOpenQuickEntry('water_weekly')}
              className="text-xs text-emerald-600 font-bold hover:underline"
            >
              + Log Reading
            </button>
          </div>

          <div className="space-y-2 mt-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Water Meters (6)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mondayWaterMeters.map((m) => {
                const isLogged = completedWaterMeters.has(m.id);
                return (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      isLogged
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                        : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                    }`}
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                      {m.name}
                    </span>
                    {isLogged ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Logged
                      </span>
                    ) : (
                      <button
                        onClick={() => onOpenQuickEntry('water_weekly', m.id)}
                        className="text-[11px] text-amber-700 dark:text-amber-400 font-bold hover:underline"
                      >
                        Pending
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-2">
              Postpaid Electricity (3)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {mondayPowerMeters.map((m) => {
                const isLogged = completedPowerMeters.has(m.id);
                return (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      isLogged
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                        : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                    }`}
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-1">
                      {m.name.split(' ')[0]}
                    </span>
                    {isLogged ? (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        ✓
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          onOpenQuickEntry('electricity_postpaid', m.id)
                        }
                        className="text-[11px] text-amber-700 dark:text-amber-400 font-bold hover:underline"
                      >
                        Log
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Operational Service Unit Costs & Allocations */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
            Unit Cost Breakdown & Operational Charge Formula
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Standard metrics for Gathoni Park Farm operational budgeting
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-sans font-semibold text-slate-800 dark:text-slate-200 block">
                  Municipal Water Standard Tariff
                </span>
                <span className="text-[11px] text-slate-500 font-sans">
                  Nairobi / Kiambu County Bulk Agricultural Baseline
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-cyan-700 dark:text-cyan-400">
                  KSh {DEFAULT_WATER_RATE_PER_M3.toFixed(2)} / m³
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-sans font-semibold text-slate-800 dark:text-slate-200 block">
                  Commercial Postpaid Power Tariff
                </span>
                <span className="text-[11px] text-slate-500 font-sans">
                  KPLC Commercial 3-Phase standard tariff
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  KSh 28.50 / kWh
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-sans font-semibold text-slate-800 dark:text-slate-200 block">
                  Prepaid Tokens Effective Blended Rate
                </span>
                <span className="text-[11px] text-slate-500 font-sans">
                  Total Gross M-PESA spend ÷ Total units credited
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  KSh {formatNumber(totals.effectiveElectCostPerKwh, 2)} / kWh
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
