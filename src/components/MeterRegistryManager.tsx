import React, { useState } from 'react';
import {
  METERS_CATALOG,
  DEFAULT_WATER_RATE_PER_M3,
} from '../data/meterCatalog';
import {
  WaterWeeklyReading,
  WaterDailyReading,
  ElectricityPostpaidReading,
  ElectricityPrepaidToken,
  MeterCategory,
} from '../types';
import { findLastReadingForMeter } from '../utils/storage';
import { formatNumber } from '../utils/calculations';
import {
  Droplet,
  Zap,
  Clock,
  Calendar,
  MapPin,
  Plus,
  Search,
  CheckCircle2,
} from 'lucide-react';

interface MeterRegistryManagerProps {
  weeklyWater: WaterWeeklyReading[];
  dailyWater: WaterDailyReading[];
  postpaidPower: ElectricityPostpaidReading[];
  prepaidTokens: ElectricityPrepaidToken[];
  onOpenQuickEntry: (category?: MeterCategory, meterId?: string) => void;
}

export const MeterRegistryManager: React.FC<MeterRegistryManagerProps> = ({
  weeklyWater,
  dailyWater,
  postpaidPower,
  prepaidTokens,
  onOpenQuickEntry,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMeters = METERS_CATALOG.filter((m) => {
    if (filterCategory !== 'all' && m.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        (m.meterNumber && m.meterNumber.toLowerCase().includes(q)) ||
        m.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Gathoni Park Farm Meter Registry</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              18 Registered Points
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete inventory of physical meters, locations, schedules, and latest dial readings
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search meter or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-60 pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden"
            />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                filterCategory === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All (18)
            </button>
            <button
              onClick={() => setFilterCategory('water_weekly')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                filterCategory === 'water_weekly'
                  ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Water Weekly (6)
            </button>
            <button
              onClick={() => setFilterCategory('water_daily_special')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                filterCategory === 'water_daily_special'
                  ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Daily TTA/WRA (2)
            </button>
            <button
              onClick={() => setFilterCategory('electricity_postpaid')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                filterCategory === 'electricity_postpaid'
                  ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Postpaid (3)
            </button>
            <button
              onClick={() => setFilterCategory('electricity_prepaid')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 ${
                filterCategory === 'electricity_prepaid'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Prepaid (7)
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Meter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMeters.map((meter) => {
          const lastReadingInfo = findLastReadingForMeter(
            meter.id,
            weeklyWater,
            dailyWater,
            postpaidPower
          );

          // For prepaid, check latest token
          const latestToken = prepaidTokens
            .filter((t) => t.meterId === meter.id)
            .sort((a, b) => b.date.localeCompare(a.date))[0];

          const isWater = meter.category.startsWith('water');

          return (
            <div
              key={meter.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div>
                {/* Header line */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`p-1.5 rounded-lg text-xs ${
                        isWater
                          ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {isWater ? (
                        <Droplet className="w-4 h-4" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {meter.name}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {meter.unit}
                  </span>
                </div>

                {/* Meter # if present */}
                {meter.meterNumber && (
                  <div className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                    KPLC Meter #: {meter.meterNumber}
                  </div>
                )}

                {/* Location */}
                <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{meter.location}</span>
                </div>

                {/* Schedule info */}
                <div className="text-[11px] text-slate-500 mb-3">
                  Schedule: <span className="font-medium text-slate-700 dark:text-slate-300">{meter.schedule}</span>
                  {meter.notes && ` · ${meter.notes}`}
                </div>
              </div>

              {/* Status & Last Recorded Value */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                    Last Logged Reading
                  </span>
                  {meter.category === 'electricity_prepaid' ? (
                    latestToken ? (
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {latestToken.date} · {latestToken.tokenUnitsKwh} kWh
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No token logs</span>
                    )
                  ) : lastReadingInfo ? (
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      {formatNumber(lastReadingInfo.lastReading, 1)} {meter.unit}
                      <span className="text-[11px] font-normal text-slate-400 ml-1">
                        ({lastReadingInfo.lastDate})
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">No logs yet</span>
                  )}
                </div>

                <button
                  onClick={() => onOpenQuickEntry(meter.category, meter.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
