import * as XLSX from "xlsx";

export type ExportItem = {
  name: string;
  category: string;
  warehouse: string;
  location: string;
  quantity: number;
  unit: string;
  threshold: number;
};

export type ExportOperation = {
  date: string;
  item: string;
  type: string;
  quantity: number;
  from: string;
  to: string;
  performedBy: string;
  comment: string;
};

const ITEM_HEADERS: Record<keyof ExportItem, string> = {
  name: "Наименование",
  category: "Категория",
  warehouse: "Склад",
  location: "Локация",
  quantity: "Остаток",
  unit: "Ед.изм.",
  threshold: "Порог",
};

const OPERATION_HEADERS: Record<keyof ExportOperation, string> = {
  date: "Дата",
  item: "Товар",
  type: "Тип",
  quantity: "Количество",
  from: "Откуда",
  to: "Куда",
  performedBy: "Исполнитель",
  comment: "Комментарий",
};

function formatDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function autoColumnWidths(
  ws: XLSX.WorkSheet,
  data: Record<string, unknown>[],
  headers: Record<string, string>
): void {
  const keys = Object.keys(headers);
  const widths: number[] = keys.map((key) => {
    const headerLen = headers[key].length;
    const maxDataLen = data.reduce((max, row) => {
      const val = row[key];
      const len = val != null ? String(val).length : 0;
      return Math.max(max, len);
    }, 0);
    return Math.max(headerLen, maxDataLen) + 2;
  });
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

function renameHeaders<T extends Record<string, unknown>>(
  data: T[],
  headers: Record<keyof T, string>
): Record<string, unknown>[] {
  return data.map((row) => {
    const renamed: Record<string, unknown> = {};
    for (const key of Object.keys(headers) as (keyof T)[]) {
      renamed[headers[key]] = row[key] ?? "";
    }
    return renamed;
  });
}

function saveWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}

export function exportItemsToExcel(
  items: ExportItem[],
  filename?: string
): void {
  const renamed = renameHeaders(items, ITEM_HEADERS);
  const ws = XLSX.utils.json_to_sheet(renamed);
  autoColumnWidths(ws, items, ITEM_HEADERS);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Товары");

  saveWorkbook(wb, filename ?? `Остатки_${formatDate()}.xlsx`);
}

export function exportOperationsToExcel(
  operations: ExportOperation[],
  filename?: string
): void {
  const renamed = renameHeaders(operations, OPERATION_HEADERS);
  const ws = XLSX.utils.json_to_sheet(renamed);
  autoColumnWidths(ws, operations, OPERATION_HEADERS);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Операции");

  saveWorkbook(wb, filename ?? `Операции_${formatDate()}.xlsx`);
}

export function exportInventoryReport(
  items: ExportItem[],
  operations: ExportOperation[],
  filename?: string
): void {
  const wb = XLSX.utils.book_new();

  // --- Items sheet ("Остатки") with summary row ---
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const summaryRow: ExportItem = {
    name: "ИТОГО",
    category: "",
    warehouse: "",
    location: "",
    quantity: totalQuantity,
    unit: "",
    threshold: 0,
  };
  const itemsWithSummary = [...items, summaryRow];

  const renamedItems = renameHeaders(itemsWithSummary, ITEM_HEADERS);
  const wsItems = XLSX.utils.json_to_sheet(renamedItems);
  autoColumnWidths(wsItems, itemsWithSummary, ITEM_HEADERS);
  XLSX.utils.book_append_sheet(wb, wsItems, "Остатки");

  // --- Operations sheet ("Движения") ---
  const renamedOps = renameHeaders(operations, OPERATION_HEADERS);
  const wsOps = XLSX.utils.json_to_sheet(renamedOps);
  autoColumnWidths(wsOps, operations, OPERATION_HEADERS);
  XLSX.utils.book_append_sheet(wb, wsOps, "Движения");

  saveWorkbook(wb, filename ?? `Отчёт_${formatDate()}.xlsx`);
}

const exportExcel = {
  exportItemsToExcel,
  exportOperationsToExcel,
  exportInventoryReport,
};

export default exportExcel;
