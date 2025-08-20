
'use client'
import React from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface ResultsTableProps {
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

export function ResultsTable({ data, onRowClick }: ResultsTableProps) {

  const [colWidths, setColWidths] = React.useState<{ [key: string]: number }>({});
  const tableRef = React.useRef<HTMLTableElement>(null);
  const headers = data && data.length > 0 ? Object.keys(data[0]) : [];

  React.useEffect(() => {
    if (headers.length && Object.keys(colWidths).length === 0) {
      const initial: { [key: string]: number } = {};
      headers.forEach((h) => (initial[h] = 160));
      setColWidths(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers.join(','), colWidths]);

  if (!data || data.length === 0) {
    return <p className="p-4 text-center">The query returned no results.</p>;
  }

  // Drag logic
  const startResize = (header: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[header] || 160;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColWidths((prev) => ({ ...prev, [header]: Math.max(60, startWidth + delta) }));
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="overflow-auto">
      <Table ref={tableRef}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {headers.map((header) => (
              <TableHead
                key={header}
                style={{ width: colWidths[header] || 160, minWidth: 60, position: 'relative', paddingRight: 12 }}
                className="first:pl-6 lg:first:pl-8 last:pr-6 lg:last:pr-8 group"
              >
                <span>{header}</span>
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    height: '100%',
                    width: 8,
                    cursor: 'col-resize',
                    zIndex: 10,
                  }}
                  onMouseDown={(e) => startResize(header, e)}
                  className="hover:bg-muted/30 active:bg-muted/60"
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50 group')}
            >
              {headers.map((header) => (
                <TableCell
                  key={`${rowIndex}-${header}`}
                  style={{ width: colWidths[header] || 160, minWidth: 60 }}
                  className="first:pl-6 lg:first:pl-8 last:pr-6 lg:last:pr-8 text-xs text-muted-foreground group-hover:text-foreground min-w-[8rem]"
                >
                  <div className="text-xs font-mono w-fit max-w-96 truncate">
                    {JSON.stringify(row[header]).replace(/^"|"$/g, '')}
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
