import React, { useState } from 'react';
import { ElectricityPostpaidReading } from '../types';
import { METERS_CATALOG } from '../data/meterCatalog';
import { SpreadsheetGrid, ColumnDef } from './SpreadsheetGrid';
import { formatNumber, formatKsh } from '../utils/calculations';
import { Image, AlertTriangle, Zap } from 'lucide-react';
import { PhotoViewerModal } from './PhotoViewerModal';

interface ElectricityPostpaidSectionProps {
  data: ElectricityPostpaidReading[];
  onAddRow: () => void;
  onDeleteRow: (id: string) => void;
}

export const ElectricityPostpaidSection: React.FC<
  ElectricityPostpaidSectionProps
> = ({ data, onAddRow, onDeleteRow }) => {
  const [selectedMeterFilter, setSelectedMeterFilter] = useState('all');
  const [photoViewer, setPhotoViewer] = useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);

  const meterMap = new Map(METERS_CATALOG.map((m) => [m.id, m]));

  const filterOptions = METERS_CATALOG.filter(
    (m) => m.category === 'electricity_postpaid'
  ).map((m) => ({
    label: m.name,
    value: m.id,
  }));

  const filteredData =
    selectedMeterFilter === 'all'
      ? data
      : data.filter((d) => d.meterId === selectedMeterFilter);

  const columns: ColumnDef<ElectricityPostpaidReading>[] = [
    {
      key: 'date',
      header: 'Reading Date',
      width: '110px',
      sortValue: (r) => r.date,
      render: (r) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {r.date}
        </span>
      ),
    },
    {
      key: 'meterName',
      header: 'KPLC Postpaid Meter',
      sortValue: (r) => meterMap.get(r.meterId)?.name || '',
      render: (r) => {
        const meter = meterMap.get(r.meterId);
        return (
          <div>
            <div className="font-semibold text-amber-900 dark:text-amber-300 font-sans flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{meter?.name || r.meterId}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-sans truncate max-w-xs">
              {meter?.location} {meter?.meterNumber ? `· ${meter.meterNumber}` : ''}
            </div>
          </div>
        );
      },
    },
    {
      key: 'previousReading',
      header: 'Start / Prev (kWh)',
      align: 'right',
      width: '135px',
      sortValue: (r) => r.previousReading,
      render: (r) => (
        <span className="text-slate-600 dark:text-slate-400">
          {formatNumber(r.previousReading, 1)}
        </span>
      ),
    },
    {
      key: 'endReading',
      header: 'End Reading (kWh)',
      align: 'right',
      width: '135px',
      sortValue: (r) => r.endReading,
      render: (r) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {formatNumber(r.endReading, 1)}
        </span>
      ),
    },
    {
      key: 'consumption',
      header: 'Consumption (kWh)',
      align: 'right',
      width: '150px',
      sortValue: (r) => r.consumption,
      render: (r) => (
        <span className="font-bold text-amber-700 dark:text-amber-400">
          {formatNumber(r.consumption, 1)} kWh
        </span>
      ),
    },
    {
      key: 'tariffRateKsh',
      header: 'Tariff (KSh/kWh)',
      align: 'right',
      width: '130px',
      sortValue: (r) => r.tariffRateKsh,
      render: (r) => (
        <span className="text-slate-600 dark:text-slate-400">
          KSh {formatNumber(r.tariffRateKsh, 2)}
        </span>
      ),
    },
    {
      key: 'billAmountKsh',
      header: 'Billed Amount (KSh)',
      align: 'right',
      width: '150px',
      sortValue: (r) => r.billAmountKsh,
      render: (r) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {formatKsh(r.billAmountKsh)}
        </span>
      ),
    },
    {
      key: 'photo',
      header: 'Dial Photo',
      align: 'center',
      width: '95px',
      render: (r) =>
        r.photoUrl ? (
          <button
            onClick={() =>
              setPhotoViewer({
                url: r.photoUrl!,
                title: `${meterMap.get(r.meterId)?.name} Dial Verification`,
                subtitle: `Date: ${r.date} · Reading: ${r.endReading} kWh`,
              })
            }
            className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded hover:bg-amber-100"
          >
            <Image className="w-3 h-3" />
            <span>View</span>
          </button>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        ),
    },
    {
      key: 'notes',
      header: 'Observations',
      render: (r) => (
        <div className="font-sans text-xs text-slate-500 truncate max-w-xs">
          {r.isRollover && (
            <span className="mr-1 text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">
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
  const totalBilled = filteredData.reduce(
    (sum, r) => sum + r.billAmountKsh,
    0
  );
  const avgTariff =
    totalConsumption > 0 ? totalBilled / totalConsumption : 28.5;

  const summaryRow = (
    <>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3 text-right text-amber-700 dark:text-amber-400">
        {formatNumber(totalConsumption, 1)} kWh
      </td>
      <td className="py-2.5 px-3 text-right text-slate-500">
        avg KSh {formatNumber(avgTariff, 2)}
      </td>
      <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100">
        {formatKsh(totalBilled)}
      </td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
    </>
  );

  return (
    <div className="space-y-4">
      <SpreadsheetGrid
        title="Postpaid KPLC Electricity Meters (Monday Schedule)"
        subtitle="Tracking Naiposha Central Substation, Borehole 1 Browns, and Camp Six Borehole 2"
        data={filteredData}
        columns={columns}
        onAddRow={onAddRow}
        onDeleteRow={onDeleteRow}
        filterOptions={filterOptions}
        selectedFilter={selectedMeterFilter}
        onFilterChange={setSelectedMeterFilter}
        searchPlaceholder="Filter postpaid electricity..."
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
