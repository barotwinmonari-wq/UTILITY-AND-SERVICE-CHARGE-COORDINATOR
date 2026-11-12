import React, { useState } from 'react';
import {
  Download,
  Plus,
  Sun,
  Moon,
  FileSpreadsheet,
  Menu,
  X,
  Droplet,
  Zap,
  Building2,
  LayoutDashboard,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'water_weekly'
  | 'water_daily_special'
  | 'electricity_postpaid'
  | 'electricity_prepaid'
  | 'meter_registry'
  | 'google_sheets';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onExportExcel: () => void;
  onOpenQuickEntry: () => void;
  isDark: boolean;
  onToggleDark: () => void;
  isSheetsConnected?: boolean;
  isAutoSyncEnabled?: boolean;
}

const NAV_ITEMS: { id: NavTab; label: string; shortLabel: string; icon?: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'water_weekly', label: 'Water Weekly', shortLabel: 'Weekly Water', icon: <Droplet className="w-3.5 h-3.5 text-cyan-600" /> },
  { id: 'water_daily_special', label: 'Daily Water (TTA/WRA)', shortLabel: 'Daily TTA', icon: <Droplet className="w-3.5 h-3.5 text-teal-600" /> },
  { id: 'electricity_postpaid', label: 'Postpaid Power', shortLabel: 'Postpaid', icon: <Zap className="w-3.5 h-3.5 text-purple-600" /> },
  { id: 'electricity_prepaid', label: 'Prepaid Tokens', shortLabel: 'Prepaid', icon: <Zap className="w-3.5 h-3.5 text-amber-600" /> },
  { id: 'meter_registry', label: '18-Meter Registry', shortLabel: '18 Meters', icon: <Building2 className="w-3.5 h-3.5 text-slate-600" /> },
  { id: 'google_sheets', label: 'Google Sheets Sync', shortLabel: 'Sheets Sync', icon: <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onExportExcel,
  onOpenQuickEntry,
  isDark,
  onToggleDark,
  isSheetsConnected = false,
  isAutoSyncEnabled = true,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSelectTab = (tab: NavTab) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 h-16">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleSelectTab('dashboard')}
              className="text-left group flex items-center gap-2"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-xs sm:text-sm tracking-tighter shadow-xs shrink-0">
                GPF
              </div>
              <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
                Gathoni Park Farm
              </span>
            </button>
          </div>

          {/* Zone 2: Desktop Navigation Links (Full on XL, Compact on LG) */}
          <nav className="hidden lg:flex items-center gap-2 xl:gap-5 text-xs font-semibold text-slate-600 dark:text-slate-400">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400 font-bold'
                      : ''
                  }`}
                >
                  {item.id === 'google_sheets' && (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="hidden xl:inline">{item.label}</span>
                  <span className="inline xl:hidden">{item.shortLabel}</span>
                  {item.id === 'google_sheets' && (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSheetsConnected
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      title={
                        isSheetsConnected
                          ? 'Google Sheets Connected & Auto-Sync Active'
                          : 'Google Sheets Disconnected'
                      }
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDark}
              className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Export Excel (.xlsx) */}
            <button
              onClick={onExportExcel}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0"
              title="Export formatted Excel workbook"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden md:inline">Export Excel (.xlsx)</span>
              <span className="inline md:hidden">Export</span>
            </button>

            {/* Quick Log Reading Button */}
            <button
              onClick={onOpenQuickEntry}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Log Reading</span>
            </button>

            {/* Mobile / Tablet Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex lg:hidden p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Toggle navigation menu"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-emerald-600" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile/Tablet Drawer Menu - Shows ALL Sections on Window */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 py-3 px-1 bg-white/95 dark:bg-slate-900/95 shadow-lg animate-in fade-in duration-200">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              System Navigation (All Sections)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-semibold text-left transition-colors ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.id === 'google_sheets' && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSheetsConnected
                            ? 'bg-emerald-500 animate-pulse'
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {/* Quick Mobile Excel Export */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 sm:hidden">
              <button
                onClick={() => {
                  onExportExcel();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Full Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        )}

        {/* Secondary horizontal quick tab scrollbar for mobile/tablet */}
        {!isMobileMenuOpen && (
          <div className="flex lg:hidden overflow-x-auto py-2 gap-1.5 border-t border-slate-100 dark:border-slate-800/60 no-scrollbar">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap font-medium transition-colors flex items-center gap-1 shrink-0 ${
                  activeTab === item.id
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {item.id === 'google_sheets' && (
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600 shrink-0" />
                )}
                <span>{item.shortLabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};
