import type { ColumnConfig, DataRow } from '../types';
import {
  getCellExportExcelValue,
  getCellExportString,
  getCellExportValue,
} from './getCellExportValue';

self.onmessage = async (e) => {
  const { type, rows, columns, action, id } = e.data;

  try {
    if (type === 'csv') {
      const headers = columns.map((c: ColumnConfig) => `"${c.label.replace(/"/g, '""')}"`).join(',');
      const csvRows = rows.map((row: DataRow) =>
        columns
          .map((col: ColumnConfig) => {
            const val = getCellExportString(col, row);
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(','),
      );
      const csvContent = '\uFEFF' + [headers, ...csvRows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      self.postMessage({ id, success: true, blob, filename: 'table_export.csv' });
    } 
    else if (type === 'excel') {
      const XLSX = await import('xlsx');
      const headers = columns.map((c: ColumnConfig) => c.label);
      const data = rows.map((row: DataRow) => columns.map((col: ColumnConfig) => getCellExportExcelValue(col, row)));
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      self.postMessage({ id, success: true, blob, filename: 'table_export.xlsx' });
    }
    else if (type === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF('landscape');
      const headers = ['Sr. No.', ...columns.map((c: ColumnConfig) => c.label)];
      const body = rows.map((row: DataRow, i: number) => [
        String(i + 1),
        ...columns.map((col: ColumnConfig) => getCellExportString(col, row)),
      ]);
      const columnStyles: Record<number, any> = {};
      columnStyles[0] = { cellWidth: 15 }; // Sr. No. column width
      columns.forEach((col: ColumnConfig, index: number) => {
        if (col.dataType === 'image' || col.dataType === 'link') {
          columnStyles[index + 1] = { cellWidth: 40 };
        }
      });

      autoTable(doc, {
        head: [headers],
        body,
        styles: { fontSize: 8, overflow: 'linebreak' },
        columnStyles,
        theme: 'grid',
        horizontalPageBreak: true,
        horizontalPageBreakRepeat: 0,
      });

      const blob = doc.output('blob');
      self.postMessage({ id, success: true, blob, filename: 'table_export.pdf', action });
    }
    else if (type === 'json') {
      const dataToExport = rows.map((row: DataRow) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col: ColumnConfig) => {
          obj[col.label] = getCellExportValue(col, row);
        });
        return obj;
      });
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      self.postMessage({ id, success: true, blob, filename: 'table_export.json' });
    }
  } catch (error) {
    self.postMessage({ id, success: false, error: (error as Error).message });
  }
};
