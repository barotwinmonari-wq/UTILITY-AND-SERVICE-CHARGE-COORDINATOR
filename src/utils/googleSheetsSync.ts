import {
  WaterWeeklyReading,
  WaterDailyReading,
  ElectricityPostpaidReading,
  ElectricityPrepaidToken,
  GoogleSheetsConfig,
  SyncLogEntry,
  PendingSyncItem,
  MeterCategory,
} from '../types';
import { METERS_CATALOG, DEFAULT_WATER_RATE_PER_M3 } from '../data/meterCatalog';

export const DEFAULT_SHEETS_CONFIG: GoogleSheetsConfig = {
  spreadsheetId: '',
  spreadsheetUrl: '',
  spreadsheetTitle: '',
  autoSyncEnabled: true,
  worksheets: {
    water_weekly: 'Weekly Water',
    water_daily_special: 'Special Daily Water',
    electricity_postpaid: 'Postpaid Electricity',
    electricity_prepaid: 'Prepaid Electricity',
  },
  lastSyncStatus: 'idle',
};

// Column Headers for each worksheet
export const HEADERS_MAPPING = {
  water_weekly: [
    'Record ID',
    'Start Date',
    'End Date',
    'Meter ID',
    'Meter Name',
    'Location',
    'Start Reading (m³)',
    'End Reading (m³)',
    'Weekly Consumption (m³)',
    'Est Cost (KSh)',
    'Meter Rollover',
    'Audit Photo',
    'Notes',
    'Last Synchronized',
  ],
  water_daily_special: [
    'Record ID',
    'Date',
    'ISO Date',
    'Meter ID',
    'Meter Name',
    'Start Time',
    'End Time',
    'Start Reading',
    'End Reading',
    'Day Consumption',
    'Night Consumption',
    '24hrs Total',
    'Running Total',
    'Morning Photo',
    'Evening Photo',
    'Notes',
    'Last Synchronized',
  ],
  electricity_postpaid: [
    'Record ID',
    'Reading Date',
    'Meter ID',
    'Meter Name',
    'KPLC Meter No',
    'Location',
    'Previous Reading (kWh)',
    'End Reading (kWh)',
    'Consumption (kWh)',
    'Tariff Rate (KSh/kWh)',
    'Bill Amount (KSh)',
    'Meter Rollover',
    'Meter Photo',
    'Notes',
    'Last Synchronized',
  ],
  electricity_prepaid: [
    'Record ID',
    'Purchase Date',
    'Meter ID',
    'Meter Name',
    'KPLC Meter No',
    'Token Number',
    'Token Units (kWh)',
    'Gross Amount Paid (KSh)',
    'Net Token Amount (KSh)',
    'Effective Rate (KSh/kWh)',
    'Receipt Attached',
    'Notes',
    'Last Synchronized',
  ],
};

// Helper: Extract Spreadsheet ID from standard URL or raw ID
export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

// Config Persistence (localStorage)
const CONFIG_KEY = 'gpf_google_sheets_config_v1';
const LOGS_KEY = 'gpf_google_sheets_sync_logs_v1';
const QUEUE_KEY = 'gpf_google_sheets_pending_queue_v1';

export function getSheetsConfig(): GoogleSheetsConfig {
  if (typeof window === 'undefined') return DEFAULT_SHEETS_CONFIG;
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return DEFAULT_SHEETS_CONFIG;
  try {
    return { ...DEFAULT_SHEETS_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SHEETS_CONFIG;
  }
}

export function saveSheetsConfig(config: GoogleSheetsConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function getSyncLogs(): SyncLogEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(LOGS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addSyncLog(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>): SyncLogEntry {
  const logs = getSyncLogs();
  const newLog: SyncLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
  };
  const updated = [newLog, ...logs].slice(0, 100); // keep last 100 logs
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
  }
  return newLog;
}

export function clearSyncLogs(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOGS_KEY);
  }
}

export function getPendingQueue(): PendingSyncItem[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function enqueuePendingSync(
  category: MeterCategory,
  action: 'upsert' | 'delete',
  record: any
): void {
  const queue = getPendingQueue();
  const existingIdx = queue.findIndex(
    (item) => item.category === category && item.record.id === record.id
  );
  const newItem: PendingSyncItem = {
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    category,
    action,
    record,
    queuedAt: Date.now(),
    attempts: existingIdx >= 0 ? queue[existingIdx].attempts + 1 : 1,
  };
  if (existingIdx >= 0) {
    queue[existingIdx] = newItem;
  } else {
    queue.push(newItem);
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

export function removePendingSync(id: string): void {
  const queue = getPendingQueue().filter((item) => item.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

export function clearPendingQueue(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(QUEUE_KEY);
  }
}

// ---------------- Google Sheets API Calls & Quota-Protected Batching ----------------

export interface SpreadsheetMetadata {
  title: string;
  sheetTabs: string[];
}

/**
 * Robust fetch with exponential backoff on HTTP 429 (rate limit) or HTTP 503 (service unavailable)
 */
export async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  maxRetries: number = 4,
  initialDelayMs: number = 1500
): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status === 503) {
        if (attempt < maxRetries) {
          attempt++;
          const delay =
            initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
          console.warn(
            `[Google Sheets API] Rate limit hit (HTTP ${response.status}). Backing off for ${Math.round(
              delay
            )}ms before retry ${attempt}/${maxRetries}...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      return response;
    } catch (err: any) {
      if (attempt < maxRetries) {
        attempt++;
        const delay =
          initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
        console.warn(
          `[Google Sheets API] Network error: ${err.message}. Retrying in ${Math.round(
            delay
          )}ms (${attempt}/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Fetch spreadsheet metadata to verify connection and obtain sheet tab names
 */
export async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  token: string
): Promise<SpreadsheetMetadata> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=properties.title,sheets.properties(sheetId,title)`;
  const res = await fetchWithBackoff(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    let msg = `HTTP ${res.status}: Failed to access spreadsheet`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.message) msg = parsed.error.message;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  const title = data.properties?.title || 'Google Spreadsheet';
  const sheetTabs: string[] = (data.sheets || []).map(
    (s: any) => s.properties?.title || ''
  );

  return { title, sheetTabs };
}

/**
 * Ensures that a destination sheet tab exists; creates it if missing
 */
export async function ensureSheetTabExists(
  spreadsheetId: string,
  token: string,
  sheetTitle: string
): Promise<void> {
  const meta = await fetchSpreadsheetMetadata(spreadsheetId, token);
  if (meta.sheetTabs.includes(sheetTitle)) {
    return;
  }

  // Create sheet tab
  const addUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}:batchUpdate`;
  const res = await fetchWithBackoff(addUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetTitle,
            },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error('Failed to add sheet tab:', errorBody);
  }
}

/**
 * Ensures that the header row is present in the sheet tab
 */
export async function ensureSheetHeaders(
  spreadsheetId: string,
  token: string,
  sheetTitle: string,
  headers: string[]
): Promise<void> {
  const encodedTitle = encodeURIComponent(sheetTitle);
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/'${encodedTitle}'!A1:Z1?valueRenderOption=UNFORMATTED_VALUE`;

  const readRes = await fetchWithBackoff(readUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (readRes.ok) {
    const readData = await readRes.json();
    if (readData.values && readData.values.length > 0 && readData.values[0].length > 0) {
      // Header row already exists
      return;
    }
  }

  // Write header row to row 1
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/'${encodedTitle}'!A1:Z1?valueInputOption=USER_ENTERED`;

  await fetchWithBackoff(writeUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [headers],
    }),
  });
}

/**
 * Convert a system record into an array of cell values matching the tab schema
 */
export function recordToRowValues(
  category: MeterCategory,
  record: any
): (string | number)[] {
  const meterMap = new Map(METERS_CATALOG.map((m) => [m.id, m]));
  const meter = meterMap.get(record.meterId);
  const nowIso = new Date().toISOString();

  switch (category) {
    case 'water_weekly': {
      const r = record as WaterWeeklyReading;
      return [
        r.id,
        r.startDate || '',
        r.endDate || r.date,
        r.meterId,
        meter?.name || r.meterId,
        meter?.location || '',
        r.previousReading,
        r.endReading,
        r.consumption,
        Number((r.consumption * DEFAULT_WATER_RATE_PER_M3).toFixed(2)),
        r.isRollover ? 'Yes' : 'No',
        r.photoUrl ? 'Attached' : 'None',
        r.notes || '',
        nowIso,
      ];
    }
    case 'water_daily_special': {
      const r = record as WaterDailyReading;
      return [
        r.id,
        r.displayDate || r.date,
        r.date,
        r.meterId,
        meter?.name || r.meterId,
        r.startTime,
        r.endTime,
        r.startReading,
        r.endReading,
        r.dayConsumption,
        r.nightConsumption,
        r.totalConsumption,
        r.runningTotal !== undefined ? r.runningTotal : '',
        r.startPhotoUrl ? 'Attached' : 'None',
        r.endPhotoUrl ? 'Attached' : 'None',
        r.notes || '',
        nowIso,
      ];
    }
    case 'electricity_postpaid': {
      const r = record as ElectricityPostpaidReading;
      return [
        r.id,
        r.date,
        r.meterId,
        meter?.name || r.meterId,
        meter?.meterNumber || '',
        meter?.location || '',
        r.previousReading,
        r.endReading,
        r.consumption,
        r.tariffRateKsh,
        r.billAmountKsh,
        r.isRollover ? 'Yes' : 'No',
        r.photoUrl ? 'Attached' : 'None',
        r.notes || '',
        nowIso,
      ];
    }
    case 'electricity_prepaid': {
      const r = record as ElectricityPrepaidToken;
      return [
        r.id,
        r.date,
        r.meterId,
        meter?.name || r.meterId,
        meter?.meterNumber || '',
        r.tokenNumber,
        r.tokenUnitsKwh,
        r.grossAmountKsh,
        r.netTokenAmountKsh,
        r.effectiveRateKshPerKwh,
        r.receiptPhotoUrl ? 'Attached' : 'None',
        r.notes || '',
        nowIso,
      ];
    }
  }
}

/**
 * Searches Column A for record ID. Returns 1-indexed row number or -1 if not found.
 */
export async function findRowIndexByRecordId(
  spreadsheetId: string,
  token: string,
  sheetTitle: string,
  recordId: string
): Promise<number> {
  const encodedTitle = encodeURIComponent(sheetTitle);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/'${encodedTitle}'!A:A?valueRenderOption=UNFORMATTED_VALUE`;

  const res = await fetchWithBackoff(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return -1;
  const data = await res.json();
  const rows = data.values as any[][] | undefined;
  if (!rows || rows.length === 0) return -1;

  for (let i = 0; i < rows.length; i++) {
    const val = rows[i]?.[0];
    if (val !== undefined && String(val).trim() === String(recordId).trim()) {
      return i + 1; // 1-indexed row number in Google Sheets
    }
  }
  return -1;
}

/**
 * Upsert a single record into Google Sheets (used for immediate event triggers).
 * If record ID exists in Column A, updates the row.
 * If record ID does not exist, appends a new row.
 */
export async function upsertRecordToSheet(
  category: MeterCategory,
  record: any,
  config: GoogleSheetsConfig,
  token: string
): Promise<{ action: 'insert' | 'update'; rowNumber: number }> {
  if (!config.spreadsheetId) {
    throw new Error('Spreadsheet ID is not configured');
  }

  const sheetTitle = config.worksheets[category] || 'Sheet1';
  const headers = HEADERS_MAPPING[category];
  const rowValues = recordToRowValues(category, record);

  // 1. Ensure sheet tab and headers exist
  await ensureSheetTabExists(config.spreadsheetId, token, sheetTitle);
  await ensureSheetHeaders(config.spreadsheetId, token, sheetTitle, headers);

  // 2. Check if row already exists by Record ID
  const existingRow = await findRowIndexByRecordId(
    config.spreadsheetId,
    token,
    sheetTitle,
    record.id
  );

  const encodedTitle = encodeURIComponent(sheetTitle);

  if (existingRow > 0) {
    // UPDATE existing row
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      config.spreadsheetId
    )}/values/'${encodedTitle}'!A${existingRow}:Z${existingRow}?valueInputOption=USER_ENTERED`;

    const res = await fetchWithBackoff(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to update row ${existingRow}: ${err}`);
    }

    addSyncLog({
      category,
      action: 'update',
      recordId: record.id,
      meterName: record.meterId,
      status: 'success',
      details: `Updated row ${existingRow} in '${sheetTitle}' (ID: ${record.id})`,
      targetSheet: sheetTitle,
    });

    return { action: 'update', rowNumber: existingRow };
  } else {
    // APPEND new row
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      config.spreadsheetId
    )}/values/'${encodedTitle}'!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetchWithBackoff(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to append row: ${err}`);
    }

    const appendData = await res.json();
    const updatedRange = appendData.updates?.updatedRange || '';

    addSyncLog({
      category,
      action: 'insert',
      recordId: record.id,
      meterName: record.meterId,
      status: 'success',
      details: `Appended new row in '${sheetTitle}' (${updatedRange})`,
      targetSheet: sheetTitle,
    });

    return { action: 'insert', rowNumber: 0 };
  }
}

/**
 * Tab-level batch synchronization for a single worksheet.
 * Makes ONLY 1 single read call to get all existing rows, matches Record IDs in-memory,
 * and executes a single batchUpdate and/or append call.
 * This drops API read requests from ~100 per category to EXACTLY 1 per category!
 */
export async function batchSyncCategoryRecords(
  category: MeterCategory,
  records: any[],
  config: GoogleSheetsConfig,
  token: string,
  onProgress?: (stepText: string) => void
): Promise<{ inserted: number; updated: number }> {
  if (records.length === 0) return { inserted: 0, updated: 0 };

  const sheetTitle = config.worksheets[category] || 'Sheet1';
  const headers = HEADERS_MAPPING[category];
  const encodedTitle = encodeURIComponent(sheetTitle);

  // 1. Fetch worksheet values in ONE single read call
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    config.spreadsheetId
  )}/values/'${encodedTitle}'!A:Z?valueRenderOption=UNFORMATTED_VALUE`;

  const readRes = await fetchWithBackoff(readUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let existingRows: any[][] = [];
  if (readRes.ok) {
    const readData = await readRes.json();
    existingRows = readData.values || [];
  } else if (readRes.status === 404 || readRes.status === 400) {
    // Sheet tab may be missing - ensure it exists
    await ensureSheetTabExists(config.spreadsheetId, token, sheetTitle);
  } else {
    const errText = await readRes.text();
    let msg = `HTTP ${readRes.status}: Failed to read worksheet '${sheetTitle}'`;
    try {
      const p = JSON.parse(errText);
      if (p.error?.message) msg = p.error.message;
    } catch {}
    throw new Error(msg);
  }

  // 2. Build index of existing Record IDs in memory
  // Column 0 (A) is always Record ID
  const idToRowIndex = new Map<string, number>();
  let hasHeaders = false;

  if (existingRows.length > 0) {
    const firstCell = String(existingRows[0]?.[0] || '').trim();
    if (firstCell.toLowerCase().includes('record') || firstCell.toLowerCase().includes('id')) {
      hasHeaders = true;
    }

    for (let r = 0; r < existingRows.length; r++) {
      const cellVal = existingRows[r]?.[0];
      if (cellVal !== undefined && cellVal !== null) {
        const idStr = String(cellVal).trim();
        if (idStr && idStr.toLowerCase() !== 'record id') {
          idToRowIndex.set(idStr, r + 1); // 1-indexed row number
        }
      }
    }
  }

  const toUpdateRanges: { range: string; values: (string | number)[][] }[] = [];
  const toAppendRows: (string | number)[][] = [];

  // If sheet is completely empty, append headers first
  if (!hasHeaders && existingRows.length === 0) {
    toAppendRows.push(headers);
  }

  for (const record of records) {
    const rowValues = recordToRowValues(category, record);
    const existingRow = idToRowIndex.get(String(record.id).trim());

    if (existingRow && existingRow > 0) {
      toUpdateRanges.push({
        range: `'${encodedTitle}'!A${existingRow}:Z${existingRow}`,
        values: [rowValues],
      });
    } else {
      toAppendRows.push(rowValues);
    }
  }

  // 3. Batch Update existing rows (in 1 single write call)
  if (toUpdateRanges.length > 0) {
    if (onProgress) {
      onProgress(`Updating ${toUpdateRanges.length} existing rows in '${sheetTitle}'...`);
    }
    const chunkSize = 100;
    for (let i = 0; i < toUpdateRanges.length; i += chunkSize) {
      const chunk = toUpdateRanges.slice(i, i + chunkSize);
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        config.spreadsheetId
      )}/values:batchUpdate`;

      const updateRes = await fetchWithBackoff(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: chunk,
        }),
      });

      if (!updateRes.ok) {
        const err = await updateRes.text();
        throw new Error(`Failed to batch update '${sheetTitle}': ${err}`);
      }
    }
  }

  // 4. Batch Append new rows (in 1 single write call)
  if (toAppendRows.length > 0) {
    if (onProgress) {
      onProgress(`Appending ${toAppendRows.length} new records to '${sheetTitle}'...`);
    }
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      config.spreadsheetId
    )}/values/'${encodedTitle}'!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const appendRes = await fetchWithBackoff(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: toAppendRows,
      }),
    });

    if (!appendRes.ok) {
      const err = await appendRes.text();
      throw new Error(`Failed to batch append to '${sheetTitle}': ${err}`);
    }
  }

  const inserted = toAppendRows.length - (!hasHeaders && existingRows.length === 0 ? 1 : 0);
  const updated = toUpdateRanges.length;

  addSyncLog({
    category,
    action: 'bulk_sync',
    status: 'success',
    details: `Worksheet '${sheetTitle}': ${inserted} appended, ${updated} updated in batch.`,
    targetSheet: sheetTitle,
  });

  return { inserted: Math.max(0, inserted), updated };
}

export function disconnectSpreadsheet(): GoogleSheetsConfig {
  const current = getSheetsConfig();
  const resetConfig: GoogleSheetsConfig = {
    ...DEFAULT_SHEETS_CONFIG,
    autoSyncEnabled: current.autoSyncEnabled,
    worksheets: current.worksheets,
    lastSyncStatus: 'idle',
    lastSyncMessage: 'Spreadsheet unlinked by administrator.',
  };
  saveSheetsConfig(resetConfig);
  return resetConfig;
}

/**
 * Bulk synchronizes all local records to Google Sheets.
 * Uses concurrent tab-level batching for ultra-fast, quota-protected execution (<1 second).
 */
export async function pushAllLocalRecordsToSheet(
  weeklyWater: WaterWeeklyReading[],
  dailyWater: WaterDailyReading[],
  postpaidPower: ElectricityPostpaidReading[],
  prepaidTokens: ElectricityPrepaidToken[],
  config: GoogleSheetsConfig,
  token: string,
  onProgress?: (progressText: string, current: number, total: number) => void
): Promise<{ totalSynced: number; inserted: number; updated: number; durationSeconds: number }> {
  if (!config.spreadsheetId) {
    throw new Error('Spreadsheet ID is not configured');
  }

  const startTime = performance.now();

  onProgress?.('Verifying spreadsheet metadata...', 0, 5);
  const meta = await fetchSpreadsheetMetadata(config.spreadsheetId, token);
  const existingTabTitles = new Set(meta.sheetTabs);

  const categories: { cat: MeterCategory; items: any[]; title: string }[] = [
    {
      cat: 'water_weekly',
      items: weeklyWater,
      title: config.worksheets.water_weekly || 'Weekly Water',
    },
    {
      cat: 'water_daily_special',
      items: dailyWater,
      title: config.worksheets.water_daily_special || 'Special Daily Water',
    },
    {
      cat: 'electricity_postpaid',
      items: postpaidPower,
      title: config.worksheets.electricity_postpaid || 'Postpaid Electricity',
    },
    {
      cat: 'electricity_prepaid',
      items: prepaidTokens,
      title: config.worksheets.electricity_prepaid || 'Prepaid Electricity',
    },
  ];

  // Create any missing tabs in ONE single batchUpdate call
  const missingTabs = categories
    .map((c) => c.title)
    .filter((title) => !existingTabTitles.has(title));

  if (missingTabs.length > 0) {
    onProgress?.(`Provisioning ${missingTabs.length} missing sheet tabs...`, 1, 5);
    const addUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      config.spreadsheetId
    )}:batchUpdate`;

    await fetchWithBackoff(addUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: missingTabs.map((title) => ({
          addSheet: { properties: { title } },
        })),
      }),
    });
  }

  const activeCategories = categories.filter((c) => c.items.length > 0);
  const totalCount =
    weeklyWater.length +
    dailyWater.length +
    postpaidPower.length +
    prepaidTokens.length;

  onProgress?.(
    `Dispatching batch sync for ${totalCount} records across ${activeCategories.length} worksheets...`,
    1,
    activeCategories.length
  );

  let totalInserted = 0;
  let totalUpdated = 0;

  // Run all active categories concurrently for maximum transfer speed
  const syncResults = await Promise.all(
    activeCategories.map(async ({ cat, items, title }, idx) => {
      onProgress?.(
        `Syncing '${title}' (${items.length} records)...`,
        idx + 1,
        activeCategories.length
      );

      const res = await batchSyncCategoryRecords(
        cat,
        items,
        config,
        token,
        (stepText) => {
          onProgress?.(stepText, idx + 1, activeCategories.length);
        }
      );
      return res;
    })
  );

  for (const r of syncResults) {
    totalInserted += r.inserted;
    totalUpdated += r.updated;
  }

  const elapsedSeconds = Number(
    ((performance.now() - startTime) / 1000).toFixed(1)
  );

  // Update config status
  const updatedConfig: GoogleSheetsConfig = {
    ...config,
    lastSyncTimestamp: Date.now(),
    lastSyncStatus: 'success',
    lastSyncMessage: `Fast batch sync completed in ${elapsedSeconds}s: ${totalInserted} added, ${totalUpdated} updated across all worksheets.`,
  };
  saveSheetsConfig(updatedConfig);

  addSyncLog({
    category: 'all',
    action: 'bulk_sync',
    status: 'success',
    details: `Lightning push complete in ${elapsedSeconds}s. Total: ${totalCount} records (${totalInserted} new, ${totalUpdated} updated)`,
    targetSheet: 'All Tabs',
  });

  return {
    totalSynced: totalCount,
    inserted: totalInserted,
    updated: totalUpdated,
    durationSeconds: elapsedSeconds,
  };
}
