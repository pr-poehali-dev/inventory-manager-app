import * as XLSX from 'xlsx';
import { InvoiceTemplate, InvElement, InvGridCell, generateId } from './store';

const PT_PX = 1.333;
const PAD_X = 20;
const PAD_Y = 20;

type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

function wchToPx(wch: number): number {
  if (wch <= 0) return 2;
  return Math.max(2, Math.round(wch * 7));
}

function colToPx(col: Record<string, unknown> | undefined, defaultPx: number): number {
  if (!col) return defaultPx;
  if (typeof col.wpx === 'number') return Math.max(2, Math.round(col.wpx));
  if (typeof col.wch === 'number') return wchToPx(col.wch);
  if (typeof col.width === 'number') return Math.max(2, Math.round((col.width as number) * 7));
  return defaultPx;
}

function rowToPx(row: Record<string, unknown> | undefined, defaultPx: number): number {
  if (!row) return defaultPx;
  if (typeof row.hpx === 'number') return Math.max(2, Math.round(row.hpx));
  if (typeof row.hpt === 'number') return Math.max(2, Math.round((row.hpt as number) * PT_PX));
  if (row.hidden) return 0;
  return defaultPx;
}

function findMerge(merges: MergeRange[], r: number, c: number): MergeRange | undefined {
  return merges.find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
}

function hasBorder(cell: XLSX.CellObject | undefined, side: 'top' | 'bottom' | 'left' | 'right'): boolean {
  if (!cell || !cell.s) return false;
  const s = cell.s as Record<string, unknown>;
  const border = s.border as Record<string, unknown> | undefined;
  if (!border) return false;
  const b = border[side] as Record<string, unknown> | undefined;
  return !!b && b.style !== undefined && b.style !== 'none';
}

function trimRange(
  range: XLSX.Range,
  ws: XLSX.WorkSheet
): { startR: number; endR: number; startC: number; endC: number } {
  let endC = range.e.c;
  let endR = range.e.r;

  while (endC > range.s.c) {
    let hasContent = false;
    for (let r = range.s.r; r <= endR; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: endC });
      const cell = ws[addr];
      if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        hasContent = true;
        break;
      }
    }
    if (hasContent) break;
    endC--;
  }

  while (endR > range.s.r) {
    let hasContent = false;
    for (let c = range.s.c; c <= endC; c++) {
      const addr = XLSX.utils.encode_cell({ r: endR, c });
      const cell = ws[addr];
      if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        hasContent = true;
        break;
      }
    }
    if (hasContent) break;
    endR--;
  }

  endC += 2;
  endR += 2;
  if (endC > range.e.c) endC = range.e.c;
  if (endR > range.e.r) endR = range.e.r;

  return { startR: range.s.r, endR, startC: range.s.c, endC };
}

export function excelToTemplate(buffer: ArrayBuffer, fileName: string): InvoiceTemplate {
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Пустой файл');

  const fullRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const merges: MergeRange[] = (ws['!merges'] || []) as MergeRange[];
  const rawCols = (ws['!cols'] || []) as (Record<string, unknown> | undefined)[];
  const rawRows = (ws['!rows'] || []) as (Record<string, unknown> | undefined)[];

  const sheetFormat = (ws as Record<string, unknown>)['!sheetformat'] as Record<string, unknown> | undefined;
  const defaultColWch = (sheetFormat?.defaultColWidth as number) || 8.43;
  const defaultRowHpt = (sheetFormat?.defaultRowHeight as number) || 15;
  const defaultColPx = wchToPx(defaultColWch);
  const defaultRowPx = Math.max(2, Math.round(defaultRowHpt * PT_PX));

  console.log('[Excel Import] sheetFormat:', sheetFormat);
  console.log('[Excel Import] defaults: col=' + defaultColPx + 'px, row=' + defaultRowPx + 'px');
  console.log('[Excel Import] fullRange:', fullRange.s.c + '-' + fullRange.e.c + ' cols, ' + fullRange.s.r + '-' + fullRange.e.r + ' rows');

  const { startR, endR, startC, endC } = trimRange(fullRange, ws);
  console.log('[Excel Import] trimmed:', startC + '-' + endC + ' cols, ' + startR + '-' + endR + ' rows');

  const maxMergeC = merges.reduce((m, mg) => Math.max(m, mg.e.c), endC);
  const maxMergeR = merges.reduce((m, mg) => Math.max(m, mg.e.r), endR);
  const finalEndC = Math.min(fullRange.e.c, Math.max(endC, maxMergeC));
  const finalEndR = Math.min(fullRange.e.r, Math.max(endR, maxMergeR));

  const gridCols: number[] = [];
  for (let c = startC; c <= finalEndC; c++) {
    gridCols.push(colToPx(rawCols[c], defaultColPx));
  }

  const gridRows: number[] = [];
  for (let r = startR; r <= finalEndR; r++) {
    gridRows.push(rowToPx(rawRows[r], defaultRowPx));
  }

  console.log('[Excel Import] gridCols (px):', gridCols);
  console.log('[Excel Import] gridRows (px):', gridRows);
  console.log('[Excel Import] final:', gridCols.reduce((a, b) => a + b, 0), 'x', gridRows.reduce((a, b) => a + b, 0));

  const skipSet = new Set<string>();
  merges.forEach(m => {
    for (let mr = m.s.r; mr <= m.e.r; mr++)
      for (let mc = m.s.c; mc <= m.e.c; mc++)
        if (mr !== m.s.r || mc !== m.s.c)
          skipSet.add(`${mr - startR}:${mc - startC}`);
  });

  const gridCells: InvGridCell[][] = [];
  for (let r = startR; r <= finalEndR; r++) {
    const row: InvGridCell[] = [];
    for (let c = startC; c <= finalEndC; c++) {
      const ri = r - startR;
      const ci = c - startC;

      if (skipSet.has(`${ri}:${ci}`)) {
        row.push({ text: '', skip: true });
        continue;
      }

      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      const text = cell ? (cell.w || (cell.v !== undefined && cell.v !== null ? String(cell.v) : '')) : '';

      let bold = false;
      let italic = false;
      let fontSize = 10;
      let align: 'left' | 'center' | 'right' = 'left';
      let valign: 'top' | 'middle' | 'bottom' = 'top';

      if (cell?.s) {
        const s = cell.s as Record<string, unknown>;
        const font = s.font as Record<string, unknown> | undefined;
        if (font) {
          if (font.bold) bold = true;
          if (font.italic) italic = true;
          if (font.sz) fontSize = Math.round(font.sz as number);
        }
        const alignment = s.alignment as Record<string, unknown> | undefined;
        if (alignment?.horizontal === 'center') align = 'center';
        if (alignment?.horizontal === 'right') align = 'right';
        if (alignment?.vertical === 'center') valign = 'middle';
        if (alignment?.vertical === 'bottom') valign = 'bottom';
      }

      const border = {
        top: hasBorder(cell, 'top'),
        right: hasBorder(cell, 'right'),
        bottom: hasBorder(cell, 'bottom'),
        left: hasBorder(cell, 'left'),
      };

      const merge = findMerge(merges, r, c);
      let colspan: number | undefined;
      let rowspan: number | undefined;
      if (merge && merge.s.r === r && merge.s.c === c) {
        const cs = merge.e.c - merge.s.c + 1;
        const rs = merge.e.r - merge.s.r + 1;
        if (cs > 1) colspan = cs;
        if (rs > 1) rowspan = rs;
      }

      row.push({
        text,
        bold: bold || undefined,
        italic: italic || undefined,
        fontSize: fontSize !== 10 ? fontSize : undefined,
        align: align !== 'left' ? align : undefined,
        valign: valign !== 'top' ? valign : undefined,
        border: (border.top || border.right || border.bottom || border.left) ? border : undefined,
        colspan,
        rowspan,
      });
    }
    gridCells.push(row);
  }

  const totalW = gridCols.reduce((a, b) => a + b, 0);
  const totalH = gridRows.reduce((a, b) => a + b, 0);

  const elements: InvElement[] = [{
    id: generateId(),
    type: 'grid',
    x: PAD_X,
    y: PAD_Y,
    w: totalW,
    h: totalH,
    gridCols,
    gridRows,
    gridCells,
  }];

  return {
    id: generateId(),
    name: fileName.replace(/\.\w+$/, ''),
    companyName: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    elements,
    canvasWidth: Math.max(1414, totalW + PAD_X * 2),
    canvasHeight: Math.max(1000, totalH + PAD_Y * 2),
  };
}
