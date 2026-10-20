import type { ColumnConfig, DataRow } from '../types';
import { getCellExportString } from './getCellExportValue';
import ExportWorker from './export.worker?worker';

const worker = new ExportWorker();
let messageId = 0;

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function runWorkerTask(type: string, rows: DataRow[], columns: ColumnConfig[], action?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    
    const onMessage = (e: MessageEvent) => {
      if (e.data.id === id) {
        worker.removeEventListener('message', onMessage);
        
        if (e.data.success) {
          if (type === 'pdf' && e.data.action === 'print') {
             const url = URL.createObjectURL(e.data.blob);
             const iframe = document.createElement('iframe');
             iframe.style.display = 'none';
             iframe.src = url;
             document.body.appendChild(iframe);
             iframe.onload = () => {
               setTimeout(() => {
                 iframe.contentWindow?.print();
               }, 150);
             };
          } else {
             downloadBlob(e.data.blob, e.data.filename);
          }
          resolve();
        } else {
          console.error(e.data.error);
          alert(`Failed to export to ${type.toUpperCase()}.`);
          reject(new Error(e.data.error));
        }
      }
    };
    
    worker.addEventListener('message', onMessage);
    worker.postMessage({ type, rows, columns, action, id });
  });
}

export function exportToCSV(rows: DataRow[], columns: ColumnConfig[]) {
  if (rows.length === 0) return Promise.resolve();
  return runWorkerTask('csv', rows, columns);
}

export function exportToExcel(rows: DataRow[], columns: ColumnConfig[]) {
  if (rows.length === 0) return Promise.resolve();
  return runWorkerTask('excel', rows, columns);
}

export function exportToPDF(
  rows: DataRow[],
  columns: ColumnConfig[],
  action: 'save' | 'print' = 'save'
) {
  if (rows.length === 0) return Promise.resolve();
  return runWorkerTask('pdf', rows, columns, action);
}

export function exportToJSON(rows: DataRow[], columns: ColumnConfig[]) {
  if (rows.length === 0) return Promise.resolve();
  return runWorkerTask('json', rows, columns);
}

export function copyToClipboardTSV(rows: DataRow[], columns: ColumnConfig[]) {
  if (rows.length === 0) return;

  const headers = columns.map(c => c.label).join('\t');
  const tsvRows = rows.map(row =>
    columns
      .map(col => getCellExportString(col, row).replace(/\t|\n|\r/g, ' '))
      .join('\t'),
  );

  navigator.clipboard
    .writeText([headers, ...tsvRows].join('\n'))
    .then(() =>
      alert('Table copied to clipboard! You can now paste it directly into Excel or Google Sheets.'),
    )
    .catch(() => alert('Failed to copy to clipboard.'));
}

export function handlePrint() {
  window.print();
}
