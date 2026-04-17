import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { InvoiceTemplate, InvElement, WorkOrder, AppState } from '@/data/store';

type Props = {
  template: InvoiceTemplate;
  order: WorkOrder;
  state: AppState;
  onClose: () => void;
};

function resolveSource(source: string, order: WorkOrder, state: AppState, tpl: InvoiceTemplate): string {
  const now = new Date();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const wh = (state.warehouses || [])[0];
  const map: Record<string, string> = {
    '{{number}}': order.number,
    '{{date}}': `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} г.`,
    '{{recipient}}': order.recipientName || '',
    '{{receiverRank}}': order.receiverRank || '',
    '{{receiverName}}': order.receiverName || '',
    '{{institution}}': wh?.institution || tpl.companyName || '',
    '{{senderDept}}': wh?.senderDept || wh?.name || '',
    '{{issuerRank}}': wh?.issuerRank || '',
    '{{issuerName}}': wh?.issuerName || '',
    '{{approverRole}}': wh?.approverRole || tpl.signatoryRole || '',
    '{{approverName}}': wh?.approverName || tpl.signatory || '',
    '{{signatory}}': wh?.approverName || tpl.signatory || '',
    '{{signatoryRole}}': wh?.approverRole || tpl.signatoryRole || '',
  };
  return map[source] || '';
}

const OKEI_CODES: Record<string, string> = {
  'шт': '796', 'шт.': '796', 'штука': '796', 'штуки': '796',
  'кг': '166', 'кг.': '166', 'килограмм': '166',
  'г': '163', 'г.': '163', 'грамм': '163',
  'т': '168', 'т.': '168', 'тонна': '168',
  'л': '112', 'л.': '112', 'литр': '112',
  'мл': '111', 'мл.': '111',
  'м': '006', 'м.': '006', 'метр': '006',
  'см': '004', 'см.': '004',
  'мм': '003', 'мм.': '003',
  'м2': '055', 'кв.м': '055',
  'м3': '113', 'куб.м': '113',
  'упак': '778', 'упак.': '778', 'упаковка': '778',
  'компл': '839', 'компл.': '839', 'комплект': '839',
  'пара': '715',
  'рулон': '736',
  'пачка': '728',
};

function resolveItemSource(source: string, oi: WorkOrder['items'][0], state: AppState): string {
  const it = state.items.find(i => i.id === oi.itemId);
  const unit = (it?.unit || 'шт.').trim();
  const unitLower = unit.toLowerCase();
  const unitCode = OKEI_CODES[unitLower] || OKEI_CODES[unitLower.replace('.', '')] || '';
  const map: Record<string, string> = {
    '{{item.name}}': it?.name || '',
    '{{item.unit}}': unit,
    '{{item.unitCode}}': unitCode,
    '{{item.qtyReq}}': String(oi.requiredQty),
    '{{item.qtyRel}}': String(oi.pickedQty),
    '{{item.price}}': '',
    '{{item.sum}}': '',
    '{{item.note}}': '',
    '{{item.nomenNum}}': '',
    '{{item.debit}}': '',
    '{{item.credit}}': '',
  };
  return map[source] || '';
}

export default function InvoiceFiller({ template, order, state, onClose }: Props) {
  const elements = template.elements || [];
  const CW = template.canvasWidth || 1414;
  const CH = template.canvasHeight || 1000;

  const initValues = (): Record<string, string> => {
    const v: Record<string, string> = {};
    elements.forEach(el => {
      if (el.type === 'text') {
        v[el.id] = el.source ? resolveSource(el.source, order, state, template) : (el.text || '');
      }
      if (el.type === 'frame' && el.frameLabel) {
        v[`frame_${el.id}`] = el.frameLabel;
      }
    });
    return v;
  };

  const initTableValues = (): Record<string, string[][]> => {
    const v: Record<string, string[][]> = {};
    elements.filter(el => el.type === 'table').forEach(el => {
      const cols = el.columns || [];
      const rows = order.items.map(oi => cols.map(c => c.source ? resolveItemSource(c.source, oi, state) : ''));
      v[el.id] = rows;
    });
    return v;
  };

  const [values, setValues] = useState(initValues);
  const [tableValues, setTableValues] = useState(initTableValues);
  const [editing, setEditing] = useState(true);
  const [zoom, setZoom] = useState(0.7);

  useEffect(() => {
    setTableValues(prev => {
      const next: Record<string, string[][]> = { ...prev };
      elements.filter(el => el.type === 'table').forEach(el => {
        const cols = el.columns || [];
        const existing = prev[el.id] || [];
        const rows = order.items.map((oi, idx) => {
          const autoRow = cols.map(c => c.source ? resolveItemSource(c.source, oi, state) : '');
          const prevRow = existing[idx];
          if (!prevRow) return autoRow;
          return autoRow.map((auto, ci) => {
            const prevCell = prevRow[ci] ?? '';
            const prevAuto = cols[ci]?.source ? resolveItemSource(cols[ci].source!, oi, state) : '';
            return prevCell && prevCell !== prevAuto ? prevCell : auto;
          });
        });
        next[el.id] = rows;
      });
      return next;
    });
  }, [order.items, state.items]);

  useEffect(() => {
    setValues(prev => {
      const next: Record<string, string> = { ...prev };
      elements.forEach(el => {
        if (el.type !== 'text') return;
        if (!el.source) {
          if (next[el.id] === undefined) next[el.id] = el.text || '';
          return;
        }
        const auto = resolveSource(el.source, order, state, template);
        const prevVal = prev[el.id];
        if (prevVal === undefined || prevVal === '' || !prevVal) {
          next[el.id] = auto;
        } else if (auto && prevVal !== auto) {
          next[el.id] = auto;
        }
      });
      return next;
    });
  }, [state.warehouses, state.items, order.number, order.recipientName, order.receiverRank, order.receiverName, template.companyName, template.signatory, template.signatoryRole]);

  const updVal = (id: string, v: string) => setValues(prev => ({ ...prev, [id]: v }));
  const updCell = (tid: string, ri: number, ci: number, v: string) => {
    setTableValues(prev => {
      const rows = [...(prev[tid] || [])];
      rows[ri] = [...(rows[ri] || [])];
      rows[ri][ci] = v;
      return { ...prev, [tid]: rows };
    });
  };

  const addRow = (tid: string) => {
    const el = elements.find(e => e.id === tid);
    const colsCount = el?.columns?.length || 0;
    setTableValues(prev => ({ ...prev, [tid]: [...(prev[tid] || []), Array(colsCount).fill('')] }));
  };

  const removeRow = (tid: string, ri: number) => {
    setTableValues(prev => ({ ...prev, [tid]: (prev[tid] || []).filter((_, i) => i !== ri) }));
  };

  const handlePrint = () => {
    const serif = "'Times New Roman', serif";
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Накладная ${order.number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:${serif};position:relative;width:${CW}px;height:${CH}px;padding:0}
.el{position:absolute}.tbl{border-collapse:collapse;width:100%}.tbl th,.tbl td{border:1px solid #000;padding:2pt 4pt;font-size:9pt}
@media print{@page{size:landscape;margin:6mm}body{width:100%;height:auto}}</style></head><body>`;

    elements.forEach(el => {
      if (el.type === 'text') {
        const val = values[el.id] || '';
        html += `<div class="el" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;font-size:${el.fontSize || 12}px;font-weight:${el.bold ? 'bold' : 'normal'};font-style:${el.italic ? 'italic' : 'normal'};text-align:${el.align || 'left'};line-height:1.3">${val}</div>`;
      }
      if (el.type === 'table') {
        const cols = el.columns || [];
        const rows = tableValues[el.id] || [];
        const totals = cols.map((_, ci) => {
          const nums = rows.map(r => parseFloat(r[ci]) || 0);
          const allNum = rows.length > 0 && rows.every(r => r[ci] === '' || !isNaN(parseFloat(r[ci])));
          return allNum && nums.some(n => n > 0) ? nums.reduce((a, b) => a + b, 0) : null;
        });
        html += `<div class="el" style="left:${el.x}px;top:${el.y}px;width:${el.w}px"><table class="tbl"><thead><tr>`;
        cols.forEach(c => { html += `<th style="width:${c.width}px;text-align:center;font-size:8pt">${c.label}</th>`; });
        html += `</tr></thead><tbody>`;
        rows.forEach(r => {
          html += '<tr>';
          r.forEach((v, ci) => { html += `<td style="text-align:${ci === 0 ? 'left' : 'center'}">${v}</td>`; });
          html += '</tr>';
        });
        const hasTotals = totals.some(t => t !== null);
        if (hasTotals) {
          html += '<tr style="font-weight:bold">';
          totals.forEach((t, ci) => { html += `<td style="text-align:${ci === 0 ? 'right' : 'center'}">${ci === 0 ? 'Итого' : (t !== null ? t : '')}</td>`; });
          html += '</tr>';
        }
        html += '</tbody></table></div>';
      }
      if (el.type === 'line') {
        const bdr = el.vertical ? `border-left:${el.lineWidth || 1}px solid #000` : `border-top:${el.lineWidth || 1}px solid #000`;
        html += `<div class="el" style="left:${el.x}px;top:${el.y}px;width:${el.vertical ? (el.lineWidth || 1) : el.w}px;height:${el.vertical ? el.h : (el.lineWidth || 1)}px;${bdr}"></div>`;
      }
      if (el.type === 'frame') {
        html += `<div class="el" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;border:1px solid #000;padding:4px">`;
        if (el.frameLabel) html += `<div style="text-align:center;font-weight:bold;font-size:9pt">${el.frameLabel}</div>`;
        html += '</div>';
      }
      if (el.type === 'grid' && el.gridCells && el.gridCols && el.gridRows) {
        const tw = el.gridCols.reduce((a, b) => a + b, 0);
        html += `<div class="el" style="left:${el.x}px;top:${el.y}px"><table style="border-collapse:collapse;table-layout:fixed;width:${tw}px;font-size:10pt">`;
        html += '<colgroup>';
        el.gridCols.forEach(w => { html += `<col style="width:${w}px">`; });
        html += '</colgroup><tbody>';
        el.gridCells.forEach((row, ri) => {
          html += `<tr style="height:${el.gridRows![ri]}px">`;
          row.forEach(cell => {
            if (cell.skip) return;
            const bd = cell.border;
            const bt = bd?.top ? '1px solid #000' : 'none';
            const br = bd?.right ? '1px solid #000' : 'none';
            const bb = bd?.bottom ? '1px solid #000' : 'none';
            const bl = bd?.left ? '1px solid #000' : 'none';
            const cs = cell.colspan ? ` colspan="${cell.colspan}"` : '';
            const rs = cell.rowspan ? ` rowspan="${cell.rowspan}"` : '';
            html += `<td${cs}${rs} style="font-size:${cell.fontSize || 10}pt;font-weight:${cell.bold ? 'bold' : 'normal'};font-style:${cell.italic ? 'italic' : 'normal'};text-align:${cell.align || 'left'};vertical-align:${cell.valign || 'top'};border-top:${bt};border-right:${br};border-bottom:${bb};border-left:${bl};padding:1px 3px;overflow:hidden;white-space:pre-wrap;word-break:break-word;line-height:1.2">${cell.text}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }
    });

    html += '</body></html>';
    const w = window.open('', '_blank');
    if (!w) return;
    const docTitle = `Накладная ${order.number}`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    try { w.document.title = docTitle; } catch { /* noop */ }
    setTimeout(() => { try { w.document.title = docTitle; } catch { /* noop */ } w.print(); }, 350);
  };

  const renderElement = (el: InvElement) => {
    if (el.type === 'text') {
      const val = values[el.id] || '';
      const isEmpty = !val && !el.source;
      return (
        <div key={el.id} className="absolute" style={{ left: el.x, top: el.y, width: el.w, fontFamily: "'Times New Roman', serif", fontSize: el.fontSize, fontWeight: el.bold ? 'bold' : 'normal', fontStyle: el.italic ? 'italic' : 'normal', textAlign: el.align || 'left', lineHeight: 1.3, minHeight: el.h }}>
          {editing ? (
            <input value={val} onChange={e => updVal(el.id, e.target.value)}
              className="invoice-input-underline w-full bg-transparent border-b border-transparent outline-none px-0.5 focus:border-gray-400"
              style={{ fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit', textAlign: 'inherit' }} />
          ) : (
            <span className="border-b border-black inline-block w-full" style={{ minHeight: '1.1em' }}>{val || '\u00A0'}</span>
          )}
        </div>
      );
    }

    if (el.type === 'table') {
      const cols = el.columns || [];
      const rows = tableValues[el.id] || [];
      const totals = cols.map((_, ci) => {
        const nums = rows.map(r => parseFloat(r[ci]) || 0);
        const allNum = rows.length > 0 && rows.every(r => r[ci] === '' || !isNaN(parseFloat(r[ci])));
        return allNum && nums.some(n => n > 0) ? nums.reduce((a, b) => a + b, 0) : null;
      });
      return (
        <div key={el.id} className="absolute" style={{ left: el.x, top: el.y, width: el.w }}>
          <table className="w-full border-collapse" style={{ fontFamily: "'Times New Roman', serif", fontSize: 9, border: '1px solid #000' }}>
            <thead>
              <tr>{cols.map(c => <th key={c.key} className="border border-black px-1 py-0.5 text-center" style={{ width: c.width, fontSize: 8 }}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="group relative">
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-black px-1 py-0.5 relative">
                      {editing ? (
                        <input value={cell} onChange={e => updCell(el.id, ri, ci, e.target.value)}
                          className="invoice-input w-full bg-transparent border-0 outline-none text-center px-0"
                          style={{ fontSize: 'inherit', fontFamily: 'inherit' }} />
                      ) : (
                        <span className="block text-center">{cell || '\u00A0'}</span>
                      )}
                      {editing && ci === row.length - 1 && (
                        <button
                          onClick={() => removeRow(el.id, ri)}
                          className="invoice-row-del absolute -right-6 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Удалить строку"
                        >×</button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {totals.some(t => t !== null) && (
                <tr className="font-bold">
                  {totals.map((t, ci) => (
                    <td key={ci} className="border border-black px-1 py-0.5 text-center">{ci === 0 ? 'Итого' : (t !== null ? t : '')}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
          {editing && (
            <button
              onClick={() => addRow(el.id)}
              className="invoice-add-row mt-1 w-full py-1 text-xs border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 rounded"
            >+ Добавить строку</button>
          )}
        </div>
      );
    }

    if (el.type === 'line') {
      return (
        <div key={el.id} className="absolute" style={{ left: el.x, top: el.y, width: el.vertical ? (el.lineWidth || 1) : el.w, height: el.vertical ? el.h : (el.lineWidth || 1) }}>
          <div className="w-full h-full" style={{ borderTop: el.vertical ? 'none' : `${el.lineWidth || 1}px solid #000`, borderLeft: el.vertical ? `${el.lineWidth || 1}px solid #000` : 'none' }} />
        </div>
      );
    }

    if (el.type === 'frame') {
      return (
        <div key={el.id} className="absolute" style={{ left: el.x, top: el.y, width: el.w, height: el.h, border: `1px solid #000`, padding: 4 }}>
          {el.frameLabel && <div className="text-center font-bold" style={{ fontFamily: "'Times New Roman', serif", fontSize: 9 }}>{el.frameLabel}</div>}
        </div>
      );
    }

    if (el.type === 'grid' && el.gridCells && el.gridCols && el.gridRows) {
      return (
        <div key={el.id} className="absolute" style={{ left: el.x, top: el.y }}>
          <table className="border-collapse" style={{ fontFamily: "'Times New Roman', serif", fontSize: 10, tableLayout: 'fixed', width: el.gridCols.reduce((a, b) => a + b, 0) }}>
            <colgroup>
              {el.gridCols.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <tbody>
              {el.gridCells.map((row, ri) => (
                <tr key={ri} style={{ height: el.gridRows![ri] }}>
                  {row.map((cell, ci) => {
                    if (cell.skip) return null;
                    const bd = cell.border;
                    return (
                      <td key={ci}
                        colSpan={cell.colspan}
                        rowSpan={cell.rowspan}
                        style={{
                          fontSize: cell.fontSize || 10,
                          fontWeight: cell.bold ? 'bold' : 'normal',
                          fontStyle: cell.italic ? 'italic' : 'normal',
                          textAlign: cell.align || 'left',
                          verticalAlign: cell.valign || 'top',
                          borderTop: bd?.top ? '1px solid #000' : '1px solid transparent',
                          borderRight: bd?.right ? '1px solid #000' : '1px solid transparent',
                          borderBottom: bd?.bottom ? '1px solid #000' : '1px solid transparent',
                          borderLeft: bd?.left ? '1px solid #000' : '1px solid transparent',
                          padding: '1px 3px',
                          overflow: 'hidden',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.2,
                        }}>
                        {cell.text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col bg-gray-200 overflow-hidden">
      <style>{`@media print {
        .invoice-toolbar, .invoice-row-del, .invoice-add-row { display: none !important; }
        .invoice-input { border: none !important; background: transparent !important; box-shadow: none !important; }
        .invoice-input-underline { border-bottom: 1px solid #000 !important; background: transparent !important; }
      }`}</style>
      <div className="invoice-toolbar flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-300 shrink-0" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5"><Icon name="ArrowLeft" size={14} />Назад</Button>
        <span className="text-sm font-medium">{template.name} — {'\u2116'}{order.number}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}><Icon name="ZoomOut" size={14} /></Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}><Icon name="ZoomIn" size={14} /></Button>
        </div>
        <Button variant={editing ? 'default' : 'outline'} size="sm" onClick={() => setEditing(p => !p)} className="gap-1.5">
          <Icon name={editing ? 'Eye' : 'Pencil'} size={14} />{editing ? 'Просмотр' : 'Редактировать'}
        </Button>
        <Button size="sm" onClick={handlePrint} className="gap-1.5"><Icon name="Printer" size={14} />Печать</Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white mx-auto shadow-lg border border-gray-300 relative" style={{ width: CW * zoom, height: CH * zoom }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: CW, height: CH, position: 'relative' }}>
            {elements.map(renderElement)}
          </div>
        </div>
      </div>
    </div>
  );
}