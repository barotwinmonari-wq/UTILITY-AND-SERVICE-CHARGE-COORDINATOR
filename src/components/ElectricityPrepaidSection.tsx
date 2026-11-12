import React, { useState } from 'react';
import { ElectricityPrepaidToken } from '../types';
import { METERS_CATALOG } from '../data/meterCatalog';
import { SpreadsheetGrid, ColumnDef } from './SpreadsheetGrid';
import { formatNumber, formatKsh } from '../utils/calculations';
import { Image, Copy, Check, Receipt } from 'lucide-react';
import { PhotoViewerModal } from './PhotoViewerModal';

interface ElectricityPrepaidSectionProps {
  data: ElectricityPrepaidToken[];
  onAddRow: () => void;
  onDeleteRow: (id: string) => void;
}

export const ElectricityPrepaidSection: React.FC<
  ElectricityPrepaidSectionProps
> = ({ data, onAddRow, onDeleteRow }) => {
  const [selectedMeterFilter, setSelectedMeterFilter] = useState('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);

  const meterMap = new Map(METERS_CATALOG.map((m) => [m.id, m]));

  const filterOptions = METERS_CATALOG.filter(
    (m) => m.category === 'electricity_prepaid'
  ).map((m) => ({
    label: `${m.name} (#${m.meterNumber})`,
    value: m.id,
  }));

  const filteredData =
    selectedMeterFilter === 'all'
      ? data
      : data.filter((d) => d.meterId === selectedMeterFilter);

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(token.replace(/-/g, ''));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const columns: ColumnDef<ElectricityPrepaidToken>[] = [
    {
      key: 'date',
      header: 'Purchase Date',
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
      header: 'Prepaid Meter & Hardware #',
      sortValue: (r) => meterMap.get(r.meterId)?.name || '',
      render: (r) => {
        const meter = meterMap.get(r.meterId);
        return (
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 font-sans">
              {meter?.name || r.meterId}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Meter #: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{meter?.meterNumber}</span>
              <span className="text-slate-400 font-sans ml-1.5">· {meter?.location}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'tokenNumber',
      header: '20-Digit KPLC Token Code',
      width: '210px',
      render: (r) => (
        <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
          <span className="font-mono text-xs font-semibold tracking-wide text-slate-900 dark:text-slate-100 select-all">
            {r.tokenNumber}
          </span>
          <button
            onClick={() => copyToClipboard(r.tokenNumber)}
            className="p-0.5 text-slate-400 hover:text-emerald-600 transition-colors"
            title="Copy 20-digit token"
          >
            {copiedToken === r.tokenNumber ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ),
    },
    {
      key: 'tokenUnitsKwh',
      header: 'Units (kWh)',
      align: 'right',
      width: '120px',
      sortValue: (r) => r.tokenUnitsKwh,
      render: (r) => (
        <span className="font-bold text-emerald-700 dark:text-emerald-400">
          {formatNumber(r.tokenUnitsKwh, 1)} kWh
        </span>
      ),
    },
    {
      key: 'grossAmountKsh',
      header: 'Gross Paid (KSh)',
      align: 'right',
      width: '135px',
      sortValue: (r) => r.grossAmountKsh,
      render: (r) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {formatKsh(r.grossAmountKsh)}
        </span>
      ),
    },
    {
      key: 'netTokenAmountKsh',
      header: 'Net Token (KSh)',
      align: 'right',
      width: '130px',
      sortValue: (r) => r.netTokenAmountKsh,
      render: (r) => (
        <span className="text-slate-600 dark:text-slate-400">
          {formatKsh(r.netTokenAmountKsh)}
        </span>
      ),
    },
    {
      key: 'effectiveRateKshPerKwh',
      header: 'Unit Rate (KSh/kWh)',
      align: 'right',
      width: '140px',
      sortValue: (r) => r.effectiveRateKshPerKwh,
      render: (r) => (
        <span className="text-slate-700 dark:text-slate-300">
          KSh {formatNumber(r.effectiveRateKshPerKwh, 2)}
        </span>
      ),
    },
    {
      key: 'receipt',
      header: 'Receipt',
      align: 'center',
      width: '90px',
      render: (r) =>
        r.receiptPhotoUrl ? (
          <button
            onClick={() =>
              setPhotoViewer({
                url: r.receiptPhotoUrl!,
                title: `${meterMap.get(r.meterId)?.name} Token Receipt`,
                subtitle: `Purchase Date: ${r.date} · Units: ${r.tokenUnitsKwh} kWh · Paid: KSh ${r.grossAmountKsh}`,
              })
            }
            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded hover:bg-emerald-100"
          >
            <Receipt className="w-3 h-3" />
            <span>Slip</span>
          </button>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        ),
    },
    {
      key: 'notes',
      header: 'Reference & Notes',
      render: (r) => (
        <div className="font-sans text-xs text-slate-500 truncate max-w-xs">
          {r.notes || '—'}
        </div>
      ),
    },
  ];

  // Summary Row Calculations
  const totalUnits = filteredData.reduce((s, r) => s + r.tokenUnitsKwh, 0);
  const totalGross = filteredData.reduce((s, r) => s + r.grossAmountKsh, 0);
  const totalNet = filteredData.reduce((s, r) => s + r.netTokenAmountKsh, 0);
  const blendedRate = totalUnits > 0 ? totalGross / totalUnits : 0;

  const summaryRow = (
    <>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
        {formatNumber(totalUnits, 1)} kWh
      </td>
      <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100">
        {formatKsh(totalGross)}
      </td>
      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
        {formatKsh(totalNet)}
      </td>
      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
        avg KSh {formatNumber(blendedRate, 2)}
      </td>
      <td className="py-2.5 px-3"></td>
      <td className="py-2.5 px-3"></td>
    </>
  );

  return (
    <div className="space-y-4">
      <SpreadsheetGrid
        title="Prepaid KPLC Electricity Tokens (On Token Purchase)"
        subtitle="Tracking 7 prepaid meters across Naiposha, Naishola Grounds, Camp 2, GPF Office, Gathoni House, Camp 1 & Simos"
        data={filteredData}
        columns={columns}
        onAddRow={onAddRow}
        onDeleteRow={onDeleteRow}
        filterOptions={filterOptions}
        selectedFilter={selectedMeterFilter}
        onFilterChange={setSelectedMeterFilter}
        searchPlaceholder="Filter tokens or meter numbers..."
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
