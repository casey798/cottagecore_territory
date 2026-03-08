import { useState, useMemo, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  keyExtractor: (item: T) => string;
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 10,
  keyExtractor,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    const getValue = col.sortValue;
    return [...data].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#8B6914]/20">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-semibold text-[#3D2B1F] ${
                    col.sortable ? 'cursor-pointer select-none hover:text-[#D4A843]' : ''
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.header}
                  {sortKey === col.key && (sortDir === 'asc' ? ' ^' : ' v')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((item) => (
              <tr
                key={keyExtractor(item)}
                className="border-b border-[#8B6914]/10 hover:bg-[#D4A843]/10"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 text-[#3D2B1F]">
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-[#3D2B1F]/50"
                >
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-[#3D2B1F]/60">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded bg-[#8B6914] px-3 py-1 text-white disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded bg-[#8B6914] px-3 py-1 text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
