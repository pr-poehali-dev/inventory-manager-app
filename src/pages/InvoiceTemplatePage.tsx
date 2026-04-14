import { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { AppState } from '@/data/store';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'invoice_template_data';

interface InvoiceRow {
  name: string;
  nomNumber: string;
  passport: string;
  unit: string;
  okeiCode: string;
  price: number;
  qtyRequested: number;
  qtyReleased: number;
  debit: string;
  credit: string;
  note: string;
}

interface FormData {
  invoiceNumber: string;
  invoiceDate: string;
  institution: string;
  senderDivision: string;
  receiverDivision: string;
  okeiCode: string;
  requestedByRank: string;
  requestedByName: string;
  approvedByPosition: string;
  approvedByName: string;
  rows: InvoiceRow[];
  releasedByRank: string;
  releasedByName: string;
  releasedByDate: string;
  responsiblePosition: string;
  responsibleName: string;
  responsibleDate: string;
  accountingJournalPeriod: string;
  accountingExecutorPosition: string;
  accountingExecutorName: string;
  accountingDate: string;
  receivedByRank: string;
  receivedByName: string;
  receivedByDate: string;
  okudCode: string;
  okpoCode: string;
  headerDate: string;
}

function formatTodayRussian(): string {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г.`;
}

function emptyRow(): InvoiceRow {
  return {
    name: '',
    nomNumber: '',
    passport: '',
    unit: 'шт.',
    okeiCode: '',
    price: 0,
    qtyRequested: 0,
    qtyReleased: 0,
    debit: '',
    credit: '',
    note: '',
  };
}

function defaultFormData(): FormData {
  return {
    invoiceNumber: '22-ЧТ',
    invoiceDate: formatTodayRussian(),
    institution: '',
    senderDivision: '',
    receiverDivision: '',
    okeiCode: '383',
    requestedByRank: '',
    requestedByName: '',
    approvedByPosition: '',
    approvedByName: '',
    rows: Array.from({ length: 11 }, () => emptyRow()),
    releasedByRank: '',
    releasedByName: '',
    releasedByDate: '',
    responsiblePosition: '',
    responsibleName: '',
    responsibleDate: '',
    accountingJournalPeriod: '',
    accountingExecutorPosition: '',
    accountingExecutorName: '',
    accountingDate: '',
    receivedByRank: 'лейтенант',
    receivedByName: '',
    receivedByDate: '',
    okudCode: '0504204',
    okpoCode: '',
    headerDate: '',
  };
}

interface Props {
  state: AppState;
  onStateChange: (s: AppState) => void;
}

export default function InvoiceTemplatePage({ state, onStateChange }: Props) {
  void state;
  void onStateChange;

  const [form, setForm] = useState<FormData>(defaultFormData);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FormData;
        setForm(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateRow = useCallback((index: number, key: keyof InvoiceRow, value: string | number) => {
    setForm(prev => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      return { ...prev, rows };
    });
  }, []);

  const addRow = useCallback(() => {
    setForm(prev => ({ ...prev, rows: [...prev.rows, emptyRow()] }));
  }, []);

  const removeRow = useCallback((index: number) => {
    setForm(prev => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index),
    }));
  }, []);

  const totals = useMemo(() => {
    let qtyRequested = 0;
    let qtyReleased = 0;
    let sum = 0;
    for (const r of form.rows) {
      qtyRequested += Number(r.qtyRequested) || 0;
      qtyReleased += Number(r.qtyReleased) || 0;
      sum += (Number(r.price) || 0) * (Number(r.qtyReleased) || 0);
    }
    return { qtyRequested, qtyReleased, sum };
  }, [form.rows]);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  };

  const handleClear = () => {
    setForm(defaultFormData());
    localStorage.removeItem(STORAGE_KEY);
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const rowsHtml = form.rows
      .map((r, i) => {
        const sum = (Number(r.price) || 0) * (Number(r.qtyReleased) || 0);
        return `<tr>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;">${i + 1}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;">${r.name}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;">${r.nomNumber}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;">${r.passport}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;">${r.unit}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;">${r.okeiCode}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:right;">${r.price || ''}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;">${r.qtyRequested || ''}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;">${r.qtyReleased || ''}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:right;">${sum ? sum.toFixed(2) : ''}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;">${r.debit}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;">${r.credit}</td>
          <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;">${r.note}</td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Требование-накладная №${form.invoiceNumber}</title>
<style>
  @page { size: landscape; margin: 6mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10pt; }
  table.main { border-collapse: collapse; width: 100%; }
  table.main th, table.main td { border: 1px solid #000; padding: 2px 4px; font-size: 9pt; }
  table.main th { font-weight: normal; text-align: center; }
  .codes-table { border-collapse: collapse; float: right; }
  .codes-table td { border: 1px solid #000; padding: 1px 6px; font-size: 8pt; text-align: center; }
  .underline-input { border-bottom: 1px solid #000; min-width: 100px; display: inline-block; padding: 0 4px; }
  .sign-line { display: inline-block; border-bottom: 1px solid #000; min-width: 120px; text-align: center; }
  .small-label { font-size: 7pt; text-align: center; display: block; }
</style>
</head>
<body>
<div style="position:relative;">
  <table class="codes-table" style="position:absolute;right:0;top:0;">
    <tr><td colspan="2" style="font-size:8pt;">Коды</td></tr>
    <tr><td style="text-align:left;">Форма по ОКУД</td><td>${form.okudCode}</td></tr>
    <tr><td style="text-align:left;">Дата</td><td>${form.headerDate}</td></tr>
    <tr><td style="text-align:left;">по ОКПО</td><td>${form.okpoCode}</td></tr>
  </table>
  <div style="text-align:center;margin-top:10px;">
    <b style="font-size:12pt;">ТРЕБОВАНИЕ-НАКЛАДНАЯ № ${form.invoiceNumber}</b><br>
    <span>от ${form.invoiceDate}</span>
  </div>
</div>
<div style="margin-top:12px;">
  <div style="margin-bottom:4px;">Учреждение: <span class="underline-input" style="width:90%;">${form.institution}</span></div>
  <div style="margin-bottom:4px;">Структурное подразделение — отправитель: <span class="underline-input" style="width:70%;">${form.senderDivision}</span></div>
  <div style="margin-bottom:4px;">Структурное подразделение — получатель: <span class="underline-input" style="width:70%;">${form.receiverDivision}</span></div>
  <div style="margin-bottom:4px;">Единица измерения: руб. (с точностью до второго десятичного знака) <span style="float:right;">по ОКЕИ <span class="underline-input">${form.okeiCode}</span></span></div>
</div>
<div style="margin-top:8px;margin-bottom:8px;display:flex;gap:20px;flex-wrap:wrap;">
  <div>Затребовал <span class="sign-line">${form.requestedByRank}</span> <span class="small-label">(звание)</span> <span class="sign-line"></span> <span class="small-label">(подпись)</span> <span class="sign-line">${form.requestedByName}</span> <span class="small-label">(Фамилия, инициалы)</span></div>
  <div style="margin-top:4px;">Разрешил НЦ (БнС) <span class="sign-line">${form.approvedByPosition}</span> <span class="small-label">(должность)</span> <span class="sign-line"></span> <span class="small-label">(подпись)</span> <span class="sign-line">${form.approvedByName}</span> <span class="small-label">(расшифровка подписи)</span></div>
</div>
<table class="main" style="margin-top:4px;">
  <thead>
    <tr>
      <th rowspan="2" style="width:3%;">№ п/п</th>
      <th colspan="3">Материальные ценности</th>
      <th rowspan="2" style="width:5%;">номер</th>
      <th colspan="2">Единица измерения</th>
      <th rowspan="2" style="width:6%;">Цена</th>
      <th colspan="2">Количество</th>
      <th rowspan="2" style="width:8%;">Сумма<br>(без НДС)</th>
      <th colspan="2">Корреспондирующие счета</th>
      <th rowspan="2" style="width:8%;">Примечание</th>
    </tr>
    <tr>
      <th>наименование</th>
      <th>номенкл.</th>
      <th>паспорта (иной)</th>
      <th>наименование</th>
      <th>код по ОКЕИ</th>
      <th>затребовано</th>
      <th>отпущено</th>
      <th>дебет</th>
      <th>кредит</th>
    </tr>
    <tr>
      <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th><th>13</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    <tr>
      <td colspan="7" style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:right;font-weight:bold;">Итого</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;font-weight:bold;">${totals.qtyRequested || ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:center;font-weight:bold;">${totals.qtyReleased || ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;text-align:right;font-weight:bold;">${totals.sum ? totals.sum.toFixed(2) : ''}</td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;"></td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;"></td>
      <td style="border:1px solid #000;padding:2px 4px;font-size:9pt;"></td>
    </tr>
  </tbody>
</table>
<div style="margin-top:14px;display:flex;gap:14px;">
  <div style="flex:1;">
    <div style="margin-bottom:4px;font-weight:bold;">Отпустил</div>
    <div>(звание) <span class="sign-line">${form.releasedByRank}</span> (подпись) <span class="sign-line"></span> (расшифровка подписи) <span class="sign-line">${form.releasedByName}</span></div>
    <div style="margin-top:4px;">${form.releasedByDate}</div>
  </div>
  <div style="flex:1;">
    <div style="margin-bottom:4px;font-weight:bold;">Ответственный исполнитель</div>
    <div>(должность) <span class="sign-line">${form.responsiblePosition}</span> (подпись) <span class="sign-line"></span> (расш. подп.) <span class="sign-line">${form.responsibleName}</span></div>
    <div style="margin-top:4px;">${form.responsibleDate}</div>
  </div>
  <div style="flex:1;border:1px solid #000;padding:6px;">
    <div style="margin-bottom:4px;font-weight:bold;">Отметка бухгалтерии</div>
    <div style="font-size:8pt;">Корреспонденция счетов (графы 10, 11) отражена в журнале операций за <span class="underline-input">${form.accountingJournalPeriod}</span> г.</div>
    <div style="margin-top:4px;">Исполнитель (должность) <span class="sign-line">${form.accountingExecutorPosition}</span> (подпись) <span class="sign-line"></span> (расшифровка подписи) <span class="sign-line">${form.accountingExecutorName}</span></div>
    <div style="margin-top:4px;">${form.accountingDate}</div>
  </div>
</div>
<div style="margin-top:14px;">
  <div style="font-weight:bold;">Получил</div>
  <div>(звание) <span class="sign-line">${form.receivedByRank}</span> (подпись) <span class="sign-line"></span> (расшифровка подписи) <span class="sign-line">${form.receivedByName}</span></div>
  <div style="margin-top:4px;">${form.receivedByDate}</div>
</div>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const handleExcelExport = () => {
    const headerRows = [
      ['ТРЕБОВАНИЕ-НАКЛАДНАЯ №', form.invoiceNumber],
      ['от', form.invoiceDate],
      [],
      ['Учреждение', form.institution],
      ['Структурное подразделение — отправитель', form.senderDivision],
      ['Структурное подразделение — получатель', form.receiverDivision],
      [],
      [
        '№ п/п',
        'Наименование',
        'Номенклатурный',
        'Паспорта (иной)',
        'Ед.изм. наименование',
        'Код по ОКЕИ',
        'Цена',
        'Затребовано',
        'Отпущено',
        'Сумма (без НДС)',
        'Дебет',
        'Кредит',
        'Примечание',
      ],
    ];

    const dataRows = form.rows.map((r, i) => [
      i + 1,
      r.name,
      r.nomNumber,
      r.passport,
      r.unit,
      r.okeiCode,
      r.price || '',
      r.qtyRequested || '',
      r.qtyReleased || '',
      (Number(r.price) || 0) * (Number(r.qtyReleased) || 0) || '',
      r.debit,
      r.credit,
      r.note,
    ]);

    const totalRow = [
      '',
      '',
      '',
      '',
      '',
      '',
      'Итого',
      totals.qtyRequested || '',
      totals.qtyReleased || '',
      totals.sum ? totals.sum.toFixed(2) : '',
      '',
      '',
      '',
    ];

    const allRows = [...headerRows, ...dataRows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Накладная');
    XLSX.writeFile(wb, `Накладная_${form.invoiceNumber}.xlsx`);
  };

  const cellStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '2px 4px',
    fontSize: '9pt',
    fontFamily: "'Times New Roman', serif",
  };

  const cellInputStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    width: '100%',
    fontFamily: "'Times New Roman', serif",
    fontSize: '9pt',
    padding: 0,
    margin: 0,
  };

  const underlineInputStyle: React.CSSProperties = {
    border: 'none',
    borderBottom: '1px solid #000',
    outline: 'none',
    background: 'transparent',
    fontFamily: "'Times New Roman', serif",
    fontSize: '10pt',
    padding: '0 4px',
    minWidth: '80px',
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-4 py-2 bg-white border-b shrink-0"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <h1 className="text-lg font-semibold">Шаблон накладной</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Icon name="Trash2" size={16} />
            Очистить форму
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Icon name="Save" size={16} />
            Сохранить
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Icon name="Printer" size={16} />
            Печать
          </Button>
          <Button variant="outline" size="sm" onClick={handleExcelExport}>
            <Icon name="FileSpreadsheet" size={16} />
            Экспорт Excel
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-300 p-6">
        <div
          className="mx-auto bg-white shadow-lg"
          style={{
            width: '1200px',
            minHeight: '800px',
            padding: '24px 32px',
            fontFamily: "'Times New Roman', serif",
            fontSize: '10pt',
          }}
        >
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <table
              style={{
                borderCollapse: 'collapse',
                position: 'absolute',
                right: 0,
                top: 0,
              }}
            >
              <tbody>
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      border: '1px solid #000',
                      padding: '1px 8px',
                      fontSize: '8pt',
                      textAlign: 'center',
                    }}
                  >
                    Коды
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      border: '1px solid #000',
                      padding: '1px 8px',
                      fontSize: '8pt',
                    }}
                  >
                    Форма по ОКУД
                  </td>
                  <td
                    style={{
                      border: '1px solid #000',
                      padding: '1px 8px',
                      fontSize: '8pt',
                      textAlign: 'center',
                      minWidth: '60px',
                    }}
                  >
                    <input
                      style={{ ...underlineInputStyle, borderBottom: 'none', fontSize: '8pt', width: '60px', textAlign: 'center' }}
                      value={form.okudCode}
                      onChange={e => updateField('okudCode', e.target.value)}
                    />
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      border: '1px solid #000',
                      padding: '1px 8px',
                      fontSize: '8pt',
                    }}
                  >
                    Дата
                  </td>
                  <td
                    style={{
                      border: '1px solid #000',
                      padding: '1px 8px',
                      fontSize: '8pt',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      style={{ ...underlineInputStyle, borderBottom: 'none', fontSize: '8pt', width: '60px', textAlign: 'center' }}
                      value={form.headerDate}
                      onChange={e => updateField('headerDate', e.target.value)}
                    />
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      border: '1px solid #000',
                      padding: '1px 8px',
                      fontSize: '8pt',
                    }}
                  >
                    по ОКПО
                  </td>
                  <td
                    style={{
                      border: '1px solid #000',
                      padding: '1px 8px',
                      fontSize: '8pt',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      style={{ ...underlineInputStyle, borderBottom: 'none', fontSize: '8pt', width: '60px', textAlign: 'center' }}
                      value={form.okpoCode}
                      onChange={e => updateField('okpoCode', e.target.value)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ textAlign: 'center', paddingTop: '4px' }}>
              <span style={{ fontSize: '14pt', fontWeight: 'bold' }}>
                ТРЕБОВАНИЕ-НАКЛАДНАЯ №{' '}
              </span>
              <input
                style={{
                  ...underlineInputStyle,
                  fontSize: '14pt',
                  fontWeight: 'bold',
                  width: '100px',
                  textAlign: 'center',
                }}
                value={form.invoiceNumber}
                onChange={e => updateField('invoiceNumber', e.target.value)}
              />
            </div>
            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              <span>от </span>
              <input
                style={{
                  ...underlineInputStyle,
                  width: '200px',
                  textAlign: 'center',
                }}
                value={form.invoiceDate}
                onChange={e => updateField('invoiceDate', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ whiteSpace: 'nowrap' }}>Учреждение</span>
            <input
              style={{ ...underlineInputStyle, flex: 1 }}
              value={form.institution}
              onChange={e => updateField('institution', e.target.value)}
            />
          </div>
          <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ whiteSpace: 'nowrap' }}>Структурное подразделение — отправитель</span>
            <input
              style={{ ...underlineInputStyle, flex: 1 }}
              value={form.senderDivision}
              onChange={e => updateField('senderDivision', e.target.value)}
            />
          </div>
          <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ whiteSpace: 'nowrap' }}>Структурное подразделение — получатель</span>
            <input
              style={{ ...underlineInputStyle, flex: 1 }}
              value={form.receiverDivision}
              onChange={e => updateField('receiverDivision', e.target.value)}
            />
          </div>
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span>Единица измерения: руб. (с точностью до второго десятичного знака)</span>
            <span style={{ whiteSpace: 'nowrap' }}>
              по ОКЕИ{' '}
              <input
                style={{ ...underlineInputStyle, width: '50px', textAlign: 'center' }}
                value={form.okeiCode}
                onChange={e => updateField('okeiCode', e.target.value)}
              />
            </span>
          </div>

          <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ whiteSpace: 'nowrap' }}>Затребовал</span>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                style={{ ...underlineInputStyle, width: '140px', textAlign: 'center' }}
                value={form.requestedByRank}
                onChange={e => updateField('requestedByRank', e.target.value)}
              />
              <span style={{ fontSize: '7pt', color: '#555' }}>(звание)</span>
            </div>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '140px', height: '16px' }}>&nbsp;</span>
              <span style={{ fontSize: '7pt', color: '#555' }}>(подпись)</span>
            </div>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                style={{ ...underlineInputStyle, width: '180px', textAlign: 'center' }}
                value={form.requestedByName}
                onChange={e => updateField('requestedByName', e.target.value)}
              />
              <span style={{ fontSize: '7pt', color: '#555' }}>(Фамилия, инициалы)</span>
            </div>
          </div>

          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ whiteSpace: 'nowrap' }}>Разрешил</span>
            <span style={{ whiteSpace: 'nowrap', fontSize: '9pt' }}>НЦ (БнС)</span>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                style={{ ...underlineInputStyle, width: '140px', textAlign: 'center' }}
                value={form.approvedByPosition}
                onChange={e => updateField('approvedByPosition', e.target.value)}
              />
              <span style={{ fontSize: '7pt', color: '#555' }}>(должность)</span>
            </div>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '140px', height: '16px' }}>&nbsp;</span>
              <span style={{ fontSize: '7pt', color: '#555' }}>(подпись)</span>
            </div>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                style={{ ...underlineInputStyle, width: '180px', textAlign: 'center' }}
                value={form.approvedByName}
                onChange={e => updateField('approvedByName', e.target.value)}
              />
              <span style={{ fontSize: '7pt', color: '#555' }}>(расшифровка подписи)</span>
            </div>
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '6px' }}>
            <thead>
              <tr>
                <th rowSpan={3} style={{ ...cellStyle, width: '28px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  № п/п
                </th>
                <th colSpan={3} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'normal' }}>
                  Материальные ценности
                </th>
                <th rowSpan={2} style={{ ...cellStyle, width: '50px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  номер
                </th>
                <th colSpan={2} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'normal' }}>
                  Единица измерения
                </th>
                <th rowSpan={2} style={{ ...cellStyle, width: '62px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  Цена
                </th>
                <th colSpan={2} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'normal' }}>
                  Количество
                </th>
                <th rowSpan={2} style={{ ...cellStyle, width: '72px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  Сумма<br />(без НДС)
                </th>
                <th colSpan={2} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  Корреспондирующие счета
                </th>
                <th rowSpan={2} style={{ ...cellStyle, width: '70px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  Примечание
                </th>
              </tr>
              <tr>
                <th style={{ ...cellStyle, textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  наименование
                </th>
                <th style={{ ...cellStyle, width: '70px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  номенклатурный
                </th>
                <th style={{ ...cellStyle, width: '70px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  паспорта (иной)
                </th>
                <th style={{ ...cellStyle, width: '50px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  наименование
                </th>
                <th style={{ ...cellStyle, width: '46px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  код по ОКЕИ
                </th>
                <th style={{ ...cellStyle, width: '64px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  затребовано
                </th>
                <th style={{ ...cellStyle, width: '64px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  отпущено
                </th>
                <th style={{ ...cellStyle, width: '54px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  дебет
                </th>
                <th style={{ ...cellStyle, width: '54px', textAlign: 'center', fontWeight: 'normal', fontSize: '8pt' }}>
                  кредит
                </th>
              </tr>
              <tr>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(n => (
                  <th
                    key={n}
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      fontWeight: 'normal',
                      fontSize: '7pt',
                      padding: '1px',
                    }}
                  >
                    {n}
                  </th>
                ))}
                <th
                  style={{
                    ...cellStyle,
                    textAlign: 'center',
                    fontWeight: 'normal',
                    fontSize: '7pt',
                    padding: '1px',
                  }}
                >
                  13
                </th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, idx) => {
                const rowSum = (Number(row.price) || 0) * (Number(row.qtyReleased) || 0);
                return (
                  <tr key={idx}>
                    <td style={{ ...cellStyle, textAlign: 'center', fontSize: '8pt' }}>{idx + 1}</td>
                    <td style={cellStyle}>
                      <input
                        style={cellInputStyle}
                        value={row.name}
                        onChange={e => updateRow(idx, 'name', e.target.value)}
                      />
                    </td>
                    <td style={cellStyle}>
                      <input
                        style={{ ...cellInputStyle, textAlign: 'center' }}
                        value={row.nomNumber}
                        onChange={e => updateRow(idx, 'nomNumber', e.target.value)}
                      />
                    </td>
                    <td style={cellStyle}>
                      <input
                        style={{ ...cellInputStyle, textAlign: 'center' }}
                        value={row.passport}
                        onChange={e => updateRow(idx, 'passport', e.target.value)}
                      />
                    </td>
                    <td style={cellStyle}>
                      <input
                        style={{ ...cellInputStyle, textAlign: 'center' }}
                        value={row.unit}
                        onChange={e => updateRow(idx, 'unit', e.target.value)}
                      />
                    </td>
                    <td style={cellStyle}>
                      <input
                        style={{ ...cellInputStyle, textAlign: 'center' }}
                        value={row.okeiCode}
                        onChange={e => updateRow(idx, 'okeiCode', e.target.value)}
                      />
                    </td>
                    <td style={cellStyle}>
                      <input
                        style={{ ...cellInputStyle, textAlign: 'right' }}
                        type="number"
                        value={row.price || ''}
                        onChange={e => updateRow(idx, 'price', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={cellStyle}>
                      <input
                        style={{ ...cellInputStyle, textAlign: 'center' }}
                        type="number"
                        value={row.qtyRequested || ''}
                        onChange={e => updateRow(idx, 'qtyRequested', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={cellStyle}>
                      <input
                        style={{ ...cellInputStyle, textAlign: 'center' }}
                        type="number"
                        value={row.qtyReleased || ''}
                        onChange={e => updateRow(idx, 'qtyReleased', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontSize: '8pt' }}>
                      {rowSum ? rowSum.toFixed(2) : ''}
                    </td>
                    <td style={cellStyle}>
                      <input
                        style={{ ...cellInputStyle, textAlign: 'center' }}
                        value={row.debit}
                        onChange={e => updateRow(idx, 'debit', e.target.value)}
                      />
                    </td>
                    <td style={cellStyle}>
                      <input
                        style={{ ...cellInputStyle, textAlign: 'center' }}
                        value={row.credit}
                        onChange={e => updateRow(idx, 'credit', e.target.value)}
                      />
                    </td>
                    <td style={{ ...cellStyle, position: 'relative' }}>
                      <input
                        style={{ ...cellInputStyle, paddingRight: '16px' }}
                        value={row.note}
                        onChange={e => updateRow(idx, 'note', e.target.value)}
                      />
                      <button
                        onClick={() => removeRow(idx)}
                        style={{
                          position: 'absolute',
                          right: '2px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#c00',
                          fontSize: '12px',
                          lineHeight: 1,
                          padding: '0 2px',
                          fontFamily: 'system-ui',
                        }}
                        title="Удалить строку"
                      >
                        <Icon name="X" size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td
                  colSpan={7}
                  style={{
                    ...cellStyle,
                    textAlign: 'right',
                    fontWeight: 'bold',
                    fontSize: '9pt',
                  }}
                >
                  Итого
                </td>
                <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>
                  {totals.qtyRequested || ''}
                </td>
                <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>
                  {totals.qtyReleased || ''}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>
                  {totals.sum ? totals.sum.toFixed(2) : ''}
                </td>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
                <td style={cellStyle}></td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginBottom: '12px' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={addRow}
              style={{ fontFamily: 'system-ui, sans-serif', fontSize: '12px' }}
            >
              <Icon name="Plus" size={14} />
              Добавить строку
            </Button>
          </div>

          <div style={{ display: 'flex', gap: '14px', marginTop: '16px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Отпустил</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    style={{ ...underlineInputStyle, width: '110px', textAlign: 'center' }}
                    value={form.releasedByRank}
                    onChange={e => updateField('releasedByRank', e.target.value)}
                  />
                  <span style={{ fontSize: '7pt', color: '#555' }}>(звание)</span>
                </div>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '100px', height: '16px' }}>&nbsp;</span>
                  <span style={{ fontSize: '7pt', color: '#555' }}>(подпись)</span>
                </div>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    style={{ ...underlineInputStyle, width: '130px', textAlign: 'center' }}
                    value={form.releasedByName}
                    onChange={e => updateField('releasedByName', e.target.value)}
                  />
                  <span style={{ fontSize: '7pt', color: '#555' }}>(расшифровка подписи)</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                <input
                  style={{ ...underlineInputStyle, width: '160px' }}
                  value={form.releasedByDate}
                  onChange={e => updateField('releasedByDate', e.target.value)}
                  placeholder="«__» __________ 20__ г."
                />
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Ответственный исполнитель</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    style={{ ...underlineInputStyle, width: '110px', textAlign: 'center' }}
                    value={form.responsiblePosition}
                    onChange={e => updateField('responsiblePosition', e.target.value)}
                  />
                  <span style={{ fontSize: '7pt', color: '#555' }}>(должность)</span>
                </div>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '100px', height: '16px' }}>&nbsp;</span>
                  <span style={{ fontSize: '7pt', color: '#555' }}>(подпись)</span>
                </div>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    style={{ ...underlineInputStyle, width: '130px', textAlign: 'center' }}
                    value={form.responsibleName}
                    onChange={e => updateField('responsibleName', e.target.value)}
                  />
                  <span style={{ fontSize: '7pt', color: '#555' }}>(расш. подп.)</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                <input
                  style={{ ...underlineInputStyle, width: '160px' }}
                  value={form.responsibleDate}
                  onChange={e => updateField('responsibleDate', e.target.value)}
                  placeholder="«__» __________ 20__ г."
                />
              </div>
            </div>

            <div style={{ flex: 1, border: '1px solid #000', padding: '8px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Отметка бухгалтерии</div>
              <div style={{ fontSize: '8pt', marginBottom: '6px' }}>
                Корреспонденция счетов (графы 10, 11) отражена в журнале операций за{' '}
                <input
                  style={{ ...underlineInputStyle, width: '80px', fontSize: '8pt', textAlign: 'center' }}
                  value={form.accountingJournalPeriod}
                  onChange={e => updateField('accountingJournalPeriod', e.target.value)}
                />
                {' '}г.
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', flexWrap: 'wrap', fontSize: '8pt', marginBottom: '4px' }}>
                <span>Исполнитель</span>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    style={{ ...underlineInputStyle, width: '80px', fontSize: '8pt', textAlign: 'center' }}
                    value={form.accountingExecutorPosition}
                    onChange={e => updateField('accountingExecutorPosition', e.target.value)}
                  />
                  <span style={{ fontSize: '6pt', color: '#555' }}>(должность)</span>
                </div>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '70px', height: '14px' }}>&nbsp;</span>
                  <span style={{ fontSize: '6pt', color: '#555' }}>(подпись)</span>
                </div>
                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                  <input
                    style={{ ...underlineInputStyle, width: '90px', fontSize: '8pt', textAlign: 'center' }}
                    value={form.accountingExecutorName}
                    onChange={e => updateField('accountingExecutorName', e.target.value)}
                  />
                  <span style={{ fontSize: '6pt', color: '#555' }}>(расшифровка подписи)</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
                <input
                  style={{ ...underlineInputStyle, width: '140px', fontSize: '8pt' }}
                  value={form.accountingDate}
                  onChange={e => updateField('accountingDate', e.target.value)}
                  placeholder="«__» __________ 20__ г."
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '8px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Получил</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                <input
                  style={{ ...underlineInputStyle, width: '140px', textAlign: 'center' }}
                  value={form.receivedByRank}
                  onChange={e => updateField('receivedByRank', e.target.value)}
                />
                <span style={{ fontSize: '7pt', color: '#555' }}>(звание)</span>
              </div>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '140px', height: '16px' }}>&nbsp;</span>
                <span style={{ fontSize: '7pt', color: '#555' }}>(подпись)</span>
              </div>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                <input
                  style={{ ...underlineInputStyle, width: '180px', textAlign: 'center' }}
                  value={form.receivedByName}
                  onChange={e => updateField('receivedByName', e.target.value)}
                />
                <span style={{ fontSize: '7pt', color: '#555' }}>(расшифровка подписи)</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px' }}>
              <input
                style={{ ...underlineInputStyle, width: '200px' }}
                value={form.receivedByDate}
                onChange={e => updateField('receivedByDate', e.target.value)}
                placeholder="«__» __________ 20__ г."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}