'use client';

import { ReactNode } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export default function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  onRowClick,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#C6CFD9]">
        {emptyMessage}
      </div>
    );
  }

  const getCellValue = (row: T, accessor: Column<T>['accessor']): ReactNode => {
    if (typeof accessor === 'function') {
      return accessor(row);
    }
    const value = row[accessor];
    return value !== null && value !== undefined ? String(value) : '-';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            {columns.map((column, index) => (
              <th
                key={index}
                className="px-4 py-3 text-left text-xs font-semibold text-[#C6CFD9] uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={`
                hover:bg-white/5 transition-colors
                ${onRowClick ? 'cursor-pointer' : ''}
              `}
            >
              {columns.map((column, index) => (
                <td
                  key={index}
                  className="px-4 py-3 text-sm text-white whitespace-nowrap"
                >
                  {getCellValue(row, column.accessor)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

