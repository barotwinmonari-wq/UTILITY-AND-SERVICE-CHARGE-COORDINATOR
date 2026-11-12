import React, { useState } from 'react';
import { WaterWeeklyReading } from '../types';
import { METERS_CATALOG, DEFAULT_WATER_RATE_PER_M3 } from '../data/meterCatalog';
import { SpreadsheetGrid, ColumnDef } from './SpreadsheetGrid';
import { formatNumber, formatKsh } from '../utils/calculations';
import { Image, AlertTriangle } from 'lucide-react';
import { PhotoViewerModal } from './PhotoViewerModal';

interface WaterWeeklySectionProps {
  data: WaterWeeklyReading[];
  onAddRow: () => void;
  onDeleteRow: (id: string) => void;
}

export const WaterWeeklySection: React.FC<WaterWeeklySectionProps> = ({
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
    (m) => m.category === 'water_weekly'
  ).map((m) => ({
    label: m.name,
    value: m.id,
  }));

  const filteredData =
    selectedMeterFilter === 'all'
      ? data
      : data.filter((d) => d.meterId === selectedMeterFilter);

  // Column definitions
  const columns: ColumnDef<WaterWeeklyReading>[] = [
    {
      key: 'date',
      header: 'Start Date → End Date',
      width: '180px',
      sortValue: (r) => r.date,
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            {r.endDate || r.date}
          </div>
          {r.startDate && (
            <div className="text-[11px] text-slate-500 font-sans">
              From: {r.startDate}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'meterName',
      header: 'Meter Name',
      sortValue: (r) => meterMap.get(r.meterId)?.name || '',
      render: (r) => {
        const meter = meterMap.get(r.meterId);
        return (
          <div>
            <div className="font-medium text-slate-900 dark:text-slate-100 font-sans">
              {meter?.name || r.meterId}
            </div>
            <div className="text-[11px] text-slate-500 font-sans truncate max-w-xs">
              {meter?.location}
            </div>
          </div>
        );
      },
    },
    {
      key: 'previousReading',
      header: 'START (m³)',
      align: 'right',
      width: '120px',
      sortValue: (r) => r.previousReading,
      render: (r) => (
        <span className="text-slate-700 dark:text-slate-300 font-medium">
          {formatNumber(r.previousReading, 1)}
        </span>
      ),
    },
    {
      key: 'endReading',
      header: 'END (m³)',
      align: 'right',
      width: '120px',
      sortValue: (r) => r.endReading,
      render: (r) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {formatNumber(r.endReading, 1)}
        </span>
      ),
    },
    {
      key: 'consumption',
      header: 'CONSUMPTION (m³)',
      align: 'right',
      width: '150px',
      sortValue: (r) => r.consumption,
      render: (r) => {
        const isNegative = r.consumption < 0;
        return (
          <span
            className={`font-bold ${
              isNegative
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {formatNumber(r.consumption, 1)} m³
          </span>
        );
      },
    },
    {
      key: 'cost',
      header: 'Est. Cost (KSh)',
      align: 'right',
      width: '120px',
      sortValue: (r) => r.consumption * DEFAULT_WATER_RATE_PER_M3,
      render: (r) => (
        <span className="text-slate-700 dark:text-slate-300">
          {formatKsh(r.consumption * DEFAULT_WATER_RATE_PER_M3)}
        </span>
      ),
    },
    {
      key: 'photo',
      header: 'Audit Photo',
      align: 'center',
      width: '90px',
      render: (r) =>
        r.photoUrl ? (
          <button
            onClick={() =>
              setPhotoViewer({
                url: r.photoUrl!,
                title: `${meterMap.get(r.meterId)?.name} Dial Photo`,
                subtitle: `Recorded ${r.date} · Reading: ${r.endReading} m³`,
              })
            }
            className="inline-flex items-center gap-1 text-[11px] text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 rounded px-2 py-0.5 font-sans transition-colors"
          >
            <Image className="w-3 h-3" />
            <span>View</span>
          </button>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 font-sans">
            —
          </span>
        ),
    },
    {
      key: 'notes',
      header: 'Observations & Flags',
      render: (r) => (
        <div className="font-sans text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm">
          {r.isRollover && (
            <span className="mr-1 text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300 px-1.5 py-0.5 rounded">
              Rollover
            </span>
          )}
          {r.notes || '—'}
        </div>
      ),
    },
  ];

  // Summary Row Calculations
  const totalConsumption = filteredData.reduce(
    (sum, r) => sum + r.consumption,
    0
  );
  const totalCost = totalConsumption * DEFAULT_WATER_RATE_PER_M3;

  const summaryRow = (
    <>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
        {formatNumber(totalConsumption, 1)} m³
      </td>
      <td className="py-2.5 px-3 text-right">{formatKsh(totalCost)}</td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
    </>
  );

  return (
    <div className="space-y-4">
      <SpreadsheetGrid
        title="Weekly Water Meters (Monday Schedule)"
        subtitle="Tracking Naiposha Kanjo, Internal, Tea Pods, Browns, Project Pamoja & Camp 6 meters"
        data={filteredData}
        columns={columns}
        onAddRow={onAddRow}
        onDeleteRow={onDeleteRow}
        filterOptions={filterOptions}
        selectedFilter={selectedMeterFilter}
        onFilterChange={setSelectedMeterFilter}
        searchPlaceholder="Filter weekly water..."
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
