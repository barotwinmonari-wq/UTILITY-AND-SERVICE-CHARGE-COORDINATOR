import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Image,
  ArrowUpDown,
  Download,
  AlertCircle,
  Check,
} from 'lucide-react';
import { formatNumber, formatKsh } from '../utils/calculations';

export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (row: T, index: number) => React.ReactNode;
  sortValue?: (row: T) => number | string;
}

interface SpreadsheetGridProps<T extends { id: string }> {
  title: string;
  subtitle: string;
  data: T[];
  columns: ColumnDef<T>[];
  onAddRow: () => void;
  onDeleteRow: (id: string) => void;
  searchPlaceholder?: string;
  filterOptions?: { label: string; value: string }[];
  selectedFilter?: string;
  onFilterChange?: (val: string) => void;
  summaryRow?: React.ReactNode;
}

export function SpreadsheetGrid<T extends { id: string }>({
  title,
  subtitle,
  data,
  columns,
  onAddRow,
  onDeleteRow,
  searchPlaceholder = 'Search records...',
  filterOptions,
  selectedFilter,
  onFilterChange,
  summaryRow,
}: SpreadsheetGridProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Search filter
  const filteredData = useMemo(() => {
    let result = [...data];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((row) =>
        JSON.stringify(row).toLowerCase().includes(q)
      );
    }

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        result.sort((a, b) => {
          const valA = col.sortValue!(a);
          const valB = col.sortValue!(b);
          if (typeof valA === 'number' && typeof valB === 'number') {
            return sortAsc ? valA - valB : valB - valA;
          }
          return sortAsc
            ? String(valA).localeCompare(String(valB))
            : String(valB).localeCompare(String(valA));
        });
      }
    }

    return result;
  }, [data, searchQuery, sortKey, sortAsc, columns]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="p-3.5 sm:p-5 border-b border-slate-150 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>{title}</span>
            <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              {filteredData.length} records
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Meter selector filter */}
          {filterOptions && onFilterChange && (
            <select
              value={selectedFilter || 'all'}
              onChange={(e) => onFilterChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-hidden font-medium"
            >
              <option value="all">All Meters</option>
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Quick add row */}
          <button
            onClick={onAddRow}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Scroll Indicator Hint */}
      <div className="md:hidden px-4 py-1.5 bg-slate-50/80 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span>↔ Scroll table horizontally to view all fields &amp; photos</span>
        <span className="font-mono text-[10px] text-emerald-600 font-semibold">{columns.length} columns</span>
      </div>

      {/* Spreadsheet Table with Sticky Index Anchor */}
      <div className="overflow-x-auto w-full overscroll-x-contain">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold select-none">
              <th className="py-2.5 px-3 w-10 text-center font-mono text-[11px] text-slate-400 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortValue && handleSort(col.key)}
                  className={`py-2.5 px-3 whitespace-nowrap tracking-tight ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                  } ${
                    col.sortValue
                      ? 'cursor-pointer hover:text-slate-900 dark:hover:text-slate-200'
                      : ''
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-1 ${
                      col.align === 'right'
                        ? 'justify-end'
                        : col.align === 'center'
                          ? 'justify-center'
                          : 'justify-start'
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortValue && (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>
              ))}
              <th className="py-2.5 px-3 w-14 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="py-12 text-center text-slate-400 font-sans"
                >
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    No reading logs found
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try adjusting your search criteria or add the first row.
                  </p>
                  <button
                    onClick={onAddRow}
                    className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-emerald-600 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors font-sans"
                  >
                    + Log New Reading
                  </button>
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="py-2 px-3 text-center text-[11px] text-slate-400 font-mono sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.06)]">
                    {idx + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-2 px-3 ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      }`}
                    >
                      {col.render(row, idx)}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={() => onDeleteRow(row.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded transition-opacity"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {summaryRow && (
            <tfoot>
              <tr className="bg-slate-100/70 dark:bg-slate-800/70 border-t-2 border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-slate-100">
                <td className="py-2.5 px-3 text-center text-xs font-sans">
                  SUM
                </td>
                {summaryRow}
                <td className="py-2.5 px-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
