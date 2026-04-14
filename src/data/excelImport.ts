import * as XLSX from 'xlsx';
import { InvoiceTemplate, InvElement, generateId } from './store';

const COL_W = 64;
const ROW_H = 20;
const PAD_X = 30;
const PAD_Y = 20;

type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

function getMerge(merges: MergeRange[], r: number, c: number): MergeRange | undefined {
  return merges.find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
}

function isMergeOrigin(m: MergeRange, r: number, c: number) {
  return m.s.r === r && m.s.c === c;
}

export function excelToTemplate(buffer: ArrayBuffer, fileName: string): InvoiceTemplate {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Пустой файл');

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const merges: MergeRange[] = (ws['!merges'] || []) as MergeRange[];

  const colWidths: number[] = [];
  const customCols = ws['!cols'] || [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cw = customCols[c];
    colWidths[c] = cw && cw.wpx ? cw.wpx : cw && cw.wch ? cw.wch * 7 : COL_W;
  }

  const rowHeights: number[] = [];
  const customRows = ws['!rows'] || [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const rh = customRows[r];
    rowHeights[r] = rh && rh.hpx ? rh.hpx : rh && rh.hpt ? rh.hpt * 1.33 : ROW_H;
  }

  const colX: number[] = [];
  let cx = PAD_X;
  for (let c = range.s.c; c <= range.e.c; c++) {
    colX[c] = cx;
    cx += colWidths[c];
  }

  const rowY: number[] = [];
  let ry = PAD_Y;
  for (let r = range.s.r; r <= range.e.r; r++) {
    rowY[r] = ry;
    ry += rowHeights[r];
  }

  const elements: InvElement[] = [];
  const visited = new Set<string>();

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = `${r}:${c}`;
      if (visited.has(key)) continue;

      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];

      const merge = getMerge(merges, r, c);
      if (merge && !isMergeOrigin(merge, r, c)) {
        visited.add(key);
        continue;
      }

      let spanW = colWidths[c];
      let spanH = rowHeights[r];
      if (merge) {
        spanW = 0;
        for (let mc = merge.s.c; mc <= merge.e.c; mc++) spanW += colWidths[mc];
        spanH = 0;
        for (let mr = merge.s.r; mr <= merge.e.r; mr++) spanH += rowHeights[mr];
        for (let mr = merge.s.r; mr <= merge.e.r; mr++)
          for (let mc = merge.s.c; mc <= merge.e.c; mc++)
            visited.add(`${mr}:${mc}`);
      } else {
        visited.add(key);
      }

      if (!cell || cell.v === undefined || cell.v === null || String(cell.v).trim() === '') continue;

      const text = cell.w || String(cell.v);
      let bold = false;
      let italic = false;
      let fontSize = 10;
      let align: 'left' | 'center' | 'right' = 'left';

      if (cell.s) {
        const s = cell.s as Record<string, unknown>;
        const font = s.font as Record<string, unknown> | undefined;
        if (font) {
          if (font.bold) bold = true;
          if (font.italic) italic = true;
          if (font.sz) fontSize = font.sz as number;
        }
        const alignment = s.alignment as Record<string, unknown> | undefined;
        if (alignment?.horizontal === 'center') align = 'center';
        if (alignment?.horizontal === 'right') align = 'right';
      }

      elements.push({
        id: generateId(),
        type: 'text',
        x: colX[c],
        y: rowY[r],
        w: Math.max(spanW, 20),
        h: Math.max(spanH, 14),
        text,
        fontSize,
        bold,
        italic,
        align,
      });
    }
  }

  const totalW = cx + PAD_X;
  const totalH = ry + PAD_Y;

  return {
    id: generateId(),
    name: fileName.replace(/\.\w+$/, ''),
    companyName: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    elements,
    canvasWidth: Math.max(1414, totalW),
    canvasHeight: Math.max(1000, totalH),
  };
}
