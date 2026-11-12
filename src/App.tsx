import React, { useState, useEffect } from 'react';
import {
  Navbar,
  NavTab,
} from './components/Navbar';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { WaterWeeklySection } from './components/WaterWeeklySection';
import { WaterDailySection } from './components/WaterDailySection';
import { ElectricityPostpaidSection } from './components/ElectricityPostpaidSection';
import { ElectricityPrepaidSection } from './components/ElectricityPrepaidSection';
import { MeterRegistryManager } from './components/MeterRegistryManager';
import { ReadingEntryModal } from './components/ReadingEntryModal';
import { GoogleSheetsSettings } from './components/GoogleSheetsSettings';

import {
  WaterWeeklyReading,
  WaterDailyReading,
  ElectricityPostpaidReading,
  ElectricityPrepaidToken,
  MeterCategory,
  GoogleSheetsConfig,
  AppUser,
} from './types';
import {
  initializeStorage,
  getWaterWeeklyReadings,
  getWaterDailyReadings,
  getElectricityPostpaidReadings,
  getElectricityPrepaidTokens,
  saveWaterWeeklyReading,
  deleteWaterWeeklyReading,
  saveWaterDailyReading,
  deleteWaterDailyReading,
  saveElectricityPostpaidReading,
  deleteElectricityPostpaidReading,
  saveElectricityPrepaidToken,
  deleteElectricityPrepaidToken,
  resetToDefaultSeedData,
  clearAllStoresToZero,
} from './utils/storage';
import { exportComprehensiveUtilityWorkbook } from './utils/excelExport';
import { initAuth, getCurrentUser, getCachedAccessToken } from './utils/googleAuth';
import {
  getSheetsConfig,
  upsertRecordToSheet,
  enqueuePendingSync,
} from './utils/googleSheetsSync';
import { RotateCcw, Check, Download, Trash2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(getCurrentUser);
  const [accessToken, setAccessToken] = useState<string | null>(getCachedAccessToken);
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(getSheetsConfig);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('gpf_theme') === 'dark' ||
        (!localStorage.getItem('gpf_theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }
    return false;
  });

  // Data states
  const [weeklyWater, setWeeklyWater] = useState<WaterWeeklyReading[]>([]);
  const [dailyWater, setDailyWater] = useState<WaterDailyReading[]>([]);
  const [postpaidPower, setPostpaidPower] = useState<
    ElectricityPostpaidReading[]
  >([]);
  const [prepaidTokens, setPrepaidTokens] = useState<ElectricityPrepaidToken[]>(
    []
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalCategory, setModalCategory] = useState<MeterCategory>('water_weekly');
  const [modalMeterId, setModalMeterId] = useState<string | undefined>(undefined);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Dark mode effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('gpf_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('gpf_theme', 'light');
    }
  }, [isDark]);

  // Load data on startup
  const reloadData = async (forceReset = false) => {
    setIsLoading(true);
    await initializeStorage(forceReset);
    const [wWeekly, wDaily, ePostpaid, ePrepaid] = await Promise.all([
      getWaterWeeklyReadings(),
      getWaterDailyReadings(),
      getElectricityPostpaidReadings(),
      getElectricityPrepaidTokens(),
    ]);

    setWeeklyWater(wWeekly.sort((a, b) => b.date.localeCompare(a.date)));
    setDailyWater(wDaily.sort((a, b) => a.date.localeCompare(b.date)));
    setPostpaidPower(ePostpaid.sort((a, b) => b.date.localeCompare(a.date)));
    setPrepaidTokens(ePrepaid.sort((a, b) => b.date.localeCompare(a.date)));
    setIsLoading(false);
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Modal openers
  const handleOpenQuickEntry = (
    category: MeterCategory = 'water_weekly',
    meterId?: string
  ) => {
    setModalCategory(category);
    setModalMeterId(meterId);
    setIsModalOpen(true);
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Background Google Sheets Synchronization helper
  const syncRecordInBackground = async (category: MeterCategory, item: any) => {
    const cfg = getSheetsConfig();
    setSheetsConfig(cfg);
    if (!cfg.autoSyncEnabled || !cfg.spreadsheetId) {
      return;
    }
    if (!accessToken) {
      enqueuePendingSync(category, 'upsert', item);
      showToast('Saved locally. Sign in to Google Sheets tab to sync automatically.');
      return;
    }

    try {
      const res = await upsertRecordToSheet(category, item, cfg, accessToken);
      const actionLabel = res.action === 'insert' ? 'Appended to' : 'Updated row in';
      showToast(`Saved & ${actionLabel} Google Sheet '${cfg.worksheets[category]}'`);
    } catch (err: any) {
      console.error('Google Sheets background sync failed:', err);
      enqueuePendingSync(category, 'upsert', item);
      showToast(`Saved locally. Queued for Sheets sync: ${err.message || 'Connection error'}`);
    }
  };

  // Add / Save handlers
  const handleSaveWeekly = async (item: WaterWeeklyReading) => {
    await saveWaterWeeklyReading(item);
    await reloadData();
    showToast(`Weekly water reading recorded for ${item.date}`);
    syncRecordInBackground('water_weekly', item);
  };

  const handleDeleteWeekly = async (id: string) => {
    if (confirm('Delete this weekly water entry?')) {
      await deleteWaterWeeklyReading(id);
      await reloadData();
      showToast('Weekly reading deleted');
    }
  };

  const handleSaveDaily = async (item: WaterDailyReading) => {
    await saveWaterDailyReading(item);
    await reloadData();
    showToast(`Daily water reading saved (${item.totalConsumption} m³)`);
    syncRecordInBackground('water_daily_special', item);
  };

  const handleDeleteDaily = async (id: string) => {
    if (confirm('Delete this daily water entry?')) {
      await deleteWaterDailyReading(id);
      await reloadData();
      showToast('Daily reading deleted');
    }
  };

  const handleSavePostpaid = async (item: ElectricityPostpaidReading) => {
    await saveElectricityPostpaidReading(item);
    await reloadData();
    showToast(`Postpaid electricity bill recorded for ${item.date}`);
    syncRecordInBackground('electricity_postpaid', item);
  };

  const handleDeletePostpaid = async (id: string) => {
    if (confirm('Delete this postpaid electricity entry?')) {
      await deleteElectricityPostpaidReading(id);
      await reloadData();
      showToast('Postpaid reading deleted');
    }
  };

  const handleSavePrepaid = async (item: ElectricityPrepaidToken) => {
    await saveElectricityPrepaidToken(item);
    await reloadData();
    showToast(`Token purchase saved: ${item.tokenUnitsKwh} kWh`);
    syncRecordInBackground('electricity_prepaid', item);
  };

  const handleDeletePrepaid = async (id: string) => {
    if (confirm('Delete this token purchase record?')) {
      await deleteElectricityPrepaidToken(id);
      await reloadData();
      showToast('Token record deleted');
    }
  };

  // Excel export
  const handleExportExcel = () => {
    exportComprehensiveUtilityWorkbook(
      weeklyWater,
      dailyWater,
      postpaidPower,
      prepaidTokens
    );
    showToast('Excel report generated and downloaded (.xlsx)');
  };

  // Reset to clean official baseline with Browns Water Meter and TTA
  const handleResetData = async () => {
    if (
      confirm(
        'Reset system to official baseline with Browns Water Meter (41 weeks) and TTA Water Meter (34 days) records?'
      )
    ) {
      await resetToDefaultSeedData();
      await reloadData(true);
      showToast('Browns Water Meter and TTA records loaded successfully');
    }
  };

  // Clear all stores to complete zero
  const handleClearAllToZero = async () => {
    if (
      confirm(
        'Are you sure you want to CLEAR ALL readings from ALL meters to 0?'
      )
    ) {
      await clearAllStoresToZero();
      await reloadData();
      showToast('All meters cleared to zero');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors w-full max-w-full overflow-x-hidden">
      {/* Top Bar following Top Bar Contract */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onExportExcel={handleExportExcel}
        onOpenQuickEntry={() => handleOpenQuickEntry('water_weekly')}
        isDark={isDark}
        onToggleDark={() => setIsDark(!isDark)}
        isSheetsConnected={Boolean(currentUser && sheetsConfig.spreadsheetId)}
        isAutoSyncEnabled={sheetsConfig.autoSyncEnabled}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Initializing Gathoni Park Farm utility records...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <AnalyticsDashboard
                weeklyWater={weeklyWater}
                dailyWater={dailyWater}
                postpaidPower={postpaidPower}
                prepaidTokens={prepaidTokens}
                onOpenQuickEntry={handleOpenQuickEntry}
                onNavigateTab={setActiveTab}
                onExportExcel={handleExportExcel}
              />
            )}

            {activeTab === 'water_weekly' && (
              <WaterWeeklySection
                data={weeklyWater}
                onAddRow={() => handleOpenQuickEntry('water_weekly')}
                onDeleteRow={handleDeleteWeekly}
              />
            )}

            {activeTab === 'water_daily_special' && (
              <WaterDailySection
                data={dailyWater}
                onAddRow={() => handleOpenQuickEntry('water_daily_special')}
                onDeleteRow={handleDeleteDaily}
              />
            )}

            {activeTab === 'electricity_postpaid' && (
              <ElectricityPostpaidSection
                data={postpaidPower}
                onAddRow={() => handleOpenQuickEntry('electricity_postpaid')}
                onDeleteRow={handleDeletePostpaid}
              />
            )}

            {activeTab === 'electricity_prepaid' && (
              <ElectricityPrepaidSection
                data={prepaidTokens}
                onAddRow={() => handleOpenQuickEntry('electricity_prepaid')}
                onDeleteRow={handleDeletePrepaid}
              />
            )}

            {activeTab === 'meter_registry' && (
              <MeterRegistryManager
                weeklyWater={weeklyWater}
                dailyWater={dailyWater}
                postpaidPower={postpaidPower}
                prepaidTokens={prepaidTokens}
                onOpenQuickEntry={handleOpenQuickEntry}
              />
            )}

            {activeTab === 'google_sheets' && (
              <GoogleSheetsSettings
                currentUser={currentUser}
                accessToken={accessToken}
                onAuthSuccess={(user, token) => {
                  setCurrentUser(user);
                  setAccessToken(token);
                  setSheetsConfig(getSheetsConfig());
                }}
                onSignOut={() => {
                  setCurrentUser(null);
                  setAccessToken(null);
                  setSheetsConfig(getSheetsConfig());
                }}
                weeklyWater={weeklyWater}
                dailyWater={dailyWater}
                postpaidPower={postpaidPower}
                prepaidTokens={prepaidTokens}
              />
            )}
          </>
        )}
      </main>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 dark:border-slate-200">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal for Reading Entry */}
      <ReadingEntryModal
        isOpen={isModalOpen}
        initialCategory={modalCategory}
        initialMeterId={modalMeterId}
        allWeekly={weeklyWater}
        allDaily={dailyWater}
        allPostpaid={postpaidPower}
        allPrepaid={prepaidTokens}
        onSaveWeekly={handleSaveWeekly}
        onSaveDaily={handleSaveDaily}
        onSavePostpaid={handleSavePostpaid}
        onSavePrepaid={handleSavePrepaid}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 py-4 mt-12 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Gathoni Park Farm
            </span>{' '}
            · Utility & Service Charge Management Ledger
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <button
              onClick={handleExportExcel}
              className="hover:text-emerald-600 transition-colors flex items-center gap-1 font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .xlsx</span>
            </button>
            <span>·</span>
            <button
              onClick={handleResetData}
              className="hover:text-emerald-600 transition-colors flex items-center gap-1 font-medium text-slate-500"
              title="Reset records to official 34 TTA readings with clean state for all other meters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reload TTA Ledger</span>
            </button>
            <span>·</span>
            <button
              onClick={handleClearAllToZero}
              className="hover:text-red-600 transition-colors flex items-center gap-1 font-medium text-slate-400"
              title="Clear all recordings across all meters to 0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All to Zero</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
