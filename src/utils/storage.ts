import {
  WaterWeeklyReading,
  WaterDailyReading,
  ElectricityPostpaidReading,
  ElectricityPrepaidToken,
} from '../types';
import {
  INITIAL_WATER_WEEKLY,
  INITIAL_WATER_DAILY,
  INITIAL_ELECTRICITY_POSTPAID,
  INITIAL_ELECTRICITY_PREPAID,
} from '../data/mockSeedData';

const DB_NAME = 'gathoni_park_farm_utility_db_v2';
const DB_VERSION = 1;
const STORES = {
  WATER_WEEKLY: 'water_weekly',
  WATER_DAILY: 'water_daily',
  ELECTRICITY_POSTPAID: 'electricity_postpaid',
  ELECTRICITY_PREPAID: 'electricity_prepaid',
};

// Open IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.WATER_WEEKLY)) {
        db.createObjectStore(STORES.WATER_WEEKLY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.WATER_DAILY)) {
        db.createObjectStore(STORES.WATER_DAILY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.ELECTRICITY_POSTPAID)) {
        db.createObjectStore(STORES.ELECTRICITY_POSTPAID, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.ELECTRICITY_PREPAID)) {
        db.createObjectStore(STORES.ELECTRICITY_PREPAID, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Generic get all from object store
async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to localStorage
    const local = localStorage.getItem(`gpf_${storeName}`);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        return [];
      }
    }
    return [];
  }
}

// Generic put into object store
async function putInStore<T extends { id: string }>(
  storeName: string,
  item: T
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to localStorage
    const items = await getAllFromStore<T>(storeName);
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    localStorage.setItem(`gpf_${storeName}`, JSON.stringify(items));
  }
}

// Generic delete from object store
async function deleteFromStore(storeName: string, id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const items = await getAllFromStore<{ id: string }>(storeName);
    const filtered = items.filter((i) => i.id !== id);
    localStorage.setItem(`gpf_${storeName}`, JSON.stringify(filtered));
  }
}

// Water Weekly
export const getWaterWeeklyReadings = () =>
  getAllFromStore<WaterWeeklyReading>(STORES.WATER_WEEKLY);
export const saveWaterWeeklyReading = (item: WaterWeeklyReading) =>
  putInStore(STORES.WATER_WEEKLY, item);
export const deleteWaterWeeklyReading = (id: string) =>
  deleteFromStore(STORES.WATER_WEEKLY, id);

// Water Daily
export const getWaterDailyReadings = () =>
  getAllFromStore<WaterDailyReading>(STORES.WATER_DAILY);
export const saveWaterDailyReading = (item: WaterDailyReading) =>
  putInStore(STORES.WATER_DAILY, item);
export const deleteWaterDailyReading = (id: string) =>
  deleteFromStore(STORES.WATER_DAILY, id);

// Electricity Postpaid
export const getElectricityPostpaidReadings = () =>
  getAllFromStore<ElectricityPostpaidReading>(STORES.ELECTRICITY_POSTPAID);
export const saveElectricityPostpaidReading = (
  item: ElectricityPostpaidReading
) => putInStore(STORES.ELECTRICITY_POSTPAID, item);
export const deleteElectricityPostpaidReading = (id: string) =>
  deleteFromStore(STORES.ELECTRICITY_POSTPAID, id);

// Electricity Prepaid
export const getElectricityPrepaidTokens = () =>
  getAllFromStore<ElectricityPrepaidToken>(STORES.ELECTRICITY_PREPAID);
export const saveElectricityPrepaidToken = (item: ElectricityPrepaidToken) =>
  putInStore(STORES.ELECTRICITY_PREPAID, item);
export const deleteElectricityPrepaidToken = (id: string) =>
  deleteFromStore(STORES.ELECTRICITY_PREPAID, id);

// Helper to find the latest previous reading for a given meter
export function findLastReadingForMeter(
  meterId: string,
  allWeekly: WaterWeeklyReading[],
  allDaily: WaterDailyReading[],
  allPostpaid: ElectricityPostpaidReading[]
): { lastReading: number; lastDate: string } | null {
  // Check weekly water
  const weeklyMatches = allWeekly
    .filter((r) => r.meterId === meterId)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (weeklyMatches.length > 0) {
    return {
      lastReading: weeklyMatches[0].endReading,
      lastDate: weeklyMatches[0].date,
    };
  }

  // Check daily water
  const dailyMatches = allDaily
    .filter((r) => r.meterId === meterId)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (dailyMatches.length > 0) {
    return {
      lastReading: dailyMatches[0].endReading,
      lastDate: dailyMatches[0].date,
    };
  }

  // Check postpaid electricity
  const postpaidMatches = allPostpaid
    .filter((r) => r.meterId === meterId)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (postpaidMatches.length > 0) {
    return {
      lastReading: postpaidMatches[0].endReading,
      lastDate: postpaidMatches[0].date,
    };
  }

  return null;
}

const TTA_SYNC_FLAG = 'gpf_tta_sync_2026_11_12';
const BROWNS_SYNC_FLAG = 'gpf_browns_sync_2026_11_16';
const NAIPOSHA_KANJO_SYNC_FLAG = 'gpf_naiposha_kanjo_sync_2026_11_16';
const NAIPOSHA_INTERNAL_SYNC_FLAG = 'gpf_naiposha_internal_sync_2026_11_16';
const TEA_PODS_SYNC_FLAG = 'gpf_tea_pods_sync_2026_11_16';
const PAMOJA_SYNC_FLAG = 'gpf_pamoja_sync_2026_11_16';
const ET_NAIPOSHA_SYNC_FLAG = 'gpf_et_naiposha_sync_2026_08_20';

// Initialize seed data (loads Browns Water Meter + TTA Daily Water + WRA Daily Water, clean for others)
export async function initializeStorage(forceReset = false): Promise<void> {
  const isV4Initialized = localStorage.getItem('gpf_v4_initialized');
  if (!isV4Initialized || forceReset) {
    await resetToDefaultSeedData();
    localStorage.setItem('gpf_v4_initialized', 'true');
    localStorage.setItem(TTA_SYNC_FLAG, 'true');
    localStorage.setItem(BROWNS_SYNC_FLAG, 'true');
    localStorage.setItem(NAIPOSHA_KANJO_SYNC_FLAG, 'true');
    localStorage.setItem(NAIPOSHA_INTERNAL_SYNC_FLAG, 'true');
    localStorage.setItem(TEA_PODS_SYNC_FLAG, 'true');
    localStorage.setItem(PAMOJA_SYNC_FLAG, 'true');
    localStorage.setItem(ET_NAIPOSHA_SYNC_FLAG, 'true');
    return;
  }

  // Non-destructive TTA Water Meter update (05/10/2026 - 12/11/2026)
  if (!localStorage.getItem(TTA_SYNC_FLAG)) {
    const ttaSeedRecords = INITIAL_WATER_DAILY.filter(
      (item) => item.meterId === 'wd-tta'
    );
    const ttaSeedDates = new Set(ttaSeedRecords.map((item) => item.date));
    const existingDaily = await getAllFromStore<WaterDailyReading>(
      STORES.WATER_DAILY
    );

    // Remove any conflicting wd-tta entries on covered dates to prevent duplicates
    for (const row of existingDaily) {
      if (
        row.meterId === 'wd-tta' &&
        (ttaSeedDates.has(row.date) || row.id.startsWith('tta-'))
      ) {
        await deleteFromStore(STORES.WATER_DAILY, row.id);
      }
    }

    // Write the updated TTA records
    for (const item of ttaSeedRecords) {
      await putInStore(STORES.WATER_DAILY, item);
    }
    localStorage.setItem(TTA_SYNC_FLAG, 'true');
  }

  // Non-destructive Browns Water Meter update (5 Jan 2026 - 16 Nov 2026)
  if (!localStorage.getItem(BROWNS_SYNC_FLAG)) {
    const brownsSeedRecords = INITIAL_WATER_WEEKLY.filter(
      (item) => item.meterId === 'w-browns'
    );
    const brownsSeedDates = new Set(brownsSeedRecords.map((item) => item.date));
    const existingWeekly = await getAllFromStore<WaterWeeklyReading>(
      STORES.WATER_WEEKLY
    );

    for (const row of existingWeekly) {
      if (
        row.meterId === 'w-browns' &&
        (brownsSeedDates.has(row.date) || row.id.startsWith('bw-'))
      ) {
        await deleteFromStore(STORES.WATER_WEEKLY, row.id);
      }
    }

    for (const item of brownsSeedRecords) {
      await putInStore(STORES.WATER_WEEKLY, item);
    }
    localStorage.setItem(BROWNS_SYNC_FLAG, 'true');
  }

  // Non-destructive Naiposha Kanjo Meter update (26 Jan 2026 - 16 Nov 2026)
  if (!localStorage.getItem(NAIPOSHA_KANJO_SYNC_FLAG)) {
    const kanjoSeedRecords = INITIAL_WATER_WEEKLY.filter(
      (item) => item.meterId === 'w-naiposha-kanjo'
    );
    const kanjoSeedDates = new Set(kanjoSeedRecords.map((item) => item.date));
    const existingWeekly = await getAllFromStore<WaterWeeklyReading>(
      STORES.WATER_WEEKLY
    );

    for (const row of existingWeekly) {
      if (
        row.meterId === 'w-naiposha' ||
        row.id.startsWith('np-') ||
        (row.meterId === 'w-naiposha-kanjo' &&
          (kanjoSeedDates.has(row.date) || row.id.startsWith('nk-')))
      ) {
        await deleteFromStore(STORES.WATER_WEEKLY, row.id);
      }
    }

    for (const item of kanjoSeedRecords) {
      await putInStore(STORES.WATER_WEEKLY, item);
    }
    localStorage.setItem(NAIPOSHA_KANJO_SYNC_FLAG, 'true');
  }

  // Non-destructive Naiposha Kanjo Internal Meter update (2 Mar 2026 - 16 Nov 2026)
  if (!localStorage.getItem(NAIPOSHA_INTERNAL_SYNC_FLAG)) {
    const internalSeedRecords = INITIAL_WATER_WEEKLY.filter(
      (item) => item.meterId === 'w-naiposha-internal'
    );
    const internalSeedDates = new Set(
      internalSeedRecords.map((item) => item.date)
    );
    const existingWeekly = await getAllFromStore<WaterWeeklyReading>(
      STORES.WATER_WEEKLY
    );

    for (const row of existingWeekly) {
      if (
        row.meterId === 'w-naiposha-internal' &&
        (internalSeedDates.has(row.date) || row.id.startsWith('ni-'))
      ) {
        await deleteFromStore(STORES.WATER_WEEKLY, row.id);
      }
    }

    for (const item of internalSeedRecords) {
      await putInStore(STORES.WATER_WEEKLY, item);
    }
    localStorage.setItem(NAIPOSHA_INTERNAL_SYNC_FLAG, 'true');
  }

  // Non-destructive Tea Pods Meter update (26 Jan 2026 - 16 Nov 2026)
  if (!localStorage.getItem(TEA_PODS_SYNC_FLAG)) {
    const teaPodsSeedRecords = INITIAL_WATER_WEEKLY.filter(
      (item) => item.meterId === 'w-tea-pods'
    );
    const teaPodsSeedDates = new Set(
      teaPodsSeedRecords.map((item) => item.date)
    );
    const existingWeekly = await getAllFromStore<WaterWeeklyReading>(
      STORES.WATER_WEEKLY
    );

    for (const row of existingWeekly) {
      if (
        row.meterId === 'w-teapods' ||
        row.id.startsWith('tp-') ||
        (row.meterId === 'w-tea-pods' &&
          (teaPodsSeedDates.has(row.date) || row.id.startsWith('tp-')))
      ) {
        await deleteFromStore(STORES.WATER_WEEKLY, row.id);
      }
    }

    for (const item of teaPodsSeedRecords) {
      await putInStore(STORES.WATER_WEEKLY, item);
    }
    localStorage.setItem(TEA_PODS_SYNC_FLAG, 'true');
  }

  // Non-destructive Project Pamoja Water Meter update (26 Jan 2026 - 16 Nov 2026)
  if (!localStorage.getItem(PAMOJA_SYNC_FLAG)) {
    const pamojaSeedRecords = INITIAL_WATER_WEEKLY.filter(
      (item) => item.meterId === 'w-project-pamoja'
    );
    const pamojaSeedDates = new Set(
      pamojaSeedRecords.map((item) => item.date)
    );
    const existingWeekly = await getAllFromStore<WaterWeeklyReading>(
      STORES.WATER_WEEKLY
    );

    for (const row of existingWeekly) {
      if (
        row.meterId === 'w-project-pamoja' &&
        (pamojaSeedDates.has(row.date) || row.id.startsWith('pj-'))
      ) {
        await deleteFromStore(STORES.WATER_WEEKLY, row.id);
      }
    }

    for (const item of pamojaSeedRecords) {
      await putInStore(STORES.WATER_WEEKLY, item);
    }
    localStorage.setItem(PAMOJA_SYNC_FLAG, 'true');
  }

  // Non-destructive NAIPOSHA (#25700588632) prepaid electricity token update (Jan - Aug 2026)
  if (!localStorage.getItem(ET_NAIPOSHA_SYNC_FLAG)) {
    const etNaiposhaSeedRecords = INITIAL_ELECTRICITY_PREPAID.filter(
      (item) => item.meterId === 'et-naiposha'
    );
    const existingPrepaid = await getAllFromStore<ElectricityPrepaidToken>(
      STORES.ELECTRICITY_PREPAID
    );

    for (const row of existingPrepaid) {
      if (row.meterId === 'et-naiposha') {
        await deleteFromStore(STORES.ELECTRICITY_PREPAID, row.id);
      }
    }

    for (const item of etNaiposhaSeedRecords) {
      await putInStore(STORES.ELECTRICITY_PREPAID, item);
    }
    localStorage.setItem(ET_NAIPOSHA_SYNC_FLAG, 'true');
  }

  const currentWeekly = await getAllFromStore<WaterWeeklyReading>(
    STORES.WATER_WEEKLY
  );
  if (currentWeekly.length === 0) {
    for (const item of INITIAL_WATER_WEEKLY) {
      await putInStore(STORES.WATER_WEEKLY, item);
    }
  }

  const currentDaily = await getAllFromStore<WaterDailyReading>(
    STORES.WATER_DAILY
  );
  if (currentDaily.length === 0) {
    for (const item of INITIAL_WATER_DAILY) {
      await putInStore(STORES.WATER_DAILY, item);
    }
  }

  const currentPrepaid = await getAllFromStore<ElectricityPrepaidToken>(
    STORES.ELECTRICITY_PREPAID
  );
  if (currentPrepaid.length === 0) {
    for (const item of INITIAL_ELECTRICITY_PREPAID) {
      await putInStore(STORES.ELECTRICITY_PREPAID, item);
    }
  }
}

// Clear all readings across all stores to absolute zero
export async function clearAllStoresToZero(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(
    [
      STORES.WATER_WEEKLY,
      STORES.WATER_DAILY,
      STORES.ELECTRICITY_POSTPAID,
      STORES.ELECTRICITY_PREPAID,
    ],
    'readwrite'
  );
  tx.objectStore(STORES.WATER_WEEKLY).clear();
  tx.objectStore(STORES.WATER_DAILY).clear();
  tx.objectStore(STORES.ELECTRICITY_POSTPAID).clear();
  tx.objectStore(STORES.ELECTRICITY_PREPAID).clear();

  // Clear fallback localStorage
  localStorage.removeItem(`gpf_${STORES.WATER_WEEKLY}`);
  localStorage.removeItem(`gpf_${STORES.WATER_DAILY}`);
  localStorage.removeItem(`gpf_${STORES.ELECTRICITY_POSTPAID}`);
  localStorage.removeItem(`gpf_${STORES.ELECTRICITY_PREPAID}`);
}

// Reset all stores to factory seed data (clean system with only real TTA readings)
export async function resetToDefaultSeedData(): Promise<void> {
  await clearAllStoresToZero();

  for (const item of INITIAL_WATER_WEEKLY) {
    await putInStore(STORES.WATER_WEEKLY, item);
  }
  for (const item of INITIAL_WATER_DAILY) {
    await putInStore(STORES.WATER_DAILY, item);
  }
  for (const item of INITIAL_ELECTRICITY_POSTPAID) {
    await putInStore(STORES.ELECTRICITY_POSTPAID, item);
  }
  for (const item of INITIAL_ELECTRICITY_PREPAID) {
    await putInStore(STORES.ELECTRICITY_PREPAID, item);
  }
}

