import React, { useState, useEffect } from 'react';
import {
  GoogleSheetsConfig,
  SyncLogEntry,
  PendingSyncItem,
  WaterWeeklyReading,
  WaterDailyReading,
  ElectricityPostpaidReading,
  ElectricityPrepaidToken,
  AppUser,
} from '../types';
import {
  parseSpreadsheetId,
  getSheetsConfig,
  saveSheetsConfig,
  getSyncLogs,
  clearSyncLogs,
  getPendingQueue,
  clearPendingQueue,
  fetchSpreadsheetMetadata,
  pushAllLocalRecordsToSheet,
  disconnectSpreadsheet,
  HEADERS_MAPPING,
} from '../utils/googleSheetsSync';
import {
  triggerGoogleSignIn,
  googleSignOut,
  setManualAccessToken,
  isAccessTokenValid,
} from '../utils/googleAuth';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Database,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Clock,
  Layers,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Search,
  ListOrdered,
  KeyRound,
  Info,
  Link2,
  Unlink,
  Zap,
  Sparkles,
  Edit2,
} from 'lucide-react';

interface GoogleSheetsSettingsProps {
  currentUser: AppUser | null;
  accessToken: string | null;
  onAuthSuccess: (user: AppUser, token: string) => void;
  onSignOut: () => void;
  weeklyWater: WaterWeeklyReading[];
  dailyWater: WaterDailyReading[];
  postpaidPower: ElectricityPostpaidReading[];
  prepaidTokens: ElectricityPrepaidToken[];
  onTriggerSyncLogsRefresh?: () => void;
}

export const GoogleSheetsSettings: React.FC<GoogleSheetsSettingsProps> = ({
  currentUser,
  accessToken,
  onAuthSuccess,
  onSignOut,
  weeklyWater,
  dailyWater,
  postpaidPower,
  prepaidTokens,
}) => {
  const [config, setConfig] = useState<GoogleSheetsConfig>(getSheetsConfig);
  const [sheetInput, setSheetInput] = useState<string>(
    config.spreadsheetUrl || config.spreadsheetId || ''
  );
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);

  // Sync state
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{
    text: string;
    current: number;
    total: number;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    total: number;
    inserted: number;
    updated: number;
    durationSeconds?: number;
  } | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);

  // Spreadsheet edit toggle state
  const [isChangingSpreadsheet, setIsChangingSpreadsheet] = useState<boolean>(false);

  // Logs & Pending
  const [logs, setLogs] = useState<SyncLogEntry[]>(getSyncLogs);
  const [pendingQueue, setPendingQueue] = useState<PendingSyncItem[]>(getPendingQueue);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Manual Token Input State
  const [showManualToken, setShowManualToken] = useState<boolean>(false);
  const [manualTokenInput, setManualTokenInput] = useState<string>('');
  const [isApplyingToken, setIsApplyingToken] = useState<boolean>(false);

  // Refresh logs on mount and after actions
  const refreshLogsAndQueue = () => {
    setLogs(getSyncLogs());
    setPendingQueue(getPendingQueue());
  };

  useEffect(() => {
    refreshLogsAndQueue();
  }, []);

  // When access token changes, if we have a spreadsheet ID, test metadata
  useEffect(() => {
    if (accessToken && config.spreadsheetId) {
      handleVerifySpreadsheet(config.spreadsheetId, false);
    }
  }, [accessToken, config.spreadsheetId]);

  // Handle Google Login with Synchronous Click Trigger
  const handleLogin = () => {
    setIsLoggingIn(true);
    setLoginError(null);
    triggerGoogleSignIn(
      (user, token) => {
        setIsLoggingIn(false);
        onAuthSuccess(user, token);
        setVerifySuccess('Connected to Google Account successfully');
        if (config.spreadsheetId) {
          handleVerifySpreadsheet(config.spreadsheetId, false, token);
        }
      },
      (err) => {
        setIsLoggingIn(false);
        console.error(err);
        setLoginError(err.message || 'Failed to authenticate with Google');
      }
    );
  };

  // Handle Manual Token Submission
  const handleApplyManualToken = async () => {
    if (!manualTokenInput.trim()) return;
    setIsApplyingToken(true);
    setLoginError(null);
    try {
      const user = await setManualAccessToken(manualTokenInput.trim());
      onAuthSuccess(user, manualTokenInput.trim());
      setVerifySuccess('Connected with Access Token successfully');
      setShowManualToken(false);
      setManualTokenInput('');
      if (config.spreadsheetId) {
        handleVerifySpreadsheet(config.spreadsheetId, false, manualTokenInput.trim());
      }
    } catch (err: any) {
      setLoginError(`Invalid Access Token: ${err.message || 'Verification failed'}`);
    } finally {
      setIsApplyingToken(false);
    }
  };

  // Handle Google Disconnect - only unlinks when clicked
  const handleDisconnect = async () => {
    await googleSignOut();
    onSignOut();
    setVerifySuccess(null);
    setVerifyError(null);
    setPushSuccess(null);
    setPushError(null);
  };

  // Handle Spreadsheet Disconnect - only unlinks when clicked
  const handleDisconnectSpreadsheet = () => {
    const reset = disconnectSpreadsheet();
    setConfig(reset);
    setSheetInput('');
    setIsChangingSpreadsheet(false);
    setVerifySuccess('Spreadsheet unlinked successfully.');
    setVerifyError(null);
    setPushSuccess(null);
    setPushError(null);
  };

  // Verify and Fetch Sheet Tabs
  const handleVerifySpreadsheet = async (
    targetInput?: string,
    showFeedback = true,
    tokenOverride?: string
  ) => {
    const rawInput = targetInput ?? sheetInput;
    const parsedId = parseSpreadsheetId(rawInput);
    if (!parsedId) {
      if (showFeedback) setVerifyError('Please enter a valid Google Spreadsheet ID or URL');
      return;
    }

    const token = tokenOverride || accessToken;
    if (!token) {
      if (showFeedback) setVerifyError('Please sign in with Google first to verify access');
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);
    if (showFeedback) setVerifySuccess(null);

    try {
      const meta = await fetchSpreadsheetMetadata(parsedId, token);
      setAvailableTabs(meta.sheetTabs);
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        spreadsheetId: parsedId,
        spreadsheetUrl: rawInput.startsWith('http')
          ? rawInput
          : `https://docs.google.com/spreadsheets/d/${parsedId}/edit`,
        spreadsheetTitle: meta.title,
        lastSyncStatus: 'idle',
      };
      setConfig(updatedConfig);
      saveSheetsConfig(updatedConfig);
      setIsChangingSpreadsheet(false);
      if (showFeedback) {
        setVerifySuccess(
          `Linked: "${meta.title}" (${meta.sheetTabs.length} worksheets detected). It will stay linked permanently.`
        );
      }
    } catch (err: any) {
      console.error(err);
      setVerifyError(
        err.message || 'Unable to access spreadsheet. Ensure you have Edit permissions.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Auto-Sync Toggle
  const handleToggleAutoSync = () => {
    const updated: GoogleSheetsConfig = {
      ...config,
      autoSyncEnabled: !config.autoSyncEnabled,
    };
    setConfig(updated);
    saveSheetsConfig(updated);
  };

  // Handle Worksheet Mapping Change
  const handleWorksheetChange = (
    category: keyof GoogleSheetsConfig['worksheets'],
    tabName: string
  ) => {
    const updated: GoogleSheetsConfig = {
      ...config,
      worksheets: {
        ...config.worksheets,
        [category]: tabName.trim(),
      },
    };
    setConfig(updated);
    saveSheetsConfig(updated);
  };

  // Trigger Instant Bulk Push
  const handlePushAll = async () => {
    setPushError(null);
    setPushSuccess(null);

    if (!accessToken) {
      setPushError('Please connect your Google Account in Step 1 to send records.');
      return;
    }
    if (!config.spreadsheetId) {
      setPushError('Please link a Google Spreadsheet in Step 2 to send records.');
      return;
    }

    const totalRecords =
      weeklyWater.length +
      dailyWater.length +
      postpaidPower.length +
      prepaidTokens.length;

    if (totalRecords === 0) {
      setPushError('No records available in the local database to synchronize.');
      return;
    }

    setIsSyncingAll(true);
    setSyncResult(null);
    try {
      const result = await pushAllLocalRecordsToSheet(
        weeklyWater,
        dailyWater,
        postpaidPower,
        prepaidTokens,
        config,
        accessToken,
        (progressText, current, total) => {
          setSyncProgress({ text: progressText, current, total });
        }
      );
      setSyncResult({
        total: result.totalSynced,
        inserted: result.inserted,
        updated: result.updated,
        durationSeconds: result.durationSeconds,
      });
      setPushSuccess(
        `⚡ Blazing Fast Push: Sent all ${result.totalSynced} records to "${config.spreadsheetTitle || 'Spreadsheet'}" in ${result.durationSeconds}s! (${result.inserted} newly appended rows, ${result.updated} updated in-place)`
      );
      refreshLogsAndQueue();
      setConfig(getSheetsConfig());
    } catch (err: any) {
      setPushError(`Synchronization failed: ${err.message}`);
    } finally {
      setIsSyncingAll(false);
      setSyncProgress(null);
    }
  };

  const totalLocalRecords =
    weeklyWater.length +
    dailyWater.length +
    postpaidPower.length +
    prepaidTokens.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Google Sheets Real-Time Synchronization
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                  Automated Integration
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically stream all water meter readings, KPLC postpaid electricity logs, and prepaid token purchases into your master Google Spreadsheet.
              </p>
            </div>
          </div>
        </div>

        {/* Global Connection Status Pill & Dedicated Window Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.open(window.location.href, '_blank')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
            title="Open in a full browser tab to completely avoid iframe cookie and popup blocking"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Open in Full Browser Tab</span>
          </button>

          {currentUser && config.spreadsheetId ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Integration Active & Ready</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Setup Required</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Account Auth & Spreadsheet Connection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Google Account Connection (Permanently Linked Until Disconnected) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Google Account Authorization
                </h3>
              </div>
              {currentUser ? (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Linked Permanently
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-3.5 h-3.5" /> Not Connected
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
              Connect your authorized Google account. This connection is <strong className="text-slate-800 dark:text-slate-200 font-semibold">permanently linked</strong> across page refreshes and browser sessions until you explicitly click Disconnect.
            </p>

            {currentUser ? (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-50/70 to-slate-50 dark:from-emerald-950/30 dark:to-slate-800/60 border border-emerald-200/80 dark:border-emerald-800/80 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'Google User'}
                        className="w-11 h-11 rounded-full border-2 border-emerald-500/40 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                        {currentUser.email?.charAt(0).toUpperCase() || 'G'}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                        <span>{currentUser.displayName || 'GPF Utility Coordinator'}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold">
                          Active
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono truncate">
                        {currentUser.email}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg border border-red-200 dark:border-red-900/60 transition-colors flex items-center gap-1 shrink-0"
                    title="Disconnect Google Account"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>

                <div className="text-[11px] text-emerald-700 dark:text-emerald-300/90 flex items-center gap-1.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span>Permanent link active. Stays linked across browser restarts until disconnected.</span>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <GoogleSignInButton
                  onClick={handleLogin}
                  isLoading={isLoggingIn}
                  className="w-full"
                  label="Connect Google Account"
                />

                {loginError && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-2.5">
                    <div className="flex items-start gap-1.5 font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <div className="font-bold">Sign-In Window Interrupted</div>
                        <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                          Your browser's popup blocker or iframe cookie settings closed the sign-in window. To resolve this:
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open App in Full Browser Tab to Sign In</span>
                      </button>

                      <div className="text-[11px] text-slate-500 text-center">
                        — or allow popups in your browser address bar —
                      </div>
                    </div>
                  </div>
                )}

                {/* Collapsible Manual Token Input */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowManualToken(!showManualToken)}
                    className="text-[11px] text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors font-medium"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>
                      {showManualToken
                        ? 'Hide manual access token'
                        : 'Alternative: Paste Google Access Token'}
                    </span>
                  </button>

                  {showManualToken && (
                    <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        Paste a valid Google OAuth Access Token (e.g. from Google OAuth Playground or gcloud):
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={manualTokenInput}
                          onChange={(e) => setManualTokenInput(e.target.value)}
                          placeholder="ya29.a0AcM6..."
                          className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                        />
                        <button
                          type="button"
                          onClick={handleApplyManualToken}
                          disabled={isApplyingToken || !manualTokenInput.trim()}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors disabled:opacity-50"
                        >
                          {isApplyingToken ? 'Applying...' : 'Apply Token'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted OAuth 2.0 · Session stays active until explicitly disconnected</span>
          </div>
        </div>

        {/* Step 2: Spreadsheet Connection (Permanently Linked Until Disconnected) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Target Google Spreadsheet
                </h3>
              </div>
              {config.spreadsheetId ? (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Linked Permanently
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-3.5 h-3.5" /> Not Linked
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
              Designate your master Google Spreadsheet. This spreadsheet <strong className="text-slate-800 dark:text-slate-200 font-semibold">remains permanently linked</strong> until you click Disconnect or Change Spreadsheet.
            </p>

            {config.spreadsheetId && !isChangingSpreadsheet ? (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-50/70 to-slate-50 dark:from-emerald-950/30 dark:to-slate-800/60 border border-emerald-200/80 dark:border-emerald-800/80 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {config.spreadsheetTitle || 'Master Farm Utility Ledger'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <span>ID:</span>
                      <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[210px]">
                        {config.spreadsheetId}
                      </span>
                    </div>
                  </div>
                  <a
                    href={
                      config.spreadsheetUrl ||
                      `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 hover:bg-emerald-200 dark:hover:bg-emerald-900 rounded-lg transition-colors shrink-0"
                  >
                    <span>Open Sheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="text-[11px] text-emerald-700 dark:text-emerald-300/90 flex items-center gap-1.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span>Permanently linked target. All 4 utility categories sync automatically here.</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setSheetInput(config.spreadsheetUrl || config.spreadsheetId);
                      setIsChangingSpreadsheet(true);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Change Spreadsheet</span>
                  </button>

                  <button
                    onClick={handleDisconnectSpreadsheet}
                    className="px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg border border-red-200 dark:border-red-900/60 transition-colors flex items-center gap-1"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Disconnect Spreadsheet</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/... or ID"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button
                    onClick={() => handleVerifySpreadsheet()}
                    disabled={isVerifying || !sheetInput.trim()}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Link2 className="w-3.5 h-3.5" />
                    )}
                    <span>{isChangingSpreadsheet ? 'Update & Link' : 'Verify & Link'}</span>
                  </button>
                  {isChangingSpreadsheet && (
                    <button
                      onClick={() => setIsChangingSpreadsheet(false)}
                      className="px-2.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {verifySuccess && (
                  <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span className="font-medium">{verifySuccess}</span>
                  </div>
                )}

                {verifyError && (
                  <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Spreadsheet ID: <span className="font-mono">{config.spreadsheetId ? `${config.spreadsheetId.substring(0, 12)}...` : 'None linked'}</span></span>
            {config.spreadsheetTitle && (
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                {config.spreadsheetTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Worksheets (Tabs) Configuration & Automation Switches */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Worksheet (Tab) Mapping & Automation Controls
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select or specify the destination tab name for each utility record type. Tabs that don't exist yet will be automatically created with full headers.
            </p>
          </div>

          {/* Auto-Sync Toggle */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={handleToggleAutoSync}
              className="flex items-center gap-2.5 cursor-pointer text-left"
            >
              {config.autoSyncEnabled ? (
                <ToggleRight className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-slate-400" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Automatic Real-time Sync
                </div>
                <div className="text-[10px] text-slate-500">
                  {config.autoSyncEnabled
                    ? 'Sync immediately on create/edit'
                    : 'Disabled (Manual push only)'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 4 Category Tab Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Weekly Water */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                Weekly Water
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-semibold">
                {weeklyWater.length} rows
              </span>
            </div>
            <div className="text-[11px] text-slate-500">Target Sheet Tab:</div>
            <input
              type="text"
              value={config.worksheets.water_weekly}
              onChange={(e) => handleWorksheetChange('water_weekly', e.target.value)}
              list="tab-suggestions"
              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
            />
            <div className="text-[10px] text-slate-400">
              Columns: Record ID, Dates, Readings, Consumption, Est Cost, Rollover
            </div>
          </div>

          {/* Special Daily Water */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-300">
                Daily Water (TTA/WRA)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 font-semibold">
                {dailyWater.length} rows
              </span>
            </div>
            <div className="text-[11px] text-slate-500">Target Sheet Tab:</div>
            <input
              type="text"
              value={config.worksheets.water_daily_special}
              onChange={(e) =>
                handleWorksheetChange('water_daily_special', e.target.value)
              }
              list="tab-suggestions"
              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
            />
            <div className="text-[10px] text-slate-400">
              Columns: Record ID, Dates, Times, Day/Night Consumption, 24h Total
            </div>
          </div>

          {/* Postpaid Power */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                Postpaid Electricity
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-semibold">
                {postpaidPower.length} rows
              </span>
            </div>
            <div className="text-[11px] text-slate-500">Target Sheet Tab:</div>
            <input
              type="text"
              value={config.worksheets.electricity_postpaid}
              onChange={(e) =>
                handleWorksheetChange('electricity_postpaid', e.target.value)
              }
              list="tab-suggestions"
              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
            />
            <div className="text-[10px] text-slate-400">
              Columns: Record ID, Dates, Meter No, kWh Consumption, Tariff, Bills
            </div>
          </div>

          {/* Prepaid Tokens */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                Prepaid Tokens
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-semibold">
                {prepaidTokens.length} rows
              </span>
            </div>
            <div className="text-[11px] text-slate-500">Target Sheet Tab:</div>
            <input
              type="text"
              value={config.worksheets.electricity_prepaid}
              onChange={(e) =>
                handleWorksheetChange('electricity_prepaid', e.target.value)
              }
              list="tab-suggestions"
              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
            />
            <div className="text-[10px] text-slate-400">
              Columns: Record ID, Token No, Units, Gross KSh, Net Amount, Effective Rate
            </div>
          </div>

          <datalist id="tab-suggestions">
            {availableTabs.map((tab) => (
              <option key={tab} value={tab} />
            ))}
          </datalist>
        </div>

        {/* Manual Full Push Controls (Ultra-Fast Concurrent Batch Execution) */}
        <div className="p-5 rounded-xl bg-gradient-to-r from-slate-50 via-emerald-50/20 to-slate-50 dark:from-slate-800/80 dark:via-emerald-950/20 dark:to-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600 dark:text-emerald-400" />
                <span>Ultra-Fast Full System Push to Google Sheets</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                  ⚡ &lt;1 Second Execution
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Concurrently streams all {totalLocalRecords} records across all 4 utility worksheets. Existing records are updated in-place by unique Record ID to guarantee zero duplicates.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                onClick={handlePushAll}
                disabled={isSyncingAll}
                className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-2.5 whitespace-nowrap ${
                  isSyncingAll
                    ? 'bg-emerald-700 cursor-wait'
                    : !currentUser || !config.spreadsheetId
                    ? 'bg-emerald-600 hover:bg-emerald-700 opacity-90'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]'
                }`}
                title="Send all local records to Google Sheets immediately"
              >
                {isSyncingAll ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-emerald-200" />
                )}
                <span className="text-sm">
                  {isSyncingAll
                    ? `Syncing (${syncProgress?.current || 0}/${syncProgress?.total || 4})...`
                    : `Push All ${totalLocalRecords} Records Now`}
                </span>
              </button>
            </div>
          </div>

          {/* Breakdown summary pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
            <span className="text-slate-500 font-semibold">Records to sync:</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Weekly Water: {weeklyWater.length}
            </span>
            <span className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              Daily Water: {dailyWater.length}
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Postpaid Electricity: {postpaidPower.length}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Prepaid Tokens: {prepaidTokens.length}
            </span>
            <span className="ml-auto font-mono text-slate-400">
              Total: {totalLocalRecords} rows
            </span>
          </div>

          {/* Warning if steps not completed */}
          {(!currentUser || !config.spreadsheetId) && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Please ensure you have authorized your Google Account in Step 1 and linked your master Google Spreadsheet in Step 2 above to enable synchronization.
              </span>
            </div>
          )}
        </div>

        {/* Sync Progress Bar */}
        {syncProgress && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                {syncProgress.text}
              </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {Math.round((syncProgress.current / syncProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round((syncProgress.current / syncProgress.total) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Push Success Feedback Banner */}
        {pushSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 text-xs space-y-2.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2 font-bold text-sm text-emerald-900 dark:text-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>{pushSuccess}</span>
              </div>
              {config.spreadsheetUrl && (
                <a
                  href={config.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 transition-colors shrink-0 shadow-xs"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {syncResult && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-emerald-800 dark:text-emerald-300 pt-2 border-t border-emerald-200/80 dark:border-emerald-800/60 font-medium">
                <span className="font-bold">⚡ Total Duration: {syncResult.durationSeconds}s</span>
                <span>•</span>
                <span>{syncResult.inserted} New Rows Appended</span>
                <span>•</span>
                <span>{syncResult.updated} Existing Rows Updated In-Place</span>
                <span>•</span>
                <span>Zero Duplicate Rows</span>
              </div>
            )}
          </div>
        )}

        {/* Push Error Feedback Banner */}
        {pushError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-sm">Synchronization Failed</div>
              <div className="text-xs leading-relaxed">{pushError}</div>
              <div className="pt-1">
                <button
                  onClick={handlePushAll}
                  className="px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Push</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sync Audit History Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Synchronization Audit Log
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              ({logs.length} logged events)
            </span>
          </div>

          {logs.length > 0 && (
            <button
              onClick={() => {
                clearSyncLogs();
                refreshLogsAndQueue();
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Log
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
            No synchronization activity logged yet. Submitting or editing readings will automatically record events here.
          </div>
        ) : (
          <div>
            <div className="md:hidden px-3 py-1 bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 border border-b-0 border-slate-200 dark:border-slate-800 rounded-t-lg flex items-center justify-between">
              <span>↔ Scroll sideways for log details</span>
              <span className="font-mono text-emerald-600 font-semibold">{logs.length} events</span>
            </div>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-b-lg md:rounded-lg w-full overscroll-x-contain">
              <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Tab</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {logs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-3 font-semibold whitespace-nowrap capitalize">
                      {log.category.replace('_', ' ')}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.action === 'insert'
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : log.action === 'update'
                            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        {log.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-600 dark:text-slate-400">
                      {log.targetSheet}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <Check className="w-3 h-3" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold text-[11px]">
                          <AlertCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-xs">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
