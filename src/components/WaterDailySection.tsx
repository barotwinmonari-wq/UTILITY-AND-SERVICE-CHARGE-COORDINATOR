import React, { useState } from 'react';
import { WaterDailyReading } from '../types';
import { METERS_CATALOG } from '../data/meterCatalog';
import { SpreadsheetGrid, ColumnDef } from './SpreadsheetGrid';
import { formatNumber } from '../utils/calculations';
import { Image, Clock, Sun, Moon } from 'lucide-react';
import { PhotoViewerModal } from './PhotoViewerModal';

interface WaterDailySectionProps {
  data: WaterDailyReading[];
  onAddRow: () => void;
  onDeleteRow: (id: string) => void;
}

export const WaterDailySection: React.FC<WaterDailySectionProps> = ({
  data,
  onAddRow,
  onDeleteRow,
}) => {
  const [selectedMeterFilter, setSelectedMeterFilter] = useState('all');
  const [photoViewer, setPhotoViewer] = useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);

  const meterMap = new Map(METERS_CATALOG.map((m) => [m.id, m]));

  const filterOptions = METERS_CATALOG.filter(
    (m) => m.category === 'water_daily_special'
  ).map((m) => ({
    label: m.name,
    value: m.id,
  }));

  const filteredData =
    selectedMeterFilter === 'all'
      ? data
      : data.filter((d) => d.meterId === selectedMeterFilter);

  const columns: ColumnDef<WaterDailyReading>[] = [
    {
      key: 'date',
      header: 'Date',
      width: '110px',
      sortValue: (r) => r.date,
      render: (r) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {r.displayDate || r.date}
        </span>
      ),
    },
    {
      key: 'meterName',
      header: 'Meter',
      sortValue: (r) => meterMap.get(r.meterId)?.name || '',
      render: (r) => {
        const meter = meterMap.get(r.meterId);
        return (
          <div>
            <div className="font-semibold text-teal-800 dark:text-teal-300 font-sans">
              {meter?.name || r.meterId}
            </div>
            <div className="text-[10px] text-slate-500 font-sans truncate max-w-xs">
              {meter?.location}
            </div>
          </div>
        );
      },
    },
    {
      key: 'startTime',
      header: 'Start Time',
      width: '100px',
      render: (r) => (
        <span className="font-mono text-slate-600 dark:text-slate-400">
          {r.startTime}
        </span>
      ),
    },
    {
      key: 'endTime',
      header: 'End Time',
      width: '100px',
      render: (r) => (
        <span className="font-mono text-slate-600 dark:text-slate-400">
          {r.endTime}
        </span>
      ),
    },
    {
      key: 'startReading',
      header: 'Start Reading',
      align: 'right',
      width: '110px',
      sortValue: (r) => r.startReading,
      render: (r) => (
        <span className="text-slate-700 dark:text-slate-300 font-medium">
          {formatNumber(r.startReading, Number.isInteger(r.startReading) ? 0 : 1)}
        </span>
      ),
    },
    {
      key: 'endReading',
      header: 'End Reading',
      align: 'right',
      width: '110px',
      sortValue: (r) => r.endReading,
      render: (r) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {formatNumber(r.endReading, Number.isInteger(r.endReading) ? 0 : 1)}
        </span>
      ),
    },
    {
      key: 'dayConsumption',
      header: 'Day Consumption',
      align: 'right',
      width: '120px',
      sortValue: (r) => r.dayConsumption,
      render: (r) => (
        <span className="text-amber-700 dark:text-amber-400 font-bold">
          {formatNumber(r.dayConsumption, Number.isInteger(r.dayConsumption) ? 0 : 1)}
        </span>
      ),
    },
    {
      key: 'nightConsumption',
      header: 'Night Consumption',
      align: 'right',
      width: '130px',
      sortValue: (r) => r.nightConsumption,
      render: (r) => (
        <span
          className={`font-bold ${
            r.nightConsumption < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-indigo-700 dark:text-indigo-400'
          }`}
        >
          {formatNumber(r.nightConsumption, Number.isInteger(r.nightConsumption) ? 0 : 1)}
        </span>
      ),
    },
    {
      key: 'totalConsumption',
      header: '24hrs Total',
      align: 'right',
      width: '110px',
      sortValue: (r) => r.totalConsumption,
      render: (r) => (
        <span
          className={`font-bold ${
            r.totalConsumption < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-teal-800 dark:text-teal-300'
          }`}
        >
          {formatNumber(r.totalConsumption, Number.isInteger(r.totalConsumption) ? 0 : 1)}
        </span>
      ),
    },
    {
      key: 'runningTotal',
      header: 'Running Total',
      align: 'right',
      width: '120px',
      sortValue: (r) => r.runningTotal ?? 0,
      render: (r) => (
        <span className="font-extrabold text-slate-900 dark:text-slate-100">
          {r.runningTotal !== undefined
            ? formatNumber(r.runningTotal, Number.isInteger(r.runningTotal) ? 0 : 1)
            : '—'}
        </span>
      ),
    },
    {
      key: 'photos',
      header: 'Photos',
      align: 'center',
      width: '80px',
      render: (r) => (
        <div className="flex items-center justify-center gap-1 font-sans">
          {r.startPhotoUrl && (
            <button
              onClick={() =>
                setPhotoViewer({
                  url: r.startPhotoUrl!,
                  title: `${meterMap.get(r.meterId)?.name} Morning Dial`,
                  subtitle: `Date: ${r.displayDate || r.date} @ ${r.startTime} · Start: ${r.startReading}`,
                })
              }
              className="text-[10px] text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-1.5 py-0.5 rounded hover:bg-teal-100"
              title="Morning Photo"
            >
              AM
            </button>
          )}
          {r.endPhotoUrl && (
            <button
              onClick={() =>
                setPhotoViewer({
                  url: r.endPhotoUrl!,
                  title: `${meterMap.get(r.meterId)?.name} Evening Dial`,
                  subtitle: `Date: ${r.displayDate || r.date} @ ${r.endTime} · End: ${r.endReading}`,
                })
              }
              className="text-[10px] text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-1.5 py-0.5 rounded hover:bg-teal-100"
              title="Evening Photo"
            >
              PM
            </button>
          )}
          {!r.startPhotoUrl && !r.endPhotoUrl && (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </div>
      ),
    },
  ];

  // Summary Row Calculations
  const sumDay = filteredData.reduce((acc, r) => acc + r.dayConsumption, 0);
  const sumNight = filteredData.reduce(
    (acc, r) => acc + r.nightConsumption,
    0
  );
  const sumTotal = filteredData.reduce(
    (acc, r) => acc + r.totalConsumption,
    0
  );
  const latestRunning =
    filteredData.length > 0
      ? filteredData[filteredData.length - 1]?.runningTotal ?? sumTotal
      : 0;

  const summaryRow = (
    <>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3 text-right text-amber-700 dark:text-amber-400">
        {formatNumber(sumDay, Number.isInteger(sumDay) ? 0 : 1)}
      </td>
      <td className="py-2.5 px-3 text-right text-indigo-700 dark:text-indigo-400">
        {formatNumber(sumNight, Number.isInteger(sumNight) ? 0 : 1)}
      </td>
      <td className="py-2.5 px-3 text-right text-teal-800 dark:text-teal-300">
        {formatNumber(sumTotal, Number.isInteger(sumTotal) ? 0 : 1)}
      </td>
      <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100">
        {formatNumber(latestRunning, Number.isInteger(latestRunning) ? 0 : 1)}
      </td>
      <td className="py-2.5 px-3"></td>
    </>
  );

  return (
    <div className="space-y-4">
      <SpreadsheetGrid
        title="Special Daily Water Meters (Day & Night Tracking)"
        subtitle="Tracking TTA Extraction Weir and WRA / WRMA statutory intake points"
        data={filteredData}
        columns={columns}
        onAddRow={onAddRow}
        onDeleteRow={onDeleteRow}
        filterOptions={filterOptions}
        selectedFilter={selectedMeterFilter}
        onFilterChange={setSelectedMeterFilter}
        searchPlaceholder="Filter daily water..."
        summaryRow={summaryRow}
      />

      <PhotoViewerModal
        isOpen={Boolean(photoViewer)}
        photoUrl={photoViewer?.url || null}
        title={photoViewer?.title || ''}
        subtitle={photoViewer?.subtitle}
        onClose={() => setPhotoViewer(null)}
      />
    </div>
  );
};
