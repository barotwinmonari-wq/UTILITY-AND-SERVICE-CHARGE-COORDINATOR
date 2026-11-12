import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  AlertTriangle,
  CheckCircle,
  FileText,
  Zap,
  Droplet,
} from 'lucide-react';
import {
  MeterCategory,
  WaterWeeklyReading,
  WaterDailyReading,
  ElectricityPostpaidReading,
  ElectricityPrepaidToken,
} from '../types';
import {
  METERS_CATALOG,
  DEFAULT_POSTPAID_TARIFF_KSH,
} from '../data/meterCatalog';
import { findLastReadingForMeter } from '../utils/storage';

interface ReadingEntryModalProps {
  isOpen: boolean;
  initialCategory?: MeterCategory;
  initialMeterId?: string;
  allWeekly: WaterWeeklyReading[];
  allDaily: WaterDailyReading[];
  allPostpaid: ElectricityPostpaidReading[];
  allPrepaid: ElectricityPrepaidToken[];
  onSaveWeekly: (data: WaterWeeklyReading) => void;
  onSaveDaily: (data: WaterDailyReading) => void;
  onSavePostpaid: (data: ElectricityPostpaidReading) => void;
  onSavePrepaid: (data: ElectricityPrepaidToken) => void;
  onClose: () => void;
}

export const ReadingEntryModal: React.FC<ReadingEntryModalProps> = ({
  isOpen,
  initialCategory = 'water_weekly',
  initialMeterId,
  allWeekly,
  allDaily,
  allPostpaid,
  onSaveWeekly,
  onSaveDaily,
  onSavePostpaid,
  onSavePrepaid,
  onClose,
}) => {
  const [category, setCategory] = useState<MeterCategory>(initialCategory);
  const [meterId, setMeterId] = useState<string>('');
  const [date, setDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState<string>('');

  // Weekly Water / Postpaid fields
  const [prevReading, setPrevReading] = useState<number>(0);
  const [endReading, setEndReading] = useState<number>(0);
  const [isRollover, setIsRollover] = useState<boolean>(false);
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // Daily Special Water fields
  const [startTime, setStartTime] = useState<string>('06:00');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [startReading, setStartReading] = useState<number>(0);
  const [midReading, setMidReading] = useState<number>(0);
  const [dailyEndReading, setDailyEndReading] = useState<number>(0);
  const [startPhotoUrl, setStartPhotoUrl] = useState<string>('');
  const [endPhotoUrl, setEndPhotoUrl] = useState<string>('');

  // Postpaid Electricity fields
  const [tariffRate, setTariffRate] = useState<number>(
    DEFAULT_POSTPAID_TARIFF_KSH
  );
  const [customBillAmount, setCustomBillAmount] = useState<number | null>(null);

  // Prepaid Electricity fields
  const [tokenNumber, setTokenNumber] = useState<string>('');
  const [tokenUnitsKwh, setTokenUnitsKwh] = useState<number>(100);
  const [grossAmountKsh, setGrossAmountKsh] = useState<number>(3000);
  const [netTokenAmountKsh, setNetTokenAmountKsh] = useState<number>(2450);
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState<string>('');

  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset or initialize when opened
  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      const availableMeters = METERS_CATALOG.filter(
        (m) => m.category === initialCategory
      );
      const selectedId =
        initialMeterId &&
        availableMeters.some((m) => m.id === initialMeterId)
          ? initialMeterId
          : availableMeters[0]?.id || '';
      setMeterId(selectedId);
      setDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setPhotoUrl('');
      setStartPhotoUrl('');
      setEndPhotoUrl('');
      setReceiptPhotoUrl('');
      setIsRollover(false);
      setCustomBillAmount(null);
    }
  }, [isOpen, initialCategory, initialMeterId]);

  // When meterId or category changes, auto-populate previous reading!
  useEffect(() => {
    if (!meterId) return;

    const last = findLastReadingForMeter(
      meterId,
      allWeekly,
      allDaily,
      allPostpaid
    );
    if (last) {
      if (category === 'water_weekly' || category === 'electricity_postpaid') {
        setPrevReading(last.lastReading);
        setEndReading(Number((last.lastReading + 10).toFixed(1)));
      } else if (category === 'water_daily_special') {
        setStartReading(last.lastReading);
        setMidReading(Number((last.lastReading + 80).toFixed(1)));
        setDailyEndReading(Number((last.lastReading + 150).toFixed(1)));
      }
    } else {
      if (category === 'water_weekly' || category === 'electricity_postpaid') {
        setPrevReading(1000);
        setEndReading(1050);
      } else if (category === 'water_daily_special') {
        setStartReading(5000);
        setMidReading(5080);
        setDailyEndReading(5150);
      }
    }
  }, [meterId, category, allWeekly, allDaily, allPostpaid]);

  // When category changes, set valid meterId
  const handleCategoryChange = (cat: MeterCategory) => {
    setCategory(cat);
    const catMeters = METERS_CATALOG.filter((m) => m.category === cat);
    if (catMeters.length > 0) {
      setMeterId(catMeters[0].id);
    }
  };

  // Live calculations
  const weeklyConsumption = isRollover
    ? endReading
    : Math.max(0, Number((endReading - prevReading).toFixed(2)));

  const dayConsumption = Math.max(
    0,
    Number((midReading - startReading).toFixed(2))
  );
  const nightConsumption = Math.max(
    0,
    Number((dailyEndReading - midReading).toFixed(2))
  );
  const totalDailyConsumption = Number(
    (dayConsumption + nightConsumption).toFixed(2)
  );

  const calculatedPostpaidBill =
    customBillAmount !== null
      ? customBillAmount
      : Number((weeklyConsumption * tariffRate).toFixed(2));

  const effectiveTokenRate =
    tokenUnitsKwh > 0
      ? Number((grossAmountKsh / tokenUnitsKwh).toFixed(2))
      : 0;

  // Image upload handler
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Token number auto-formatter (e.g. 5440-3973-8341-2948-1294)
  const handleTokenNumberChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 20);
    const parts = clean.match(/.{1,4}/g);
    setTokenNumber(parts ? parts.join('-') : clean);
  };

  // Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const now = Date.now();
    const entryId = `entry-${now}-${Math.random().toString(36).substr(2, 4)}`;

    if (category === 'water_weekly') {
      if (!isRollover && endReading < prevReading) {
        setValidationError(
          'Validation Warning: End Reading cannot be lower than Previous Reading unless "Meter Rollover / Replacement" is checked.'
        );
        return;
      }
      onSaveWeekly({
        id: entryId,
        meterId,
        date,
        previousReading: prevReading,
        endReading,
        consumption: weeklyConsumption,
        isRollover,
        photoUrl: photoUrl || undefined,
        notes: notes || undefined,
        createdAt: now,
      });
    } else if (category === 'water_daily_special') {
      if (dailyEndReading < startReading && !isRollover) {
        setValidationError(
          'End Reading is less than Start Reading. Please confirm meter values or rollover.'
        );
        return;
      }
      onSaveDaily({
        id: entryId,
        meterId,
        date,
        startTime,
        endTime,
        startReading,
        midReading,
        endReading: dailyEndReading,
        dayConsumption,
        nightConsumption,
        totalConsumption: totalDailyConsumption,
        startPhotoUrl: startPhotoUrl || undefined,
        endPhotoUrl: endPhotoUrl || undefined,
        notes: notes || undefined,
        createdAt: now,
      });
    } else if (category === 'electricity_postpaid') {
      if (!isRollover && endReading < prevReading) {
        setValidationError(
          'Validation Warning: End Reading cannot be lower than Previous Reading unless "Meter Rollover / Replacement" is checked.'
        );
        return;
      }
      onSavePostpaid({
        id: entryId,
        meterId,
        date,
        previousReading: prevReading,
        endReading,
        consumption: weeklyConsumption,
        tariffRateKsh: tariffRate,
        billAmountKsh: calculatedPostpaidBill,
        isRollover,
        photoUrl: photoUrl || undefined,
        notes: notes || undefined,
        createdAt: now,
      });
    } else if (category === 'electricity_prepaid') {
      const cleanToken = tokenNumber.replace(/[^0-9]/g, '');
      if (cleanToken.length > 0 && cleanToken.length < 20) {
        setValidationError(
          `KPLC Token Number must be 20 digits (currently ${cleanToken.length} digits).`
        );
        return;
      }
      onSavePrepaid({
        id: entryId,
        meterId,
        date,
        tokenNumber: tokenNumber || 'PENDING-SMS-REF',
        tokenUnitsKwh,
        grossAmountKsh,
        netTokenAmountKsh,
        effectiveRateKshPerKwh: effectiveTokenRate,
        receiptPhotoUrl: receiptPhotoUrl || undefined,
        notes: notes || undefined,
        createdAt: now,
      });
    }

    onClose();
  };

  if (!isOpen) return null;

  const currentMeter = METERS_CATALOG.find((m) => m.id === meterId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
      <div className="relative max-w-2xl w-full max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header - Pinned */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              New Meter Entry
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated calculations, previous reading auto-fetch & photo audit
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs - Pinned with horizontal scroll */}
        <div className="shrink-0 flex border-b border-slate-150 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => handleCategoryChange('water_weekly')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              category === 'water_weekly'
                ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Droplet className="w-3.5 h-3.5" />
            Water Weekly (Monday)
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange('water_daily_special')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              category === 'water_daily_special'
                ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Droplet className="w-3.5 h-3.5" />
            Special Daily (TTA / WRA)
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange('electricity_postpaid')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              category === 'electricity_postpaid'
                ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Postpaid KPLC (Monday)
          </button>

          <button
            type="button"
            onClick={() => handleCategoryChange('electricity_prepaid')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              category === 'electricity_prepaid'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Prepaid Tokens
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Validation Alert */}
          {validationError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Meter Selection & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Meter
              </label>
              <select
                value={meterId}
                onChange={(e) => setMeterId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                required
              >
                {METERS_CATALOG.filter((m) => m.category === category).map(
                  (m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.meterNumber ? `(#${m.meterNumber})` : ''}
                    </option>
                  )
                )}
              </select>
              {currentMeter && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Location: {currentMeter.location}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reading / Purchase Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Form Specifics: 1. Water Weekly & 3. Electricity Postpaid */}
          {(category === 'water_weekly' ||
            category === 'electricity_postpaid') && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Previous Reading ({currentMeter?.unit})
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={prevReading}
                    onChange={(e) => setPrevReading(Number(e.target.value))}
                    className="w-full text-base font-mono font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:outline-hidden focus:border-emerald-500 pb-0.5"
                    required
                  />
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block">
                    ✓ Auto-populated from last log
                  </span>
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    End Reading ({currentMeter?.unit})
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={endReading}
                    onChange={(e) => setEndReading(Number(e.target.value))}
                    className="w-full text-base font-mono font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-hidden focus:border-emerald-500 pb-0.5"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Current meter dial reading
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
                  <span className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-1">
                    Calculated Consumption
                  </span>
                  <div className="text-xl font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    {weeklyConsumption} {currentMeter?.unit}
                  </div>
                  <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-1 block">
                    End - Previous diff
                  </span>
                </div>
              </div>

              {/* Rollover Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rollover"
                  checked={isRollover}
                  onChange={(e) => setIsRollover(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="rollover"
                  className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Meter Rollover / Replaced (e.g. dial reset to 00000)
                </label>
              </div>

              {/* Postpaid Specific: Tariff & Bill */}
              {category === 'electricity_postpaid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-lg">
                  <div>
                    <label className="block text-xs font-semibold text-amber-900 dark:text-amber-300 mb-1">
                      Tariff Rate (KSh per kWh)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={tariffRate}
                      onChange={(e) => setTariffRate(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm font-mono font-semibold bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-900 dark:text-amber-300 mb-1">
                      Calculated Bill Amount (KSh)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={calculatedPostpaidBill}
                      onChange={(e) =>
                        setCustomBillAmount(Number(e.target.value))
                      }
                      className="w-full px-3 py-1.5 text-sm font-mono font-bold bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-md text-amber-900 dark:text-amber-200"
                    />
                  </div>
                </div>
              )}

              {/* Meter Photo Attachment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Audit Photo Verification (Meter Dial Snapshot)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer transition-colors border border-slate-200 dark:border-slate-700">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>Upload Meter Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setPhotoUrl)}
                      className="hidden"
                    />
                  </label>
                  {photoUrl ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={photoUrl}
                        alt="Preview"
                        className="w-10 h-10 object-cover rounded border border-emerald-500"
                      />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Photo Attached
                      </span>
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      No photo attached yet (optional)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Specifics: 2. Water Daily Special (TTA & WRA) */}
          {category === 'water_daily_special' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Time (Day Changeover)
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* 3 Reading points: Start -> Mid (Evening) -> End (Next Morning) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Morning (06:00)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={startReading}
                    onChange={(e) => setStartReading(Number(e.target.value))}
                    className="w-full text-sm font-mono font-bold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-hidden pb-0.5"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Evening (18:00)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={midReading}
                    onChange={(e) => setMidReading(Number(e.target.value))}
                    className="w-full text-sm font-mono font-bold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-hidden pb-0.5"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Next Morning
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={dailyEndReading}
                    onChange={(e) =>
                      setDailyEndReading(Number(e.target.value))
                    }
                    className="w-full text-sm font-mono font-bold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-hidden pb-0.5"
                    required
                  />
                </div>
              </div>

              {/* Calculated Day / Night / Total Breakdown */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 rounded-lg text-center">
                <div>
                  <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 block">
                    Daytime Draw
                  </span>
                  <span className="text-base font-mono font-bold text-teal-700 dark:text-teal-400">
                    {dayConsumption} m³
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 block">
                    Nighttime Draw
                  </span>
                  <span className="text-base font-mono font-bold text-teal-700 dark:text-teal-400">
                    {nightConsumption} m³
                  </span>
                </div>
                <div className="border-l border-teal-200 dark:border-teal-800 pl-2">
                  <span className="text-[11px] font-bold text-teal-900 dark:text-teal-200 block uppercase">
                    Total Daily
                  </span>
                  <span className="text-lg font-mono font-extrabold text-teal-900 dark:text-teal-200">
                    {totalDailyConsumption} m³
                  </span>
                </div>
              </div>

              {/* Start & End Photo uploads */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Morning Dial Photo
                  </label>
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs cursor-pointer">
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    <span>Attach Morning Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setStartPhotoUrl)}
                      className="hidden"
                    />
                  </label>
                  {startPhotoUrl && (
                    <span className="text-[10px] text-teal-600 block mt-1">
                      ✓ Morning image attached
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Evening Dial Photo
                  </label>
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs cursor-pointer">
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    <span>Attach Evening Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setEndPhotoUrl)}
                      className="hidden"
                    />
                  </label>
                  {endPhotoUrl && (
                    <span className="text-[10px] text-teal-600 block mt-1">
                      ✓ Evening image attached
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Specifics: 4. Prepaid Tokens */}
          {category === 'electricity_prepaid' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  KPLC Token Code (20 Digits)
                </label>
                <input
                  type="text"
                  placeholder="5440-3973-8341-2948-1294"
                  value={tokenNumber}
                  onChange={(e) => handleTokenNumberChange(e.target.value)}
                  className="w-full px-3 py-2 text-base font-mono tracking-wider font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Formatted automatically into 4-digit token clusters
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Units (kWh)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={tokenUnitsKwh}
                    onChange={(e) => setTokenUnitsKwh(Number(e.target.value))}
                    className="w-full text-base font-mono font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-hidden pb-0.5"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Units credited
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Gross Paid (KSh)
                  </span>
                  <input
                    type="number"
                    step="1"
                    value={grossAmountKsh}
                    onChange={(e) => setGrossAmountKsh(Number(e.target.value))}
                    className="w-full text-base font-mono font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-hidden pb-0.5"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    M-PESA / Total paid
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Net Token (KSh)
                  </span>
                  <input
                    type="number"
                    step="1"
                    value={netTokenAmountKsh}
                    onChange={(e) =>
                      setNetTokenAmountKsh(Number(e.target.value))
                    }
                    className="w-full text-base font-mono font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-hidden pb-0.5"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    After EPRA / VAT levies
                  </span>
                </div>
              </div>

              {/* Effective Rate Preview */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                    Effective Unit Cost:
                  </span>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Gross Paid ÷ Units kWh
                  </p>
                </div>
                <div className="text-lg font-mono font-bold text-emerald-800 dark:text-emerald-300">
                  KSh {effectiveTokenRate.toFixed(2)} / kWh
                </div>
              </div>

              {/* Receipt Attachment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  M-PESA / KPLC SMS or Receipt Snapshot
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium cursor-pointer transition-colors border border-slate-200 dark:border-slate-700">
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>Upload Token Receipt</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setReceiptPhotoUrl)}
                      className="hidden"
                    />
                  </label>
                  {receiptPhotoUrl ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={receiptPhotoUrl}
                        alt="Receipt"
                        className="w-10 h-10 object-cover rounded border border-emerald-500"
                      />
                      <span className="text-xs text-emerald-600 font-medium">
                        Receipt attached
                      </span>
                      <button
                        type="button"
                        onClick={() => setReceiptPhotoUrl('')}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      No receipt attached (optional)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes & Comments */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Operational Notes / Observations
            </label>
            <input
              type="text"
              placeholder="e.g. Nursery irrigation cycle, pump maintenance, weekend event..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Footer Actions - Pinned */}
          <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs pt-3 pb-1 border-t border-slate-150 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
